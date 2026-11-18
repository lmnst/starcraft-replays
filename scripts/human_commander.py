"""Export native StarCraft-Commander matches for site/human-commander/.

Usage: python scripts/human_commander.py <matches dir | match dir | id=match dir> ...

Each match dir is a StarCraft-Commander `matches/<timestamp>` folder. The page
data comes only from that folder's own logs; nothing is re-simulated. Besides
the page JSON, the script copies the original .rep and packs every log needed
by the local commander replay tool into packages/<id>.zip so no field is lost.
"""
import collections
import hashlib
import json
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / 'site' / 'human-commander'
TERRAIN_SOURCE = ROOT / 'site' / 'llm-vs-code' / 'tracks' / 'm117-llm.json'  # Benzene1.1, same engine export
PROFILES = json.loads((PAGE / 'data/keymaps.json').read_text(encoding='utf-8'))['profiles']
STATE_FIELDS = ['frame', 'workers', 'army', 'healthy_army', 'main_army', 'center', 'gathered_minerals', 'gathered_gas',
                'mining_lock', 'main_task', 'squad_task', 'mode', 'stance', 'scout', 'evade']
ASTRA_FIELDS = ['frame', 'minerals', 'gas', 'nexuses', 'attacking', 'defenders']
NOTICE_EVENTS = {'base_notice', 'building_target_locked', 'building_target_confirmed', 'building_complete',
                 'rendezvous_point', 'flight_burst_start', 'scout_probe_seen', 'defence_post', 'base_allocation', 'end',
                 'main_target_selected', 'main_building_cleared', 'patrol_reanchored', 'assembly_refuge', 'assembly_post_adjusted',
                 'detection_resumed', 'scout_evade_lost'}
ACTIVITY_EVENTS = ['battle_order', 'target_selection', 'manual_ownership', 'mining_blocked']
BIN = 240


def jsonl(path):
    if not path.is_file():
        return []
    return [json.loads(line) for line in path.read_text(encoding='utf-8').splitlines() if line.strip()]


def profile_for(version):
    for name, profile in PROFILES.items():
        if version == name or version in profile['aliases']:
            return name, profile
    raise ValueError(f'Unrecognized historical keymap: {version!r}; do not guess')


def annotate(command, version):
    name, profile = profile_for(command.get('keymap') or version)
    key = str(command['key'])
    display_key = 'Alt+8' if key == '8' and command.get('modifier') == 'alt' else key
    if display_key not in profile['keys']:
        raise ValueError(f'{name}: key {display_key} has no historical definition')
    return dict(command, display_key=display_key, display_name=profile['keys'][display_key], keymap_id=name)


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def export(match_id, folder):
    match = json.loads((folder / 'match.json').read_text(encoding='utf-8-sig'))
    write = folder / 'bwapi-data' / 'write'
    replay = folder / match['replay']
    layer = jsonl(write / 'commander-layer.jsonl')
    astra = jsonl(write / 'astra-trace.jsonl')
    camera = jsonl(replay.with_name(replay.name + '.camera.jsonl')) or jsonl(write / 'camera-track.jsonl')
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
    version = next((r.get('keymap') for r in layer if r.get('keymap')), None) or layer[0].get('controls')
    keymap_id, profile = profile_for(version)
    commands = [annotate(r, version) for r in layer if r['event'] == 'command']
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
        # Replay filenames can contain literal brackets (match[2].rep).
        for f in sorted(p for p in replay.parent.iterdir() if p.is_file() and p.name.startswith(replay.name)):
            z.write(f, f'{stamp}/{f.relative_to(folder).as_posix()}')
        for f in sorted(write.iterdir()):
            z.write(f, f'{stamp}/bwapi-data/write/{f.name}')

    players = [{k: p.get(k) for k in ('id', 'name', 'race', 'color_rgb')} for p in match['players']]
    data = {
        'id': match_id, 'source_folder': stamp, 'map': match['map'], 'opponent': match['opponent'],
        'baseline': match['baseline'], 'control': match['control'], 'keymap': version, 'keymap_id': keymap_id,
        'keymap_label': profile['label'], 'key_labels': profile['keys'], 'version_rule': profile['rule'],
        'started_at': match['started_at'], 'ended_at': match['ended_at'], 'end_frame': end_frame,
        'result': 'win' if match['winner'] else 'loss', 'self_player_id': match['self_player_id'], 'players': players,
        'record_note': '短局：胜负沿用原始对局记录，结束原因尚未核实。' if end_frame < 1200 else '',
        'render_size': match.get('render_size'), 'self_replay_camera': match.get('self_replay_camera'),
        'terrain_file': 'data/' + {'Benzene':'benzene','Heartbreak Ridge':'heartbreak-ridge','Destination':'destination'}[match['map']] + '-terrain.json',
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
            'end_frame': end_frame, 'commands': len(commands), 'started_at': data['started_at'], 'record_note': data['record_note']}


def slug(text):
    return ''.join(c if c.isalnum() else '-' for c in text.lower()).strip('-')


def finished_human_match(folder):
    path = folder / 'match.json'
    if not path.is_file():
        return False
    match = json.loads(path.read_text(encoding='utf-8-sig'))
    return match.get('control') == 'human' and 'winner' in match and (folder / match['replay']).is_file()


def main(args):
    if not args:
        sys.exit(__doc__)
    existing = json.loads((PAGE / 'data/index.json').read_text(encoding='utf-8'))['matches']
    by_source = {}
    for file in (PAGE / 'data').glob('*.json'):
        data = json.loads(file.read_text(encoding='utf-8'))
        if 'source_folder' in data:
            by_source[data['source_folder']] = data['id']
    jobs = {}
    for arg in args:
        match_id, _, path = arg.rpartition('=') if '=' in arg else ('', '', arg)
        folder = Path(path)
        folders = [folder] if (folder / 'match.json').is_file() else sorted(p for p in folder.iterdir() if p.is_dir())
        if match_id and len(folders) != 1:
            raise ValueError('An explicit ID must name exactly one match folder')
        for match_folder in folders:
            if not finished_human_match(match_folder):
                print(f'skip {match_folder.name}: not a finished human-commander match')
                continue
            if not match_id and match_folder.name not in by_source:
                match = json.loads((match_folder / 'match.json').read_text(encoding='utf-8-sig'))
                stamp = match_folder.name[4:8] + '-' + match_folder.name[9:13]
                by_source[match_folder.name] = f"{slug(match['map'])}-{slug(match['opponent'])}-{'win' if match['winner'] else 'loss'}-{stamp}"
            jobs[match_folder.name] = (match_id or by_source[match_folder.name], match_folder)
    incoming = [export(match_id, folder) for match_id, folder in jobs.values()]
    known = {m['id']:i for i,m in enumerate(existing)}
    for match in incoming:
        if match['id'] in known:
            existing[known[match['id']]] = match
        else:
            known[match['id']] = len(existing)
            existing.append(match)
    terrain = json.loads(TERRAIN_SOURCE.read_text(encoding='utf-8'))
    if ''.join(c for c in terrain['map'] if c.isprintable()) != 'Benzene1.1':
        raise RuntimeError('terrain source is not Benzene1.1')
    (PAGE / 'data' / 'benzene-terrain.json').write_text(json.dumps(
        {'map': terrain['map'], 'width': terrain['width'], 'height': terrain['height'], 'terrain': terrain['terrain']},
        separators=(',', ':')), encoding='utf-8')
    (PAGE / 'data' / 'index.json').write_text(json.dumps({'matches': existing}, ensure_ascii=False, indent=1), encoding='utf-8')


if __name__ == '__main__':
    main(sys.argv[1:])
