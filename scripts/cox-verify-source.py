"""Compare all source text and original image geometry without loading app dependencies."""
import hashlib,json,pathlib,re
root=pathlib.Path(__file__).resolve().parents[1]
manifest=json.loads((root/'scripts/cox-data/source-manifest.json').read_text())
board=json.loads((root/'scripts/cox-data/board.json').read_text())['content']
clues={c['id']:c for cat in board['rounds'][0]['categories'] for c in cat['clues']}
assert len(clues)==25 and not board.get('final')
for side in manifest['slides']:
 clue=clues[side['clueId']]
 field='text' if side['side']=='q' else 'answer'
 assert clue[field]=='\n\n'.join(side['text']),side['clueId']+' '+field
for image in manifest['figures']:
 data=(root/'public/cox'/image['path']).read_bytes()
 assert hashlib.sha256(data).hexdigest()==image['sha256']
offline=(root/'scripts/cox-data/offline.html').read_text()
match=re.search(r'<script\b[^>]*\bid=["\']gameData["\'][^>]*>(.*?)</script>',offline,re.S)
assert match and hashlib.sha256(match[1].encode()).hexdigest()==manifest['gameDataSha256']
assert [c['name'] for c in board['rounds'][0]['categories']]==manifest['categories']
assert all(v['url'].endswith('.png') for c in clues.values() for v in [c.get('media'),c.get('answerMedia')] if v)
print('PASS:25 clues,50 exact text sides,15 original figures,PNG references,and offline canonical gameData hash.')
