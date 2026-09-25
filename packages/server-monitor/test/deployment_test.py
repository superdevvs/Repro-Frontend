import importlib.util,io,json,pathlib,tarfile,tempfile,unittest,hashlib,sys,subprocess
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
if __name__=='__main__':unittest.main()
