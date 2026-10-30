"""Read-only public HTTPS smoke test, including all published replay hashes."""
import hashlib
import json
from pathlib import Path
import sys
import urllib.request
from urllib.parse import urljoin

base = sys.argv[1].rstrip('/')+'/'
if not base.startswith('https://'):
    raise ValueError('Use the public HTTPS URL')
root = Path(__file__).resolve().parents[1]
report = {'url':base,'checks':[]}

def fetch(path, expected_hash=None):
    url=urljoin(base,path.lstrip('/'))
    request=urllib.request.Request(url,headers={'Cache-Control':'no-cache'})
    with urllib.request.urlopen(request,timeout=180) as response:
        digest=hashlib.sha256();size=0;content=[]
        while chunk:=response.read(1024*1024):
            digest.update(chunk);size+=len(chunk)
            if path=='catalog.json':content.append(chunk)
        actual=digest.hexdigest()
        if expected_hash and actual!=expected_hash:
            raise ValueError(f'{path}: public hash mismatch')
        report['checks'].append({'path':path,'status':response.status,'bytes':size,'sha256':actual})
        return b''.join(content)

for path in ('','app.js','app.css','credits.html','credits.js','viewer/index.html','viewer/pilot-bridge.js','viewer/archive-ui.js','viewer/v1.4/openbw.wasm'):
    fetch(path)
catalog=json.loads(fetch('catalog.json'))
report['revision']=catalog['revision']
for match in catalog['matches']:
    fetch(match['replay']+'?v='+match['sha256'],match['sha256'])
manifest=json.loads((root/'site/game-data/manifest.json').read_text())
for name,expected in manifest['files'].items():
    fetch('game-data/'+name,expected['sha256'])
report['passed']=True
print(json.dumps(report,indent=2))
