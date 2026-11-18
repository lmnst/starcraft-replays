"""Human commander page: native viewer stays in step with the main viewer, and page data is complete."""
import hashlib
import json
from pathlib import Path
import unittest
import zipfile
import human_commander as exporter

ROOT = Path(__file__).resolve().parents[1]
VIEWER = ROOT / 'site/viewer'
PAGE = ROOT / 'site/human-commander'


class HumanCommanderTests(unittest.TestCase):
    def test_native_viewer_only_swaps_engine(self):
        main = (VIEWER / 'index.html').read_bytes()
        native = (VIEWER / 'native.html').read_bytes()
        self.assertEqual(main.replace(b'src="v1.4/openbw.js"', b'src="v1.4/native/openbw.js"', 1), native)

    def test_native_engine_cache_key_matches_wasm(self):
        digest = hashlib.sha256((VIEWER / 'v1.4/native/openbw.wasm').read_bytes()).hexdigest()[:12]
        self.assertIn(f"'?v={digest}'", (VIEWER / 'pilot-bridge.js').read_text(encoding='utf-8'))

    def test_page_data_files_exist(self):
        index = json.loads((PAGE / 'data/index.json').read_text(encoding='utf-8'))
        self.assertTrue(index['matches'])
        for match in index['matches']:
            data = json.loads((PAGE / 'data' / f"{match['id']}.json").read_text(encoding='utf-8'))
            replay = PAGE / data['files']['replay']
            self.assertEqual(hashlib.sha256(replay.read_bytes()).hexdigest(), data['hashes']['replay'])
            self.assertTrue((PAGE / data['files']['package']).is_file())
            self.assertEqual(len(data['commands']), match['commands'])
            if data.get('terrain'):
                self.assertTrue((PAGE / data['terrain']).is_file())

    def test_append_order_and_historical_data(self):
        matches = json.loads((PAGE / 'data/index.json').read_text(encoding='utf-8'))['matches']
        self.assertEqual([m['id'] for m in matches[:2]], ['benzene-hladhammer-win', 'benzene-purplewave-loss'])
        self.assertEqual(len(matches), 30)
        self.assertEqual(len({m['id'] for m in matches}), 30)
        local = matches[2:19]
        self.assertTrue(all(m['id'].startswith('hc-') for m in local))
        self.assertEqual([m['started_at'] for m in local], sorted(m['started_at'] for m in local))
        versions = set()
        for m in local:
            d = json.loads((PAGE / 'data' / f"{m['id']}.json").read_text(encoding='utf-8'))
            versions.add(d['keymap_id'])
            terrain = json.loads((PAGE / d['terrain_file']).read_text(encoding='utf-8'))
            self.assertEqual(len(terrain['terrain']), terrain['height'])
            self.assertTrue(all(len(row) == terrain['width'] for row in terrain['terrain']))
            for c in d['commands']:
                _, profile = exporter.profile_for(c.get('keymap') or d['keymap'])
                self.assertEqual(c['display_name'], profile['keys'][c['display_key']])
            with zipfile.ZipFile(PAGE / d['files']['package']) as z:
                replays = [n for n in z.namelist() if n.endswith('.rep')]
                self.assertEqual(len(replays), 1)
                self.assertEqual(hashlib.sha256(z.read(replays[0])).hexdigest(), d['hashes']['replay'])
                self.assertIn(d['source_folder'] + '/match.json', z.namelist())
                self.assertIn(d['source_folder'] + '/bwapi-data/write/commander-layer.jsonl', z.namelist())
        self.assertEqual(len(versions), 7)

    def test_keys_change_meaning_and_unknown_version_rejected(self):
        def label(version, key, modifier='none'):
            return exporter.annotate({'key':key, 'modifier':modifier}, version)['display_name']
        self.assertEqual(label('eight-key-top-row-v1','6'), '保卫基地')
        self.assertEqual(label('scope-actions-v10-retreat-rendezvous','2'), '小队模式')
        self.assertEqual(label('tenkeys_combat_v12','2'), '强制采矿')
        self.assertEqual(label('tenkeys_assembly_v14','8'), '原地集结等援兵')
        self.assertEqual(label('tenkeys_main_area_v16','8','alt'), '安全撤离集结')
        self.assertEqual(label('tenkeys_main_area_v16','6'), '主基地区域清场')
        with self.assertRaises(ValueError):
            exporter.profile_for('unrecorded-version')

    def test_legacy_missing_fields_and_short_match_are_explicit(self):
        legacy=json.loads((PAGE/'data/hc-20261116-111814-787864.json').read_text(encoding='utf-8'))
        self.assertEqual(legacy['hud'], [])
        self.assertEqual(legacy['tasks'], [])
        self.assertTrue(all(r[legacy['state_fields'].index('healthy_army')] is None for r in legacy['states']))
        short=json.loads((PAGE/'data/hc-20261117-211337-542862.json').read_text(encoding='utf-8'))
        self.assertIn('结束原因尚未核实', short['record_note'])


if __name__ == '__main__':
    unittest.main()
