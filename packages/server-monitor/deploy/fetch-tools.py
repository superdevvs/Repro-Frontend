#!/usr/bin/env python3
"""Download pinned upstream assets and extract only verified named binaries."""
import hashlib, json, pathlib, sys, tarfile, urllib.request, zipfile
from concurrent.futures import ThreadPoolExecutor
root = pathlib.Path(__file__).resolve().parent
output = pathlib.Path(sys.argv[1]).resolve()
output.mkdir(parents=True, exist_ok=True)
def fetch(tool):
    archive = output / pathlib.Path(tool['url']).name
    if not archive.exists() or hashlib.sha256(archive.read_bytes()).hexdigest() != tool['sha256']:
        with urllib.request.urlopen(tool['url'], timeout=60) as response, archive.open('wb') as target:
            while chunk := response.read(1024 * 1024): target.write(chunk)
    if hashlib.sha256(archive.read_bytes()).hexdigest() != tool['sha256']: raise RuntimeError('Checksum mismatch: '+tool['name'])
    container = zipfile.ZipFile(archive) if archive.suffix == '.zip' else tarfile.open(archive)
    for member, name in tool['files'].items():
        data = container.read(member) if archive.suffix == '.zip' else container.extractfile(member).read()
        target = output / name
        target.write_bytes(data)
        target.chmod(0o755)
    container.close()
    print(tool['name']+' '+tool['version']+' verified', flush=True)
with ThreadPoolExecutor(max_workers=3) as executor:
    list(executor.map(fetch, json.loads((root/'tools.json').read_text())))
