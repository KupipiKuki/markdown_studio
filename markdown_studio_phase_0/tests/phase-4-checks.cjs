// Phase 4 verification tests for Markdown Studio remediation
// Scope: Gate G4 - Insertion commands & control sweep (R10, R11, R12)

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const crypto = require('crypto');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'evidence/phase-4');
fs.mkdirSync(out, { recursive: true });

const workingPath = path.join(root, 'working/markdown_studio.html');
const srcRaw = fs.readFileSync(workingPath, 'utf8');
const src = srcRaw.replace(/\r\n/g, '\n');

const results = [];

function record(id, issues, name, procedure, observation, status = 'pass') {
  results.push({
    id,
    issues,
    gate: 'G4',
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

console.log('=== Starting Phase 4 Verification Suite ===\n');

(async () => {
// -----------------------------------------------------------------------------
// Test 1: P4-01 wrapSelection & Snippet Insertion on Empty Selection (R10)
// -----------------------------------------------------------------------------
try {
  const insertSnippetFn = section('function insertSnippet(snippet) {', 'function wrapSelection(before, after) {');
  const wrapSelectionFn = section('function wrapSelection(before, after) {', 'function prependLines(prefix) {');

  function makeEditor(initialText, caretPos) {
    return {
      value: initialText,
      selectionStart: caretPos,
      selectionEnd: caretPos,
      focus() {},
      dispatchEvent() {}
    };
  }

  // 1a: Divider snippet with empty selection
  const editorA = makeEditor('Prefix content\n\nSuffix content', 16);
  const ctxA = { editorEl: editorA, Event: class {} };
  vm.createContext(ctxA);
  vm.runInContext(insertSnippetFn, ctxA);
  vm.runInContext(wrapSelectionFn, ctxA);

  vm.runInContext("wrapSelection('\\n\\n---\\n\\n', '')", ctxA);
  assert(!editorA.value.includes('text'), 'wrapSelection with empty selection must NOT add trailing "text"');
  assert.strictEqual(editorA.value, 'Prefix content\n\n\n\n---\n\nSuffix content');

  // 1b: Code wrapper with empty selection
  const editorB = makeEditor('Some sample here', 5);
  const ctxB = { editorEl: editorB, Event: class {} };
  vm.createContext(ctxB);
  vm.runInContext(wrapSelectionFn, ctxB);
  vm.runInContext("wrapSelection('`', '`')", ctxB);
  assert(!editorB.value.includes('text'), 'Inline code wrapper must not insert "text"');
  assert.strictEqual(editorB.value, 'Some ``sample here');
  assert.strictEqual(editorB.selectionStart, 6, 'Caret must be placed between the backticks');

  // 1c: Math wrapper with empty selection
  const editorC = makeEditor('Math: ', 6);
  const ctxC = { editorEl: editorC, Event: class {} };
  vm.createContext(ctxC);
  vm.runInContext(wrapSelectionFn, ctxC);
  vm.runInContext("wrapSelection('$$\\n', '\\n$$')", ctxC);
  assert(!editorC.value.includes('text'), 'Math block wrapper must not insert "text"');
  assert.strictEqual(editorC.value, 'Math: $$\n\n$$');

  // 1d: Link wrapper with empty selection
  const editorD = makeEditor('Visit: ', 7);
  const ctxD = { editorEl: editorD, Event: class {} };
  vm.createContext(ctxD);
  vm.runInContext(wrapSelectionFn, ctxD);
  vm.runInContext("wrapSelection('[', '](https://example.com)')", ctxD);
  assert(!editorD.value.includes('text'), 'Link wrapper must not insert "text"');
  assert.strictEqual(editorD.value, 'Visit: [](https://example.com)');
  assert.strictEqual(editorD.selectionStart, 8, 'Caret must be inside the brackets');

  // 1e: Table snippet
  const tableMd = '\n| Header 1 | Header 2 |\n| --- | --- |\n| Cell 1,1 | Cell 1,2 |\n\n';
  const editorE = makeEditor('# Title\n', 8);
  const ctxE = { editorEl: editorE, Event: class {} };
  vm.createContext(ctxE);
  vm.runInContext(insertSnippetFn, ctxE);
  vm.runInContext(`insertSnippet(${JSON.stringify(tableMd)})`, ctxE);
  assert(!editorE.value.includes('text'), 'Table insertion must not insert "text"');
  assert.strictEqual(editorE.value, '# Title\n' + tableMd);

  record('P4-01', ['R10'], 'wrapSelection & Snippet Insertion on Empty Selection',
    'Verify empty-selection wrapSelection and insertSnippet for divider, code, math, link, and table without stray placeholder "text".',
    {
      dividerNoText: !editorA.value.includes('text'),
      codeCaretInside: editorB.selectionStart === 6,
      mathNoText: !editorC.value.includes('text'),
      linkNoText: !editorD.value.includes('text'),
      tableNoText: !editorE.value.includes('text')
    }
  );
  console.log('✓ P4-01: wrapSelection & Snippet Insertion on Empty Selection passed.');
} catch (err) {
  console.error('✗ P4-01 failed:', err);
  record('P4-01', ['R10'], 'wrapSelection & Snippet Insertion on Empty Selection', '', { error: err.message }, 'fail');
}

// -----------------------------------------------------------------------------
// Test 2: P4-02 Image Markdown Generation with Real URL Only (R11)
// -----------------------------------------------------------------------------
try {
  const insertSnippetFn = section('function insertSnippet(snippet) {', 'function wrapSelection(before, after) {');
  const imageHandlerSnippet = section("case 'image':", "break;");

  // Case 2a: Empty selection with synthetic image URL
  const editorA = {
    value: '',
    selectionStart: 0,
    selectionEnd: 0,
    focus() {},
    dispatchEvent() {}
  };
  const ctxA = {
    editorEl: editorA,
    Event: class {},
    prompt: () => 'https://example.test/image.png'
  };
  vm.createContext(ctxA);
  vm.runInContext(insertSnippetFn, ctxA);
  vm.runInContext(`switch ('image') { ${imageHandlerSnippet} }`, ctxA);

  assert.strictEqual(editorA.value, '![Alt text](https://example.test/image.png)',
    'Empty-selection image insertion must produce exact ![Alt text](url)');
  assert(!editorA.value.includes('texthttps://'), 'Must not concatenate fallback "text" into the image URL');

  // Case 2b: Non-empty selection with selected alt text
  const editorB = {
    value: 'A diagram of the system here.',
    selectionStart: 2,
    selectionEnd: 23, // 'diagram of the system'
    focus() {},
    dispatchEvent() {}
  };
  const ctxB = {
    editorEl: editorB,
    Event: class {},
    prompt: () => 'https://example.test/arch.svg'
  };
  vm.createContext(ctxB);
  vm.runInContext(insertSnippetFn, ctxB);
  vm.runInContext(`switch ('image') { ${imageHandlerSnippet} }`, ctxB);

  assert.strictEqual(editorB.value, 'A ![diagram of the system](https://example.test/arch.svg) here.',
    'Non-empty selection must wrap the selected text as the image alt text');

  record('P4-02', ['R11'], 'Image Markdown Destination Generation',
    'Verify that image generation produces exact ![Alt text](url) without fallback "text" concatenated into destination URL.',
    {
      emptySelectionResult: editorA.value,
      nonEmptySelectionResult: editorB.value,
      cleanDestination: !editorA.value.includes('texthttps://')
    }
  );
  console.log('✓ P4-02: Image Markdown Destination Generation passed.');
} catch (err) {
  console.error('✗ P4-02 failed:', err);
  record('P4-02', ['R11'], 'Image Markdown Destination Generation', '', { error: err.message }, 'fail');
}

// -----------------------------------------------------------------------------
// Test 3: P4-03 Nonempty Selection Wrapping (Bold, Italic, Strike, Code)
// -----------------------------------------------------------------------------
try {
  const wrapSelectionFn = section('function wrapSelection(before, after) {', 'function prependLines(prefix) {');

  const editor = {
    value: 'The quick brown fox jumps',
    selectionStart: 10,
    selectionEnd: 15, // 'brown'
    focus() {},
    dispatchEvent() {}
  };
  const ctx = { editorEl: editor, Event: class {} };
  vm.createContext(ctx);
  vm.runInContext(wrapSelectionFn, ctx);

  // Bold
  vm.runInContext("wrapSelection('**', '**')", ctx);
  assert.strictEqual(editor.value, 'The quick **brown** fox jumps');
  assert.strictEqual(editor.selectionStart, 12);
  assert.strictEqual(editor.selectionEnd, 17, 'Selected text must remain selected inside bold markers');

  // Italic on 'quick'
  editor.selectionStart = 4;
  editor.selectionEnd = 9;
  vm.runInContext("wrapSelection('*', '*')", ctx);
  assert.strictEqual(editor.value, 'The *quick* **brown** fox jumps');

  // Code on 'fox'
  const foxStart = editor.value.indexOf('fox');
  editor.selectionStart = foxStart;
  editor.selectionEnd = foxStart + 3;
  vm.runInContext("wrapSelection('`', '`')", ctx);
  assert.strictEqual(editor.value, 'The *quick* **brown** `fox` jumps');

  record('P4-03', ['R10'], 'Nonempty Selection Formatting Wrapping',
    'Verify that wrapSelection correctly wraps selected text with markers and maintains active selection range.',
    {
      finalText: editor.value,
      wrappingPreserved: editor.value === 'The *quick* **brown** `fox` jumps'
    }
  );
  console.log('✓ P4-03: Nonempty Selection Formatting Wrapping passed.');
} catch (err) {
  console.error('✗ P4-03 failed:', err);
  record('P4-03', ['R10'], 'Nonempty Selection Formatting Wrapping', '', { error: err.message }, 'fail');
}

// -----------------------------------------------------------------------------
// Test 4: P4-04 Studio Palette data-insert Escape Decoding (R12 - C091)
// -----------------------------------------------------------------------------
try {
  const paletteClickSection = section(
    "document.querySelectorAll('#builderSidebar .palette-btn').forEach(btn => {",
    "// Clean Code Indentation"
  );

  const builderCodeInput = {
    value: 'flowchart TD\n',
    selectionStart: 13,
    selectionEnd: 13,
    focus() {}
  };

  const renderedEvents = [];
  const ctx = {
    builderCodeInput,
    renderBuilderDiagram: () => renderedEvents.push('render'),
    document: {
      querySelectorAll: (sel) => {
        if (sel === '#builderSidebar .palette-btn') {
          return [
            {
              dataset: {
                insert: '\\n  subgraph ClusterName [Group Title]\\n    node1\\n    node2\\n  end\\n'
              },
              addEventListener: (evt, handler) => { ctx._handler = handler; }
            }
          ];
        }
        return [];
      }
    }
  };

  vm.createContext(ctx);
  vm.runInContext(paletteClickSection, ctx);

  assert(typeof ctx._handler === 'function', 'Palette click handler must be bound');
  ctx._handler();

  const inserted = builderCodeInput.value.slice(13);
  const literalBackslashNCount = (inserted.match(/\\n/g) || []).length;
  const actualNewlines = (inserted.match(/\n/g) || []).length;

  assert.strictEqual(literalBackslashNCount, 0, 'Decoded snippet must contain 0 literal \\n escape sequences');
  assert(actualNewlines >= 4, `Decoded snippet must contain real newlines (found ${actualNewlines})`);
  assert(inserted.includes('subgraph ClusterName [Group Title]'), 'Must insert subgraph definition');
  assert(inserted.includes('end'), 'Must insert subgraph end');

  record('P4-04', ['R12'], 'Studio Palette data-insert Escape Decoding',
    'Verify that clicking Subgraph Box (C091) decodes \\n escapes into real newline characters in builder code input.',
    {
      insertedSnippet: inserted,
      literalBackslashNCount,
      actualNewlines,
      r12Remediated: literalBackslashNCount === 0 && actualNewlines >= 4
    }
  );
  console.log('✓ P4-04: Studio Palette data-insert Escape Decoding passed.');
} catch (err) {
  console.error('✗ P4-04 failed:', err);
  record('P4-04', ['R12'], 'Studio Palette data-insert Escape Decoding', '', { error: err.message }, 'fail');
}

// -----------------------------------------------------------------------------
// Test 5: P4-05 Snippet Insertion Replaces Selection Without Placeholder
// -----------------------------------------------------------------------------
try {
  const insertSnippetFn = section('function insertSnippet(snippet) {', 'function wrapSelection(before, after) {');

  // Case 5a: Replace middle selection with multi-line snippet
  const editorA = {
    value: 'Header Line\n[TARGET_TO_REPLACE]\nFooter Line',
    selectionStart: 12,
    selectionEnd: 31,
    focus() {},
    dispatchEvent() {}
  };
  const ctxA = { editorEl: editorA, Event: class {} };
  vm.createContext(ctxA);
  vm.runInContext(insertSnippetFn, ctxA);

  const newBlock = '```mermaid\nflowchart TD\n  A --> B\n```';
  vm.runInContext(`insertSnippet(${JSON.stringify(newBlock)})`, ctxA);

  assert.strictEqual(editorA.value, `Header Line\n${newBlock}\nFooter Line`);
  assert(!editorA.value.includes('[TARGET_TO_REPLACE]'), 'Selected text must be fully replaced');
  assert(!editorA.value.includes('text'), 'No stray placeholder "text" in snippet replacement');

  // Case 5b: Replace selection with horizontal rule
  const editorB = {
    value: 'Section 1\nDELETE_ME\nSection 2',
    selectionStart: 10,
    selectionEnd: 19,
    focus() {},
    dispatchEvent() {}
  };
  const ctxB = { editorEl: editorB, Event: class {} };
  vm.createContext(ctxB);
  vm.runInContext(insertSnippetFn, ctxB);

  vm.runInContext("insertSnippet('\\n\\n---\\n\\n')", ctxB);
  assert.strictEqual(editorB.value, 'Section 1\n\n\n---\n\n\nSection 2');
  assert(!editorB.value.includes('DELETE_ME'));

  record('P4-05', ['R10'], 'Snippet Insertion Replaces Selection Without Placeholder',
    'Verify that insertSnippet replaces active selection cleanly with snippet content preserving surrounding text.',
    {
      blockReplaced: editorA.value === `Header Line\n${newBlock}\nFooter Line`,
      dividerReplaced: editorB.value === 'Section 1\n\n\n---\n\n\nSection 2'
    }
  );
  console.log('✓ P4-05: Snippet Insertion Replaces Selection Without Placeholder passed.');
} catch (err) {
  console.error('✗ P4-05 failed:', err);
  record('P4-05', ['R10'], 'Snippet Insertion Replaces Selection Without Placeholder', '', { error: err.message }, 'fail');
}

// -----------------------------------------------------------------------------
// Test 6: P4-06 Shortcut Guard While Focused in Studio or Input Fields
// -----------------------------------------------------------------------------
try {
  const keydownSection = section(
    "document.addEventListener('keydown', (e) => {",
    "// --------------------------------------------------------------------------\n  // Toast Notification Helper"
  );

  const editorEl = {
    value: 'Original pristine document content.',
    selectionStart: 9,
    selectionEnd: 17,
    focus() {},
    dispatchEvent() {}
  };

  let studioOpen = false;
  let activeElement = null;
  let studioClosed = false;

  const ctx = {
    editorEl,
    Event: class {},
    wrapSelection: (before, after) => {
      editorEl.value = 'MUTATED';
    },
    toggleEditor: () => {},
    toggleViewer: () => {},
    showSplitView: () => {},
    toggleFindBar: () => {},
    addTab: () => {},
    closeStudio: () => { studioClosed = true; },
    findBar: { classList: { remove() {} } },
    toggleErrorLog: () => {},
    document: {
      get activeElement() { return activeElement; },
      getElementById: (id) => {
        if (id === 'studioModal') {
          return { classList: { contains: (c) => c === 'open' && studioOpen } };
        }
        return { classList: { remove() {} }, click() {} };
      },
      querySelector: () => ({ click() {} }),
      addEventListener: (evt, handler) => { ctx._keydownHandler = handler; }
    }
  };

  vm.createContext(ctx);
  vm.runInContext(keydownSection, ctx);

  assert(typeof ctx._keydownHandler === 'function', 'Keydown handler must be bound');

  // Case 6a: Focused in Studio builderCodeInput with studio open
  studioOpen = true;
  activeElement = { tagName: 'TEXTAREA', id: 'builderCodeInput' };

  let prevented = false;
  ctx._keydownHandler({
    ctrlKey: true,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    key: 'b',
    preventDefault: () => { prevented = true; }
  });
  assert.strictEqual(editorEl.value, 'Original pristine document content.',
    'Ctrl+B while in Studio must NOT mutate document editor');

  ctx._keydownHandler({
    ctrlKey: true,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    key: 'i',
    preventDefault: () => { prevented = true; }
  });
  assert.strictEqual(editorEl.value, 'Original pristine document content.',
    'Ctrl+I while in Studio must NOT mutate document editor');

  ctx._keydownHandler({
    ctrlKey: true,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    key: 'k',
    preventDefault: () => { prevented = true; }
  });
  assert.strictEqual(editorEl.value, 'Original pristine document content.',
    'Ctrl+K while in Studio must NOT trigger link insertion on document');

  // Case 6b: Focused in Find Bar input (#findInput)
  studioOpen = false;
  activeElement = { tagName: 'INPUT', id: 'findInput' };

  ctx._keydownHandler({
    ctrlKey: true,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    key: 'b',
    preventDefault: () => { prevented = true; }
  });
  assert.strictEqual(editorEl.value, 'Original pristine document content.',
    'Ctrl+B while typing in Find input must NOT mutate document editor');

  // Case 6c: Focused in editorEl (shortcuts work)
  activeElement = editorEl;
  ctx._keydownHandler({
    ctrlKey: true,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    key: 'b',
    preventDefault: () => { prevented = true; }
  });
  assert.strictEqual(editorEl.value, 'MUTATED',
    'Ctrl+B while focused in editorEl must execute formatting shortcut');

  // Case 6d: Escape dismisses Studio
  studioClosed = false;
  ctx._keydownHandler({
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    key: 'Escape',
    preventDefault: () => {}
  });
  assert(studioClosed, 'Escape must call closeStudio()');

  record('P4-06', ['R10'], 'Editor Shortcut Guard in Studio & Inputs',
    'Verify that Ctrl+B, Ctrl+I, Ctrl+K do not mutate document while focused in Studio or other inputs, and Escape dismisses overlays.',
    {
      studioProtected: true,
      findInputProtected: true,
      editorShortcutAllowed: true,
      escapeDismisses: studioClosed
    }
  );
  console.log('✓ P4-06: Editor Shortcut Guard in Studio & Inputs passed.');
} catch (err) {
  console.error('✗ P4-06 failed:', err);
  record('P4-06', ['R10'], 'Editor Shortcut Guard in Studio & Inputs', '', { error: err.message }, 'fail');
}

// -----------------------------------------------------------------------------
// Write Results
// -----------------------------------------------------------------------------
const rawDisk = crypto.createHash('sha256').update(srcRaw).digest('hex');
const lfNorm = crypto.createHash('sha256').update(src).digest('hex');

const manifest = {
  suite: 'Phase 4 Verification (Gate G4)',
  timestamp: new Date().toISOString(),
  candidateSha256Raw: rawDisk,
  candidateSha256Lf: lfNorm,
  testsPassed: results.filter(r => r.status === 'pass').length,
  testsFailed: results.filter(r => r.status === 'fail').length,
  results
};

fs.writeFileSync(path.join(out, 'phase-4-results.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');

console.log(`\n=== Gate G4 Checks Completed: ${manifest.testsPassed} Passed, ${manifest.testsFailed} Failed ===`);
if (manifest.testsFailed > 0) process.exit(1);
})();
