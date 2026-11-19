# Phase 5 Post-Fix Print Evidence Summary (Rev 2)

**Candidate**: `9e84517122515e5e6a6e5557892bb869466e5922`
**Blob**: `567402aac4d087dd1695309fd2a561c8d033de9d`
**Live-file SHA-256**: `33FB72F87FFE9E7D33B916F59076C6FD77D655B7C6786AB933A9E9DCB09F8781`
**Date**: November 17, 2026 (Rev 2 — supersedes the original summary)
**Purpose**: Verify code-block transfer buttons are hidden in print output after fix

> **Rev 2 note**: This revision corrects two inaccuracies flagged by the auditor:
> 1. The P5-06 test now uses **Playwright print-media emulation** (`page.emulateMedia({ media: 'print' })`) and asserts the **computed styles of the actual controls** — it no longer injects its own print stylesheet and no longer merely checks that a matching CSS rule exists.
> 2. The PDF artifact table now matches what the branch actually contains: **Chromium, Microsoft Edge, and Google Chrome PDFs**. A Firefox PDF is not generated because Playwright's Firefox cannot produce PDFs (the same documented limitation as the P5-04 skip); Firefox print evidence is the print-emulated screenshot instead.

---

## Executive Summary

The CSS fix in candidate `9e84517` hides `.code-block-actions` and `.code-action-btn` in print media. This evidence package provides:

1. ✅ **Computed print-visibility assertions** — P5-06 emulates print media and asserts `getComputedStyle(...).display === 'none'` for every `.code-block-actions` and `.code-action-btn` element, while asserting the same controls are **visible under screen media emulation** (`display !== 'none'`). No stylesheet is injected.
2. ✅ **Print PDF exports** (Chromium, Microsoft Edge, Google Chrome) generated via `page.pdf()` — `page.pdf()` renders with print media, so the PDFs are direct print-output artifacts.
3. ✅ **Print-emulated screenshots** for all 4 browsers (Firefox included).
4. ✅ **Evidence records** with browser, candidate identity, per-element computed-style results.

**Result**: All evidence confirms code-block transfer buttons are NOT visible in print output, verified at the computed-style level, not by CSS-rule inspection.

---

## Test Document

The following document was used for all tests (two code blocks — the controls under test):

```markdown
# Post-Fix Print Media Verification

## Code Block 1

```python
# Test code block
print("test")
```

## Code Block 2

```javascript
// Another code block
function test() {}
```
```

---

## What P5-06 Actually Verifies (per auditor requirement)

The test (`tests/phase5-postfix-print-test.spec.js`) performs, in order:

1. **Screen media emulation** (`page.emulateMedia({ media: 'screen' })`):
   - Asserts `.code-block-actions` containers and `.code-action-btn` buttons **exist** in the live preview (counts > 0).
   - Asserts they are **visible** — every element's computed `display` is **not** `none`.
2. **Print media emulation** (`page.emulateMedia({ media: 'print' })` — Playwright native, no injected styles):
   - Asserts the same elements **still exist in the DOM** (so "hidden" cannot mean "removed").
   - Asserts **every** `.code-block-actions` and `.code-action-btn` element has computed `display === 'none'`.
   - Asserts diagram controls (`.diag-action-btn`, `.mermaid-header`, `.mermaid-actions`), when present, are also `display: none`.
3. **Round-trip**: switches back to screen media and asserts the buttons are visible again.
4. **Artifacts**:
   - Chromium-family projects: `page.pdf()` export (print-media rendering by definition).
   - All projects: full-page screenshot captured under print-media emulation.
5. **Cleanliness**: asserts zero page errors and zero console errors.

**No stylesheet is injected.** The assertion target is the app's own `@media print` rule at line 1797 of `scripts/markdown-studio.html`.

---

## PDF Exports (Print Output)

| Browser | File | Size | Status |
|---------|------|------|--------|
| Chromium | `postfix-print-export-chromium.pdf` | 76,767 bytes | ✅ Generated (Rev 2) |
| Microsoft Edge | `postfix-print-export-microsoft-edge.pdf` | 79,762 bytes | ✅ Generated (Rev 2) |
| Google Chrome | `postfix-print-export-google-chrome.pdf` | 79,748 bytes | ✅ Generated (Rev 2) |
| Firefox | — | — | ⛔ Not generated: Playwright Firefox does not support `page.pdf()` (`PDF generation is only supported for Headless Chromium`). Same engine limitation documented for the P5-04 skip. Firefox print evidence = print-emulated screenshot + computed-style assertions. |

**Verification**: Open each PDF and confirm no code-block transfer buttons ("↗ Notepad++", "▶ Run in Notebook") are visible on any page. Because `page.pdf()` renders under print media, these PDFs are direct artifacts of the print output.

---

## Print-Emulated Screenshots

Captured after `page.emulateMedia({ media: 'print' })` — the print CSS is active in these captures:

| Browser | File | Size | Status |
|---------|------|------|--------|
| Chromium | `postfix-print-emulated-chromium.png` | 25,489 bytes | ✅ Generated |
| Microsoft Edge | `postfix-print-emulated-microsoft-edge.png` | 25,684 bytes | ✅ Generated |
| Google Chrome | `postfix-print-emulated-google-chrome.png` | 25,684 bytes | ✅ Generated |
| Firefox | `postfix-print-emulated-firefox.png` | 25,701 bytes | ✅ Generated |

(Legacy full-page screen-view screenshots `postfix-print-view-chromium.png` / `postfix-print-view-microsoft-edge.png` from the earlier evidence pass are retained for reference; they show the screen view where the buttons are intentionally visible.)

---

## Evidence Records

| Browser | File | Contains |
|---------|------|----------|
| Chromium | `PHASE5-P5-06-PRINT-MEDIA-CHROMIUM.evidence.json` | Computed styles (screen + print), PDF, screenshot |
| Microsoft Edge | `PHASE5-P5-06-PRINT-MEDIA-MICROSOFT-EDGE.evidence.json` | Computed styles (screen + print), PDF, screenshot |
| Google Chrome | `PHASE5-P5-06-PRINT-MEDIA-GOOGLE-CHROME.evidence.json` | Computed styles (screen + print), PDF, screenshot |
| Firefox | `PHASE5-P5-06-PRINT-MEDIA-FIREFOX.evidence.json` | Computed styles (screen + print), screenshot, PDF-block reason |

Each record contains:

```json
{
  "test": "P5-06 print media emulation hides code-block transfer buttons (computed styles)",
  "browser": "<project name>",
  "candidateCommit": "9e84517122515e5e6a6e5557892bb869466e5922",
  "candidateBlob": "567402aac4d087dd1695309fd2a561c8d033de9d",
  "candidateSha256": "33FB72F87FFE9E7D33B916F59076C6FD77D655B7C6786AB933A9E9DCB09F8781",
  "screenMedia": { ".code-block-actions": { "count": 2, "allHidden": false }, ".code-action-btn": { "count": 4, "allHidden": false }, "...": "..." },
  "printMedia": { ".code-block-actions": { "count": 2, "allHidden": true }, ".code-action-btn": { "count": 4, "allHidden": true }, "...": "..." },
  "printMediaHidesButtons": true,
  "screenMediaShowsButtons": true,
  "pdfGenerated": true,
  "pdfFile": "postfix-print-export-<browser>.pdf",
  "pdfBlockReason": null,
  "screenshotFile": "postfix-print-emulated-<browser>.png",
  "verificationMethod": "Playwright page.emulateMedia({media:'print'}) + getComputedStyle assertions on live controls; page.pdf() artifact",
  "result": "PASS"
}
```

---

## Test Run Result (Rev 2, all four projects, both origins)

```
npx playwright test tests/phase5-postfix-print-test.spec.js --retries=0

  file:// origin: 4 passed (chromium, Microsoft Edge, Google Chrome, firefox)
  http:// origin: 4 passed (chromium, Microsoft Edge, Google Chrome, firefox)

  Total: 8 passed / 0 failed / 0 skipped
```

Artifacts land in `postfix/file/` and `postfix/http/` respectively.

---

## CSS Verification

**File**: `../css-verification.txt`

The app's own print rule (unchanged, verified in candidate `9e84517`):

```css
@media print {
  .mermaid-header, .diag-action-btn, .mermaid-actions, .code-block-actions, .code-action-btn {
    display: none !important;
  }
}
```

**Consistency Check**: Selector set matches `getCleanRenderedContent()` at line 5638. Note that CSS-rule presence is now only a supplementary check — the primary evidence is the computed-style behavior under print-media emulation.

---

## Files Summary (Rev 2)

Artifacts are split per launch origin (P5-06 runs on both):

```
qa-artifacts/phase5/postfix/
├── PHASE5-POSTFIX-PRINT-SUMMARY.md                    (this document)
├── file/                                              (file:// origin run)
│   ├── PHASE5-P5-06-PRINT-MEDIA-CHROMIUM.evidence.json
│   ├── PHASE5-P5-06-PRINT-MEDIA-MICROSOFT-EDGE.evidence.json
│   ├── PHASE5-P5-06-PRINT-MEDIA-GOOGLE-CHROME.evidence.json
│   ├── PHASE5-P5-06-PRINT-MEDIA-FIREFOX.evidence.json
│   ├── postfix-print-export-chromium.pdf
│   ├── postfix-print-export-microsoft-edge.pdf
│   ├── postfix-print-export-google-chrome.pdf
│   ├── postfix-print-emulated-chromium.png
│   ├── postfix-print-emulated-microsoft-edge.png
│   ├── postfix-print-emulated-google-chrome.png
│   └── postfix-print-emulated-firefox.png
├── http/                                              (http:// origin run — same contents)
└── legacy-rev1/                                       (superseded Rev-1 artifacts, retained for reference)
    ├── PHASE5-POSTFIX-PRINT-CHROMIUM.evidence.json
    ├── PHASE5-POSTFIX-PRINT-MICROSOFT-EDGE.evidence.json
    ├── postfix-print-view-chromium.png                (screen view, buttons visible)
    └── postfix-print-view-microsoft-edge.png          (screen view, buttons visible)
```

**Result**: P5-06 = 8/8 passed (2 origins × 4 browsers). PDFs for Chromium/Edge/Chrome on both origins; Firefox print-emulated screenshots on both origins.

---

## Verification Steps for the Auditor

### 1. Rerun the test
```bash
npx playwright test tests/phase5-postfix-print-test.spec.js --retries=0
```
Expected: 4 passed (Chromium, Edge, Chrome, Firefox).

### 2. Inspect an evidence record
`PHASE5-P5-06-PRINT-MEDIA-CHROMIUM.evidence.json` shows per-element computed-style booleans under both screen and print emulation, plus candidate identity.

### 3. Open the PDFs
Open `postfix-print-export-chromium.pdf`, `postfix-print-export-microsoft-edge.pdf`, `postfix-print-export-google-chrome.pdf` and confirm no transfer buttons are rendered.

### 4. Check the print-emulated screenshot for Firefox
`postfix-print-emulated-firefox.png` was captured with print media emulated; no transfer buttons appear.

---

## Conclusion

**Status**: ✅ **POST-FIX PRINT EVIDENCE COMPLETE (Rev 2)**

- Computed print-visibility is verified directly via Playwright print-media emulation — the actual controls exist on screen, exist in the DOM under print emulation, and compute to `display: none` there.
- PDF artifacts exist for Chromium, Edge, and Chrome; Firefox is documented as not PDF-capable under Playwright, with an equivalent print-emulated screenshot and the same computed-style assertions.
- This summary no longer claims artifacts it does not contain.
