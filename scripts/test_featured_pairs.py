"""Featured pairs must report actual outcomes from validated unified matches."""
import hashlib
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]

class FeaturedPairsTests(unittest.TestCase):
    def test_three_maps_have_same_opponent_version_pairs(self):
        records = [json.loads(path.read_text(encoding='utf-8'))
                   for path in (ROOT / 'content/matches').glob('*.json')]
        records = [record for record in records if record['visible']]
        self.assertEqual(len(records), 6)
        self.assertEqual({r['map_code'] for r in records}, {'H', 'B', 'D'})
        for code in ('H', 'B', 'D'):
            pair = [record for record in records if record['map_code'] == code]
            self.assertEqual(len(pair), 2)
            self.assertEqual(len({r['bot_version'] for r in pair}), 2)
            self.assertEqual({r['result'] for r in pair}, {'win', 'loss'})
            self.assertEqual(len({r['player2'] for r in pair}), 1)
            self.assertEqual(len({r['opponent_tier'] for r in pair}), 1)
            self.assertEqual(len({r['map'] for r in pair}), 1)
        for record in records:
            self.assertEqual(record['player1'], 'Agnes')
            self.assertRegex(record['bot_version'], r'^v\d+$')
            self.assertIn(record['opponent_tier'], ('D', 'C', 'B', 'A', 'S'))
            report = json.loads((ROOT / 'verification/unified' / (record['id'] + '.json')).read_text())
            self.assertTrue(report['passed'])
            self.assertTrue(report['natural_end'])
            self.assertEqual(report['issues'], [])
            self.assertEqual(record['result'], report['outcome'])
            self.assertEqual(record['player2'], report['opponent'])
            replay = ROOT / 'site' / record['replay'].lstrip('/')
            self.assertEqual(hashlib.sha256(replay.read_bytes()).hexdigest(), report['replay_sha256'])
            self.assertEqual(report['exit_codes'], [0, 0])
            self.assertEqual(report['forced_stop_sides'], [])
            self.assertTrue(report['browser_check']['passed'])
            self.assertEqual(report['browser_check']['comparedFrames'], report['replay_check']['frame'])
            self.assertEqual(report['browser_check']['sha256'], report['reference']['sha256'])

if __name__ == '__main__': unittest.main()
