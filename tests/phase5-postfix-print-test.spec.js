/**
 * Phase 5 Post-Fix Print Media Test (P5-06)
 *
 * Verifies with REAL print-media emulation that code-block transfer buttons
 * are hidden in print output, while remaining visible on screen.
 *
 * Remediation for auditor review (Phase 5, round 2):
 *  - Uses Playwright's page.emulateMedia({ media: 'print' }) — no injected stylesheets.
 *  - Asserts the COMPUTED styles (getComputedStyle) of the actual
 *    .code-block-actions / .code-action-btn controls in the live preview.
 *  - Asserts the same controls are visible under screen media emulation.
 *  - Produces a print PDF via page.pdf() on Chromium-family projects and a
 *    print-emulated screenshot on Firefox (page.pdf is unsupported there,
 *    consistent with the documented P5-04 skip).
 *
 * Artifacts: qa-artifacts/phase5/postfix/
 * Test ID: P5-06 (Post-Fix, remediation round 2)
 */

const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const FILE_PATH = path.resolve(__dirname, '..', 'scripts', 'markdown-studio.html');
const BASE_URL = process.env.P1_BASE_URL || ('file:///' + FILE_PATH.replace(/\\/g, '/'));
const IS_HTTP = /^https?:\/\//i.test(BASE_URL);

const CANDIDATE_COMMIT = '9e84517122515e5e6a6e5557892bb869466e5922';
const CANDIDATE_BLOB = '567402aac4d087dd1695309fd2a561c8d033de9d';
const CANDIDATE_SHA256 = '33FB72F87FFE9E7D33B916F59076C6FD77D655B7C6786AB933A9E9DCB09F8781';

// Test document with code blocks (code-block actions render for these)
const TEST_DOCUMENT = [
  '# Post-Fix Print Media Verification',
  '',
  'This test verifies that code-block transfer buttons are hidden in print media',
  'after the fix applied in candidate 9e84517.',
  '',
  '## Code Block 1',
  '',
  '```python',
  '# Test code block',
  'print("test")',
  '```',
  '',
  '## Code Block 2',
  '',
  '```javascript',
  '// Another code block',
  'function test() {}',
  '```',
].join('\n');

// Computed visibility info for the actual controls in the preview
function collectControlState() {
  const selectors = ['.code-block-actions', '.code-action-btn', '.diag-action-btn', '.mermaid-header', '.mermaid-actions'];
  const state = {};
  for (const sel of selectors) {
    const els = Array.from(document.querySelectorAll(sel));
    state[sel] = {
      count: els.length,
      hidden: els.map((el) => getComputedStyle(el).display === 'none'),
      allHidden: els.length > 0 && els.every((el) => getComputedStyle(el).display === 'none'),
    };
  }
  return state;
}

test('P5-06 print media emulation hides code-block transfer buttons (computed styles), screen view keeps them visible', async ({ page }, testInfo) => {
  test.setTimeout(120_000);

  const browserName = testInfo.project.name;
  const evidenceDir = path.resolve(__dirname, '..', 'qa-artifacts', 'phase5', 'postfix', IS_HTTP ? 'http' : 'file');
  fs.mkdirSync(evidenceDir, { recursive: true });
  const timestamp = new Date().toISOString();

  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => pageErrors.push(String(e)));

  // Load the app
  await page.goto(BASE_URL);
  await page.waitForSelector('#editor', { state: 'visible' });
  await page.waitForFunction(() => typeof window.mermaid !== 'undefined' && typeof window.marked !== 'undefined', null, { timeout: 30000 });

  // Set the test document and wait for render
  await page.evaluate((doc) => {
    const editor = document.getElementById('editor');
    editor.value = doc;
    editor.dispatchEvent(new Event('input'));
  }, TEST_DOCUMENT);
  await page.waitForFunction(() => document.querySelectorAll('.code-action-btn').length > 0, null, { timeout: 30000 });
  await page.waitForTimeout(1500);

  // STEP 1: Screen media — controls must exist AND be visible (computed display != none)
  await page.emulateMedia({ media: 'screen' });
  const screenState = await page.evaluate(collectControlState);
  expect(screenState['.code-block-actions'].count, 'Code-block action containers must exist in screen view').toBeGreaterThan(0);
  expect(screenState['.code-action-btn'].count, 'Code-block transfer buttons must exist in screen view').toBeGreaterThan(0);
  expect(screenState['.code-block-actions'].allHidden, 'Code-block action containers must be VISIBLE on screen').toBe(false);
  expect(screenState['.code-action-btn'].allHidden, 'Code-block transfer buttons must be VISIBLE on screen').toBe(false);

  // STEP 2: Print media emulation (Playwright native) — same controls must be display:none
  await page.emulateMedia({ media: 'print' });
  const printState = await page.evaluate(collectControlState);
  expect(printState['.code-block-actions'].count, 'Code-block action containers must still exist in DOM under print emulation').toBe(screenState['.code-block-actions'].count);
  expect(printState['.code-action-btn'].count, 'Code-block transfer buttons must still exist in DOM under print emulation').toBe(screenState['.code-action-btn'].count);
  expect(printState['.code-block-actions'].allHidden, 'Code-block action containers must be display:none under print emulation').toBe(true);
  expect(printState['.code-action-btn'].allHidden, 'Code-block transfer buttons must be display:none under print emulation').toBe(true);

  // Diagram controls, when present, must also be hidden in print
  const diagramOk =
    (printState['.diag-action-btn'].count === 0 || printState['.diag-action-btn'].allHidden) &&
    (printState['.mermaid-header'].count === 0 || printState['.mermaid-header'].allHidden) &&
    (printState['.mermaid-actions'].count === 0 || printState['.mermaid-actions'].allHidden);
  expect(diagramOk, 'Diagram controls must be hidden under print emulation when present').toBe(true);

  // STEP 3: Print artifact
  let pdfGenerated = false;
  let pdfPages = null;
  let pdfFile = null;
  let screenshotFile = null;
  let pdfBlockReason = null;

  if (typeof page.pdf === 'function') {
    // page.pdf() renders with print media — the PDF itself is the artifact proof
    pdfFile = path.join(evidenceDir, `postfix-print-export-${browserName.toLowerCase().replace(/\s+/g, '-')}.pdf`);
    try {
      const pdfBuf = await page.pdf({ format: 'A4', printBackground: true });
      fs.writeFileSync(pdfFile, pdfBuf);
      pdfGenerated = true;
      // Page count from raw PDF bytes: count /Type /Page objects (non-compressed page tree)
      const raw = pdfBuf.toString('latin1');
      const matches = raw.match(/\/Type\s*\/Page[^s]/g);
      pdfPages = matches ? matches.length : null;
    } catch (err) {
      pdfBlockReason = String(err && err.message ? err.message : err);
    }
  } else {
    pdfBlockReason = 'page.pdf is not supported by this browser engine (Playwright Firefox)';
  }

  // Print-emulated screenshot as visual evidence (works everywhere, incl. Firefox)
  screenshotFile = path.join(evidenceDir, `postfix-print-emulated-${browserName.toLowerCase().replace(/\s+/g, '-')}.png`);
  await page.screenshot({ path: screenshotFile, fullPage: true });

  // Back to screen for sanity
  await page.emulateMedia({ media: 'screen' });
  const backToScreenState = await page.evaluate(collectControlState);
  expect(backToScreenState['.code-action-btn'].allHidden, 'Buttons must be visible again after switching back to screen media').toBe(false);

  expect(pageErrors, `P5-06 page errors: ${pageErrors.join('|')}`).toHaveLength(0);
  expect(consoleErrors.filter((l) => !/Failed to load resource.*404/.test(l)), `P5-06 console errors: ${consoleErrors.join('|')}`).toHaveLength(0);

  // STEP 4: Evidence record
  const evidence = {
    test: 'P5-06 print media emulation hides code-block transfer buttons (computed styles)',
    browser: browserName,
    candidateCommit: CANDIDATE_COMMIT,
    candidateBlob: CANDIDATE_BLOB,
    candidateSha256: CANDIDATE_SHA256,
    launchURL: BASE_URL,
    launchMode: IS_HTTP ? 'http' : 'file',
    timestamp,
    screenMedia: screenState,
    printMedia: printState,
    printMediaHidesButtons: printState['.code-block-actions'].allHidden && printState['.code-action-btn'].allHidden,
    screenMediaShowsButtons: !screenState['.code-block-actions'].allHidden && !screenState['.code-action-btn'].allHidden,
    pdfGenerated,
    pdfFile: pdfGenerated && pdfFile ? path.basename(pdfFile) : null,
    pdfPages,
    pdfBlockReason,
    screenshotFile: path.basename(screenshotFile),
    verificationMethod: "Playwright page.emulateMedia({media:'print'}) + getComputedStyle assertions on live controls; page.pdf() artifact",
    result: 'PASS',
    notes: 'Computed print-media styles hide .code-block-actions and .code-action-btn while both remain visible on screen. No stylesheet injected.',
  };

  const evidencePath = path.join(evidenceDir, `PHASE5-P5-06-PRINT-MEDIA-${browserName.toUpperCase().replace(/\s+/g, '-')}.evidence.json`);
  fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2));

  expect(evidence.printMediaHidesButtons, 'Print media must hide the buttons (computed)').toBe(true);
  expect(evidence.screenMediaShowsButtons, 'Screen media must show the buttons (computed)').toBe(true);
});
