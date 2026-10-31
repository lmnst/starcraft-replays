"""The featured library must satisfy the requested three-map win/loss pairs."""
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]

class FeaturedPairsTests(unittest.TestCase):
    def test_three_maps_have_same_opponent_win_loss_pairs(self):
        records = [json.loads(path.read_text(encoding='utf-8'))
                   for path in (ROOT / 'content/matches').glob('*.json')]
        records = [record for record in records if record['visible']]
        self.assertEqual(len(records), 6)
        self.assertEqual({r['map_code'] for r in records}, {'H', 'B', 'D'})
        for code in ('H', 'B', 'D'):
            pair = [record for record in records if record['map_code'] == code]
            self.assertEqual(len(pair), 2)
            self.assertEqual({r['result'] for r in pair}, {'win', 'loss'})
            self.assertEqual(len({r['player2'] for r in pair}), 1)
            self.assertEqual(len({r['opponent_tier'] for r in pair}), 1)
            self.assertEqual(len({r['map'] for r in pair}), 1)
        for record in records:
            self.assertEqual(record['player1'], 'Agnes')
            self.assertRegex(record['bot_version'], r'^v\d+$')
            self.assertIn(record['opponent_tier'], ('D', 'C', 'B', 'A', 'S'))

if __name__ == '__main__': unittest.main()
