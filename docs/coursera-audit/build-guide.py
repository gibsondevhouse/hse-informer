"""Embed local reference data for an offline, directly openable HTML guide."""
from pathlib import Path
ROOT=Path(__file__).resolve().parent
template=(ROOT/'style-guide.template.html').read_text(encoding='utf-8')
for marker,file in [('__COMPONENTS_JSON__','components.json'),('__EVIDENCE_JSON__','evidence/index.json')]:
    template=template.replace(marker,(ROOT/file).read_text(encoding='utf-8').replace('</','<\\/'))
(ROOT/'style-guide.html').write_text(template,encoding='utf-8')
print('Built style-guide.html')
