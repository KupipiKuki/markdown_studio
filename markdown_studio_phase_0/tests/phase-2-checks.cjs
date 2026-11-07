// Phase 2 verification tests for Markdown Studio remediation
// Scope: Gate G2 - Source replacement & render lifecycle (W1: R05 residual, W2: R09, W3: R15)

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const crypto = require('crypto');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'evidence/phase-2');
fs.mkdirSync(out, { recursive: true });

const workingPath = path.join(root, 'working/markdown_studio.html');
const srcRaw = fs.readFileSync(workingPath, 'utf8');
const src = srcRaw.replace(/\r\n/g, '\n');

const marked = require('./vendor/marked.min.js');

const results = [];

function record(id, issues, name, procedure, observation, status = 'pass') {
  results.push({
    id,
    issues,
    gate: 'G2',
    name,
    timestamp: new Date().toISOString(),
    procedure,
    observation,
    status
  });
}

function section(a, b) {
  const start = src.indexOf(a);
  assert(start >= 0, `Could not find section start: ${a}`);
  const end = src.indexOf(b, start + a.length);
  assert(end > start, `Could not find section end: ${b}`);
  return src.slice(start, end).trim();
}

console.log('=== Starting Phase 2 Verification Suite ===\n');

// -----------------------------------------------------------------------------
// Test 1: P2-01 Parser-Consistent Source Ranges (W1 / R05 residual)
// -----------------------------------------------------------------------------
try {
  // Extract real implementations from working/markdown_studio.html
  const isMermaidFn = section('function isMermaidLanguage(lang) {', 'let renderedDiagramCounter = 0;');
  const spansFn = section('function getMermaidSpans(markdown) {', 'function replaceDiagramSource(markdown, targetIndex, newCode) {');
  const replaceFn = section('function replaceDiagramSource(markdown, targetIndex, newCode) {', '// Insert or Replace into active Markdown document');
  const insertSection = section('btnBuilderInsert.onclick = () => {', '// Quick Diagram dropdown templates');

  const ctx = {
    marked,
    builderCodeInput: { value: '' },
    editorEl: {
      value: '',
      dispatchEvent(e) { if (e && e.type === 'input') ctx.inputEventsDispatched++; }
    },
    btnBuilderInsert: {},
    activeEditingDiagramIndex: null,
    wrapSelection: (fenced, _) => { ctx.editorEl.value += fenced; },
    closeStudio: () => { ctx.activeEditingDiagramIndex = null; },
    showToast: () => {},
    inputEventsDispatched: 0,
    Event: function(t) { this.type = t; }
  };

  vm.createContext(ctx);
  vm.runInContext(isMermaidFn, ctx);
  vm.runInContext(spansFn, ctx);
  vm.runInContext(replaceFn, ctx);
  vm.runInContext(insertSection, ctx);

  // Sub-test 1a: Blockquote-nested fixture (QAQC repro 1)
  // Fixture: > ```mermaid first, followed by top-level ```mermaid
  const bqFixturePath = path.join(out, 'fixtures/blockquote-nested.md');
  const bqDoc = fs.readFileSync(bqFixturePath, 'utf8').replace(/\r\n/g, '\n');

  // Edit Card 0 (blockquote diagram)
  ctx.editorEl.value = bqDoc;
  ctx.activeEditingDiagramIndex = 0;
  ctx.builderCodeInput.value = 'flowchart TD\n  BQ_EDITED --> Success';
  ctx.btnBuilderInsert.onclick();

  const bqAfter0 = ctx.editorEl.value;
  assert(bqAfter0.includes('> ```mermaid\n> flowchart TD\n>   BQ_EDITED --> Success\n> ```'), 'Blockquote diagram must be updated preserving > blockquote prefix');
  assert(bqAfter0.includes('Middle paragraph separating diagrams.'), 'Middle paragraph must remain untouched');
  assert(bqAfter0.includes('```mermaid\nflowchart LR\n  C --> D\n```'), 'Top-level diagram 1 must remain untouched when editing diagram 0');

  // Edit Card 1 (top-level diagram)
  ctx.editorEl.value = bqAfter0;
  ctx.activeEditingDiagramIndex = 1;
  ctx.builderCodeInput.value = 'flowchart LR\n  TOP_EDITED --> Done';
  ctx.btnBuilderInsert.onclick();

  const bqAfter1 = ctx.editorEl.value;
  assert(bqAfter1.includes('> ```mermaid\n> flowchart TD\n>   BQ_EDITED --> Success\n> ```'), 'Blockquote diagram 0 must remain untouched when editing diagram 1');
  assert(bqAfter1.includes('Middle paragraph separating diagrams.'), 'Middle paragraph must remain untouched');
  assert(bqAfter1.includes('```mermaid\nflowchart LR\n  TOP_EDITED --> Done\n```'), 'Top-level diagram 1 must be updated');

  // Sub-test 1b: Info-variant fences (QAQC repro 2)
  // Fixture: ```mermaid-x (ignored), ```mermaid title="Architecture Overview", ```mermaid
  const infoFixturePath = path.join(out, 'fixtures/info-variant-fences.md');
  const infoDoc = fs.readFileSync(infoFixturePath, 'utf8').replace(/\r\n/g, '\n');

  // Edit Card 0 (which is the real diagram with title="Architecture Overview", NOT mermaid-x)
  ctx.editorEl.value = infoDoc;
  ctx.activeEditingDiagramIndex = 0;
  ctx.builderCodeInput.value = 'flowchart TD\n  Client --> LoadBalancer';
  ctx.btnBuilderInsert.onclick();

  const infoAfter0 = ctx.editorEl.value;
  assert(infoAfter0.includes('```mermaid-x\nflowchart TD\n  NotMermaid --> Ignored\n```'), 'mermaid-x block must remain completely untouched');
  assert(infoAfter0.includes('Intro text.'), 'Intro text must remain untouched');
  assert(infoAfter0.includes('```mermaid title="Architecture Overview"\nflowchart TD\n  Client --> LoadBalancer\n```'), 'Diagram 0 must be updated preserving title="Architecture Overview" info string');
  assert(infoAfter0.includes('Mid text.'), 'Mid text must remain untouched');
  assert(infoAfter0.includes('```mermaid\nsequenceDiagram\n  Alice->>Bob: Hello\n```'), 'Diagram 1 must remain untouched');

  // Edit Card 1 (sequence diagram)
  ctx.activeEditingDiagramIndex = 1;
  ctx.builderCodeInput.value = 'sequenceDiagram\n  Alice->>Bob: Goodbye';
  ctx.btnBuilderInsert.onclick();

  const infoAfter1 = ctx.editorEl.value;
  assert(infoAfter1.includes('```mermaid-x\nflowchart TD\n  NotMermaid --> Ignored\n```'), 'mermaid-x block must remain completely untouched');
  assert(infoAfter1.includes('```mermaid title="Architecture Overview"\nflowchart TD\n  Client --> LoadBalancer\n```'), 'Diagram 0 must remain untouched');
  assert(infoAfter1.includes('```mermaid\nsequenceDiagram\n  Alice->>Bob: Goodbye\n```'), 'Diagram 1 must be updated');

  // Sub-test 1c: Mixed outer-fence fixture (4-backtick outer markdown block containing mermaid)
  const outerFixturePath = path.join(out, 'fixtures/mixed-outer-fence.md');
  const outerDoc = fs.readFileSync(outerFixturePath, 'utf8').replace(/\r\n/g, '\n');

  // The outer 4-backtick markdown block contains an example ```mermaid block which Marked ignores.
  // The first real diagram rendered is the ~~~mermaid diagram (card index 0).
  ctx.editorEl.value = outerDoc;
  ctx.activeEditingDiagramIndex = 0;
  ctx.builderCodeInput.value = 'flowchart TD\n  TildeUpdated1 --> TildeUpdated2';
  ctx.btnBuilderInsert.onclick();

  const outerAfter0 = ctx.editorEl.value;
  assert(outerAfter0.includes('````markdown\nCode block example:\n```mermaid\nflowchart TD\n  Example --> Inside\n```\n````'), 'Outer 4-backtick markdown code block must remain completely untouched');
  assert(outerAfter0.includes('~~~mermaid\nflowchart TD\n  TildeUpdated1 --> TildeUpdated2\n~~~'), 'Diagram 0 (~fence) must be updated preserving tildes');
  assert(outerAfter0.includes('```mermaid\nflowchart LR\n  Backtick1 --> Backtick2\n```'), 'Diagram 1 (backtick fence) must remain untouched');

  // Sub-test 1d: Deeply nested blockquote (>> ) and indented fences
  const deepDoc = `>> \`\`\`mermaid
>> flowchart TD
>>   Nested1 --> Nested2
>> \`\`\`

   ~~~mermaid
   flowchart LR
   Indented1 --> Indented2
   ~~~
`;
  ctx.editorEl.value = deepDoc;
  ctx.activeEditingDiagramIndex = 0;
  ctx.builderCodeInput.value = 'flowchart TD\n  Nested1 --> EDITED';
  ctx.btnBuilderInsert.onclick();

  const deepAfter0 = ctx.editorEl.value;
  assert(deepAfter0.includes('>> ```mermaid\n>> flowchart TD\n>>   Nested1 --> EDITED\n>> ```'), 'Deeply nested blockquote must be updated preserving >> prefix');
  assert(deepAfter0.includes('   ~~~mermaid\n   flowchart LR\n   Indented1 --> Indented2\n   ~~~'), 'Indented tilde fence must remain untouched');

  ctx.activeEditingDiagramIndex = 1;
  ctx.builderCodeInput.value = 'flowchart LR\n  Indented1 --> EDITED';
  ctx.btnBuilderInsert.onclick();

  const deepAfter1 = ctx.editorEl.value;
  assert(deepAfter1.includes('>> ```mermaid\n>> flowchart TD\n>>   Nested1 --> EDITED\n>> ```'), 'Deeply nested blockquote must remain untouched');
  assert(deepAfter1.includes('   ~~~mermaid\nflowchart LR\n  Indented1 --> EDITED\n   ~~~'), 'Indented tilde fence must be updated preserving 3 spaces fence indent and ~~~ delimiter');

  record('P2-01', ['R05'], 'Parser-Consistent Source Replacement',
    'Edit each card index across blockquote-nested, info-variant, 4-backtick outer, indented, and tilde/backtick fences; assert byte-exact update isolation.',
    {
      blockquoteNestedPreserved: true,
      infoVariantPreserved: true,
      fourBacktickOuterPreserved: true,
      nestedBlockquotePreserved: true,
      indentAndDelimitersPreserved: true,
      inputEventsDispatched: ctx.inputEventsDispatched
    }
  );
  console.log('✓ P2-01: Parser-consistent source replacement passes across all fence types, nestings, and info variants.');
} catch (e) {
  record('P2-01', ['R05'], 'Parser-Consistent Source Replacement', 'Execute parser-consistent diagram replacement', { error: e.message, stack: e.stack }, 'fail');
  console.error('✗ P2-01 Failed:', e.message);
  process.exitCode = 1;
}

// -----------------------------------------------------------------------------
// Write Results
// -----------------------------------------------------------------------------
const summary = {
  gate: 'G2',
  status: results.every(r => r.status === 'pass') ? 'pass' : 'fail',
  timestamp: new Date().toISOString(),
  testsPassed: results.filter(r => r.status === 'pass').length,
  testsFailed: results.filter(r => r.status === 'fail').length,
  findingsResolved: ['R05'],
  candidateSha256: crypto.createHash('sha256').update(src).digest('hex'),
  candidateSha256Raw: crypto.createHash('sha256').update(srcRaw).digest('hex'),
  lineEndings: srcRaw.includes('\r\n') ? 'CRLF-on-disk' : 'LF',
  results
};

fs.writeFileSync(path.join(out, 'phase-2-results.json'), JSON.stringify(summary, null, 2) + '\n');
console.log('\n=== Gate G2 Checks Completed ===');
console.log(`Passed: ${summary.testsPassed}, Failed: ${summary.testsFailed}`);
