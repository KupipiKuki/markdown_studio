# Phase 5 QA/QC Results — Reconciled Candidate 9e84517

**Status**: Remediation Round 2 Complete — full regression rerun against the reconciled candidate
**Candidate Under Review**: `9e84517122515e5e6a6e5557892bb869466e5922`
**Branch HEAD at rerun**: `a377d41` (application code identical to candidate `9e84517`; working-tree live file SHA-256 re-verified `33FB72F87FFE9E7D33B916F59076C6FD77D655B7C6786AB933A9E9DCB09F8781`)
**Date**: November 17, 2026

---

## Candidate Under Review

The **current candidate under review** for Phase 5 sign-off is:

| Property | Value |
|----------|-------|
| Commit SHA | `9e84517122515e5e6a6e5557892bb869466e5922` |
| Live file blob | `567402aac4d087dd1695309fd2a561c8d033de9d` |
| Live-file SHA-256 | `33FB72F87FFE9E7D33B916F59076C6FD77D655B7C6786AB933A9E9DCB09F8781` |
| Live-file Size | 243,992 bytes / 6,398 lines |
| Phase 6 Reference | commit `c0da234d3640976e75c6cefe4c3353c9632f8e86`, blob `05359f4f5bf855a0e219a03687d6c3690d2cf098` |

**What Changed from Initial Freeze**:
- **Single line fix**: Added `.code-block-actions, .code-action-btn` to `@media print` CSS rule at line 1797
- **Purpose**: Hide code-block transfer buttons in print output
- **Consistency**: Aligns print behavior with export/copy behavior (via `getCleanRenderedContent()`)

---

## Historical Context

**Initial Frozen Candidate** (for reference only - NOT under review):
- Commit: `02b53632939d658fb41c7ec80a091d6378bb1633`
- Blob: `ca087ef54d44f17062eb0e3ec8fa6da30635c97e`
- SHA-256: `F401A2EF2FD2DA064D6E1ADAA33AF2C90AA831B9563DE9521D07DA04F84BD1F7`
- Size: 243,953 bytes / 6,398 lines
- **Status**: Historical - superseded by reconciled candidate `9e84517`

---

## Test Counts (Source of Truth — corrected in Round 2)

The Phase 4 suite contains **9 tests** (including `P4-01R readiness waits for a themed rerender started mid-export`, added in Phase 4 remediation). Earlier revisions of this report counted Phase 4 as 8 tests, producing an undercount (51 tests / 408 possible runs). The counts below are taken directly from the test files:

| Phase | Tests | Browsers | Origins | Total Runs |
|-------|-------|----------|---------|------------|
| Phase 1 | 24 | 4 | 2 | 192 |
| Phase 2 | 7 | 4 | 2 | 56 |
| Phase 3 | 7 | 4 | 2 | 56 |
| Phase 4 | **9** (P4-01, P4-01R, P4-02…P4-08) | 4 | 2 | 72 |
| Phase 5 | 5 | 4 | 2 | 40 |
| **Total** | **52** | **4** | **2** | **416** |

### Skip Conditions (verified in test code, `test.skip(...)` occurrences)

| Phase | Test | Trigger | Count |
|-------|------|---------|-------|
| Phase 1 | SM-03 | `test.skip(!BASE_URL.startsWith('http'))` — HTTP-only transfer test | 4 (file:// leg, one per browser) |
| Phase 5 | P5-04 | `page.pdf` unavailable (Playwright Firefox) | 2 (one per origin) |
| **Total** | | | **6** |

> **Correction vs. earlier reports**: Earlier revisions listed a 7th skip, "P5-05 Firefox file://". No such skip condition exists in `tests/phase5.spec.js`, and the rerun confirms P5-05 **passes** on Firefox over file://. The corrected skip count is 6, not 7.

---

## Full Regression Run Against Candidate 9e84517 (Round 2)

**Executed**: November 17, 2026. Both origin legs rerun from scratch with `--retries=0`, fresh context per test, Playwright 1.65.1, headless.

- **Command (file:// leg)**: `npx playwright test tests/phase1.spec.js tests/phase2.spec.js tests/phase3.spec.js tests/phase4.spec.js tests/phase5.spec.js --retries=0 --workers=4`
- **Command (http:// leg)**: same, with `P1_BASE_URL=http://127.0.0.1:4173/scripts/markdown-studio.html` (static server serving the repo root)
- **Raw logs**: `qa-artifacts/phase5-regression-fileorigin.log`, `qa-artifacts/phase5-regression-http.log`
- **Machine-readable record**: `qa-artifacts/phase5-regression-run-record.json`
- **Both legs exit code 0** (no failures, no flaky retries — retries disabled)

### file:// Origin Leg — 203 passed / 5 skipped / 208 runs

| Phase | Runs | Passed | Skipped | Skips |
|-------|------|--------|---------|-------|
| Phase 1 | 96 | 92 | 4 | SM-03 × 4 (HTTP-only) |
| Phase 2 | 28 | 28 | 0 | — |
| Phase 3 | 28 | 28 | 0 | — |
| Phase 4 | 36 | 36 | 0 | — |
| Phase 5 | 20 | 19 | 1 | P5-04 (Playwright Firefox: no PDF) |
| **Total** | **208** | **203** | **5** | |

Per-browser: chromium 51, Microsoft Edge 51, Google Chrome 51, firefox 50.

### http:// Origin Leg — 207 passed / 1 skipped / 208 runs

| Phase | Runs | Passed | Skipped | Skips |
|-------|------|--------|---------|-------|
| Phase 1 | 96 | 96 | 0 | — |
| Phase 2 | 28 | 28 | 0 | — |
| Phase 3 | 28 | 28 | 0 | — |
| Phase 4 | 36 | 36 | 0 | — |
| Phase 5 | 20 | 19 | 1 | P5-04 (Playwright Firefox: no PDF) |
| **Total** | **208** | **207** | **1** | |

Per-browser: chromium 52, Microsoft Edge 52, Google Chrome 52, firefox 51.

### Grand Totals (Round 2 rerun)

| Category | file:// Origin | http:// Origin | Combined |
|----------|----------------|----------------|----------|
| Phase 1 | 92/96 (4 skips) | 96/96 | **188 passed / 4 skipped** |
| Phase 2 | 28/28 | 28/28 | **56 passed** |
| Phase 3 | 28/28 | 28/28 | **56 passed** |
| Phase 4 | 36/36 | 36/36 | **72 passed** |
| Phase 5 | 19/20 (1 skip) | 19/20 (1 skip) | **38 passed / 2 skipped** |
| **TOTAL** | **203 passed / 5 skipped** | **207 passed / 1 skipped** | **410 passed / 6 skipped / 0 failed** |

**Total Possible Runs**: 416 (52 tests × 4 browsers × 2 origins)
**Actual Runs**: 410 (416 − 6 expected skips)
**Success Rate**: 100% of executed tests passed

### Reconciliation with Previously Reported Totals (401/7/408)

| Delta | Explanation |
|-------|-------------|
| +8 runs | Phase 4 actually has 9 tests, not 8 — `P4-01R` was omitted from earlier count tables (4 browsers × 2 origins = 8 runs) |
| +1 passed / −1 skipped | The previously reported "P5-05 Firefox file:// skip" does not exist in the test code and did not occur; P5-05 passes |
| **401 → 410 passed, 7 → 6 skipped, 408 → 416 runs** | Fully accounted for |

---

## Post-Fix Print Evidence (Round 2 — computed print visibility)

**Status**: ✅ COMPLETE — verified at the computed-style level via Playwright print-media emulation

The auditor required that P5-06 (a) emulate print media and inspect the **computed styles of the actual controls**, and (b) not inject its own print stylesheet. This has been implemented:

- **Test**: `tests/phase5-postfix-print-test.spec.js` — rewritten in Round 2
  - `page.emulateMedia({ media: 'screen' })`: asserts `.code-block-actions` / `.code-action-btn` **exist and are visible** (computed `display !== 'none'`)
  - `page.emulateMedia({ media: 'print' })`: asserts the same elements **still exist in the DOM** and every one computes to `display: none`; diagram controls likewise when present
  - Round-trips back to screen media and re-asserts visibility
  - **No stylesheet injected**; the assertion target is the app's own `@media print` rule at line 1797
  - Produces a `page.pdf()` print artifact on Chromium-family projects and a print-emulated screenshot on all projects (Firefox included)
- **Result**: **8/8 passed** (2 origins × 4 browsers)
- **Artifacts**: `qa-artifacts/phase5/postfix/file/` and `qa-artifacts/phase5/postfix/http/` — per-origin evidence JSONs, PDFs (Chromium/Edge/Chrome), print-emulated screenshots (all 4 browsers)

### PDF Artifact Inventory (honest listing)

| Browser | PDF | Basis |
|---------|-----|-------|
| Chromium | ✅ `postfix-print-export-chromium.pdf` (both origins) | `page.pdf()` renders under print media |
| Microsoft Edge | ✅ `postfix-print-export-microsoft-edge.pdf` (both origins) | `page.pdf()` renders under print media |
| Google Chrome | ✅ `postfix-print-export-google-chrome.pdf` (both origins) | `page.pdf()` renders under print media |
| Firefox | ⛔ Not generated | Playwright Firefox does not support `page.pdf()` ("PDF generation is only supported for Headless Chromium") — same engine limitation documented for the P5-04 skip. Firefox print evidence = computed-style assertions + print-emulated screenshot (`postfix-print-emulated-firefox.png`), both origins. |

Details: `qa-artifacts/phase5/postfix/PHASE5-POSTFIX-PRINT-SUMMARY.md` (Rev 2).

---

## Evidence Package Completeness

All Phase 1–5 evidence in both origin trees was **regenerated by the Round 2 full regression run** (November 17, 2026, ~21:17 local) against the working tree whose live file re-verifies as candidate `9e84517`:

### file:// Origin (`qa-artifacts-fileorigin/phase5/`)
- ✅ All browser evidence present, **regenerated against `9e84517`** (previously these held historical `02b5363` artifacts)

### http:// Origin (`qa-artifacts/phase5/`)
- ✅ All browser evidence present, **regenerated against `9e84517`** (previously these held historical `02b5363` artifacts)

### Post-Fix Evidence (`qa-artifacts/phase5/postfix/`)
- ✅ Rev 2 computed-style evidence, both origins — see section above
- ℹ️ Rev-1 artifacts retained under `postfix/legacy-rev1/` for reference

### Regression Run Records (repo root `qa-artifacts/`)
- ✅ `phase5-regression-fileorigin.log`, `phase5-regression-http.log` (raw Playwright list-reporter output)
- ✅ `phase5-regression-run-record.json` (per-leg, per-phase, per-browser aggregation)
- ✅ `phase5-regression-summary.txt` (exit codes)

---

## The Fix

**File**: `scripts/markdown-studio.html`
**Line**: 1797
**Change**: Single line CSS modification

**Before**:
```css
.mermaid-header, .diag-action-btn, .mermaid-actions { display: none !important; }
```

**After**:
```css
.mermaid-header, .diag-action-btn, .mermaid-actions, .code-block-actions, .code-action-btn { display: none !important; }
```

**Consistency**: This aligns with `getCleanRenderedContent()` at line 5638:
```javascript
clone.querySelectorAll('.mermaid-header, .diag-action-btn, .mermaid-actions, .code-block-actions, .code-action-btn')
```

---

## Open Items & Dispositions

| Item | Status | Disposition | Evidence |
|------|--------|-------------|----------|
| Firefox PDF automation | ✅ RESOLVED | ACCEPT — engine limitation, computed-style + emulated-print screenshot evidence provided | `postfix/file/postfix-print-emulated-firefox.png`, evidence JSONs |
| Code-block buttons in print | ✅ FIXED & VERIFIED | RESOLVED — computed print styles verified; screen visibility preserved | P5-06 evidence, 8/8 passed |
| Firefox file:// transfer | ✅ RESOLVED | ACCEPT — expected behavior (no skip; test passes) | Round 2 regression log |
| Regression matrix completeness | ✅ RESOLVED | Full 52-test × 4-browser × 2-origin rerun executed against `9e84517`; 100% of executed tests pass | `phase5-regression-*.log`, `phase5-regression-run-record.json` |
| Prior totals arithmetic (51/408/401/7) | ✅ CORRECTED | Superseded by 52/416/410/6 with full reconciliation table | This document |

---

## Success Criteria

| Criterion | Status | Notes |
|-----------|--------|-------|
| Candidate identity clear | ✅ | `9e84517` is primary; live file re-verified by SHA-256 at rerun time |
| Report totals correct | ✅ | 410/6/416 from actual rerun logs; historical 401/7/408 reconciled |
| CSS fix present | ✅ | Verified in candidate (`css-verification.txt`, line 1797) |
| Post-fix print evidence (computed) | ✅ | P5-06 rewritten: emulateMedia + computed styles, no injected stylesheet, 8/8 passed |
| PDF artifacts honestly indexed | ✅ | 3 Chromium-family PDFs per origin; Firefox limitation documented |
| Full regression documented | ✅ | Complete matrix rerun against `9e84517`, both origins, exit 0, 100% pass |
| Old candidate marked historical | ✅ | Clearly documented |
| Stale review documents updated | ✅ | `PHASE5-AUDITOR-RESPONSE.md` rewritten for Round 2; superseded docs marked |

**Overall**: **8/8 criteria fully met**

---

## Recommendation

**Status**: **READY FOR SIGN-OFF**

The reconciled candidate `9e84517` with the print CSS fix:

- ✅ Has been **fully regression tested in Round 2**: 410 passed / 6 skipped / 0 failed across all 416 possible runs (52 tests × 4 browsers × 2 origins), both legs exit 0
- ✅ Has correct, reconciled totals with the earlier 401/7/408 arithmetic explained
- ✅ Is clearly identified as the candidate under review (SHA re-verified at rerun time)
- ✅ Has computed print-visibility evidence via Playwright print-media emulation (P5-06, 8/8)
- ✅ Has honestly indexed PDF artifacts (3 Chromium-family PDFs per origin; Firefox limitation documented)
- ✅ Has all Phase 1–5 evidence regenerated against `9e84517`

Given the low-risk single-line CSS change, the completed full regression, and the computed-style print verification, **Phase 5 is ready for sign-off**.
