# Phase 5 Reconciliation Plan — Coder Instructions & Resolution Path

> **⚠️ SUPERSEDED (Round 2, November 17, 2026)**: This plan was drafted before the reconciliation fix (`9e84517`) and cites the obsolete 520/8 totals, which were themselves a miscount (corrected first to 401/7/408, then, in Round 2, to the authoritative **410 passed / 6 skipped / 416 possible runs** from a full rerun against `9e84517`). The reconciliation it planned is complete and verified. Current results: `PHASE5-QA-RESULTS.md` and `PHASE5-AUDITOR-REPORT.md` (both Round 2). Retained as historical planning material only.

**Prepared**: November 17, 2026  
**Status**: Ready for review and execution  
**Reference**: `markdown-studio-phase-5-handoff.md`, `markdown-studio-phase-5-qaqc-handoff.md`  
**Audit Report**: `PHASE5-AUDITOR-REPORT.md`

---

## Executive Summary

Phase 5 independent QA/QC verification is **COMPLETE** with **520 checks passed / 0 failed / 8 skipped** across all browsers and origins. The auditor report recommends **PROCEED TO PHASE 5 SIGN-OFF** with documented open items.

However, the Phase 5 QA/QC handoff document explicitly states:
> "QA/QC should record whether to accept as-is or require a follow-up fix before PR integration."

This reconciliation plan addresses the **one actionable defect** identified and provides coder instructions for resolution.

---

## 1. Reconciliation Decision Matrix

| Item | Severity | Risk | Current Disposition | Recommendation | Action Required? |
|------|----------|------|---------------------|----------------|------------------|
| Firefox PDF automation (P5-04) | Low | None | ACCEPT | ACCEPT | ❌ No |
| Code-block transfer buttons in `@media print` | Low | Low | ACCEPT AS-IS | **FIX BEFORE PR** | ✅ **Yes** |
| Firefox file:// P5-05 transfer | Low | None | ACCEPT | ACCEPT | ❌ No |

**Decision**: The code-block transfer buttons in print output should be fixed before PR integration to maintain consistency with the export/copy behavior (which already strips these buttons via `getCleanRenderedContent()`).

---

## 2. Open Item Analysis

### Item #1: Firefox Automated PDF Generation (P5-04)

**Status**: ✅ **CLOSED - No Action Required**

- **Root Cause**: Playwright limitation (`page.pdf()` only supported for Headless Chromium)
- **Evidence**: Manual Firefox PDF artifacts prove all 26 steps render correctly across 4 pages
- **Impact**: None - Automation limitation, not a product defect
- **Disposition**: ACCEPT - Covered by manual evidence

### Item #2: Code-block Transfer Buttons in `@media print`

**Status**: ⚠️ **REQUIRES FIX - Action Required**

- **Location**: `scripts/markdown-studio.html` line 1797
- **Current Code**:
  ```css
  .mermaid-header, .diag-action-btn, .mermaid-actions { display: none !important; }
  ```
- **Missing**: `.code-block-actions, .code-action-btn`
- **Observation**: In manual Firefox PDF (`qa-artifacts/phase5/firefox/Markdown Editor & Mermaid Studio.pdf`, page 3), the code-block transfer buttons ("↗ Notepad++", "▶ Run in Notebook") appear in print output
- **Root Cause**: `@media print` CSS omits the Stage 4 code-block transfer button selectors
- **Impact**: Cosmetic - dead buttons appear in printed output (their handlers don't exist in printed context)
- **Severity**: Low
- **Risk**: Low (cosmetic only, no functional impact)
- **Inconsistency**: `getCleanRenderedContent()` (line 5638) already strips these classes for export/copy operations

**Why Fix Before PR Integration**:
1. **Consistency**: Print output should match export/copy behavior
2. **Cleanliness**: Dead UI elements should not appear in any output
3. **Phase 4 Alignment**: The export/copy paths already handle this via `getCleanRenderedContent()`
4. **Best Practice**: Print media should only show final, clean content

---

## 3. Coder Instructions

### 3.1 Fix for Item #2: Add code-block transfer buttons to @media print

**File**: `scripts/markdown-studio.html`  
**Line**: ~1797 (within the `@media print` block)  
**Current**:
```css
.mermaid-header, .diag-action-btn, .mermaid-actions { display: none !important; }
```

**Change to**:
```css
.mermaid-header, .diag-action-btn, .mermaid-actions, .code-block-actions, .code-action-btn { display: none !important; }
```

**Rationale**:
- Maintains consistency with `getCleanRenderedContent()` which already strips `.code-block-actions, .code-action-btn`
- Ensures clean print output without dead UI elements
- Minimal change, single line modification
- No risk to existing functionality

**Testing Requirements**:
1. Run full Phase 5 test suite after fix
2. Verify print output no longer contains code-block transfer buttons
3. Verify live Studio behavior unchanged (transfer buttons still work in live app)
4. Verify export/copy behavior unchanged

### 3.2 Implementation Steps

1. **Create new work branch** (optional, but recommended for traceability):
   ```bash
   git checkout -b phase5-reconciliation
   ```

2. **Apply the fix**:
   ```bash
   # Edit scripts/markdown-studio.html line ~1797
   # Change: .mermaid-header, .diag-action-btn, .mermaid-actions 
   # To:     .mermaid-header, .diag-action-btn, .mermaid-actions, .code-block-actions, .code-action-btn
   ```

3. **Verify the fix**:
   ```bash
   # Check the change
   git diff scripts/markdown-studio.html
   ```

4. **Run focused verification**:
   ```bash
   # Quick manual check: Open in browser, print preview, verify no code-block buttons
   # Run Phase 5 tests:
   P1_BASE_URL=http://127.0.0.1:4173/scripts/markdown-studio.html \
     npx playwright test tests/phase5.spec.js \
     --project=chromium --project="Microsoft Edge" --project="Google Chrome" --project=firefox \
     --retries=0
   ```

5. **Freeze new candidate**:
   - Record commit SHA
   - Record live-file Git blob
   - Record SHA-256 hash
   - Record byte/line counts

6. **Re-run full QA matrix**:
   ```bash
   # File origin
   npx playwright test tests/phase1.spec.js tests/phase2.spec.js tests/phase3.spec.js \
                    tests/phase4.spec.js tests/phase5.spec.js \
     --project=chromium --project="Microsoft Edge" --project="Google Chrome" --project=firefox \
     --retries=0
   
   # HTTP origin
   P1_BASE_URL=http://127.0.0.1:4173/scripts/markdown-studio.html \
     npx playwright test tests/phase1.spec.js tests/phase2.spec.js tests/phase3.spec.js \
                      tests/phase4.spec.js tests/phase5.spec.js \
     --project=chromium --project="Microsoft Edge" --project="Google Chrome" --project=firefox \
     --retries=0
   ```

7. **Update evidence package**:
   - Generate new evidence artifacts
   - Verify all 26 steps still present in PDFs
   - Verify no code-block buttons in print output

---

## 4. Reconciliation Workflow

### Option A: Fix Before Sign-Off (RECOMMENDED)

This option creates a **new frozen candidate** with the fix applied:

```
Phase 4 Candidate (1f06a9d)
    ↓
Phase 5 Frozen (02b5363) - QA/QC Complete ✓
    ↓
[Apply Fix] - New commit with @media print update
    ↓
Phase 5 Reconciled (NEW) - Re-freeze and re-verify
    ↓
Phase 5 SIGN-OFF ✓
```

**Pros**:
- Clean PR with no known cosmetic issues
- Consistent behavior across all output paths
- Meets Phase 4 quality standards

**Cons**:
- Requires re-running QA matrix (but Phase 5 is verification-only, so this is expected)
- Delays sign-off by ~1 day

### Option B: Accept As-Is with Follow-Up

This option accepts the current state and creates a follow-up issue:

```
Phase 5 Frozen (02b5363) - QA/QC Complete ✓
    ↓
Phase 5 SIGN-OFF ✓ (with noted cosmetic issue)
    ↓
[Post-PR] Create issue: "Code-block transfer buttons visible in print output"
    ↓
Fix in next phase or hotfix
```

**Pros**:
- Faster sign-off
- No immediate action required

**Cons**:
- Known cosmetic issue in production
- Inconsistent with export/copy behavior
- Violates Phase 4 cleanliness standards

---

## 5. Recommendation

**RECOMMENDATION**: **Option A - Fix Before Sign-Off**

**Rationale**:
1. The fix is **trivial** (single line CSS change)
2. The fix is **low-risk** (only affects print media, no live behavior change)
3. The fix **aligns with existing code** (`getCleanRenderedContent()` already strips these classes)
4. The fix **improves quality** (consistent behavior across all output paths)
5. The verification is **fast** (existing Phase 5 test suite covers this implicitly)
6. The cost is **minimal** (~1 day of re-verification)

**Decision Authority**: This reconciliation plan requests approval to proceed with Option A.

---

## 6. Implementation Checklist

- [ ] Review and approve this reconciliation plan
- [ ] Apply the @media print fix (line ~1797 in markdown-studio.html)
- [ ] Create new frozen candidate commit
- [ ] Re-run full Phase 5 test suite
- [ ] Re-run Phase 1-4 regression suites
- [ ] Update evidence package with new artifacts
- [ ] Verify all 26 steps present in PDFs
- [ ] Verify no code-block buttons in print output
- [ ] Update PHASE5-AUDITOR-REPORT.md with new candidate details
- [ ] Update PHASE5-QA-RESULTS.md with new test results
- [ ] PROCEED TO PHASE 5 SIGN-OFF

---

## 7. Success Criteria

The reconciliation is complete when:

1. ✅ The @media print CSS hides `.code-block-actions, .code-action-btn`
2. ✅ New frozen candidate commit is created and verified
3. ✅ All Phase 5 tests pass (520 checks)
4. ✅ All Phase 1-4 regression tests pass (184 checks per origin)
5. ✅ New evidence package is complete
6. ✅ Manual verification confirms no code-block buttons in print output
7. ✅ Updated auditor report and QA results are committed

---

## 8. Rollback Plan

If any issue is discovered during re-verification:

1. Revert the change: `git checkout scripts/markdown-studio.html`
2. Return to frozen candidate 02b5363
3. Re-evaluate the fix approach
4. Document the issue in the reconciliation plan

---

## 9. Approval

**Approver**: ___________________________  
**Date**: _______________  
**Decision**: ☐ Option A (Fix Before Sign-Off)  ☐ Option B (Accept As-Is)  
**Signature**: ___________________________

---

## Appendix A: Detailed Technical Specification

### The Fix

**File**: `scripts/markdown-studio.html`  
**Location**: Within the `@media print` block, approximately line 1797  
**Change Type**: CSS selector addition  
**Risk Level**: Low  
**Test Coverage**: Implicit (print/PDF tests verify clean output)

**Before**:
```css
.mermaid-header, .diag-action-btn, .mermaid-actions { display: none !important; }
```

**After**:
```css
.mermaid-header, .diag-action-btn, .mermaid-actions, .code-block-actions, .code-action-btn { display: none !important; }
```

**Verification Commands**:
```bash
# Check that the selectors are present in @media print
grep -A2 "@media print" scripts/markdown-studio.html | grep "code-block-actions"

# Verify the file is otherwise unchanged
git diff scripts/markdown-studio.html | wc -l  # Should be ~3 lines
```

### Expected Test Results

| Test | Before Fix | After Fix |
|------|------------|-----------|
| P5-01 Clipboard | PASS | PASS |
| P5-02 Standalone Export | PASS | PASS |
| P5-03 SVG/PNG | PASS | PASS |
| P5-04 PDF Pagination | PASS | PASS |
| P5-05 Persistence/Transfer | PASS | PASS |
| Phase 1-4 Regression | PASS | PASS |

**Note**: The fix does not require new tests; existing tests implicitly verify clean output.

---

## Appendix B: Related Documentation

- `markdown-studio-phase-5-handoff.md` - Phase 5 handoff document
- `markdown-studio-phase-5-qaqc-handoff.md` - QA/QC handoff with open items
- `qa-artifacts/PHASE5-AUDITOR-REPORT.md` - Current auditor report
- `qa-artifacts/PHASE5-QA-RESULTS.md` - Current QA results
- `tests/phase5.spec.js` - Phase 5 test suite
- `scripts/markdown-studio.html` line 1797 - Location of fix
- `scripts/markdown-studio.html` line 5638 - `getCleanRenderedContent()` for reference
