"""Export model-commander self-iteration replays for site/model-commander/.

Usage: python scripts/model_commander.py

One replay is published per iteration round. The page data comes only from each
run's own batch.json / evolution-log.jsonl / experiment-ledger.json and each
match's match.json; nothing is re-simulated. The original .rep is copied as-is.

Selection inside a round (only matches played by the version under test):
  natural win > highest L0 score (when recorded) > natural finish > longest game.
"""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / 'site' / 'model-commander'
FPS = 1000 / 42  # Fastest game speed, 42 ms per frame

RUNS = [
    {'id': 'a', 'kind': 'rounds2',
     'paths': [
         Path(r'D:\xjzb\starcraft-commander-stage1-20261123\matches\rsi\20261124-145321-768219'),
         Path(r'D:\xjzb\starcraft-commander-stage1-20261123\matches\rsi\20261124-193345-717393'),
     ]},
    {'id': 'b', 'kind': 'ledger',
     'path': Path(r'D:\xjzb\starcraft-commander-rsi-v2\matches\rsi\20261124-224218-659920')},
]


def load(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))


def jsonl(path):
    return [json.loads(line) for line in path.read_text(encoding='utf-8').splitlines() if line.strip()]


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def slug(text):
    return ''.join(c if c.isalnum() else '-' for c in text.lower()).strip('-')


def outcome(m):
    if m.get('state') == 'finished' and m.get('natural_outcome') in ('win', 'loss'):
        return m['natural_outcome'], 'natural'
    adj = m.get('adjudicated_outcome') or ''
    if adj == 'inconclusive' or m.get('state') == 'manual_stop':
        return 'draw', m.get('cutoff_reason') or m.get('state') or 'max_frames'
    if adj == 'cutoff_loss':
        return 'loss', m.get('cutoff_reason') or 'cutoff'
    return ('win' if m.get('winner') else 'loss'), 'natural'


def rank(p):
    score = p.get('l0_score')
    return (p['result'] == 'win', score if isinstance(score, (int, float)) else -1, p['end'] == 'natural', p.get('frame') or 0)


def match_record(run_path, number, m):
    folder = run_path / f'match-{number}'
    replay = folder / m['replay']
    if not replay.is_file():
        raise FileNotFoundError(replay)
    result, end = outcome(m)
    me = next(p for p in m['players'] if p['id'] == m['self_player_id'])
    foe = next(p for p in m['players'] if p['id'] != m['self_player_id'])
    return {
        'match_number': number, 'opponent': m['opponent'], 'map': m['map'], 'version': m.get('policy_version'),
        'result': result, 'end': end, 'frame': m['frame'], 'seconds': round(m['frame'] / FPS),
        'l0_score': m.get('l0_score'),
        'self_name': me['name'], 'opponent_name': foe['name'], 'race': me['race'], 'opponent_race': foe['race'],
        '_replay': replay,
    }


def rounds_a(run):
    out = []
    round_num = 0
    for run_path in run['paths']:
        batch = load(run_path / 'batch.json')
        evo = {e['round']: e for e in jsonl(run_path / 'evolution-log.jsonl')}
        for _, e in sorted(evo.items()):
            round_num += 1
            played = [match_record(run_path, n, batch['matches'][n - 1]) for n in e['match_numbers']]
            tested = played[0]['version']
            if e.get('decision') == 'modify':
                decision, reason = 'revised', e['version']
            else:
                decision, reason = 'kept', e['version']
            out.append({'round': round_num, 'tested': tested, 'parent': e['parent'] if tested != e['parent'] else None,
                        'decision': decision, 'reason': reason, 'next_version': e['version'],
                        'changed_files': e.get('changed_files') or [], 'played': played})
    return out


def rounds_b(run):
    batch = load(run['path'] / 'batch.json')
    ledger = load(run['path'] / 'experiment-ledger.json')
    out = []
    for rd in ledger['rounds']:
        tested = rd['evaluated']
        version = ledger['versions'][tested]
        played = [match_record(run['path'], n, batch['matches'][n - 1]) for n in rd['match_numbers']]
        out.append({'round': rd['round'], 'tested': tested, 'parent': version.get('parent'),
                    'decision': rd.get('adjudication_decision') or 'baseline',
                    'reason': rd.get('adjudication_reason'), 'next_version': rd.get('champion_after_round'),
                    'changed_files': version.get('changed_files') or [],
                    'cpp_changed_lines': version.get('cpp_changed_lines'),
                    'played': [p for p in played if p['version'] == tested], 'all_played': played})
    return out


def summary(played):
    return [{k: p[k] for k in ('match_number', 'opponent', 'version', 'result', 'end', 'l0_score', 'seconds')} for p in played]


def main():
    reps = PAGE / 'reps'
    reps.mkdir(parents=True, exist_ok=True)
    runs, keep = [], set()
    for run in RUNS:
        meta_path = run['paths'][-1] if 'paths' in run else run['path']
        batch = load(meta_path / 'batch.json')
        rounds = rounds_a(run) if run['kind'] == 'rounds2' else rounds_b(run)
        items = []
        for rd in rounds:
            pick = max(rd['played'], key=rank)
            match_id = f"{run['id']}-r{rd['round']:02d}-{slug(rd['tested'])}-{slug(pick['opponent'])}-{pick['result']}"
            target = reps / f'{match_id}.rep'
            target.write_bytes(pick['_replay'].read_bytes())
            keep.add(target.name)
            entry = {k: v for k, v in rd.items() if k not in ('played', 'all_played')}
            entry['round_matches'] = summary(rd.get('all_played') or rd['played'])
            entry.update({k: v for k, v in pick.items() if not k.startswith('_')})
            entry.update({'id': match_id, 'file': f'reps/{match_id}.rep', 'bytes': target.stat().st_size,
                          'sha256': sha256(target)})
            items.append(entry)
            print(f"{match_id}: match-{pick['match_number']} {pick['result']}/{pick['end']} frame {pick['frame']}")
        p = batch['parameters']
        runs.append({'id': run['id'], 'rounds': len(rounds),
                     'matches_per_round': 4 if run['kind'] == 'ledger' else p['matches_per_round'],
                     'parallel': p['parallel'], 'map': p['map'], 'opponents': p.get('core_opponents') or p['opponent'].split(','),
                     'live_model': p['live_model'], 'review_model': p['review_model'], 'items': items})
    for stale in reps.glob('*.rep'):
        if stale.name not in keep:
            stale.unlink()
    (PAGE / 'data').mkdir(exist_ok=True)
    (PAGE / 'data' / 'index.json').write_text(json.dumps({'runs': runs}, ensure_ascii=False, indent=1), encoding='utf-8')


if __name__ == '__main__':
    main()
