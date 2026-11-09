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
        self.record = json.loads((ROOT / 'content/matches/01-win-heartbreak.json').read_text(encoding='utf-8'))
        self.record['visible'] = True
        shutil.copyfile(ROOT / 'site/replays/01-win-heartbreak.rep', self.root / 'site/replays/01-win-heartbreak.rep')
        manifest = {'files': {}}
        for name in ('StarDat.mpq','BrooDat.mpq','Patch_rt.mpq'):
            data=b'MPQ\x1aTEST';(self.root / 'site/game-data' / name).write_bytes(data)
            manifest['files'][name]={'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}
        (self.root / 'site/game-data/manifest.json').write_text(json.dumps(manifest))

    def build(self):
        (self.root / 'content/matches/01-win-heartbreak.json').write_text(json.dumps(self.record))
        return subprocess.run([sys.executable,str(self.root / 'scripts/build.py')],env=os.environ | {'REPLAY_VALIDATOR':VALIDATOR},capture_output=True,encoding='utf-8')

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

    def room_item(self, **changes):
        (self.root / 'content/replay-room').mkdir(exist_ok=True)
        (self.root / 'site/room-media').mkdir(exist_ok=True)
        shutil.copyfile(ROOT / 'site/replays/01-win-heartbreak.rep', self.root / 'site/room-media/sample.rep')
        item = {'id':'sample', 'title_en':'Test match', 'title_zh':'Test match',
                'type':'replay', 'file':'/room-media/sample.rep', 'visible':True} | changes
        (self.root / 'content/replay-room/sample.json').write_text(json.dumps(item), encoding='utf-8')

    def test_empty_room_preserves_existing_catalog(self):
        self.assertEqual(self.build().returncode, 0)
        self.assertEqual(json.loads((self.root / 'dist/room-catalog.json').read_text())['items'], [])
        self.assertEqual(len(json.loads((self.root / 'dist/catalog.json').read_text())['matches']), 1)

    def test_room_replay_publishes_separately_and_unpublishes(self):
        self.room_item()
        self.assertEqual(self.build().returncode, 0)
        items = json.loads((self.root / 'dist/room-catalog.json').read_text())['items']
        self.assertEqual(items[0]['id'], 'sample')
        self.assertGreater(items[0]['replay_frames'], 0)
        self.assertTrue((self.root / 'dist/room-media/sample.rep').exists())
        self.room_item(visible=False)
        self.assertEqual(self.build().returncode, 0)
        self.assertEqual(json.loads((self.root / 'dist/room-catalog.json').read_text())['items'], [])
        self.assertFalse((self.root / 'dist/room-media/sample.rep').exists())

    def test_unreferenced_room_media_is_not_published(self):
        self.room_item()
        (self.root / 'site/room-media/unreferenced.mp4').write_bytes(b'not published')
        self.assertEqual(self.build().returncode, 0)
        self.assertFalse((self.root / 'dist/room-media/unreferenced.mp4').exists())

    def test_room_path_escape_and_wrong_format_are_rejected(self):
        for changes in ({'file':'/room-media/../replays/01-win-heartbreak.rep'}, {'type':'video'}, {'id':'renamed'}):
            with self.subTest(changes=changes):
                self.room_item(**changes)
                self.assertNotEqual(self.build().returncode, 0)

    def test_room_video_header_is_checked(self):
        self.room_item(type='video', file='/room-media/sample.mp4')
        video = self.root / 'site/room-media/sample.mp4'
        video.write_bytes(b'bad video header' * 4)
        self.assertNotEqual(self.build().returncode, 0)
        video.write_bytes(b'\x00\x00\x00\x20ftypisom' + bytes(64))
        self.assertEqual(self.build().returncode, 0)
        self.assertEqual(json.loads((self.root / 'dist/room-catalog.json').read_text())['items'][0]['type'], 'video')

    def test_room_media_paths_are_normalized_before_copying(self):
        self.room_item(file='/room-media/../../site/room-media/sample.rep')
        self.assertEqual(self.build().returncode, 0)
        item = json.loads((self.root / 'dist/room-catalog.json').read_text())['items'][0]
        self.assertEqual(item['file'], '/room-media/sample.rep')
        self.assertTrue((self.root / 'dist/room-media/sample.rep').exists())

if __name__ == '__main__': unittest.main()
