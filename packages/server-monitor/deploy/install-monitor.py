#!/usr/bin/python3
"""Reviewed, phased installation. Never deploys application code or touches media/schedules."""
import socket
import argparse, hashlib, json, os, pathlib, pwd, grp, secrets, shutil, subprocess, sys, tarfile, tempfile, time, urllib.request
P=pathlib.Path
PREFIX=P('/opt/repro-monitor'); CONFIG=P('/etc/repro-monitor'); STATE=P('/var/lib/repro-monitor-install')
UNITS=['repro-monitor','repro-monitor-ai','repro-prometheus','repro-loki','repro-alloy']
def run(args,**kwargs):
    result=subprocess.run(args,check=True,capture_output=True,text=True,timeout=kwargs.pop('timeout',60),**kwargs)
    return result.stdout.strip()
def atomic(path,data,mode=0o644,owner=0,group=0):
    path=P(path);path.parent.mkdir(parents=True,exist_ok=True)
    fd,temp=tempfile.mkstemp(dir=path.parent,prefix='.repro-monitor-')
    try:
        with os.fdopen(fd,'wb') as f:f.write(data.encode() if isinstance(data,str) else data);f.flush();os.fsync(f.fileno())
        os.chmod(temp,mode);os.chown(temp,owner,group);os.replace(temp,path)
    finally:
        if os.path.exists(temp):os.unlink(temp)
def sha(path):return hashlib.sha256(P(path).read_bytes()).hexdigest()
def protect_storage():
    env=P('/var/www/backend/.env').read_text()
    retained='\n'.join(line for line in env.splitlines() if not line.startswith('SERVER_MONITOR_'))
    return {'environmentExceptMonitor':hashlib.sha256(retained.encode()).hexdigest(),'publicStorage':os.path.realpath('/var/www/backend/public/storage'),'crontab':sha('/etc/crontab')}
def verify_bundle(bundle,expected):
    if len(expected)!=64 or sha(bundle)!=expected:raise RuntimeError('Release archive checksum mismatch')
    with tarfile.open(bundle,'r:gz') as tar:
        manifest=json.load(tar.extractfile('repro-monitor-release/manifest.json'))
        for key in ['frontendCommit','backendCommit']:
            if len(manifest.get(key,''))!=40 or any(c not in '0123456789abcdef' for c in manifest[key]):raise RuntimeError('Invalid release commit')
        if manifest.get('validation')!='passed':raise RuntimeError('Required release checks have not passed')
        for member in tar.getmembers():
            tarfile.data_filter(member,'/repro-monitor-archive-verification')
            if member.name=='repro-monitor-release' and member.isdir():continue
            if not member.name.startswith('repro-monitor-release/') or '..' in P(member.name).parts:raise RuntimeError('Unsafe archive entry')
    return manifest
def health():
    result={}
    for name,url in [('gateway','http://127.0.0.1:9470/health'),('prometheus','http://127.0.0.1:9095/-/ready'),('loki','http://127.0.0.1:3105/ready'),('alloy','http://127.0.0.1:12345/-/ready')]:
        try:result[name]=urllib.request.urlopen(url,timeout=3).status==200
        except Exception:result[name]=False
    return result
def wait_ready():
    for attempt in range(30):
        state=health()
        if all(state.values()):return state
        time.sleep(2)
    raise RuntimeError('Monitoring readiness failed: '+json.dumps(state))
def install(args):
    manifest=verify_bundle(args.bundle,args.sha256)
    if (PREFIX/'current').exists():raise RuntimeError('An installation already exists; review an upgrade separately')
    if shutil.disk_usage('/var/lib').free<25*1024**3:raise RuntimeError('At least 25 GiB free on NVMe is required for the 20 GiB budget and headroom')
    if P('/var/www/backend/storage/framework/down').exists():raise RuntimeError('Application is already in maintenance; stop and investigate')
    for port in [9470,9471,9095,9096,3105,12345]:
        with socket.socket() as probe:
            try:probe.bind(('127.0.0.1',port))
            except OSError:raise RuntimeError('Port '+str(port)+' is already occupied. Stop the isolated preview or resolve the conflicting service before installation.')
    before=protect_storage();uid=pwd.getpwnam('maverick').pw_uid;web=grp.getgrnam('www-data').gr_gid
    STATE.mkdir(mode=0o700,parents=True,exist_ok=True)
    PREFIX.mkdir(mode=0o755,exist_ok=True)
    with tempfile.TemporaryDirectory(dir=PREFIX,prefix='stage-') as temp:
        with tarfile.open(args.bundle,'r:gz') as tar:tar.extractall(temp,filter='data')
        source=P(temp)/'repro-monitor-release'
        for rel,expected in json.loads((source/'files.json').read_text()).items():
            path=source/rel
            if P(rel).is_absolute() or '..' in P(rel).parts or not path.resolve().is_relative_to(source.resolve()):raise RuntimeError('Unsafe file manifest')
            if path.is_symlink() or sha(path)!=expected:raise RuntimeError('Release file verification failed: '+rel)
        release=PREFIX/'releases'/manifest['frontendCommit'];release.parent.mkdir(exist_ok=True)
        if release.exists():raise RuntimeError('Release directory already exists')
        shutil.move(source,release)
    # The validated, immutable root-owned release is installed without running npm as root.
    os.symlink(release,PREFIX/'current')
    try:
        try:monitor=pwd.getpwnam('repro-monitor')
        except KeyError:run(['useradd','--system','--home-dir','/var/lib/repro-monitor','--no-create-home','--shell','/usr/sbin/nologin','repro-monitor']);monitor=pwd.getpwnam('repro-monitor')
        CONFIG.mkdir(mode=0o755,exist_ok=True);os.chown(CONFIG,0,0);os.chmod(CONFIG,0o755)
        for name,owner,group in [('auth.key',0,web),('operator.token',uid,monitor.pw_gid),('broker.token',uid,monitor.pw_gid),('ingest.token',0,grp.getgrnam('adm').gr_gid)]:
            path=CONFIG/name
            if path.exists():raise RuntimeError('Unexpected existing monitor credentials')
            atomic(path,secrets.token_hex(32)+'\n',0o640,owner,group)
        for path,owner,group,mode in [('/var/lib/repro-monitor',monitor.pw_uid,web,0o750),('/var/lib/repro-monitor/prometheus',monitor.pw_uid,monitor.pw_gid,0o700),('/var/lib/repro-monitor/loki',monitor.pw_uid,monitor.pw_gid,0o700),('/var/lib/repro-monitor/alloy',uid,monitor.pw_gid,0o750),('/var/lib/repro-monitor-ai',uid,monitor.pw_gid,0o700)]:
            P(path).mkdir(mode=mode,parents=True,exist_ok=True);os.chown(path,owner,group);os.chmod(path,mode)
        gateway={'brokerSocket':'/run/repro-monitor-ai/broker.sock'}
        broker={'socket':'/run/repro-monitor-ai/broker.sock','tokenFile':'/etc/repro-monitor/broker.token','stateDir':'/var/lib/repro-monitor-ai','codexBinary':'/usr/lib/chatgpt/resources/codex','grokBinary':'/usr/local/bin/grok'}
        desktop={'socket':'/run/repro-monitor/operator.sock','tokenFile':'/etc/repro-monitor/operator.token'}
        for name,value in [('gateway',gateway),('broker',broker),('desktop',desktop)]:atomic(CONFIG/(name+'.json'),json.dumps(value,indent=2)+'\n')
        for name in ['prometheus.yml','loki.yml','config.alloy']:atomic(CONFIG/name,(release/'deploy'/name).read_bytes())
        run([str(release/'bin/promtool'),'check','config',str(CONFIG/'prometheus.yml')])
        run([str(release/'bin/loki'),'-config.file='+str(CONFIG/'loki.yml'),'-verify-config=true'])
        run([str(release/'bin/alloy'),'validate',str(CONFIG/'config.alloy')])
        for unit in (release/'units').iterdir():atomic(P('/etc/systemd/system')/unit.name,unit.read_bytes())
        run(['systemctl','daemon-reload']);run(['systemd-analyze','verify',*[str(p) for p in (release/'units').glob('*.service')]])
        atomic(STATE/'installation.json',json.dumps({'manifest':manifest,'storageBefore':before,'installedAt':time.time()},indent=2),0o600)
        run(['systemctl','enable','--now','repro-monitor.target'])
        wait_ready()
        if protect_storage()!=before:raise RuntimeError('Storage or schedule invariants changed')
        run(['dpkg','--install',str(release/'desktop/repro-server-monitor_1.0.0_amd64.deb')],timeout=120)
        # Autostart only for the designated operator, preserving unrelated startup entries.
        autostart=P('/home/maverick/.config/autostart/repro-server-monitor.desktop')
        if not autostart.parent.exists():
            autostart.parent.mkdir(mode=0o755,parents=True);os.chown(autostart.parent,uid,pwd.getpwnam('maverick').pw_gid)
        atomic(autostart,'[Desktop Entry]\nType=Application\nName=RePro Server Monitor\nExec=/opt/repro-monitor-desktop/electron\nTerminal=false\nX-GNOME-Autostart-enabled=true\n',0o644,uid,pwd.getpwnam('maverick').pw_gid)
        print('Collection installed. Application instrumentation and automatic AI remain disabled. Run the guarded application release before activate.')
    except Exception:
        subprocess.run(['systemctl','disable','--now','repro-monitor.target'],capture_output=True)
        print('Installation stopped on failure. Monitoring is disabled; retained files and diagnostics are under /opt/repro-monitor and /var/lib/repro-monitor-install.',file=sys.stderr)
        raise

def backup_file(path,records):
    path=P(path).resolve();key=hashlib.sha256(str(path).encode()).hexdigest();backup=STATE/key
    if path.exists():
        info=path.stat();atomic(backup,path.read_bytes(),0o600)
        records.append({'path':str(path),'backup':str(backup),'mode':info.st_mode&0o777,'uid':info.st_uid,'gid':info.st_gid})
    else:records.append({'path':str(path),'backup':None})

def change_env(enabled):
    path=P('/var/www/backend/.env');info=path.stat();lines=[line for line in path.read_text().splitlines() if not line.startswith('SERVER_MONITOR_ENABLED=')];lines.append('SERVER_MONITOR_ENABLED='+('true' if enabled else 'false'));atomic(path,'\n'.join(lines)+'\n',info.st_mode&0o777,info.st_uid,info.st_gid)
def cache():run(['runuser','--user','maverick','--group','www-data','--','php','artisan','config:cache'],cwd='/var/www/backend')
def restore(records,check=True):
    for r in reversed(records):
        path=P(r['path'])
        if check and path.exists() and sha(path)!=r['installedHash']:raise RuntimeError('A configuration changed since activation; refusing to overwrite: '+str(path))
        if r['backup']:atomic(path,P(r['backup']).read_bytes(),r['mode'],r['uid'],r['gid'])
        elif path.exists():path.unlink()
    cache();run(['/usr/sbin/php-fpm8.3','-t']);run(['/usr/sbin/nginx','-t']);run(['systemctl','reload','php8.3-fpm','nginx'])
def activate(args):
    installation=json.loads((STATE/'installation.json').read_text());manifest=installation['manifest'];release=(PREFIX/'current').resolve();wait_ready()
    if (STATE/'activation.json').exists():raise RuntimeError('Activation already recorded')
    for path,key in [('/var/www/backend/storage/app/deploy-meta.json','backendCommit'),('/var/www/frontend/dist/deploy-meta.json','frontendCommit')]:
        if json.loads(P(path).read_text()).get('commit')!=manifest[key]:raise RuntimeError('Guarded application deployment does not match the reviewed '+key)
    before=protect_storage();records=[];env=P('/var/www/backend/.env');nginx=P('/etc/nginx/sites-enabled/frontend.conf').resolve()
    paths=[env,nginx,P('/etc/nginx/snippets/repro-monitor.conf'),P('/etc/nginx/conf.d/repro-monitor-status.conf'),P('/etc/php/8.3/fpm/pool.d/zz-repro-monitor.conf')]
    for path in paths:backup_file(path,records)
    try:
        text=nginx.read_text();needle='server_name reprodashboard.com www.reprodashboard.com;'
        # Require the exact inspected HTTPS virtual host, never rewrite other server blocks.
        blocks=text.split('server {');selected=[i for i,b in enumerate(blocks) if needle in b and 'listen 443' in b]
        if len(selected)!=1 or 'snippets/repro-monitor.conf' in text:raise RuntimeError('Nginx virtual host differs from the reviewed structure')
        index=selected[0];blocks[index]=blocks[index].replace(needle,needle+'\n    include /etc/nginx/snippets/repro-monitor.conf;',1)
        atomic(nginx,'server {'.join(blocks),nginx.stat().st_mode&0o777)
        for target,source in [(paths[2],'nginx-server-location.conf'),(paths[3],'nginx-status.conf'),(paths[4],'php-fpm-monitor.conf')]:atomic(target,(release/'deploy'/source).read_bytes())
        run(['/usr/sbin/php-fpm8.3','-t']);run(['/usr/sbin/nginx','-t'])
        change_env(True);cache();run(['systemctl','reload','php8.3-fpm','nginx'])
        run(['runuser','--user','maverick','--group','www-data','--','php','artisan','queue:restart'],cwd='/var/www/backend')
        for url in ['http://127.0.0.1:9471/nginx-status','http://127.0.0.1:9471/fpm-status?json','https://reprodashboard.com/up']:
            if urllib.request.urlopen(url,timeout=10).status!=200:raise RuntimeError('Activation health check failed')
        if protect_storage()!=before:raise RuntimeError('Storage/scheduler invariant failed')
        for r in records:r['installedHash']=sha(r['path'])
        atomic(STATE/'activation.json',json.dumps({'activatedAt':time.time(),'files':records,'storageBefore':before},indent=2),0o600)
        print('Application instrumentation and dashboard routing activated. Begin 24-hour passive observation; automatic AI is still disabled.')
    except Exception:
        restore(records,check=False)
        print('Activation failed; previous web/PHP/application configuration restored.',file=sys.stderr)
        raise

def rollback(args):
    path=STATE/'activation.json'
    if path.exists():
        data=json.loads(path.read_text());restore(data['files']);path.rename(STATE/('activation-rolled-back-'+str(int(time.time()))+'.json'))
    run(['systemctl','disable','--now','repro-monitor.target'])
    autostart=P('/home/maverick/.config/autostart/repro-server-monitor.desktop')
    if autostart.exists():autostart.unlink()
    print('Monitoring disabled. Media tiering, retained source copies, application schedules and monitoring history are retained.')

def main():
    parser=argparse.ArgumentParser();parser.add_argument('phase',choices=['preflight','collect','activate','rollback','status']);parser.add_argument('--bundle');parser.add_argument('--sha256');args=parser.parse_args()
    if args.phase=='status':print(json.dumps(health(),indent=2));return
    if args.phase in ['preflight','collect']:
        if not args.bundle or not args.sha256:parser.error('--bundle and --sha256 are required')
        manifest=verify_bundle(args.bundle,args.sha256)
        if args.phase=='preflight':print(json.dumps({'archiveVerified':True,**manifest,'applicationDeploymentRequired':True},indent=2));return
    if os.geteuid()!=0:raise SystemExit('Root access is required for systemd, /opt installation and reviewed Nginx/PHP configuration. Run this exact reviewed script with sudo.')
    {'collect':install,'activate':activate,'rollback':rollback}[args.phase](args)
if __name__=='__main__':
    try:main()
    except Exception as e:print('STOP: '+str(e),file=sys.stderr);sys.exit(1)
