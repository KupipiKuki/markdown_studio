"""Capture the Phase 0 baseline and fixtures without changing application bytes."""
from pathlib import Path
from html.parser import HTMLParser
import datetime, hashlib, json, platform

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'baseline/markdown_studio.original.html'
OUT = ROOT / 'evidence/phase-0'
src = SOURCE.read_text()

class Inventory(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.controls = []
        self.dependencies = []
    def handle_starttag(self, tag, pairs):
        a = dict(pairs)
        if tag == 'script' and 'src' in a or tag == 'link' and 'href' in a:
            self.dependencies.append(a.get('src', a.get('href')))
        if tag in ('button', 'select', 'input', 'textarea') or tag == 'label' and 'for' in a or a.get('id') in ('splitResizer','statusViewMode','statusErrorIndicator'):
            self.controls.append({'id':f'C{len(self.controls)+1:03}', 'tag':tag,
                'line':self.getpos()[0], 'attributes':a,
                'expected':a.get('title', a.get('aria-label', a.get('id', a.get('data-action', a.get('data-template', a.get('data-insert', tag)))))),
                'result':'unrun; browser unavailable'})

inv = Inventory(); inv.feed(src)
meta = {'captured_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'source_sha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
    'size_bytes':SOURCE.stat().st_size,'line_count':len(src.splitlines()),
    'platform':platform.platform(), 'dependencies':inv.dependencies,
    'source_library_file_id':'libfile_80752652d9c48191a6b93000475d2e51',
    'source_library_version':'not supplied; not inferred',
    'plan_library_file_id':'libfile_eae156c41398819198c59c5fd351ea57'}
(OUT/'baseline.json').write_text(json.dumps(meta,indent=2)+'\n')
(OUT/'controls.json').write_text(json.dumps(inv.controls,indent=2)+'\n')
lines=['# Baseline control inventory','','Static controls are enumerated individually. Expected behavior follows the label or command; actual behavior remains unrun pending browser access. The JSON inventory retains complete attributes.','','| ID | Baseline line | Control | Expected | Actual |','| --- | --- | --- | --- | --- |']
for c in inv.controls:
    a=c['attributes']; selector='#'+a['id'] if 'id' in a else c['tag']+': '+a.get('data-action',a.get('data-template',a.get('data-insert','')))
    clean=lambda x:str(x).replace('|','&#124;').replace('\n',' ')
    lines.append('| '+' | '.join(map(clean,[c['id'],c['line'],selector,c['expected'],c['result']]))+' |')
lines += ['', '## Dynamic control families and expected behavior','',
    '- Tabs: activate; rename on double click; close; create; retain saved documents.',
    '- Outline: scroll to selected heading.',
    '- Diagram toolbar: Edit exact source; zoom in/out/reset; fullscreen; copy exact code; export SVG/PNG.',
    '- Invalid diagram: Fix in Studio opens failing source.',
    '- Error rows: Copy error text; Dismiss just that row.',
    '- Dropdowns: open on trigger and dismiss on outside click.',
    '- Modals: open/close/cancel; Escape dismisses. Verify backdrop behavior against implementation.',
    '- Splitter: drag changes pane ratio; double click restores 50/50.',
    '- Preview/Studio/fullscreen: drag pans; wheel zooms; controls remain reachable.','',
    '## Keyboard coverage','',
    '- Ctrl/Meta+S/B/I/F/K/N: save, bold, italic, find, link, new tab.',
    '- Ctrl/Meta+Shift+E/V/S and Alt+E/V/S: editor, viewer, split.',
    '- Escape: close Studio/fullscreen/table/find/error drawer.',
    '- Editor Tab/Shift+Tab: indent/unindent; Enter: list continuation/termination; paired brackets/quotes.',
    '- Repeat shortcuts while focused in Studio, find, replace and modal inputs to detect unintended editor changes.','',
    'All dynamic and keyboard tests are unrun unless separately recorded in test-results.json.']
(OUT/'controls.md').write_text('\n'.join(lines)+'\n')
f=OUT/'fixtures';f.mkdir(exist_ok=True)
fixtures={
 'tall.md':'```mermaid\nflowchart TD\n'+''.join(f'  N{i}[Step {i}] --> N{i+1}[Step {i+1}]\n' for i in range(25))+'```\n',
 'wide.md':'```mermaid\nflowchart LR\n'+''.join(f'  N{i}[Step {i}] --> N{i+1}[Step {i+1}]\n' for i in range(15))+'```\n',
 'multi.md':'# Multiple diagrams\n\n```mermaid\nflowchart TD\n A[First] --> B[Second]\n```\n\nBetween diagrams\n\n```mermaid\nsequenceDiagram\n Alice->>Bob: Hello\n```\n',
 'invalid.md':'```mermaid\nflowchart TD\n A[Unclosed\n```\n',
 'labels.md':'```mermaid\nflowchart TD\n A["A long label with several words to inspect for spacing and clipping"] --> B["First line<br/>Second line"]\n```\n',
 'mixed.md':'# Mixed content\n\nParagraph with **bold**, $a_b+c^2$, and `inline code`.\n\n$$\nx^2+y^2=z^2\n$$\n\n```javascript\nconst sample = "mermaid";\n```\n\n```mermaid\nflowchart LR\n A --> B\n```\n',
 'mixed-fences.md':'# Preserve this heading\n\n~~~mermaid\nflowchart LR\n A[Tilde] --> B\n~~~\n\nKeep this paragraph.\n\n```mermaid\nflowchart TD\n C[Backtick] --> D\n```\n',
 'outer-fence.md':'````markdown\n```mermaid\nflowchart TD\n A --> B\n```\n````\n\n```text\nmermaid\nflowchart TD\n C --> D\n```\n',
 'nested.md':'> ```mermaid\n> flowchart TD\n>  A --> B\n> ```\n\n- List item\n\n  ```mermaid\n  flowchart LR\n   C --> D\n  ```\n'}
for name,body in fixtures.items():(f/name).write_text(body)
print(json.dumps({'baseline':meta,'static_controls':len(inv.controls),'fixtures':len(fixtures)},indent=2))
