"""Root-owned platform setup matching the successfully verified V4 installation."""
import grp, hashlib, json, os, pathlib, shutil, subprocess, tempfile
P = pathlib.Path
PROFILE = P('/etc/apparmor.d/repro-monitor-ai')
ROTATE = P('/etc/logrotate.d/php8.3-fpm')
PARENT = P('/media/maverick')
PHP_LOG = P('/var/log/php8.3-fpm.log')
RECORD = P('/var/lib/repro-monitor-install/platform.json')
PROFILE_TEXT = '''# Keep kernel tunables read-only without /proc submounts that block nested PID isolation.
# The service remains unprivileged and retains systemd filesystem restrictions.
abi <abi/4.0>,
include <tunables/global>
profile repro-monitor-ai flags=(attach_disconnected) {
  # Explicit rule classes: this kernel's generic all rule did not grant Unix socketpair creation.
  capability,
  network,
  unix,
  signal,
  ptrace,
  dbus,
  mount,
  umount,
  pivot_root,
  mqueue,
  userns,
  / r,
  /** mrwklix,
  deny change_profile,
  deny /proc/sys{,/**} wkl,
  deny /proc/sysrq-trigger wkl,
  deny /proc/{latency_stats,acpi,timer_stats,fs,irq}{,/**} wkl,
  deny /sys{,/**} wkl,
  # Safe, writable fixture used to prove deny enforcement before live changes.
  deny /var/lib/repro-monitor-ai/repair-probe-v4-*/kernel-write-guard wkl,
}
'''
DROPIN_TEXT = '[Service]\nAppArmorProfile=repro-monitor-ai\nProtectKernelTunables=no\n'

def run(args, input=None):
    r = subprocess.run(args, input=input, text=True, capture_output=True, timeout=30)
    if r.returncode: raise RuntimeError(args[0] + ' failed: ' + r.stderr[-2000:])
    return r.stdout.strip()

def atomic(path, text, mode=0o644):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, name = tempfile.mkstemp(dir=path.parent, prefix='.monitor-platform-')
    try:
        with os.fdopen(fd, 'w') as f: f.write(text); f.flush(); os.fsync(f.fileno())
        os.chmod(name, mode); os.replace(name, path)
    finally:
        if os.path.exists(name): os.unlink(name)

def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()

def rotation(text):
    if text.count('/var/log/php8.3-fpm.log {') != 1 or 'create ' in text or any(x.strip().startswith('su ') for x in text.splitlines()):
        raise RuntimeError('PHP log rotation needs review before monitoring setup')
    return text.replace('/var/log/php8.3-fpm.log {', '/var/log/php8.3-fpm.log {\n\tsu root adm\n\tcreate 0640 root adm', 1)

def configure():
    if RECORD.exists() or PROFILE.exists(): raise RuntimeError('Existing platform setup requires review')
    for p in [ROTATE, PARENT, PHP_LOG]:
        if p.is_symlink(): raise RuntimeError('Unexpected platform symlink: ' + str(p))
    for command in ['getfacl', 'setfacl', 'apparmor_parser', 'logrotate']:
        if not shutil.which(command): raise RuntimeError('Missing platform dependency: ' + command)
    updated = rotation(ROTATE.read_text())
    with tempfile.TemporaryDirectory() as d:
        p = P(d) / 'profile'; p.write_text(PROFILE_TEXT)
        run(['apparmor_parser', '--skip-kernel-load', '--skip-cache', str(p)])
    record = {'rotationBefore': ROTATE.read_text(), 'rotationMode': ROTATE.stat().st_mode & 0o777,
              'aclBefore': run(['getfacl', '-p', str(PARENT), str(PHP_LOG)]) + '\n'}
    def save(): atomic(RECORD, json.dumps(record, indent=2), 0o600)
    save()
    try:
        record['profileWritten'] = True; save(); atomic(PROFILE, PROFILE_TEXT)
        run(['apparmor_parser', '--replace', '--skip-cache', str(PROFILE)])
        record['profileLoaded'] = True; save()
        record['permissionsChanged'] = True; save()
        run(['setfacl', '-m', 'u:repro-monitor:--x', str(PARENT)])
        os.chown(PHP_LOG, 0, grp.getgrnam('adm').gr_gid); os.chmod(PHP_LOG, 0o640)
        record['rotationChanged'] = True; save(); atomic(ROTATE, updated, record['rotationMode'])
        run(['logrotate', '--debug', '--state', '/dev/null', str(ROTATE)])
        record['profileHash'] = sha(PROFILE); record['rotationHash'] = sha(ROTATE)
        record['aclInstalled'] = run(['getfacl', '-p', str(PARENT), str(PHP_LOG)])
        record['status'] = 'configured'; save()
    except Exception:
        restore(check=False)
        raise

def restore(check=True):
    if not RECORD.exists(): return
    record = json.loads(RECORD.read_text())
    if record.get('status') == 'restored': return
    if check:
        if sha(PROFILE) != record.get('profileHash') or sha(ROTATE) != record.get('rotationHash'):
            raise RuntimeError('Platform configuration changed after installation; refusing overwrite')
        if run(['getfacl', '-p', str(PARENT), str(PHP_LOG)]) != record.get('aclInstalled'):
            raise RuntimeError('Platform permissions changed after installation; refusing overwrite')
    errors=[]
    def attempt(fn):
        try: fn()
        except Exception as e: errors.append(str(e))
    if record.get('rotationChanged'): attempt(lambda: atomic(ROTATE, record['rotationBefore'], record['rotationMode']))
    if record.get('permissionsChanged'): attempt(lambda: run(['setfacl', '--restore=-'], input=record['aclBefore']))
    if record.get('profileLoaded'): attempt(lambda: run(['apparmor_parser', '--remove', str(PROFILE)]))
    if record.get('profileWritten') and not errors: PROFILE.unlink(missing_ok=True)
    record['status'] = 'restored' if not errors else 'restore-needs-review'; record['restoreErrors']=errors
    atomic(RECORD, json.dumps(record, indent=2), 0o600)
    if errors: raise RuntimeError('Platform restoration needs review: ' + '; '.join(errors))
