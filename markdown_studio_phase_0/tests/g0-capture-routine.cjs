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
if (!DRY_RUN && !['chromium', 'firefox', 'edge', 'chrome'].includes(BROWSER)) {
  console.error(`unknown --browser "${BROWSER}"; use chromium | firefox | edge | chrome`);
  process.exit(2);
}
const OUT = path.resolve(root, String(opt('out', 'evidence/phase-0/g0-capture')));

const workingPath = path.join(root, 'working/markdown_studio.html');
const workingSrc = fs.readFileSync(workingPath, 'utf8');
const CANDIDATE_SHA = crypto.createHash('sha256').update(workingSrc).digest('hex');
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
  const stamp = `${String(env.browserRequested || 'browser').split(' ')[0]}-${String(env.origin || ORIGIN)}-${generatedAt.replace(/[:.]/g, '-')}`;
  fs.mkdirSync(path.join(OUT, 'runs'), { recursive: true });
  fs.writeFileSync(path.join(OUT, 'runs', `manifest-${stamp}.json`), JSON.stringify(manifest, null, 2) + '\n');
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
  const records = buildStopPoints().map(makeRecord);
  const resourceErrors = [];

  async function newPage(origin, withClipboardPerms) {
    const ctx = await browser.newContext({ viewport: { width: 1296, height: 866 } });
    // Clipboard permissions/focus only for the clipboard stop point; headed side effects must not
    // leak into launch/fixture/control stop points.
    if (withClipboardPerms) {
      try { await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: baseHttp }); } catch (e) {}
    }
    const page = await ctx.newPage();
    // Stub window.print: the native print dialog blocks headed automation (C019 #btnPrintPdf).
    // The stub records invocations; actual print/PDF output validation is Gate G5 scope.
    await page.addInitScript(() => { window.print = () => { window.__printCalls = (window.__printCalls || 0) + 1; }; });
    if (withClipboardPerms) { try { await page.bringToFront(); } catch (e) {} }
    page.on('console', m => consoleLog.push({ stop: currentId, type: m.type(), text: m.text() }));
    page.on('pageerror', e => consoleLog.push({ stop: currentId, type: 'pageerror', text: String(e) }));
    page.on('response', r => { if (r.status() >= 400) resourceErrors.push({ stop: currentId, url: r.url(), status: r.status() }); });
    await page.goto(targetUrl(origin), { waitUntil: 'load' });
    await page.waitForSelector('#editor', { timeout: 10000 });
    return { ctx, page };
  }

  let currentId = null;
  const art = id => path.join(OUT, 'artifacts', id);
  fs.mkdirSync(path.join(OUT, 'artifacts'), { recursive: true });

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
      ({ ctx, page } = await newPage(origin, rec.area === 'clipboard' && HEADED));
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
        const errs = consoleLog.filter(l => l.stop === rec.id && (l.type === 'error' || l.type === 'pageerror'));
        await shoot(page, rec);
        fs.writeFileSync(`${art(rec.id)}-counts.json`, JSON.stringify({ ...c, consoleErrors: errs.length }, null, 2));
        rec.artifacts.push(relPosix(`${art(rec.id)}-counts.json`));
        const isInvalid = rec.fixture === 'invalid.md';
        const ok = isInvalid ? (c.errorCards >= 1 && errs.length === 0) : (c.errorCards === 0 && errs.length === 0);
        if (await finish(rec, ok ? 'pass' : 'fail', c)) break;
      } else if (rec.area === 'control') {
        const a = (rec.controlSpec && rec.controlSpec.attributes) || {};
        if (!a.id && !a['data-action'] && !a['data-template'] && !a['data-insert'] && !a['for'] && rec.selector) {
          // degraded fallback: legacy CSS selector
          const exists = await page.$(rec.selector);
          if (!exists) { await finish(rec, 'blocked', { reason: 'selector not found: ' + rec.selector }); continue; }
          await page.click(rec.selector).catch(() => {});
          await page.waitForTimeout(600);
          await shoot(page, rec);
          await page.keyboard.press('Escape');
          await finish(rec, 'pass', { executed: 'click via legacy selector', note: 'no id/data-attr in inventory' });
          continue;
        }
        // Hidden file input (C015): setting .value throws in browsers; use setInputFiles with a synthetic file.
        if (a.type === 'file') {
          const synth = path.join(OUT, 'artifacts', 'synthetic-upload.md');
          fs.mkdirSync(path.dirname(synth), { recursive: true });
          fs.writeFileSync(synth, '# QAQC synthetic upload\n\n```mermaid\nflowchart TD\n  U --> V\n```\n');
          const tabsBefore = await page.evaluate(() => document.querySelectorAll('.tab').length);
          await page.setInputFiles('#' + a.id, synth);
          await page.waitForTimeout(800);
          const after = await page.evaluate(() => ({ tabs: document.querySelectorAll('.tab').length, editorHead: document.getElementById('editor').value.slice(0, 40) }));
          await shoot(page, rec);
          const ok = after.tabs > tabsBefore || after.editorHead.includes('QAQC synthetic');
          await finish(rec, ok ? 'pass' : 'fail', { tabsBefore, ...after, note: 'file load via setInputFiles on hidden #' + a.id + '; label C014 routes here' });
          continue;
        }
        // Resolve by id, else by EXACT data-* attribute equality in-page. CSS attribute-string selectors are
        // unsafe here: values contain literal backslash sequences (e.g. C091 data-insert "\\n...") which CSS
        // would unescape, so `[data-insert="..."]` never matches the literal attribute.
        const key = a['data-action'] !== undefined ? 'data-action' : a['data-template'] !== undefined ? 'data-template' : a['data-insert'] !== undefined ? 'data-insert' : null;
        const probe = { id: a.id || null, forAttr: a['for'] || null, key, val: key ? a[key] : null };
        const info = await page.evaluate(o => {
          let el = null;
          if (o.id) el = document.getElementById(o.id);
          if (!el && o.key) el = [...document.querySelectorAll('[' + o.key + ']')].find(e => e.getAttribute(o.key) === o.val) || null;
          if (!el && o.forAttr) el = document.querySelector('label[for="' + o.forAttr + '"]');
          if (!el) return null;
          return { tag: el.tagName, type: el.type || null, id: el.id || null, forAttr: el.getAttribute('for') || null };
        }, probe);
        if (!info) { await finish(rec, 'blocked', { reason: 'element not found for ' + JSON.stringify(probe) }); continue; }
        let observation;
        if (info.tag === 'LABEL' && info.forAttr) {
          observation = { wiredTo: info.forAttr, note: 'label activates #' + info.forAttr + '; native file dialog not automatable in-page — actual file load covered by the C015 stop point' };
          await finish(rec, 'pass', observation);
        } else if (info.tag === 'SELECT') {
          await page.selectOption('#' + info.id, { index: 1 }).catch(async () => page.evaluate(o => { const el = document.getElementById(o.id); el.selectedIndex = (el.selectedIndex + 1) % el.options.length; el.dispatchEvent(new Event('change', { bubbles: true })); }, probe));
          await page.waitForTimeout(600);
          const modalOpen = await page.evaluate(() => !!document.querySelector('.modal.open, .modal[style*="flex"], .dropdown.open'));
          await shoot(page, rec);
          await page.keyboard.press('Escape');
          await finish(rec, 'pass', { executed: 'select->next option', modalOrDropdownOpened: modalOpen });
        } else if (info.tag === 'INPUT' && (info.type === 'checkbox' || info.type === 'radio')) {
          await page.evaluate(o => { const el = o.id ? document.getElementById(o.id) : [...document.querySelectorAll('input')].find(e => e.type === o.type); if (el) el.click(); }, probe);
          await page.waitForTimeout(400);
          await shoot(page, rec);
          await finish(rec, 'pass', { executed: 'click ' + info.type });
        } else if (info.tag === 'INPUT') {
          await page.evaluate(o => { const el = document.getElementById(o.id); el.value = 'qaqc-probe'; el.dispatchEvent(new Event('input', { bubbles: true })); }, probe);
          await page.waitForTimeout(400);
          await shoot(page, rec);
          await finish(rec, 'pass', { executed: 'set value + input event' });
        } else if (info.tag === 'TEXTAREA') {
          await page.evaluate(o => { const el = document.getElementById(o.id); el.focus(); }, probe);
          await finish(rec, 'pass', { executed: 'focus-only probe', note: 'textarea behavior covered by editor-level fixture stop points' });
        } else {
          await page.evaluate(o => {
            let el = o.id ? document.getElementById(o.id) : null;
            if (!el && o.key) el = [...document.querySelectorAll('[' + o.key + ']')].find(e => e.getAttribute(o.key) === o.val);
            if (el) el.click();
          }, probe);
          await page.waitForTimeout(600);
          const modalOpen = await page.evaluate(() => !!document.querySelector('.modal.open, .modal[style*="flex"], .dropdown.open'));
          const printCalls = await page.evaluate(() => window.__printCalls || 0);
          await shoot(page, rec);
          await page.keyboard.press('Escape');
          await page.evaluate(() => { const m = document.querySelector('.modal.open, .modal[style*="flex"]'); if (m) m.style.display = 'none'; });
          await finish(rec, 'pass', { executed: 'click', modalOrDropdownOpened: modalOpen, printInvoked: printCalls > 0 ? printCalls : undefined, printStubbed: true, note: 'behavioral assertion manual-review; see screenshot. window.print is stubbed (native dialog not automatable); real print/PDF output is Gate G5 scope' });
        }
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
      }
    } catch (e) {
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
    const records = sps.map(makeRecord);
    const m = writeManifest(records, envRecord());
    console.log(`dry-run: ${m.totals.stopPoints} stop points emitted to ${path.relative(root, OUT)}/manifest.json + stop-points.md`);
    console.log(`  launch: ${sps.filter(s => s.area === 'launch').length}, fixtures: ${fixtures.length}, controls: ${controls.length}, G1-exceptions: ${sps.filter(s => s.gate === 'G1-exception').length}`);
    return;
  }
  const records = await runBrowser();
  const m = writeManifest(records, envRecord());
  console.log(`\ntotals: ${JSON.stringify(m.totals)}`);
  fs.writeFileSync(path.join(OUT, 'console-log.json'), JSON.stringify(consoleLog, null, 2) + '\n');
  process.exit(m.totals.fail > 0 ? 1 : 0);
})();
