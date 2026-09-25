#!/usr/bin/python3
"""Fixed root collector: inventory/SMART only; no arbitrary commands or paths."""
import datetime, hashlib, json, pathlib, re, subprocess, sys, os, tempfile, shlex
COMMANDS={}
NOW = datetime.datetime.now(datetime.timezone.utc).isoformat().replace('+00:00','Z')
def run(args):
    result = subprocess.run(args, capture_output=True, text=True, timeout=2, env={'PATH':'/usr/sbin:/usr/bin:/sbin:/bin','LANG':'C'})
    if len(result.stdout)>1024*1024: raise RuntimeError('Output limit exceeded')
    return result
def coverage(name,status,detail=None,interval=60000):
    return {'id':name,'label':name.replace('-',' ').title(),'status':status,'detail':detail,'observedAt':NOW,'intervalMs':interval}
def cron_rows(path,system=False):
    rows=[];timezone='system local time'
    for index,line in enumerate(path.read_text().splitlines()[:1000]):
        line=line.strip()
        if not line or line.startswith('#'):continue
        if line.startswith('CRON_TZ='):timezone=line.split('=',1)[1].strip('"\'')[:100];continue
        if re.match(r'^[A-Za-z_][A-Za-z0-9_]*\s*=',line):continue
        count=(2 if system else 1) if line.startswith('@') else (6 if system else 5)
        fields=line.split(None,count)
        if len(fields)<=count:continue
        command=fields[-1];expression=' '.join(fields[:1 if line.startswith('@') else 5])
        match=re.search(r'artisan\s+([\w:-]+)',command)
        try:tokens=shlex.split(command)
        except ValueError:tokens=[]
        executable=next((t for t in tokens if not re.match(r'^[A-Za-z_][A-Za-z0-9_]*=',t)), 'unparsed-command')
        name=match.group(1) if match else pathlib.Path(executable).name
        # Never expose cron command arguments, environment values or embedded credentials.
        name=re.sub(r'[^a-zA-Z0-9_.:-]','_',name)[:80]
        identifier='cron:'+hashlib.sha256((str(path)+str(index)+line).encode()).hexdigest()[:20]
        COMMANDS[command.strip()]=identifier
        rows.append({'id':identifier,'name':name,'source':str(path),'expression':expression,'timezone':timezone,'nextRun':None,'lastRun':None,'outcome':'unknown','durationMs':None})
    return rows
def inventory():
    rows=[];sources=[];services=[];metrics=[]
    paths=[(pathlib.Path('/etc/crontab'),True)]+[(p,True) for p in pathlib.Path('/etc/cron.d').glob('*') if p.is_file()]+[(p,False) for p in pathlib.Path('/var/spool/cron/crontabs').glob('*') if p.is_file()]
    if not os.access('/var/spool/cron/crontabs',os.R_OK):sources.append(coverage('user-crontabs','unavailable','Root inventory service required to enumerate all user crontabs'))
    for period in ['hourly','daily','weekly','monthly']:
        directory=pathlib.Path('/etc/cron.'+period)
        for item in sorted(directory.glob('*'))[:100]:
            if item.is_file() and os.access(item,os.X_OK):
                rows.append({'id':'periodic:'+period+':'+item.name,'name':item.name,'source':str(directory),'expression':'run-parts / anacron '+period,'timezone':'system local time','nextRun':None,'lastRun':None,'outcome':'unknown','durationMs':None})
        sources.append(coverage('periodic-'+period,'healthy','Execution follows the existing run-parts/anacron trigger; per-script completion is not instrumented'))
    for path,system in paths:
        if not path.exists():continue
        try:rows.extend(cron_rows(path,system));sources.append(coverage('cron:'+path.name,'healthy'))
        except OSError:sources.append(coverage('cron:'+path.name,'unavailable','Cron file unreadable'))
    try:
        journal=run(['/usr/bin/journalctl','--unit=cron.service','--since=-5min','--lines=500','--output=json','--no-pager'])
        if journal.returncode:raise RuntimeError('journal unreadable')
        starts={}
        for line in journal.stdout.splitlines():
            entry=json.loads(line);match=re.search(r'\) CMD \((.*)\)$',entry.get('MESSAGE',''))
            if match and match.group(1).strip() in COMMANDS:
                starts[COMMANDS[match.group(1).strip()]]=datetime.datetime.fromtimestamp(int(entry['__REALTIME_TIMESTAMP'])/1e6,datetime.timezone.utc).isoformat()
        for row in rows:
            if row['id'] in starts:row['lastRun']=starts[row['id']]
        sources.append(coverage('os-cron-starts','healthy','Observed journal starts only; OS cron exit status and duration are not instrumented'))
    except Exception:sources.append(coverage('os-cron-starts','unavailable','Cron journal could not establish recent starts'))
    try:
        timers=json.loads(run(['/usr/bin/systemctl','list-timers','--all','--output=json','--no-pager']).stdout)
        for t in timers[:100]:
            def timestamp(value):
                if not isinstance(value,(int,float)) or value<=0 or value>=253402300799000000:return None
                return datetime.datetime.fromtimestamp(value/1e6,datetime.timezone.utc).isoformat()
            rows.append({'id':'timer:'+t['unit'],'name':t['unit'],'source':'systemd','expression':t.get('activates',''),'timezone':'system local time','nextRun':timestamp(t.get('next')),'lastRun':timestamp(t.get('last')),'outcome':'unknown','durationMs':None})
        units=[t.get('activates','') for t in timers if re.fullmatch(r'[A-Za-z0-9][\w@.:_-]*\.service',t.get('activates',''))][:100]
        if units:
            properties=run(['/usr/bin/systemctl','show',*units,'--property=Id,ActiveState,Result,ExecMainStatus,ExecMainStartTimestampMonotonic,ExecMainExitTimestampMonotonic','--no-pager']).stdout
            statuses={}
            for block in properties.strip().split('\n\n'):
                values=dict(line.split('=',1) for line in block.splitlines() if '=' in line)
                statuses[values.get('Id','')]=values
            for timer in timers:
                row=next((r for r in rows if r['id']=='timer:'+timer['unit']),None);state=statuses.get(timer.get('activates',''),{})
                start=int(state.get('ExecMainStartTimestampMonotonic','0'));end=int(state.get('ExecMainExitTimestampMonotonic','0'));trigger=timer.get('passed') or 0
                if not row or not row['lastRun'] or start<int(trigger):continue
                if end>=start and start>0:
                    row['durationMs']=(end-start)/1000
                    row['outcome']='success' if state.get('Result')=='success' and state.get('ExecMainStatus')=='0' else 'failed'
                elif start>0 and state.get('ActiveState')=='active':row['outcome']='running'
        sources.append(coverage('systemd-timers','healthy'))
    except Exception:sources.append(coverage('systemd-timers','unavailable','Timer inventory failed'))
    for label,args in [('general',['/usr/bin/supervisorctl','status']),('studio',['/usr/bin/supervisorctl','-c','/home/maverick/.local/share/repro-studio/supervisord.conf','status'])]:
        try:
            result=run(args);before=len(services)
            for line in result.stdout.splitlines()[:30]:
                fields=line.split();name=fields[0] if fields else ''
                if not re.fullmatch(r'[\w:.-]+',name):continue
                state=fields[1] if len(fields)>1 else 'UNKNOWN'
                if state not in ['STOPPED','STARTING','RUNNING','BACKOFF','STOPPING','EXITED','FATAL','UNKNOWN']:continue
                pid=re.search(r'pid (\d+)',line)
                services.append({'id':'worker:'+label+':'+name,'name':name,'state':state.lower(),'pid':int(pid.group(1)) if pid else 0})
            sources.append(coverage('workers-'+label,'healthy' if len(services)>before else 'unavailable'))
        except Exception:sources.append(coverage('workers-'+label,'unavailable','Supervisor status unavailable'))
    for component in ['backend','frontend']:
        directory=pathlib.Path('/home/maverick/repro-deploy-backups')/component
        try:
            candidates=[]
            for item in sorted(directory.iterdir(),reverse=True)[:100]:
                if item.is_dir():
                    for name in ['source.tar.gz','database.sqlite','database.sqlite.gz']:
                        file=item/name
                        if file.is_file():candidates.append(file.stat().st_mtime)
            if candidates:
                age=datetime.datetime.now().timestamp()-max(candidates)
                metrics.append({'key':'backup_age_'+component,'label':component+' observed backup file age (not restore-verified)','value':max(0,age),'unit':'seconds','source':'backups'})
            sources.append(coverage('backup-files-'+component,'healthy' if candidates else 'unavailable','Bounded metadata observation only; file presence does not verify backup completion or restorability',300000))
        except OSError:sources.append(coverage('backup-files-'+component,'unavailable','Backup directory unreadable',300000))
    fingerprints=[]
    for path in ['/etc/nginx/sites-enabled/frontend.conf','/etc/php/8.3/fpm/pool.d/www.conf','/etc/supervisor/supervisord.conf']:
        try:fingerprints.append(hashlib.sha256(pathlib.Path(path).read_bytes()).hexdigest())
        except OSError:sources.append(coverage('config:'+path,'unavailable','Configuration fingerprint unavailable'))
    return {'observedAt':NOW,'schedules':rows,'services':services,'sources':sources,'metrics':metrics,'configurationFingerprint':hashlib.sha256(''.join(fingerprints).encode()).hexdigest()}

def smart():
    metrics=[];sources=[]
    for device in ['/dev/nvme0n1','/dev/sda','/dev/sdb']:
        if not pathlib.Path(device).exists():continue
        name=pathlib.Path(device).name
        try:
            r=run(['/usr/sbin/smartctl','-n','standby','-H','-A','-j',device]);d=json.loads(r.stdout)
            passed=d.get('smart_status',{}).get('passed');temperature=d.get('temperature',{}).get('current')
            metrics.extend([{'key':'smart_'+name,'label':name+' SMART passed','value':int(passed) if passed is not None else None,'unit':'boolean','source':'smart'},{'key':'disk_temp_'+name,'label':name+' temperature','value':temperature,'unit':'°C','source':'smart'}])
            sources.append(coverage('smart:'+name,'healthy' if passed is not None else 'unavailable','Standby, unsupported bridge or unreadable SMART' if passed is None else None,300000))
        except Exception:sources.append(coverage('smart:'+name,'unavailable','SMART command unavailable or timed out',300000))
    return {'observedAt':NOW,'metrics':metrics,'sources':sources}
if len(sys.argv)!=2 or sys.argv[1] not in ['inventory','smart']:raise SystemExit('Only inventory and smart are supported')
data=inventory() if sys.argv[1]=='inventory' else smart()
destination=pathlib.Path('/run/repro-monitor-inventory')
if os.geteuid()==0 and destination.is_dir():
    fd,name=tempfile.mkstemp(dir=destination,prefix='snapshot-')
    with os.fdopen(fd,'w') as out:json.dump(data,out)
    os.chmod(name,0o644);os.replace(name,destination/(sys.argv[1]+'.json'))
else:print(json.dumps(data))
