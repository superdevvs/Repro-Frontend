import importlib.util,io,json,pathlib,tarfile,tempfile,unittest,hashlib,sys,subprocess
from unittest.mock import patch
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('installer',ROOT/'deploy/install-monitor.py');installer=importlib.util.module_from_spec(spec);spec.loader.exec_module(installer)
class ArchivePreflight(unittest.TestCase):
    def archive(self,directory,extra=None):
        path=pathlib.Path(directory)/'release.tar.gz'
        with tarfile.open(path,'w:gz') as tar:
            body=json.dumps({'frontendCommit':'a'*40,'backendCommit':'b'*40,'validation':'passed'}).encode();entry=tarfile.TarInfo('repro-monitor-release/manifest.json');entry.size=len(body);tar.addfile(entry,io.BytesIO(body))
            if extra:tar.addfile(extra)
        return path,hashlib.sha256(path.read_bytes()).hexdigest()
    def test_checksum_and_archive_traversal_fail_before_installation(self):
        with tempfile.TemporaryDirectory() as directory:
            path,digest=self.archive(directory)
            self.assertEqual(installer.verify_bundle(path,digest)['validation'],'passed')
            with self.assertRaises(RuntimeError):installer.verify_bundle(path,'0'*64)
            path,digest=self.archive(directory,tarfile.TarInfo('repro-monitor-release/../../escape'))
            with self.assertRaises((RuntimeError,tarfile.TarError)):installer.verify_bundle(path,digest)
    def test_archive_accepts_the_builder_root_directory(self):
        with tempfile.TemporaryDirectory() as directory:
            root=tarfile.TarInfo('repro-monitor-release');root.type=tarfile.DIRTYPE
            path,digest=self.archive(directory,root)
            self.assertEqual(installer.verify_bundle(path,digest)['validation'],'passed')
    def test_application_probe_requires_laravel_json_not_a_spa_status_200(self):
        class Response(io.BytesIO):
            status=200
        def pong(request,timeout):
            self.assertEqual(request.full_url,'https://reprodashboard.com/api/ping')
            self.assertEqual(request.get_header('User-agent'),'RePro-Server-Monitor/1.0')
            return Response(b'{"message":"pong"}')
        with patch.object(installer.urllib.request,'urlopen',side_effect=pong):installer.application_health()
        with patch.object(installer.urllib.request,'urlopen',return_value=Response(b'<html>Application shell</html>')):
            with self.assertRaises((ValueError,RuntimeError)):installer.application_health()
    def test_archive_cannot_link_to_host_credentials(self):
        with tempfile.TemporaryDirectory() as directory:
            link=tarfile.TarInfo('repro-monitor-release/leak');link.type=tarfile.SYMTYPE;link.linkname='/etc/shadow';path,digest=self.archive(directory,link)
            with self.assertRaises(tarfile.TarError):installer.verify_bundle(path,digest)
    def test_generated_units_isolate_application_data_and_keep_raw_log_wal_disabled(self):
        with tempfile.TemporaryDirectory() as directory:
            subprocess.run([sys.executable,str(ROOT/'deploy/write-units.py'),directory],check=True)
            gateway=(pathlib.Path(directory)/'repro-monitor.service').read_text()
            self.assertIn('UMask=0077',gateway);self.assertIn('ProtectSystem=strict',gateway);self.assertIn('User=repro-monitor',gateway)
            self.assertNotIn('ReadWritePaths=/var/www',gateway)
            self.assertIn('wal { enabled = false }',(ROOT/'deploy/config.alloy').read_text())

class CollectionPlatform(unittest.TestCase):
    def test_platform_profile_and_generated_unit_keep_inherited_process_isolation(self):
        import re
        spec=importlib.util.spec_from_file_location('platform_setup',ROOT/'deploy/collection-platform.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
        self.assertIn('unix,',module.PROFILE_TEXT);self.assertIn('/** mrwklix,',module.PROFILE_TEXT)
        self.assertIn('deny change_profile,',module.PROFILE_TEXT);self.assertIn('deny /proc/sys{,/**} wkl,',module.PROFILE_TEXT)
        with tempfile.TemporaryDirectory() as directory:
            subprocess.run([sys.executable,str(ROOT/'deploy/write-units.py'),directory],check=True)
            unit=(pathlib.Path(directory)/'repro-monitor-ai.service').read_text()
            self.assertEqual(re.findall(r'^ProtectKernelTunables=(.+)$',unit,re.M)[-1],'no')
            self.assertIn('AppArmorProfile=repro-monitor-ai',unit);self.assertIn('NoNewPrivileges=yes',unit)
    def test_failed_platform_configuration_restores_config_and_permissions(self):
        spec=importlib.util.spec_from_file_location('platform_setup',ROOT/'deploy/collection-platform.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
        with tempfile.TemporaryDirectory() as directory:
            d=pathlib.Path(directory);profile=d/'profile';rotation=d/'rotate';parent=d/'parent';log=d/'log';record=d/'record.json';parent.mkdir();log.write_text('fixture')
            original='/var/log/php8.3-fpm.log {\nweekly\n}\n';rotation.write_text(original);calls=[]
            def run(args,input=None):
                calls.append(args)
                if args[0]=='getfacl':return 'fixture ACL'
                if args[0]=='logrotate':raise RuntimeError('fixture rotation validation failure')
                return ''
            with patch.multiple(module,PROFILE=profile,ROTATE=rotation,PARENT=parent,PHP_LOG=log,RECORD=record),patch.object(module,'run',side_effect=run),patch.object(module.os,'chown'),patch.object(module.shutil,'which',return_value='/fixture'):
                with self.assertRaisesRegex(RuntimeError,'fixture rotation'):module.configure()
                self.assertEqual(rotation.read_text(),original);self.assertFalse(profile.exists());self.assertIn(['setfacl','--restore=-'],calls);self.assertEqual(json.loads(record.read_text())['status'],'restored')

class PassiveUpgrade(unittest.TestCase):
    def test_failure_after_manifest_write_restores_old_release_units_and_manifest(self):
        from types import SimpleNamespace
        with tempfile.TemporaryDirectory() as directory:
            d=pathlib.Path(directory);prefix=d/'opt';state=d/'state';state.mkdir();old=prefix/'releases'/('a'*40);old.mkdir(parents=True)
            (prefix/'current').symlink_to(old);original={'manifest':{'frontendCommit':'a'*40,'backendCommit':'c'*40},'installedAt':123}
            (state/'installation.json').write_text(json.dumps(original));unit=d/'monitor.service';unit.write_text('original unit')
            manifest={'frontendCommit':'b'*40,'backendCommit':'c'*40};source=d/'repro-monitor-release';(source/'units').mkdir(parents=True)
            (source/'units'/'monitor.service').write_text('new unit');(source/'files.json').write_text(json.dumps({'units/monitor.service':hashlib.sha256(b'new unit').hexdigest()}))
            archive=d/'bundle.tar.gz'
            with tarfile.open(archive,'w:gz') as tar:tar.add(source,arcname='repro-monitor-release')
            profile=d/'profile';profile.write_text('verified profile');module=SimpleNamespace(PROFILE=profile,PROFILE_TEXT='verified profile')
            calls=[];failed=[False]
            real_path=pathlib.Path
            def path(value):
                if str(value)=='/etc/systemd/system':return d
                return real_path(value)
            def atomic(p,content,mode=0o644,*args):
                p=real_path(p);p.parent.mkdir(parents=True,exist_ok=True)
                if p.name.startswith('upgrade-') and json.loads(content)['status']=='complete' and not failed[0]:failed[0]=True;raise OSError('fixture final-record failure')
                p.write_bytes(content.encode() if isinstance(content,str) else content)
            def api(endpoint):
                if endpoint=='/v1/settings':return {'settings':{'automaticAi':False}}
                if endpoint=='/v1/snapshot':return {'disks':[{'valid':True,'bytes':1}]*3}
                return [{'id':'codex','connected':True}]
            with patch.multiple(installer,PREFIX=prefix,STATE=state,P=path),patch.object(installer,'verify_bundle',return_value=manifest),patch.object(installer,'platform_module',return_value=module),patch.object(installer,'operator_api',side_effect=api),patch.object(installer,'protect_storage',return_value={'unchanged':True}),patch.object(installer,'run',side_effect=lambda args,**kw:calls.append(args) or ''),patch.object(installer,'atomic',side_effect=atomic),patch.object(installer,'wait_ready'),patch.object(installer,'verify_log_forwarding',return_value={'newDroppedEntries':0}),patch.object(installer.shutil,'disk_usage',return_value=SimpleNamespace(free=100*1024**3)):
                with self.assertRaisesRegex(RuntimeError,'monitor update rolled-back'):installer.upgrade(SimpleNamespace(bundle=archive,sha256='fixture'))
            self.assertEqual((prefix/'current').resolve(),old);self.assertEqual(unit.read_text(),'original unit');self.assertEqual(json.loads((state/'installation.json').read_text()),original)
            self.assertIn(['systemctl','start','repro-monitor.service','repro-monitor-ai.service'],calls)

class LogForwarding(unittest.TestCase):
    def test_requires_new_delivery_and_rejects_drops_or_counter_reset(self):
        for after,expected in [({'sent':12,'dropped':5},True),({'sent':12,'dropped':6},False),({'sent':10,'dropped':5},False),({'sent':1,'dropped':0},False)]:
            with self.subTest(after=after),patch.object(installer,'log_counters',side_effect=[{'sent':10,'dropped':5},after]),patch.object(installer.time,'sleep'):
                if expected:self.assertEqual(installer.verify_log_forwarding(seconds=0)['newSentEntries'],2)
                else:
                    with self.assertRaises(RuntimeError):installer.verify_log_forwarding(seconds=0)

if __name__=='__main__':unittest.main()
