"""Human commander page: native viewer stays in step with the main viewer, and page data is complete."""
import hashlib
import json
from pathlib import Path
import unittest

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


if __name__ == '__main__':
    unittest.main()
