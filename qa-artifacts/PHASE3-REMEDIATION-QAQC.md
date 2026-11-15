# Phase 3 remediation QA/QC report (for the auditor)

Scope: independent QA/QC of the coder's remediation for the independent review's single open acceptance item — P3-06 soft-wrap gutter alignment (`markdown-studio-phase-3-review.md`, Nov 15, 2026).

## 1. Remediation under test

- Remediation commit: `b792bf5cd0fdf34da072dcdbf4765662490e53a1` — "P3 review fix: soft-wrap gutter alignment (wrap-mode row tracking)"
- Parent (reviewed, conditionally-open) candidate: `921e60c91a4c960ce4e4c160bb0a4ffafbe7198a` (blob `a250ede3…`)
- Live file at remediation: `scripts/markdown-studio.html`, blob `cb53b627c39fdb9fa51a69a0d3d7a6747dee189b`, SHA-256 `84a0eff6a8e8b0a7f6c4a2fa5bc424cd4638d52b926139ad52bc993186d29d1d` — re-verified from the committed tree
- Base per handoff pins re-verified: tip `c25154a` / blob `4623d798…`, Phase 2 accepted `4c2701a`
- Remediation diff scope: `git diff --numstat 921e60c b792bf5` = `scripts/markdown-studio.html` 72+/5− (7 hunks: `updateLineNumbers` rewrite, `.line-numbers` CSS, `applyWordWrap` trigger, resize listener, split-resizer mousemove/mouseup triggers, `setPaneVisibility` trigger) + `tests/phase3.spec.js` 100+/18− (P3-06 wrap assertions). Nothing else.

## 2. Code audit of the remediation diff

`updateLineNumbers()` now emits one absolutely positioned `<span>` per logical line: in soft-wrap mode it builds a hidden mirror div that replicates the editor's computed content geometry (font family/size, line-height, white-space, word-break, overflow-wrap, tab-size, width = editor content width) and reads each line's first-visual-row `offsetTop`; in nowrap (1:1) mode it keeps a fast-path pitch-positioned list identical in geometry to the previous `<br>` layout. `.line-numbers` gains `position: relative`. A trailing 1px spacer keeps the gutter's scroll range equal to the editor's — necessary because absolutely positioned children do not contribute the gutter's bottom padding to scrollable overflow (without it the gutter was ~16px short and the nowrap *scrolled* condition failed at 15px during remediation; with it, 0 residual). Re-measure triggers: wrap toggle, window resize, split-resizer drag/mouseup, editor-pane visibility change. Boundary grep over the remediation hunks: no storage keys, transfer contracts, BroadcastChannel, CDN tags, slides, exports, print, parser, or Mermaid code. Both inline scripts parse cleanly at the committed blob.

## 3. Test that catches the finding — with negative control

P3-06's wrap branch is now asserted acceptance (not evidence capture): samples include every wrapped line (1, 8, 15, 22, 29, 36) **and the logical lines immediately after wrapped lines** (2, 9, 16, 23, 30, 37) plus line 40; conditions wrap top / scrolled / window-resized assert |drift| <= 2.5px with gutter positions read from the actual number elements; a scroll-range parity check (|gutter.scrollHeight − editor.scrollHeight| <= 8px) guards the scrollTop sync over wrapped content.

Negative control: the updated `tests/phase3.spec.js` (from the remediation commit) was copied into a clean git worktree of the **parent** candidate `921e60c` (node_modules linked) — `npx playwright test tests/phase3.spec.js -g P3-06 --project=chromium --retries=0` **FAILED** at `wrap wrap_top drift line 1` (received 17px vs tolerance 2.5; the pre-remediation evidence run recorded -260.6px by line 40). Same spec on the remediation commit: **PASSES** (all 4 browsers × both origins, plus chromium+firefox spot rerun on the committed tree). The test genuinely guards the finding and the fix closes it.

## 4. Retest matrix

Full rerun on `b792bf5` (per the freeze-retest rule), all three suites, all browsers, both origins, `--retries=0`:

| Origin | Result |
| --- | --- |
| `file:///C:/Git/markdown_studio/scripts/markdown-studio.html` | 144 passed / 4 skipped (SM-03 by design on file://) / 0 failed |
| `http://127.0.0.1:8642/scripts/markdown-studio.html` | 148 passed / 0 failed |

Browsers: Chromium 159, Edge 159 (`msedge` channel), Chrome 159 (`chrome` channel), Firefox 159. Fresh context per test, no storage clearing. Logs: `qa-artifacts/phase3remediation-matrix-fileorigin.log`, `qa-artifacts/phase3remediation-matrix-http.log` (both exit 0). Independent spot reproduction after freezing (chromium + firefox, P3-06, committed tree `e5f9e13`, clean `git status`): 2/2 passed.

## 5. Evidence record

`qa-artifacts/PHASE3-P3-06.evidence.json` (http run latest; file run preserved in `qa-artifacts-fileorigin/`): wrap sampled drift 0.0px on every sampled line — including lines after wrapped rows — at wrap top/scrolled/window-resized; scroll ranges editor 1155px vs gutter 1158px over wrapped content; nowrap conditions within 2.2px (Firefox intrinsic textarea inset, inside the 2.5px tolerance). Before-record retained from the pre-remediation run: -260.6px @ line 40 (wrap), -31.8px @ line 40 (nowrap). Per-label evidence JSONs record the last concurrent writer per run; per-browser pass/fail is the matrix rows above. Reports updated: `PHASE3-QA-RESULTS.md` (freeze-log entry + addendum), `PHASE3-AUDITOR-REPORT.md` (remediation addendum superseding §7 with the updated exit-gate table).

## 6. Verdict

The review's open acceptance item is **resolved** on candidate `b792bf5`: the soft-wrap gutter now tracks each logical line's first visual row, the new assertions fail on the parent candidate (negative control) and pass on the remediation across all eight browser/origin pairs, and the full Phase 1 + Phase 2 + Phase 3 suites remain green. The Phase 3 handoff's P3-06 requirement ("aligned with visible editor rows, including soft wraps") is satisfied, not deferred. Remaining open dependency (unchanged, cross-phase): the production launch URL must be recorded and exercised before launch-origin coverage is declared complete.

## 7. Recommendation

Record Phase 3 sign-off on candidate `b792bf5cd0fdf34da072dcdbf4765662490e53a1`. Branch is local-only since the last push — push `9c1da90…e5f9e13` for the review record.
