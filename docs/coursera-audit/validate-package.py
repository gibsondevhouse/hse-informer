"""Static integrity and token-contrast checks for the reference package."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlparse, unquote
from collections import Counter
import json,re,hashlib
from PIL import Image
ROOT=Path(__file__).resolve().parent
class Parser(HTMLParser):
    def __init__(self): super().__init__(); self.ids=[]; self.links=[]
    def handle_starttag(self,tag,attrs):
        attrs=dict(attrs)
        if 'id' in attrs: self.ids.append(attrs['id'])
        for key in ('href','src'):
            if key in attrs: self.links.append(attrs[key])
p=Parser();html=(ROOT/'style-guide.html').read_text(encoding='utf-8-sig');p.feed(html)
errors=[]
for key,count in Counter(p.ids).items():
    if count>1:errors.append(f'Duplicate id: {key}')
for link in p.links:
    url=urlparse(link)
    if url.scheme or url.netloc:continue
    if url.path and not (ROOT/unquote(url.path)).exists():errors.append(f'Missing HTML target: {link}')
    if not url.path and url.fragment and url.fragment not in p.ids:errors.append(f'Missing anchor: {link}')
for marker in ['__COMPONENTS_JSON__','__EVIDENCE_JSON__','TODO','Lorem ipsum']:
    if marker in html:errors.append(f'Unresolved marker: {marker}')
for file in ROOT.rglob('*.json'):
    if file.name=='integrity.json':continue
    json.loads(file.read_text(encoding='utf-8-sig'))
evidence=json.loads((ROOT/'evidence/index.json').read_text())
for e in evidence:
    with Image.open(ROOT/'evidence'/e['file']) as im:im.verify()
components=json.loads((ROOT/'components.json').read_text())
assert len(components)==32
assert len({c['id'] for c in components})==32
contrast=json.loads((ROOT/'contrast-results.json').read_text())
assert all(c['passes'] for c in contrast if c['name'].startswith('HSE '))
assert len(contrast)==16
tokens=json.loads((ROOT/'design-tokens.json').read_text())['hseProposed']['cssCustomProperties']
for cssfile in [ROOT/'hse-tokens.css',ROOT/'style-guide.css']:
    for token in set(re.findall(r'var\((--hse-[\w-]+)',cssfile.read_text(encoding='utf-8-sig'))):
        if token not in tokens:errors.append(f'Undefined token: {token}')
manifest=[]
for f in sorted(ROOT.rglob('*')):
    if not f.is_file() or f.name=='integrity.json':continue
    manifest.append({'path':str(f.relative_to(ROOT)).replace('\\','/'),'bytes':f.stat().st_size,'sha256':hashlib.sha256(f.read_bytes()).hexdigest()})
result={'date':'2026-09-07','htmlIds':len(p.ids),'components':len(components),'hseTokens':len(tokens),'sourceScreenshots':len(evidence),'contrastPairs':len(contrast),'errors':errors,'files':manifest}
(ROOT/'qa/integrity.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
print(json.dumps({k:v for k,v in result.items() if k!='files'},indent=2))
if errors:raise SystemExit(1)
