/**
 * Phase 3 QA/QC suite: editor action and keyboard safety (R10-R12, shortcut
 * guard, gutter alignment). P3-07/P3-08 (no-regression + smoke) are satisfied
 * by rerunning the Phase 1 and Phase 2 suites against the same frozen
 * candidate in the full matrix.
 *
 * Evidence files are prefixed PHASE3-.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const FILE_PATH = path.resolve(__dirname, '..', 'scripts', 'markdown-studio.html');
const BASE_URL = process.env.P1_BASE_URL || ('file:///' + FILE_PATH.replace(/\\/g, '/'));
const ART_DIR = path.resolve(__dirname, '..', 'qa-artifacts');
fs.mkdirSync(ART_DIR, { recursive: true });

const F = '```';
const IMG_URL = 'https://example.com/picture.png';

function writeEvidence(label, extra) {
  fs.writeFileSync(path.join(ART_DIR, `PHASE3-${label}.evidence.json`), JSON.stringify({
    launchURL: BASE_URL, timestamp: new Date().toISOString(), ...extra,
  }, null, 2));
}

async function loadApp(page, label) {
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
  return {
    consoleIssues, consoleNoise, pageErrors,
    evidence: (extra) => writeEvidence(label, { consoleNoise: consoleNoise.slice(0, 5), ...extra }),
    assertNoErrors: async (ctx) => {
      expect(pageErrors, ctx + ' page errors: ' + pageErrors.join('|')).toHaveLength(0);
      expect(consoleIssues.filter((l) => l.startsWith('[error]')), ctx + ' console errors: ' + consoleIssues.join('|')).toHaveLength(0);
    },
  };
}

const editorState = (page) => page.evaluate(() => ({
  value: document.getElementById('editor').value,
  selStart: document.getElementById('editor').selectionStart,
  selEnd: document.getElementById('editor').selectionEnd,
}));

async function setCaret(page, pos) {
  await page.evaluate((p) => {
    const ed = document.getElementById('editor');
    ed.focus();
    ed.setSelectionRange(p, p);
  }, pos);
}

async function selectRange(page, start, end) {
  await page.evaluate(([s, e2]) => {
    const ed = document.getElementById('editor');
    ed.focus();
    ed.setSelectionRange(s, e2);
  }, [start, end]);
}

const toolBtn = (page, a) => page.locator(`.format-toolbar [data-action="${a}"]`).first();

/** nu focus of the (possibly hidden) active control so document shortcut
 *  paths run again; the guard deliberately blocks them while focus is inside
 *  any input. */
const blurActive = (page) => page.evaluate(() => {
  const el = document.activeElement;
  if (el && el.blur && el !== document.body) el.blur();
});

/** Card action handlers are wired after the async mermaid render loop; retry
 *  clicks that race it (same technique as the Phase 2 suite). */
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

// ---------------------------------------------------------------------------
// P3-01 — Insert with no selection (R10)
// ---------------------------------------------------------------------------
test('P3-01 snippets insert with no selection, no "text" fallback, caret between wrappers', async ({ page }, testInfo) => {
  const ctx = await loadApp(page, 'P3-01');

  // Bold, caret at 0
  await page.fill('#editor', 'Hello World Line');
  await setCaret(page, 0);
  await toolBtn(page, 'bold').click();
  let s = await editorState(page);
  expect(s).toEqual({ value: '****Hello World Line', selStart: 2, selEnd: 2 });

  // Italic, caret mid-word: two single asterisks, caret between them (R10 fix)
  await page.fill('#editor', 'alpha beta');
  await setCaret(page, 6);
  await toolBtn(page, 'italic').click();
  s = await editorState(page);
  expect(s).toEqual({ value: 'alpha **beta', selStart: 7, selEnd: 7 });
  expect(s.value.indexOf('*')).toBe(6);
  expect(s.value.startsWith('alpha *')).toBe(true);

  // Inline code, caret at end
  await page.fill('#editor', 'plain text here');
  await setCaret(page, 15);
  await toolBtn(page, 'code').click();
  s = await editorState(page);
  expect(s).toEqual({ value: 'plain text here``', selStart: 16, selEnd: 16 });

  // Horizontal divider
  await page.fill('#editor', 'Para');
  await setCaret(page, 4);
  await toolBtn(page, 'hr').click();
  s = await editorState(page);
  expect(s).toEqual({ value: 'Para\n\n---\n\n', selStart: 11, selEnd: 11 });

  // Code block template
  await page.fill('#editor', 'top');
  await setCaret(page, 3);
  await toolBtn(page, 'codeblock').click();
  s = await editorState(page);
  expect(s).toEqual({ value: 'top' + F + 'javascript\n\n' + F, selStart: 17, selEnd: 17 });

  // No literal placeholder text ever injected (old R10 fallback)
  await page.fill('#editor', 'one two three');
  await setCaret(page, 4);
  await toolBtn(page, 'bold').click();
  s = await editorState(page);
  expect(s).toEqual({ value: 'one ****two three', selStart: 6, selEnd: 6 });

  await ctx.assertNoErrors('P3-01');
  await ctx.evidence({ final: s, project: testInfo.project.name });
});

// ---------------------------------------------------------------------------
// P3-02 — Insert over selected text (R10)
// ---------------------------------------------------------------------------
test('P3-02 selected text is wrapped, selection stays on the original text', async ({ page }, testInfo) => {
  const ctx = await loadApp(page, 'P3-02');

  // Wrap a selection
  await page.fill('#editor', 'keep this then GONE then that');
  await selectRange(page, 15, 19); // "GONE"
  await toolBtn(page, 'bold').click();
  let s = await editorState(page);
  expect(s).toEqual({ value: 'keep this then **GONE** then that', selStart: 17, selEnd: 21 });

  // Multiline selection
  await page.fill('#editor', 'lineA\nlineB\nlineC');
  await selectRange(page, 6, 17); // "lineB\nlineC"
  await toolBtn(page, 'italic').click();
  s = await editorState(page);
  expect(s).toEqual({ value: 'lineA\n*lineB\nlineC*', selStart: 7, selEnd: 18 });

  // Divider with a selection keeps the selected content after the divider
  await page.fill('#editor', 'before SEL after');
  await selectRange(page, 7, 10); // "SEL"
  await toolBtn(page, 'hr').click();
  s = await editorState(page);
  expect(s).toEqual({ value: 'before \n\n---\n\nSEL after', selStart: 14, selEnd: 17 });

  // Caret-only (collapsed) selection must not eat neighbouring text
  await page.fill('#editor', 'plain words');
  await selectRange(page, 6, 6);
  await toolBtn(page, 'strike').click();
  s = await editorState(page);
  expect(s).toEqual({ value: 'plain ~~~~words', selStart: 8, selEnd: 8 });

  await ctx.assertNoErrors('P3-02');
  await ctx.evidence({ final: s, project: testInfo.project.name });
});

// ---------------------------------------------------------------------------
// P3-03 — Image action (R11)
// ---------------------------------------------------------------------------
test('P3-03 image action yields a valid image markdown in all selection states', async ({ page }, testInfo) => {
  const ctx = await loadApp(page, 'P3-03');
  page.on('dialog', async (d) => { await d.accept(IMG_URL); });

  // No selection: default alt text (caret 5 sits between the space and "tail")
  await page.fill('#editor', 'lead tail');
  await setCaret(page, 5);
  await toolBtn(page, 'image').click();
  let s = await editorState(page);
  expect(s).toEqual({ value: 'lead ![Alt text](' + IMG_URL + ')tail', selStart: 5 + 44, selEnd: 5 + 44 });
  expect(s.value).not.toContain('texthttps');

  // Selection becomes the alt text; URL never glued to the selection (R11 fix)
  await page.fill('#editor', 'here my screenshot end');
  await selectRange(page, 5, 18); // "my screenshot"
  await toolBtn(page, 'image').click();
  s = await editorState(page);
  expect(s).toEqual({ value: 'here ![my screenshot](' + IMG_URL + ') end', selStart: 5 + 49, selEnd: 5 + 49 });

  // Link action sanity (same prompt flow, wrapSelection unchanged)
  await page.fill('#editor', 'x');
  await setCaret(page, 1);
  await toolBtn(page, 'link').click();
  s = await editorState(page);
  expect(s).toEqual({ value: 'x[](' + IMG_URL + ')', selStart: 2, selEnd: 2 });

  await ctx.assertNoErrors('P3-03');
  await ctx.evidence({ final: s, project: testInfo.project.name });
});

// ---------------------------------------------------------------------------
// P3-04 — Studio palette newline decoding (R12)
// ---------------------------------------------------------------------------
test('P3-04 palette items decode escaped newlines on insertion', async ({ page }, testInfo) => {
  const ctx = await loadApp(page, 'P3-04');
  await page.fill('#editor', F + 'mermaid\nflowchart TD\n  A --> B\n' + F);
  await clickUntilStudioOpen(page, () => page.click('.mermaid-block-card[data-diagram-index="0"] .diag-action-btn[data-action="edit-diagram"]'));
  await expect(page.locator('#studioModal')).toHaveClass(/open/);

  // Single-line snippet inserted verbatim
  await page.fill('#builderCodeInput', 'flowchart TD\n  A ');
  await page.click('#builderSidebar .palette-btn[data-insert="[Rectangle]"]');
  let v = await page.inputValue('#builderCodeInput');
  expect(v).toBe('flowchart TD\n  A [Rectangle]');

  // Arrow snippet inserted verbatim
  await page.click('#builderSidebar .palette-btn[data-insert=" --> "]');
  v = await page.inputValue('#builderCodeInput');
  expect(v).toBe('flowchart TD\n  A [Rectangle] --> ');

  // Subgraph Box: escaped \n sequences become real newlines (R12 fix)
  await page.fill('#builderCodeInput', 'flowchart TD\n  A --> B\n');
  await page.click('#builderSidebar .palette-btn[data-insert*="subgraph ClusterName"]');
  v = await page.inputValue('#builderCodeInput');
  expect(v).toBe('flowchart TD\n  A --> B\n' +
    '\n  subgraph ClusterName [Group Title]\n    node1\n    node2\n  end\n');
  expect(v).not.toContain('\\n'); // no literal backslash-n remains anywhere

  // Node styling: literal content without escapes preserved exactly
  await page.fill('#builderCodeInput', 'flowchart TD\n  NodeA\n');
  await page.click('#builderSidebar .palette-btn[data-insert*="style NodeA"]');
  v = await page.inputValue('#builderCodeInput');
  expect(v).toBe('flowchart TD\n  NodeA\n' +
    'style NodeA fill:#6366f1,stroke:#4f46e5,stroke-width:2px,color:#fff');

  // Newline-heavy diagrams inserted by palette remain renderable
  await page.fill('#builderCodeInput', 'flowchart TD\n  A --> B\n  subgraph S[Group]\n    C\n  end\n');
  await expect(page.locator('#builderDiagramCanvas svg')).toBeVisible();

  await ctx.assertNoErrors('P3-04');
  await ctx.evidence({ builderValue: v, project: testInfo.project.name });
});

// ---------------------------------------------------------------------------
// P3-05 — Global shortcut guard
// ---------------------------------------------------------------------------
test('P3-05 global shortcuts guarded in inputs/overlays; Escape still dismisses', async ({ page }, testInfo) => {
  const ctx = await loadApp(page, 'P3-05');
  const doc = F + 'mermaid\nflowchart TD\n  A --> B\n' + F + '\n\npara text';

  // Baseline: editor-focused shortcuts still work
  await page.fill('#editor', 'words here');
  await selectRange(page, 0, 5);
  await page.keyboard.press('Control+b');
  let s = await editorState(page);
  expect(s.value).toBe('**words** here');
  expect(s.selStart).toBe(2);
  expect(s.selEnd).toBe(7);

  // Builder input: Ctrl+B/Ctrl+I must not mutate the background document
  await page.fill('#editor', doc);
  await clickUntilStudioOpen(page, () => page.click('.mermaid-block-card[data-diagram-index="0"] .diag-action-btn[data-action="edit-diagram"]'));
  await expect(page.locator('#studioModal')).toHaveClass(/open/);
  await page.fill('#builderCodeInput', 'flowchart TD\n  X --> Y\n');
  await page.keyboard.press('Control+b');
  await page.keyboard.press('Control+i');
  expect(await page.inputValue('#builderCodeInput')).toBe('flowchart TD\n  X --> Y\n');
  await expect.poll(() => editorState(page).then((r) => r.value)).toBe(doc);

  // Escape with focus in builder still closes Studio
  await page.keyboard.press('Escape');
  await expect(page.locator('#studioModal')).not.toHaveClass(/open/);
  // The hidden builder textarea still owns focus, so doc shortcuts stay
  // blocked (guard by design); blur to resume document-level shortcuts.
  await blurActive(page);

  // Find bar inputs: shortcuts and typed text stay out of the document
  await page.keyboard.press('Control+f');
  await expect(page.locator('#findReplaceBar')).toHaveClass(/show/);
  await page.fill('#findInput', 'zz');
  const docBefore = (await editorState(page)).value;
  await page.keyboard.press('Control+b');
  await page.keyboard.press('Control+i');
  await page.keyboard.type('q');
  expect((await editorState(page)).value).toBe(docBefore);
  await page.keyboard.press('Escape'); // closes find bar
  await expect(page.locator('#findReplaceBar')).not.toHaveClass(/show/);
  // Firefox keeps focus in the now-hidden input while Chromium drops it to
  // body; blur to a deterministic document-level focus.
  await blurActive(page);

  // Document focus: Ctrl+F is a valid shortcut and reopens the bar
  await page.keyboard.press('Control+f');
  await expect(page.locator('#findReplaceBar')).toHaveClass(/show/);

  // Replace input: same guard
  await page.locator('#replaceInput').focus();
  await page.keyboard.press('Control+b');
  expect((await editorState(page)).value).toBe(docBefore);
  await page.keyboard.press('Escape');
  await expect(page.locator('#findReplaceBar')).not.toHaveClass(/show/);
  await blurActive(page);

  // Focus on a button inside an open overlay: Ctrl+B must not act
  await clickUntilStudioOpen(page, () => page.click('.mermaid-block-card[data-diagram-index="0"] .diag-action-btn[data-action="edit-diagram"]'));
  await expect(page.locator('#studioModal')).toHaveClass(/open/);
  await page.locator('#btnBuilderCopyCode').focus();
  await page.keyboard.press('Control+b');
  await expect.poll(() => editorState(page).then((r) => r.value)).toBe(doc);
  await page.keyboard.press('Escape');
  await expect(page.locator('#studioModal')).not.toHaveClass(/open/);

  // Command palette input: typing context guarded; Escape closes palette.
  // (Focus on a plain button outside the overlay is not a typing context —
  // same as the audited reference — so exercise the palette through its input.)
  await page.click('#btnCommandPalette');
  await expect(page.locator('#commandPaletteModal')).toHaveClass(/open/);
  await page.locator('#cmdPaletteInput').fill('wrap');
  await page.keyboard.press('Control+b');
  await expect.poll(() => editorState(page).then((r) => r.value)).toBe(doc);
  await page.keyboard.press('Escape');
  await expect(page.locator('#commandPaletteModal')).not.toHaveClass(/open/);

  // Regression: editor shortcuts unaffected by the guard
  await page.locator('#editor').focus();
  await selectRange(page, 0, 4);
  await page.keyboard.press('Control+b');
  s = await editorState(page);
  expect(s.value.startsWith('**' + F)).toBe(true);
  expect(s.selStart).toBe(2);

  await ctx.assertNoErrors('P3-05');
  await ctx.evidence({ final: s, project: testInfo.project.name });
});

// ---------------------------------------------------------------------------
// P3-06 — Gutter alignment (reproduce-first; conditional fix)
// ---------------------------------------------------------------------------
test('P3-06 nowrap gutter rows align within 2.5px; wrap-mode drift recorded', async ({ page }, testInfo) => {
  const ctx = await loadApp(page, 'P3-06');
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1280, height: 900 });

  const longLine = 'The quick brown fox jumps over the lazy dog and keeps running far beyond the pane edge ';
  const lines = [];
  for (let i = 0; i < 40; i++) lines.push(i % 7 === 0 ? longLine.repeat(2) : `Line ${i + 1}: short`);
  await page.fill('#editor', lines.join('\n'));
  // fill() scrolls the textarea to the caret; reset to a clean top state
  await page.evaluate(() => {
    const ed = document.getElementById('editor');
    ed.scrollTop = 0;
    document.getElementById('lineNumbers').scrollTop = 0;
  });

  const measure = () => page.evaluate(() => {
    const ed = document.getElementById('editor');
    const gutter = document.getElementById('lineNumbers');
    const edCS = getComputedStyle(ed);
    const gCS = getComputedStyle(gutter);
    const padTop = parseFloat(edCS.paddingTop);
    const padL = parseFloat(edCS.paddingLeft);
    const padR = parseFloat(edCS.paddingRight);
    const mirror = document.createElement('div');
    mirror.style.cssText = 'position:absolute;left:-9999px;top:0;visibility:hidden;' +
      'font-family:' + edCS.fontFamily + ';font-size:' + edCS.fontSize + ';' +
      'line-height:' + edCS.lineHeight + ';white-space:' + edCS.whiteSpace + ';' +
      'word-break:' + edCS.wordBreak + ';overflow-wrap:' + edCS.overflowWrap + ';' +
      'tab-size:' + edCS.tabSize + ';box-sizing:content-box;padding:0;margin:0;border:0;' +
      'width:' + (ed.clientWidth - padL - padR) + 'px;';
    const content = ed.value.split('\n');
    const esc = (x) => x.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    let html = '';
    content.forEach((line, i) => { html += (i ? '\n' : '') + '<span data-ln="' + i + '">' + esc(line) + '</span>'; });
    mirror.innerHTML = html;
    document.body.appendChild(mirror);
    const edRect = ed.getBoundingClientRect();
    const gRect = gutter.getBoundingClientRect();
    const gPadTop = parseFloat(gCS.paddingTop);
    const samples = [];
    const check = [1, 5, 9, 15, 20, 25, 30, 35, 40];
    for (const n of check) {
      const i = n - 1;
      const span = mirror.querySelector('[data-ln="' + i + '"]');
      if (!span) continue;
      const editorAbsY = edRect.top + padTop + span.offsetTop - ed.scrollTop;
      const gutterAbsY = gRect.top + gPadTop + i * parseFloat(gCS.lineHeight) - gutter.scrollTop;
      samples.push({ line: n, gutterY: Math.round(gutterAbsY * 10) / 10, editorY: Math.round(editorAbsY * 10) / 10, driftPx: Math.round((gutterAbsY - editorAbsY) * 10) / 10 });
    }
    mirror.remove();
    return {
      samples,
      maxAbsDrift: Math.max(...samples.map((s2) => Math.abs(s2.driftPx))),
      gLineHeight: gCS.lineHeight, edLineHeight: edCS.lineHeight,
      gFontSize: gCS.fontSize, edFontSize: edCS.fontSize,
      whiteSpace: edCS.whiteSpace,
    };
  });

  const conditions = {};
  const runCondition = async (name, screenshot) => {
    const m = await measure();
    conditions[name] = m;
    if (screenshot) {
      await page.screenshot({ path: path.join(ART_DIR, `PHASE3-P3-06_${name}.png`) });
    }
    return m;
  };

  // Programmatic scrollTop fires its scroll event asynchronously; settle so
  // the gutter sync listener runs before measuring.
  const settle = () => page.waitForTimeout(300);

  // Tolerance 2.5px: Chromium-family drift after the fix is <= 1.2px (mirror
  // sub-pixel rounding); Firefox additionally carries an intrinsic ~1.6-2.2px
  // constant textarea inset. The pre-fix defect (0.8px/line accumulating to
  // 31.8px at line 40; 3.8px already at line 5) fails far above it.
  const TOL = 2.5;

  // Nowrap mode ("1:1 Line Gutter"): rows must align within tolerance
  await page.click('#btnToggleWrap'); // wordWrap default true -> OFF
  await expect(page.locator('#btnToggleWrap')).not.toHaveClass(/active/);
  await settle();
  let m = await runCondition('nowrap_top', true);
  expect(m.whiteSpace).not.toBe('pre-wrap');
  for (const s of m.samples) expect(Math.abs(s.driftPx), `nowrap drift line ${s.line}`).toBeLessThanOrEqual(TOL);

  await page.evaluate(() => { document.getElementById('editor').scrollTop = 400; });
  await settle();
  m = await runCondition('nowrap_scrolled', false);
  for (const s of m.samples) expect(Math.abs(s.driftPx), `nowrap scrolled drift line ${s.line}`).toBeLessThanOrEqual(TOL);

  await page.setViewportSize({ width: 900, height: 700 });
  await settle();
  m = await runCondition('nowrap_window_resized', false);
  for (const s of m.samples) expect(Math.abs(s.driftPx), `nowrap resized drift line ${s.line}`).toBeLessThanOrEqual(TOL);

  const resizer = await page.locator('#splitResizer').boundingBox();
  await page.mouse.move(resizer.x + resizer.width / 2, resizer.y + resizer.height / 2);
  await page.mouse.down();
  for (let dx = 20; dx <= 140; dx += 30) {
    await page.mouse.move(resizer.x + resizer.width / 2 + dx, resizer.y + resizer.height / 2);
  }
  await page.mouse.up();
  await page.waitForTimeout(300);
  m = await runCondition('nowrap_split_dragged', false);
  for (const s of m.samples) expect(Math.abs(s.driftPx), `nowrap split drift line ${s.line}`).toBeLessThanOrEqual(TOL);

  // Wrap mode: drift on soft-wrapped rows is inherent to the
  // one-number-per-logical-line gutter; recorded as evidence, not asserted.
  await page.click('#btnToggleWrap'); // back ON
  await expect(page.locator('#btnToggleWrap')).toHaveClass(/active/);
  await page.evaluate(() => { document.getElementById('editor').scrollTop = 0; });
  await settle();
  m = await runCondition('wrap_top', true);
  expect(m.samples.length).toBeGreaterThan(0);

  await ctx.assertNoErrors('P3-06');
  await ctx.evidence({
    nowrap: {
      top: conditions.nowrap_top, scrolled: conditions.nowrap_scrolled,
      resized: conditions.nowrap_window_resized, split: conditions.nowrap_split_dragged,
    },
    wrapTop: m,
    stats: {
      gFontSize: m.gFontSize, edFontSize: m.edFontSize,
      gLineHeight: m.gLineHeight, edLineHeight: m.edLineHeight,
    },
    project: testInfo.project.name,
  });
});
