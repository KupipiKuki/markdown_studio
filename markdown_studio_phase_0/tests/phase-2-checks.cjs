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
// Test 2: P2-03 Repeated Preview Setup Listener Cleanup & Detached Retention (W2 / R09)
// -----------------------------------------------------------------------------
try {
  const getCardFn = section('function getCardMermaidCode(card) {', 'async function renderAllPreviewDiagrams()');
  const interactivityFn = section('function setupPreviewDiagramInteractivity() {', '// --------------------------------------------------------------------------\n  // Diagram Export Helpers');

  function createMockCard(index, code = 'flowchart TD\n  A --> B') {
    let canvasHtml = '<svg></svg>';
    const classListSet = new Set();
    const canvasEl = {
      style: {},
      get innerHTML() { return canvasHtml; },
      set innerHTML(v) { canvasHtml = v; },
      querySelector: () => ({ style: {} })
    };
    const viewportEl = {
      dataset: { zoom: '1', panX: '0', panY: '0' },
      classList: {
        add(c) { classListSet.add(c); },
        remove(c) { classListSet.delete(c); },
        contains(c) { return classListSet.has(c); }
      },
      style: {},
      onmousedown: null,
      onwheel: null
    };
    const rawEl = { textContent: code };
    const card = {
      dataset: {
        diagramIndex: String(index),
        mermaidCode: encodeURIComponent(code)
      },
      querySelector(sel) {
        if (sel === '.mermaid-canvas') return canvasEl;
        if (sel === '.mermaid-viewport') return viewportEl;
        if (sel === '.mermaid-raw-code') return rawEl;
        return null;
      },
      querySelectorAll() { return []; },
      contains() { return true; },
      onclick: null
    };
    return { card, viewport: viewportEl, canvas: canvasEl };
  }

  const windowListeners = new Map();
  const mockWindow = {
    addEventListener(type, handler) {
      if (!windowListeners.has(type)) windowListeners.set(type, new Set());
      windowListeners.get(type).add(handler);
    },
    removeEventListener(type, handler) {
      if (windowListeners.has(type)) {
        windowListeners.get(type).delete(handler);
      }
    },
    trigger(type, event) {
      if (windowListeners.has(type)) {
        for (const h of windowListeners.get(type)) {
          h(event);
        }
      }
    }
  };

  let currentCards = [];
  let studioCode = null, studioIdx = null, copiedCode = null;

  const p2Ctx = {
    document: {
      querySelectorAll: (sel) => {
        if (sel.includes('.mermaid-block-card')) return currentCards.map(c => c.card);
        return [];
      },
      getElementById: () => null
    },
    window: mockWindow,
    openStudioWithCode: (code, idx) => { studioCode = code; studioIdx = idx; },
    copyToClipboard: (code) => { copiedCode = code; },
    openFullscreenDiagram: () => {},
    exportDiagramSvg: () => {},
    exportDiagramPng: () => {},
    encodeURIComponent,
    decodeURIComponent,
    showToast: () => {}
  };

  vm.createContext(p2Ctx);
  vm.runInContext(getCardFn, p2Ctx);
  vm.runInContext(interactivityFn, p2Ctx);

  // 1. Simulate 50 refresh cycles with fresh cards each cycle
  const cycleCounts = [];
  let initialMmCount = 0, initialMuCount = 0;

  for (let cycle = 1; cycle <= 50; cycle++) {
    const cardA = createMockCard(0, `flowchart TD\n  Cycle${cycle}A`);
    const cardB = createMockCard(1, `flowchart TD\n  Cycle${cycle}B`);
    currentCards = [cardA, cardB];

    p2Ctx.setupPreviewDiagramInteractivity();

    const mmCount = (windowListeners.get('mousemove') || new Set()).size;
    const muCount = (windowListeners.get('mouseup') || new Set()).size;

    if (cycle === 1) {
      initialMmCount = mmCount;
      initialMuCount = muCount;
      assert.equal(mmCount, 1, 'First cycle must register at most 1 shared mousemove listener');
      assert.equal(muCount, 1, 'First cycle must register at most 1 shared mouseup listener');
    } else {
      assert.equal(mmCount, initialMmCount, `Cycle ${cycle} mousemove count (${mmCount}) must not grow beyond initial (${initialMmCount})`);
      assert.equal(muCount, initialMuCount, `Cycle ${cycle} mouseup count (${muCount}) must not grow beyond initial (${initialMuCount})`);
    }

    assert.equal(p2Ctx.setupPreviewDiagramInteractivity.activePan, null, `Cycle ${cycle} must not retain active pan reference`);
    cycleCounts.push({ cycle, mmCount, muCount });
  }

  // 2. Verify interactive panning on cycle 50 card A
  const card50A = currentCards[0];
  card50A.viewport.onmousedown({ clientX: 200, clientY: 150, target: card50A.viewport, preventDefault() {} });
  assert(card50A.viewport.classList.contains('grabbing'), 'Viewport must enter grabbing state on mousedown');
  assert(p2Ctx.setupPreviewDiagramInteractivity.activePan !== null, 'Active pan state must be set during drag');

  mockWindow.trigger('mousemove', { clientX: 250, clientY: 190 });
  assert.equal(card50A.viewport.dataset.panX, '50', 'panX must update to delta 50px');
  assert.equal(card50A.viewport.dataset.panY, '40', 'panY must update to delta 40px');
  assert(card50A.canvas.style.transform.includes('translate(50px, 40px)'), 'Canvas transform must reflect pan');

  mockWindow.trigger('mouseup', {});
  assert(!card50A.viewport.classList.contains('grabbing'), 'Grabbing class must be removed on mouseup');
  assert.equal(p2Ctx.setupPreviewDiagramInteractivity.activePan, null, 'Active pan must be released on mouseup');

  // 3. Verify card action buttons functioning on cycle 50 card A
  const zoomInBtn = { dataset: { action: 'zoom-in' }, closest: () => zoomInBtn };
  card50A.card.onclick({ target: zoomInBtn, stopPropagation() {} });
  assert(parseFloat(card50A.viewport.dataset.zoom) > 1, 'Zoom in must increase zoom factor');

  const resetBtn = { dataset: { action: 'zoom-reset' }, closest: () => resetBtn };
  card50A.card.onclick({ target: resetBtn, stopPropagation() {} });
  assert.equal(card50A.viewport.dataset.zoom, '1', 'Zoom reset must reset zoom factor to 1');
  assert.equal(card50A.viewport.dataset.panX, '0', 'Zoom reset must reset panX to 0');
  assert.equal(card50A.viewport.dataset.panY, '0', 'Zoom reset must reset panY to 0');

  const editBtn = { dataset: { action: 'edit-diagram' }, closest: () => editBtn };
  card50A.card.onclick({ target: editBtn, stopPropagation() {} });
  assert.equal(studioCode, 'flowchart TD\n  Cycle50A', 'Edit diagram must pass exact cycle 50 source');
  assert.equal(studioIdx, 0, 'Edit diagram must pass diagram index 0');

  const copyBtn = { dataset: { action: 'copy-code' }, closest: () => copyBtn };
  card50A.card.onclick({ target: copyBtn, stopPropagation() {} });
  assert.equal(copiedCode, 'flowchart TD\n  Cycle50A', 'Copy code must copy exact cycle 50 source');

  // 4. Verify drag interrupted by new render cycle releases previous card
  const card50B = currentCards[1];
  card50B.viewport.onmousedown({ clientX: 100, clientY: 100, target: card50B.viewport, preventDefault() {} });
  assert(p2Ctx.setupPreviewDiagramInteractivity.activePan !== null, 'Active pan set on card B');
  // New render pass begins
  currentCards = [createMockCard(0, 'flowchart TD\n  NewRenderPass')];
  p2Ctx.setupPreviewDiagramInteractivity();
  assert.equal(p2Ctx.setupPreviewDiagramInteractivity.activePan, null, 'Dangling pan state must be cleared on re-setup');

  // 5. Explicit lifecycle cleanup
  p2Ctx.setupPreviewDiagramInteractivity.cleanup();
  const mmCleanCount = (windowListeners.get('mousemove') || new Set()).size;
  const muCleanCount = (windowListeners.get('mouseup') || new Set()).size;
  assert.equal(mmCleanCount, 0, 'mousemove listener must be removed on explicit cleanup');
  assert.equal(muCleanCount, 0, 'mouseup listener must be removed on explicit cleanup');
  assert.equal(p2Ctx.window.__previewPanListenersBound, false, '__previewPanListenersBound must be reset on cleanup');

  record('P2-03', ['R09'], 'Preview Interactivity Setup Listener Cleanup & Retention',
    'Execute setupPreviewDiagramInteractivity across 50 simulated render cycles; verify constant window listener count (zero growth), zero detached card retention, intact interactivity after 50 cycles, and full teardown on cleanup.',
    {
      cyclesTested: 50,
      initialListeners: { mousemove: initialMmCount, mouseup: initialMuCount },
      finalListeners: { mousemove: (windowListeners.get('mousemove') || new Set()).size, mouseup: (windowListeners.get('mouseup') || new Set()).size },
      listenerGrowthAcross50Cycles: 0,
      detachedNodeRetained: false,
      cycle50InteractivityPassed: true,
      interruptedDragHandled: true,
      cleanupTeardownPassed: true
    }
  );
  console.log('✓ P2-03: Repeated preview setup listener cleanup and detached-card release verified across 50 cycles.');
} catch (e) {
  record('P2-03', ['R09'], 'Preview Interactivity Setup Listener Cleanup & Retention', 'Execute preview interactivity lifecycle test', { error: e.message, stack: e.stack }, 'fail');
  console.error('✗ P2-03 Failed:', e.message);
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
  findingsResolved: ['R05', 'R09'],
  candidateSha256: crypto.createHash('sha256').update(src).digest('hex'),
  candidateSha256Raw: crypto.createHash('sha256').update(srcRaw).digest('hex'),
  lineEndings: srcRaw.includes('\r\n') ? 'CRLF-on-disk' : 'LF',
  results
};

fs.writeFileSync(path.join(out, 'phase-2-results.json'), JSON.stringify(summary, null, 2) + '\n');
console.log('\n=== Gate G2 Checks Completed ===');
console.log(`Passed: ${summary.testsPassed}, Failed: ${summary.testsFailed}`);
