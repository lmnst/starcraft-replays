"""Regression checks for corrupt uploads, permanent IDs and unpublishing."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
VALIDATOR = os.environ.get('REPLAY_VALIDATOR', str(ROOT / 'build/validate-replay'))

class ContentTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        for folder in ('scripts','content/matches','site/replays','site/game-data'):
            (self.root / folder).mkdir(parents=True)
        shutil.copyfile(ROOT / 'scripts/build.py', self.root / 'scripts/build.py')
        self.record = json.loads((ROOT / 'content/matches/01-win-heartbreak.json').read_text())
        self.record['visible'] = True
        shutil.copyfile(ROOT / 'site/replays/01-win-heartbreak.rep', self.root / 'site/replays/01-win-heartbreak.rep')
        manifest = {'files': {}}
        for name in ('StarDat.mpq','BrooDat.mpq','Patch_rt.mpq'):
            data=b'MPQ\x1aTEST';(self.root / 'site/game-data' / name).write_bytes(data)
            manifest['files'][name]={'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}
        (self.root / 'site/game-data/manifest.json').write_text(json.dumps(manifest))

    def build(self):
        (self.root / 'content/matches/01-win-heartbreak.json').write_text(json.dumps(self.record))
        return subprocess.run([sys.executable,str(self.root / 'scripts/build.py')],env=os.environ | {'REPLAY_VALIDATOR':VALIDATOR},capture_output=True,text=True)

    def test_unpublish_removes_catalog_and_replay_and_stale_output(self):
        self.assertEqual(self.build().returncode,0)
        (self.root / 'dist/stale.rep').touch()
        self.record['visible']=False
        self.assertEqual(self.build().returncode,0)
        self.assertEqual(json.loads((self.root / 'dist/catalog.json').read_text())['matches'],[])
        self.assertEqual(list((self.root / 'dist/replays').iterdir()),[])
        self.assertFalse((self.root / 'dist/stale.rep').exists())

    def test_permanent_id_cannot_change_inside_same_file(self):
        self.record['id']='renamed-match'
        self.assertNotEqual(self.build().returncode,0)

    def test_replacement_keeps_id_and_changes_public_hash(self):
        self.assertEqual(self.build().returncode,0)
        first=json.loads((self.root / 'dist/catalog.json').read_text())['matches'][0]
        shutil.copyfile(ROOT / 'site/replays/02-win-benzene.rep',self.root / 'site/replays/replacement.rep')
        self.record['replay']='/replays/replacement.rep'
        self.assertEqual(self.build().returncode,0)
        second=json.loads((self.root / 'dist/catalog.json').read_text())['matches'][0]
        self.assertEqual(first['id'],second['id'])
        self.assertNotEqual(first['sha256'],second['sha256'])
        self.assertNotEqual(first['replay_frames'],second['replay_frames'])
        self.assertFalse((self.root / 'dist/replays/01-win-heartbreak.rep').exists())

    def test_corruption_rejected(self):
        path=self.root / 'site/replays/01-win-heartbreak.rep'
        data=bytearray(path.read_bytes());data[0]^=1;path.write_bytes(data)
        self.assertNotEqual(self.build().returncode,0)

    def test_truncation_rejected(self):
        path=self.root / 'site/replays/01-win-heartbreak.rep'
        path.write_bytes(path.read_bytes()[:-30])
        self.assertNotEqual(self.build().returncode,0)

    def test_replay_path_must_stay_in_replay_directory(self):
        self.record['replay']='/replays/../../private.rep'
        self.assertNotEqual(self.build().returncode,0)

if __name__ == '__main__': unittest.main()
