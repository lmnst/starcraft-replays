"""Export native StarCraft-Commander matches for site/human-commander/.

Usage: python scripts/human_commander.py <matches dir | match dir | id=match dir> ...

A match dir is a StarCraft-Commander `matches/<timestamp>` folder; passing the
`matches` folder itself exports every finished human-commander match in it.
Matches already on the page keep their id (looked up by source folder); new ones
get <map>-<opponent>-<result>-<MMDD-HHMM>. data/index.json is rewritten from all
exported data files, so earlier matches stay listed. The page
data comes only from that folder's own logs; nothing is re-simulated. Besides
the page JSON, the script copies the original .rep and packs every log needed
by the local commander replay tool into packages/<id>.zip so no field is lost.
"""
import collections
import gzip
import hashlib
import json
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / 'site' / 'human-commander'
# Terrain grids exported by the archive engine for the LLM comparison matches, keyed by match.json map name.
# Destination has no export yet; its schematic view is unavailable on the page.
TERRAINS = {'Benzene': ('benzene', 'm117-llm.json', 'Benzene1.1'),
            'Heartbreak Ridge': ('heartbreak-ridge', 'm016-llm.json', '단장의 능선 1.1')}
STATE_FIELDS = ['frame', 'workers', 'army', 'healthy_army', 'main_army', 'center', 'gathered_minerals', 'gathered_gas',
                'mining_lock', 'main_task', 'squad_task', 'mode', 'stance', 'scout', 'evade']
ASTRA_FIELDS = ['frame', 'minerals', 'gas', 'nexuses', 'attacking', 'defenders']
NOTICE_EVENTS = {'base_notice', 'building_target_locked', 'building_target_confirmed', 'building_complete',
                 'rendezvous_point', 'flight_burst_start', 'scout_probe_seen', 'defence_post', 'base_allocation', 'end'}
ACTIVITY_EVENTS = ['battle_order', 'target_selection', 'manual_ownership', 'mining_blocked']
BIN = 240


def jsonl(path):
    return [json.loads(line) for line in path.read_text(encoding='utf-8').splitlines() if line.strip()]


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def export(match_id, folder):
    match = json.loads((folder / 'match.json').read_text(encoding='utf-8'))
    write = folder / 'bwapi-data' / 'write'
    replay = folder / match['replay']
    layer = jsonl(write / 'commander-layer.jsonl')
    astra = jsonl(write / 'astra-trace.jsonl')
    camera = jsonl(replay.with_name(replay.name + '.camera.jsonl'))
    end_frame = match['frame']

    counts = collections.Counter(r['event'] for r in layer)
    states = [[r.get(k) for k in STATE_FIELDS] for r in layer if r['event'] == 'state']
    economy = [[r.get(k) for k in ASTRA_FIELDS] for r in astra if r['event'] == 'state']
    hud, last = [], None
    for r in layer:
        if r['event'] != 'hud':
            continue
        row = [r['frame'], r['feedback'], r['last_key'], r['lines']]
        if last is None or row[1:] != last[1:]:
            hud.append(row)
        last = row
    commands = [r for r in layer if r['event'] == 'command']
    tasks = [[r['frame'], r['task_id'], r['action'], r['phase'], r.get('arrived'), len(r.get('units', [])), r.get('goal')]
             for r in layer if r['event'] == 'battle_state']
    notices = [r for r in layer if r['event'] in NOTICE_EVENTS]
    bins = (end_frame // BIN) + 1
    activity = {e: [0] * bins for e in ACTIVITY_EVENTS}
    for r in layer:
        if r['event'] in activity:
            activity[r['event']][min(r['frame'] // BIN, bins - 1)] += 1
    samples = [[r['frame'], r['unit_id'], r['position'][0], r['position'][1]]
               for r in layer if r['event'] == 'battle_sample']
    cam = [[r['frame'], r['x'], r['y']] for r in camera if r.get('event') == 'camera']

    replay_target = PAGE / 'reps' / f'{match_id}.rep'
    replay_target.parent.mkdir(parents=True, exist_ok=True)
    replay_target.write_bytes(replay.read_bytes())
    package = PAGE / 'packages' / f'{match_id}.zip'
    package.parent.mkdir(parents=True, exist_ok=True)
    stamp = folder.name
    with zipfile.ZipFile(package, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        z.write(folder / 'match.json', f'{stamp}/match.json')
        for f in sorted(replay.parent.glob(replay.name + '*')):
            z.write(f, f'{stamp}/{f.relative_to(folder).as_posix()}')
        for f in sorted(write.iterdir()):
            z.write(f, f'{stamp}/bwapi-data/write/{f.name}')

    players = [{k: p[k] for k in ('id', 'name', 'race', 'color_rgb')} for p in match['players']]
    data = {
        'id': match_id, 'terrain': f'data/terrain/{TERRAINS[match["map"]][0]}.json' if match['map'] in TERRAINS else None, 'source_folder': stamp, 'map': match['map'], 'opponent': match['opponent'],
        'baseline': match['baseline'], 'control': match['control'], 'keymap': layer[0].get('keymap') or layer[0].get('controls'),
        'started_at': match['started_at'], 'ended_at': match['ended_at'], 'end_frame': end_frame,
        'result': 'win' if match['winner'] else 'loss', 'self_player_id': match['self_player_id'], 'players': players,
        'render_size': match.get('render_size'), 'self_replay_camera': match.get('self_replay_camera'),
        'hashes': {'replay': sha256(replay), 'baseline': match['baseline_sha256'], 'layer': match['layer_sha256'],
                   'opponent': match['opponent_sha256'], 'map': match['map_sha256']},
        'files': {'replay': f'reps/{match_id}.rep', 'replay_bytes': replay.stat().st_size,
                  'package': f'packages/{match_id}.zip', 'package_bytes': package.stat().st_size},
        'event_counts': dict(counts.most_common()),
        'state_fields': STATE_FIELDS, 'states': states,
        'economy_fields': ASTRA_FIELDS, 'economy': economy,
        'hud': hud, 'commands': commands, 'tasks': tasks, 'notices': notices,
        'activity_bin': BIN, 'activity': activity, 'samples': samples, 'camera': cam,
    }
    out = PAGE / 'data' / f'{match_id}.json'
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(f'{match_id}: {len(commands)} commands, {len(hud)} HUD changes, {len(states)} states, '
          f'{out.stat().st_size // 1024} KB data, {package.stat().st_size // 1024} KB package')


def slug(text):
    return ''.join(c if c.isalnum() else '-' for c in text.lower()).strip('-')


def finished_human_match(folder):
    path = folder / 'match.json'
    if not path.is_file():
        return False
    match = json.loads(path.read_text(encoding='utf-8'))
    return match.get('control') == 'human' and 'winner' in match and (folder / match['replay']).is_file()


def main(args):
    if not args:
        sys.exit(__doc__)
    known = {}
    for f in (PAGE / 'data').glob('*.json'):
        d = json.loads(f.read_text(encoding='utf-8'))
        if 'source_folder' in d:
            known[d['source_folder']] = d['id']
    jobs = {}
    for arg in args:
        match_id, _, path = arg.rpartition('=') if '=' in arg else ('', '', arg)
        folder = Path(path)
        folders = [folder] if (folder / 'match.json').is_file() else sorted(p for p in folder.iterdir() if p.is_dir())
        for f in folders:
            if not finished_human_match(f):
                print(f'skip {f.name}: not a finished human-commander match')
                continue
            if not match_id and f.name not in known:
                m = json.loads((f / 'match.json').read_text(encoding='utf-8'))
                stamp = f.name[4:8] + '-' + f.name[9:13]
                known[f.name] = f"{slug(m['map'])}-{slug(m['opponent'])}-{'win' if m['winner'] else 'loss'}-{stamp}"
            jobs[f.name] = (match_id or known[f.name], f)
    for match_id, folder in jobs.values():
        export(match_id, folder)
    (PAGE / 'data' / 'terrain').mkdir(parents=True, exist_ok=True)
    for name, source, expect in TERRAINS.values():
        terrain = json.loads((ROOT / 'site' / 'llm-vs-code' / 'tracks' / source).read_text(encoding='utf-8'))
        # map names in the export are UTF-8 bytes read as Latin-1, with StarCraft colour codes
        if ''.join(c for c in terrain['map'].encode('latin-1').decode('utf-8') if c.isprintable()) != expect:
            raise RuntimeError(f'{source} is not {expect}')
        (PAGE / 'data' / 'terrain' / f'{name}.json').write_text(json.dumps(
            {'map': terrain['map'], 'width': terrain['width'], 'height': terrain['height'], 'terrain': terrain['terrain']},
            separators=(',', ':')), encoding='utf-8')
    index = []
    for f in (PAGE / 'data').glob('*.json'):
        d = json.loads(f.read_text(encoding='utf-8'))
        if 'source_folder' in d:
            index.append({'id': d['id'], 'map': d['map'], 'opponent': d['opponent'], 'result': d['result'],
                          'end_frame': d['end_frame'], 'commands': len(d['commands']), 'started_at': d['started_at']})
    index.sort(key=lambda m: m['started_at'])
    (PAGE / 'data' / 'index.json').write_text(json.dumps({'matches': index}, ensure_ascii=False, indent=1), encoding='utf-8')


if __name__ == '__main__':
    main(sys.argv[1:])
