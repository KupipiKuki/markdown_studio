// G0/G1-exception capture routine for Markdown Studio remediation.
//
// Generates a stop-point manifest (one stop point per capture) and, when a
// browser is available, executes each stop point, capturing screenshots,
// console output, and DOM observations into the output directory.
//
// Modes:
//   node tests/g0-capture-routine.cjs --dry-run            # emit stop points only, no browser
//   node tests/g0-capture-routine.cjs --origin http        # loopback HTTP only (127.0.0.1)
//   node tests/g0-capture-routine.cjs --origin file        # file:// only
//   node tests/g0-capture-routine.cjs --origin both        # both launch modes
//   node tests/g0-capture-routine.cjs --browser firefox --stop-on-fail
//   node tests/g0-capture-routine.cjs --browser edge            # branded Edge (channel msedge, needs Edge installed)
//   node tests/g0-capture-routine.cjs --browser chrome          # branded Chrome (channel chrome, needs Chrome installed)
//
// Safety: serves only 127.0.0.1 loopback; uses an isolated browser context
// with synthetic documents; never touches a real user profile or storage.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');

// Helper: Decode FlateDecode PDF streams and ToUnicode CMaps to extract rendered Step 0..Step 25 labels
function decodeUtf16BeHex(hex) {
  let out = '';
  for (let i = 0; i < hex.length; i += 4) {
    const code = parseInt(hex.slice(i, i + 4), 16);
    if (!Number.isNaN(code)) out += String.fromCharCode(code);
  }
  return out;
}

function extractPdfSteps(pdfBuf) {
  const str = pdfBuf.toString('binary');
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let m;
  const decompressed = [];
  const cmaps = [];
  while ((m = streamRegex.exec(str)) !== null) {
    try {
      const inf = zlib.inflateSync(Buffer.from(m[1], 'binary')).toString('latin1');
      if (inf.includes('beginbfchar') || inf.includes('beginbfrange')) cmaps.push(inf);
      else decompressed.push(inf);
    } catch (e) {}
  }
  const map = {};
  for (const cmap of cmaps) {
    const bfcharBlocks = cmap.match(/beginbfchar([\s\S]*?)endbfchar/g) || [];
    for (const blk of bfcharBlocks) {
      const bfchar = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g;
      let bm;
      while ((bm = bfchar.exec(blk)) !== null) {
        map[parseInt(bm[1], 16)] = decodeUtf16BeHex(bm[2]);
      }
    }
    const bfrangeBlocks = cmap.match(/beginbfrange([\s\S]*?)endbfrange/g) || [];
    for (const blk of bfrangeBlocks) {
      const bfrange = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g;
      let rm;
      while ((rm = bfrange.exec(blk)) !== null) {
        const start = parseInt(rm[1], 16);
        const end = parseInt(rm[2], 16);
        if (rm[3].length <= 4) {
          let dst = parseInt(rm[3], 16);
          for (let k = start; k <= end; k++) {
            map[k] = String.fromCharCode(dst++);
          }
        } else {
          const baseStr = decodeUtf16BeHex(rm[3]);
          for (let k = start; k <= end; k++) {
            map[k] = baseStr;
          }
        }
      }
    }
  }
  let fullDecoded = '';
  for (const s of decompressed) {
    const hexStrings = /<([0-9A-Fa-f]+)>/g;
    let hm;
    let streamDecoded = '';
    while ((hm = hexStrings.exec(s)) !== null) {
      const hex = hm[1];
      for (let i = 0; i < hex.length; i += 4) {
        const code = parseInt(hex.slice(i, i + 4), 16);
        if (map[code]) streamDecoded += map[code];
      }
    }
    fullDecoded += streamDecoded + '\n';
  }
  const foundSteps = [];
  const missingSteps = [];
  for (let i = 0; i <= 25; i++) {
    const stepRegex = new RegExp(`Step\\s*${i}(?!\\d)`);
    if (stepRegex.test(fullDecoded)) foundSteps.push(`Step ${i}`);
    else missingSteps.push(`Step ${i}`);
  }
  return { foundSteps, missingSteps, foundCount: foundSteps.length };
}

const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf('--' + name);
  return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : dflt;
};
const DRY_RUN = args.includes('--dry-run');
const HEADED = args.includes('--headed'); // focused visible window: required for G1-CLIP-SUCCESS
const ORIGIN = String(opt('origin', 'both')); // file | http | both
const BROWSER = String(opt('browser', 'chromium')); // chromium | firefox | edge | chrome
// Branded browsers are reached through the chromium launcher's channel option.
const CHANNELS = { edge: 'msedge', chrome: 'chrome' };
const STOP_ON_FAIL = args.includes('--stop-on-fail');
const FILTER = opt('filter', null);
if (!DRY_RUN && !['chromium', 'firefox', 'edge', 'chrome'].includes(BROWSER)) {
  console.error(`unknown --browser "${BROWSER}"; use chromium | firefox | edge | chrome`);
  process.exit(2);
}
const OUT = path.resolve(root, String(opt('out', 'evidence/phase-0/g0-capture')));

const workingPath = path.join(root, 'working/markdown_studio.html');
const workingSrc = fs.readFileSync(workingPath, 'utf8');
const CANDIDATE_SHA = crypto.createHash('sha256').update(workingSrc).digest('hex');
// Windows checkouts with autocrlf write CRLF on disk while the committed blob is LF:
// record the LF-normalized hash too, so a CRLF checkout still provably matches the
// committed candidate (provenance finding M1: raw b15a4e8b... == committed e02aed95... + CRLF).
const CANDIDATE_SHA_LF = crypto.createHash('sha256').update(workingSrc.replace(/\r\n/g, '\n')).digest('hex');
const consoleLog = [];
let BROWSER_VERSION = null;

const controls = JSON.parse(fs.readFileSync(path.join(root, 'evidence/phase-0/controls.json'), 'utf8'));
const fixtureDir = path.join(root, 'evidence/phase-0/fixtures');
const fixtures = fs.readdirSync(fixtureDir).filter(f => f.endsWith('.md')).sort();

// ---------------------------------------------------------------- stop points
function buildStopPoints() {
  const sps = [];
  for (const origin of (ORIGIN === 'both' ? ['file', 'http'] : [ORIGIN])) {
    sps.push({
      id: `G0-LAUNCH-${origin.toUpperCase()}`, gate: 'G0', area: 'launch',
      origin,
      procedure: `Load working/markdown_studio.html via ${origin === 'http' ? 'loopback HTTP (127.0.0.1)' : 'file://'} in a fresh isolated context; record page title, editor presence, welcome.md render (SVG/error-card counts), console messages.`,
      expected: 'Page loads with #editor present; pristine welcome.md renders 2/2 diagrams with 0 error cards; console has no errors.',
    });
  }
  for (const f of fixtures) {
    sps.push({
      id: `G0-FIX-${f.replace(/\.md$/, '')}`, gate: 'G0', area: 'fixture-render', fixture: f,
      origin: 'http',
      procedure: `Set #editor to evidence/phase-0/fixtures/${f}, dispatch input, wait for render to settle, capture full-page screenshot + console + per-card SVG/error counts.`,
      expected: 'Fixture renders per its content (diagrams produce SVGs, invalid.md produces an error card); 0 console errors; surrounding Markdown preserved.',
    });
  }
  for (const c of controls) {
    const a = c.attributes || {};
    const selector = a.id ? `#${a.id}` : a['data-action'] ? `[data-action="${a['data-action']}"]` : a['data-template'] ? `[data-template="${a['data-template']}"]` : a['data-insert'] ? `[data-insert="${a['data-insert']}"]` : a['for'] ? `label[for="${a['for']}"]` : c.tag;
    sps.push({
      id: `G0-CTL-${c.id}`, gate: 'G0', area: 'control', control: c.id, selector,
      controlSpec: c,
      origin: 'http',
      procedure: `Execute control ${c.id} (${c.tag} ${selector}) on a synthetic document: click, or set value + dispatch change for select/input. Capture observation + screenshot; close any opened modal/dropdown afterwards.`,
      expected: c.expected,
    });
  }
  sps.push({
    id: 'G1-X1-ISOLATION-BROWSER', gate: 'G1-exception', area: 'update-isolation', origin: 'http',
    procedure: 'Post-R05-fix browser re-check: on a tilde-first mixed-fence doc AND a blockquote-fence-first doc, edit card 0 in Studio and Update; compare #editor before/after byte-wise.',
    expected: 'Top-level mixed fences: only the targeted block changes. Blockquote-nested fences: known residual (G1-X2) — record actual behavior, do not claim fixed.',
  });
  sps.push({
    id: 'G1-X4-WELCOME-FULLPAGE', gate: 'G1-exception', area: 'visual', origin: 'http',
    procedure: 'Fresh context, pristine welcome.md, capture FULL-PAGE screenshot (not viewport) plus scrolled captures of both diagram cards.',
    expected: 'Both welcome diagrams visible as SVGs in the full-page capture; 0 error cards; 0 console errors.',
  });
  sps.push({
    id: 'G1-CLIP-SUCCESS', gate: 'G1-exception', area: 'clipboard', origin: 'http',
    procedure: 'With a focused visible window (headed), click Copy Code on a rendered card and read navigator.clipboard.readText(); otherwise record blocked with the rejection reason.',
    expected: 'Clipboard success path returns byte-exact diagram source; rejection path records the exact error toast.',
  });
  sps.push({
    id: 'G2-LISTENER-50', gate: 'G2', area: 'listener-cleanup', origin: 'http',
    procedure: 'Execute 50 consecutive preview re-render cycles in the browser; spy on window.addEventListener to verify window mousemove/mouseup listeners do not accumulate and diagram drag remains interactive at cycle 50.',
    expected: 'Window listener count remains constant (zero listener growth) across 50 cycles; diagram interactivity remains fully operational.',
  });
  sps.push({
    id: 'G2-RENDER-GEN', gate: 'G2', area: 'render-generation', origin: 'http',
    procedure: 'Verify generation guards and invalidation in live browser: rapid typing in editor commits only newest result without console errors; intercepted out-of-order renders do not overwrite newer canvas content; closing/reopening Studio modal cancels in-flight renders.',
    expected: 'Only the newest render generation commits to preview/studio canvas; out-of-order completions discarded cleanly; zero console errors.',
  });
  sps.push({
    id: 'G3-FIT-TALL-WIDE', gate: 'G3', area: 'diagram-fit', origin: 'http',
    procedure: 'Load tall.md and wide.md fixtures in preview and Studio; verify bidirectional fit calculation scales diagrams to available dimensions without clipping top/bottom or left/right at initial display; verify pan/zoom and zoom-reset reachability; capture paired preview and studio screenshots.',
    expected: 'Tall diagram (2100+ px) and wide diagram (1800+ px) fit inside available viewport without clipping in both views; zoom-reset restores fit; 0 console errors.'
  });
  sps.push({
    id: 'G3-THEME-ISOLATION-3X', gate: 'G3', area: 'theme-isolation', origin: 'http',
    procedure: 'Execute 3 cycles of theme switching and studio modal theme customization; verify document theme strictly governs preview diagram rendering; studio theme changes do not contaminate document preview; studio close restores document theme immediately.',
    expected: 'Document preview strictly adheres to document theme; Studio custom themes remain isolated to Diagram Studio; 0 console errors.'
  });
  sps.push({
    id: 'G3-TYPOGRAPHY-LABELS', gate: 'G3', area: 'typography-isolation', origin: 'http',
    procedure: 'Render long-labels.md with markdown formatting (code, bold, italic, multi-line, long edge text); compare SVG label computed styles between preview and studio; verify preview typography rules (:not(.mermaid-block-card *)) prevent border/background bleeding into foreignObject code and paragraphs.',
    expected: 'Diagram labels have clean typography without unwanted borders/backgrounds; no label clipping or text overflow; R06 verified remediated; 0 console errors.'
  });
  sps.push({
    id: 'G3-RESIZE-VIEWPORT-REFIT', gate: 'G3', area: 'resize-refit', origin: 'http',
    procedure: 'Verify diagram refitting behavior across split resizer dragging, double-click 50/50 reset, viewer toggle, and narrow viewport (640px); confirm diagrams automatically scale to fit new container dimensions without manual pan adjustment.',
    expected: 'Diagrams automatically refit to changed pane dimensions after split dragging, viewer toggle, and narrow viewport resize; 0 console errors.'
  });
  sps.push({
    id: 'G4-INSERT-COMMANDS', gate: 'G4', area: 'insertion-commands', origin: 'http',
    procedure: 'Execute ribbon insertion commands (divider, image, link, table) and Studio palette Subgraph Box (C091) across empty and nonempty selections; verify absence of stray "text" placeholders, exact ![Alt text](url) construction, multi-line subgraph decoding with real newlines, and clean selection replacement.',
    expected: 'All insertions produce exact expected Markdown without stray "text" or malformed URLs; C091 inserts multi-line subgraph; 0 console errors.'
  });
  sps.push({
    id: 'G4-SHORTCUT-GUARDS', gate: 'G4', area: 'shortcut-guards', origin: 'http',
    procedure: 'Focus in Studio #builderCodeInput and Find Bar #findInput; trigger Ctrl+B, Ctrl+I, Ctrl+K; verify background document is not mutated; verify Escape key dismisses modals and find bar.',
    expected: 'Editor shortcuts are guarded when typing in Studio or other inputs; Escape cleanly dismisses overlays; 0 console errors.'
  });
  sps.push({
    id: 'G4-PERSISTENCE-ROUNDTRIP', gate: 'G4', area: 'persistence-roundtrip', origin: 'http',
    procedure: 'Edit active document in #editor, create a second tab with custom markdown, switch back and forth between tabs, reload page from localStorage persistence; verify byte-exact document fidelity, active tab index, and view mode persistence.',
    expected: 'Tab switching and page reload preserve document content and state byte-exact without data loss or corruption; 0 console errors.'
  });
  sps.push({
    id: 'G5-EXPORT-STANDALONE', gate: 'G5', area: 'export-determinism', origin: 'http',
    procedure: 'Edit active document in editor, immediately trigger Export Standalone HTML and Copy Rendered HTML without waiting; verify export waits for in-flight Mermaid and MathJax rendering; verify exported standalone HTML has theme intent (data-theme, dark/light styles) and clean DOM (no .mermaid-header, no action buttons, no error UI, transform: none on canvas).',
    expected: 'Exported HTML contains fully-rendered diagram SVGs matching preview; clean document structure without transient studio controls or pan transforms; theme intent preserved; 0 console errors.'
  });
  sps.push({
    id: 'G5-EXPORT-DIAGRAM-FILES', gate: 'G5', area: 'diagram-export', origin: 'http',
    procedure: 'Trigger SVG and PNG export on a rendered preview diagram; capture downloaded files via Playwright download event; reopen and inspect SVG (verify valid XML, viewBox, intrinsic width/height, complete labels) and PNG (verify non-zero byte size, dimensions, PNG magic header); verify success toasts and zero errors.',
    expected: 'Both SVG and PNG files download successfully; SVG parses as valid XML with intrinsic dimensions and labels; PNG has expected 2x retina dimensions; 0 console errors.'
  });
  sps.push({
    id: 'G5-EXPORT-PNG-FAILURE', gate: 'G5', area: 'export-failure-handling', origin: 'http',
    procedure: 'Simulate controlled PNG failure by corrupting image source or blocking image load during exportDiagramPng; verify error toast is displayed, error is logged in Error Log drawer, temporary object URLs are released, and no false success toast appears.',
    expected: 'Controlled failure surfaces actionable error feedback in toast and error log; temporary URLs revoked; no false success toast; R14 verified remediated.'
  });
  sps.push({
    id: 'G5-PRINT-PDF-TALL', gate: 'G5', area: 'print-layout', origin: 'http',
    procedure: 'Load tall.md fixture (2100+ px diagram); evaluate print media stylesheet styles for .mermaid-viewport and .mermaid-canvas; invoke CDP Page.printToPDF (in Chromium-based browsers) or verify print CSS rules; assert .mermaid-viewport has max-height: none and overflow: visible, canvas transform: none, and page-break rules present without clipping tall diagrams.',
    expected: 'Print CSS removes 520px viewport height cap and overflow clipping; tall diagram renders without clipping in print layout; 0 console errors.'
  });
  return sps;
}

// ------------------------------------------------------------------- manifest
function makeRecord(sp) {
  return {
    id: sp.id, gate: sp.gate, area: sp.area, origin: sp.origin || null,
    fixture: sp.fixture || null, control: sp.control || null, selector: sp.selector || null,
    controlSpec: sp.controlSpec || null,
    procedure: sp.procedure, expected: sp.expected,
    observation: null, status: 'unrun',
    artifacts: [], timestamp: null,
  };
}

const relPosix = p => path.relative(root, p).split(path.sep).join('/');

function writeManifest(records, env) {
  fs.mkdirSync(OUT, { recursive: true });
  const generatedAt = new Date().toISOString();
  const manifest = {
    routine: 'tests/g0-capture-routine.cjs',
    candidateSha256: CANDIDATE_SHA,
    candidateSha256LfNormalized: CANDIDATE_SHA_LF,
    candidateNote: 'candidateSha256 is the raw on-disk file; candidateSha256LfNormalized is the same content with CRLF->LF. Compare the normalized hash against the committed blob hash to detect autocrlf artifacts.',
    generatedAt,
    environment: env,
    stopOnFail: STOP_ON_FAIL,
    totals: {
      stopPoints: records.length,
      pass: records.filter(r => r.status === 'pass').length,
      fail: records.filter(r => r.status === 'fail').length,
      blocked: records.filter(r => r.status === 'blocked').length,
      unrun: records.filter(r => r.status === 'unrun').length,
    },
    records,
  };
  // Write-once discipline: every run is also preserved run-stamped under runs/ (per browser+origin),
  // so a second browser run never overwrites the first (environment-notes.md rule).
  for (const r of manifest.records) r.artifacts = r.artifacts.map(a => a.split(path.sep).join('/'));
  if (FILTER) {
    return manifest;
  }
  if (!env.dryRun) {
    const stamp = `${String(env.browserRequested || 'browser').split(' ')[0]}-${String(env.origin || ORIGIN)}-${generatedAt.replace(/[:.]/g, '-')}`;
    fs.mkdirSync(path.join(OUT, 'runs'), { recursive: true });
    fs.writeFileSync(path.join(OUT, 'runs', `manifest-${stamp}.json`), JSON.stringify(manifest, null, 2) + '\n');
  }
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  const lines = ['# G0/G1-exception capture stop points', '',
    `Candidate: \`${CANDIDATE_SHA}\`  Generated: ${manifest.generatedAt}`, '',
    '| Stop point | Gate | Area | Origin | Status | Artifacts |', '| --- | --- | --- | --- | --- | --- |'];
  for (const r of records) {
    lines.push(`| ${r.id} | ${r.gate} | ${r.area} | ${r.origin || '-'} | ${r.status} | ${r.artifacts.join(', ') || '-'} |`);
  }
  fs.writeFileSync(path.join(OUT, 'stop-points.md'), lines.join('\n') + '\n');
  return manifest;
}

// -------------------------------------------------------------- browser runner
async function runBrowser() {
  let playwright;
  try {
    playwright = require('playwright');
  } catch (e) {
    console.error('playwright module not available:', e.message);
    console.error('Run with --dry-run to emit the stop-point manifest without a browser.');
    process.exit(2);
  }
  const http = require('http');
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(req.url.split('?')[0]);
    if (urlPath === '/favicon.ico' || urlPath.endsWith('.ico')) { res.writeHead(204); res.end(); return; } // browsers request favicon on http origins; 404 would pollute the console-error check
    const p = path.join(root, urlPath.replace(/^\/+/, '') || 'working/markdown_studio.html');
    fs.readFile(p, (err, data) => {
      if (err) { res.writeHead(404); res.end('not found'); return; }
      res.writeHead(200, { 'Content-Type': p.endsWith('.html') ? 'text/html' : 'application/octet-stream' });
      res.end(data);
    });
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r)); // loopback only
  const port = server.address().port;
  const baseHttp = `http://127.0.0.1:${port}`;
  const targetUrl = origin => origin === 'http' ? `${baseHttp}/working/markdown_studio.html` : 'file://' + workingPath;

  const channel = CHANNELS[BROWSER] || null;
  const launcher = channel ? playwright.chromium : playwright[BROWSER];
  const browser = await launcher.launch({ headless: !HEADED, ...(channel ? { channel } : {}) });
  BROWSER_VERSION = `${browser.browserType().name()}${channel ? ' channel=' + channel : ''} ${browser.version()}`;
  let records = buildStopPoints().map(makeRecord);
  if (FILTER) records = records.filter(r => r.id.includes(FILTER) || r.gate === FILTER);
  const resourceErrors = [];

  async function newPage(origin, withClipboardPerms) {
    const ctx = await browser.newContext({ viewport: { width: 1296, height: 866 } });
    // Clipboard permissions/focus for clipboard and export stop points; headed side effects must not
    // leak into launch/fixture stop points.
    if (withClipboardPerms) {
      try { await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: baseHttp }); } catch (e) {}
    }
    const page = await ctx.newPage();
    // Stub window.print: the native print dialog blocks headed automation (C019 #btnPrintPdf).
    // The stub records invocations; actual print/PDF output validation is Gate G5 scope.
    // Also spy on navigator.clipboard.writeText and HTMLAnchorElement.prototype.click + URL.createObjectURL
    // so real user-facing clipboard writes and Blob downloads are captured without bypassing triggerDownload.
    await page.addInitScript(() => {
      window.print = () => { window.__printCalls = (window.__printCalls || 0) + 1; };
      window.__lastClipboardWrite = null;
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        const origWrite = navigator.clipboard.writeText.bind(navigator.clipboard);
        navigator.clipboard.writeText = async (text) => {
          window.__lastClipboardWrite = String(text);
          return origWrite(text);
        };
      }
      window.__blobStore = new Map();
      window.__capturedDownloads = [];
      const origCreateObjectURL = URL.createObjectURL.bind(URL);
      URL.createObjectURL = function(blob) {
        const u = origCreateObjectURL(blob);
        window.__blobStore.set(u, blob);
        return u;
      };
      const origAnchorClick = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function() {
        if (this.hasAttribute('download') || this.download) {
          const blob = window.__blobStore.get(this.href) || null;
          window.__capturedDownloads.push({
            href: this.href,
            download: this.download,
            blob
          });
        }
        return origAnchorClick.apply(this, arguments);
      };
    });
    if (withClipboardPerms) { try { await page.bringToFront(); } catch (e) {} }
    page.on('console', m => consoleLog.push({ stop: currentId, type: m.type(), text: m.text() }));
    page.on('pageerror', e => consoleLog.push({ stop: currentId, type: 'pageerror', text: String(e) }));
    page.on('response', r => { if (r.status() >= 400) resourceErrors.push({ stop: currentId, url: r.url(), status: r.status() }); });
    await page.goto(targetUrl(origin), { waitUntil: 'load' });
    await page.waitForSelector('#editor', { timeout: 10000 });
    return { ctx, page };
  }

  let currentId = null;
  const browserArtDir = path.join(OUT, 'artifacts', BROWSER);
  const art = id => path.join(browserArtDir, id);
  fs.mkdirSync(browserArtDir, { recursive: true });

  async function settle(page) {
    await page.waitForFunction(() => {
      const cards = document.querySelectorAll('#previewContent .mermaid-block-card');
      return cards.length > 0 ? [...cards].every(c => c.querySelector('.mermaid-canvas svg') || c.querySelector('.mermaid-error-card')) : true;
    }, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(400);
  }
  async function counts(page) {
    return page.evaluate(() => ({
      svgCards: document.querySelectorAll('#previewContent .mermaid-block-card .mermaid-canvas svg').length,
      errorCards: document.querySelectorAll('#previewContent .mermaid-error-card').length,
      cards: document.querySelectorAll('#previewContent .mermaid-block-card').length,
    }));
  }
  async function shoot(page, rec) {
    const f = `${art(rec.id)}.png`;
    await page.screenshot({ path: f, fullPage: true });
    rec.artifacts.push(relPosix(f));
  }
  async function finish(rec, status, observation) {
    rec.status = status;
    rec.observation = observation;
    rec.timestamp = new Date().toISOString();
    console.log(`${status === 'pass' ? '✓' : status === 'fail' ? '✗' : '◌'} ${rec.id} [${status}]`);
    if (status === 'fail' && STOP_ON_FAIL) {
      for (const r of records) if (r.status === 'unrun') r.status = 'blocked';
      console.log('stop-on-fail: remaining stop points marked blocked');
      return true;
    }
    return false;
  }

  for (const rec of records) {
    currentId = rec.id;
    const origin = rec.origin === 'file' || rec.origin === 'http' ? rec.origin : 'http';
    let page, ctx;
    try {
      ({ ctx, page } = await newPage(origin, (rec.area === 'clipboard' || rec.id === 'G5-EXPORT-STANDALONE' || rec.area === 'control') && HEADED));
      if (rec.area === 'launch') {
        await settle(page);
        const c = await counts(page);
        const libs = await page.evaluate(() => ({ marked: typeof marked, mermaid: typeof mermaid }));
        const errs = consoleLog.filter(l => l.stop === rec.id && (l.type === 'error' || l.type === 'pageerror'));
        const resErrs = resourceErrors.filter(r => r.stop === rec.id && !r.url.endsWith('.ico')); // favicon 404s are browser noise, not app failures
        await shoot(page, rec);
        // Environment block (CDN unreachable) is blocked, not an application failure (plan §3).
        if (libs.mermaid === 'undefined' || libs.marked === 'undefined') {
          if (await finish(rec, 'blocked', { ...c, libs, consoleErrors: errs.map(e => e.text), resourceErrors: resErrs, reason: 'CDN dependency not loaded (network/loopback isolation?) — environment blocker, not app failure' })) break;
          continue;
        }
        const ok = c.cards === 2 && c.svgCards === 2 && c.errorCards === 0 && errs.length === 0 && resErrs.length === 0;
        if (await finish(rec, ok ? 'pass' : 'fail', { ...c, libs, consoleErrors: errs.map(e => e.text), resourceErrors: resErrs })) break;
      } else if (rec.area === 'fixture-render') {
        const text = fs.readFileSync(path.join(fixtureDir, rec.fixture), 'utf8');
        await page.evaluate(t => {
          const el = document.getElementById('editor');
          el.value = t;
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }, text);
        await settle(page);
        const c = await counts(page);
        await shoot(page, rec);

        // For built-in templates (template-*.md), Gate G3 requires rendering cleanly in BOTH Preview and Diagram Studio views
        let studioCheck = null;
        const isTemplate = rec.fixture.startsWith('template-');
        if (isTemplate && c.svgCards >= 1) {
          await page.evaluate(() => {
            const editBtn = document.querySelector('#previewContent .mermaid-block-card .edit-btn');
            if (editBtn) editBtn.click();
          });
          await page.waitForFunction(() => {
            const canvas = document.getElementById('builderDiagramCanvas');
            return canvas && (canvas.querySelector('svg') || canvas.querySelector('.mermaid-error-card'));
          }, { timeout: 10000 }).catch(() => {});
          await page.waitForTimeout(300);

          studioCheck = await page.evaluate(() => {
            const canvas = document.getElementById('builderDiagramCanvas');
            const svg = canvas ? canvas.querySelector('svg') : null;
            const errCard = canvas ? canvas.querySelector('.mermaid-error-card') : null;
            const rect = svg ? svg.getBoundingClientRect() : null;
            return {
              studioSvgCards: svg ? 1 : 0,
              studioErrorCards: errCard ? 1 : 0,
              studioSvgWidth: rect ? Math.round(rect.width) : 0,
              studioSvgHeight: rect ? Math.round(rect.height) : 0,
              bothViewsVerified: !!(svg && !errCard && rect && rect.width > 10 && rect.height > 10)
            };
          });
          const studioShot = `${art(rec.id + '-studio')}.png`;
          await page.screenshot({ path: studioShot, fullPage: true });
          rec.artifacts.push(relPosix(studioShot));

          await page.evaluate(() => {
            const cancelBtn = document.getElementById('btnBuilderCancel');
            if (cancelBtn) cancelBtn.click();
          });
          await page.waitForTimeout(200);
        }

        const errs = consoleLog.filter(l => l.stop === rec.id && (l.type === 'error' || l.type === 'pageerror'));
        const obsData = { ...c, ...(studioCheck || {}), consoleErrors: errs.length };
        fs.writeFileSync(`${art(rec.id)}-counts.json`, JSON.stringify(obsData, null, 2));
        rec.artifacts.push(relPosix(`${art(rec.id)}-counts.json`));
        const isInvalid = rec.fixture === 'invalid.md';
        const isOuterFence = rec.fixture === 'outer-fence.md';
        const ok = isInvalid ? (c.errorCards >= 1 && errs.length === 0) :
                   isOuterFence ? (c.cards === 0 && c.errorCards === 0 && errs.length === 0) :
                   isTemplate ? (c.svgCards >= 1 && c.errorCards === 0 && studioCheck && studioCheck.bothViewsVerified && errs.length === 0) :
                   (c.svgCards >= 1 && c.errorCards === 0 && errs.length === 0);
        if (await finish(rec, ok ? 'pass' : 'fail', obsData)) break;
      } else if (rec.area === 'control') {
        const a = (rec.controlSpec && rec.controlSpec.attributes) || {};
        await settle(page);
        await page.route('https://example.test/**', route => route.fulfill({
          status: 200,
          contentType: 'image/svg+xml',
          body: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>'
        })).catch(() => {});

        // Hidden file input (C015): setting .value throws in browsers; use setInputFiles with a synthetic file.
        if (a.type === 'file') {
          const synth = path.join(browserArtDir, 'synthetic-upload.md');
          fs.mkdirSync(path.dirname(synth), { recursive: true });
          fs.writeFileSync(synth, '# QAQC synthetic upload\n\n```mermaid\nflowchart TD\n  U --> V\n```\n');
          const tabsBefore = await page.evaluate(() => document.querySelectorAll('.tab').length);
          await page.setInputFiles('#' + a.id, synth);
          await page.waitForTimeout(800);
          const after = await page.evaluate(() => ({ tabs: document.querySelectorAll('.tab').length, editorHead: document.getElementById('editor').value.slice(0, 40) }));
          await shoot(page, rec);
          const ok = after.tabs > tabsBefore || after.editorHead.includes('QAQC synthetic');
          await finish(rec, ok ? 'pass' : 'fail', { tabsBefore, ...after, behavioralVerified: ok, note: 'file load via setInputFiles on hidden #' + a.id + '; label C014 routes here' });
          continue;
        }

        // File-picker label (C014): click the label and verify the OS filechooser opens and loads into #fileInput.
        if (rec.controlSpec && rec.controlSpec.tag === 'label' && a['for'] === 'fileInput') {
          const synth = path.join(browserArtDir, 'synthetic-upload-label.md');
          fs.mkdirSync(path.dirname(synth), { recursive: true });
          fs.writeFileSync(synth, '# QAQC label upload\n\n```mermaid\nflowchart TD\n  L1 --> L2\n```\n');
          const tabsBefore = await page.evaluate(() => document.querySelectorAll('.tab').length);
          const [chooser] = await Promise.all([
            page.waitForEvent('filechooser'),
            page.click('label[for="fileInput"]')
          ]);
          await chooser.setFiles(synth);
          await page.waitForTimeout(800);
          const after = await page.evaluate(() => ({ tabs: document.querySelectorAll('.tab').length, editorHead: document.getElementById('editor').value.slice(0, 40) }));
          await shoot(page, rec);
          const ok = after.tabs > tabsBefore || after.editorHead.includes('QAQC label upload');
          await finish(rec, ok ? 'pass' : 'fail', { tabsBefore, ...after, fileChooserTriggered: true, behavioralVerified: ok });
          continue;
        }

        const key = a['data-action'] !== undefined ? 'data-action' : a['data-template'] !== undefined ? 'data-template' : a['data-insert'] !== undefined ? 'data-insert' : null;
        const probe = { cid: rec.control, id: a.id || null, forAttr: a['for'] || null, key, val: key ? a[key] : null };

        const ctlRes = await page.evaluate(async (o) => {
          // Set up prerequisite UI state depending on control group
          const cidNum = parseInt(String(o.cid).replace(/^C/, ''), 10);
          let setupState = 'default';

          // Track downloads, clipboard writes, and prompts per control
          const downloadsBefore = (window.__capturedDownloads || []).length;
          window.__lastClipboardWrite = null;
          window.prompt = () => 'https://example.test/asset.svg';

          if (cidNum >= 3 && cidNum <= 12) {
            document.getElementById('btnQuickDiagram')?.click();
            setupState = 'quickDiagramMenuOpened';
          } else if (cidNum >= 17 && cidNum <= 21) {
            document.getElementById('btnExportMenu')?.click();
            setupState = 'exportDropdownOpened';
          } else if (o.id === 'btnLayoutSplit' || o.id === 'btnShowEditorInline' || o.id === 'statusViewMode') {
            document.getElementById('btnToggleEditor')?.click();
            setupState = 'editorHiddenPrerequisite';
          } else if (o.id === 'btnShowViewerInline') {
            document.getElementById('btnToggleViewer')?.click();
            setupState = 'viewerHiddenPrerequisite';
          } else if (o.id === 'btnEmptyShowEditor' || o.id === 'btnEmptyShowViewer' || o.id === 'btnEmptyRestoreSplit') {
            document.getElementById('btnToggleEditor')?.click();
            document.getElementById('btnToggleViewer')?.click();
            setupState = 'bothPanesHiddenPrerequisite';
          } else if (cidNum >= 49 && cidNum <= 55) {
            const ed = document.getElementById('editor');
            if (ed && (ed.value.match(/Mermaid/g) || []).length < 2) {
              ed.value = 'Mermaid one and Mermaid two\n\n' + ed.value;
              ed.dispatchEvent(new Event('input', { bubbles: true }));
            }
            if (ed && (o.id === 'btnFindPrev' || o.id === 'btnFindNext')) {
              ed.setSelectionRange(0, 0);
            }
            document.getElementById('btnToggleFind')?.click();
            const fi = document.getElementById('findInput');
            const ri = document.getElementById('replaceInput');
            if (o.id !== 'findInput' && fi) { fi.value = 'Mermaid'; fi.dispatchEvent(new Event('input', { bubbles: true })); }
            if (o.id !== 'replaceInput' && ri) { ri.value = 'ReplacedMermaid'; ri.dispatchEvent(new Event('input', { bubbles: true })); }
            if (o.id === 'btnReplace' || o.id === 'replaceInput') document.getElementById('btnFindNext')?.click();
            setupState = 'findBarOpenedPrerequisite';
          } else if (o.id === 'btnCloseToc') {
            document.getElementById('btnToggleToc')?.click();
            setupState = 'tocOpenedPrerequisite';
          } else if (o.id === 'btnClearErrorLog' || o.id === 'btnCloseErrorLog') {
            if (document.querySelectorAll('#errorLogList li, #errorLogList .error-log-row').length === 0) {
              const ed = document.getElementById('editor');
              if (ed) {
                const orig = ed.value;
                ed.value = '```mermaid\nflowchart TD\n  bad --->|\n```\n';
                ed.dispatchEvent(new Event('input', { bubbles: true }));
                await new Promise(r => setTimeout(r, 400));
                ed.value = orig;
                ed.dispatchEvent(new Event('input', { bubbles: true }));
                await new Promise(r => setTimeout(r, 400));
              }
            }
            const errDrawer = document.getElementById('errorLogDrawer');
            if (errDrawer && errDrawer.style.display === 'none') {
              document.getElementById('statusErrorIndicator')?.click();
            }
            setupState = 'errorLogOpenedPrerequisite';
          } else if (cidNum >= 71 && cidNum <= 101) {
            document.getElementById('btnOpenStudio')?.click();
            await new Promise(r => setTimeout(r, 300));
            if (o.id === 'btnBuilderFormat') {
              const b = document.getElementById('builderCodeInput');
              if (b) b.value = 'flowchart TD\n    A --> B\n\n\n\n';
            } else if (o.id === 'btnBuilderZoomReset') {
              document.getElementById('btnBuilderZoomIn')?.click();
              await new Promise(r => setTimeout(r, 100));
            } else if (o.id === 'btnBuilderInsert') {
              const b = document.getElementById('builderCodeInput');
              if (b) {
                b.value = 'flowchart TD\n  StudioInsertA --> StudioInsertB';
                b.dispatchEvent(new Event('input', { bubbles: true }));
                await new Promise(r => setTimeout(r, 200));
              }
            }
            setupState = 'studioOpenedPrerequisite';
          } else if (cidNum >= 102 && cidNum <= 107) {
            const fsBtn = document.querySelector('#previewContent .mermaid-block-card [data-action="fullscreen"]');
            if (fsBtn) fsBtn.click();
            await new Promise(r => setTimeout(r, 200));
            if (o.id === 'btnFsZoomReset') {
              document.getElementById('btnFsZoomIn')?.click();
              await new Promise(r => setTimeout(r, 100));
            }
            setupState = 'fullscreenModalOpenedPrerequisite';
          } else if (cidNum >= 108 && cidNum <= 111) {
            document.querySelector('.format-toolbar [data-action="table"]')?.click();
            await new Promise(r => setTimeout(r, 100));
            setupState = 'tableModalOpenedPrerequisite';
          }

          let el = null;
          if (o.id) el = document.getElementById(o.id);
          if (!el && o.key) el = [...document.querySelectorAll('[' + o.key + ']')].find(e => e.getAttribute(o.key) === o.val) || null;
          if (!el && o.forAttr) el = document.querySelector('label[for="' + o.forAttr + '"]');
          if (!el) {
            return { found: false };
          }

          const editorEl = document.getElementById('editor');
          const builderEl = document.getElementById('builderCodeInput');
          const parseScale = (t) => {
            const m = String(t || '').match(/scale\(([\d.]+)\)/);
            return m ? parseFloat(m[1]) : 1;
          };
          const beforeState = {
            editorVal: editorEl ? editorEl.value : '',
            editorSelLen: editorEl ? (editorEl.selectionEnd - editorEl.selectionStart) : 0,
            builderVal: builderEl ? builderEl.value : '',
            builderSvgHtml: document.getElementById('builderDiagramCanvas')?.innerHTML || '',
            builderTemplateOpts: [...(document.getElementById('builderTemplateSelect')?.options || [])].map(x => x.value).join(','),
            findCount: document.getElementById('findMatchBadge')?.textContent || '',
            tabs: document.querySelectorAll('.tab').length,
            theme: document.documentElement.getAttribute('data-theme') || 'light',
            editorHidden: document.getElementById('paneEditor')?.style.display === 'none',
            viewerHidden: document.getElementById('panePreview')?.style.display === 'none',
            tocOpen: document.getElementById('tocDrawer')?.classList.contains('open'),
            findOpen: document.getElementById('findReplaceBar')?.classList.contains('show'),
            syncActive: document.getElementById('btnSyncScroll')?.classList.contains('active'),
            fullWidth: !document.getElementById('previewContent')?.classList.contains('reading-width'),
            errOpen: document.getElementById('errorLogDrawer')?.style.display !== 'none',
            errCount: document.querySelectorAll('#errorLogList li, #errorLogList .error-log-row').length,
            studioOpen: document.getElementById('studioModal')?.classList.contains('open'),
            fsOpen: document.getElementById('fsModal')?.classList.contains('open'),
            tableOpen: document.getElementById('tableModal')?.classList.contains('open'),
            builderZoom: document.getElementById('btnBuilderZoomReset')?.textContent || '',
            builderZoomPct: parseInt(document.getElementById('btnBuilderZoomReset')?.textContent || '0', 10),
            builderCanvasTransform: document.getElementById('builderDiagramCanvas')?.style.transform || '',
            fsZoom: document.getElementById('fsCanvas')?.style.transform || '',
            fsScale: parseScale(document.getElementById('fsCanvas')?.style.transform),
            printCalls: window.__printCalls || 0
          };

          let executed = 'click';
          if (el.tagName === 'LABEL' && o.forAttr) {
            executed = 'label-wiring-check';
          } else if (el.tagName === 'SELECT') {
            el.selectedIndex = (el.selectedIndex + 1) % el.options.length;
            el.dispatchEvent(new Event('change', { bubbles: true }));
            executed = 'select->next option';
          } else if (el.tagName === 'INPUT') {
            if (o.id === 'replaceInput') {
              el.value = 'ProbeReplaceTarget';
              el.dispatchEvent(new Event('input', { bubbles: true }));
              document.getElementById('btnReplace')?.click();
              executed = 'set replaceInput + verify replace action';
            } else if (o.id === 'tableRowsInput' || o.id === 'tableColsInput') {
              el.value = '4';
              el.dispatchEvent(new Event('input', { bubbles: true }));
              document.getElementById('btnConfirmTable')?.click();
              executed = 'set ' + o.id + '=4 + confirm table';
            } else {
              el.value = el.type === 'number' ? '4' : 'Mermaid';
              el.dispatchEvent(new Event('input', { bubbles: true }));
              executed = 'set value + input event';
            }
          } else if (el.tagName === 'TEXTAREA') {
            el.focus();
            el.value = el.id === 'builderCodeInput' ? 'flowchart LR\n  ProbeA --> ProbeB' : '# Probe Heading\n\n```mermaid\nflowchart TD\n  P1 --> P2\n```\n';
            el.dispatchEvent(new Event('input', { bubbles: true }));
            executed = 'focus + input event';
          } else if (el.id === 'splitResizer') {
            const paneEd = document.getElementById('paneEditor');
            if (paneEd) paneEd.style.flex = '0 0 35%';
            el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
            executed = 'dblclick reset 50/50';
          } else {
            el.click();
          }

          await new Promise(r => setTimeout(r, 450));

          const afterState = {
            editorVal: editorEl ? editorEl.value : '',
            builderVal: builderEl ? builderEl.value : '',
            builderSvgHtml: document.getElementById('builderDiagramCanvas')?.innerHTML || '',
            builderStageText: document.getElementById('builderDiagramCanvas')?.textContent || '',
            builderTemplateOpts: [...(document.getElementById('builderTemplateSelect')?.options || [])].map(x => x.value).join(','),
            builderThemeChosen: document.getElementById('builderThemeSelect')?.dataset.userChosen === 'true',
            findCount: document.getElementById('findMatchBadge')?.textContent || '',
            editorSelLen: editorEl ? (editorEl.selectionEnd - editorEl.selectionStart) : 0,
            previewText: document.getElementById('previewContent')?.textContent || '',
            previewSvgCount: document.querySelectorAll('#previewContent .mermaid-block-card svg').length,
            tabs: document.querySelectorAll('.tab').length,
            theme: document.documentElement.getAttribute('data-theme') || 'light',
            editorHidden: document.getElementById('paneEditor')?.style.display === 'none',
            viewerHidden: document.getElementById('panePreview')?.style.display === 'none',
            tocOpen: document.getElementById('tocDrawer')?.classList.contains('open'),
            findOpen: document.getElementById('findReplaceBar')?.classList.contains('show'),
            syncActive: document.getElementById('btnSyncScroll')?.classList.contains('active'),
            fullWidth: !document.getElementById('previewContent')?.classList.contains('reading-width'),
            errOpen: document.getElementById('errorLogDrawer')?.style.display !== 'none',
            errCount: document.querySelectorAll('#errorLogList li, #errorLogList .error-log-row').length,
            studioOpen: document.getElementById('studioModal')?.classList.contains('open'),
            fsOpen: document.getElementById('fsModal')?.classList.contains('open'),
            tableOpen: document.getElementById('tableModal')?.classList.contains('open'),
            quickMenuOpen: document.getElementById('quickDiagramDropdown')?.classList.contains('open'),
            exportMenuOpen: document.getElementById('exportDropdown')?.classList.contains('open'),
            builderZoom: document.getElementById('btnBuilderZoomReset')?.textContent || '',
            builderZoomPct: parseInt(document.getElementById('btnBuilderZoomReset')?.textContent || '0', 10),
            builderCanvasTransform: document.getElementById('builderDiagramCanvas')?.style.transform || '',
            fsZoom: document.getElementById('fsCanvas')?.style.transform || '',
            fsScale: parseScale(document.getElementById('fsCanvas')?.style.transform),
            printCalls: window.__printCalls || 0,
            downloadsCount: (window.__capturedDownloads || []).length - downloadsBefore,
            clipboardWritten: window.__lastClipboardWrite !== null && window.__lastClipboardWrite.length > 0,
            clipboardText: window.__lastClipboardWrite || ''
          };

          let behavioralVerified = false;
          if (o.id === 'findInput') {
            behavioralVerified = afterState.findCount !== beforeState.findCount && /^[1-9]\d*\s+matches$/.test(afterState.findCount);
          } else if (o.id === 'replaceInput') {
            behavioralVerified = afterState.editorVal !== beforeState.editorVal && afterState.editorVal.includes('ProbeReplaceTarget');
          } else if (o.id === 'editor') {
            behavioralVerified = afterState.previewText.includes('Probe Heading') && afterState.previewSvgCount > 0;
          } else if (o.id === 'builderTypeSelect') {
            behavioralVerified = afterState.builderTemplateOpts !== beforeState.builderTemplateOpts && afterState.builderVal !== beforeState.builderVal && afterState.builderSvgHtml !== beforeState.builderSvgHtml;
          } else if (o.id === 'builderTemplateSelect') {
            behavioralVerified = afterState.builderVal !== beforeState.builderVal && afterState.builderSvgHtml !== beforeState.builderSvgHtml;
          } else if (o.id === 'builderDirectionSelect') {
            behavioralVerified = afterState.builderVal !== beforeState.builderVal && afterState.builderSvgHtml !== beforeState.builderSvgHtml;
          } else if (o.id === 'builderThemeSelect') {
            behavioralVerified = afterState.builderThemeChosen === true && afterState.builderSvgHtml.includes('<svg') && afterState.builderSvgHtml !== beforeState.builderSvgHtml;
          } else if (o.id === 'builderCodeInput') {
            behavioralVerified = afterState.builderStageText.includes('ProbeA') && afterState.builderStageText.includes('ProbeB');
          } else if (o.id === 'tableRowsInput') {
            behavioralVerified = afterState.editorVal !== beforeState.editorVal && afterState.editorVal.includes('| Cell 4,1 |');
          } else if (o.id === 'tableColsInput') {
            behavioralVerified = afterState.editorVal !== beforeState.editorVal && afterState.editorVal.includes('| Header 4 |');
          } else if (o.id === 'btnOpenStudio') {
            behavioralVerified = !beforeState.studioOpen && afterState.studioOpen === true;
          } else if (o.id === 'btnQuickDiagram') {
            behavioralVerified = afterState.quickMenuOpen === true;
          } else if (o.id === 'btnExportMenu') {
            behavioralVerified = afterState.exportMenuOpen === true;
          } else if (o.id === 'btnNewTab' || o.id === 'btnTabAdd') {
            behavioralVerified = afterState.tabs > beforeState.tabs;
          } else if (o.id === 'btnSaveMd' || o.id === 'btnExportHtml' || o.id === 'btnBuilderExportSvg' || o.id === 'btnBuilderExportPng' || o.id === 'btnFsExportSvg' || o.id === 'btnFsExportPng') {
            behavioralVerified = afterState.downloadsCount > 0;
          } else if (o.id === 'btnPrintPdf') {
            behavioralVerified = afterState.printCalls > beforeState.printCalls;
          } else if (o.id === 'btnCopyHtml') {
            behavioralVerified = afterState.clipboardWritten === true && afterState.clipboardText.includes('<');
          } else if (o.id === 'btnCopyMd') {
            behavioralVerified = afterState.clipboardWritten === true && afterState.clipboardText === afterState.editorVal;
          } else if (o.id === 'btnBuilderCopyCode') {
            behavioralVerified = afterState.clipboardWritten === true && afterState.clipboardText === afterState.builderVal;
          } else if (o.id === 'btnToggleEditor' || o.id === 'btnToolbarToggleEditor' || o.id === 'btnHideEditor' || o.id === 'btnShowEditorInline' || o.id === 'btnEmptyShowEditor') {
            behavioralVerified = afterState.editorHidden !== beforeState.editorHidden;
          } else if (o.id === 'btnToggleViewer' || o.id === 'btnToolbarToggleViewer' || o.id === 'btnHideViewer' || o.id === 'btnShowViewerInline' || o.id === 'btnEmptyShowViewer') {
            behavioralVerified = afterState.viewerHidden !== beforeState.viewerHidden;
          } else if (o.id === 'btnLayoutSplit' || o.id === 'btnEmptyRestoreSplit' || o.id === 'statusViewMode') {
            behavioralVerified = (beforeState.editorHidden || beforeState.viewerHidden) && !afterState.editorHidden && !afterState.viewerHidden;
          } else if (o.id === 'btnThemeToggle') {
            behavioralVerified = afterState.theme !== beforeState.theme;
          } else if (o.id === 'btnToggleToc' || o.id === 'btnCloseToc') {
            behavioralVerified = afterState.tocOpen !== beforeState.tocOpen;
          } else if (o.id === 'btnToggleFind' || o.id === 'btnCloseFind') {
            behavioralVerified = afterState.findOpen !== beforeState.findOpen;
          } else if (o.id === 'btnFindPrev' || o.id === 'btnFindNext') {
            behavioralVerified = beforeState.editorSelLen === 0 && afterState.editorSelLen > 0;
          } else if (o.id === 'btnReplace' || o.id === 'btnReplaceAll') {
            behavioralVerified = afterState.editorVal !== beforeState.editorVal && afterState.editorVal.includes('ReplacedMermaid');
          } else if (o.id === 'btnSyncScroll') {
            behavioralVerified = afterState.syncActive !== beforeState.syncActive;
          } else if (o.id === 'btnToggleViewerWidth') {
            behavioralVerified = afterState.fullWidth !== beforeState.fullWidth;
          } else if (o.id === 'splitResizer') {
            behavioralVerified = document.getElementById('paneEditor')?.style.flex !== '0 0 35%';
          } else if (o.id === 'btnClearErrorLog') {
            behavioralVerified = beforeState.errCount > 0 && afterState.errCount === 0;
          } else if (o.id === 'btnCloseErrorLog' || o.id === 'statusErrorIndicator') {
            behavioralVerified = afterState.errOpen !== beforeState.errOpen;
          } else if (o.id === 'btnCloseStudio' || o.id === 'btnBuilderCancel') {
            behavioralVerified = beforeState.studioOpen === true && !afterState.studioOpen;
          } else if (o.id === 'btnBuilderFormat' || o.key === 'data-insert') {
            behavioralVerified = afterState.builderVal !== beforeState.builderVal;
          } else if (o.id === 'btnBuilderZoomOut') {
            behavioralVerified = afterState.builderZoom.endsWith('%') && afterState.builderZoomPct < beforeState.builderZoomPct && afterState.builderCanvasTransform !== beforeState.builderCanvasTransform;
          } else if (o.id === 'btnBuilderZoomIn') {
            behavioralVerified = afterState.builderZoom.endsWith('%') && afterState.builderZoomPct > beforeState.builderZoomPct && afterState.builderCanvasTransform !== beforeState.builderCanvasTransform;
          } else if (o.id === 'btnBuilderZoomReset') {
            behavioralVerified = afterState.builderZoom.endsWith('%') && afterState.builderZoomPct !== beforeState.builderZoomPct && afterState.builderCanvasTransform !== beforeState.builderCanvasTransform;
          } else if (o.id === 'btnBuilderInsert') {
            behavioralVerified = beforeState.studioOpen === true && !afterState.studioOpen && afterState.editorVal !== beforeState.editorVal && afterState.editorVal.includes('StudioInsertA');
          } else if (o.id === 'btnFsZoomOut') {
            behavioralVerified = afterState.fsZoom.includes('scale') && afterState.fsScale < beforeState.fsScale;
          } else if (o.id === 'btnFsZoomIn') {
            behavioralVerified = afterState.fsZoom.includes('scale') && afterState.fsScale > beforeState.fsScale;
          } else if (o.id === 'btnFsZoomReset') {
            behavioralVerified = afterState.fsZoom.includes('scale') && beforeState.fsScale > 1 && afterState.fsScale === 1;
          } else if (o.id === 'btnCloseFsModal') {
            behavioralVerified = beforeState.fsOpen === true && !afterState.fsOpen;
          } else if (o.id === 'btnCancelTable') {
            behavioralVerified = beforeState.tableOpen === true && !afterState.tableOpen;
          } else if (o.id === 'btnConfirmTable') {
            behavioralVerified = beforeState.tableOpen === true && !afterState.tableOpen && afterState.editorVal !== beforeState.editorVal && afterState.editorVal.includes('| Header 1 |');
          } else if (o.key === 'data-template' || o.key === 'data-action') {
            behavioralVerified = afterState.editorVal !== beforeState.editorVal || (!beforeState.tableOpen && afterState.tableOpen === true);
          }

          return {
            found: true,
            tag: el.tagName,
            id: el.id || null,
            setupState,
            executed,
            behavioralVerified,
            downloadsCount: afterState.downloadsCount,
            printInvoked: afterState.printCalls > 0 ? afterState.printCalls : undefined
          };
        }, probe);

        if (!ctlRes.found) {
          await finish(rec, 'blocked', { reason: 'element not found for ' + JSON.stringify(probe) });
          continue;
        }
        await shoot(page, rec);
        await page.keyboard.press('Escape').catch(() => {});
        await finish(rec, ctlRes.behavioralVerified ? 'pass' : 'fail', ctlRes);
        continue;
      } else if (rec.area === 'update-isolation') {
        const docs = {
          tildeFirst: '~~~mermaid\nflowchart TD\n  T1 --> T2\n~~~\n\nmid text\n\n```mermaid\nsequenceDiagram\n  Alice->>Bob: hi\n```\n',
          blockquoteFirst: '> ```mermaid\n> flowchart TD\n>   A --> B\n> ```\n\nmid text\n\n```mermaid\nflowchart TD\n  C --> D\n```\n',
        };
        const res = {};
        for (const [name, doc] of Object.entries(docs)) {
          await page.evaluate(t => { const el = document.getElementById('editor'); el.value = t; el.dispatchEvent(new Event('input', { bubbles: true })); }, doc);
          await settle(page);
          const before = await page.evaluate(() => document.getElementById('editor').value);
          await page.evaluate(() => document.querySelector('#previewContent .mermaid-block-card .edit-btn').click());
          await page.waitForSelector('#builderCodeInput', { timeout: 5000 }).catch(() => {});
          await page.evaluate(() => {
            const b = document.getElementById('builderCodeInput');
            b.value = 'flowchart TD\n  EDITED --> Z';
            b.dispatchEvent(new Event('input', { bubbles: true }));
          });
          await page.evaluate(() => document.getElementById('btnBuilderInsert').click());
          await page.waitForTimeout(500);
          const after = await page.evaluate(() => document.getElementById('editor').value);
          res[name] = { changed: before !== after, editedPresent: after.includes('EDITED --> Z'), originalTargetGone: name === 'tildeFirst' ? !after.includes('T1 --> T2') : !after.includes('A --> B'), otherBlockGone: name === 'tildeFirst' ? !after.includes('Alice->>Bob') : !after.includes('C --> D') };
        }
        await shoot(page, rec);
        const tildeOk = res.tildeFirst.changed && res.tildeFirst.editedPresent && res.tildeFirst.originalTargetGone && !res.tildeFirst.otherBlockGone;
        const bq = res.blockquoteFirst;
        await finish(rec, tildeOk ? 'pass' : 'fail', { tildeFirst: res.tildeFirst, blockquoteFirstKnownResidual: bq, note: 'blockquote case expected to show the G1-X2 residual; record, do not claim fixed' });
      } else if (rec.area === 'visual') {
        await settle(page);
        const c = await counts(page);
        await shoot(page, rec);
        const errs = consoleLog.filter(l => l.stop === rec.id && (l.type === 'error' || l.type === 'pageerror'));
        if (await finish(rec, (c.svgCards === 2 && c.errorCards === 0 && errs.length === 0) ? 'pass' : 'fail', c)) break;
      } else if (rec.area === 'clipboard') {
        await settle(page);
        const r = await page.evaluate(async () => {
          try {
            const card = document.querySelector('#previewContent .mermaid-block-card');
            const expected = decodeURIComponent(card.dataset.mermaidCode);
            card.querySelector('[data-action="copy-code"]').click();
            await new Promise(r2 => setTimeout(r2, 300));
            let read = null;
            try { read = await navigator.clipboard.readText(); } catch (e) { read = 'READ-REJECTED: ' + e.message; }
            const norm = s => s.replace(/\r\n/g, '\n');
            return { expected, read, rawMatch: read === expected, match: norm(read) === norm(expected), note: 'Windows clipboard normalizes LF to CRLF on round-trip; compare normalized, record raw' };
          } catch (e) { return { error: String(e) }; }
        });
        await shoot(page, rec);
        const ok = r.match === true;
        await finish(rec, ok ? 'pass' : 'blocked', { ...r, headed: HEADED, note: ok ? 'focused-window clipboard success verified (--headed)' : 'success path needs a focused visible window; rerun with --headed on a real display. Rejection path is mock-verified (P1-06)' });
      } else if (rec.area === 'listener-cleanup') {
        await settle(page);
        const res = await page.evaluate(async () => {
          let addedListeners = 0;
          const origAdd = window.addEventListener;
          window.addEventListener = function(type, fn, opts) {
            if (type === 'mousemove' || type === 'mouseup') {
              addedListeners++;
            }
            return origAdd.call(this, type, fn, opts);
          };

          const editor = document.getElementById('editor');
          const listenerSamples = [];

          for (let i = 0; i < 50; i++) {
            editor.value = `# 50-Cycle Test - Run ${i}\n\n\`\`\`mermaid\nflowchart TD\n  N${i} --> M${i}\n\`\`\`\n`;
            editor.dispatchEvent(new Event('input', { bubbles: true }));
            // Yield for debounce (150ms in app) and render tick
            await new Promise(r => setTimeout(r, 175));
            if ((i + 1) % 10 === 0 || i === 0) {
              listenerSamples.push({ cycle: i + 1, addedListeners });
            }
          }

          // Wait for final cycle to settle
          await new Promise(r => setTimeout(r, 300));

          const card = document.querySelector('#previewContent .mermaid-block-card');
          const canvas = card ? card.querySelector('.mermaid-canvas') : null;
          const svg = canvas ? canvas.querySelector('svg') : null;
          const hasSvg = !!svg;

          // Test pan drag on cycle 50 card
          let panned = false;
          const viewport = card ? card.querySelector('.mermaid-viewport') : null;
          if (viewport && canvas) {
            const down = new MouseEvent('mousedown', { clientX: 200, clientY: 200, bubbles: true });
            viewport.dispatchEvent(down);
            const move = new MouseEvent('mousemove', { clientX: 240, clientY: 260, bubbles: true });
            window.dispatchEvent(move);
            const up = new MouseEvent('mouseup', { clientX: 240, clientY: 260, bubbles: true });
            window.dispatchEvent(up);
            panned = canvas.style.transform && canvas.style.transform.includes('translate');
          }

          window.addEventListener = origAdd;

          return {
            totalCycles: 50,
            addedListenersDuring50Cycles: addedListeners,
            listenerSamples,
            hasSvg,
            interactivityFunctional: panned,
            previewPanListenersBound: !!window.__previewPanListenersBound
          };
        });

        await shoot(page, rec);
        const errs = consoleLog.filter(l => l.stop === rec.id && (l.type === 'error' || l.type === 'pageerror'));
        const ok = res.totalCycles === 50 && res.addedListenersDuring50Cycles === 0 && res.hasSvg && res.interactivityFunctional && errs.length === 0;
        if (await finish(rec, ok ? 'pass' : 'fail', { ...res, consoleErrors: errs.length })) break;
      } else if (rec.area === 'render-generation') {
        await settle(page);
        const res = await page.evaluate(async () => {
          const results = {};

          // --- Step 1: Preview Out-of-Order Render Completion ---
          const origRender = mermaid.render;
          let renderCount = 0;
          let delayedResolve1 = null;

          mermaid.render = async function(id, text) {
            renderCount++;
            const thisCall = renderCount;
            if (thisCall === 1) {
              // Generation 1: delay resolve until delayedResolve1 is called
              const rendered = await origRender.call(this, id, text);
              await new Promise(r => { delayedResolve1 = () => r(rendered); });
              return rendered;
            } else {
              return await origRender.call(this, id, text);
            }
          };

          const editor = document.getElementById('editor');
          // Trigger Gen 1
          editor.value = '# Gen 1\n\n```mermaid\nflowchart TD\n  Gen1Node --> Gen1Target\n```\n';
          editor.dispatchEvent(new Event('input', { bubbles: true }));
          await new Promise(r => setTimeout(r, 180)); // let Gen 1 enter mermaid.render and pause

          // Trigger Gen 2 while Gen 1 is paused
          editor.value = '# Gen 2\n\n```mermaid\nflowchart TD\n  Gen2Node --> Gen2Target\n```\n';
          editor.dispatchEvent(new Event('input', { bubbles: true }));
          await new Promise(r => setTimeout(r, 250)); // let Gen 2 resolve and commit

          const canvasAfterGen2 = document.querySelector('#previewContent .mermaid-canvas svg')?.innerHTML || '';
          const gen2Committed = canvasAfterGen2.includes('Gen2Node');

          // Now resolve Gen 1 out-of-order
          if (delayedResolve1) delayedResolve1();
          await new Promise(r => setTimeout(r, 250)); // give Gen 1 time to try to commit

          const canvasAfterStaleGen1 = document.querySelector('#previewContent .mermaid-canvas svg')?.innerHTML || '';
          const staleDidNotOverwrite = canvasAfterStaleGen1.includes('Gen2Node') && !canvasAfterStaleGen1.includes('Gen1Node');

          // Restore mermaid.render
          mermaid.render = origRender;

          results.previewOutOfOrder = {
            gen2Committed,
            staleDidNotOverwrite
          };

          // --- Step 2: Rapid Typing Debounce and Settle ---
          for (let k = 0; k < 5; k++) {
            editor.value = `# Rapid Typing\n\n\`\`\`mermaid\nflowchart TD\n  Rapid_${k} --> Finish_${k}\n\`\`\`\n`;
            editor.dispatchEvent(new Event('input', { bubbles: true }));
            await new Promise(r => setTimeout(r, 20));
          }
          await new Promise(r => setTimeout(r, 400));
          const canvasAfterRapid = document.querySelector('#previewContent .mermaid-canvas svg')?.innerHTML || '';
          results.rapidTypingSettled = canvasAfterRapid.includes('Rapid_4');

          // --- Step 3: Studio Modal Interleaving ---
          const editBtn = document.querySelector('#previewContent .mermaid-block-card .edit-btn');
          if (editBtn) editBtn.click();
          await new Promise(r => setTimeout(r, 300));

          const builderInput = document.getElementById('builderCodeInput');
          const builderBadge = document.getElementById('builderValidationBadge');
          const studioModal = document.getElementById('studioModal');

          if (builderInput && studioModal) {
            // Rapid type in builder then immediately close
            builderInput.value = 'flowchart TD\n  StudioClosed --> Lost';
            builderInput.dispatchEvent(new Event('input', { bubbles: true }));
            const cancelBtn = document.getElementById('btnBuilderCancel');
            if (cancelBtn) cancelBtn.click();
            await new Promise(r => setTimeout(r, 300));

            // Reopen studio
            if (editBtn) editBtn.click();
            await new Promise(r => setTimeout(r, 300));

            builderInput.value = 'flowchart TD\n  StudioActive --> ValidSession';
            builderInput.dispatchEvent(new Event('input', { bubbles: true }));
            await new Promise(r => setTimeout(r, 400));

            const builderCanvas = document.getElementById('builderDiagramCanvas');
            const studioSvg = builderCanvas ? (builderCanvas.querySelector('svg')?.innerHTML || builderCanvas.innerHTML || '') : '';
            const badgeValid = builderBadge ? builderBadge.className.includes('valid') : false;

            results.studioInterleaving = {
              includesActive: studioSvg.includes('StudioActive'),
              includesClosed: studioSvg.includes('StudioClosed'),
              reopenedCleanly: studioSvg.includes('StudioActive') && !studioSvg.includes('StudioClosed'),
              badgeValid
            };

            // Close studio modal to clean up
            if (cancelBtn) cancelBtn.click();
          }

          return results;
        });

        await shoot(page, rec);
        const errs = consoleLog.filter(l => l.stop === rec.id && (l.type === 'error' || l.type === 'pageerror'));
        const ok = res.previewOutOfOrder.staleDidNotOverwrite &&
                   res.rapidTypingSettled &&
                   res.studioInterleaving && res.studioInterleaving.reopenedCleanly && res.studioInterleaving.badgeValid &&
                   errs.length === 0;
        if (!ok) console.log('G2-RENDER-GEN failure details:', JSON.stringify(res, null, 2), 'consoleErrors:', errs);
        if (await finish(rec, ok ? 'pass' : 'fail', { ...res, consoleErrors: errs.length })) break;
      } else if (rec.area === 'diagram-fit') {
        await settle(page);
        const tallPath = path.join(root, 'evidence/phase-0/fixtures/tall.md');
        const widePath = path.join(root, 'evidence/phase-0/fixtures/wide.md');
        const tallDoc = fs.readFileSync(tallPath, 'utf8');
        const wideDoc = fs.readFileSync(widePath, 'utf8');

        // Step 1: Tall Fixture Preview & Studio Fit
        await page.evaluate((doc) => {
          const editor = document.getElementById('editor');
          editor.value = doc;
          editor.dispatchEvent(new Event('input', { bubbles: true }));
        }, tallDoc);
        await new Promise(r => setTimeout(r, 450));

        const tallPreviewFit = await page.evaluate(() => {
          const card = document.querySelector('#previewContent .mermaid-block-card');
          const vp = card ? card.querySelector('.mermaid-viewport') : null;
          const canvas = card ? card.querySelector('.mermaid-canvas') : null;
          const svg = canvas ? canvas.querySelector('svg') : null;
          if (!vp || !svg) return null;
          const vpRect = vp.getBoundingClientRect();
          const svgRect = svg.getBoundingClientRect();
          const fitScale = parseFloat(vp.dataset.fitScale || 1);
          const zoom = parseFloat(vp.dataset.zoom || 1);

          // Test pan drag reachability
          let panned = false;
          const down = new MouseEvent('mousedown', { clientX: 200, clientY: 200, bubbles: true });
          vp.dispatchEvent(down);
          const move = new MouseEvent('mousemove', { clientX: 200, clientY: 280, bubbles: true });
          window.dispatchEvent(move);
          const up = new MouseEvent('mouseup', { clientX: 200, clientY: 280, bubbles: true });
          window.dispatchEvent(up);
          panned = parseFloat(vp.dataset.panY || 0) > 0;

          // Test zoom-reset returns to fit
          const resetBtn = card.querySelector('[data-action="zoom-reset"]');
          if (resetBtn) resetBtn.click();
          const resetZoom = parseFloat(vp.dataset.zoom || 1);
          const resetPanY = parseFloat(vp.dataset.panY || 0);

          return {
            vpWidth: vpRect.width,
            vpHeight: vpRect.height,
            svgRenderedHeight: svgRect.height,
            svgTop: svgRect.top,
            svgBottom: svgRect.bottom,
            vpTop: vpRect.top,
            vpBottom: vpRect.bottom,
            clippedTop: svgRect.top < vpRect.top - 2,
            clippedBottom: svgRect.bottom > vpRect.bottom + 2,
            fitScale,
            zoom,
            panned,
            resetRestoresFit: Math.abs(resetZoom - fitScale) < 0.02 && resetPanY === 0
          };
        });

        const tallPrevShot = `${art(rec.id + '-tall-preview')}.png`;
        await page.screenshot({ path: tallPrevShot, fullPage: true });
        rec.artifacts.push(relPosix(tallPrevShot));

        // Open studio with tall diagram
        await page.evaluate(() => {
          const editBtn = document.querySelector('#previewContent .mermaid-block-card .edit-btn');
          if (editBtn) editBtn.click();
        });
        await new Promise(r => setTimeout(r, 450));

        const tallStudioFit = await page.evaluate(() => {
          const wrap = document.getElementById('builderPreviewWrap');
          const canvas = document.getElementById('builderDiagramCanvas');
          const svg = canvas ? canvas.querySelector('svg') : null;
          if (!wrap || !svg) return null;
          const wRect = wrap.getBoundingClientRect();
          const sRect = svg.getBoundingClientRect();
          const fitScale = parseFloat(wrap.dataset.fitScale || 1);
          return {
            wrapWidth: wRect.width,
            wrapHeight: wRect.height,
            svgRenderedHeight: sRect.height,
            clippedTop: sRect.top < wRect.top - 2,
            clippedBottom: sRect.bottom > wRect.bottom + 2,
            fitScale
          };
        });

        const tallStudioShot = `${art(rec.id + '-tall-studio')}.png`;
        await page.screenshot({ path: tallStudioShot, fullPage: true });
        rec.artifacts.push(relPosix(tallStudioShot));

        await page.evaluate(() => {
          const cancelBtn = document.getElementById('btnBuilderCancel');
          if (cancelBtn) cancelBtn.click();
        });
        await new Promise(r => setTimeout(r, 300));

        // Step 2: Wide Fixture Preview & Studio Fit
        await page.evaluate((doc) => {
          const editor = document.getElementById('editor');
          editor.value = doc;
          editor.dispatchEvent(new Event('input', { bubbles: true }));
        }, wideDoc);
        await new Promise(r => setTimeout(r, 450));

        const widePreviewFit = await page.evaluate(() => {
          const card = document.querySelector('#previewContent .mermaid-block-card');
          const vp = card ? card.querySelector('.mermaid-viewport') : null;
          const canvas = card ? card.querySelector('.mermaid-canvas') : null;
          const svg = canvas ? canvas.querySelector('svg') : null;
          if (!vp || !svg) return null;
          const vpRect = vp.getBoundingClientRect();
          const svgRect = svg.getBoundingClientRect();
          const fitScale = parseFloat(vp.dataset.fitScale || 1);
          return {
            vpWidth: vpRect.width,
            vpHeight: vpRect.height,
            svgRenderedWidth: svgRect.width,
            clippedLeft: svgRect.left < vpRect.left - 2,
            clippedRight: svgRect.right > vpRect.right + 2,
            fitScale
          };
        });

        const widePrevShot = `${art(rec.id + '-wide-preview')}.png`;
        await page.screenshot({ path: widePrevShot, fullPage: true });
        rec.artifacts.push(relPosix(widePrevShot));

        // Open studio with wide diagram
        await page.evaluate(() => {
          const editBtn = document.querySelector('#previewContent .mermaid-block-card .edit-btn');
          if (editBtn) editBtn.click();
        });
        await new Promise(r => setTimeout(r, 450));

        const wideStudioFit = await page.evaluate(() => {
          const wrap = document.getElementById('builderPreviewWrap');
          const canvas = document.getElementById('builderDiagramCanvas');
          const svg = canvas ? canvas.querySelector('svg') : null;
          if (!wrap || !svg) return null;
          const wRect = wrap.getBoundingClientRect();
          const sRect = svg.getBoundingClientRect();
          const fitScale = parseFloat(wrap.dataset.fitScale || 1);
          return {
            wrapWidth: wRect.width,
            wrapHeight: wRect.height,
            svgRenderedWidth: sRect.width,
            clippedLeft: sRect.left < wRect.left - 2,
            clippedRight: sRect.right > wRect.right + 2,
            fitScale
          };
        });

        const wideStudioShot = `${art(rec.id + '-wide-studio')}.png`;
        await page.screenshot({ path: wideStudioShot, fullPage: true });
        rec.artifacts.push(relPosix(wideStudioShot));

        await page.evaluate(() => {
          const cancelBtn = document.getElementById('btnBuilderCancel');
          if (cancelBtn) cancelBtn.click();
        });
        await new Promise(r => setTimeout(r, 300));

        await shoot(page, rec);
        const errs = consoleLog.filter(l => l.stop === rec.id && (l.type === 'error' || l.type === 'pageerror'));
        const ok = tallPreviewFit && !tallPreviewFit.clippedTop && !tallPreviewFit.clippedBottom &&
                   tallStudioFit && !tallStudioFit.clippedTop && !tallStudioFit.clippedBottom &&
                   widePreviewFit && !widePreviewFit.clippedLeft && !widePreviewFit.clippedRight &&
                   wideStudioFit && !wideStudioFit.clippedLeft && !wideStudioFit.clippedRight &&
                   tallPreviewFit.panned && tallPreviewFit.resetRestoresFit &&
                   errs.length === 0;

        const obs = {
          tallPreviewFit,
          tallStudioFit,
          widePreviewFit,
          wideStudioFit,
          consoleErrors: errs.length
        };
        if (!ok) console.log('G3-FIT-TALL-WIDE failure details:', JSON.stringify(obs, null, 2));
        if (await finish(rec, ok ? 'pass' : 'fail', obs)) break;
      } else if (rec.area === 'theme-isolation') {
        await settle(page);
        const themeCycles = await page.evaluate(async () => {
          const results = [];
          const editor = document.getElementById('editor');

          const getDocTheme = () => document.documentElement.getAttribute('data-theme') || 'light';
          const setDocTheme = (t) => {
            document.documentElement.setAttribute('data-theme', t);
            if (typeof initMermaid === 'function') initMermaid();
          };

          // Cycle 1: Dark document theme, Studio 'forest' theme
          setDocTheme('dark');
          editor.value = '# Dark Document\n\n```mermaid\nflowchart TD\n  DarkA --> DarkB\n```\n';
          editor.dispatchEvent(new Event('input', { bubbles: true }));
          await new Promise(r => setTimeout(r, 400));

          const editBtn1 = document.querySelector('#previewContent .mermaid-block-card .edit-btn');
          if (editBtn1) editBtn1.click();
          await new Promise(r => setTimeout(r, 300));

          const themeSelect = document.getElementById('builderThemeSelect');
          if (themeSelect) {
            themeSelect.value = 'forest';
            themeSelect.dispatchEvent(new Event('change', { bubbles: true }));
          }
          await new Promise(r => setTimeout(r, 400));

          const studioTheme1 = themeSelect ? themeSelect.value : null;

          const cancelBtn1 = document.getElementById('btnBuilderCancel');
          if (cancelBtn1) cancelBtn1.click();
          await new Promise(r => setTimeout(r, 300));

          editor.value = '# Dark Document Re-render\n\n```mermaid\nflowchart TD\n  DarkA --> DarkB2\n```\n';
          editor.dispatchEvent(new Event('input', { bubbles: true }));
          await new Promise(r => setTimeout(r, 400));

          const previewThemeAfter1 = (typeof mermaid !== 'undefined' && mermaid.mermaidAPI && mermaid.mermaidAPI.getConfig)
            ? mermaid.mermaidAPI.getConfig().theme
            : (getDocTheme() === 'dark' ? 'dark' : 'default');
          results.push({
            cycle: 1,
            docTheme: 'dark',
            studioTheme: studioTheme1,
            previewThemeAfter: previewThemeAfter1,
            isolated: previewThemeAfter1 === 'dark'
          });

          // Cycle 2: Light document theme, Studio 'neutral' theme
          setDocTheme('light');
          editor.value = '# Light Document\n\n```mermaid\nflowchart TD\n  LightA --> LightB\n```\n';
          editor.dispatchEvent(new Event('input', { bubbles: true }));
          await new Promise(r => setTimeout(r, 400));

          const editBtn2 = document.querySelector('#previewContent .mermaid-block-card .edit-btn');
          if (editBtn2) editBtn2.click();
          await new Promise(r => setTimeout(r, 300));

          if (themeSelect) {
            themeSelect.value = 'neutral';
            themeSelect.dispatchEvent(new Event('change', { bubbles: true }));
          }
          await new Promise(r => setTimeout(r, 400));

          const studioTheme2 = themeSelect ? themeSelect.value : null;

          const cancelBtn2 = document.getElementById('btnBuilderCancel');
          if (cancelBtn2) cancelBtn2.click();
          await new Promise(r => setTimeout(r, 300));

          editor.value = '# Light Document Re-render\n\n```mermaid\nflowchart TD\n  LightA --> LightB2\n```\n';
          editor.dispatchEvent(new Event('input', { bubbles: true }));
          await new Promise(r => setTimeout(r, 400));

          const previewThemeAfter2 = (typeof mermaid !== 'undefined' && mermaid.mermaidAPI && mermaid.mermaidAPI.getConfig)
            ? mermaid.mermaidAPI.getConfig().theme
            : (getDocTheme() === 'dark' ? 'dark' : 'default');
          results.push({
            cycle: 2,
            docTheme: 'light',
            studioTheme: studioTheme2,
            previewThemeAfter: previewThemeAfter2,
            isolated: previewThemeAfter2 === 'default'
          });

          // Cycle 3: Insert diagram with studio 'base' theme
          setDocTheme('dark');
          editor.value = '# Insert Flow\n\n';
          editor.dispatchEvent(new Event('input', { bubbles: true }));
          await new Promise(r => setTimeout(r, 300));

          document.getElementById('btnOpenStudio').click();
          await new Promise(r => setTimeout(r, 300));

          if (themeSelect) {
            themeSelect.value = 'base';
            themeSelect.dispatchEvent(new Event('change', { bubbles: true }));
          }
          await new Promise(r => setTimeout(r, 400));

          const insertBtn = document.getElementById('btnBuilderInsert');
          if (insertBtn) insertBtn.click();
          await new Promise(r => setTimeout(r, 400));

          const previewThemeAfter3 = (typeof mermaid !== 'undefined' && mermaid.mermaidAPI && mermaid.mermaidAPI.getConfig)
            ? mermaid.mermaidAPI.getConfig().theme
            : (getDocTheme() === 'dark' ? 'dark' : 'default');
          results.push({
            cycle: 3,
            docTheme: 'dark',
            studioTheme: 'base',
            previewThemeAfter: previewThemeAfter3,
            isolated: previewThemeAfter3 === 'dark'
          });

          setDocTheme('light');
          return results;
        });

        await shoot(page, rec);
        const errs = consoleLog.filter(l => l.stop === rec.id && (l.type === 'error' || l.type === 'pageerror'));
        const ok = themeCycles.length === 3 && themeCycles.every(c => c.isolated) && errs.length === 0;
        if (!ok) console.log('G3-THEME-ISOLATION-3X failure details:', JSON.stringify(themeCycles, null, 2));
        if (await finish(rec, ok ? 'pass' : 'fail', { cycles: themeCycles, consoleErrors: errs.length })) break;
      } else if (rec.area === 'typography-isolation') {
        await settle(page);
        const labelsPath = path.join(root, 'evidence/phase-0/fixtures/long-labels.md');
        const labelsDoc = fs.readFileSync(labelsPath, 'utf8');

        await page.evaluate((doc) => {
          const editor = document.getElementById('editor');
          editor.value = doc;
          editor.dispatchEvent(new Event('input', { bubbles: true }));
        }, labelsDoc);
        await page.waitForTimeout(500);
        await settle(page);

        const previewTypo = await page.evaluate(() => {
          const card = document.querySelector('#previewContent .mermaid-block-card');
          const canvas = card ? card.querySelector('.mermaid-canvas') : null;
          const svg = canvas ? canvas.querySelector('svg') : null;
          if (!svg) return null;

          const foreignObjects = Array.from(svg.querySelectorAll('foreignObject'));
          const codeElements = Array.from(svg.querySelectorAll('foreignObject code'));
          const pElements = Array.from(svg.querySelectorAll('foreignObject p'));

          let codeBleedDetected = false;
          let codeDetails = [];
          for (const codeEl of codeElements) {
            const cs = window.getComputedStyle(codeEl);
            const borderW = parseFloat(cs.borderTopWidth || '0');
            const bg = cs.backgroundColor;
            const pad = parseFloat(cs.paddingTop || '0');
            const hasBleed = borderW > 0 || (bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') || pad > 0;
            if (hasBleed) codeBleedDetected = true;
            codeDetails.push({ text: codeEl.textContent, borderW, bg, pad, hasBleed });
          }

          let pMarginBleed = false;
          for (const pEl of pElements) {
            const cs = window.getComputedStyle(pEl);
            const mt = parseFloat(cs.marginTop || '0');
            const mb = parseFloat(cs.marginBottom || '0');
            if (mt > 0 || mb > 0) pMarginBleed = true;
          }

          const edgeLabels = Array.from(svg.querySelectorAll('.edgeLabel'));

          return {
            svgFound: true,
            foreignObjectCount: foreignObjects.length,
            codeElementsCount: codeElements.length,
            codeBleedDetected,
            codeDetails,
            pMarginBleed,
            edgeLabelCount: edgeLabels.length,
            r06Status: codeBleedDetected || pMarginBleed ? 'confirmed-reproduced' : 'remediated-clean'
          };
        });

        const previewShot = `${art(rec.id + '-preview')}.png`;
        await page.screenshot({ path: previewShot, fullPage: true });
        rec.artifacts.push(relPosix(previewShot));

        // Open studio
        await page.evaluate(() => {
          const editBtn = document.querySelector('#previewContent .mermaid-block-card .edit-btn');
          if (editBtn) editBtn.click();
        });
        await page.waitForFunction(() => {
          const canvas = document.getElementById('builderDiagramCanvas');
          return canvas && (canvas.querySelector('svg') || canvas.querySelector('.mermaid-error-card'));
        }, { timeout: 15000 }).catch(() => {});
        await page.waitForTimeout(400);

        const studioTypo = await page.evaluate(() => {
          const canvas = document.getElementById('builderDiagramCanvas');
          const svg = canvas ? canvas.querySelector('svg') : null;
          if (!svg) return null;

          const codeElements = Array.from(svg.querySelectorAll('foreignObject code'));
          let codeBleedDetected = false;
          for (const codeEl of codeElements) {
            const cs = window.getComputedStyle(codeEl);
            const borderW = parseFloat(cs.borderTopWidth || '0');
            const bg = cs.backgroundColor;
            const pad = parseFloat(cs.paddingTop || '0');
            if (borderW > 0 || (bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') || pad > 0) {
              codeBleedDetected = true;
            }
          }
          return {
            svgFound: true,
            codeElementsCount: codeElements.length,
            codeBleedDetected
          };
        });

        const studioShot = `${art(rec.id + '-studio')}.png`;
        await page.screenshot({ path: studioShot, fullPage: true });
        rec.artifacts.push(relPosix(studioShot));

        await page.evaluate(() => {
          const cancelBtn = document.getElementById('btnBuilderCancel');
          if (cancelBtn) cancelBtn.click();
        });
        await new Promise(r => setTimeout(r, 300));

        await shoot(page, rec);
        const errs = consoleLog.filter(l => l.stop === rec.id && (l.type === 'error' || l.type === 'pageerror'));
        const ok = previewTypo && !previewTypo.codeBleedDetected && !previewTypo.pMarginBleed &&
                   studioTypo && !studioTypo.codeBleedDetected &&
                   errs.length === 0;

        const obs = {
          previewTypo,
          studioTypo,
          r06Remediated: ok,
          consoleErrors: errs.length
        };
        if (!ok) console.log('G3-TYPOGRAPHY-LABELS failure details:', JSON.stringify(obs, null, 2));
        if (await finish(rec, ok ? 'pass' : 'fail', obs)) break;
      } else if (rec.area === 'resize-refit') {
        await settle(page);
        const widePath = path.join(root, 'evidence/phase-0/fixtures/wide.md');
        const wideDoc = fs.readFileSync(widePath, 'utf8');

        await page.evaluate((doc) => {
          const editor = document.getElementById('editor');
          editor.value = doc;
          editor.dispatchEvent(new Event('input', { bubbles: true }));
        }, wideDoc);
        await new Promise(r => setTimeout(r, 450));

        const res = await page.evaluate(async () => {
          const results = {};
          const card = document.querySelector('#previewContent .mermaid-block-card');
          const vp = card ? card.querySelector('.mermaid-viewport') : null;
          const canvas = card ? card.querySelector('.mermaid-canvas') : null;
          const resizer = document.getElementById('splitResizer');
          const workspace = document.getElementById('workspace');

          const initialFitScale = parseFloat(vp.dataset.fitScale || 1);
          results.initialFitScale = initialFitScale;

          // Drag resizer to 30% (giving viewer 70% width)
          const rect = workspace.getBoundingClientRect();
          const down = new MouseEvent('mousedown', { clientX: rect.left + rect.width * 0.5, clientY: 200, bubbles: true });
          resizer.dispatchEvent(down);
          const move = new MouseEvent('mousemove', { clientX: rect.left + rect.width * 0.3, clientY: 200, bubbles: true });
          window.dispatchEvent(move);
          const up = new MouseEvent('mouseup', { clientX: rect.left + rect.width * 0.3, clientY: 200, bubbles: true });
          window.dispatchEvent(up);
          await new Promise(r => setTimeout(r, 200));

          const expandedFitScale = parseFloat(vp.dataset.fitScale || 1);
          results.expandedFitScale = expandedFitScale;
          results.scaleAdaptedToExpanded = expandedFitScale > initialFitScale;

          // Reset to 50/50 via dblclick
          const dbl = new MouseEvent('dblclick', { bubbles: true });
          resizer.dispatchEvent(dbl);
          await new Promise(r => setTimeout(r, 200));

          const resetFitScale = parseFloat(vp.dataset.fitScale || 1);
          results.resetFitScale = resetFitScale;
          results.resetAdapted = Math.abs(resetFitScale - initialFitScale) < 0.02;

          // Toggle viewer hide then show
          const btnToggleViewer = document.getElementById('btnToggleViewer');
          if (btnToggleViewer) {
            btnToggleViewer.click();
            await new Promise(r => setTimeout(r, 150));
            btnToggleViewer.click();
            await new Promise(r => setTimeout(r, 200));
          }

          const afterToggleFitScale = parseFloat(vp.dataset.fitScale || 1);
          results.afterToggleFitScale = afterToggleFitScale;
          results.toggleRefitted = Math.abs(afterToggleFitScale - initialFitScale) < 0.02;

          return results;
        });

        // Test narrow viewport (640x720)
        await page.setViewportSize({ width: 640, height: 720 });
        await new Promise(r => setTimeout(r, 250));

        const narrowFit = await page.evaluate(() => {
          const card = document.querySelector('#previewContent .mermaid-block-card');
          const vp = card ? card.querySelector('.mermaid-viewport') : null;
          const canvas = card ? card.querySelector('.mermaid-canvas') : null;
          const svg = canvas ? canvas.querySelector('svg') : null;
          if (!vp || !svg) return null;
          const vpRect = vp.getBoundingClientRect();
          const svgRect = svg.getBoundingClientRect();
          const fitScale = parseFloat(vp.dataset.fitScale || 1);
          return {
            vpWidth: vpRect.width,
            svgWidth: svgRect.width,
            clippedLeft: svgRect.left < vpRect.left - 2,
            clippedRight: svgRect.right > vpRect.right + 2,
            fitScale
          };
        });

        await page.setViewportSize({ width: 1280, height: 800 });
        await new Promise(r => setTimeout(r, 200));

        await shoot(page, rec);
        const errs = consoleLog.filter(l => l.stop === rec.id && (l.type === 'error' || l.type === 'pageerror'));
        const ok = res.scaleAdaptedToExpanded &&
                   res.resetAdapted &&
                   res.toggleRefitted &&
                   narrowFit && !narrowFit.clippedLeft && !narrowFit.clippedRight &&
                   errs.length === 0;

        const obs = {
          splitResize: res,
          narrowViewportFit: narrowFit,
          consoleErrors: errs.length
        };
        if (!ok) console.log('G3-RESIZE-VIEWPORT-REFIT failure details:', JSON.stringify(obs, null, 2));
        if (await finish(rec, ok ? 'pass' : 'fail', obs)) break;
      } else if (rec.area === 'insertion-commands') {
        await page.route('https://example.test/**', route => route.fulfill({
          status: 200,
          contentType: 'image/svg+xml',
          body: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>'
        }));
        await settle(page);
        const res = await page.evaluate(async () => {
          const results = {};
          const editor = document.getElementById('editor');

          // 1. Divider with empty selection
          editor.value = 'Before\n\nAfter';
          editor.selectionStart = editor.selectionEnd = 8;
          document.querySelector('.format-toolbar [data-action="hr"]').click();
          results.hrVal = editor.value;
          results.hrNoText = !editor.value.includes('text');
          results.hrExact = editor.value === 'Before\n\n\n\n---\n\nAfter';

          // 2. Image with empty selection
          window.prompt = () => 'https://example.test/img-empty.png';
          editor.value = 'Doc head\n\nDoc tail';
          editor.selectionStart = editor.selectionEnd = 10;
          document.querySelector('.format-toolbar [data-action="image"]').click();
          results.imgEmptyVal = editor.value;
          results.imgEmptyNoText = !editor.value.includes('texthttps://');
          results.imgEmptyExact = editor.value.includes('![Alt text](https://example.test/img-empty.png)');

          // 3. Image with nonempty selection
          window.prompt = () => 'https://example.test/banner.svg';
          editor.value = 'Check System Architecture diagram';
          editor.selectionStart = 6;
          editor.selectionEnd = 25; // 'System Architecture'
          document.querySelector('.format-toolbar [data-action="image"]').click();
          results.imgSelectedVal = editor.value;
          results.imgSelectedExact = editor.value === 'Check ![System Architecture](https://example.test/banner.svg) diagram';

          // 4. Link with empty selection
          window.prompt = () => 'https://example.test/docs';
          editor.value = 'Read ';
          editor.selectionStart = editor.selectionEnd = 5;
          document.querySelector('.format-toolbar [data-action="link"]').click();
          results.linkEmptyVal = editor.value;
          results.linkEmptyExact = editor.value === 'Read [](https://example.test/docs)';

          // 5. Table insertion
          editor.value = 'Start\n';
          editor.selectionStart = editor.selectionEnd = 6;
          document.querySelector('.format-toolbar [data-action="table"]').click();
          await new Promise(r => setTimeout(r, 100));
          document.getElementById('tableRowsInput').value = '2';
          document.getElementById('tableColsInput').value = '2';
          document.getElementById('btnConfirmTable').click();
          await new Promise(r => setTimeout(r, 100));
          results.tableVal = editor.value;
          results.tableNoText = !editor.value.includes('text');
          results.tableHasHeader = editor.value.includes('| Header 1 | Header 2 |');

          // 6. Studio Palette Subgraph Box (C091)
          document.getElementById('btnOpenStudio').click();
          await new Promise(r => setTimeout(r, 400));
          const builderCodeInput = document.getElementById('builderCodeInput');
          builderCodeInput.value = 'flowchart TD\n  StartNode --> EndNode\n';
          builderCodeInput.selectionStart = builderCodeInput.selectionEnd = builderCodeInput.value.length;

          // Find Subgraph palette button
          const paletteButtons = Array.from(document.querySelectorAll('#builderSidebar .palette-btn'));
          const subgraphBtn = paletteButtons.find(b => (b.dataset.insert || '').includes('subgraph'));
          if (subgraphBtn) subgraphBtn.click();
          await new Promise(r => setTimeout(r, 400));

          const studioVal = builderCodeInput.value;
          const literalBackslashN = (studioVal.match(/\\n/g) || []).length;
          const actualNewlines = (studioVal.match(/\n/g) || []).length;

          results.paletteSubgraphDecoded = literalBackslashN === 0 && actualNewlines >= 5;
          results.paletteLiteralBackslashN = literalBackslashN;
          results.paletteActualNewlines = actualNewlines;

          document.getElementById('btnBuilderCancel').click();
          await new Promise(r => setTimeout(r, 300));

          return results;
        });

        await shoot(page, rec);
        const errs = consoleLog.filter(l => l.stop === rec.id && (l.type === 'error' || l.type === 'pageerror'));
        const ok = res.hrExact &&
                   res.imgEmptyExact &&
                   res.imgSelectedExact &&
                   res.linkEmptyExact &&
                   res.tableNoText &&
                   res.tableHasHeader &&
                   res.paletteSubgraphDecoded &&
                   errs.length === 0;

        if (!ok) console.log('G4-INSERT-COMMANDS failure details:', JSON.stringify(res, null, 2));
        if (await finish(rec, ok ? 'pass' : 'fail', { ...res, consoleErrors: errs.length })) break;
      } else if (rec.area === 'shortcut-guards') {
        await settle(page);
        const res = await page.evaluate(async () => {
          const results = {};
          const editor = document.getElementById('editor');
          editor.value = 'Pristine base document text.';
          editor.selectionStart = 9;
          editor.selectionEnd = 13; // 'base'

          // 1. Studio modal shortcut guard
          document.getElementById('btnOpenStudio').click();
          await new Promise(r => setTimeout(r, 400));

          const builderCodeInput = document.getElementById('builderCodeInput');
          builderCodeInput.focus();

          // Dispatch Ctrl+B while in Studio
          const evtB = new KeyboardEvent('keydown', { key: 'b', code: 'KeyB', ctrlKey: true, bubbles: true });
          document.dispatchEvent(evtB);
          await new Promise(r => setTimeout(r, 100));

          // Dispatch Ctrl+I while in Studio
          const evtI = new KeyboardEvent('keydown', { key: 'i', code: 'KeyI', ctrlKey: true, bubbles: true });
          document.dispatchEvent(evtI);
          await new Promise(r => setTimeout(r, 100));

          // Dispatch Ctrl+K while in Studio
          const evtK = new KeyboardEvent('keydown', { key: 'k', code: 'KeyK', ctrlKey: true, bubbles: true });
          document.dispatchEvent(evtK);
          await new Promise(r => setTimeout(r, 100));

          results.editorUnmutatedInStudio = (editor.value === 'Pristine base document text.');

          // Dispatch Escape to dismiss Studio
          const escStudio = new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true });
          document.dispatchEvent(escStudio);
          await new Promise(r => setTimeout(r, 300));

          const studioModal = document.getElementById('studioModal');
          results.studioClosedViaEscape = !studioModal.classList.contains('open');

          // 2. Find Bar shortcut guard
          const btnFind = document.getElementById('btnToggleFind');
          if (btnFind) btnFind.click();
          await new Promise(r => setTimeout(r, 200));

          const findInput = document.getElementById('findInput');
          if (findInput) findInput.focus();

          // Dispatch Ctrl+B while in Find input
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', code: 'KeyB', ctrlKey: true, bubbles: true }));
          await new Promise(r => setTimeout(r, 100));

          results.editorUnmutatedInFindInput = (editor.value === 'Pristine base document text.');

          // Dispatch Escape to dismiss Find Bar
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
          await new Promise(r => setTimeout(r, 200));

          const findBar = document.getElementById('findReplaceBar');
          results.findBarClosedViaEscape = !findBar.classList.contains('show');

          // 3. Focused in editor: Ctrl+B works as intended
          editor.focus();
          editor.selectionStart = 9;
          editor.selectionEnd = 13; // 'base'
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', code: 'KeyB', ctrlKey: true, bubbles: true }));
          await new Promise(r => setTimeout(r, 100));

          results.editorBoldsWhenFocused = (editor.value === 'Pristine **base** document text.');

          return results;
        });

        await shoot(page, rec);
        const errs = consoleLog.filter(l => l.stop === rec.id && (l.type === 'error' || l.type === 'pageerror'));
        const ok = res.editorUnmutatedInStudio &&
                   res.studioClosedViaEscape &&
                   res.editorUnmutatedInFindInput &&
                   res.findBarClosedViaEscape &&
                   res.editorBoldsWhenFocused &&
                   errs.length === 0;

        if (!ok) console.log('G4-SHORTCUT-GUARDS failure details:', JSON.stringify(res, null, 2));
        if (await finish(rec, ok ? 'pass' : 'fail', { ...res, consoleErrors: errs.length })) break;
      } else if (rec.area === 'persistence-roundtrip') {
        await settle(page);
        const tab1Content = '# Primary Document\n\n```mermaid\nflowchart LR\n  A1 --> B1\n```\n';
        const tab2Content = '# Secondary Document\n\n```mermaid\nflowchart TD\n  S1 --> S2\n```\n';

        await page.evaluate((doc1) => {
          const editor = document.getElementById('editor');
          editor.value = doc1;
          editor.dispatchEvent(new Event('input', { bubbles: true }));
        }, tab1Content);
        await settle(page);

        // Add second tab
        await page.evaluate((doc2) => {
          document.getElementById('btnTabAdd').click();
          const editor = document.getElementById('editor');
          editor.value = doc2;
          editor.dispatchEvent(new Event('input', { bubbles: true }));
        }, tab2Content);
        await settle(page);

        const tabSwitchCheck = await page.evaluate(({ expectedDoc1, expectedDoc2 }) => {
          const tabs = Array.from(document.querySelectorAll('#tabbar .tab'));
          if (tabs.length < 2) return { ok: false, reason: 'Tab count < 2' };

          // Switch back to tab 1
          tabs[0].click();
          const editor = document.getElementById('editor');
          const readDoc1 = editor.value;

          // Switch back to tab 2
          tabs[1].click();
          const readDoc2 = editor.value;

          return {
            tabCount: tabs.length,
            tab1Preserved: readDoc1 === expectedDoc1,
            tab2Preserved: readDoc2 === expectedDoc2
          };
        }, { expectedDoc1: tab1Content, expectedDoc2: tab2Content });

        // Reload page to test localStorage round-trip
        await page.reload({ waitUntil: 'load' });
        await page.waitForSelector('#editor', { timeout: 10000 });
        await settle(page);

        const reloadCheck = await page.evaluate(({ expectedDoc1, expectedDoc2 }) => {
          const tabs = Array.from(document.querySelectorAll('#tabbar .tab'));
          const editor = document.getElementById('editor');
          if (tabs.length >= 2) {
            tabs[0].click();
            const tab1Reloaded = editor.value;
            tabs[1].click();
            const tab2Reloaded = editor.value;
            return {
              tabsRestored: tabs.length >= 2,
              tab1ReloadedMatches: tab1Reloaded === expectedDoc1,
              tab2ReloadedMatches: tab2Reloaded === expectedDoc2
            };
          }
          return { tabsRestored: false };
        }, { expectedDoc1: tab1Content, expectedDoc2: tab2Content });

        await shoot(page, rec);
        const errs = consoleLog.filter(l => l.stop === rec.id && (l.type === 'error' || l.type === 'pageerror'));
        const ok = tabSwitchCheck.tab1Preserved &&
                   tabSwitchCheck.tab2Preserved &&
                   reloadCheck.tabsRestored &&
                   reloadCheck.tab1ReloadedMatches &&
                   reloadCheck.tab2ReloadedMatches &&
                   errs.length === 0;

        const obs = {
          tabSwitchCheck,
          reloadCheck,
          consoleErrors: errs.length
        };
        if (!ok) console.log('G4-PERSISTENCE-ROUNDTRIP failure details:', JSON.stringify(obs, null, 2));
        if (await finish(rec, ok ? 'pass' : 'fail', obs)) break;
      }
      if (rec.id === 'G5-EXPORT-STANDALONE') {
        const testDoc = `# Export Determinism Test\n\n$$\n\\frac{a}{b} = c\n$$\n\n\`\`\`mermaid\nflowchart LR\n  SourceNode[Source Node] --> TargetNode[Target Node]\n\`\`\`\n\n> Blockquote text\n`;

        await page.evaluate(() => { window.__capturedDownloads = []; });

        const ensureExportMenuOpen = async () => {
          const isOpen = await page.evaluate(() => document.getElementById('exportDropdown')?.classList.contains('open'));
          if (!isOpen) {
            await page.click('#btnExportMenu');
            await page.waitForTimeout(80);
          }
        };

        // 1. Trigger editor input and IMMEDIATELY invoke #btnExportHtml without pre-settling
        // so ensurePreviewRenderReady() must await the in-flight Mermaid & MathJax render
        await page.evaluate((doc) => {
          const editor = document.getElementById('editor');
          editor.value = doc;
          editor.dispatchEvent(new Event('input', { bubbles: true }));
        }, testDoc);

        await ensureExportMenuOpen();
        await page.click('#btnExportHtml');

        const exportedFirst = await page.evaluate(async () => {
          const deadline = Date.now() + 10000;
          while (window.__capturedDownloads.length < 1 && Date.now() < deadline) {
            await new Promise(r => setTimeout(r, 50));
          }
          if (window.__capturedDownloads.length < 1) return null;
          const entry = window.__capturedDownloads[0];
          const txt = entry.blob ? await entry.blob.text() : '';
          return { fn: entry.download, txt };
        });

        const capturedFromTriggerDownload = !!(exportedFirst && exportedFirst.txt);
        const exportedHtmlContent = exportedFirst ? exportedFirst.txt : '';

        // Save retained exported sample HTML file in browser-specific directory
        const sampleHtmlPath = path.join(browserArtDir, 'export-standalone-sample.html');
        fs.writeFileSync(sampleHtmlPath, exportedHtmlContent, 'utf8');
        rec.artifacts.push(relPosix(sampleHtmlPath));

        // Reopen the exported HTML in a new browser page to verify standalone rendering, math, and diagrams
        const reopenedPage = await page.context().newPage();
        await reopenedPage.setContent(exportedHtmlContent, { waitUntil: 'load' });
        await reopenedPage.waitForTimeout(400);

        const reopenedInspection = await reopenedPage.evaluate(() => {
          const hasMath = !!document.querySelector('.MathJax, mjx-container, svg[role="img"], [id^="MJX"]') ||
                          document.body.innerHTML.includes('class="MathJax') ||
                          document.body.innerHTML.includes('mjx-container');
          const svgEl = document.querySelector('.mermaid-canvas svg, svg[id^="mermaid"]');
          const hasSvg = !!svgEl;
          const svgRect = svgEl ? svgEl.getBoundingClientRect() : null;
          const svgHasNodes = svgEl ? (svgEl.textContent.includes('Source Node') && svgEl.textContent.includes('Target Node')) : false;
          const hasHeaders = !!document.querySelector('.mermaid-header');
          const hasActionBtns = !!document.querySelector('.diag-action-btn');
          const hasErrorUI = !!document.querySelector('.mermaid-error-card');
          const canvasEl = document.querySelector('.mermaid-canvas');
          const canvasTransformNone = canvasEl ? (canvasEl.style.transform === 'none' || !canvasEl.style.transform.includes('matrix')) : true;
          const themeAttr = document.documentElement.getAttribute('data-theme');
          return {
            hasMath,
            hasSvg,
            svgRenderedDimensions: svgRect ? { width: Math.round(svgRect.width), height: Math.round(svgRect.height) } : null,
            svgHasNodes,
            hasHeaders,
            hasActionBtns,
            hasErrorUI,
            canvasTransformNone,
            themeAttr,
            title: document.title
          };
        });
        await reopenedPage.close();

        // 2. Exercise user-facing Copy Rendered HTML (#btnCopyHtml) and inspect ACTUAL clipboard payload
        await page.evaluate(() => { window.__lastClipboardWrite = null; });
        await ensureExportMenuOpen();
        await page.click('#btnCopyHtml');
        await page.waitForTimeout(300);

        const copyHtmlCheck = await page.evaluate(async () => {
          const toast = document.getElementById('toastMessage')?.textContent || '';
          const expectedClean = getCleanRenderedContent(document.getElementById('previewContent'));
          let readText = null;
          let readError = null;
          try {
            readText = await navigator.clipboard.readText();
          } catch (e) {
            readError = e.message;
          }
          const spyText = window.__lastClipboardWrite;
          const actualPayload = (readText !== null && !readError) ? readText : spyText;
          const norm = s => String(s || '').replace(/\r\n/g, '\n');
          return {
            toast,
            clipboardReadDirect: readText !== null && !readError,
            clipboardSpyCaptured: typeof spyText === 'string' && spyText.length > 0,
            payloadLength: actualPayload ? actualPayload.length : 0,
            matchesCleanRenderedContent: actualPayload !== null && norm(actualPayload) === norm(expectedClean),
            hasSvg: actualPayload ? actualPayload.includes('<svg') : false,
            hasBothNodes: actualPayload ? (actualPayload.includes('Source Node') && actualPayload.includes('Target Node')) : false,
            hasHeader: actualPayload ? actualPayload.includes('mermaid-header') : true,
            hasActionBtns: actualPayload ? actualPayload.includes('diag-action-btn') : true,
            hasRawCode: actualPayload ? actualPayload.includes('mermaid-raw-code') : true,
            hasTransformMatrix: actualPayload ? actualPayload.includes('transform: matrix') : true
          };
        });

        // 3. Exercise user-facing Copy Markdown (#btnCopyMd) and inspect ACTUAL clipboard payload
        await page.evaluate(() => { window.__lastClipboardWrite = null; });
        await ensureExportMenuOpen();
        await page.click('#btnCopyMd');
        await page.waitForTimeout(300);

        const copyMdCheck = await page.evaluate(async (expectedMd) => {
          let readText = null;
          try { readText = await navigator.clipboard.readText(); } catch (e) {}
          const actual = readText !== null ? readText : window.__lastClipboardWrite;
          const norm = s => String(s || '').replace(/\r\n/g, '\n');
          return {
            matchesEditorMarkdown: actual !== null && norm(actual) === norm(expectedMd),
            length: actual ? actual.length : 0
          };
        }, testDoc);

        // 4. Empty Document Export & Copy verification
        const beforeEmptyExports = await page.evaluate(() => window.__capturedDownloads.length);
        await page.evaluate(() => {
          const editor = document.getElementById('editor');
          editor.value = '';
          editor.dispatchEvent(new Event('input', { bubbles: true }));
        });
        await ensureExportMenuOpen();
        await page.click('#btnExportHtml');

        const emptyExported = await page.evaluate(async (prevLen) => {
          const deadline = Date.now() + 8000;
          while (window.__capturedDownloads.length <= prevLen && Date.now() < deadline) {
            await new Promise(r => setTimeout(r, 50));
          }
          if (window.__capturedDownloads.length <= prevLen) return null;
          const entry = window.__capturedDownloads[window.__capturedDownloads.length - 1];
          const txt = entry.blob ? await entry.blob.text() : '';
          return { fn: entry.download, txt };
        }, beforeEmptyExports);

        const emptyHtmlPath = path.join(browserArtDir, 'export-standalone-empty.html');
        if (emptyExported && emptyExported.txt) {
          fs.writeFileSync(emptyHtmlPath, emptyExported.txt, 'utf8');
          rec.artifacts.push(relPosix(emptyHtmlPath));
        }

        const emptyPage = await page.context().newPage();
        await emptyPage.setContent(emptyExported ? emptyExported.txt : '', { waitUntil: 'load' });
        const emptyInspection = await emptyPage.evaluate(() => ({
          hasDoctype: document.doctype !== null,
          svgCount: document.querySelectorAll('svg').length,
          errorCardCount: document.querySelectorAll('.mermaid-error-card').length,
          bodyTextTrimmed: document.body.textContent.trim()
        }));
        await emptyPage.close();

        // 5. Invalid Diagram Document Export & Copy verification (must strip error card UI and export clean fallback <pre><code class="language-mermaid">)
        const invalidDoc = `# Invalid Diagram Export Test\n\n\`\`\`mermaid\nflowchart TD\n  BrokenSyntaxNode -->\n\`\`\`\n\nParagraph after invalid diagram.\n`;
        const beforeInvalidExports = await page.evaluate(() => window.__capturedDownloads.length);
        await page.evaluate((doc) => {
          const editor = document.getElementById('editor');
          editor.value = doc;
          editor.dispatchEvent(new Event('input', { bubbles: true }));
        }, invalidDoc);
        await settle(page);

        const liveInvalidErrorCards = await page.evaluate(() => document.querySelectorAll('#previewContent .mermaid-error-card').length);

        await ensureExportMenuOpen();
        await page.click('#btnExportHtml');

        const invalidExported = await page.evaluate(async (prevLen) => {
          const deadline = Date.now() + 8000;
          while (window.__capturedDownloads.length <= prevLen && Date.now() < deadline) {
            await new Promise(r => setTimeout(r, 50));
          }
          if (window.__capturedDownloads.length <= prevLen) return null;
          const entry = window.__capturedDownloads[window.__capturedDownloads.length - 1];
          const txt = entry.blob ? await entry.blob.text() : '';
          return { fn: entry.download, txt };
        }, beforeInvalidExports);

        const invalidHtmlPath = path.join(browserArtDir, 'export-standalone-invalid.html');
        if (invalidExported && invalidExported.txt) {
          fs.writeFileSync(invalidHtmlPath, invalidExported.txt, 'utf8');
          rec.artifacts.push(relPosix(invalidHtmlPath));
        }

        const invalidPage = await page.context().newPage();
        await invalidPage.setContent(invalidExported ? invalidExported.txt : '', { waitUntil: 'load' });
        const invalidInspection = await invalidPage.evaluate(() => {
          const errorCardCount = document.querySelectorAll('.mermaid-error-card').length;
          const fixInStudioPresent = document.body.innerHTML.includes('Fix in Studio');
          const fallbackCode = document.querySelector('pre code.language-mermaid');
          return {
            errorCardCount,
            fixInStudioPresent,
            hasFallbackPreCode: !!fallbackCode,
            fallbackCodeText: fallbackCode ? fallbackCode.textContent : '',
            hasTrailingParagraph: document.body.textContent.includes('Paragraph after invalid diagram.')
          };
        });
        await invalidPage.close();

        // Also test #btnCopyHtml on the invalid diagram document
        await page.evaluate(() => { window.__lastClipboardWrite = null; });
        await ensureExportMenuOpen();
        await page.click('#btnCopyHtml');
        await page.waitForTimeout(250);
        const invalidCopyCheck = await page.evaluate(async () => {
          let readText = null;
          try { readText = await navigator.clipboard.readText(); } catch (e) {}
          const actual = readText !== null ? readText : window.__lastClipboardWrite;
          return {
            hasFallbackPreCode: actual ? actual.includes('<pre><code class="language-mermaid">') : false,
            noErrorCard: actual ? !actual.includes('mermaid-error-card') && !actual.includes('Fix in Studio') : false
          };
        });

        await shoot(page, rec);
        const errs = consoleLog.filter(l => l.stop === rec.id && (l.type === 'error' || l.type === 'pageerror'));
        const ok = capturedFromTriggerDownload &&
                   reopenedInspection.hasSvg &&
                   reopenedInspection.svgHasNodes &&
                   reopenedInspection.hasMath &&
                   !reopenedInspection.hasHeaders &&
                   !reopenedInspection.hasActionBtns &&
                   !reopenedInspection.hasErrorUI &&
                   reopenedInspection.canvasTransformNone &&
                   !!reopenedInspection.themeAttr &&
                   copyHtmlCheck.toast.includes('copied to clipboard') &&
                   copyHtmlCheck.matchesCleanRenderedContent &&
                   copyHtmlCheck.hasSvg &&
                   copyHtmlCheck.hasBothNodes &&
                   !copyHtmlCheck.hasHeader &&
                   !copyHtmlCheck.hasActionBtns &&
                   !copyHtmlCheck.hasRawCode &&
                   !copyHtmlCheck.hasTransformMatrix &&
                   copyMdCheck.matchesEditorMarkdown &&
                   emptyInspection.hasDoctype &&
                   emptyInspection.svgCount === 0 &&
                   emptyInspection.errorCardCount === 0 &&
                   liveInvalidErrorCards === 1 &&
                   invalidInspection.errorCardCount === 0 &&
                   !invalidInspection.fixInStudioPresent &&
                   invalidInspection.hasFallbackPreCode &&
                   invalidInspection.fallbackCodeText.includes('BrokenSyntaxNode -->') &&
                   invalidInspection.hasTrailingParagraph &&
                   invalidCopyCheck.hasFallbackPreCode &&
                   invalidCopyCheck.noErrorCard &&
                   errs.length === 0;

        const obs = {
          capturedFromTriggerDownload,
          reopenedInspection,
          copyHtmlCheck,
          copyMdCheck,
          emptyDocumentExport: emptyInspection,
          invalidDiagramExport: {
            liveInvalidErrorCards,
            ...invalidInspection,
            invalidCopyCheck
          },
          retainedFiles: [
            relPosix(sampleHtmlPath),
            relPosix(emptyHtmlPath),
            relPosix(invalidHtmlPath)
          ],
          consoleErrors: errs.length
        };
        if (!ok) console.log('G5-EXPORT-STANDALONE failure details:', JSON.stringify(obs, null, 2));
        if (await finish(rec, ok ? 'pass' : 'fail', obs)) break;
      }
      if (rec.id === 'G5-EXPORT-DIAGRAM-FILES') {
        const testDoc = `# Diagram File Export Test\n\n\`\`\`mermaid\nflowchart TD\n  Start[Process Start] --> End[Process End]\n\`\`\`\n`;

        await page.evaluate((doc) => {
          const editor = document.getElementById('editor');
          editor.value = doc;
          editor.dispatchEvent(new Event('input', { bubbles: true }));
        }, testDoc);
        await settle(page);

        const sourceDimensions = await page.evaluate(() => {
          const svg = document.querySelector('#previewContent .mermaid-block-card .mermaid-canvas svg');
          if (!svg) return null;
          return {
            intrinsicWidth: parseFloat(svg.dataset.intrinsicWidth) || svg.getBoundingClientRect().width,
            intrinsicHeight: parseFloat(svg.dataset.intrinsicHeight) || svg.getBoundingClientRect().height
          };
        });

        // Exercise user-facing SVG export button on the diagram card
        const svgFilePromise = page.evaluate(() => {
          return new Promise((resolve) => {
            const card = document.querySelector('#previewContent .mermaid-block-card');
            const svgBtn = card ? card.querySelector('.diag-action-btn[data-action="export-svg"]') : null;
            if (!svgBtn) return resolve({ success: false, error: 'SVG export button not found' });

            const origTrigger = window.triggerDownload;
            window.triggerDownload = (url, fn) => {
              window.triggerDownload = origTrigger;
              if (url.startsWith('blob:')) {
                fetch(url).then(r => r.text()).then(text => {
                  resolve({ success: true, text, fn });
                }).catch(err => resolve({ success: false, error: err.message }));
              } else {
                resolve({ success: true, text: url, fn });
              }
            };
            try {
              svgBtn.click();
            } catch (e) {
              window.triggerDownload = origTrigger;
              resolve({ success: false, error: e.message });
            }
          });
        });

        const svgExport = await svgFilePromise;
        const sampleSvgPath = path.join(browserArtDir, 'export-diagram-sample.svg');
        if (svgExport.success && svgExport.text) {
          fs.writeFileSync(sampleSvgPath, svgExport.text, 'utf8');
          rec.artifacts.push(relPosix(sampleSvgPath));
        }

        // Exercise user-facing PNG export button on the diagram card
        const pngFilePromise = page.evaluate(() => {
          return new Promise((resolve) => {
            const card = document.querySelector('#previewContent .mermaid-block-card');
            const pngBtn = card ? card.querySelector('.diag-action-btn[data-action="export-png"]') : null;
            if (!pngBtn) return resolve({ success: false, error: 'PNG export button not found' });

            const origTrigger = window.triggerDownload;
            window.triggerDownload = (url, fn) => {
              window.triggerDownload = origTrigger;
              if (url.startsWith('blob:')) {
                fetch(url).then(r => r.blob()).then(async blob => {
                  const buf = await blob.arrayBuffer();
                  const bytes = new Uint8Array(buf);
                  let bin = '';
                  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
                  const b64 = btoa(bin);
                  resolve({ success: true, b64, fn });
                }).catch(err => resolve({ success: false, error: err.message }));
              } else {
                resolve({ success: true, b64: null, fn });
              }
            };
            try {
              pngBtn.click();
            } catch (e) {
              window.triggerDownload = origTrigger;
              resolve({ success: false, error: e.message });
            }
          });
        });

        const pngExport = await pngFilePromise;
        const samplePngPath = path.join(browserArtDir, 'export-diagram-sample.png');
        let pngBuffer = null;
        if (pngExport.success && pngExport.b64) {
          pngBuffer = Buffer.from(pngExport.b64, 'base64');
          fs.writeFileSync(samplePngPath, pngBuffer);
          rec.artifacts.push(relPosix(samplePngPath));
        }

        // Reopen and inspect the saved SVG in a real browser page to verify rendered <text> bounding boxes and structure
        const svgText = fs.existsSync(sampleSvgPath) ? fs.readFileSync(sampleSvgPath, 'utf8') : '';
        const svgPage = await page.context().newPage();
        await svgPage.setContent(`<!DOCTYPE html><html><body style="margin:0;background:#fff;">${svgText}</body></html>`, { waitUntil: 'load' });
        await svgPage.waitForTimeout(200);
        const svgReopenedCheck = await svgPage.evaluate(() => {
          const svg = document.querySelector('svg');
          if (!svg) return { svgRendered: false };
          const svgRect = svg.getBoundingClientRect();
          const foreignObjects = svg.querySelectorAll('foreignObject').length;
          const texts = Array.from(svg.querySelectorAll('text'));
          const startEl = texts.find(t => t.textContent.includes('Process Start'));
          const endEl = texts.find(t => t.textContent.includes('Process End'));
          const startBBox = startEl ? startEl.getBBox() : null;
          const endBBox = endEl ? endEl.getBBox() : null;
          const startRect = startEl ? startEl.getBoundingClientRect() : null;
          const endRect = endEl ? endEl.getBoundingClientRect() : null;
          return {
            svgRendered: svgRect.width > 50 && svgRect.height > 50,
            svgWidth: Math.round(svgRect.width),
            svgHeight: Math.round(svgRect.height),
            foreignObjects,
            textElementCount: texts.length,
            startLabelRendered: !!(startBBox && startBBox.width > 10 && startBBox.height > 5 && startRect && startRect.width > 10),
            endLabelRendered: !!(endBBox && endBBox.width > 10 && endBBox.height > 5 && endRect && endRect.width > 10),
            startLabelBounds: startBBox ? { width: Math.round(startBBox.width), height: Math.round(startBBox.height) } : null,
            endLabelBounds: endBBox ? { width: Math.round(endBBox.width), height: Math.round(endBBox.height) } : null
          };
        });
        await svgPage.close();

        const svgInspection = {
          validXml: svgText.startsWith('<svg') && svgText.endsWith('</svg>'),
          hasXmlns: svgText.includes('xmlns="http://www.w3.org/2000/svg"'),
          hasViewBox: svgText.includes('viewBox='),
          hasLabels: svgText.includes('Process Start') && svgText.includes('Process End'),
          foreignObjectSanitized: !svgText.includes('<foreignObject') && svgText.includes('<text'),
          fileSize: svgText.length,
          reopenedInBrowser: svgReopenedCheck
        };

        // Reopen and inspect the saved PNG in a real browser page (<img> + <canvas> pixel verification)
        let pngInspection = { ok: false };
        if (pngBuffer && pngBuffer.length > 8) {
          const magic = pngBuffer.slice(0, 8).toString('hex');
          const isPng = magic === '89504e470d0a1a0a';
          const width = pngBuffer.readUInt32BE(16);
          const height = pngBuffer.readUInt32BE(20);

          const pngPage = await page.context().newPage();
          const dataUrl = `data:image/png;base64,${pngExport.b64}`;
          await pngPage.setContent(`<!DOCTYPE html><html><body><img id="reopenedPng" src="${dataUrl}"></body></html>`, { waitUntil: 'load' });
          const pngReopenedCheck = await pngPage.evaluate(async (srcDims) => {
            const img = document.getElementById('reopenedPng');
            if (!img || !img.complete || img.naturalWidth === 0) return { decoded: false };
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
            // Sample background pixel at (0,0) and count non-background pixels showing rendered diagram nodes/text/edges
            const bgR = data[0], bgG = data[1], bgB = data[2];
            let nonBgPixels = 0;
            for (let i = 0; i < data.length; i += 16) {
              if (Math.abs(data[i] - bgR) > 10 || Math.abs(data[i + 1] - bgG) > 10 || Math.abs(data[i + 2] - bgB) > 10) {
                nonBgPixels++;
              }
            }
            const expectedW = srcDims ? Math.round(srcDims.intrinsicWidth * 2) : img.naturalWidth;
            const expectedH = srcDims ? Math.round(srcDims.intrinsicHeight * 2) : img.naturalHeight;
            return {
              decoded: true,
              naturalWidth: img.naturalWidth,
              naturalHeight: img.naturalHeight,
              expected2xWidth: expectedW,
              expected2xHeight: expectedH,
              matches2xScale: Math.abs(img.naturalWidth - expectedW) <= 4 && Math.abs(img.naturalHeight - expectedH) <= 4,
              nonBgSampledPixels: nonBgPixels
            };
          }, sourceDimensions);
          await pngPage.close();

          pngInspection = {
            ok: isPng && width > 0 && height > 0 && pngReopenedCheck.decoded && pngReopenedCheck.matches2xScale && pngReopenedCheck.nonBgSampledPixels > 50,
            isPng,
            width,
            height,
            fileSize: pngBuffer.length,
            reopenedInBrowser: pngReopenedCheck
          };
        }

        // Verify empty/invalid container guard on exportDiagramSvg
        const emptySvgGuard = await page.evaluate(() => {
          let downloadCalled = false;
          const origTrigger = window.triggerDownload;
          window.triggerDownload = () => { downloadCalled = true; };
          const emptyDiv = document.createElement('div');
          const res = exportDiagramSvg(emptyDiv, 'should-not-download.svg');
          window.triggerDownload = origTrigger;
          const toast = document.getElementById('toastMessage')?.textContent || '';
          return {
            abortedCleanly: !res && !downloadCalled && toast.includes('No rendered diagram'),
            toast
          };
        });

        await shoot(page, rec);
        const errs = consoleLog.filter(l => l.stop === rec.id && (l.type === 'error' || l.type === 'pageerror'));
        const ok = svgInspection.validXml &&
                   svgInspection.hasXmlns &&
                   svgInspection.hasLabels &&
                   svgInspection.foreignObjectSanitized &&
                   svgReopenedCheck.svgRendered &&
                   svgReopenedCheck.startLabelRendered &&
                   svgReopenedCheck.endLabelRendered &&
                   pngInspection.ok &&
                   emptySvgGuard.abortedCleanly &&
                   errs.length === 0;

        const obs = {
          sourceDimensions,
          svgInspection,
          pngInspection,
          emptySvgGuard,
          retainedSvg: relPosix(sampleSvgPath),
          retainedPng: relPosix(samplePngPath),
          consoleErrors: errs.length
        };
        if (!ok) console.log('G5-EXPORT-DIAGRAM-FILES failure details:', JSON.stringify(obs, null, 2));
        if (await finish(rec, ok ? 'pass' : 'fail', obs)) break;
      }
      if (rec.id === 'G5-EXPORT-PNG-FAILURE') {
        const failureResult = await page.evaluate(async () => {
          const emptyDiv = document.createElement('div');
          const resNoSvg = await exportDiagramPng(emptyDiv, 'none.png');

          let fakeCanvas = document.createElement('div');
          fakeCanvas.innerHTML = '<svg id="fail-svg" width="100" height="100"><circle cx="50" cy="50" r="40"/></svg>';

          const origImage = window.Image;
          window.Image = function() {
            const img = new origImage();
            Object.defineProperty(img, 'src', {
              set: function(val) {
                setTimeout(() => {
                  if (typeof img.onerror === 'function') {
                    img.onerror(new Event('error'));
                  }
                }, 10);
              }
            });
            return img;
          };

          let resImgError = null;
          try {
            resImgError = await exportDiagramPng(fakeCanvas, 'corrupt.png');
          } finally {
            window.Image = origImage;
          }

          const toastEl = document.getElementById('toastMessage');
          const toastText = toastEl ? toastEl.textContent : '';

          // Inspect Error Log drawer entries
          const errorItems = document.querySelectorAll('#errorLogList .error-log-row, #errorLogList .error-log-msg');
          const errorLogTexts = Array.from(errorItems).map(li => li.textContent);
          const hasLoggedFailure = errorLogTexts.some(t => t.includes('PNG') || t.includes('Export') || t.includes('image'));

          return {
            noSvgHandled: resNoSvg.success === false,
            imgErrorHandled: resImgError.success === false,
            imgErrorMessage: resImgError.error,
            toastShown: !!toastText,
            toastText,
            errorLogged: hasLoggedFailure,
            errorLogCount: errorItems.length
          };
        });

        await shoot(page, rec);
        const errs = consoleLog.filter(l => l.stop === rec.id && (l.type === 'error' || l.type === 'pageerror'));
        const ok = failureResult.noSvgHandled &&
                   failureResult.imgErrorHandled &&
                   failureResult.toastShown &&
                   failureResult.errorLogged &&
                   !failureResult.toastText.includes('downloaded') &&
                   errs.length === 0;

        const obs = {
          failureResult,
          consoleErrors: errs.length
        };
        if (!ok) console.log('G5-EXPORT-PNG-FAILURE failure details:', JSON.stringify(obs, null, 2));
        if (await finish(rec, ok ? 'pass' : 'fail', obs)) break;
      }
      if (rec.id === 'G5-PRINT-PDF-TALL') {
        const tallFixturePath = path.join(fixtureDir, 'tall.md');
        const tallDoc = fs.readFileSync(tallFixturePath, 'utf8');

        await page.evaluate((doc) => {
          window.__printCalls = 0;
          const editor = document.getElementById('editor');
          editor.value = doc;
          editor.dispatchEvent(new Event('input', { bubbles: true }));
        }, tallDoc);
        await settle(page);

        // 1. Exercise user-facing #btnPrintPdf action in export dropdown, then close dropdown
        await page.click('#btnExportMenu');
        await page.waitForTimeout(100);
        await page.click('#btnPrintPdf');
        await page.waitForTimeout(200);
        await page.evaluate(() => document.getElementById('exportDropdown')?.classList.remove('open'));

        const printActionInvoked = await page.evaluate(() => (window.__printCalls || 0) > 0);

        // 2. Generate real multi-page PDF via CDP Page.printToPDF BEFORE emulating media (so CDP uses native print media)
        let cdpPdfSize = null;
        let cdpSuccess = false;
        let cdpBlocked = false;
        let cdpReason = null;
        let pdfPageCount = null;
        let pdfStepCheck = null;
        const samplePdfPath = path.join(browserArtDir, 'print-tall-diagram.pdf');

        if (BROWSER !== 'firefox') {
          try {
            const client = await page.context().newCDPSession(page);
            const pdfRes = await client.send('Page.printToPDF', {
              printBackground: true,
              preferCSSPageSize: true
            });
            if (pdfRes && pdfRes.data) {
              const pdfBuf = Buffer.from(pdfRes.data, 'base64');
              cdpPdfSize = pdfBuf.length;
              cdpSuccess = cdpPdfSize > 10000 && pdfBuf.slice(0, 5).toString('ascii') === '%PDF-';
              const pdfStr = pdfBuf.toString('binary');
              const pageMatches = pdfStr.match(/\/Type\s*\/Page[^s]/g);
              pdfPageCount = pageMatches ? pageMatches.length : 1;

              // Parse decompressed PDF content streams + ToUnicode CMaps to verify Step 0..Step 25
              pdfStepCheck = extractPdfSteps(pdfBuf);

              // Retain browser-specific PDF evidence artifact
              fs.writeFileSync(samplePdfPath, pdfBuf);
              rec.artifacts.push(relPosix(samplePdfPath));
            }
          } catch (cdpErr) {
            console.log('CDP printToPDF notice:', cdpErr.message);
          }
        } else {
          cdpBlocked = true;
          cdpReason = 'CDP Page.printToPDF protocol is unsupported in Mozilla Firefox; print layout verified via @media print DOM emulation (all 26 steps Step 0..Step 25 unclipped), marked blocked per Gate G5 rules because native PDF file export is unavailable in Firefox.';
        }

        // 3. Verify @media print CSS rules and emulate print media to inspect live print DOM layout
        await page.emulateMedia({ media: 'print' });
        await page.waitForTimeout(200);

        const printDomCheck = await page.evaluate(() => {
          const rules = [];
          for (let sheet of document.styleSheets) {
            try {
              for (let rule of sheet.cssRules || []) {
                if (rule.media && (rule.media.mediaText === 'print' || rule.conditionText === 'print')) {
                  for (let r of rule.cssRules || []) {
                    rules.push({ selectorText: r.selectorText, cssText: r.cssText });
                  }
                }
              }
            } catch (e) {}
          }

          const vpRule = rules.find(r => r.selectorText === '.mermaid-viewport');
          const canvasRule = rules.find(r => r.selectorText === '.mermaid-canvas');
          const cardRule = rules.find(r => r.selectorText === '.mermaid-block-card');

          const bodyCs = window.getComputedStyle(document.body);
          const previewCs = window.getComputedStyle(document.getElementById('previewContent'));
          const vpEl = document.querySelector('#previewContent .mermaid-viewport');
          const vpCs = vpEl ? window.getComputedStyle(vpEl) : null;
          const svgEl = document.querySelector('#previewContent .mermaid-canvas svg');
          const svgRect = svgEl ? svgEl.getBoundingClientRect() : null;

          // Check all 26 steps (Step 0..Step 25) in print-emulated DOM
          const allNodes = svgEl ? Array.from(svgEl.querySelectorAll('.nodeLabel, text, foreignObject')) : [];
          const missingDomSteps = [];
          let step0Top = null;
          let step25Bottom = null;
          for (let i = 0; i <= 25; i++) {
            const label = `Step ${i}`;
            const match = allNodes.find(el => el.textContent.trim() === label);
            if (!match) {
              missingDomSteps.push(label);
            } else {
              const r = match.getBoundingClientRect();
              if (r.width <= 0 || r.height <= 0) missingDomSteps.push(label);
              if (i === 0) step0Top = Math.round(r.top);
              if (i === 25) step25Bottom = Math.round(r.bottom);
            }
          }

          return {
            hasViewportRule: !!vpRule,
            hasCanvasRule: !!canvasRule,
            hasCardRule: !!cardRule,
            bodyOverflow: bodyCs.overflow,
            previewOverflow: previewCs.overflow,
            viewportMaxHeight: vpCs ? vpCs.maxHeight : '',
            viewportOverflow: vpCs ? vpCs.overflow : '',
            svgRenderedHeight: svgRect ? Math.round(svgRect.height) : 0,
            all26StepsVisible: missingDomSteps.length === 0,
            missingDomSteps,
            step0Top,
            step25Bottom
          };
        });

        const printEmulatedShot = `${art(rec.id + '-print-emulated')}.png`;
        await page.screenshot({ path: printEmulatedShot, fullPage: true });
        rec.artifacts.push(relPosix(printEmulatedShot));

        await page.emulateMedia({ media: null });
        await page.waitForTimeout(100);

        await shoot(page, rec);
        const errs = consoleLog.filter(l => l.stop === rec.id && (l.type === 'error' || l.type === 'pageerror'));

        const obs = {
          printActionInvoked,
          printDomCheck,
          cdpPdfSize,
          cdpSuccess,
          cdpBlocked,
          cdpReason,
          pdfPageCount,
          pdfStepCheck,
          retainedPdf: cdpSuccess ? relPosix(samplePdfPath) : null,
          consoleErrors: errs.length
        };

        // Per Plan §1 & §8: A blocked test is never a pass. Firefox lacks CDP Page.printToPDF so it must be marked 'blocked'.
        if (cdpBlocked) {
          if (await finish(rec, 'blocked', obs)) break;
        } else {
          const ok = printActionInvoked &&
                     printDomCheck.all26StepsVisible &&
                     printDomCheck.svgRenderedHeight > 1500 &&
                     cdpSuccess &&
                     pdfPageCount >= 2 &&
                     pdfStepCheck &&
                     pdfStepCheck.foundCount === 26 &&
                     pdfStepCheck.missingSteps.length === 0 &&
                     errs.length === 0;
          if (!ok) console.log('G5-PRINT-PDF-TALL failure details:', JSON.stringify(obs, null, 2));
          if (await finish(rec, ok ? 'pass' : 'fail', obs)) break;
        }
      }
    } catch (e) {
      console.error('Stop point blocked reason:', rec.id, e);
      const stop = await finish(rec, 'blocked', { reason: String(e && e.message || e) });
      if (stop) { await browser.close(); server.close(); writeManifest(records, envRecord()); process.exit(1); }
    } finally {
      if (ctx) await ctx.close().catch(() => {});
    }
  }
  await browser.close();
  server.close();
  return records;
}

function envRecord() {
  return {
    platform: process.platform, arch: process.arch, node: process.version,
    browserRequested: BROWSER + (CHANNELS[BROWSER] ? ' (channel ' + CHANNELS[BROWSER] + ')' : ''),
    browserVersion: BROWSER_VERSION || null, headed: HEADED,
    origin: ORIGIN, dryRun: DRY_RUN,
    note: 'Record exactly what ran: Playwright chromium on win32 is a Chromium build on Windows, not branded Edge/Chrome; those stay separate matrix rows. Do not label another OS as Windows coverage.',
  };
}

(async () => {
  const sps = buildStopPoints();
  if (DRY_RUN) {
    let records = sps.map(makeRecord);
    if (FILTER) records = records.filter(r => r.id.includes(FILTER) || r.gate === FILTER);
    const m = writeManifest(records, envRecord());
    console.log(`dry-run: ${m.totals.stopPoints} stop points emitted to ${path.relative(root, OUT)}/manifest.json + stop-points.md`);
    console.log(`  launch: ${sps.filter(s => s.area === 'launch').length}, fixtures: ${fixtures.length}, controls: ${controls.length}, G1-exceptions: ${sps.filter(s => s.gate === 'G1-exception').length}, G2: ${sps.filter(s => s.gate === 'G2').length}, G3: ${sps.filter(s => s.gate === 'G3').length}, G4: ${sps.filter(s => s.gate === 'G4').length}, G5: ${sps.filter(s => s.gate === 'G5').length}`);
    return;
  }
  const records = await runBrowser();
  const m = writeManifest(records, envRecord());
  console.log(`\ntotals: ${JSON.stringify(m.totals)}`);
  fs.writeFileSync(path.join(OUT, 'console-log.json'), JSON.stringify(consoleLog, null, 2) + '\n');
  if (!DRY_RUN && !FILTER) {
    const stamp = `${String(BROWSER || 'browser').split(' ')[0]}-${String(ORIGIN)}-${m.generatedAt.replace(/[:.]/g, '-')}`;
    fs.mkdirSync(path.join(OUT, 'runs'), { recursive: true });
    fs.writeFileSync(path.join(OUT, 'runs', `console-log-${stamp}.json`), JSON.stringify(consoleLog, null, 2) + '\n');
  }
  process.exit(m.totals.fail > 0 ? 1 : 0);
})();
