#!/usr/bin/python3
"""Build an installable, checksummed release as the ordinary operator after exact-commit CI."""
import argparse,hashlib,json,os,pathlib,shutil,subprocess,tarfile,tempfile,datetime
P=pathlib.Path
REPO=P(__file__).resolve().parents[3]
def run(args,cwd=REPO):return subprocess.check_output(args,cwd=cwd,text=True).strip()
def digest(path):
    h=hashlib.sha256()
    with path.open('rb') as f:
        for part in iter(lambda:f.read(1024*1024),b''):h.update(part)
    return h.hexdigest()
def main():
    p=argparse.ArgumentParser();p.add_argument('--backend',required=True);p.add_argument('--tools',required=True);p.add_argument('--evidence',required=True);p.add_argument('--output',required=True);a=p.parse_args()
    backend=P(a.backend).resolve();tools=P(a.tools).resolve();out=P(a.output).resolve();out.mkdir(parents=True,exist_ok=True)
    evidence=json.loads(P(a.evidence).read_text());commits={}
    for name,repo in [('frontend',REPO),('backend',backend)]:
        if run(['git','status','--porcelain'],repo):raise RuntimeError(name+' checkout is not clean')
        commit=run(['git','rev-parse','HEAD'],repo);commits[name+'Commit']=commit
        subprocess.run(['git','merge-base','--is-ancestor','origin/main',commit],cwd=repo,check=True)
        item=evidence[name]
        if item['commit']!=commit or item['conclusion']!='success' or not item['url'].startswith('https://github.com/'):raise RuntimeError(name+' exact-commit GitHub quality evidence missing')
    with tempfile.TemporaryDirectory(prefix='repro-monitor-build-',dir=out) as temp:
        root=P(temp)/'repro-monitor-release';app=root/'app';app.mkdir(parents=True)
        for name in ['package.json','package-lock.json']:shutil.copy2(REPO/name,app/name)
        for workspace in (REPO/'packages').iterdir():
            if (workspace/'package.json').exists():
                dest=app/'packages'/workspace.name;dest.mkdir(parents=True);shutil.copy2(workspace/'package.json',dest/'package.json')
        for workspace in ['monitor-contracts','server-monitor']:shutil.copytree(REPO/'packages'/workspace/'dist',app/'packages'/workspace/'dist')
        subprocess.run(['npm','ci','--omit=dev','--ignore-scripts','--include-workspace-root=false','--workspace=@repro/server-monitor','--workspace=@repro/monitor-contracts'],cwd=app,check=True)
        native=app/'node_modules/better-sqlite3/build/Release';native.mkdir(parents=True,exist_ok=True)
        shutil.copy2(REPO/'node_modules/better-sqlite3/build/Release/better_sqlite3.node',native/'better_sqlite3.node')
        bins=root/'bin';bins.mkdir()
        for name in ['node','prometheus','promtool','loki','alloy']:shutil.copy2(tools/name,bins/name)
        subprocess.run([str(bins/'node'),'--input-type=module','-e',"import Database from 'better-sqlite3'; const d=new Database(':memory:'); d.prepare('SELECT 1').get(); d.close(); console.log('Native SQLite runtime verified');"],cwd=app,check=True)
        shutil.copytree(REPO/'packages/server-monitor/deploy',root/'deploy',ignore=shutil.ignore_patterns('__pycache__'))
        subprocess.run(['python3',str(root/'deploy/write-units.py'),str(root/'units')],check=True)
        (root/'desktop').mkdir();shutil.copy2(REPO/'packages/monitor-desktop/artifact/repro-server-monitor_1.0.0_amd64.deb',root/'desktop')
        manifest={'version':1,**commits,'createdAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'validation':'passed','github':evidence,'automaticAi':False,'storageBudgetGiB':20,'passiveObservationHours':24,'architecture':'linux-x86_64','nodeVersion':run([str(bins/'node'),'--version'])}
        (root/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
        hashes={str(f.relative_to(root)):digest(f) for f in root.rglob('*') if f.is_file() and not f.is_symlink()};(root/'files.json').write_text(json.dumps(hashes,indent=2)+'\n')
        archive=out/'repro-server-monitor.tar.gz'
        with tarfile.open(archive,'w:gz') as tar:tar.add(root,arcname=root.name)
        shutil.copy2(root/'deploy/install-monitor.py',out/'install-monitor.py');shutil.copy2(root/'desktop/repro-server-monitor_1.0.0_amd64.deb',out);shutil.copy2(root/'manifest.json',out)
    files=[out/'repro-server-monitor.tar.gz',out/'install-monitor.py',out/'repro-server-monitor_1.0.0_amd64.deb',out/'manifest.json']
    (out/'SHA256SUMS.txt').write_text(''.join(digest(f)+'  '+f.name+'\n' for f in files));print(json.dumps({'archive':str(files[0]),'sha256':digest(files[0]),'bytes':files[0].stat().st_size},indent=2))
if __name__=='__main__':main()
