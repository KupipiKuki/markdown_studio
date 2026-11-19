# Phase 5 Auditor Report — QA/QC of Reconciled Candidate 9e84517 (Round 2)

**Prepared for**: Independent Auditor
**Date**: November 17, 2026 (Round 2 — supersedes the Round 1 report of the same name)
**Candidate Under Review**: `9e84517122515e5e6a6e5557892bb869466e5922`
**Handoff Documents**: `markdown-studio-phase-5-handoff.md`, `markdown-studio-phase-5-qaqc-handoff.md` (repo root)

> **Round 2 note**: This revision responds to the auditor's Phase 5 remediation review:
> 1. The **full regression matrix has been rerun against `9e84517`** (both origins, all 4 browsers); historical results are no longer presented as current-candidate results.
> 2. **P5-06 was rewritten** to use Playwright print-media emulation and assert the **computed styles of the actual controls**; it no longer injects a stylesheet or merely checks that a CSS rule exists.
> 3. The **PDF artifact inventory is corrected**: 3 Chromium-family PDFs per origin; the Firefox PDF claim was removed (Playwright Firefox cannot generate PDFs; equivalent print-emulated screenshot + computed-style assertions provided).
> 4. **Totals were recomputed from the actual rerun logs** and the previously reported 401/7/408 arithmetic is reconciled below.

---

## Executive Summary

Phase 5 verification is **READY FOR SIGN-OFF** with the reconciled candidate `9e84517`.

- ✅ Full regression rerun against `9e84517`: **410 passed / 6 skipped / 0 failed** across 416 possible runs (both origins, exit 0)
- ✅ Candidate `9e84517` clearly identified; live-file SHA-256 re-verified at rerun time
- ✅ Computed print-visibility verified via P5-06 print-media emulation (8/8 passed, both origins)
- ✅ PDF artifact inventory matches the branch contents exactly
- ✅ Old candidate `02b5363` marked as historical; all Phase 1–5 evidence regenerated against `9e84517`

---

## 1. Candidate Identity (Candidate Under Review)

| Property | Expected | Actual | Match |
|----------|----------|--------|-------|
| Migration branch | `wp/studio_migration` | `wp/studio_migration` | ✅ yes |
| **Frozen Commit SHA** | **`9e84517122515e5e6a6e5557892bb869466e5922`** | Current candidate | ✅ yes |
| Live Entry Point | `scripts/markdown-studio.html` | Verified | ✅ yes |
| Live-File Git Blob | `567402aac4d087dd1695309fd2a561c8d033de9d` | Verified | ✅ yes |
| Live-File SHA-256 | `33FB72F87FFE9E7D33B916F59076C6FD77D655B7C6786AB933A9E9DCB09F8781` | Re-verified at rerun time | ✅ yes |
| Live-File Size | 243,992 bytes / 6,398 lines | Verified | ✅ yes |
| Phase 6 Standalone Reference | commit `c0da234d3640976e75c6cefe4c3353c9632f8e86` | Verified | ✅ yes |

**Candidate Status**: This is the **primary candidate under review** for Phase 5 sign-off. At the time of the Round 2 rerun, the working tree contained no changes to `scripts/markdown-studio.html` relative to `9e84517` (`git diff 9e84517 -- scripts/markdown-studio.html` is empty), so every run described here executed the candidate's application code.

---

## Historical Context

**Initial Frozen Candidate** (`02b5363`) - **HISTORICAL - NOT UNDER REVIEW**

- Commit: `02b53632939d658fb41c7ec80a091d6378bb1633`
- Blob: `ca087ef54d44f17062eb0e3ec8fa6da30635c97e`
- SHA-256: `F401A2EF2FD2DA064D6E1ADAA33AF2C90AA831B9563DE9521D07DA04F84BD1F7`
- Size: 243,953 bytes / 6,398 lines

**This candidate has been superseded by the reconciled candidate `9e84517` and is provided for historical reference only.** All Phase 1–5 evidence from the `02b5363` era was overwritten by the Round 2 rerun; no historical artifact is presented as a current-candidate result.

---

## 2. Scope / Boundary Audit

Phase 5 evolved from a **verification-only phase** to a **reconciliation phase** when a cosmetic defect was identified in QA/QC.

### Changes Made

**Single focused change** to address the cosmetic issue:
- **File**: `scripts/markdown-studio.html`
- **Line**: 1797
- **Change**: Added `.code-block-actions, .code-action-btn` to `@media print` CSS rule
- **Impact**: Code-block transfer buttons now hidden in print output
- **Risk**: Low - only affects print media, no live behavior change
- **Consistency**: Aligns with `getCleanRenderedContent()` at line 5638

### Boundary Check

- ✅ **No unintended changes**: `git diff 9e84517 -- scripts/markdown-studio.html` empty at rerun time
- ✅ **Phase 1-4 preserved**: All Phase 1-4 regions untouched
- ✅ **Live-only contracts preserved**: `markflow_*`, `gemini_studio_*`, gutter all intact
- ✅ **No functional changes**: Only CSS for print media

---

## 3. QA/QC Matrix — Round 2 Full Rerun (Candidate 9e84517)

Environments: Windows 11 x64; Playwright 1.65.1 headless; Chromium, Microsoft Edge, Google Chrome, Firefox; Origins: `file:///C:/Git/markdown_studio/scripts/markdown-studio.html` and `http://127.0.0.1:4173/scripts/markdown-studio.html`; fresh context per test; `--retries=0`.

**Executed**: November 17, 2026, both legs from scratch against the candidate working tree.
**Raw evidence**: `qa-artifacts/phase5-regression-fileorigin.log`, `qa-artifacts/phase5-regression-http.log`, `qa-artifacts/phase5-regression-run-record.json`, `qa-artifacts/phase5-regression-summary.txt`.

### Test Counts (Source of Truth — corrected)

| Phase | Tests | Total Runs (4×2) | Expected Skips | Passed | Skipped |
|-------|-------|------------------|----------------|--------|---------|
| Phase 1 | 24 | 192 | 4 (SM-03 file://) | 188 | 4 |
| Phase 2 | 7 | 56 | 0 | 56 | 0 |
| Phase 3 | 7 | 56 | 0 | 56 | 0 |
| Phase 4 | **9** (incl. P4-01R) | 72 | 0 | 72 | 0 |
| Phase 5 | 5 | 40 | 2 (P5-04 Firefox) | 38 | 2 |
| **Total** | **52** | **416** | **6** | **410** | **6** |

### Skip Descriptions (as executed — from the rerun logs)

| Phase | Test | Where | Reason | Count |
|-------|------|-------|--------|-------|
| Phase 1 | SM-03 | file:// leg, all 4 browsers | HTTP-only transfer test (`test.skip(!BASE_URL.startsWith('http'))`) | 4 |
| Phase 5 | P5-04 | both legs, Firefox | `page.pdf` unsupported: "PDF generation is only supported for Headless Chromium" | 2 |
| **Total** | | | | **6** |

### Phase 5 Test Results (rerun, per origin)

| Suite | file:// | http:// | Combined |
|-------|---------|--------|----------|
| P5-01 Clipboard | 4/4 PASS | 4/4 PASS | 8/8 PASS |
| P5-02 Standalone export | 4/4 PASS | 4/4 PASS | 8/8 PASS |
| P5-03 SVG/PNG | 4/4 PASS | 4/4 PASS | 8/8 PASS |
| P5-04 PDF pagination | 3/4 PASS (1 skip) | 3/4 PASS (1 skip) | 6 passed / 2 skipped |
| P5-05 Persistence/transfer | 4/4 PASS | 4/4 PASS | 8/8 PASS |
| **Total** | **19/20** | **19/20** | **38 passed / 2 skipped** |

> Note: P5-05 **passes on Firefox over file://**. Earlier revisions reported a P5-05 Firefox file:// skip that does not exist in the test code and did not occur.

### Phase 1-4 Regression Results (rerun, per origin)

| Phase | file:// | http:// | Combined |
|-------|---------|--------|----------|
| Phase 1 | 92/96 (4 skips) | 96/96 | 188 passed / 4 skipped |
| Phase 2 | 28/28 | 28/28 | 56 passed |
| Phase 3 | 28/28 | 28/28 | 56 passed |
| Phase 4 | 36/36 | 36/36 | 72 passed |
| **Total** | **188 runs — 184 executed, 180 passed / 4 skipped** | **188 runs — 188 passed** | **376 runs — 372 passed / 4 skipped** |

### Grand Totals (Round 2 rerun)

| Category | file:// | http:// | **Combined** |
|----------|---------|--------|--------------|
| Phase 1-4 | 180 passed / 4 skipped (184 executed) | 188 passed (188 executed) | **372 passed / 4 skipped (376 runs)** |
| Phase 5 | 19 passed / 1 skipped | 19 passed / 1 skipped | **38 passed / 2 skipped** |
| **TOTAL** | **203 passed / 5 skipped** | **207 passed / 1 skipped** | **410 passed / 6 skipped / 0 failed** |

**Total Possible Runs**: 416 (52 tests × 4 browsers × 2 origins)
**Actual Runs**: 410
**Success Rate**: 100% of executed tests passed; both legs exit code 0

### Reconciliation with the Previously Reported 401 / 7 / 408

| Delta | Explanation |
|-------|-------------|
| +8 runs | Phase 4 has 9 tests, not the 8 previously tabulated — `P4-01R` was omitted from earlier count tables (4 browsers × 2 origins = 8 runs) |
| +1 passed / −1 skipped | The previously reported "P5-05 Firefox file://" skip does not exist in `tests/phase5.spec.js` and did not occur |
| **Result** | **410 passed / 6 skipped / 416 possible runs** — fully accounted for |

---

## 4. Finding-by-Finding Verdicts

| Finding | Coder Verdict | Auditor Verdict | Basis |
| --- | --- | --- | --- |
| Render readiness & aborts | UNCHANGED | VERIFIED | `ensurePreviewRenderReady()` (lines 5565-5629): bounded awaits, settled-generation check |
| Clean HTML / Standalone | UNCHANGED | VERIFIED | `getCleanRenderedContent()` (lines 5631-5805): strips Studio controls |
| Clipboard behavior | UNCHANGED | VERIFIED | `copyToClipboard()` (lines 2793-2819): surfaces denial without false-success |
| SVG export | UNCHANGED | VERIFIED | `sanitizeSvgForExport()` / `exportDiagramSvg()`: converts foreignObject to text |
| PNG export | UNCHANGED | VERIFIED | `exportDiagramPng()`: handles all failure paths, revokes object URLs |
| Print/PDF | **FIXED** | **VERIFIED (computed styles)** | `@media print` hides `.code-block-actions, .code-action-btn` at line 1797; P5-06 asserts computed `display:none` under print emulation on the live controls |
| Gutter | UNCHANGED | VERIFIED | Soft-wrap gutter sync preserved |
| Live-only contracts | UNCHANGED | VERIFIED | `markflow_*`, `gemini_studio_*` preserved |

---

## 5. Evidence Package Review

### Status: ✅ COMPLETE (Round 2)

**Auditor requirements and how each is met**:

1. ✅ **Full regression run against `9e84517`** — both origin legs rerun from scratch; raw logs and aggregation record committed; no historical artifacts presented as current results
2. ✅ **Computed print visibility** — P5-06 rewritten to `page.emulateMedia({media:'print'})` + `getComputedStyle` assertions on the actual controls; **no stylesheet injected**
3. ✅ **Honest PDF inventory** — summary now lists exactly what the branch contains
4. ✅ **Evidence records** with browser, candidate identity (commit/blob/SHA-256), per-element computed-style results

### Post-Fix Print Evidence (P5-06, Round 2)

**Test**: `tests/phase5-postfix-print-test.spec.js` — rewritten in Round 2. In order:

1. `page.emulateMedia({ media: 'screen' })` — asserts `.code-block-actions` / `.code-action-btn` exist (counts > 0) and every element is **visible** (computed `display !== 'none'`)
2. `page.emulateMedia({ media: 'print' })` — asserts the same elements still exist in the DOM and **every one computes to `display: none`**; diagram controls hidden when present
3. Round-trip back to screen media — buttons visible again
4. Artifacts: `page.pdf()` on Chromium-family projects; print-emulated full-page screenshot on all projects
5. Cleanliness: zero page errors, zero console errors

**Result**: **8/8 passed** (2 origins × 4 browsers). Runs:
`npx playwright test tests/phase5-postfix-print-test.spec.js --retries=0` → 4 passed (file://), and with `P1_BASE_URL=http://127.0.0.1:4173/...` → 4 passed (http://).

### PDF Artifact Inventory (exactly what the branch contains)

| Browser | PDF (file://) | PDF (http://) | Print-emulated screenshot | Evidence record |
|---------|---------------|---------------|---------------------------|-----------------|
| Chromium | ✅ `postfix/file/postfix-print-export-chromium.pdf` | ✅ `postfix/http/postfix-print-export-chromium.pdf` | ✅ both origins | ✅ both origins |
| Microsoft Edge | ✅ `postfix-print-export-microsoft-edge.pdf` | ✅ | ✅ | ✅ |
| Google Chrome | ✅ `postfix-print-export-google-chrome.pdf` | ✅ | ✅ | ✅ |
| Firefox | ⛔ not possible (Playwright Firefox cannot `page.pdf()`) | ⛔ | ✅ `postfix-print-emulated-firefox.png` | ✅ |

**Location**: `qa-artifacts/phase5/postfix/{file,http}/`; legacy Rev-1 artifacts under `postfix/legacy-rev1/`.
**Detail document**: `qa-artifacts/phase5/postfix/PHASE5-POSTFIX-PRINT-SUMMARY.md` (Rev 2).

### Example Evidence Record (Firefox, file:// — excerpt)

```json
{
  "test": "P5-06 print media emulation hides code-block transfer buttons (computed styles)",
  "browser": "firefox",
  "candidateCommit": "9e84517122515e5e6a6e5557892bb869466e5922",
  "candidateBlob": "567402aac4d087dd1695309fd2a561c8d033de9d",
  "candidateSha256": "33FB72F87FFE9E7D33B916F59076C6FD77D655B7C6786AB933A9E9DCB09F8781",
  "launchURL": "file:///C:/Git/markdown_studio/scripts/markdown-studio.html",
  "launchMode": "file",
  "screenMedia": { ".code-block-actions": { "count": 2, "allHidden": false }, ".code-action-btn": { "count": 4, "allHidden": false } },
  "printMedia": { ".code-block-actions": { "count": 2, "allHidden": true }, ".code-action-btn": { "count": 4, "allHidden": true } },
  "printMediaHidesButtons": true,
  "screenMediaShowsButtons": true,
  "pdfGenerated": false,
  "pdfBlockReason": "page.pdf: PDF generation is only supported for Headless Chromium",
  "screenshotFile": "postfix-print-emulated-firefox.png",
  "verificationMethod": "Playwright page.emulateMedia({media:'print'}) + getComputedStyle assertions on live controls; page.pdf() artifact",
  "result": "PASS"
}
```

### CSS Verification

**File**: `qa-artifacts/phase5/css-verification.txt`

```css
@media print {
  .mermaid-header, .diag-action-btn, .mermaid-actions, .code-block-actions, .code-action-btn {
    display: none !important;
  }
}
```

Note: CSS-rule presence is now a supplementary check only — the primary evidence is the computed-style behavior under print-media emulation.

---

## 6. Open Items & Dispositions

| Item | Status | Reason | Evidence | Impact | Disposition |
|------|--------|--------|----------|--------|-------------|
| Firefox PDF automation | ✅ RESOLVED | Playwright engine limitation | Print-emulated screenshot + computed-style assertions (both origins) | Low | ACCEPT |
| Code-block buttons in print | ✅ FIXED | CSS fix applied | P5-06 computed-style evidence, 8/8 | Low | RESOLVED |
| Firefox file:// transfer | ✅ RESOLVED | No skip; test passes | Round 2 regression log | Low | ACCEPT |
| Full regression on `9e84517` | ✅ RESOLVED | Complete 416-run matrix rerun, both legs exit 0 | `phase5-regression-*.log/json` | — | RESOLVED |

---

## 7. Recommendation

**STATUS**: **READY FOR PHASE 5 SIGN-OFF**

The reconciled candidate `9e84517122515e5e6a6e5557892bb869466e5922` **PASSES** independent QA/QC verification with the following:

- ✅ **Full regression rerun against the candidate**: 410 passed / 6 skipped / 0 failed / 416 possible runs; both origin legs exit 0
- ✅ **Corrected totals** with full reconciliation of the earlier 401/7/408 arithmetic
- ✅ **Candidate identity**: `9e84517` verified by SHA-256 at rerun time
- ✅ **Skip descriptions** as executed, sourced from the rerun logs
- ✅ **Computed print-visibility evidence** (P5-06, 8/8, no injected stylesheets)
- ✅ **PDF inventory** matching branch contents (3 Chromium-family PDFs per origin; Firefox limitation documented)
- ✅ **All executed tests pass**: 100% success rate

Subject to the documented engine limitations (Playwright Firefox PDF generation), I recommend **PROCEED TO PHASE 5 SIGN-OFF**.

---

## Appendix: The Fix

**File**: `scripts/markdown-studio.html`
**Line**: 1797
**Change Type**: CSS selector addition
**Risk**: Low

**Before**:
```css
.mermaid-header, .diag-action-btn, .mermaid-actions { display: none !important; }
```

**After**:
```css
.mermaid-header, .diag-action-btn, .mermaid-actions, .code-block-actions, .code-action-btn { display: none !important; }
```

**Consistency**: Aligns with `getCleanRenderedContent()` at line 5638 which already strips these classes for export/copy operations.
