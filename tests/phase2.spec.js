/**
 * Phase 2 QA/QC suite for the Markdown Studio migration.
 * Handoff checks: P2-01..P2-09 (P2-08/P2-09 are satisfied by rerunning
 * tests/phase1.spec.js against the same frozen candidate — see the QA report).
 *
 * Evidence files are prefixed with PHASE2- to avoid colliding with Phase 1 runs.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const FILE_PATH = path.resolve(__dirname, '..', 'scripts', 'markdown-studio.html');
const BASE_URL = process.env.P1_BASE_URL || ('file:///' + FILE_PATH.replace(/\\/g, '/'));
const ART_DIR = path.resolve(__dirname, '..', 'qa-artifacts');
fs.mkdirSync(ART_DIR, { recursive: true });

const F = '```';

function writeEvidence(label, extra) {
  const name = `PHASE2-${label}`;
  const payload = { launchURL: BASE_URL, timestamp: new Date().toISOString(), ...extra };
  fs.writeFileSync(path.join(ART_DIR, `${name}.evidence.json`), JSON.stringify(payload, null, 2));
}

async function loadApp(page, label) {
  const consoleIssues = [];
  const consoleNoise = [];
  const pageErrors = [];
  page.on('console', (m) => {
    if (!['error', 'warning'].includes(m.type())) return;
    const line = `[${m.type()}] ${m.text()}`;
    // Pre-existing, unrelated to the app: branded browsers request a favicon
    // the repo does not ship, over http origins.
    if (/Failed to load resource.*404/.test(line)) { consoleNoise.push(line); return; }
    consoleIssues.push(line);
  });
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  await page.goto(BASE_URL);
  await page.waitForSelector('#editor', { state: 'visible' });
  return {
    consoleIssues, consoleNoise, pageErrors,
    evidence: (extra) => writeEvidence(label, { consoleNoise: consoleNoise.slice(0, 5), ...extra }),
    assertNoErrors: async (ctx) => {
      expect(pageErrors, ctx + ' page errors: ' + pageErrors.join('|')).toHaveLength(0);
      expect(consoleIssues.filter(l => l.startsWith('[error]')), ctx + ' console errors: ' + consoleIssues.join('|')).toHaveLength(0);
    },
  };
}

/** Slow down mermaid.render for sources containing the marker. */
async function instrumentSlowRender(page, marker, delayMs) {
  await page.evaluate(([m, d]) => {
    if (!window.__origRender) window.__origRender = window.mermaid.render.bind(window.mermaid);
    const orig = window.__origRender;
    window.mermaid.render = async (id, code) => {
      if (String(code).includes(m)) { await new Promise(r => setTimeout(r, d)); }
      return orig(id, code);
    };
  }, [marker, delayMs]);
}

/** Handlers are wired after the async render loop; retry clicks that race it. */
async function clickUntilStudioOpen(page, clickAction) {
  for (let attempt = 0; attempt < 6; attempt++) {
    await clickAction();
    try {
      await expect(page.locator('#studioModal')).toHaveClass(/open/, { timeout: 2500 });
      return;
    } catch (e) { /* retry */ }
  }
  await expect(page.locator('#studioModal')).toHaveClass(/open/);
}

const cardEval = (page, index, fn) => page.evaluate(
  ([i, src]) => {
    // eslint-disable-next-line no-eval
    const fnInPage = eval('(' + src + ')');
    const card = document.querySelector(`.mermaid-block-card[data-diagram-index="${i}"]`);
    if (!card) return null;
    const viewport = card.querySelector('.mermaid-viewport');
    const canvas = card.querySelector('.mermaid-canvas');
    const svg = canvas ? canvas.querySelector('svg') : null;
    return fnInPage(viewport, canvas, svg);
  },
  [index, fn.toString()]
);

// ---------------------------------------------------------------------------
// P2-01 — SVG label typography (R06)
// ---------------------------------------------------------------------------
test('P2-01 diagram labels use Studio typography (foreignObject resets)', async ({ page }, testInfo) => {
  const ctx = await loadApp(page, 'P2-01');
  const doc = `${F}mermaid\nflowchart TD\n  Alpha[Label One] --> Beta[Label Two]\n${F}\n\n${F}mermaid\nsequenceDiagram\n  Alice->>Bob: Hello\n${F}`;
  await page.fill('#editor', doc);
  const flowCard = page.locator('.mermaid-block-card[data-diagram-index="0"]');
  const seqCard = page.locator('.mermaid-block-card[data-diagram-index="1"]');
  await expect(flowCard.locator('.mermaid-canvas svg')).toBeVisible();
  await expect(seqCard.locator('.mermaid-canvas svg')).toBeVisible();

  const styles = await page.evaluate(() => {
    const foDiv = document.querySelector('.mermaid-canvas foreignObject div, .mermaid-canvas foreignObject span');
    const seqText = document.querySelector('.mermaid-block-card[data-diagram-index="1"] svg text');
    const cs = foDiv ? getComputedStyle(foDiv) : null;
    return {
      hasForeignObjectLabel: !!foDiv,
      fontFamily: cs ? cs.fontFamily : null,
      margin: cs ? `${cs.marginTop}/${cs.marginLeft}` : null,
      padding: cs ? `${cs.paddingTop}/${cs.paddingLeft}` : null,
      seqFontFamily: seqText ? getComputedStyle(seqText).fontFamily : null,
    };
  });
  expect(styles.hasForeignObjectLabel).toBe(true);
  expect(styles.fontFamily.toLowerCase()).toContain('inter');
  expect(styles.margin).toBe('0px/0px');
  expect(styles.padding).toBe('0px/0px');
  expect((styles.seqFontFamily || '').toLowerCase()).toContain('inter');
  await page.screenshot({ path: path.join(ART_DIR, `PHASE2-P2-01_${testInfo.project.name}_normal.png`) });

  // Narrow preview width: labels must stay legible/consistent
  await page.setViewportSize({ width: 700, height: 700 });
  await page.waitForTimeout(600);
  const narrowStyles = await page.evaluate(() => {
    const foDiv = document.querySelector('.mermaid-canvas foreignObject div, .mermaid-canvas foreignObject span');
    return foDiv ? { fontFamily: getComputedStyle(foDiv).fontFamily, margin: getComputedStyle(foDiv).marginTop } : null;
  });
  expect((narrowStyles.fontFamily || '').toLowerCase()).toContain('inter');
  await page.screenshot({ path: path.join(ART_DIR, `PHASE2-P2-01_${testInfo.project.name}_narrow.png`) });
  await ctx.assertNoErrors('P2-01');
  ctx.evidence({ normal: styles, narrow: narrowStyles, project: testInfo.project.name });
});

// ---------------------------------------------------------------------------
// P2-02 — Tall/wide diagram fitting + refit on pane/window resize (R07)
// ---------------------------------------------------------------------------
test('P2-02 tall and wide diagrams fit and refit with pane and window resizing', async ({ page }, testInfo) => {
  const ctx = await loadApp(page, 'P2-02');
  test.setTimeout(180_000);
  const nodes = Array.from({ length: 13 }, (_, i) => `  N${i + 1}[Node ${i + 1}]`);
  const tallFlow = 'flowchart TD\n' + nodes.map((n, i) => i < nodes.length - 1 ? `${n} --> N${i + 2}` : n).join('\n');
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.fill('#editor', `${F}mermaid\n${tallFlow}\n${F}`);
  const card = page.locator('.mermaid-block-card[data-diagram-index="0"]');
  await expect(card.locator('.mermaid-canvas svg')).toBeVisible();
  await page.waitForTimeout(400); // let the fit transition settle before measuring

  const readFit = () => cardEval(page, 0, (viewport, canvas, svg) => {
    if (!viewport || !svg) return null;
    const vr = viewport.getBoundingClientRect();
    const sr = svg.getBoundingClientRect();
    const style = new DOMMatrixReadOnly(getComputedStyle(canvas).transform);
    return {
      fitScale: parseFloat(viewport.dataset.fitScale),
      zoom: parseFloat(viewport.dataset.zoom),
      manuallyAdjusted: viewport.dataset.manuallyAdjusted === 'true',
      viewportW: Math.round(vr.width), viewportH: Math.round(vr.height),
      svgScaledW: Math.round(sr.width), svgScaledH: Math.round(sr.height),
      matrixScale: style ? style.a : null,
      intrinsicW: parseFloat(svg.dataset.intrinsicWidth),
      intrinsicH: parseFloat(svg.dataset.intrinsicHeight),
    };
  });

  const fit1 = await readFit();
  expect(fit1.intrinsicW).toBeGreaterThan(1);
  expect(fit1.fitScale).toBeLessThanOrEqual(1.0001);
  expect(Math.abs(fit1.zoom - fit1.fitScale)).toBeLessThan(0.001);
  expect(fit1.svgScaledW).toBeLessThanOrEqual(fit1.viewportW + 2);
  expect(fit1.svgScaledH).toBeLessThanOrEqual(fit1.viewportH + 2);
  await page.screenshot({ path: path.join(ART_DIR, `PHASE2-P2-02_${testInfo.project.name}_tall_fit.png`) });

  // Wide diagram
  await page.fill('#editor', `${F}mermaid\nflowchart LR\n  A[Start Label] --> B[Wide Label Two] --> C[Wide Label Three] --> D[End Label Long]\n${F}`);
  await expect(card.locator('.mermaid-canvas svg')).toBeVisible();
  await page.waitForTimeout(400);
  const fit2 = await readFit();
  expect(Math.abs(fit2.zoom - fit2.fitScale)).toBeLessThan(0.001);
  expect(fit2.svgScaledW).toBeLessThanOrEqual(fit2.viewportW + 2);
  expect(fit2.svgScaledH).toBeLessThanOrEqual(fit2.viewportH + 2);

  // Drag the split resizer: fit must recalculate without clipping
  const resizer = await page.locator('#splitResizer').boundingBox();
  const wideBefore = await readFit();
  await page.mouse.move(resizer.x + resizer.width / 2, resizer.y + resizer.height / 2);
  await page.mouse.down();
  for (let dx = 10; dx <= 120; dx += 20) {
    await page.mouse.move(resizer.x + resizer.width / 2 + dx, resizer.y + resizer.height / 2);
  }
  await page.mouse.up();
  await page.waitForTimeout(400);
  const wideAfterDrag = await readFit();
  expect(wideAfterDrag.viewportW).toBeLessThan(wideBefore.viewportW);
  expect(Math.abs(wideAfterDrag.zoom - wideAfterDrag.fitScale)).toBeLessThan(0.001);
  expect(wideAfterDrag.svgScaledW).toBeLessThanOrEqual(wideAfterDrag.viewportW + 2);

  // Window resize: refit again, no runaway scale
  await page.setViewportSize({ width: 800, height: 700 });
  await page.waitForTimeout(500);
  const fit3 = await readFit();
  expect(Math.abs(fit3.zoom - fit3.fitScale)).toBeLessThan(0.001);
  expect(fit3.fitScale).toBeLessThanOrEqual(1.0001);
  expect(fit3.svgScaledW).toBeLessThanOrEqual(fit3.viewportW + 2);
  await page.screenshot({ path: path.join(ART_DIR, `PHASE2-P2-02_${testInfo.project.name}_after_refit.png`) });
  await ctx.assertNoErrors('P2-02');
  ctx.evidence({ tallFit: fit1, wideFit: fit2, afterResizerDrag: wideAfterDrag, afterWindowResize: fit3, project: testInfo.project.name });
});

// ---------------------------------------------------------------------------
// P2-03 — User zoom retention across unrelated edits and refits (R07)
// ---------------------------------------------------------------------------
test('P2-03 manual zoom/pan survives rerenders and refits', async ({ page }, testInfo) => {
  const ctx = await loadApp(page, 'P2-03');
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.fill('#editor', `${F}mermaid\nflowchart TD\n  A --> B --> C\n${F}\n\nPara`);
  const card = page.locator('.mermaid-block-card[data-diagram-index="0"]');
  await expect(card.locator('.mermaid-canvas svg')).toBeVisible();
  await page.waitForTimeout(400);
  const initial = await cardEval(page, 0, (vp) => ({ fit: parseFloat(vp.dataset.fitScale), zoom: parseFloat(vp.dataset.zoom), panX: parseFloat(vp.dataset.panX) }));

  // Manual wheel zoom + drag pan
  const vpBox = await card.locator('.mermaid-viewport').boundingBox();
  const cx = vpBox.x + vpBox.width / 2, cy = vpBox.y + vpBox.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.wheel(0, -120);
  await page.mouse.wheel(0, -120);
  await page.mouse.down();
  await page.mouse.move(cx + 40, cy + 30);
  await page.mouse.move(cx + 60, cy + 45);
  await page.mouse.up();
  await page.waitForTimeout(300);
  const manual = await cardEval(page, 0, (vp) => ({
    manu: vp.dataset.manuallyAdjusted === 'true',
    zoom: parseFloat(vp.dataset.zoom), panX: parseFloat(vp.dataset.panX), panY: parseFloat(vp.dataset.panY),
  }));
  expect(manual.manu).toBe(true);
  expect(manual.zoom).toBeGreaterThan(initial.fit + 0.05); // clearly above fit scale
  expect(Math.abs(manual.panX - 60)).toBeLessThan(4);
  expect(Math.abs(manual.panY - 45)).toBeLessThan(4);

  // Unrelated text edit triggers rerender: manual interaction must persist
  await page.fill('#editor', `${F}mermaid\nflowchart TD\n  A --> B --> C\n${F}\n\nPara changed`);
  await expect(card.locator('.mermaid-canvas svg')).toBeVisible();
  await page.waitForTimeout(500);
  const afterEdit = await cardEval(page, 0, (vp) => ({
    manu: vp.dataset.manuallyAdjusted === 'true',
    zoom: parseFloat(vp.dataset.zoom), panX: parseFloat(vp.dataset.panX), panY: parseFloat(vp.dataset.panY),
  }));
  expect(afterEdit.manu).toBe(true);
  expect(afterEdit.zoom).toBeCloseTo(manual.zoom, 1);
  expect(afterEdit.panX).toBeCloseTo(manual.panX, 0);
  expect(afterEdit.panY).toBeCloseTo(manual.panY, 0);

  // Pane resize refits other diagrams but must NOT reset this manual card
  await page.setViewportSize({ width: 900, height: 700 });
  await page.waitForTimeout(500);
  const afterRefit = await cardEval(page, 0, (vp) => ({
    zoom: parseFloat(vp.dataset.zoom), panX: parseFloat(vp.dataset.panX), manu: vp.dataset.manuallyAdjusted === 'true',
  }));
  expect(afterRefit.manu).toBe(true);
  expect(afterRefit.zoom).toBeCloseTo(manual.zoom, 1);
  expect(afterRefit.panX).toBeCloseTo(manual.panX, 0);
  await page.screenshot({ path: path.join(ART_DIR, `PHASE2-P2-03_${testInfo.project.name}_preserved.png`) });
  await ctx.assertNoErrors('P2-03');
  ctx.evidence({ initial, manual, afterEdit, afterRefit, project: testInfo.project.name });
});

// ---------------------------------------------------------------------------
// P2-04 — Document theme isolation from diagram styling (R08)
// ---------------------------------------------------------------------------
test('P2-04 document theme applies to diagrams; builder theme cannot leak back', async ({ page }, testInfo) => {
  const ctx = await loadApp(page, 'P2-04');
  const doc = `${F}mermaid\nflowchart TD\n  A[Theme Node] --> B[Theme Node Two]\n${F}\n\n# Heading\n\n${F}js\nconst x = 1;\n${F}`;
  await page.fill('#editor', doc);
  const card = page.locator('.mermaid-block-card[data-diagram-index="0"]');
  await expect(card.locator('.mermaid-canvas svg')).toBeVisible();

  const readNodeFill = () => page.evaluate(() => {
    const rectEl = document.querySelector('.mermaid-block-card[data-diagram-index="0"] svg .node rect, .mermaid-block-card[data-diagram-index="0"] svg rect.basic');
    const h1 = document.querySelector('#previewContent h1');
    const foDiv = document.querySelector('.mermaid-canvas foreignObject div, .mermaid-canvas foreignObject span');
    return {
      nodeFill: rectEl ? (rectEl.getAttribute('fill') || rectEl.style.fill || getComputedStyle(rectEl).fill) : null,
      h1Color: h1 ? getComputedStyle(h1).color : null,
      labelColor: foDiv ? getComputedStyle(foDiv).color : null,
    };
  });

  const docLight = await readNodeFill();
  expect(docLight.nodeFill).toBeTruthy();

  // Open the Studio with a different (Forest) theme, render, close
  await clickUntilStudioOpen(page, () => page.click('.mermaid-block-card[data-diagram-index="0"] .diag-action-btn[data-action="edit-diagram"]'));
  await page.selectOption('#builderThemeSelect', 'forest');
  const builderFillLatest = () => page.evaluate(() => {
    const r = document.querySelector('#builderDiagramCanvas svg .node rect, #builderDiagramCanvas svg rect.basic');
    return r ? (r.getAttribute('fill') || r.style.fill || getComputedStyle(r).fill) : '';
  });
  const builderFill = await builderFillLatest();
  expect(builderFill).toBeTruthy();
  await expect
    .poll(async () => (await builderFillLatest()).toLowerCase(), { timeout: 20000 })
    .not.toBe((docLight.nodeFill || '').toLowerCase()); // builder truly uses Forest

  await page.click('#btnCloseStudio');
  await expect(page.locator('#studioModal')).not.toHaveClass(/open/);

  // Rerender the preview: the document theme, not Forest, must style diagrams
  await page.fill('#editor', doc + '\n\nTail');
  await expect(card.locator('.mermaid-canvas svg')).toBeVisible();
  await expect
    .poll(async () => (await readNodeFill()).nodeFill.toLowerCase(), { timeout: 20000 })
    .toBe((docLight.nodeFill || '').toLowerCase());
  const docAfterBuilder = await readNodeFill();

  // Switch the document theme: diagram colors must follow the document
  await page.click('#btnThemeToggle');
  const themeAttr = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  await expect
    .poll(async () => (await readNodeFill()).nodeFill.toLowerCase(), { timeout: 20000 })
    .not.toBe((docLight.nodeFill || '').toLowerCase());
  const docDark = await readNodeFill();
  await expect
    .poll(async () => (await readNodeFill()).h1Color, { timeout: 20000 })
    .not.toBe(docLight.h1Color); // normal markdown preview control follows the theme too
  expect((docDark.nodeFill || '').toLowerCase()).not.toBe((docLight.nodeFill || '').toLowerCase()); // diagrams follow doc theme
  await page.screenshot({ path: path.join(ART_DIR, `PHASE2-P2-04_${testInfo.project.name}_${themeAttr}.png`) });
  await ctx.assertNoErrors('P2-04');
  ctx.evidence({ docLight, builderFill, docAfterBuilder, themeAttr, docDark, project: testInfo.project.name });
});

// ---------------------------------------------------------------------------
// P2-05 — Listener lifecycle over 50 cycles (R09 differential validation)
// ---------------------------------------------------------------------------
test('P2-05 no listener accumulation or errors across 50 render/edit/tab cycles', async ({ page }, testInfo) => {
  const ctx = await loadApp(page, 'P2-05');
  test.setTimeout(300_000);
  // Count any new window listener registrations from this point on
  await page.evaluate(() => {
    const orig = window.addEventListener.bind(window);
    window.__regCount = 0;
    window.addEventListener = function (type, ...rest) {
      if (type === 'mousemove' || type === 'mouseup' || type === 'resize') window.__regCount++;
      return orig(type, ...rest);
    };
  });

  const docA = `${F}mermaid\nflowchart TD\n  C1 --> C2\n${F}\n\ncycle A`;
  const docB = `${F}mermaid\nflowchart TD\n  D1 --> D2\n${F}\n\ncycle B`;
  const regSamples = [];
  for (let i = 0; i < 50; i++) {
    await page.fill('#editor', i % 2 === 0 ? docA : docB);
    if (i % 10 === 9) await page.locator('#tabbar .tab').nth(0).click();
    if (i % 10 === 9) {
      const tabs = page.locator('#tabbar .tab');
      await tabs.nth(Math.min(1, await tabs.count() - 1)).click();
    }
    if (i % 25 === 24) await page.click('#btnToggleViewer'); // hide viewer
    if (i % 25 === 24) await page.waitForTimeout(150);
    regSamples.push(await page.evaluate(() => window.__regCount));
  }
  expect(regSamples[0]).toBe(0); // nothing registered by the loop's first iteration
  expect(regSamples[regSamples.length - 1]).toBe(0); // none accumulated across cycles

  // One gesture -> one response (drag pan moves by exactly the drag delta)
  const card = page.locator('.mermaid-block-card[data-diagram-index="0"]');
  await expect(card.locator('.mermaid-canvas svg')).toBeVisible();
  const vpBox = await card.locator('.mermaid-viewport').boundingBox();
  const cx = vpBox.x + vpBox.width / 2, cy = vpBox.y + vpBox.height / 2;
  const before = await cardEval(page, 0, (vp) => ({ panX: parseFloat(vp.dataset.panX || 0), panY: parseFloat(vp.dataset.panY || 0) }));
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 50, cy + 20);
  await page.mouse.up();
  await page.waitForTimeout(200);
  const after = await cardEval(page, 0, (vp) => ({ panX: parseFloat(vp.dataset.panX), panY: parseFloat(vp.dataset.panY) }));
  expect(Math.abs((after.panX - before.panX) - 50)).toBeLessThanOrEqual(2);
  expect(Math.abs((after.panY - before.panY) - 20)).toBeLessThanOrEqual(2);
  await page.screenshot({ path: path.join(ART_DIR, `PHASE2-P2-05_${testInfo.project.name}_after_cycles.png`) });
  await ctx.assertNoErrors('P2-05');
  ctx.evidence({ cycles: 50, regCountSamples: [regSamples[0], regSamples[regSamples.length - 1]], panBefore: before, panAfter: after, project: testInfo.project.name });
});

// ---------------------------------------------------------------------------
// P2-06 — Preview stale-render race (R15)
// ---------------------------------------------------------------------------
test('P2-06 delayed preview render cannot overwrite a newer document', async ({ page }, testInfo) => {
  const ctx = await loadApp(page, 'P2-06');
  test.setTimeout(180_000);
  await instrumentSlowRender(page, 'SLOWX', 2500);

  // Pass A: slow render for doc A
  await page.fill('#editor', `${F}mermaid\nflowchart TD\n  SLOWX[Slow Old Node]\n${F}\n\nold`);
  await page.waitForTimeout(500); // pass A is now inside its slow mermaid.render

  // Pass B: newer document with a quick diagram
  await page.fill('#editor', `${F}mermaid\nflowchart TD\n  Q[Quick New Node]\n${F}\n\nnew`);
  await page.waitForTimeout(4500); // let both passes finish

  const state = await cardEval(page, 0, (vp, canvas, svg) => ({
    text: canvas ? canvas.textContent : '',
    zoom: vp ? vp.dataset.zoom : null,
  }));
  expect(state.text).toContain('Quick New Node');
  expect(state.text).not.toContain('Slow Old Node');
  await page.screenshot({ path: path.join(ART_DIR, `PHASE2-P2-06_${testInfo.project.name}_newest_wins.png`) });

  // Same race via tab switch: slow doc on tab 1, switch to a new tab mid-render
  await page.fill('#editor', `${F}mermaid\nflowchart TD\n  SLOWX[Tab One Slow]\n${F}`);
  await page.waitForTimeout(500);
  await page.click('#btnTabAdd');
  await page.fill('#editor', `# Fresh tab\n\n${F}mermaid\nflowchart TD\n  Z[Fresh Tab Node]\n${F}`);
  await page.waitForTimeout(4500);
  const afterText = await page.evaluate(() => document.querySelector('#previewContent').textContent);
  expect(afterText).toContain('Fresh Tab Node');
  expect(afterText).not.toContain('Tab One Slow');
  await ctx.assertNoErrors('P2-06');
  ctx.evidence({ firstRace: state, secondRaceContains: afterText.includes('Fresh Tab Node'), project: testInfo.project.name });
});

// ---------------------------------------------------------------------------
// P2-07 — Studio/builder stale-render race (R15)
// ---------------------------------------------------------------------------
test('P2-07 stale builder renders cannot overwrite the latest Studio state', async ({ page }, testInfo) => {
  const ctx = await loadApp(page, 'P2-07');
  test.setTimeout(180_000);
  await page.fill('#editor', `${F}mermaid\nflowchart TD\n  A --> B\n${F}\n\npara`);
  const card = page.locator('.mermaid-block-card[data-diagram-index="0"]');
  await expect(card.locator('.mermaid-canvas svg')).toBeVisible();

  await clickUntilStudioOpen(page, () => page.click('.mermaid-block-card[data-diagram-index="0"] .diag-action-btn[data-action="edit-diagram"]'));
  await instrumentSlowRender(page, 'SLOWX', 2500);

  // Slow render A in flight, then a quick edit B supersedes it
  await page.fill('#builderCodeInput', 'flowchart TD\n  SLOWX[Builder Slow]\n  A1 --> B1');
  await page.waitForTimeout(500);
  await page.fill('#builderCodeInput', 'flowchart TD\n  QN[Builder Quick]\n  C1 --> D1');
  await page.waitForTimeout(4500);

  const builderText = await page.evaluate(() => document.querySelector('#builderDiagramCanvas').textContent);
  expect(builderText).toContain('Builder Quick');
  expect(builderText).not.toContain('Builder Slow');

  // Stale error must not overwrite a newer valid render
  await page.fill('#builderCodeInput', 'not a diagram at all');
  await page.waitForTimeout(250);
  await page.fill('#builderCodeInput', 'flowchart TD\n  V1[Valid Now] --> V2');
  await expect(page.locator('#builderDiagramCanvas svg')).toBeVisible();
  await page.waitForTimeout(400);
  const badgeText2 = await page.evaluate(() => document.querySelector('#builderValidationBadge').textContent);
  const builderText2 = await page.evaluate(() => document.querySelector('#builderDiagramCanvas').textContent);
  expect(badgeText2).toContain('Diagram Valid');
  expect(builderText2).toContain('Valid Now');

  // Close during a slow render: nothing may land in the canvas afterwards
  await page.fill('#builderCodeInput', 'flowchart TD\n  SLOWX[Close Race]\n  X1 --> X2');
  await page.waitForTimeout(500);
  await page.click('#btnCloseStudio');
  const snapshotAtClose = await page.evaluate(() => document.querySelector('#builderDiagramCanvas').innerHTML);
  await page.waitForTimeout(3500);
  const snapshotAfter = await page.evaluate(() => document.querySelector('#builderDiagramCanvas').innerHTML);
  expect(snapshotAfter).toBe(snapshotAtClose);
  expect(await page.evaluate(() => document.querySelector('#builderDiagramCanvas').textContent)).not.toContain('Close Race');
  await page.screenshot({ path: path.join(ART_DIR, `PHASE2-P2-07_${testInfo.project.name}_closed.png`) });
  await ctx.assertNoErrors('P2-07');
  ctx.evidence({ quickWins: builderText.includes('Builder Quick'), validBadgeAfterRace: badgeText2, canvasUnchangedAfterClose: snapshotAfter === snapshotAtClose, project: testInfo.project.name });
});
