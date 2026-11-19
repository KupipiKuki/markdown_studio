/**
 * Phase 5 verification and QA/QC suite:
 * - P5-01: Clipboard readback / real-API payload equality, denial, and recovery
 * - P5-02: Standalone HTML export & rendered copy for valid, invalid-diagram, and empty docs
 * - P5-03: SVG (no foreignObject, positive text-label bounds, dimensions) & PNG (decoded dims + non-bg pixels)
 * - P5-04: Tall-diagram PDF per-page text extraction (all 26 steps) & rendered-page inspection
 * - P5-05: Live-only contracts (markflow_* persistence + same-origin gemini_studio_* transfer)
 *
 * Artifacts are isolated per launch mode and browser:
 *   - http://  -> qa-artifacts/phase5/<browser>/
 *   - file://  -> qa-artifacts-fileorigin/phase5/<browser>/
 */
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const FILE_PATH = path.resolve(__dirname, '..', 'scripts', 'markdown-studio.html');
const BASE_URL = process.env.P1_BASE_URL || ('file:///' + FILE_PATH.replace(/\\/g, '/'));
const IS_HTTP = /^https?:\/\//i.test(BASE_URL);
const ART_ROOT = path.resolve(__dirname, '..', IS_HTTP ? 'qa-artifacts' : 'qa-artifacts-fileorigin', 'phase5');

const F = '```';

function browserSlug(projectName) {
  const n = String(projectName || 'unknown').toLowerCase();
  if (n.includes('edge')) return 'edge';
  if (n.includes('chrome') && !n.includes('chromium')) return 'chrome';
  if (n.includes('firefox')) return 'firefox';
  return 'chromium';
}

function getArtDir(projectName) {
  const dir = path.join(ART_ROOT, browserSlug(projectName));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function writeEvidence(projectName, label, extra) {
  const dir = getArtDir(projectName);
  fs.writeFileSync(path.join(dir, `PHASE5-${label}.evidence.json`), JSON.stringify({
    launchURL: BASE_URL,
    launchMode: IS_HTTP ? 'http' : 'file',
    browser: browserSlug(projectName),
    timestamp: new Date().toISOString(),
    ...extra,
  }, null, 2));
}

async function loadApp(page, projectName, label) {
  const consoleIssues = [];
  const consoleNoise = [];
  const pageErrors = [];
  page.on('console', (m) => {
    if (!['error', 'warning'].includes(m.type())) return;
    const line = `[${m.type()}] ${m.text()}`;
    if (/Failed to load resource.*404/.test(line)) { consoleNoise.push(line); return; }
    consoleIssues.push(line);
  });
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  await page.goto(BASE_URL);
  await page.waitForSelector('#editor', { state: 'visible' });
  await page.waitForFunction(() => typeof window.mermaid !== 'undefined' && typeof window.marked !== 'undefined', null, { timeout: 30000 });
  return {
    consoleIssues,
    consoleNoise,
    pageErrors,
    artDir: getArtDir(projectName),
    evidence: (extra) => writeEvidence(projectName, label, { consoleNoise: consoleNoise.slice(0, 5), ...extra }),
    assertNoErrors: async (ctx) => {
      expect(pageErrors, ctx + ' page errors: ' + pageErrors.join('|')).toHaveLength(0);
      expect(consoleIssues.filter((l) => l.startsWith('[error]')), ctx + ' console errors: ' + consoleIssues.join('|')).toHaveLength(0);
    },
  };
}

async function setDoc(page, content) {
  await page.evaluate((v) => {
    const ed = document.getElementById('editor');
    ed.value = v;
    ed.dispatchEvent(new Event('input'));
  }, content);
}

async function exportClick(page, sel) {
  await page.evaluate(() => { document.getElementById('exportDropdown').classList.add('open'); });
  await page.click(sel);
}

async function clearToast(page) {
  await page.evaluate(() => {
    const t = document.getElementById('toastMessage');
    t.textContent = '';
    t.classList.remove('show');
  });
}

const toastText = (page) => page.evaluate(() => document.getElementById('toastMessage').textContent);

const DOC_VALID = [
  '# Valid Export Fixture',
  '',
  'Paragraph with **bold** and `inline`.',
  '',
  F + 'mermaid',
  'flowchart TD',
  '  V1[Valid Node Alpha] --> V2[Valid Node Beta]',
  F,
].join('\n');

const DOC_INVALID = [
  '# Invalid Diagram Fixture',
  '',
  F + 'mermaid',
  'flowchart TD',
  '  BROKEN_NODE -->[',
  F,
].join('\n');

const DOC_TALL = 'flowchart TD\n'
  + Array.from({ length: 26 }, (_, i) => '  A' + (i + 1) + '[Step ' + (i + 1) + ']').join('\n')
  + '\n'
  + Array.from({ length: 25 }, (_, i) => '  A' + (i + 1) + ' --> A' + (i + 2)).join('\n');

// ---------------------------------------------------------------------------
// P5-01 — Clipboard readback / exact payload equality + denial + recovery
// ---------------------------------------------------------------------------
test('P5-01 clipboard payloads match expected Markdown and rendered HTML, with denial and recovery', async ({ page, context }, testInfo) => {
  test.setTimeout(90_000);
  const ctx = await loadApp(page, testInfo.project.name, 'P5-01');

  let permissionsGranted = false;
  try {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    permissionsGranted = true;
  } catch (e) {
    permissionsGranted = false;
  }

  // Spy on the real navigator.clipboard.writeText without replacing its success behavior
  await page.evaluate(() => {
    window.__clipCalls = [];
    window.__forceClipDeny = false;
    const realWrite = navigator.clipboard && navigator.clipboard.writeText
      ? navigator.clipboard.writeText.bind(navigator.clipboard)
      : null;
    window.__realClipboardAvailable = !!realWrite;
    navigator.clipboard.writeText = async (text) => {
      if (window.__forceClipDeny) {
        throw new DOMException('Permission denied', 'NotAllowedError');
      }
      window.__clipCalls.push(String(text));
      if (realWrite) {
        try {
          await realWrite(text);
          window.__realWriteSucceeded = true;
        } catch (err) {
          window.__realWriteSucceeded = false;
        }
      }
    };
  });

  // 1. Raw Markdown exact equality
  const mdInput = '# Exact Markdown\n\n- item 1\n- item 2\n\n`code`';
  await setDoc(page, mdInput);
  await page.waitForTimeout(500);
  await clearToast(page);
  await exportClick(page, '#btnCopyMd');
  await page.waitForFunction(() => (window.__clipCalls || []).length === 1, null, { timeout: 15000 });
  const mdCaptured = await page.evaluate(() => window.__clipCalls[0]);
  expect(mdCaptured).toBe(mdInput);

  let mdReadback = null;
  if (permissionsGranted) {
    mdReadback = await page.evaluate(async () => {
      if (!window.__realWriteSucceeded || !navigator.clipboard.readText) return null;
      try { return await navigator.clipboard.readText(); } catch (e) { return null; }
    });
    if (mdReadback !== null) {
      expect(mdReadback.replace(/\r\n/g, '\n')).toBe(mdInput.replace(/\r\n/g, '\n'));
    }
  }

  // 2. Rendered HTML exact equality
  await setDoc(page, DOC_VALID);
  await page.waitForTimeout(1500);
  const expectedRenderedHtml = await page.evaluate(() => {
    const preview = document.getElementById('previewContent');
    // Compute expected clean HTML independently of toast/clipboard
    const clone = preview.cloneNode(true);
    clone.querySelectorAll('.mermaid-header, .diag-action-btn, .mermaid-actions, .code-block-actions, .code-action-btn, .mermaid-raw-code').forEach((el) => el.remove());
    clone.querySelectorAll('.mermaid-block-card').forEach((card) => {
      card.style.border = 'none';
      card.style.boxShadow = 'none';
      card.style.margin = '1.5em 0';
      card.style.background = 'transparent';
      const viewport = card.querySelector('.mermaid-viewport');
      if (viewport) {
        viewport.style.maxHeight = 'none';
        viewport.style.height = 'auto';
        viewport.style.overflow = 'visible';
        viewport.style.background = 'none';
        viewport.style.padding = '0';
        viewport.style.cursor = 'default';
        viewport.style.display = 'flex';
        viewport.style.justifyContent = 'center';
        viewport.style.alignItems = 'center';
        viewport.removeAttribute('data-zoom');
        viewport.removeAttribute('data-pan-x');
        viewport.removeAttribute('data-pan-y');
      }
      const canvas = card.querySelector('.mermaid-canvas');
      if (canvas) {
        canvas.style.transform = 'none';
        canvas.style.transition = 'none';
        canvas.style.display = 'block';
        canvas.style.overflow = 'visible';
        canvas.style.textAlign = 'center';
      }
      const svg = canvas ? canvas.querySelector('svg') : null;
      if (svg) {
        svg.style.maxWidth = '100%';
        svg.style.height = 'auto';
        svg.style.display = 'block';
        svg.style.margin = '0 auto';
      }
    });
    return clone.innerHTML;
  });

  await clearToast(page);
  await exportClick(page, '#btnCopyHtml');
  await page.waitForFunction(() => (window.__clipCalls || []).length === 2, null, { timeout: 20000 });
  const htmlCaptured = await page.evaluate(() => window.__clipCalls[1]);
  expect(htmlCaptured).toBe(expectedRenderedHtml);
  expect(htmlCaptured).toContain('Valid Export Fixture');
  expect(htmlCaptured).toContain('<svg');
  expect(htmlCaptured).not.toContain('diag-action-btn');

  let htmlReadback = null;
  if (permissionsGranted) {
    htmlReadback = await page.evaluate(async () => {
      if (!window.__realWriteSucceeded || !navigator.clipboard.readText) return null;
      try { return await navigator.clipboard.readText(); } catch (e) { return null; }
    });
    if (htmlReadback !== null) {
      expect(htmlReadback.replace(/\r\n/g, '\n')).toBe(expectedRenderedHtml.replace(/\r\n/g, '\n'));
    }
  }

  // 3. Denial on both paths
  await page.evaluate(() => { window.__forceClipDeny = true; window.__clipCalls = []; });
  await clearToast(page);
  await exportClick(page, '#btnCopyHtml');
  await page.waitForFunction(() => /failed/i.test(document.getElementById('toastMessage').textContent || ''), null, { timeout: 15000 });
  expect(await page.evaluate(() => window.__clipCalls.length)).toBe(0);
  expect(await toastText(page)).not.toContain('copied!');

  await clearToast(page);
  await exportClick(page, '#btnCopyMd');
  await page.waitForFunction(() => /failed/i.test(document.getElementById('toastMessage').textContent || ''), null, { timeout: 15000 });
  expect(await page.evaluate(() => window.__clipCalls.length)).toBe(0);

  // 4. Recovery after denial
  await page.evaluate(() => { window.__forceClipDeny = false; });
  await clearToast(page);
  await exportClick(page, '#btnCopyMd');
  await page.waitForFunction(() => (window.__clipCalls || []).length === 1, null, { timeout: 15000 });
  await page.waitForFunction(() => /Raw Markdown copied/i.test(document.getElementById('toastMessage').textContent || ''), null, { timeout: 15000 });
  expect(await page.evaluate(() => window.__clipCalls[0])).toBe(DOC_VALID);

  await ctx.assertNoErrors('P5-01');
  await ctx.evidence({
    permissionsGranted,
    mdReadbackVerified: mdReadback !== null,
    htmlReadbackVerified: htmlReadback !== null,
    mdExactMatch: mdCaptured === mdInput,
    htmlExactMatch: htmlCaptured === expectedRenderedHtml,
    denialAndRecoveryVerified: true,
  });
});

// ---------------------------------------------------------------------------
// P5-02 — Standalone HTML & rendered copy for valid, invalid-diagram, and empty docs
// ---------------------------------------------------------------------------
test('P5-02 standalone export and rendered copy handle valid, invalid-diagram, and empty documents cleanly', async ({ page, context }, testInfo) => {
  test.setTimeout(120_000);
  const ctx = await loadApp(page, testInfo.project.name, 'P5-02');

  await page.evaluate(() => {
    window.__copiedPayloads = [];
    navigator.clipboard.writeText = async (t) => { window.__copiedPayloads.push(String(t)); };
  });

  const cases = [
    { name: 'valid', doc: DOC_VALID, waitMs: 1500 },
    { name: 'invalid', doc: DOC_INVALID, waitMs: 1500 },
    { name: 'empty', doc: '', waitMs: 600 },
  ];

  const results = {};

  for (const c of cases) {
    await setDoc(page, c.doc);
    await page.waitForTimeout(c.waitMs);

    // Rendered copy
    await page.evaluate(() => { window.__copiedPayloads = []; });
    await exportClick(page, '#btnCopyHtml');
    await page.waitForFunction(() => (window.__copiedPayloads || []).length === 1, null, { timeout: 20000 });
    const copied = await page.evaluate(() => window.__copiedPayloads[0]);

    // Standalone export
    const dlPromise = page.waitForEvent('download', { timeout: 30000 });
    await exportClick(page, '#btnExportHtml');
    const dl = await dlPromise;
    const savedPath = path.join(ctx.artDir, `export-${c.name}.html`);
    await dl.saveAs(savedPath);
    const exportedHtml = fs.readFileSync(savedPath, 'utf8');
    const bodyPart = exportedHtml.slice(exportedHtml.indexOf('</head>') + 7);

    // Common cleanliness assertions on both copied HTML and standalone body
    for (const payload of [copied, bodyPart]) {
      expect(payload).not.toContain('diag-action-btn');
      expect(payload).not.toContain('mermaid-header');
      expect(payload).not.toContain('mermaid-error-card');
      expect(payload).not.toContain('code-block-actions');
      expect(payload).not.toContain('Fix in Studio');
      expect(payload).not.toContain('data-action=');
      expect(payload).not.toContain('data-zoom=');
    }

    // Reopen standalone HTML in a fresh page
    const p2 = await context.newPage();
    const p2Errors = [];
    p2.on('pageerror', (e) => p2Errors.push(String(e)));
    await p2.goto('file:///' + savedPath.replace(/\\/g, '/'));
    const reopen = await p2.evaluate(() => ({
      buttons: document.querySelectorAll('button').length,
      controls: document.querySelectorAll('.diag-action-btn, .mermaid-header, .mermaid-error-card, .code-block-actions').length,
      h1: document.querySelector('h1') ? document.querySelector('h1').textContent : null,
      svgs: document.querySelectorAll('svg').length,
      svgRect: document.querySelector('svg') ? document.querySelector('svg').getBoundingClientRect().toJSON() : null,
      codeBlocks: Array.from(document.querySelectorAll('pre code.language-mermaid')).map((el) => el.textContent),
      bodyText: document.body.textContent.trim(),
    }));
    await p2.close();

    expect(p2Errors).toHaveLength(0);
    expect(reopen.buttons).toBe(0);
    expect(reopen.controls).toBe(0);

    if (c.name === 'valid') {
      expect(copied).toContain('<svg');
      expect(copied).toContain('Valid Node Alpha');
      expect(reopen.h1).toBe('Valid Export Fixture');
      expect(reopen.svgs).toBeGreaterThanOrEqual(1);
      expect(reopen.svgRect.width).toBeGreaterThan(20);
      expect(reopen.svgRect.height).toBeGreaterThan(20);
    } else if (c.name === 'invalid') {
      expect(copied).toContain('language-mermaid');
      expect(copied).toContain('BROKEN_NODE');
      expect(reopen.h1).toBe('Invalid Diagram Fixture');
      expect(reopen.svgs).toBe(0);
      expect(reopen.codeBlocks.some((t) => t.includes('BROKEN_NODE'))).toBe(true);
    } else if (c.name === 'empty') {
      expect(copied.trim()).toBe('');
      expect(reopen.bodyText).toBe('');
      expect(reopen.svgs).toBe(0);
    }

    results[c.name] = { copiedLength: copied.length, reopen };
  }

  await ctx.assertNoErrors('P5-02');
  await ctx.evidence({ results });
});

// ---------------------------------------------------------------------------
// P5-03 — SVG & PNG reopened artifact validation
// ---------------------------------------------------------------------------
test('P5-03 SVG and PNG exports reopen with valid bounds, labels, dimensions, and rendered pixels', async ({ page, context }, testInfo) => {
  test.setTimeout(120_000);
  const ctx = await loadApp(page, testInfo.project.name, 'P5-03');

  const doc = [
    '# Diagram Export Verification',
    '',
    F + 'mermaid',
    'flowchart TD',
    '  A[FCLABEL_ALPHA] --> B[FCLABEL_BETA]',
    F,
    '',
    F + 'mermaid',
    'sequenceDiagram',
    '  participant Sender',
    '  participant Receiver',
    '  Sender->>Receiver: SEQLABEL_MSG',
    F,
  ].join('\n');

  await setDoc(page, doc);
  await page.waitForTimeout(2200);

  // 1. Export flowchart & sequence SVGs
  const svgSpecs = [
    { index: 0, file: 'export-flowchart.svg', labels: ['FCLABEL_ALPHA', 'FCLABEL_BETA'] },
    { index: 1, file: 'export-sequence.svg', labels: ['Sender', 'Receiver', 'SEQLABEL_MSG'] },
  ];

  const svgEvidence = {};
  for (const spec of svgSpecs) {
    const dlPromise = page.waitForEvent('download', { timeout: 30000 });
    await page.click(`.mermaid-block-card[data-diagram-index="${spec.index}"] .diag-action-btn[data-action="export-svg"]`);
    const dl = await dlPromise;
    const svgPath = path.join(ctx.artDir, spec.file);
    await dl.saveAs(svgPath);
    const svgText = fs.readFileSync(svgPath, 'utf8');

    expect(svgText).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svgText).not.toContain('foreignObject');
    for (const lbl of spec.labels) {
      expect(svgText).toContain(lbl);
    }

    // Reopen SVG in a fresh page and check dimensions + text label bounds
    const p2 = await context.newPage();
    await p2.goto('file:///' + svgPath.replace(/\\/g, '/'));
    const inspect = await p2.evaluate((expectedLabels) => {
      const svg = document.querySelector('svg');
      if (!svg) return { hasSvg: false };
      const rect = svg.getBoundingClientRect();
      const texts = Array.from(svg.querySelectorAll('text')).map((t) => ({
        text: (t.textContent || '').trim(),
        rect: t.getBoundingClientRect().toJSON(),
      }));
      const matched = expectedLabels.map((lbl) => {
        const hit = texts.find((t) => t.text.includes(lbl));
        return {
          label: lbl,
          found: !!hit,
          width: hit ? hit.rect.width : 0,
          height: hit ? hit.rect.height : 0,
        };
      });
      return {
        hasSvg: true,
        widthAttr: parseFloat(svg.getAttribute('width')) || 0,
        heightAttr: parseFloat(svg.getAttribute('height')) || 0,
        viewBox: svg.getAttribute('viewBox'),
        bboxWidth: rect.width,
        bboxHeight: rect.height,
        textCount: texts.length,
        matched,
      };
    }, spec.labels);
    await p2.close();

    expect(inspect.hasSvg).toBe(true);
    expect(inspect.widthAttr).toBeGreaterThan(20);
    expect(inspect.heightAttr).toBeGreaterThan(20);
    expect(inspect.viewBox).toBeTruthy();
    expect(inspect.bboxWidth).toBeGreaterThan(20);
    expect(inspect.bboxHeight).toBeGreaterThan(20);
    for (const m of inspect.matched) {
      expect(m.found, `Label ${m.label} must be present in reopened SVG`).toBe(true);
      expect(m.width, `Label ${m.label} width must be > 0`).toBeGreaterThan(0);
      expect(m.height, `Label ${m.label} height must be > 0`).toBeGreaterThan(0);
    }
    svgEvidence[spec.file] = inspect;
  }

  // 2. Export PNG and decode/verify actual rendered pixels
  const pngDlPromise = page.waitForEvent('download', { timeout: 30000 });
  await page.click('.mermaid-block-card[data-diagram-index="0"] .diag-action-btn[data-action="export-png"]');
  const pngDl = await pngDlPromise;
  const pngPath = path.join(ctx.artDir, 'export-flowchart.png');
  await pngDl.saveAs(pngPath);
  const pngBuf = fs.readFileSync(pngPath);
  expect(pngBuf.slice(0, 4).toString('hex')).toBe('89504e47');

  const pngDataUrl = 'data:image/png;base64,' + pngBuf.toString('base64');
  const pngInspect = await page.evaluate(async (src) => {
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error('PNG decode failed'));
      img.src = src;
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const c = canvas.getContext('2d');
    c.drawImage(img, 0, 0);
    const data = c.getImageData(0, 0, canvas.width, canvas.height).data;
    const bgR = data[0], bgG = data[1], bgB = data[2];
    let nonBgPixels = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (Math.abs(data[i] - bgR) > 8 || Math.abs(data[i + 1] - bgG) > 8 || Math.abs(data[i + 2] - bgB) > 8) {
        nonBgPixels++;
      }
    }
    return {
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
      totalPixels: canvas.width * canvas.height,
      nonBgPixels,
    };
  }, pngDataUrl);

  expect(pngInspect.naturalWidth).toBeGreaterThan(100);
  expect(pngInspect.naturalHeight).toBeGreaterThan(100);
  expect(pngInspect.nonBgPixels).toBeGreaterThan(100);

  await ctx.assertNoErrors('P5-03');
  await ctx.evidence({ svgEvidence, pngInspect });
});

// ---------------------------------------------------------------------------
// P5-04 — Tall-diagram PDF per-page text extraction & rendered-page inspection
// ---------------------------------------------------------------------------
test('P5-04 tall diagram PDF paginates all 26 steps across pages without clipping', async ({ page, context }, testInfo) => {
  test.setTimeout(120_000);
  const ctx = await loadApp(page, testInfo.project.name, 'P5-04');
  const doc = '# Tall Pagination Fixture\n\n' + F + 'mermaid\n' + DOC_TALL + '\n' + F + '\n';
  await setDoc(page, doc);
  await page.waitForTimeout(2500);

  const pdfPath = path.join(ctx.artDir, 'tall-diagram.pdf');
  let pdfBlocked = false;
  let pdfBlockReason = null;

  if (typeof page.pdf !== 'function') {
    pdfBlocked = true;
    pdfBlockReason = 'page.pdf is not available on this browser engine';
  } else {
    try {
      await page.pdf({ path: pdfPath, format: 'A4', printBackground: true });
    } catch (err) {
      pdfBlocked = true;
      pdfBlockReason = String(err && err.message ? err.message : err);
    }
  }

  if (pdfBlocked) {
    await ctx.assertNoErrors('P5-04');
    await ctx.evidence({ pdfBlocked, pdfBlockReason });
    test.skip(true, `PDF generation unavailable in ${testInfo.project.name}: ${pdfBlockReason}`);
    return;
  }

  const pdfBytes = Array.from(fs.readFileSync(pdfPath));

  // Use pdf.js in a fresh page to extract per-page text and render each page
  const pdfPage = await context.newPage();
  await pdfPage.setContent('<!DOCTYPE html><html><body><script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script></body></html>');
  await pdfPage.waitForFunction(() => typeof window.pdfjsLib !== 'undefined', null, { timeout: 30000 });

  const inspection = await pdfPage.evaluate(async (bytes) => {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const loadingTask = window.pdfjsLib.getDocument({ data: new Uint8Array(bytes) });
    const pdf = await loadingTask.promise;
    const pages = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const pg = await pdf.getPage(p);
      const tc = await pg.getTextContent();
      const rawText = tc.items.map((it) => it.str + (it.hasEOL ? '\n' : '')).join('');
      const steps = Array.from(new Set((rawText.match(/Step\s+\d+/g) || []).map((s) => s.replace(/\s+/g, ' '))));

      const viewport = pg.getViewport({ scale: 1.0 });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const c = canvas.getContext('2d');
      await pg.render({ canvasContext: c, viewport }).promise;
      const data = c.getImageData(0, 0, canvas.width, canvas.height).data;
      let nonWhitePixels = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] < 245 || data[i + 1] < 245 || data[i + 2] < 245) nonWhitePixels++;
      }
      pages.push({
        pageNumber: p,
        width: canvas.width,
        height: canvas.height,
        nonWhitePixels,
        steps,
        pngDataUrl: canvas.toDataURL('image/png'),
      });
    }
    return { numPages: pdf.numPages, pages };
  }, pdfBytes);
  await pdfPage.close();

  // Save rendered PDF page PNGs for visual/evidence inspection
  const pageSummaries = [];
  const allFoundSteps = new Set();
  for (const pg of inspection.pages) {
    const b64 = pg.pngDataUrl.replace(/^data:image\/png;base64,/, '');
    fs.writeFileSync(path.join(ctx.artDir, `tall-diagram-page-${pg.pageNumber}.png`), Buffer.from(b64, 'base64'));
    pg.steps.forEach((s) => allFoundSteps.add(s));
    pageSummaries.push({
      pageNumber: pg.pageNumber,
      width: pg.width,
      height: pg.height,
      nonWhitePixels: pg.nonWhitePixels,
      steps: pg.steps,
    });
    expect(pg.nonWhitePixels, `PDF page ${pg.pageNumber} must contain rendered content`).toBeGreaterThan(500);
  }

  expect(inspection.numPages).toBeGreaterThan(1);
  const missingSteps = [];
  for (let i = 1; i <= 26; i++) {
    if (!allFoundSteps.has(`Step ${i}`)) missingSteps.push(`Step ${i}`);
  }
  expect(missingSteps, 'All 26 steps must appear across PDF pages').toEqual([]);

  await ctx.assertNoErrors('P5-04');
  await ctx.evidence({
    pdfBlocked: false,
    numPages: inspection.numPages,
    pageSummaries,
    missingSteps,
  });
});

// ---------------------------------------------------------------------------
// P5-05 — Live-only contracts: markflow_* persistence + same-origin transfer
// ---------------------------------------------------------------------------
test('P5-05 markflow_* persistence and same-origin gemini_studio_* transfer remain intact', async ({ page, context }, testInfo) => {
  test.setTimeout(90_000);
  const ctx = await loadApp(page, testInfo.project.name, 'P5-05');

  const marker = '# Persisted Phase 5 Doc\n\nContent check';
  await setDoc(page, marker);
  await page.waitForTimeout(500);

  const storageKeys = await page.evaluate(() => ({
    editorState: !!localStorage.getItem('markflow_editor_state_v2'),
    theme: localStorage.getItem('markflow_theme'),
  }));
  expect(storageKeys.editorState).toBe(true);

  await page.reload();
  await page.waitForSelector('#editor', { state: 'visible' });
  expect(await page.inputValue('#editor')).toBe(marker);

  let transferVerified = false;
  if (IS_HTTP) {
    const sender = await context.newPage();
    await sender.goto(BASE_URL);
    await sender.waitForSelector('#editor', { state: 'visible' });
    await sender.evaluate(() => {
      const bus = new BroadcastChannel('gemini_studio_bus');
      bus.postMessage({
        id: 'p5-transfer-' + Date.now(),
        targetApp: 'markdown',
        title: 'Phase 5 Transfer',
        language: 'markdown',
        content: '# Transferred OK',
        timestamp: Date.now(),
      });
      bus.close();
    });
    await page.waitForFunction(() => document.getElementById('editor').value.includes('Transferred OK'), null, { timeout: 10000 });
    await sender.close();
    transferVerified = true;
  }

  await ctx.assertNoErrors('P5-05');
  await ctx.evidence({
    storageKeys,
    reloadPreservedContent: true,
    transferVerified,
    transferNote: IS_HTTP ? 'same-origin BroadcastChannel verified' : 'file:// origin is not the same-origin HTTP transfer scenario',
  });
});
