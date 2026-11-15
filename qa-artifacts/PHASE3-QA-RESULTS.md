# Phase 3 QA/QC results and change map

Frozen candidate under test:

- Branch: `wp/studio_migration`
- Commit: `921e60c` ("Stage 3 (Phase 3): editor action safety, palette decode, shortcut guard, gutter pitch")
- Live file: `scripts/markdown-studio.html`, git blob `a250ede3571d718cf9a16782d664c430ea7d280e`
- Implementation base (per Phase 3 handoff pins, re-verified before coding): tip `c25154a67e82ca51c76377f0f29688f8a85e8a85d3172`, live blob `4623d798d35dcf30961504e2a9206eb67c002a14`, Phase 2 accepted candidate `4c2701a8fa6dadaf7a8a1e03460b1b72e1bbb80b`
- Changed files: `scripts/markdown-studio.html` (**65 additions / 14 deletions** vs base 4c2701a, six hunks) and new `tests/phase3.spec.js`

## Candidate history (QA freeze log)

1. `921e60c` — Phase 3 candidates for R10, R11, R12, the global shortcut guard, and the conditional gutter fix, plus the P3-01..P3-06 spec. Early matrix run against a pre-tuning draft of the spec surfaced only harness-side issues (single-click races on card handlers wired after the async render loop; missing settle time for the asynchronous programmatic `scroll` event; one wrong expected value; Firefox focus semantics), all fixed in the spec. The application script was **not** touched after the freeze (blob unchanged: `a250ede3`). Final matrix below ran against exactly this candidate with the final spec, amended in the follow-up evidence commit.

## Change map (handoff finding -> verdict -> live location)

| Finding | Verdict | Live location (candidate) | Notes |
| --- | --- | --- | --- |
| R10 `wrapSelection` empty-selection fallback | CHANGED | `wrapSelection()` (~l.3981) | Removed `\|\| 'text'` fallback (audited newer reference semantics, not the frozen candidate's). Empty selection: wrappers inserted at the caret, caret placed between them (`start + before.length`); a selection is wrapped and stays selected (`start+before.len .. start+before.len+sel.len`). New `insertSnippet()` helper added for snippet-style actions. |
| R11 image action URL concatenation | CHANGED | image case in the toolbar handler (~l.4050); `insertSnippet()` | Port of the audited reference: alt text is the selection when present, otherwise `Alt text`; the complete `![alt](url)` snippet replaces the selection; caret at snippet end. The URL can no longer be glued onto the selected text (`texthttps…`). |
| R12 palette literal `\n`/`\t` sequences | CHANGED | `#builderSidebar .palette-btn` click handler (~l.4703) | `data-insert` values decode `\n`/`\t` on insertion; unrelated backslash content (e.g. the Node Styling entry) passes through unchanged. |
| Global shortcut guard | CHANGED | document `keydown` handler (~l.5375-5436) | Escape branch moved first (closes Studio / fullscreen / table modal / find bar / error log) so dismissal still works in every context. Then a guard: early return when focus is inside an open overlay (`.modal-overlay.open`, `.cmd-palette-overlay.open`, `.find-replace-bar.show`) or inside any input control that is not the main editor (INPUT/TEXTAREA/SELECT/contentEditable). All remaining shortcuts — including Alt+Z word-wrap — sit behind the guard. Now-dead trailing Escape chain removed. Semantics match the audited reference (focus on a plain button *outside* an open overlay is not a typing context); the live guard is strictly stricter for in-overlay focus. |
| Gutter alignment (reproduce-first) | REPRODUCED, THEN FIXED | `.line-numbers` CSS (~l.602) | Defect confirmed on base `4c2701a` before any change: gutter row pitch 20.8px (13px font) vs editor 21.6px (13.5px), drifting 0.8px/line to **-31.8px at line 40** in nowrap ("1:1 Line Gutter") mode; the shorter gutter content also could not track deep scroll positions. Negative control: the P3-06 spec run against a worktree of base `4c2701a` failed at the first sampled line beyond tolerance (3.8px @ line 5). Conditional one-line fix applied: `.line-numbers` font-size 13.5px, matching `#editor` (same mono family, same line-height 1.6, identical 16px top padding). Post-fix: gutter pitch = editor pitch, `scrollHeight` equal (896 = 896), drift <= 1.2px on Chromium-family (mirror-div sub-pixel rounding) and <= 2.2px constant intrinsic textarea inset on Firefox. Full before/after measurement record: `qa-artifacts/PHASE3-P3-06-gutter-before-after.json` (measured with `qa-artifacts/phase3-gutter-measure.js`; Firefox inset parsed with `qa-artifacts/ffmeasure.js`). Soft-wrap mode keeps the one-number-per-logical-line gutter by design; the wrap-top condition records that drift as evidence without asserting it. |

Constraints audit: the candidate diff touches only the five regions above (six hunks). No changes to `markflow_*` / `gemini_studio_*` keys, `BroadcastChannel`, storage keys, CDN tags, slide/presentation, export, or print paths (grep of the candidate diff).

## QA matrix (candidate `921e60c`, final spec)

Environments: Windows 11 x64; Playwright 1.65.1 headless; Chromium 159, Edge (channel), Chrome (channel), Firefox 159. Origins: `file:///C:/Git/markdown_studio/scripts/markdown-studio.html` and `http://127.0.0.1:8642/scripts/markdown-studio.html` (python http.server). Fresh context per test. Runs use `--retries=0` (any earlier failures were triaged, not retried away).

| Suite | file:// | http://127.0.0.1:8642 |
| --- | --- | --- |
| Phase 3 checks (P3-01..P3-06, 6 tests x 4 browsers) | 24 passed | 24 passed |
| P3-07 Phase 1 regression (`tests/phase1.spec.js`, 24 tests x 4 browsers) | 92 passed / 4 skipped (SM-03 origin-dependent) | 96 passed |
| P3-07 Phase 2 regression (`tests/phase2.spec.js`, 7 tests x 4 browsers) | 28 passed | 28 passed |
| **Total (148 checks per origin)** | **144 passed / 4 skipped / 0 failed** | **148 passed / 0 failed** |

Logs: `qa-artifacts/phase3-matrix-fileorigin.log`, `qa-artifacts/phase3-matrix-http.log` (both exit 0). The 4 skips are the by-design SM-03 file-origin skips carried over from the Phase 1 suite.

### Per-check evidence highlights

- P3-01 (R10): empty-selection bold/italic/code/hr/codeblock produce wrapper pairs only with the caret between them (`****Hello World Line` caret 2; `alpha **beta` caret 7; `plain text here`` `backticks caret 16; `Para\n\n---\n\n` caret 11; code-block caret 17 inside the fences). No literal `text` placeholder appears anywhere.
- P3-02 (R10): selections wrap and stay selected on the original text (bold `**GONE**` selection 17-21; multiline `*lineB\nlineC*`); divider over a selection preserves it; a collapsed caret does not consume neighbouring text.
- P3-03 (R11): image action at a caret inserts `![Alt text](url)` with the caret after the snippet; with `my screenshot` selected the result is `![my screenshot](url)` — the selection becomes the alt text and the URL is never concatenated after it; `texthttps` asserted absent. Link action unchanged (`x[](url)` caret 2).
- P3-04 (R12): Subgraph Box insertion yields the real decoded string `'\n  subgraph ClusterName [Group Title]\n    node1\n    node2\n  end\n'` with no literal `\n` remaining; Rect/arrow snippets insert verbatim; the Node Styling literal (`fill:#6366f1,stroke:#4f46e5,stroke-width:2px,color:#fff`) is preserved exactly; a newline-heavy palette-built diagram renders in the builder canvas.
- P3-05 (guard): Ctrl+B/Ctrl+I with focus in the builder, find, replace, and command-palette inputs never mutate the background document; Ctrl+B with focus on a button inside the open Studio overlay is blocked; Escape dismisses Studio, find bar, and command palette from all those states (including with focus in a hidden input); editor-focused shortcuts still work (Ctrl+B wraps, Ctrl+F reopens the bar).
- P3-06 (gutter): nowrap top / scrolled / window-resized / split-dragged all within 2.5px on Chromium-family (<= 1.2px) and Firefox (<= 2.2px constant inset); sample rows and stats per condition in the evidence JSON; wrap-top drift recorded unasserted. Gutter-vs-editor row geometry is measured with an off-DOM mirror that replicates the textarea's content geometry.

Evidence: `qa-artifacts/PHASE3-P3-0*.evidence.json` (http run latest in `qa-artifacts/`, file run in `qa-artifacts-fileorigin/`), `qa-artifacts/PHASE3-P3-06-gutter-before-after.json`, `qa-artifacts/PHASE3-P3-06_nowrap_top.png` / `_wrap_top.png`, plus the refreshed Phase 1/2 per-browser evidence from the regression matrix.

Known harness facts (recorded, not app issues): card action handlers wire after the async mermaid render loop (retried clicks, as in Phase 2); the `scroll` event for programmatic `scrollTop` is asynchronous (settle before measuring); Firefox keeps focus inside freshly hidden inputs while Chromium releases it (tests blur to a deterministic state); browsers apply 1-2px intrinsic insets in textareas (covered by the 2.5px tolerance).

## Coverage caveats

- Production launch origin (Phase 1 open item) remains unknown and therefore unsampled; local file:// and http://127.0.0.1 coverage stands.
- Per-check evidence JSONs hold the run's last concurrent writer per label; per-browser pass/fail is authoritative in the matrix rows and logs above.

## Reproduction

```
npx playwright test tests/phase3.spec.js --project=chromium --project="Microsoft Edge" --project="Google Chrome" --project=firefox --retries=0 --reporter=line
P1_BASE_URL=http://127.0.0.1:8642/scripts/markdown-studio.html npx playwright test tests/phase1.spec.js tests/phase2.spec.js tests/phase3.spec.js --project=... --retries=0 --reporter=line
node qa-artifacts/phase3-gutter-measure.js [<path-to-markdown-studio.html>]   # gutter drift diagnostic
```
