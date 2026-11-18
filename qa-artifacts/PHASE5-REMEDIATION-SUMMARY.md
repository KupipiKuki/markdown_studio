# Phase 5 Remediation Summary — Round 2 (Complete)

**Prepared**: November 17, 2026 (Round 2 — supersedes the Round 1 summary)
**Current Branch HEAD**: this commit (documentation round; application code unchanged)
**Reconciled Candidate**: `9e84517` — live-file SHA-256 re-verified at rerun time: `33FB72F87FFE9E7D33B916F59076C6FD77D655B7C6786AB933A9E9DCB09F8781`

> This document supersedes the Round 1 remediation summary (which was drafted at HEAD `a34f723` and listed post-fix print evidence and the full regression matrix as pending). Both items are now complete. The authoritative result set is `PHASE5-QA-RESULTS.md` / `PHASE5-AUDITOR-REPORT.md` (Round 2) and the response to the auditor's Round 2 review is `PHASE5-AUDITOR-RESPONSE.md`.

---

## Round 2 Auditor Comments → Dispositions

| # | Auditor comment | Disposition | Evidence |
|---|-----------------|-------------|----------|
| 1 | Regression coverage unresolved; provide full regression run against `9e84517` or clearly separate historical results | ✅ **Full 416-run matrix rerun against `9e84517`, both origins, exit 0, 100% pass.** Historical `02b5363` evidence overwritten; nothing historical is presented as current | `qa-artifacts/phase5-regression-fileorigin.log`, `phase5-regression-http.log`, `phase5-regression-run-record.json` |
| 2 | P5-06 does not verify computed print visibility; injects its own stylesheet | ✅ **P5-06 rewritten**: `page.emulateMedia({media:'print'})`, computed `getComputedStyle` assertions on the live `.code-block-actions` / `.code-action-btn` elements (hidden in print, visible on screen, still in DOM), **no injected stylesheet**. 8/8 passed (2 origins × 4 browsers) | `tests/phase5-postfix-print-test.spec.js`; `qa-artifacts/phase5/postfix/{file,http}/PHASE5-P5-06-PRINT-MEDIA-*.evidence.json` |
| 3 | Print evidence index overstates PDF artifacts (claims 4-browser PDFs; branch had Chromium+Edge only) | ✅ **Chrome PDF added** (`page.pdf()` on the Chrome channel, both origins); **Firefox PDF documented as impossible** under Playwright (same limitation as P5-04 skip) with print-emulated screenshot + computed-style assertions instead. Summary corrected to match the tree exactly | `qa-artifacts/phase5/postfix/PHASE5-POSTFIX-PRINT-SUMMARY.md` (Rev 2); `postfix/{file,http}/postfix-print-export-google-chrome.pdf` |
| 4 | `PHASE5-AUDITOR-RESPONSE.md` stale (print evidence "pending", regression "incomplete", asks whether to proceed) | ✅ **Rewritten** as the Round 2 response; all former open items closed; supersession notice included | `qa-artifacts/PHASE5-AUDITOR-RESPONSE.md` |

---

## Corrected Totals (from the actual rerun logs)

| Metric | Round 1 claim | Round 2 authoritative |
|--------|---------------|----------------------|
| Tests in matrix | 51 | **52** (Phase 4 has 9 tests; `P4-01R` was omitted from earlier tables) |
| Possible runs (52 × 4 browsers × 2 origins) | 408 | **416** |
| Passed | 401 | **410** |
| Skipped | 7 | **6** (SM-03 ×4 file://, P5-04 Firefox ×2; the reported P5-05 Firefox-file:// skip does not exist in code and did not occur) |
| Failed | 0 | **0** |

Reconciliation: 401 + 8 (`P4-01R` runs) + 1 (P5-05 Firefox file://, actually passes) = 410; skips 7 − 1 = 6.

---

## Status Checklist

| Task | Status | Evidence |
|------|--------|----------|
| Apply @media print fix | ✅ DONE | Candidate `9e84517`, line 1797 |
| Fix report totals & candidate identity (Round 1) | ✅ DONE | Round 1 commits `4904365`+ |
| CSS rule verification | ✅ DONE | `qa-artifacts/phase5/css-verification.txt` |
| Computed print-visibility test (P5-06 rewrite) | ✅ DONE | 8/8 passed, both origins |
| Post-fix print evidence (PDFs + emulated screenshots) | ✅ DONE | `postfix/{file,http}/` |
| Full regression matrix against `9e84517` | ✅ DONE | 416-run rerun, both legs exit 0 |
| Stale documents refreshed | ✅ DONE | AUDITOR-RESPONSE, REMEDIATION-SUMMARY, QA-RESULTS, AUDITOR-REPORT |
| Final sign-off | ⏳ AWAITING AUDITOR | Round 2 response requests confirmation |

**Overall**: 7/8 tasks complete; sign-off pending auditor confirmation only.

---

## The Fix (unchanged)

**File**: `scripts/markdown-studio.html`, **Line**: 1797

```css
/* Before */
.mermaid-header, .diag-action-btn, .mermaid-actions { display: none !important; }

/* After */
.mermaid-header, .diag-action-btn, .mermaid-actions, .code-block-actions, .code-action-btn { display: none !important; }
```

Consistent with `getCleanRenderedContent()` at line 5638.

---

## Quick Reference for Auditor

**Verify the rerun results**:
```bash
Get-Content qa-artifacts\phase5-regression-summary.txt   # FILE LEG EXIT: 0 / HTTP LEG EXIT: 0
Select-String -Path qa-artifacts\phase5-regression-fileorigin.log -Pattern 'passed|skipped' | Select-Object -Last 2
Select-String -Path qa-artifacts\phase5-regression-http.log       -Pattern 'passed|skipped' | Select-Object -Last 2
```

**Rerun the computed print-visibility test**:
```bash
npx playwright test tests/phase5-postfix-print-test.spec.js --retries=0          # file://  → 4 passed
$env:P1_BASE_URL='http://127.0.0.1:4173/scripts/markdown-studio.html'
npx playwright test tests/phase5-postfix-print-test.spec.js --retries=0          # http://  → 4 passed
```

**Verify the candidate is unchanged**:
```bash
git diff 9e84517 -- scripts/markdown-studio.html   # empty
```

---

## Conclusion

All four Round 2 auditor comments are addressed with executed work and committed evidence. The Phase 5 sign-off package is complete and consistent: candidate identity verified, totals reconciled to the actual rerun (410 passed / 6 skipped / 416 possible runs, 0 failed), computed print visibility proven by print-media emulation, and every evidence index now matches the artifacts the branch actually contains.
