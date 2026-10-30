"""One-time migration of verified local fixtures; not needed by CI."""
import hashlib
import json
from pathlib import Path
import shutil
root = Path(__file__).resolve().parents[1]
for source in sorted((root.parent / 'reports/replays').glob('*/game.rep')):
    slug = source.parent.name
    result = json.loads((source.parent / 'result.json').read_text())
    verification = json.loads((source.parent / 'verification.json').read_text())
    assert verification['passed'] and result['status'] == 'finished'
    opponent = Path(result['opponent']).stem
    map_name = Path(result['map']).stem
    record = dict(id=slug, title_en=f'Baseline vs {opponent} · {map_name}',
                  title_zh=f'Baseline 对阵 {opponent} · {map_name}',
                  player1='baseline', player2=opponent, map=map_name,
                  replay=f'/replays/{slug}.rep', visible=True,
                  result=result['result'], frames=result['frames'],
                  description_en='Local Bot test match. Result refers to baseline; this is not a tournament ranking.',
                  description_zh='本地 Bot 测试对局。胜负以 baseline 为准，不代表正式赛事或榜单成绩。')
    shutil.copyfile(source, root / 'site/replays' / f'{slug}.rep')
    (root / 'content/matches' / f'{slug}.json').write_text(json.dumps(record, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    proof = dict(sha256=hashlib.sha256(source.read_bytes()).hexdigest(), passed=True,
                 events=verification['events'], mode=verification['mode'])
    (root / 'verification' / f'{slug}.json').write_text(json.dumps(proof, indent=2)+'\n')
