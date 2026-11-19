# Phase 5 Coder Instructions — Reconciliation Implementation

**Document ID**: PHASE5-CODER-INSTRUCTIONS  
**Version**: 1.0  
**Date**: November 17, 2026  
**Status**: Ready for Execution  
**Parent Document**: PHASE5-RECONCILIATION-PLAN.md  

---

## 🎯 Objective

Implement the reconciliation fix for the code-block transfer buttons appearing in print output, creating a new frozen candidate for Phase 5 sign-off.

**Fix Required**: Add `.code-block-actions, .code-action-btn` to the `@media print` CSS rule at line ~1797 in `scripts/markdown-studio.html`.

---

## ⚠️ Pre-Flight Checklist

Before beginning, verify:

- [ ] Current branch is `wp/studio_migration`
- [ ] Current HEAD is `02b53632939d658fb41c7ec80a091d6378bb1633` or `a4b31c7529ddb76c20e6f77457d3c6acb2f4185a`
- [ ] Live file blob is `ca087ef54d44f17062eb0e3ec8fa6da30635c97e`
- [ ] Live file SHA-256 is `F401A2EF2FD2DA064D6E1ADAA33AF2C90AA831B9563DE9521D07DA04F84BD1F7`
- [ ] No uncommitted changes in working tree
- [ ] All Phase 5 evidence artifacts are present

**Verification Commands**:
```bash
# Check current state
cd /c/Git/markdown_studio
git rev-parse HEAD
git hash-object scripts/markdown-studio.html
openssl dgst -sha256 scripts/markdown-studio.html | awk '{print $2}' | tr 'a-z' 'A-Z'
wc -c scripts/markdown-studio.html
wc -l scripts/markdown-studio.html

# Check working tree status
git status
```

---

## 🔧 Step 1: Create Implementation Branch

**Optional but recommended** for traceability:

```bash
cd /c/Git/markdown_studio

# Create and checkout reconciliation branch
git checkout -b phase5-reconciliation

# Verify branch
git branch --show-current
```

---

## 🎨 Step 2: Apply the Fix

### The Change

**File**: `scripts/markdown-studio.html`  
**Line**: ~1797 (within the `@media print` block)  
**Type**: Single line modification (CSS selector addition)

### Method A: Manual Edit (Recommended)

1. Open `scripts/markdown-studio.html` in your editor
2. Navigate to line ~1797
3. Find the line:
   ```css
   .mermaid-header, .diag-action-btn, .mermaid-actions { display: none !important; }
   ```
4. Change it to:
   ```css
   .mermaid-header, .diag-action-btn, .mermaid-actions, .code-block-actions, .code-action-btn { display: none !important; }
   ```
5. Save the file

### Method B: Command Line Edit

```bash
# Use sed to make the change (Windows Git Bash)
cd /c/Git/markdown_studio
sed -i 's/.mermaid-header, .diag-action-btn, .mermaid-actions { display: none !important; }/.mermaid-header, .diag-action-btn, .mermaid-actions, .code-block-actions, .code-action-btn { display: none !important; }/' scripts/markdown-studio.html
```

### Verification

```bash
# Show the change
git diff scripts/markdown-studio.html

# Expected output should show:
# - .mermaid-header, .diag-action-btn, .mermaid-actions, .code-block-actions, .code-action-btn { display: none !important; }

# Verify the change is in @media print block
grep -n "code-block-actions" scripts/markdown-studio.html
```

---

## 🧪 Step 3: Quick Manual Verification

Before running automated tests, perform a quick manual check:

1. **Open in Browser**:
   - Navigate to `file:///C:/Git/markdown_studio/scripts/markdown-studio.html`
   - Or start local server: `python -m http.server 4173` and visit `http://127.0.0.1:4173/scripts/markdown-studio.html`

2. **Create test document**:
   ```markdown
   # Print Test
   
   ```mermaid
   flowchart TD
     A[Start] --> B[End]
   ```
   
   ```python
   print("code block")
   ```
   ```

3. **Open Print Preview**:
   - Press Ctrl+P or Cmd+P
   - Verify that:
     - Diagram action buttons (↗ Mermaid, ↓ SVG, ↓ PNG) are **NOT visible**
     - Code-block transfer buttons (↗ Notepad++, ▶ Run in Notebook) are **NOT visible**
     - The diagram itself is visible
     - The code block content is visible

4. **Export as PDF** (if possible):
   - Use browser's print-to-PDF function
   - Open the PDF and verify no code-block transfer buttons

---

## 📊 Step 4: Run Automated Tests

### Setup

Ensure Playwright is installed and browsers are available:

```bash
# Install dependencies (if not already installed)
npm install @playwright/test
npx playwright install
```

### Run Phase 5 Tests

```bash
# HTTP origin tests (requires local server on port 4173)
P1_BASE_URL=http://127.0.0.1:4173/scripts/markdown-studio.html \
  npx playwright test tests/phase5.spec.js \
  --project=chromium --project="Microsoft Edge" --project="Google Chrome" --project=firefox \
  --retries=0

# File origin tests
npx playwright test tests/phase5.spec.js \
  --project=chromium --project="Microsoft Edge" --project="Google Chrome" --project=firefox \
  --retries=0
```

**Expected Results**: 20 tests × 4 browsers = 80 runs, all should PASS

### Run Phase 1-4 Regression Tests

```bash
# HTTP origin
P1_BASE_URL=http://127.0.0.1:4173/scripts/markdown-studio.html \
  npx playwright test tests/phase1.spec.js tests/phase2.spec.js tests/phase3.spec.js tests/phase4.spec.js \
  --project=chromium --project="Microsoft Edge" --project="Google Chrome" --project=firefox \
  --retries=0

# File origin
npx playwright test tests/phase1.spec.js tests/phase2.spec.js tests/phase3.spec.js tests/phase4.spec.js \
  --project=chromium --project="Microsoft Edge" --project="Google Chrome" --project=firefox \
  --retries=0
```

**Expected Results**: 46 tests × 4 browsers = 184 runs per origin, all should PASS

### Run Complete Phase 5 Matrix

For thoroughness, run the complete test suite:

```bash
# HTTP origin
P1_BASE_URL=http://127.0.0.1:4173/scripts/markdown-studio.html \
  npx playwright test tests/phase1.spec.js tests/phase2.spec.js tests/phase3.spec.js tests/phase4.spec.js tests/phase5.spec.js \
  --project=chromium --project="Microsoft Edge" --project="Google Chrome" --project=firefox \
  --retries=0

# File origin
npx playwright test tests/phase1.spec.js tests/phase2.spec.js tests/phase3.spec.js tests/phase4.spec.js tests/phase5.spec.js \
  --project=chromium --project="Microsoft Edge" --project="Google Chrome" --project=firefox \
  --retries=0
```

**Expected Results**: 66 tests × 4 browsers = 264 runs per origin, all should PASS

---

## 📦 Step 5: Freeze New Candidate

After all tests pass, freeze the new candidate:

### Record Candidate Details

```bash
# Get commit details
NEW_COMMIT=$(git rev-parse HEAD)
NEW_BLOB=$(git hash-object scripts/markdown-studio.html)
NEW_SHA256=$(openssl dgst -sha256 scripts/markdown-studio.html | awk '{print $2}' | tr 'a-z' 'A-Z')
NEW_SIZE=$(wc -c < scripts/markdown-studio.html)
NEW_LINES=$(wc -l < scripts/markdown-studio.html)

echo "New Frozen Candidate:"
echo "  Commit: $NEW_COMMIT"
echo "  Blob: $NEW_BLOB"
echo "  SHA-256: $NEW_SHA256"
echo "  Size: $NEW_SIZE bytes"
echo "  Lines: $NEW_LINES"
```

### Verify No Other Changes

```bash
# Check what files were changed
git status
git diff --name-only

# Should only show: scripts/markdown-studio.html
```

### Create Freeze Commit

```bash
# Commit the change
git add scripts/markdown-studio.html
git commit -m "Phase 5 reconciliation: add code-block transfer buttons to @media print

Fixes cosmetic issue where code-block transfer buttons (Notepad++, Run in Notebook)
appeared in print output. This aligns print behavior with export/copy behavior
which already strips these buttons via getCleanRenderedContent().

Generated by Mistral Vibe.
Co-Authored-By: Mistral Vibe <vibe@mistral.ai>"

# Record the new frozen commit
NEW_FROZEN_COMMIT=$(git rev-parse HEAD)
echo "New Frozen Commit: $NEW_FROZEN_COMMIT"
```

---

## 📊 Step 6: Generate New Evidence Package

Delete old Phase 5 evidence and regenerate:

```bash
# Remove old evidence
rm -rf qa-artifacts/phase5/*
rm -rf qa-artifacts-fileorigin/phase5/*

# Re-run tests to generate new evidence
# HTTP origin
P1_BASE_URL=http://127.0.0.1:4173/scripts/markdown-studio.html \
  npx playwright test tests/phase5.spec.js \
  --project=chromium --project="Microsoft Edge" --project="Google Chrome" --project=firefox \
  --retries=0

# File origin
npx playwright test tests/phase5.spec.js \
  --project=chromium --project="Microsoft Edge" --project="Google Chrome" --project=firefox \
  --retries=0
```

### Verify Evidence Package

```bash
# Count evidence files
echo "HTTP origin evidence:"
find qa-artifacts/phase5 -type f | wc -l
echo "File origin evidence:"
find qa-artifacts-fileorigin/phase5 -type f | wc -l

# Expected: ~20 JSON files + ~32 export files + ~13 PNG files per origin
```

### Manual Firefox PDF Evidence

Since Playwright cannot generate PDFs for Firefox, create manual evidence:

1. Open Firefox and navigate to `http://127.0.0.1:4173/scripts/markdown-studio.html`
2. Create a document with the 26-step tall diagram:
   ```mermaid
   flowchart TD
     A1[Step 1] --> A2[Step 2]
     A2 --> A3[Step 3]
     ... (continue to Step 26)
   ```
3. Print to PDF (Ctrl+P → Save as PDF)
4. Save as `qa-artifacts/phase5/firefox/tall-diagram.pdf`
5. Use pdf.js or similar to inspect the PDF and verify all 26 steps are present
6. Save inspection results as `qa-artifacts/phase5/firefox/PHASE5-P5-04-firefox-tall-diagram.evidence.json`

---

## 📝 Step 7: Update Documentation

### Update PHASE5-QA-RESULTS.md

Add a new section at the top:

```markdown
## Phase 5 Reconciliation Update

**Status**: Reconciliation Complete - New Frozen Candidate

**New Frozen Candidate**:
- Branch: `wp/studio_migration`
- Commit: `<NEW_COMMIT>`
- Live-file Git blob: `<NEW_BLOB>`
- Live-file SHA-256: `<NEW_SHA256>`
- Live-file Size: `<NEW_SIZE>` bytes / `<NEW_LINES>` lines

**Changes from Previous Candidate**:
- Fixed `@media print` CSS to hide `.code-block-actions, .code-action-btn`
- Single line change at line ~1797 in `scripts/markdown-studio.html`

**Reconciliation Test Results**:
- Phase 5 Tests: 20 tests × 4 browsers × 2 origins = 160 runs, all PASSED
- Phase 1-4 Regression: 46 tests × 4 browsers × 2 origins = 368 runs, all PASSED
- Total: 528 runs, all PASSED
```

### Update PHASE5-AUDITOR-REPORT.md

Update the candidate identity section and add reconciliation note:

```markdown
## Reconciliation Update

**Reconciliation Applied**: Code-block transfer buttons fix

**Change**: Added `.code-block-actions, .code-action-btn` to `@media print` CSS
**Location**: `scripts/markdown-studio.html` line ~1797
**Impact**: Print output now consistent with export/copy behavior
**Risk**: Low - only affects print media, no live behavior change

**Updated Candidate**:
- Commit: `<NEW_COMMIT>`
- Live-file Git blob: `<NEW_BLOB>`
- Live-file SHA-256: `<NEW_SHA256>`

**Updated Open Items**:
1. Firefox automated PDF generation - ACCEPT (covered by manual evidence)
2. Code-block transfer buttons in @media print - FIXED ✓
3. Firefox file:// P5-05 transfer - ACCEPT (expected behavior)

**Updated Recommendation**: PROCEED TO PHASE 5 SIGN-OFF
```

---

## 🏆 Step 8: Final Verification

### Checklist

- [ ] Fix applied correctly (verify with `git diff`)
- [ ] Manual print preview verified (no code-block buttons)
- [ ] Phase 5 tests all pass
- [ ] Phase 1-4 regression tests all pass
- [ ] New frozen candidate committed
- [ ] Evidence package regenerated
- [ ] Manual Firefox PDF evidence created
- [ ] PHASE5-QA-RESULTS.md updated
- [ ] PHASE5-AUDITOR-REPORT.md updated
- [ ] Working tree is clean

### Final Status Check

```bash
# Verify final state
git status
git log --oneline -3

# Verify candidate
git rev-parse HEAD
git hash-object scripts/markdown-studio.html
openssl dgst -sha256 scripts/markdown-studio.html | awk '{print $2}' | tr 'a-z' 'A-Z'

# Count evidence
echo "HTTP evidence files: $(find qa-artifacts/phase5 -type f | wc -l)"
echo "File origin evidence files: $(find qa-artifacts-fileorigin/phase5 -type f | wc -l)"
```

---

## 🎉 Step 9: Sign-Off

Once all steps are complete and verified:

1. **Merge to wp/studio_migration** (if using a branch):
   ```bash
   git checkout wp/studio_migration
   git merge phase5-reconciliation
   git push origin wp/studio_migration
   ```

2. **Or commit directly to wp/studio_migration** (if not using a branch):
   ```bash
   git push origin wp/studio_migration
   ```

3. **Announce**: "Phase 5 Reconciliation Complete - Ready for Sign-Off"

---

## 🚨 Troubleshooting

### Issue: Tests are failing

**Symptoms**: Tests that passed before are now failing

**Debugging Steps**:
1. Check `git diff` to ensure only the intended change was made
2. Revert and re-apply the change manually
3. Check for syntax errors in the CSS
4. Verify the change is within the `@media print` block

**Common Causes**:
- Extra comma or missing character in CSS
- Change applied outside the `@media print` block
- Accidental changes to other parts of the file

### Issue: Manual print preview shows code-block buttons

**Symptoms**: Buttons still visible in print preview

**Debugging Steps**:
1. Verify the CSS change is present: `grep "code-block-actions" scripts/markdown-studio.html`
2. Check that it's in the `@media print` block: `grep -B5 "code-block-actions" scripts/markdown-studio.html`
3. Hard refresh the browser (Ctrl+Shift+R)
4. Try a different browser

**Common Causes**:
- Browser cache not cleared
- Change not saved to file
- Change in wrong location

### Issue: Git diff shows unexpected changes

**Symptoms**: More files changed than expected

**Debugging Steps**:
1. Check `git status` for uncommitted changes
2. Use `git checkout <file>` to revert unwanted changes
3. Verify only `scripts/markdown-studio.html` is modified

**Common Causes**:
- Accidental edits to other files
- Line ending changes
- IDE/editor auto-formatting

---

## 📞 Support

For questions or issues during implementation:

1. **Review the reconciliation plan**: `PHASE5-RECONCILIATION-PLAN.md`
2. **Check existing evidence**: `qa-artifacts/phase5/` and `qa-artifacts-fileorigin/phase5/`
3. **Compare with Phase 4**: `getCleanRenderedContent()` at line 5638 already strips these classes
4. **Verify the fix location**: Line ~1797 in `@media print` block

---

## 📄 Appendix: Quick Reference

### The Fix (One-Liner)
```css
.mermaid-header, .diag-action-btn, .mermaid-actions, .code-block-actions, .code-action-btn { display: none !important; }
```

### Expected Test Results
- **Phase 5**: 20 tests × 4 browsers × 2 origins = 160 runs, all PASS
- **Regression**: 46 tests × 4 browsers × 2 origins = 368 runs, all PASS
- **Total**: 528 runs, all PASS

### Files to Update
- `scripts/markdown-studio.html` (the fix)
- `qa-artifacts/PHASE5-QA-RESULTS.md` (documentation)
- `qa-artifacts/PHASE5-AUDITOR-REPORT.md` (documentation)
- `qa-artifacts/phase5/*` (new evidence)
- `qa-artifacts-fileorigin/phase5/*` (new evidence)

### Verification Commands
```bash
# Quick diff check
git diff scripts/markdown-studio.html

# Quick evidence check
find qa-artifacts/phase5 -type f | wc -l
find qa-artifacts-fileorigin/phase5 -type f | wc -l

# Quick test run
npx playwright test tests/phase5.spec.js --project=chromium --retries=0
```
