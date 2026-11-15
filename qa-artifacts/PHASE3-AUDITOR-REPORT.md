# Phase 3 auditor report — QA/QC of the coder's Phase 3 work

Prepared for the independent reviewer. Handoff under audit: `markdown-studio-phase-3-handoff.md` (repo root).

## 1. Candidate identity (re-verified, not assumed)

| Pin from handoff | Expected | Actual | Match |
| --- | --- | --- | --- |
| Migration branch | `wp/studio_migration` | local tip `d8d722a`; remote still `c25154a` (Phase 3 commits not yet pushed) | yes |
| Implementation base (handoff tip / Phase 2 accepted) | tip `c25154a`, live blob `4623d798` | `c25154a67e82ca51c76377f0f29688f8a85e8a85d3172`, blob `4623d798d35dcf30961504e2a9206eb67c002a14` re-hashed from the tree — identical | yes |
| Phase 2 accepted candidate | `4c2701a` | `4c2701a8fa6dadaf7a8a1e03460b1b72e1bbb80b` | yes |
| Phase 3 frozen candidate | (recorded in PHASE3-QA-RESULTS.md) | `921e60c91a4c960ce4e4c160bb0a4ffafbe7198a` ("Stage 3 (Phase 3): …") | yes |
| Live file blob at candidate | (recorded) | `a250ede3571d718cf9a16782d664c430ea7d280e`, SHA-256 `c0b73a267eff1e5353694bbbc90a72900ecaa40ab75e14c61fe9b66eb36c5933` | recorded |
| Changed files | candidate scope only | `scripts/markdown-studio.html` (**65 additions / 14 deletions** vs base 4c2701a) and new `tests/phase3.spec.js` (484/0); evidence/report commit `d8d722a` adds QA artifacts only (`git diff --numstat 4c2701a 921e60c -- scripts tests`) | yes |

Freeze discipline: the app script was frozen in `921e60c` and **not modified afterwards** — all post-freeze iteration touched only `tests/phase3.spec.js` and QA artifacts (blob `a250ede3` identical at `d8d722a`). The spec changes were harness fixes (see §4 notes), not app changes.

## 2. Scope / boundary audit

- Boundary grep over the candidate diff (`git diff 4c2701a..921e60c -- scripts/markdown-studio.html`, added lines): **no** hits for export/print/PNG/SVG/standalone, `markflow_*`, `gemini_studio_*`, `BroadcastChannel`, `localStorage`/`sessionStorage`, CDN tags, slide/presentation identifiers — result NONE. Six hunks total, all in the five intended regions: `.line-numbers` CSS (~l.602), `wrapSelection`/`insertSnippet` (~l.3981), toolbar image case (~l.4050), palette click handler (~l.4703), document keydown handler (~l.5375 + dead-code removal ~l.5436).
- Phase 1/2 preservation confirmed two ways: (a) code — no parser/Mermaid/storage/transfer/slide code in the diff; (b) tests — `tests/phase1.spec.js` and `tests/phase2.spec.js` untouched by the candidate and rerun fully green against it (P3-07, §4).
- `git status` clean at audit time; the worktree used for the gutter negative control (`ms-p3-baseline` at `4c2701a`) was removed after the reproduction.

## 3. Finding-by-finding verdicts (code audit + QA evidence)

| Finding | Coder verdict | Auditor verdict | Basis |
| --- | --- | --- | --- |
| R10 empty-selection fallback | CHANGED | CONFIRMED | `wrapSelection()` no longer has `\|\| 'text'`; empty selection inserts `before+after` at the caret with caret at `start+before.length`; selection case unchanged (selection wrapped and kept). `insertSnippet()` added for snippet actions. P3-01/P3-02: exact value+caret assertions (e.g. `****Hello World Line` caret 2, `Para\n\n---\n\n` caret 11, code-block caret 17; bold over `GONE` keeps selection 17–21), no literal `text` anywhere, all 8 pairs |
| R11 image action concatenation | CHANGED | CONFIRMED | Image case ported from the audited reference: alt = selection or `Alt text`; `insertSnippet(`![${alt}](${url})`)` replaces the selection, caret at snippet end. P3-03: caret insertion gives `![Alt text](url)`; selection `my screenshot` gives `![my screenshot](url)`; `texthttps` asserted absent; link action unchanged — all 8 pairs |
| R12 palette literal `\n` | CHANGED | CONFIRMED | Palette handler decodes `\\n`/`\\t` in `data-insert` on insertion; P3-04 asserts the Subgraph Box decodes to real newlines (`…[Group Title]\n    node1\n    node2\n  end\n`), no literal `\n` remains, Rect/arrow insert verbatim, the Node Styling literal passes through byte-exact, and a palette-built subgraph diagram still renders — all 8 pairs |
| Global shortcut guard | CHANGED | CONFIRMED | Document keydown: Escape branch first (closes Studio/fs/table/find bar/error log in every context), then early return when focus is in an open overlay (`.modal-overlay.open`, `.cmd-palette-overlay.open`, `.find-replace-bar.show`) or in any INPUT/TEXTAREA/SELECT/contentEditable that is not the main editor. Matches the audited reference; strictly stricter for in-overlay focus (reference blocked only on studio-open state or other inputs). P3-05: Ctrl+B/Ctrl+I in builder/find/replace/palette inputs never mutate the background document; Ctrl+B on an in-Studio button is blocked; Escape dismisses Studio, find bar and palette from all those states; editor-focused Ctrl+B/Ctrl+F still work — all 8 pairs |
| Gutter alignment (reproduce-first) | REPRODUCED, THEN FIXED | CONFIRMED | Reproduction on base `4c2701a` (worktree, spec negative control failed at 3.8px @ line 5; diagnostic record: 0.8px/line accumulated, **-31.8px @ line 40**, gutter pitch 20.8px vs editor 21.6px, and gutter `scrollHeight` shorter so deep-scroll positions cannot track). Conditional one-line fix: `.line-numbers` font-size 13px → 13.5px (same family/line-height/padding). Post-fix: pitch 21.6 = 21.6, `scrollHeight` equal (896 = 896), drift ≤ 1.2px Chromium-family / ≤ 2.2px constant Firefox textarea inset, across nowrap top / scrolled / window-resized / split-dragged (P3-06, tolerance 2.5px, all 8 pairs). Wrap-mode soft-wrap drift is inherent to one-number-per-logical-line gutters and is recorded unasserted in the wrap-top evidence |

Gutter before/after measurement record: `qa-artifacts/PHASE3-P3-06-gutter-before-after.json` (diagnostics `qa-artifacts/phase3-gutter-measure.js`, Firefox inset `qa-artifacts/ffmeasure.js`); conditions cover viewport 1280×900, wrap off/on, scroll sync (async programmatic `scroll` event — settle 300ms), window resize to 900×700, and split-resizer drag.

## 4. QA/QC matrix (frozen candidate 921e60c)

Environments: Windows 11 x64; Playwright 1.65.1 headless; Chromium 159, Microsoft Edge 159 (channel `msedge`), Google Chrome 159 (channel `chrome`), Firefox 159. Origins: `file:///C:/Git/markdown_studio/scripts/markdown-studio.html` and `http://127.0.0.1:8642/scripts/markdown-studio.html` (python http.server at repo root). Fresh browser context per test; no storage cleared or rewritten; runs with `--retries=0` (no failure was retried away).

| Suite (per handoff) | file:// | http:// |
| --- | --- | --- |
| P3-01..P3-06 (`tests/phase3.spec.js`, 6 × 4 browsers) | 24 passed | 24 passed |
| P3-07 Phase 1 regression (`tests/phase1.spec.js`, 24 × 4) | 92 passed / 4 skipped (SM-03 by design on file://) | 96 passed |
| P3-07 Phase 2 regression (`tests/phase2.spec.js`, 7 × 4) | 28 passed | 28 passed |
| P3-08 workflow smoke (SM-01..SM-05, carried inside the Phase 1 suite; tabs, save/reload, command palette, cross-Studio transfer where same-origin, storage untouched) | included above | included above |
| **Total** | **144 passed / 4 skipped / 0 failed** | **148 passed / 0 failed** |

Logs: `qa-artifacts/phase3-matrix-fileorigin.log`, `qa-artifacts/phase3-matrix-http.log` (both exit 0). Independent spot reproduction after freezing: `tests/phase3.spec.js` rerun on chromium + firefox against the committed tree `d8d722a` — **12/12 passed**. One early pre-freeze iteration failed only on spec-harness issues (click racing the async render wiring, async programmatic scroll, one wrong expected value, Firefox focus semantics); all fixed in the spec with the app blob untouched, and the final runs above are fully green with zero functional failures in any pair.

Evidence: `qa-artifacts/PHASE3-QA-RESULTS.md` (change map + matrix + repro commands), `qa-artifacts/PHASE3-P3-0*.evidence.json` + gutter PNGs and before/after JSON (http run in `qa-artifacts/`, file run preserved in `qa-artifacts-fileorigin/`), Phase 1/2 evidence refreshed by the regression matrix.

## 5. Residual risks / open items

1. Production launch URL still unestablished — launch-origin coverage remains OPEN across all phases until supplied and exercised. Owner: QA.
2. Carried from earlier phases, unchanged: slide/presentation empty-fence blanking (later-phase backlog); list-item repair drops list indentation on code lines (inherited from the audited reference); Firefox print/PDF limitation deferred.
3. Wrap-mode gutter drift (soft-wrapped rows carry one number per logical line) is inherent and recorded as evidence, not a defect fixed — flag if product wants per-visual-row numbering (out of Phase 3 scope).
4. Per-check evidence JSONs hold the last concurrent writer per label per run; per-browser pass/fail is authoritative in the matrix rows/logs.

## 6. Exit-gate assessment

| Gate item (Phase 3 handoff) | Status |
| --- | --- |
| Candidate + source hash frozen | MET (`921e60c`, blob `a250ede3`, SHA-256 recorded) |
| Change map complete (changed / already satisfied / deferred with locations) | MET (`PHASE3-QA-RESULTS.md`; R10/R11/R12/guard changed, gutter reproduced-then-fixed) |
| R10–R12 and shortcut checks pass | MET (P3-01..P3-05 green in all 8 pairs) |
| Gutter fixed-and-verified or shown not to reproduce | MET (reproduced on base, fixed, P3-06 green in all 8 pairs; before/after record retained) |
| Phase 1/2 regressions pass | MET (P3-07 rows above) |
| Adjacent workflow smoke | MET (P3-08 via SM-01..SM-05, included in the Phase 1 suite rows) |
| Every browser/origin result recorded | MET for Chromium/Edge/Chrome/Firefox on file:// and localhost http; production origin recorded as OPEN |
| No merge / rollout | MET (nothing pushed; remote `c25154a`; `main` untouched) |

## 7. Recommendation

Phase 3 is ready for the independent review decision on candidate `921e60c` (evidence commit `d8d722a`). Recommend recording a Phase 3 pass with the production-launch-URL item kept open across phases.
