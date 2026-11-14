/**
 * Phase 1 QA acceptance suite for the Markdown Studio migration candidate.
 * Frozen candidate: wp/studio_migration @ 68560b0208e7e1da86cd06f862de74f568e3a5af
 * Live file under test: scripts/markdown-studio.html (blob 4dd77e1a...)
 *
 * Launch origin: P1_BASE_URL env var if set (http origin runs), otherwise
 * the file:// origin of the pinned live script.
 *
 * Each test writes JSON evidence + screenshots to qa-artifacts/.
 * Storage is never cleared; every test runs in a fresh browser context.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const FILE_PATH = path.resolve(__dirname, '..', 'scripts', 'markdown-studio.html');
const BASE_URL = process.env.P1_BASE_URL || ('file:///' + FILE_PATH.replace(/\\/g, '/'));
const ART_DIR = path.resolve(__dirname, '..', 'qa-artifacts');
fs.mkdirSync(ART_DIR, { recursive: true });

const F = '```'; // backtick fence
const STRAY_SELECTOR =
  'body > svg.error-icon, body > svg[aria-roledescription="error"], ' +
  'body > [id*="mermaid-error"], body > .error-icon, body > [aria-roledescription="error"]';

/** Load the app and start collecting console/page errors as evidence. */
async function loadApp(page, testInfo, label) {
  const consoleLines = [];
  const pageErrors = [];
  page.on('console', (msg) => {
    if (['error', 'warning'].includes(msg.type())) {
      consoleLines.push(`[${msg.type()}] ${msg.text()}`);
    }
  });
  page.on('pageerror', (err) => pageErrors.push(String(err && err.stack ? err.stack : err)));
  await page.goto(BASE_URL);
  await page.waitForSelector('#editor', { state: 'visible' });
  return { consoleLines, pageErrors, evidence: writeEvidence.bind(null, testInfo, label) };
}

function writeEvidence(testInfo, label, extra) {
  const name = `${testInfo.project.name}__${label}`;
  const payload = {
    browser: testInfo.project.name,
    testId: label,
    launchURL: BASE_URL,
    timestamp: new Date().toISOString(),
    ...extra,
  };
  fs.writeFileSync(path.join(ART_DIR, `${name}.json`), JSON.stringify(payload, null, 2));
  return name;
}

async function shot(page, testInfo, slug) {
  await page.screenshot({ path: path.join(ART_DIR, `${testInfo.project.name}__${slug}.png`), fullPage: false });
}

/** Fill the only editor with a markdown doc (fires input -> preview render). */
async function setDoc(page, md) {
  await page.fill('#editor', md);
}

/**
 * The app attaches card handlers after its async render loop completes, so a
 * click that races the first render pass can hit an unwired button. Retry.
 */
async function clickUntilOpen(page, clickAction, tracker = '#studioModal') {
  for (let attempt = 0; attempt < 6; attempt++) {
    await clickAction();
    try {
      await expect(page.locator(tracker)).toHaveClass(/open/, { timeout: 2500 });
      return;
    } catch (e) { /* handler not wired yet, or render pass replaced the button */ }
  }
  await expect(page.locator(tracker)).toHaveClass(/open/); // final attempt: full timeout for diagnostics
}

async function openStudioFromCard(page, index, newCode) {
  await clickUntilOpen(page, () => page.click(
    `.mermaid-block-card[data-diagram-index="${index}"] .diag-action-btn[data-action="edit-diagram"]`
  ));
  await page.fill('#builderCodeInput', newCode);
  await page.click('#btnBuilderInsert');
  await expect(page.locator('#studioModal')).not.toHaveClass(/open/);
}

const strayCount = (page) => page.evaluate((sel) => document.querySelectorAll(sel).length, STRAY_SELECTOR);

// ---------------------------------------------------------------------------
// P1-01 — Load and syntax smoke
// ---------------------------------------------------------------------------
test('P1-01 load and syntax smoke', async ({ page }, testInfo) => {
  const { consoleLines, pageErrors, evidence } = await loadApp(page, testInfo, 'P1-01');
  await page.waitForTimeout(2000); // let CDN scripts and initial render settle
  await shot(page, testInfo, 'P1-01_loaded');
  expect(pageErrors, 'uncaught page errors: ' + pageErrors.join(' | ')).toHaveLength(0);
  evidence({
    userAgent: await page.evaluate(() => navigator.userAgent),
    consoleIssues: consoleLines,
    pageErrors,
  });
});

// ---------------------------------------------------------------------------
// P1-02 — Render then edit/rerender a valid Mermaid card
// ---------------------------------------------------------------------------
test('P1-02 render preserves source through SVG replacement and rerender', async ({ page }, testInfo) => {
  const { evidence } = await loadApp(page, testInfo, 'P1-02');
  const doc1 = `Intro\n\n${F}mermaid\nflowchart TD\n  A --> B\n` + `${F}\n\nOutro`;
  await setDoc(page, doc1);

  const card = page.locator('.mermaid-block-card[data-diagram-index="0"]');
  await expect(card.locator('.mermaid-canvas svg')).toBeVisible();
  await shot(page, testInfo, 'P1-02_before_edit');

  // Source must have survived canvas.innerHTML = svg
  const rawAfterRender = await card.locator('.mermaid-raw-code').textContent();
  expect(rawAfterRender.trim()).toBe('flowchart TD\n  A --> B');
  expect(await strayCount(page)).toBe(0);

  // Edit the same diagram -> rerender must use the preserved source path
  const doc2 = `Intro\n\n${F}mermaid\nflowchart TD\n  A --> C\n  B --> C\n` + `${F}\n\nOutro`;
  await setDoc(page, doc2);
  await expect
    .poll(async () => card.locator('.mermaid-canvas svg').textContent(), { timeout: 15000 })
    .toContain('C');
  const rawAfterRerender = await card.locator('.mermaid-raw-code').textContent();
  expect(rawAfterRerender.trim()).toBe('flowchart TD\n  A --> C\n  B --> C');
  await shot(page, testInfo, 'P1-02_after_rerender');
  evidence({
    sourceAfterRender: rawAfterRender.trim(),
    sourceAfterRerender: rawAfterRerender.trim(),
    docAfterEdit: await page.inputValue('#editor'),
  });
});

// ---------------------------------------------------------------------------
// P1-03 — Multiple diagrams and source association
// ---------------------------------------------------------------------------
test('P1-03 editing one diagram changes only its own fence (incl. after rerender)', async ({ page }, testInfo) => {
  const { evidence } = await loadApp(page, testInfo, 'P1-03');
  const doc =
    `Para one\n\n${F}mermaid\nflowchart TD\n  A --> B\n${F}\n\n` +
    `Para two\n\n${F}mermaid\nflowchart LR\n  X --> Y\n${F}\n\nEnd`;
  await setDoc(page, doc);
  const card0 = page.locator('.mermaid-block-card[data-diagram-index="0"]');
  const card1 = page.locator('.mermaid-block-card[data-diagram-index="1"]');
  await expect(card0.locator('.mermaid-canvas svg')).toBeVisible();
  await expect(card1.locator('.mermaid-canvas svg')).toBeVisible();

  await openStudioFromCard(page, 0, 'flowchart TD\n  A --> D');

  const afterInsert = await page.inputValue('#editor');
  expect(afterInsert).toContain('flowchart TD\n  A --> D');
  expect(afterInsert).toContain('flowchart LR\n  X --> Y'); // card 1 untouched
  expect((afterInsert.match(/```mermaid/g) || []).length).toBe(2);

  // Force a full rerender, then re-verify association
  await setDoc(page, afterInsert + '\n');
  await expect(card0.locator('.mermaid-raw-code')).toHaveText(/A --> D/);
  await expect(card1.locator('.mermaid-raw-code')).toHaveText(/X --> Y/);
  await expect(card0.locator('.mermaid-canvas svg')).toBeVisible();
  await expect(card1.locator('.mermaid-canvas svg')).toBeVisible();
  await shot(page, testInfo, 'P1-03_after_rerender');
  evidence({ markdownAfterInsert: afterInsert });
});

// ---------------------------------------------------------------------------
// P1-04 — Invalid diagram -> Fix in Studio -> repair
// ---------------------------------------------------------------------------
test('P1-04 invalid diagram repair via Fix in Studio', async ({ page }, testInfo) => {
  const { evidence } = await loadApp(page, testInfo, 'P1-04');
  const doc =
    `Doc start\n\n${F}mermaid\nflowchart TD\n  A -->>\n${F}\n\n` +
    `${F}mermaid\nflowchart LR\n  X --> Y\n${F}\n\nDoc end`;
  await setDoc(page, doc);

  const card0 = page.locator('.mermaid-block-card[data-diagram-index="0"]');
  const card1 = page.locator('.mermaid-block-card[data-diagram-index="1"]');
  const fixBtn = card0.locator('.mermaid-error-card [data-action="edit-diagram"]');
  await expect(fixBtn).toBeVisible();
  await shot(page, testInfo, 'P1-04_error_state');
  await expect(card1.locator('.mermaid-canvas svg')).toBeVisible(); // valid card unaffected

  await clickUntilOpen(page, () => fixBtn.click());
  const builderValue = await page.inputValue('#builderCodeInput');
  expect(builderValue).toContain('A -->>');

  await page.fill('#builderCodeInput', 'flowchart TD\n  A --> B\n  B --> C');
  await page.click('#btnBuilderInsert');
  await expect(page.locator('#studioModal')).not.toHaveClass(/open/);

  await expect(card0.locator('.mermaid-canvas svg')).toBeVisible({ timeout: 20000 });
  await expect(card0.locator('.mermaid-error-card')).toHaveCount(0);
  await shot(page, testInfo, 'P1-04_recovered');

  const repaired = await page.inputValue('#editor');
  expect(repaired).toContain('flowchart TD\n  A --> B\n  B --> C');
  expect(repaired).toContain('flowchart LR\n  X --> Y');
  expect(repaired).toContain('Doc start');
  expect(repaired).toContain('Doc end');
  expect((repaired.match(/```mermaid/g) || []).length).toBe(2);
  expect(await strayCount(page)).toBe(0);
  evidence({ repairedMarkdown: repaired });
});

// ---------------------------------------------------------------------------
// P1-05 — Error-log Copy/Dismiss
// ---------------------------------------------------------------------------
test('P1-05 error log Copy and Dismiss act on the selected entry only', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const { evidence } = await loadApp(page, testInfo, 'P1-05');
  const doc =
    `${F}mermaid\nthis is not a mermaid diagram\n${F}\n\n` +
    `${F}mermaid\nsequenceDiagram\nbroken garbage here\n${F}`;
  await setDoc(page, doc);
  await expect(page.locator('.mermaid-error-card')).toHaveCount(2, { timeout: 20000 });

  await page.click('#statusErrorIndicator');
  await expect(page.locator('#errorLogDrawer')).toBeVisible();
  await shot(page, testInfo, 'P1-05_drawer_open');

  const rows = page.locator('.error-log-row');
  await expect(rows).toHaveCount(2);
  const firstMsg = ((await rows.nth(0).locator('.error-log-msg > span').first().textContent()) || '').trim();
  const secondMsg = ((await rows.nth(1).locator('.error-log-msg > span').first().textContent()) || '').trim();
  expect(firstMsg).not.toBe(secondMsg); // two distinct errors retained separately

  // Copy targets the selected row's text; failure must not fake success
  await rows.nth(0).locator('.error-log-copy-btn').click();
  const toast = page.locator('#toastMessage');
  await expect(toast).toHaveClass(/show/);
  const toastText = (await toast.textContent()).trim();
  const clipboardProbe = await page.evaluate(() =>
    navigator.clipboard && navigator.clipboard.readText
      ? navigator.clipboard.readText().then((t) => ({ result: 'ok', text: t })).catch((e) => ({ result: 'denied', detail: String(e) }))
      : { result: 'unavailable' }
  );
  await shot(page, testInfo, 'P1-05_after_copy');

  // Dismiss removes only the selected entry
  await rows.nth(1).locator('.error-log-dismiss-btn').click();
  await expect(rows).toHaveCount(1);
  await expect(rows.nth(0).locator('.error-log-msg > span').first()).toHaveText(new RegExp(
    firstMsg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  ));
  await shot(page, testInfo, 'P1-05_after_dismiss');
  evidence({
    firstEntry: firstMsg,
    dismissedEntry: secondMsg,
    toastAfterCopy: toastText,
    clipboardProbe,
  });
});

// ---------------------------------------------------------------------------
// P1-06 — Mermaid fence / source-span matrix
// ---------------------------------------------------------------------------
test('P1-06a tilde fence survives repair', async ({ page }, testInfo) => {
  const { evidence } = await loadApp(page, testInfo, 'P1-06a');
  await setDoc(page, `Intro\n\n~~~mermaid\nflowchart TD\n  A --> B\n~~~\n\nTail`);
  await expect(page.locator('.mermaid-block-card[data-diagram-index="0"] .mermaid-canvas svg')).toBeVisible();
  await openStudioFromCard(page, 0, 'flowchart LR\n  C --> D');
  const out = await page.inputValue('#editor');
  expect(out).toContain('~~~mermaid\nflowchart LR\n  C --> D\n~~~');
  expect(out).not.toContain(F);
  expect(out.startsWith('Intro\n\n')).toBe(true);
  expect(out.endsWith('Tail')).toBe(true);
  evidence({ output: out });
});

test('P1-06b info string preserved on repair', async ({ page }, testInfo) => {
  const { evidence } = await loadApp(page, testInfo, 'P1-06b');
  await setDoc(page, `${F}mermaid title="Demo"\nflowchart TD\n  A --> B\n${F}`);
  await expect(page.locator('.mermaid-block-card[data-diagram-index="0"] .mermaid-canvas svg')).toBeVisible();
  await openStudioFromCard(page, 0, 'flowchart LR\n  C --> D');
  const out = await page.inputValue('#editor');
  expect(out).toContain(`${F}mermaid title="Demo"\nflowchart LR\n  C --> D\n${F}`);
  evidence({ output: out });
});

test('P1-06c blockquote fence keeps > prefix on repair', async ({ page }, testInfo) => {
  const { evidence } = await loadApp(page, testInfo, 'P1-06c');
  await setDoc(page, `Outer\n\n> ${F}mermaid\n> flowchart TD\n>   A --> B\n> ${F}\n\nDone`);
  await expect(page.locator('.mermaid-block-card[data-diagram-index="0"] .mermaid-canvas svg')).toBeVisible();
  await openStudioFromCard(page, 0, 'flowchart LR\n  C --> D');
  const out = await page.inputValue('#editor');
  expect(out).toContain(`> ${F}mermaid\n> flowchart LR\n>   C --> D\n> ${F}`);
  expect(out.startsWith('Outer')).toBe(true);
  evidence({ output: out });
});

test('P1-06d list-item fence repair target', async ({ page }, testInfo) => {
  const { evidence } = await loadApp(page, testInfo, 'P1-06d');
  await setDoc(page, `- item\n\n  ${F}mermaid\n  flowchart TD\n    A --> B\n  ${F}\n\nTail`);
  await expect(page.locator('.mermaid-block-card[data-diagram-index="0"] .mermaid-canvas svg')).toBeVisible();
  await openStudioFromCard(page, 0, 'flowchart LR\n  C --> D');
  const out = await page.inputValue('#editor');
  // Only the matching fence changes; bullet and surrounding text stay intact.
  expect(out.startsWith('- item\n\n  ' + F + 'mermaid')).toBe(true);
  expect(out).toContain('flowchart LR');
  expect(out).toContain('  ' + F + '\n\nTail');
  expect((out.match(/```mermaid/g) || []).length).toBe(1);
  await shot(page, testInfo, 'P1-06d_result');
  evidence({ output: out });
});

test('P1-06e CRLF document survives repair', async ({ page }, testInfo) => {
  const { evidence } = await loadApp(page, testInfo, 'P1-06e');
  const crlfDoc = 'Para\r\n\r\n' + `${F}mermaid\r\nflowchart TD\r\n  A --> B\r\n${F}` + '\r\nTail';
  await setDoc(page, crlfDoc);
  await expect(page.locator('.mermaid-block-card[data-diagram-index="0"] .mermaid-canvas svg')).toBeVisible();

  // The textarea value API normalizes CRLF to LF, so the app itself never sees
  // CRLF through the editor. Record the normalization, then repair on the
  // document as the app actually stores it.
  const storedDoc = await page.inputValue('#editor');
  const crlfNormalized = !storedDoc.includes('\r\n');

  await openStudioFromCard(page, 0, 'flowchart LR\n  X --> Y');
  const out = await page.inputValue('#editor');
  expect(out.startsWith('Para\n\n' + F + 'mermaid')).toBe(true);
  expect(out).toContain(`flowchart LR\n  X --> Y\n${F}\nTail`);
  expect((out.match(/^```mermaid/gm) || []).length).toBe(1); // exactly one fence opener
  await shot(page, testInfo, 'P1-06e_result');
  evidence({ crlfNormalizedByEditor: crlfNormalized, normalizedDoc: storedDoc, output: out });
});

test('P1-06f outer-fenced literal renders no diagram card', async ({ page }, testInfo) => {
  const { evidence } = await loadApp(page, testInfo, 'P1-06f');
  await setDoc(page, '````\n' + `${F}mermaid\nflowchart TD\n  A --> B\n${F}` + '\n````');
  await page.waitForTimeout(1000); // give any mistaken render a chance to appear
  expect(await page.locator('.mermaid-block-card').count()).toBe(0);
  await shot(page, testInfo, 'P1-06f_literal');
  evidence({ cards: 0 });
});

test('P1-06g fake mermaid fence inside a js block is not matched', async ({ page }, testInfo) => {
  const { evidence } = await loadApp(page, testInfo, 'P1-06g');
  const jsLine = 'const s = "' + F + 'mermaid wrong```";';
  const doc = `${F}js\n${jsLine}\n${F}\n\n${F}mermaid\nflowchart TD\n  A --> B\n${F}`;
  await setDoc(page, doc);
  await expect(page.locator('.mermaid-block-card')).toHaveCount(1);
  await openStudioFromCard(page, 0, 'flowchart LR\n  C --> D');
  const out = await page.inputValue('#editor');
  expect(out).toContain(jsLine); // js block untouched
  expect(out).toContain('flowchart LR\n  C --> D');
  expect((out.match(/^```mermaid/gm) || []).length).toBe(1); // exactly one real fence opener
  evidence({ output: out });
});

// ---------------------------------------------------------------------------
// P1-07 — Measurement-container regression
// ---------------------------------------------------------------------------
test('P1-07 sequence diagram and edge-labeled flowchart render without stray cleanup damage', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const { evidence } = await loadApp(page, testInfo, 'P1-07');
  const doc =
    `${F}mermaid\nsequenceDiagram\n  Alice->>Bob: Hello\n  Bob-->>Alice: Fine\n${F}\n\n` +
    `${F}mermaid\nflowchart TD\n  A -->|edge label| B\n${F}`;
  await setDoc(page, doc);

  const seqCard = page.locator('.mermaid-block-card[data-diagram-index="0"]');
  const flowCard = page.locator('.mermaid-block-card[data-diagram-index="1"]');
  await expect(seqCard.locator('.mermaid-canvas svg')).toBeVisible();
  await expect(flowCard.locator('.mermaid-canvas svg')).toBeVisible();
  await expect(seqCard.locator('.mermaid-canvas svg')).toContainText('Alice');
  await expect(flowCard.locator('.mermaid-canvas svg')).toContainText('edge label');
  await shot(page, testInfo, 'P1-07_rendered');

  expect(await strayCount(page)).toBe(0);
  expect(await page.locator('.mermaid-error-card').count()).toBe(0);
  // Font/measurement helper nodes at body level are allowed if they are not
  // error artifacts; record what is present for QA inspection.
  const bodyArtifacts = await page.evaluate(() =>
    [...document.querySelectorAll('body > svg, body > [id^="mermaid-error"]')]
      .map((el) => ({ tag: el.tagName, id: el.id, cls: el.getAttribute('class'), aria: el.getAttribute('aria-roledescription'), sample: el.outerHTML.slice(0, 160) }))
  );
  const errorLike = bodyArtifacts.filter((a) => (a.cls || '').includes('error') || (a.aria || '').includes('error') || (a.id || '').includes('error'));
  expect(errorLike).toEqual([]);

  // Trigger another full render pass: measurement containers must not wedge rendering
  await setDoc(page, doc + '\n');
  await expect(seqCard.locator('.mermaid-canvas svg')).toBeVisible();
  await expect(flowCard.locator('.mermaid-canvas svg')).toBeVisible();
  expect(await strayCount(page)).toBe(0);
  await shot(page, testInfo, 'P1-07_rerendered');
  evidence({ rerendered: true, bodyLevelArtifacts: bodyArtifacts });
});

// ---------------------------------------------------------------------------
// Regression smoke
// ---------------------------------------------------------------------------
test('SM-01 reload persists editor state', async ({ page }, testInfo) => {
  const { evidence } = await loadApp(page, testInfo, 'SM-01');
  const doc = `${F}mermaid\nflowchart TD\n  P --> Q\n${F}\n\nText persists.`;
  await setDoc(page, doc);
  await expect(page.locator('.mermaid-block-card[data-diagram-index="0"] .mermaid-canvas svg')).toBeVisible();
  await page.reload();
  await page.waitForSelector('#editor', { state: 'visible' });
  await expect(page.locator('#editor')).toHaveValue(doc);
  await expect
    .poll(async () => page.locator('.mermaid-block-card[data-diagram-index="0"] .mermaid-canvas svg').count(), { timeout: 15000 })
    .toBe(1);
  await shot(page, testInfo, 'SM-01_reloaded');
  evidence({ persistedDoc: doc });
});

test('SM-02 command palette opens', async ({ page }, testInfo) => {
  const { evidence } = await loadApp(page, testInfo, 'SM-02');
  await page.click('#btnCommandPalette');
  await expect(page.locator('#commandPaletteModal')).toHaveClass(/open/);
  await page.fill('#cmdPaletteInput', 'save');
  await page.waitForTimeout(300);
  await shot(page, testInfo, 'SM-02_palette');
  expect(await page.locator('#cmdPaletteList > *').count()).toBeGreaterThan(0);
  evidence({ paletteOpened: true });
});

test('SM-03 studio bus transfer imports a tab (shared http origin only)', async ({ page, browser, context }, testInfo) => {
  test.skip(!BASE_URL.startsWith('http'), 'gemini_studio_bus requires a shared http origin');
  const { evidence } = await loadApp(page, testInfo, 'SM-03');
  const peer = await context.newPage();
  await peer.goto(BASE_URL);
  await peer.waitForSelector('#editor');
  await peer.evaluate(() => {
    const bus = new BroadcastChannel('gemini_studio_bus');
    bus.postMessage({ id: 'probe-' + Date.now(), targetApp: 'markdown', title: 'transferProbe.md', language: 'markdown', content: '# From the bus' });
  });
  await expect(page.locator('#toastMessage')).toHaveText(/Imported "transferProbe\.md" from Studio Bus/);
  await expect(page.locator('.tab .tab-title', { hasText: 'transferProbe.md' })).toHaveCount(1);
  await shot(page, testInfo, 'SM-03_imported');
  evidence({ imported: true });
  await peer.close();
});
