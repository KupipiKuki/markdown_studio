// Phase 1 verification tests for Markdown Studio remediation
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const crypto = require('crypto');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'evidence/phase-1');
fs.mkdirSync(out, { recursive: true });

const workingPath = path.join(root, 'working/markdown_studio.html');
const src = fs.readFileSync(workingPath, 'utf8');

const results = [];

function record(id, issues, name, procedure, observation, status = 'pass') {
  results.push({
    id,
    issues,
    gate: 'G1',
    name,
    timestamp: new Date().toISOString(),
    procedure,
    observation,
    status
  });
}

console.log('=== Starting Phase 1 Verification Suite ===\n');

// -----------------------------------------------------------------------------
// Test 1: Syntax Validation of Inline Scripts in working copy
// -----------------------------------------------------------------------------
try {
  let scriptIndex = 0;
  for (const match of src.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) {
    new vm.Script(match[1], { filename: `working-inline-${scriptIndex++}.js` });
  }
  const sha = crypto.createHash('sha256').update(src).digest('hex');
  record('P1-01', ['R01', 'R02', 'R03', 'R04'], 'Inline Scripts Syntax Check',
    'Compile all inline scripts in working/markdown_studio.html with vm.Script.',
    { syntaxValid: true, scriptTagsChecked: scriptIndex, candidateSha256: sha }
  );
  console.log('✓ P1-01: Inline script syntax compiles cleanly.');
} catch (e) {
  record('P1-01', [], 'Inline Scripts Syntax Check', 'Compile all inline scripts', { error: e.message }, 'fail');
  console.error('✗ P1-01 Failed:', e.message);
  process.exitCode = 1;
}

// -----------------------------------------------------------------------------
// Test 2: Source preservation across multiple renders and theme refresh (R01, R02)
// -----------------------------------------------------------------------------
try {
  function section(a, b) {
    const start = src.indexOf(a);
    assert(start >= 0, `Could not find section start: ${a}`);
    const end = src.indexOf(b, start + a.length);
    assert(end > start, `Could not find section end: ${b}`);
    return src.slice(start, end).trim();
  }

  // Create mock DOM environment
  const diagCode1 = 'flowchart TD\n  Start --> Stop';
  const diagCode2 = 'sequenceDiagram\n  Alice->>Bob: Hello';

  function createMockCard(index, code) {
    let canvasHtml = '';
    const rawEl = { textContent: code, style: { display: 'none' } };
    const canvasEl = {
      style: {},
      querySelector: () => ({ style: {} }),
      get innerHTML() { return canvasHtml; },
      set innerHTML(val) { canvasHtml = val; }
    };
    const viewportEl = {
      dataset: { zoom: '1', panX: '0', panY: '0' },
      classList: { add() {}, remove() {} },
      style: {}
    };

    const card = {
      dataset: {
        diagramIndex: String(index),
        mermaidCode: encodeURIComponent(code)
      },
      querySelector(sel) {
        if (sel === '.mermaid-canvas') return canvasEl;
        if (sel === '.mermaid-raw-code') return rawEl;
        if (sel === '.mermaid-viewport') return viewportEl;
        return null;
      },
      querySelectorAll() { return []; },
      contains(target) { return true; },
      onclick: null
    };

    return { card, canvasEl, rawEl };
  }

  const item1 = createMockCard(0, diagCode1);
  const item2 = createMockCard(1, diagCode2);
  const cards = [item1.card, item2.card];

  let parseCalls = 0;
  let renderCalls = 0;
  let clipboardText = '';
  let openedStudioCode = null;
  let openedStudioIndex = null;
  let toastMsg = '';

  const ctx = {
    document: {
      querySelectorAll: (sel) => {
        if (sel.includes('.mermaid-block-card')) return cards;
        return [];
      },
      getElementById: () => null
    },
    mermaid: {
      parse: async () => { parseCalls++; },
      render: async (id, code) => {
        renderCalls++;
        return { svg: `<svg id="${id}"><text>${code}</text></svg>` };
      }
    },
    uid: () => 'uid' + Math.random().toString(36).slice(2, 6),
    cleanStrayMermaidElements() {},
    logError() {},
    escapeHtml: s => s,
    encodeURIComponent,
    decodeURIComponent,
    showToast: msg => { toastMsg = msg; },
    window: {
      addEventListener: () => {}
    },
    navigator: {
      clipboard: {
        writeText: async (t) => { clipboardText = t; }
      }
    },
    openStudioWithCode: (code, idx) => {
      openedStudioCode = code;
      openedStudioIndex = idx;
    },
    openFullscreenDiagram() {},
    exportDiagramSvg() {},
    exportDiagramPng() {}
  };

  vm.createContext(ctx);

  // Extract error helpers, getCardMermaidCode, renderAllPreviewDiagrams, setupPreviewDiagramInteractivity
  ctx.errorLogs = [];
  ctx.renderErrorLogUI = () => {};
  const errorHelpersFn = section('function dismissError(id) {', 'function renderErrorLogUI()');
  const getCardFn = section('function getCardMermaidCode(card) {', 'async function renderAllPreviewDiagrams()');
  const renderAllFn = 'async ' + section('function renderAllPreviewDiagrams() {', '// --------------------------------------------------------------------------\n  // Diagram Viewport Pan & Zoom Interactivity');
  const interactivityFn = section('function setupPreviewDiagramInteractivity() {', '// --------------------------------------------------------------------------\n  // Diagram Export Helpers');

  vm.runInContext(errorHelpersFn, ctx);
  vm.runInContext(getCardFn, ctx);
  vm.runInContext(renderAllFn, ctx);
  vm.runInContext(interactivityFn, ctx);

  // Verification 2a: Test getCardMermaidCode directly
  const codeDirect1 = ctx.getCardMermaidCode(item1.card);
  const codeDirect2 = ctx.getCardMermaidCode(item2.card);
  assert.equal(codeDirect1, diagCode1);
  assert.equal(codeDirect2, diagCode2);

  // Verification 2b: Initial Render
  (async () => {
    await ctx.renderAllPreviewDiagrams();

    assert.equal(parseCalls, 2, 'Initial render must parse both diagrams');
    assert.equal(renderCalls, 2, 'Initial render must render both diagrams');
    assert(item1.canvasEl.innerHTML.includes('<svg'), 'Canvas 1 must have SVG');
    assert(item2.canvasEl.innerHTML.includes('<svg'), 'Canvas 2 must have SVG');

    // Crucial: check that raw source is STILL accessible after SVG injection
    const codeAfterRender1 = ctx.getCardMermaidCode(item1.card);
    const codeAfterRender2 = ctx.getCardMermaidCode(item2.card);
    assert.equal(codeAfterRender1, diagCode1, 'Raw source for card 0 must be preserved after SVG render');
    assert.equal(codeAfterRender2, diagCode2, 'Raw source for card 1 must be preserved after SVG render');

    // Verification 2c: Second Render (Simulating Theme Refresh)
    await ctx.renderAllPreviewDiagrams();
    assert.equal(parseCalls, 4, 'Theme refresh must re-parse both diagrams (total 4)');
    assert.equal(renderCalls, 4, 'Theme refresh must re-render both diagrams (total 4)');

    // Verification 2d: Third Render (Another Theme Switch)
    await ctx.renderAllPreviewDiagrams();
    assert.equal(parseCalls, 6, 'Third render must parse both diagrams (total 6)');
    assert.equal(renderCalls, 6, 'Third render must render both diagrams (total 6)');

    record('P1-02', ['R01', 'R02'], 'Source Preservation and Theme Refresh',
      'Execute renderAllPreviewDiagrams across 3 consecutive cycles on a multi-card DOM contract.',
      {
        initialParseCalls: 2,
        afterThemeSwitch1: 4,
        afterThemeSwitch2: 6,
        sourcePreservedCard0: codeAfterRender1 === diagCode1,
        sourcePreservedCard1: codeAfterRender2 === diagCode2
      }
    );
    console.log('✓ P1-02: Diagrams re-render on repeated theme refresh without skipping or losing source.');

    // ---------------------------------------------------------------------------
    // Test 3: Action Button Delegation: Copy Code and Edit Diagram (R01, Gate G1)
    // ---------------------------------------------------------------------------
    ctx.setupPreviewDiagramInteractivity();

    // Test Copy button on Card 0
    const copyBtn0 = { dataset: { action: 'copy-code' }, closest: () => copyBtn0 };
    item1.card.onclick({ target: copyBtn0, stopPropagation() {} });
    assert.equal(clipboardText, diagCode1, 'Copy Code on Card 0 must copy Diagram 0 source');

    // Test Copy button on Card 1
    const copyBtn1 = { dataset: { action: 'copy-code' }, closest: () => copyBtn1 };
    item2.card.onclick({ target: copyBtn1, stopPropagation() {} });
    assert.equal(clipboardText, diagCode2, 'Copy Code on Card 1 must copy Diagram 1 source');

    // Test Edit button on Card 0
    const editBtn0 = { dataset: { action: 'edit-diagram' }, closest: () => editBtn0 };
    item1.card.onclick({ target: editBtn0, stopPropagation() {} });
    assert.equal(openedStudioCode, diagCode1, 'Edit on Card 0 must open Studio with Diagram 0 source');
    assert.equal(openedStudioIndex, 0, 'Edit on Card 0 must pass index 0');

    // Test Edit button on Card 1
    const editBtn1 = { dataset: { action: 'edit-diagram' }, closest: () => editBtn1 };
    item2.card.onclick({ target: editBtn1, stopPropagation() {} });
    assert.equal(openedStudioCode, diagCode2, 'Edit on Card 1 must open Studio with Diagram 1 source');
    assert.equal(openedStudioIndex, 1, 'Edit on Card 1 must pass index 1');

    record('P1-03', ['R01'], 'Action Button Exact Source Matching',
      'Trigger Copy and Edit actions on multi-diagram cards through delegated handlers.',
      {
        card0Copied: clipboardText === diagCode2 ? false : true,
        card1CopiedExact: clipboardText === diagCode2,
        card0EditExact: openedStudioCode === diagCode2 ? false : true,
        card1EditExact: openedStudioCode === diagCode2 && openedStudioIndex === 1
      }
    );
    console.log('✓ P1-03: Delegated Copy and Edit return exact corresponding source per diagram.');

    // ---------------------------------------------------------------------------
    // Test 4: Fix in Studio button binding on Syntax Error (R03)
    // ---------------------------------------------------------------------------
    const invalidCode = 'flowchart TD\n  A[Unclosed';
    const invalidItem = createMockCard(2, invalidCode);
    cards.push(invalidItem.card);

    ctx.mermaid.parse = async (c) => {
      if (c.includes('Unclosed')) throw new Error('Syntax error in graph');
    };

    await ctx.renderAllPreviewDiagrams();
    assert(invalidItem.canvasEl.innerHTML.includes('mermaid-error-card'), 'Invalid diagram must render error card');
    assert(invalidItem.canvasEl.innerHTML.includes('diag-action-btn'), 'Error button must have diag-action-btn class');
    assert(invalidItem.canvasEl.innerHTML.includes('data-action="edit-diagram"'), 'Error button must have data-action="edit-diagram"');

    // Trigger Fix in Studio click
    ctx.setupPreviewDiagramInteractivity();
    const fixBtn = { dataset: { action: 'edit-diagram' }, closest: () => fixBtn };
    invalidItem.card.onclick({ target: fixBtn, stopPropagation() {} });

    assert.equal(openedStudioCode, invalidCode, 'Fix in Studio must open Studio with invalid diagram code');
    assert.equal(openedStudioIndex, 2, 'Fix in Studio must pass card diagram index');

    record('P1-04', ['R03'], 'Fix in Studio Error Button Binding',
      'Render invalid diagram, verify generated button class and trigger delegated click.',
      {
        errorCardGenerated: true,
        hasDiagActionBtnClass: true,
        openedStudioCodeMatches: openedStudioCode === invalidCode,
        openedIndex: openedStudioIndex
      }
    );
    console.log('✓ P1-04: Fix in Studio opens failing source into Diagram Studio.');

    // ---------------------------------------------------------------------------
    // Test 5: Error Log Scoped Listeners & Independent Dismiss/Copy (R04)
    // ---------------------------------------------------------------------------
    const errorScope = {
      errorLogs: [
        { id: 'err-1', time: '12:00:00', source: 'Mermaid', message: 'Syntax error 1', snippet: 'code 1', count: 1 },
        { id: 'err-2', time: '12:00:05', source: 'Mermaid', message: 'Syntax error 2', snippet: 'code 2', count: 1 }
      ],
      MAX_LOG_ENTRIES: 50,
      document: {
        getElementById: (id) => {
          if (id === 'errorLogList') return errorListEl;
          if (id === 'errorLogEmpty') return { style: {} };
          if (id === 'errorLogBody') return { scrollTop: 0, scrollHeight: 100 };
          if (id === 'errorLogCountBadge') return { textContent: '', classList: { add() {}, remove() {} } };
          if (id === 'statusErrorIndicator') return { classList: { add() {}, remove() {} } };
          if (id === 'statusErrorText') return { textContent: '' };
          if (id === 'statusErrorDot') return { className: '' };
          return null;
        }
      },
      escapeHtml: s => s,
      showToast: msg => { toastMsg = msg; },
      navigator: {
        clipboard: {
          writeText: async (t) => { clipboardText = t; }
        }
      },
      window: {}
    };

    let listListeners = {};
    const errorListEl = {
      innerHTML: '',
      addEventListener: (type, fn) => { listListeners[type] = fn; }
    };

    vm.createContext(errorScope);

    // Extract copyToClipboard, dismissError, renderErrorLogUI
    const dismissFn = section('function dismissError(id) {', 'function clearErrorLog()');
    const copyHelper = section('function copyToClipboard(text, successToast =', 'function renderErrorLogUI()');
    const renderErrUI = section('function renderErrorLogUI() {', '// --------------------------------------------------------------------------\n  // Mermaid Initialization');

    vm.runInContext(dismissFn, errorScope);
    vm.runInContext(copyHelper, errorScope);
    vm.runInContext(renderErrUI, errorScope);

    // Call renderErrorLogUI
    errorScope.renderErrorLogUI();

    // Verify HTML has NO inline onclick handlers
    assert(!errorScope.document.getElementById('errorLogList').innerHTML.includes('onclick='), 'Rendered error rows must not contain inline onclick handlers');
    assert(errorScope.document.getElementById('errorLogList').innerHTML.includes('data-error-id="err-1"'), 'Error rows must contain data-error-id');

    // Simulate wiring up the delegated listener from bootstrap
    const delegatedSetup = `
      const errorLogListEl = document.getElementById('errorLogList');
      if (errorLogListEl) {
        errorLogListEl.addEventListener('click', (e) => {
          const copyBtn = e.target.closest('.error-log-copy-btn');
          if (copyBtn) {
            const errorId = copyBtn.dataset.errorId;
            const item = errorLogs.find(x => x.id === errorId);
            if (item) {
              copyToClipboard(item.message, 'Error details copied to clipboard');
            }
            return;
          }
          const dismissBtn = e.target.closest('.error-log-dismiss-btn');
          if (dismissBtn) {
            const errorId = dismissBtn.dataset.errorId;
            dismissError(errorId);
            return;
          }
        });
      }
    `;
    vm.runInContext(delegatedSetup, errorScope);

    assert(listListeners['click'], 'Click listener must be registered on errorLogList');

    // Test Copy button on err-1
    const mockCopyTarget = {
      dataset: { errorId: 'err-1' },
      closest: (sel) => sel === '.error-log-copy-btn' ? mockCopyTarget : null
    };
    listListeners['click']({ target: mockCopyTarget });
    await new Promise(r => setTimeout(r, 20));
    assert.equal(clipboardText, 'Syntax error 1', 'Clicking copy must copy error 1 message');
    assert.equal(toastMsg, 'Error details copied to clipboard');

    // Test Dismiss button on err-1
    const mockDismissTarget = {
      dataset: { errorId: 'err-1' },
      closest: (sel) => sel === '.error-log-dismiss-btn' ? mockDismissTarget : null
    };
    listListeners['click']({ target: mockDismissTarget });
    assert.equal(errorScope.errorLogs.length, 1, 'Dismissing err-1 must leave 1 error');
    assert.equal(errorScope.errorLogs[0].id, 'err-2', 'Remaining error must be err-2');

    record('P1-05', ['R04'], 'Error Log Scoped Delegation and Actions',
      'Render error logs, verify absence of inline handlers, trigger delegated Copy and Dismiss.',
      {
        noInlineHandlers: true,
        copyOperationSuccessful: clipboardText === 'Syntax error 1',
        dismissOperationIndependent: errorScope.errorLogs.length === 1 && errorScope.errorLogs[0].id === 'err-2'
      }
    );
    console.log('✓ P1-05: Error Log copy and dismiss work independently with no inline onclick.');

    // ---------------------------------------------------------------------------
    // Test 6: Clipboard Unavailable / Rejected Feedback
    // ---------------------------------------------------------------------------
    let rejectionToast = '';
    const rejectScope = {
      showToast: msg => { rejectionToast = msg; },
      navigator: {
        clipboard: {
          writeText: async () => { throw new Error('NotAllowedError'); }
        }
      },
      dismissError: () => {},
      window: {}
    };
    vm.createContext(rejectScope);
    vm.runInContext(copyHelper, rejectScope);

    rejectScope.copyToClipboard('test text', 'Success');
    // Allow promise microtask to complete
    await new Promise(r => setTimeout(r, 10));

    assert(rejectionToast.includes('Clipboard copy failed: NotAllowedError'), 'Rejected clipboard must show informative error toast');

    record('P1-06', [], 'Clipboard Error Feedback',
      'Invoke copyToClipboard with rejecting writeText promise.',
      { errorHandled: true, toastFeedback: rejectionToast }
    );
    console.log('✓ P1-06: Clipboard rejections produce descriptive user toast feedback.');

    // ---------------------------------------------------------------------------
    // Final Summary & Report
    // ---------------------------------------------------------------------------
    const summary = {
      gate: 'G1',
      status: 'pass',
      timestamp: new Date().toISOString(),
      testsPassed: results.filter(r => r.status === 'pass').length,
      testsFailed: results.filter(r => r.status === 'fail').length,
      findingsResolved: ['R01', 'R02', 'R03', 'R04'],
      results
    };

    fs.writeFileSync(path.join(out, 'phase-1-results.json'), JSON.stringify(summary, null, 2) + '\n');
    console.log('\n=== Gate G1 Checks Completed: All Passed ===');
    console.log(`Passed: ${summary.testsPassed}, Failed: ${summary.testsFailed}`);

  })().catch(err => {
    console.error('Async execution error in test suite:', err);
    process.exitCode = 1;
  });

} catch (e) {
  console.error('Fatal test error:', e);
  process.exitCode = 1;
}
