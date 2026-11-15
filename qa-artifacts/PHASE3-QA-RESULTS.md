# Phase 3 QA/QC results and change map

Frozen candidate under test:

- Branch: `wp/studio_migration`
- Commit: `921e60c` ("Stage 3 (Phase 3): editor action safety, palette decode, shortcut guard, gutter pitch"); remediated by `b792bf5` ("P3 review fix: soft-wrap gutter alignment") after the independent review — see the addendum. Current candidate: `b792bf5`, blob `cb53b627c39fdb9fa51a69a0d3d7a6747dee189b`, app-script diff vs base 4c2701a: 137 additions / 19 deletions.
- Live file at `921e60c`: `scripts/markdown-studio.html`, git blob `a250ede3571d718cf9a16782d664c430ea7d280e`
- Implementation base (per Phase 3 handoff pins, re-verified before coding): tip `c25154a67e82ca51c76377f0f29688f8a85e8a85d3172`, live blob `4623d798d35dcf30961504e2a9206eb67c002a14`, Phase 2 accepted candidate `4c2701a8fa6dadaf7a8a1e03460b1b72e1bbb80b`
- Changed files: `scripts/markdown-studio.html` (**65 additions / 14 deletions** vs base 4c2701a, six hunks) and new `tests/phase3.spec.js`

## Candidate history (QA freeze log)

1. `921e60c` — Phase 3 candidates for R10, R11, R12, the global shortcut guard, and the conditional gutter fix, plus the P3-01..P3-06 spec. Early matrix run against a pre-tuning draft of the spec surfaced only harness-side issues (single-click races on card handlers wired after the async render loop; missing settle time for the asynchronous programmatic `scroll` event; one wrong expected value; Firefox focus semantics), all fixed in the spec. The application script was **not** touched after the freeze (blob unchanged: `a250ede3`). Final matrix below ran against exactly this candidate with the final spec, amended in the follow-up evidence commit.
2. `b792bf5` ("P3 review fix: soft-wrap gutter alignment") — remediation of the independent review's open acceptance item (soft-wrap gutter alignment was recorded but never asserted; retained evidence showed drift to -260.6px at line 40 after earlier lines wrapped). `updateLineNumbers()` reworked: wrap mode measures each logical line's first visual row (hidden mirror of the editor geometry) and positions each number there via absolutely positioned spans; nowrap keeps a fast-path 1:1 pitch list; a trailing 1px spacer keeps the gutter scroll range equal to the editor's (abs children do not include the gutter's bottom padding in scrollable overflow); gutter re-measures on wrap toggle, window resize, split-resizer drag, and editor-pane visibility changes. P3-06 extended with asserted wrap-mode cases (top / scrolled / window-resized, sampled set including the lines immediately after wrapped rows, gutter/editor scroll-range parity). Retest on this candidate below. App-script diff vs base 4c2701a: 137 additions / 19 deletions.
3. `2cd8810` ("P3 review fix 2: collect gutter mirror spans once") — remediation of the review's second concern: the wrap pass ran one `querySelector` per logical line (quadratic overall) on every editor input, and large-document responsiveness was unmeasured. The mirror's spans are now collected once (`mirror.children`, ordered 1:1 with logical lines) and indexed directly — the row-offset pass is linear; per-line `data-ln` attributes dropped. New P3-06R check measures a representative 2000-line mixed document (every 5th line paragraph-length): app-equivalent row-offset pass with both lookup strategies against the live gutter, plus the end-to-end input handler; budgets pass median <= 40ms, handler median <= 120ms, new lookup not slower than the old. Observed: children 10-26ms median vs 20-48ms per-line querySelector (~2x slower), handler 35-63ms median (the handler includes the pre-existing 2000-line markdown preview render). **Current frozen candidate** (blob `cd0b2826906af730fd41a2c9b53a99e24bc3888f`, SHA-256 `882663fcb2ad13a318b9e7aaeb25215695796babbccb0b8596f0f4e6b954f805`).

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

---

# Addendum — reviewer remediation (candidate b792bf5)

## Finding

The independent review (`markdown-studio-phase-3-review.md`, Nov 15, 2026) approved the Phase 3 code for R10–R12, shortcut guarding, and the nowrap gutter correction, but held the Phase 3 handoff **conditionally open** on one item: P3-06 in soft-wrap mode. The final spec measured wrap-mode drift but only asserted the nowrap cases; retained Firefox http evidence recorded wrap-mode drift growing to **-260.6px by logical line 40** once earlier lines wrapped, and the handoff ("Line numbers stay aligned with visible editor rows, including soft wraps") does not exempt soft-wrap alignment.

## Fix (candidate b792bf5)

`updateLineNumbers()` now emits each number as an absolutely positioned span on the **first visual row of its logical line**:

- Soft-wrap mode measures per-line row offsets with a hidden mirror div replicating the editor's exact content geometry (font family/size, line-height, white-space, word-break, overflow-wrap, tab-size, width = editor content width), then places number N at the measured row offset. The measurement is O(document) mirror build, same order as the previous full gutter rebuild.
- Nowrap (1:1) mode keeps a fast-path pitch-positioned list, equal to prior geometry (P3-06 nowrap conditions unchanged and still green).
- The gutter is `position: relative` (CSS) and a trailing 1px spacer restores the bottom-padding scroll range: absolutely positioned children do not include the gutter's bottom padding in scrollable overflow, so without the spacer the gutter was ~16px shorter than the editor and could not track deep scroll positions (caught by the nowrap scrolled condition during remediation: 15px drift, now 0).
- The gutter re-measures on wrap toggle, window resize, split-resizer drag/mouseup, and editor-pane visibility changes (fast-path fallback when the editor pane is hidden).

## Acceptance coverage added (P3-06, reviewer requirement 1)

The wrap branch became asserted acceptance, not just evidence capture. Gutter positions are read from the actual number elements (implementation-agnostic):

- Samples deliberately include the wrapped lines (1, 8, 15, 22, 29, 36) and **the logical lines immediately after wrapped lines** (2, 9, 16, 23, 30, 37) plus 40 — a number that failed to drop down with its wrapped predecessors fails the assertion.
- Conditions: wrap top, wrap scrolled, wrap window-resized, each asserting |drift| <= 2.5px, plus gutter/editor scroll-range parity (<= 8px) proving `scrollTop` sync stays exact over wrapped content.

## Retest results (candidate b792bf5, full 8-pair rerun, --retries=0)

| Suite | file:// | http://127.0.0.1:8642 |
| --- | --- | --- |
| Phase 3 checks incl. the new wrap assertions | 24 passed | 24 passed |
| Phase 1 regression (24 x 4) | 92 passed / 4 skipped (SM-03) | 96 passed |
| Phase 2 regression (7 x 4) | 28 passed | 28 passed |
| **Total** | **144 passed / 4 skipped / 0 failed** | **148 passed / 0 failed** |

Logs: `qa-artifacts/phase3remediation-matrix-fileorigin.log`, `qa-artifacts/phase3remediation-matrix-http.log` (both exit 0).

Wrap-mode evidence: P3-06 (including the wrap assertion, sampled lines after wrapped rows, and scroll-range parity) passed in all four browsers at both origins (matrix rows above). Retained last-writer evidence (Firefox http): wrap sampled drift 0.0px on every sampled line at wrap top/scrolled/window-resized, scroll ranges 1155px editor vs 1158px gutter over wrapped content; nowrap conditions all within 2.2px (Firefox intrinsic textarea inset, inside the 2.5px tolerance). Before-record: -260.6px @ line 40 retained from the pre-remediation run. Production launch origin remains the standing open coverage item.

---

# Addendum 2 — review remediation 2: linear gutter row-offset pass + large-document budgets (candidate 2cd8810)

## Finding

The revised review (`markdown-studio-phase-3-review.md`) accepted the soft-wrap remediation but held one new concern before final sign-off: `updateLineNumbers()` performed a `querySelector` per logical line on every editor input (quadratic overall), and QA's 40-line fixture measured nothing about large-document responsiveness. The reviewer asked to collect the spans once or measure and document performance on a representative large file.

## Fix (candidate 2cd8810)

Both: the wrap pass now collects the mirror spans once via `mirror.children` (element children are ordered 1:1 with the logical lines; text nodes between them are excluded by definition of `children`) and indexes them directly, making the pass linear. The per-line `data-ln` attributes (only needed for the removed lookups) were dropped, shrinking the mirror markup build as well.

## Measured performance (P3-06R, representative large file)

Fixture: 2000 mixed lines, every 5th paragraph-length (~3 soft-wrapped rows at 1280px), set via a single input event (page.fill stalls at this volume). Measured in-page against the app's live DOM: the app-equivalent row-offset pass with (a) the remediated children-array lookup and (b) the pre-remediation per-line querySelector, plus (c) the app's full synchronous input handler (gutter + statistics + markdown preview render + tab render + persistence).

| Measurement (median, 2000 lines) | Chromium-family | Firefox | Budget |
| --- | --- | --- | --- |
| (a) children-array pass | 10-14 ms | 14-26 ms | <= 40 ms |
| (b) per-line querySelector (pre-remediation) | 20 ms | 48 ms | comparison record |
| (c) end-to-end input handler | 35 ms | 49-63 ms | <= 120 ms |

The remediated lookup is ~2x faster than the pre-remediation strategy at 2000 lines, and the gap grows quadratically with document length. The full handler budget documents typing responsiveness on a 2000-line document; its larger share is the pre-existing markdown preview render, untouched by this phase. P3-06R passes in all four browsers at both origins; evidence in `qa-artifacts/PHASE3-P3-06R.evidence.json` (http run latest, file run in `qa-artifacts-fileorigin/`).

## Retest matrix (candidate 2cd8810, full rerun, --retries=0)

| Suite | file:// | http://127.0.0.1:8642 |
| --- | --- | --- |
| Phase 3 checks incl. P3-06 wrap assertions and P3-06R perf (7 tests x 4 browsers) | 28 passed | 28 passed |
| Phase 1 regression (24 x 4) | 92 passed / 4 skipped (SM-03) | 96 passed |
| Phase 2 regression (7 x 4) | 28 passed | 28 passed |
| **Total** | **148 passed / 4 skipped / 0 failed** | **152 passed / 0 failed** |

Logs: `qa-artifacts/phase3remediation2-matrix-fileorigin.log`, `qa-artifacts/phase3remediation2-matrix-http.log` (both exit 0). Wrap-alignment evidence from the P3-06 runs at this candidate remains 0.0px sampled drift. Production launch origin remains the standing open coverage item.
