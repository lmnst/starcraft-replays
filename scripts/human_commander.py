"""Export native StarCraft-Commander matches for site/human-commander/.

Usage: python scripts/human_commander.py <id>=<match dir> [<id>=<match dir> ...]

Each match dir is a StarCraft-Commander `matches/<timestamp>` folder. The page
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
TERRAIN_SOURCE = ROOT / 'site' / 'llm-vs-code' / 'tracks' / 'm117-llm.json'  # Benzene1.1, same engine export
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
        'id': match_id, 'source_folder': stamp, 'map': match['map'], 'opponent': match['opponent'],
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
    return {'id': match_id, 'map': data['map'], 'opponent': data['opponent'], 'result': data['result'],
            'end_frame': end_frame, 'commands': len(commands), 'started_at': data['started_at']}


def main(args):
    if not args:
        sys.exit(__doc__)
    index = [export(*(lambda a: (a[0], Path(a[1])))(arg.split('=', 1))) for arg in args]
    terrain = json.loads(TERRAIN_SOURCE.read_text(encoding='utf-8'))
    if ''.join(c for c in terrain['map'] if c.isprintable()) != 'Benzene1.1':
        raise RuntimeError('terrain source is not Benzene1.1')
    (PAGE / 'data' / 'benzene-terrain.json').write_text(json.dumps(
        {'map': terrain['map'], 'width': terrain['width'], 'height': terrain['height'], 'terrain': terrain['terrain']},
        separators=(',', ':')), encoding='utf-8')
    (PAGE / 'data' / 'index.json').write_text(json.dumps({'matches': index}, ensure_ascii=False, indent=1), encoding='utf-8')


if __name__ == '__main__':
    main(sys.argv[1:])
