// Phase 5 verification tests for Markdown Studio remediation
// Scope: Gate G5 - Export determinism & diagnosable failures (R13, R14)

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const crypto = require('crypto');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'evidence/phase-5');
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
    gate: 'G5',
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

function createDeferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

console.log('=== Starting Phase 5 Verification Suite ===\n');

(async () => {
// -----------------------------------------------------------------------------
// Test 1: P5-01 Export waits for in-flight render generation (R13)
// -----------------------------------------------------------------------------
try {
  const getCardFn = section('function getCardMermaidCode(card) {', 'async function renderAllPreviewDiagrams()');
  const renderAllFn = section('async function renderAllPreviewDiagrams() {', '// --------------------------------------------------------------------------\n  // Diagram Viewport Pan & Zoom Interactivity');
  const cleanExportSection = section('// --------------------------------------------------------------------------\n  // Clean Document & Export Determinism Helpers', '// Export as standalone HTML');

  let canvasHtml = '';
  const canvasEl = {
    style: {},
    get innerHTML() { return canvasHtml; },
    set innerHTML(val) { canvasHtml = val; },
    querySelector: () => ({ style: {} })
  };
  const cardEl = {
    dataset: { diagramIndex: '0', mermaidCode: encodeURIComponent('flowchart TD\n  DeferredNode') },
    querySelector: (s) => (s === '.mermaid-canvas' ? canvasEl : null),
    isConnected: true,
    ownerDocument: { contains: () => true }
  };

  const renderDeferred = createDeferred();
  const mockMermaid = {
    parse: async () => {},
    render: async () => renderDeferred.promise
  };

  let toasts = [];
  const p5Ctx = {
    mermaid: mockMermaid,
    document: {
      querySelectorAll: (sel) => (sel.includes('.mermaid-block-card') ? [cardEl] : []),
      getElementById: () => null,
      contains: () => true
    },
    uid: () => 'uid123',
    cleanStrayMermaidElements: () => {},
    logError: () => {},
    escapeHtml: (s) => s,
    encodeURIComponent,
    decodeURIComponent,
    setupPreviewDiagramInteractivity: () => {},
    getActiveTab: () => ({ id: 'tab-1', content: '```mermaid\nflowchart TD\n  DeferredNode\n```' }),
    initMermaid: () => {},
    showToast: (m) => toasts.push(m),
    renderDebounceTimer: null
  };

  vm.createContext(p5Ctx);
  vm.runInContext(getCardFn, p5Ctx);
  vm.runInContext(renderAllFn, p5Ctx);
  vm.runInContext(cleanExportSection, p5Ctx);

  // Trigger renderAllPreviewDiagrams (starts async in-flight render)
  const renderPromise = p5Ctx.renderAllPreviewDiagrams();

  // Export starts while render is in flight
  let exportCompleted = false;
  const readyPromise = p5Ctx.ensurePreviewRenderReady().then(() => {
    exportCompleted = true;
  });

  const tick = () => new Promise(r => setTimeout(r, 20));
  await tick();

  // ensurePreviewRenderReady MUST be awaiting in-flight render
  assert.strictEqual(exportCompleted, false, 'ensurePreviewRenderReady must not complete before in-flight render resolves');
  assert.strictEqual(canvasEl.innerHTML, '', 'Canvas must not be committed before render finishes');

  // Resolve deferred render
  renderDeferred.resolve({ svg: '<svg id="deferred-svg"><text>DeferredNode</text></svg>' });
  await readyPromise;
  await renderPromise;

  assert.strictEqual(exportCompleted, true, 'ensurePreviewRenderReady must complete after render resolves');
  assert.strictEqual(canvasEl.innerHTML, '<svg id="deferred-svg"><text>DeferredNode</text></svg>', 'Canvas must contain resolved SVG');

  record('P5-01', ['R13'], 'Export Awaits In-Flight Render Generation',
    'Verify that ensurePreviewRenderReady blocks HTML export / copy until active Mermaid rendering finishes.',
    {
      inFlightAwaited: true,
      committedAfterResolve: true,
      canvasSvgId: 'deferred-svg'
    }
  );
  console.log('✓ P5-01: Export Awaits In-Flight Render Generation passed.');
} catch (err) {
  console.error('✗ P5-01 failed:', err);
  record('P5-01', ['R13'], 'Export Awaits In-Flight Render Generation', '', { error: err.message }, 'fail');
}

// -----------------------------------------------------------------------------
// Test 2: P5-02 Mid-await document change triggers refresh & retry (R13)
// -----------------------------------------------------------------------------
try {
  const getCardFn = section('function getCardMermaidCode(card) {', 'async function renderAllPreviewDiagrams()');
  const renderAllFn = section('async function renderAllPreviewDiagrams() {', '// --------------------------------------------------------------------------\n  // Diagram Viewport Pan & Zoom Interactivity');
  const updatePreviewFn = section('function updatePreview() {', 'function renderAll() {');
  const cleanExportSection = section('// --------------------------------------------------------------------------\n  // Clean Document & Export Determinism Helpers', '// Export as standalone HTML');

  let canvasHtml = '';
  const canvasEl = {
    style: {},
    get innerHTML() { return canvasHtml; },
    set innerHTML(val) { canvasHtml = val; },
    querySelector: () => ({ style: {} })
  };
  const cardEl = {
    dataset: { diagramIndex: '0', mermaidCode: encodeURIComponent('flowchart TD\n  V1') },
    querySelector: (s) => (s === '.mermaid-canvas' ? canvasEl : null),
    isConnected: true,
    ownerDocument: { contains: () => true }
  };

  const deferredV1 = createDeferred();
  const deferredV2 = createDeferred();
  let renderCallCount = 0;

  const mockMermaid = {
    parse: async () => {},
    render: async (id, code) => {
      renderCallCount++;
      if (code.includes('V1')) return deferredV1.promise;
      return deferredV2.promise;
    }
  };

  let activeDoc = { id: 'tab-1', name: 'doc.md', content: '```mermaid\nflowchart TD\n  V1\n```' };
  let previewContentEl = {
    innerHTML: '',
    querySelectorAll: () => []
  };

  const p5Ctx = {
    window: {},
    clearTimeout,
    setTimeout,
    mermaid: mockMermaid,
    document: {
      querySelectorAll: (sel) => (sel.includes('.mermaid-block-card') ? [cardEl] : []),
      getElementById: (id) => (id === 'previewContent' ? previewContentEl : null),
      contains: () => true
    },
    uid: () => 'uid' + Math.random().toString(36).slice(2, 6),
    cleanStrayMermaidElements: () => {},
    logError: () => {},
    escapeHtml: (s) => s,
    encodeURIComponent,
    decodeURIComponent,
    setupPreviewDiagramInteractivity: () => {},
    getActiveTab: () => activeDoc,
    initMermaid: () => {},
    extractMath: (c) => ({ text: c, mathStore: [] }),
    marked: { parse: (t) => t },
    hljs: { highlightElement: () => {} },
    updateTableOfContents: () => {},
    renderDebounceTimer: null,
    showToast: () => {}
  };

  vm.createContext(p5Ctx);
  vm.runInContext(getCardFn, p5Ctx);
  vm.runInContext(renderAllFn, p5Ctx);
  vm.runInContext(updatePreviewFn, p5Ctx);
  vm.runInContext(cleanExportSection, p5Ctx);

  // Initial updatePreview with V1
  p5Ctx.updatePreview();
  // Clear debounce timer and invoke render to put V1 in-flight
  clearTimeout(p5Ctx.renderDebounceTimer);
  p5Ctx.renderDebounceTimer = null;
  p5Ctx.renderAllPreviewDiagrams();

  const tick = () => new Promise(r => setTimeout(r, 20));
  await tick();
  assert.strictEqual(renderCallCount, 1, 'V1 render should be initiated');

  // ensurePreviewRenderReady begins awaiting V1
  let readyDone = false;
  const readyPromise = p5Ctx.ensurePreviewRenderReady().then(() => {
    readyDone = true;
  });

  // Mid-await: document content changes to V2
  activeDoc.content = '```mermaid\nflowchart TD\n  V2\n```';
  cardEl.dataset.mermaidCode = encodeURIComponent('flowchart TD\n  V2');

  // Resolve V1 (stale)
  deferredV1.resolve({ svg: '<svg id="stale-v1">V1</svg>' });
  await tick();

  // ensurePreviewRenderReady must detect content change, refresh, and await V2
  assert.strictEqual(readyDone, false, 'ensurePreviewRenderReady must not return stale V1; must retry for V2');

  // Resolve V2
  deferredV2.resolve({ svg: '<svg id="fresh-v2">V2</svg>' });
  await readyPromise;
  assert.strictEqual(readyDone, true, 'ensurePreviewRenderReady must resolve once V2 finishes');
  assert.strictEqual(canvasEl.innerHTML, '<svg id="fresh-v2">V2</svg>', 'Canvas must contain fresh V2, not stale V1');

  // Finding A6-01 regression: test retry exhaustion path
  // Simulate continuous document edits occurring on each render completion, exhausting maxRetries (10)
  let editCount = 0;
  let loggedErrors = [];
  p5Ctx.logError = (msg) => loggedErrors.push(msg);
  let lastToast = '';
  p5Ctx.showToast = (msg) => { lastToast = msg; };

  p5Ctx.mermaid = {
    parse: async () => {},
    render: async () => {
      editCount++;
      activeDoc.content = `\`\`\`mermaid\nflowchart TD\n  Edit${editCount}\n\`\`\``;
      cardEl.dataset.mermaidCode = encodeURIComponent(`flowchart TD\n  Edit${editCount}`);
      return { svg: `<svg id="edit-${editCount}">Edit${editCount}</svg>` };
    }
  };

  // Trigger updatePreview to initiate debounced rendering
  p5Ctx.updatePreview();

  const exhaustionResult = await p5Ctx.ensurePreviewRenderReady();
  assert.strictEqual(exhaustionResult, false, 'ensurePreviewRenderReady must return false when retries are exhausted');
  assert.strictEqual(lastToast, 'Document rendering is still in progress. Please wait and retry.', 'Must surface clear retry toast');
  assert.strictEqual(loggedErrors.length > 0, true, 'Must log error on retry exhaustion');

  record('P5-02', ['R13'], 'Mid-Await Document Change Triggers Refresh & Retry',
    'Verify that document edits occurring during render await refresh generation and never silently export stale content, and retry exhaustion cleanly aborts with retry feedback.',
    {
      staleV1Ignored: true,
      freshV2Captured: true,
      finalCanvasSvg: 'fresh-v2',
      retryExhaustionHandled: true,
      retryFeedbackSurfaced: true,
      exportAbortedOnExhaustion: true
    }
  );
  console.log('✓ P5-02: Mid-Await Document Change Triggers Refresh & Retry passed.');
} catch (err) {
  console.error('✗ P5-02 failed:', err);
  record('P5-02', ['R13'], 'Mid-Await Document Change Triggers Refresh & Retry', '', { error: err.message }, 'fail');
}

// -----------------------------------------------------------------------------
// Test 3: P5-03 Clean document export (no error UI, transient controls, pan transforms)
// -----------------------------------------------------------------------------
try {
  const cleanExportSection = section('// --------------------------------------------------------------------------\n  // Clean Document & Export Determinism Helpers', '// Export as standalone HTML');

  // Construct synthetic DOM tree with:
  // 1. Valid diagram with active pan/zoom transforms and action buttons
  // 2. Invalid diagram with error card and "Fix in Studio" button
  function createMockElement(tag, className = '') {
    const classSet = new Set(className.split(' ').filter(Boolean));
    const attrs = {};
    const styles = {};
    let inner = '';
    const children = [];

    const el = {
      tagName: tag.toUpperCase(),
      classList: {
        add: (c) => classSet.add(c),
        remove: (c) => classSet.delete(c),
        contains: (c) => classSet.has(c)
      },
      get className() { return Array.from(classSet).join(' '); },
      set className(v) {
        classSet.clear();
        (v || '').split(/\s+/).filter(Boolean).forEach(c => classSet.add(c));
      },
      dataset: {},
      style: styles,
      setAttribute: (k, v) => { attrs[k] = String(v); },
      getAttribute: (k) => attrs[k] || null,
      removeAttribute: (k) => { delete attrs[k]; },
      get innerHTML() {
        if (children.length > 0) {
          return children.map(c => c.outerHTML || c.textContent || '').join('');
        }
        return inner;
      },
      set innerHTML(v) { inner = v; children.length = 0; },
      get textContent() {
        if (children.length > 0) return children.map(c => c.textContent).join('');
        return inner.replace(/<[^>]+>/g, '');
      },
      set textContent(v) { inner = v; children.length = 0; },
      get outerHTML() {
        const attrStr = Object.entries(attrs).map(([k, v]) => ` ${k}="${v}"`).join('');
        const styleStr = Object.keys(styles).length > 0
          ? ` style="${Object.entries(styles).map(([k, v]) => `${k.replace(/[A-Z]/g, m => '-' + m.toLowerCase())}: ${v}`).join('; ')}"`
          : '';
        const clsStr = classSet.size > 0 ? ` class="${Array.from(classSet).join(' ')}"` : '';
        return `<${tag.toLowerCase()}${clsStr}${attrStr}${styleStr}>${el.innerHTML}</${tag.toLowerCase()}>`;
      },
      appendChild: (child) => { children.push(child); child.parentNode = el; return child; },
      remove: () => {
        if (el.parentNode) {
          const idx = el.parentNode.children.indexOf(el);
          if (idx >= 0) el.parentNode.children.splice(idx, 1);
        }
      },
      replaceWith: (newEl) => {
        if (el.parentNode) {
          const idx = el.parentNode.children.indexOf(el);
          if (idx >= 0) el.parentNode.children.splice(idx, 1, newEl);
          newEl.parentNode = el.parentNode;
        }
      },
      querySelector: (selector) => {
        for (const c of children) {
          if (c.matches && c.matches(selector)) return c;
          if (c.querySelector) {
            const found = c.querySelector(selector);
            if (found) return found;
          }
        }
        return null;
      },
      querySelectorAll: (selector) => {
        const found = [];
        for (const c of children) {
          if (c.matches && c.matches(selector)) found.push(c);
          if (c.querySelectorAll) found.push(...c.querySelectorAll(selector));
        }
        return found;
      },
      matches: (sel) => {
        const parts = sel.split(',').map(s => s.trim()).filter(Boolean);
        return parts.some(part => {
          if (part.startsWith('.')) return classSet.has(part.slice(1));
          if (part.startsWith('#')) return attrs.id === part.slice(1);
          return el.tagName.toLowerCase() === part.toLowerCase();
        });
      },
      children,
      cloneNode: (deep) => {
        const clone = createMockElement(tag, Array.from(classSet).join(' '));
        Object.assign(clone.dataset, el.dataset);
        Object.assign(clone.style, el.style);
        for (const [k, v] of Object.entries(attrs)) clone.setAttribute(k, v);
        if (deep) {
          for (const c of children) {
            clone.appendChild(c.cloneNode(true));
          }
        }
        return clone;
      }
    };
    return el;
  }

  // Build Preview DOM
  const previewRoot = createMockElement('div', 'preview-content');

  // Card 1: Rendered diagram with pan transform
  const card1 = createMockElement('div', 'mermaid-block-card');
  card1.dataset.diagramIndex = '0';
  const header1 = createMockElement('div', 'mermaid-header');
  const actions1 = createMockElement('div', 'mermaid-actions');
  const btnStudio = createMockElement('button', 'diag-action-btn edit-btn');
  btnStudio.textContent = 'Studio';
  const btnSvg = createMockElement('button', 'diag-action-btn');
  btnSvg.textContent = 'SVG';
  actions1.appendChild(btnStudio);
  actions1.appendChild(btnSvg);
  header1.appendChild(actions1);
  card1.appendChild(header1);

  const vp1 = createMockElement('div', 'mermaid-viewport');
  vp1.dataset.zoom = '1.75';
  vp1.dataset.panX = '40';
  vp1.dataset.panY = '25';
  vp1.style.maxHeight = '520px';
  vp1.style.overflow = 'hidden';

  const canvas1 = createMockElement('div', 'mermaid-canvas');
  canvas1.style.transform = 'translate(40px, 25px) scale(1.75)';

  const svg1 = createMockElement('svg');
  svg1.setAttribute('id', 'card1-svg');
  canvas1.appendChild(svg1);
  vp1.appendChild(canvas1);
  card1.appendChild(vp1);

  const raw1 = createMockElement('div', 'mermaid-raw-code');
  raw1.textContent = 'flowchart TD\n  ValidNode';
  card1.appendChild(raw1);
  previewRoot.appendChild(card1);

  // Card 2: Invalid diagram with error UI
  const card2 = createMockElement('div', 'mermaid-block-card');
  card2.dataset.diagramIndex = '1';
  card2.dataset.mermaidCode = encodeURIComponent('invalid syntax here');

  const canvas2 = createMockElement('div', 'mermaid-canvas');
  const errCard2 = createMockElement('div', 'mermaid-error-card');
  const errHdr2 = createMockElement('div', 'mermaid-error-header');
  const fixBtn2 = createMockElement('button', 'btn btn-sm btn-primary diag-action-btn');
  fixBtn2.setAttribute('data-action', 'edit-diagram');
  fixBtn2.textContent = 'Fix in Studio';
  errHdr2.appendChild(fixBtn2);
  errCard2.appendChild(errHdr2);

  const errPre2 = createMockElement('pre');
  errPre2.textContent = 'invalid syntax here';
  errCard2.appendChild(errPre2);
  canvas2.appendChild(errCard2);
  card2.appendChild(canvas2);
  previewRoot.appendChild(card2);

  const p5Ctx = {
    document: {
      createElement: (tag) => createMockElement(tag),
      documentElement: { getAttribute: (k) => (k === 'data-theme' ? 'dark' : null) }
    },
    escapeHtml: (s) => s,
    decodeURIComponent
  };

  vm.createContext(p5Ctx);
  vm.runInContext(cleanExportSection, p5Ctx);

  const cleanContent = p5Ctx.getCleanRenderedContent(previewRoot);
  const standaloneHtml = p5Ctx.generateStandaloneHtml('Clean Document Test', cleanContent, 'dark');

  // Verify assertions
  assert(!cleanContent.includes('mermaid-header'), 'Clean content must not include .mermaid-header');
  assert(!cleanContent.includes('diag-action-btn'), 'Clean content must not include .diag-action-btn');
  assert(!cleanContent.includes('Fix in Studio'), 'Clean content must not include "Fix in Studio"');
  assert(!cleanContent.includes('mermaid-error-card'), 'Clean content must not include .mermaid-error-card');
  assert(!cleanContent.includes('mermaid-raw-code'), 'Clean content must not include hidden .mermaid-raw-code');
  assert(!cleanContent.includes('translate('), 'Clean content must remove active pan transform');
  assert(!cleanContent.includes('scale('), 'Clean content must remove active zoom transform');
  assert(!cleanContent.includes('max-height: 520px'), 'Clean content must remove viewport max-height constraint');

  // Standalone HTML asserts
  assert(standaloneHtml.includes('data-theme="dark"'), 'Standalone HTML must preserve dark theme attribute');
  assert(standaloneHtml.includes('color-scheme: dark'), 'Standalone HTML must specify dark color scheme in dark mode');
  assert(standaloneHtml.includes('<code class="language-mermaid">invalid syntax here</code>'), 'Invalid diagram code must be preserved in clean code block');
  assert(standaloneHtml.includes('id="card1-svg"'), 'Valid diagram SVG must be preserved');

  record('P5-03', ['R13'], 'Clean Document Export & Standalone Theme Fidelity',
    'Verify that getCleanRenderedContent removes transient controls, error UI, and pan/zoom transforms, and generateStandaloneHtml preserves theme.',
    {
      headersRemoved: true,
      errorUIRemoved: true,
      panTransformsReset: true,
      viewportHeightUnconstrained: true,
      invalidCodePreservedCleanly: true,
      themeIntentPreserved: true
    }
  );
  console.log('✓ P5-03: Clean Document Export & Standalone Theme Fidelity passed.');
} catch (err) {
  console.error('✗ P5-03 failed:', err);
  record('P5-03', ['R13'], 'Clean Document Export & Standalone Theme Fidelity', '', { error: err.message }, 'fail');
}

// -----------------------------------------------------------------------------
// Test 4: P5-04 PNG Export failure handling & temp-URL lifecycle (R14)
// -----------------------------------------------------------------------------
try {
  const exportSection = section('function sanitizeSvgForExport(svgClone) {', 'function triggerDownload(url, filename) {');

  let revokedUrls = [];
  let createdUrls = [];
  let nextUrlId = 1;

  const mockUrl = {
    createObjectURL: (blob) => {
      const u = 'blob:test-url-' + (nextUrlId++);
      createdUrls.push(u);
      return u;
    },
    revokeObjectURL: (u) => {
      revokedUrls.push(u);
    }
  };

  class MockImage {
    constructor() {
      this.src = null;
      this.onload = null;
      this.onerror = null;
    }
  }

  function makeMockSvg() {
    return {
      tagName: 'svg',
      cloneNode: () => makeMockSvg(),
      setAttribute: () => {},
      getAttribute: () => null,
      getBoundingClientRect: () => ({ width: 400, height: 300 }),
      dataset: { intrinsicWidth: '400', intrinsicHeight: '300' },
      style: {},
      querySelectorAll: () => []
    };
  }

  // --- Sub-test 4a: Image Load Failure (onerror) ---
  {
    revokedUrls = [];
    createdUrls = [];
    let loggedErrors = [];
    let toasts = [];

    const mockImgInstance = new MockImage();
    const p5Ctx = {
      URL: mockUrl,
      Image: function() { return mockImgInstance; },
      XMLSerializer: class { serializeToString() { return '<svg></svg>'; } },
      Blob: class {},
      showToast: (m) => toasts.push(m),
      logError: (src, msg, snip) => loggedErrors.push({ src, msg, snip }),
      triggerDownload: () => { throw new Error('Download should NOT be triggered on image error'); }
    };

    vm.createContext(p5Ctx);
    vm.runInContext(exportSection, p5Ctx);

    const container = { querySelector: () => makeMockSvg() };
    const pngPromise = p5Ctx.exportDiagramPng(container, 'fail.png');

    // Trigger image error
    assert(mockImgInstance.onerror, 'img.onerror handler must be attached');
    mockImgInstance.onerror(new Error('Corrupt SVG'));

    const res = await pngPromise;
    assert.strictEqual(res.success, false, 'Result must indicate failure');
    assert.strictEqual(createdUrls.length, 1, 'Blob URL must have been created');
    assert.strictEqual(revokedUrls.length, 1, 'Blob URL must be revoked on image error');
    assert.strictEqual(revokedUrls[0], createdUrls[0], 'Revoked URL must match created Blob URL');
    assert(toasts.some(t => t.includes('Failed to export PNG')), 'Actionable failure toast must be displayed');
    assert(loggedErrors.some(e => e.msg.includes('PNG export image load failure')), 'Error must be logged in error drawer');
    assert(!toasts.some(t => t.includes('downloaded')), 'Success toast must NOT be shown on failure');
  }

  // --- Sub-test 4b: Canvas 2D Context Failure ---
  {
    revokedUrls = [];
    createdUrls = [];
    let loggedErrors = [];
    let toasts = [];

    const mockImgInstance = new MockImage();
    const p5Ctx = {
      URL: mockUrl,
      Image: function() { return mockImgInstance; },
      XMLSerializer: class { serializeToString() { return '<svg></svg>'; } },
      Blob: class {},
      document: {
        createElement: (tag) => {
          if (tag === 'canvas') {
            return {
              getContext: () => null // Simulates 2D context creation failure
            };
          }
          return {};
        },
        documentElement: { getAttribute: () => 'light' }
      },
      showToast: (m) => toasts.push(m),
      logError: (src, msg, snip) => loggedErrors.push({ src, msg, snip }),
      triggerDownload: () => { throw new Error('Download should NOT be triggered on context error'); }
    };

    vm.createContext(p5Ctx);
    vm.runInContext(exportSection, p5Ctx);

    const container = { querySelector: () => makeMockSvg() };
    const pngPromise = p5Ctx.exportDiagramPng(container, 'canvas-fail.png');

    // Trigger image load, leading to canvas getContext
    mockImgInstance.onload();

    const res = await pngPromise;
    assert.strictEqual(res.success, false, 'Result must indicate failure on null canvas context');
    assert.strictEqual(revokedUrls.length, 1, 'Blob URL must be revoked when canvas context fails');
    assert(toasts.some(t => t.includes('canvas context unavailable')), 'Toast must indicate canvas context failure');
    assert(!toasts.some(t => t.includes('downloaded')), 'Success toast must NOT be shown');
  }

  // --- Sub-test 4c: Canvas toBlob Failure (null blob) ---
  {
    revokedUrls = [];
    createdUrls = [];
    let loggedErrors = [];
    let toasts = [];

    const mockImgInstance = new MockImage();
    const p5Ctx = {
      URL: mockUrl,
      Image: function() { return mockImgInstance; },
      XMLSerializer: class { serializeToString() { return '<svg></svg>'; } },
      Blob: class {},
      document: {
        createElement: (tag) => {
          if (tag === 'canvas') {
            return {
              getContext: () => ({
                fillRect: () => {},
                drawImage: () => {}
              }),
              toBlob: (callback) => {
                callback(null); // Simulates toBlob null failure
              }
            };
          }
          return {};
        },
        documentElement: { getAttribute: () => 'light' }
      },
      showToast: (m) => toasts.push(m),
      logError: (src, msg, snip) => loggedErrors.push({ src, msg, snip }),
      triggerDownload: () => { throw new Error('Download should NOT be triggered on toBlob null'); }
    };

    vm.createContext(p5Ctx);
    vm.runInContext(exportSection, p5Ctx);

    const container = { querySelector: () => makeMockSvg() };
    const pngPromise = p5Ctx.exportDiagramPng(container, 'blob-fail.png');

    mockImgInstance.onload();

    const res = await pngPromise;
    assert.strictEqual(res.success, false, 'Result must indicate failure on toBlob null');
    assert.strictEqual(revokedUrls.length, 1, 'SVG Blob URL must be revoked');
    assert(toasts.some(t => t.includes('image conversion failed')), 'Toast must indicate conversion failure');
    assert(!toasts.some(t => t.includes('downloaded')), 'Success toast must NOT be shown');
  }

  // --- Sub-test 4d: Full Success Path (all temp URLs released) ---
  {
    revokedUrls = [];
    createdUrls = [];
    let downloadedFiles = [];
    let toasts = [];

    const mockImgInstance = new MockImage();
    const p5Ctx = {
      URL: mockUrl,
      Image: function() { return mockImgInstance; },
      XMLSerializer: class { serializeToString() { return '<svg></svg>'; } },
      Blob: class {},
      document: {
        createElement: (tag) => {
          if (tag === 'canvas') {
            return {
              getContext: () => ({
                fillRect: () => {},
                drawImage: () => {}
              }),
              toBlob: (callback) => {
                callback({ size: 1024, type: 'image/png' });
              }
            };
          }
          return {};
        },
        documentElement: { getAttribute: () => 'light' }
      },
      showToast: (m) => toasts.push(m),
      logError: () => {},
      triggerDownload: (url, fn) => { downloadedFiles.push({ url, fn }); }
    };

    vm.createContext(p5Ctx);
    vm.runInContext(exportSection, p5Ctx);

    const container = { querySelector: () => makeMockSvg() };
    const pngPromise = p5Ctx.exportDiagramPng(container, 'success.png');

    mockImgInstance.onload();

    const res = await pngPromise;
    assert.strictEqual(res.success, true, 'Result must indicate success');
    assert.strictEqual(downloadedFiles.length, 1, 'Download must be triggered once');
    assert.strictEqual(downloadedFiles[0].fn, 'success.png');
    assert.strictEqual(createdUrls.length, 2, '2 URLs created (1 SVG, 1 PNG)');
    assert.strictEqual(revokedUrls.length, 2, 'Both URLs revoked after successful download');
    assert(toasts.some(t => t.includes('High-resolution PNG diagram downloaded')), 'Success toast displayed');
  }

  record('P5-04', ['R14'], 'PNG Export Failure Handling & URL Lifecycle',
    'Verify that image error, canvas null context, and toBlob null produce actionable error feedback, revoke temporary URLs, and prevent false success.',
    {
      imageErrorHandled: true,
      canvasContextFailureHandled: true,
      blobFailureHandled: true,
      tempUrlsReleasedOnAllPaths: true,
      noFalseSuccess: true
    }
  );
  console.log('✓ P5-04: PNG Export Failure Handling & URL Lifecycle passed.');
} catch (err) {
  console.error('✗ P5-04 failed:', err);
  record('P5-04', ['R14'], 'PNG Export Failure Handling & URL Lifecycle', '', { error: err.message }, 'fail');
}

// -----------------------------------------------------------------------------
// Test 5: P5-05 Print CSS has no viewport height cap on diagrams (Plan §8)
// -----------------------------------------------------------------------------
try {
  const printCss = section('/* Print Stylesheet for PDF Export */', '</style>');

  // Check for @media print block
  assert(printCss.includes('@media print'), '@media print block must be present');

  // Check .mermaid-viewport in print CSS
  assert(printCss.includes('.mermaid-viewport'), 'Print CSS must contain .mermaid-viewport override');
  assert(printCss.includes('max-height: none !important') || printCss.includes('max-height:none !important'),
    'Print CSS must explicitly set max-height: none on .mermaid-viewport');
  assert(printCss.includes('overflow: visible !important') || printCss.includes('overflow:visible !important'),
    'Print CSS must set overflow: visible on .mermaid-viewport');

  // Check .mermaid-canvas in print CSS
  assert(printCss.includes('.mermaid-canvas'), 'Print CSS must contain .mermaid-canvas override');
  assert(printCss.includes('transform: none !important') || printCss.includes('transform:none !important'),
    'Print CSS must set transform: none on .mermaid-canvas to eliminate pan/zoom clipping');

  // Check .mermaid-block-card page-break rules
  assert(printCss.includes('.mermaid-block-card'), 'Print CSS must contain .mermaid-block-card rules');
  assert(printCss.includes('break-inside: avoid') || printCss.includes('page-break-inside: avoid'),
    'Print CSS must prevent awkward diagram splits across pages with break-inside: avoid');

  record('P5-05', ['R13'], 'Print CSS Diagram Height & Overflow Uncapped',
    'Verify that print stylesheet removes 520px height cap, overflow clipping, and pan transforms for print/PDF output.',
    {
      viewportMaxHeightNone: true,
      viewportOverflowVisible: true,
      canvasTransformNone: true,
      pageBreakInsideAvoid: true
    }
  );
  console.log('✓ P5-05: Print CSS Diagram Height & Overflow Uncapped passed.');
} catch (err) {
  console.error('✗ P5-05 failed:', err);
  record('P5-05', ['R13'], 'Print CSS Diagram Height & Overflow Uncapped', '', { error: err.message }, 'fail');
}

// -----------------------------------------------------------------------------
// Write Results Manifest
// -----------------------------------------------------------------------------
const rawDisk = crypto.createHash('sha256').update(srcRaw).digest('hex');
const lfNorm = crypto.createHash('sha256').update(src).digest('hex');

const manifest = {
  suite: 'Phase 5 Verification (Gate G5)',
  timestamp: new Date().toISOString(),
  candidateSha256Raw: rawDisk,
  candidateSha256Lf: lfNorm,
  testsPassed: results.filter(r => r.status === 'pass').length,
  testsFailed: results.filter(r => r.status === 'fail').length,
  results
};

fs.writeFileSync(path.join(out, 'phase-5-results.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');

console.log(`\n=== Gate G5 Checks Completed: ${manifest.testsPassed} Passed, ${manifest.testsFailed} Failed ===`);
if (manifest.testsFailed > 0) process.exit(1);
})();
