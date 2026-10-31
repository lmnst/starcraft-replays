"""Validate CMS content and produce a static GitHub Pages artifact. No dependencies."""
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / 'site'
OUT = ROOT / 'dist'
game_manifest = json.loads((SITE / 'game-data' / 'manifest.json').read_text(encoding='utf-8'))
for name in ('StarDat.mpq', 'BrooDat.mpq', 'Patch_rt.mpq'):
    archive = (SITE / 'game-data' / name).read_bytes()
    expected = game_manifest['files'][name]
    if archive[:4] != b'MPQ\x1a' or len(archive) != expected['bytes'] or hashlib.sha256(archive).hexdigest() != expected['sha256']:
        raise ValueError(f'Game archive integrity check failed: {name}')
records = []
ids = set()
published_files = []
for entry in sorted((ROOT / 'content' / 'matches').glob('*.json')):
    record = json.loads(entry.read_text(encoding='utf-8'))
    for key in ('id', 'title_en', 'title_zh', 'player1', 'player2', 'map', 'replay'):
        if not isinstance(record.get(key), str) or not record[key].strip():
            raise ValueError(f'{entry.name}: missing {key}')
    if not re.fullmatch(r'[a-z0-9][a-z0-9-]*', record['id']) or record['id'] in ids:
        raise ValueError(f'{entry.name}: invalid or duplicate id')
    ids.add(record['id'])
    if entry.stem != record['id']:
        raise ValueError(f'{entry.name}: permanent ID must match the filename; replace replay rather than rename ID')
    if type(record.get('visible')) is not bool:
        raise ValueError(f'{entry.name}: visible must be a boolean')
    if record.get('result', 'unknown') not in ('win', 'loss', 'unknown'):
        raise ValueError(f'{entry.name}: invalid result')
    relative = record['replay'].lstrip('/')
    replay = (SITE / relative).resolve()
    if not replay.is_relative_to((SITE / 'replays').resolve()) or replay.suffix.lower() != '.rep':
        raise ValueError(f'{entry.name}: replay must be in /replays/')
    data = replay.read_bytes()
    if len(data) < 32:
        raise ValueError(f'{entry.name}: replay is empty or truncated')
    validator = os.environ.get('REPLAY_VALIDATOR', str(ROOT / 'build/validate-replay'))
    parsed = json.loads(subprocess.check_output([validator, str(replay)], text=True, timeout=30))
    record['replay_frames'] = parsed['frames']
    record['sha256'] = hashlib.sha256(data).hexdigest()
    record['replay_bytes'] = len(data)
    if record.get('visible', False):
        records.append(record)
        published_files.append((replay, relative))
if OUT.exists():
    shutil.rmtree(OUT)
shutil.copytree(SITE, OUT, ignore=shutil.ignore_patterns('replays', 'pilot.js', 'pilot.css'))
(OUT / 'replays').mkdir()
for replay, relative in published_files:
    target = OUT / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(replay, target)
# A content save must not mix a fresh catalog with a cached, older player UI.
for page in OUT.rglob('*.html'):
    def version_asset(match):
        attribute, url = match.groups()
        path = url.split('?', 1)[0]
        asset = page.parent / path
        if Path(path).suffix not in ('.js', '.css') or not asset.is_file():
            return match.group(0)
        digest = hashlib.sha256(asset.read_bytes()).hexdigest()[:12]
        return f'{attribute}="{path}?v={digest}"'
    html = page.read_text(encoding='utf-8')
    page.write_text(re.sub(r'(src|href)="([^"]+)"', version_asset, html), encoding='utf-8')
catalog = {'matches': records, 'revision': os.environ.get('GITHUB_SHA', 'local'),
           'built_at': datetime.now(timezone.utc).isoformat()}
(OUT / 'catalog.json').write_text(json.dumps(catalog, ensure_ascii=False, indent=2), encoding='utf-8')
(OUT / '.nojekyll').touch()
print(f'Validated {len(records)} published match(es). Output: {OUT}')
