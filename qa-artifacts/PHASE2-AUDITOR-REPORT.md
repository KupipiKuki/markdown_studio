# Phase 2 auditor report — QA/QC of the coder's Phase 2 work

Prepared for the independent reviewer. Handoff under audit: `markdown-studio-phase-2-handoff.md` (repo root).

## 1. Candidate identity (re-verified, not assumed)

| Pin from handoff | Expected | Actual | Match |
| --- | --- | --- | --- |
| Migration branch | `wp/studio_migration` | local tip `48fcd7a`; remote still `0efbc87` (Phase 2 commits not yet pushed) | yes |
| Phase 1 reviewed commit (implementation base) | `67341ba` / branch tip at handoff `0efbc87`, live blob `d59ab4b` | verified identical | yes |
| Phase 2 frozen candidate | (recorded in PHASE2-QA-RESULTS.md) | `e9ddc57e1f5110acafaf65e864cd03174351113f` | yes |
| Live file blob at candidate | (recorded) | `7b05e1515dcb41de2ab98ccaaef35479c4b67f58`, SHA-256 `7fd69d0128ba0045d0a6355deb0e6141efa85ad85bbca08dabad19961aea22be` | recorded |
| Changed files | candidate scope only | `scripts/markdown-studio.html` (+317/−14) and new `tests/phase2.spec.js`; nothing else (`git diff --stat 0efbc87 e9ddc57`) | yes |

## 2. Scope / boundary audit

- Boundary grep over the candidate diff: **no** lines touching `markflow_*`, `gemini_studio_*`, `BroadcastChannel`, CDN tags, slides, exports, print, gutter, or `lineNumbers` — result NONE.
- Phase 1 preservation confirmed two ways: (a) code — `getCardMermaidCode`, the `hasSource` empty-fence guard (P2 fix), `getMermaidSpans`/`replaceDiagramSource`, the error-card markup and `card.onclick` delegation appear intact in the candidate (11 marker hits, present as unchanged context in the diff); (b) tests — `tests/phase1.spec.js` is untouched by the candidate and reruns fully green against it (P2-08, see §4).
- `git status` clean at audit time; spot reproduction ran against the committed tree.

## 3. Finding-by-finding verdicts (code audit + QA evidence)

| Finding | Coder verdict | Auditor verdict | Basis |
| --- | --- | --- | --- |
| R06 label typography | CHANGED | CONFIRMED | Scoped `foreignObject` resets (`.mermaid-canvas`, `#builderDiagramCanvas`): line-height, box-sizing, margin/padding zeroing, transparent inheriting `code`. P2-01: computed label font-family contains Inter, margins/padding 0px at normal and narrow widths, sequence text typography too, all 8 pairs |
| R07 tall/wide fitting | CHANGED | CONFIRMED | Intrinsic dims from viewBox/attrs/bbox/rect captured at render; fit scale = min ratios capped at 1; initial zoom = fit; refit on split-resizer drag, dblclick, window resize, and view-mode changes (all funnel through `requestRefitAllDiagrams`); zoom-reset returns to fit. P2-02: tall 13-node and wide diagrams fit within viewport after initial render, resizer drag, and window resize, no runaway scale, all 8 pairs |
| R07/P2-03 zoom retention | CHANGED (beyond reference) | CONFIRMED, with note | The audited reference stored manual state only on the rebuilt viewport element, which a preview re-parse destroys; the candidate adds `window._diagramInteractionMemory` keyed by tab id + diagram index + source-code fingerprint, so unrelated edits preserve manual zoom/pan while editing the diagram itself resets to fit. P2-03 verifies exact zoom/pan retention across rerender and window-resize refit, all 8 pairs |
| R08 theme isolation | CHANGED | CONFIRMED | `initMermaid(document theme)` enforced at the head of every preview render pass; `closeStudio` restores the document theme. P2-04: builder Forest theme visibly differs, does not leak after close (preview fill returns to document theme), document theme toggle restyles both diagrams and a normal markdown control (h1 color), all 8 pairs |
| R09 listener lifecycle | ALREADY SATISFIED | CONFIRMED (no change needed) | Live already registers window pan listeners once (`window._diagramListenersAttached`) and assigns per-card handlers via properties; the diff does not touch that block. Differential evidence P2-05: 50 render/edit/tab/viewer-toggle cycles, patched `addEventListener` counter shows zero new window-listener registrations, single exact pan response, no console/page errors, all 8 pairs |
| R15 stale renders | CHANGED | CONFIRMED | Preview: per-pass generation + active-tab snapshot + `card.isConnected` checks after every await; interactivity wiring gated on current generation. Builder: session generation + modal-open check, invalidated on open/close. P2-06 (delayed render vs newer edit and vs tab switch — newest always wins) and P2-07 (builder superseded edit, stale error badge, close-mid-render leaves canvas byte-identical), all 8 pairs |

## 4. QA/QC matrix (frozen candidate e9ddc57)

Environments: Windows 11 x64; Playwright 1.65.1 headless; Chromium 159.0.8154.6, Microsoft Edge 159.0.8154.6 (channel `msedge`), Google Chrome 159.0.8154.6 (channel `chrome`), Firefox 159.0. Origins: `file:///C:/Git/markdown_studio/scripts/markdown-studio.html` and `http://127.0.0.1:8642/scripts/markdown-studio.html` (python http.server at repo root). Fresh browser context per test; no storage cleared or rewritten.

| Suite (per handoff) | file:// | http:// |
| --- | --- | --- |
| P2-01..P2-07 (`tests/phase2.spec.js`, 7 × 4 browsers) | 28 passed | 28 passed |
| P2-08 Phase 1 regression (`tests/phase1.spec.js`, 24 × 4 browsers) | 92 passed / 4 skipped (SM-03 by design on file://) | 96 passed |
| P2-09 workflow smoke (SM-01..SM-05 within the Phase 1 suite) | included above | included above |
| **Total** | **120 passed / 4 skipped / 0 failed** | **124 passed / 0 failed** |

Independent reproduction spot-check after freezing: re-ran `tests/phase2.spec.js` on chromium + firefox against the committed tree — 14/14 passed. One intermediate http run showed 4 failures that were solely the pre-existing favicon 404 console line (repo ships no favicon) tripping a strict test assertion on Edge/Chrome; the assertion now records it as noise and the rerun is fully green. No functional failure occurred in any pair at any point.

Evidence: `qa-artifacts/PHASE2-QA-RESULTS.md` (change map + matrix + repro commands), `qa-artifacts/PHASE2-P2-*.evidence.json` + `PHASE2-P2-*_<browser>_*.png` (http run in `qa-artifacts/`, file run in `qa-artifacts-fileorigin/`), Phase 1 evidence likewise retained.

## 5. Residual risks / open items

1. Production launch URL still unestablished — launch-origin coverage remains OPEN for both phases until it is supplied and exercised. Owner: QA.
2. Carried from Phase 1, unchanged: slide/presentation render path may still blank empty fences inside slides (later-phase backlog); list-item repair drops list indentation on code lines (inherited from audited reference, Mermaid-neutral); Firefox print/PDF limitation deferred; gutter drift deferred.
3. `window._diagramInteractionMemory` is per-session (not persisted) by design; memory entries are dropped when a diagram's source changes.

## 6. Exit-gate assessment

| Gate item (Phase 2 handoff) | Status |
| --- | --- |
| Candidate frozen with SHA + changed-file list | MET (`e9ddc57`; 2 files) |
| Change map complete (changed / already satisfied / deferred with locations) | MET (`PHASE2-QA-RESULTS.md` §change map; R09 reported already satisfied with evidence) |
| R06–R08 and R15 pass applicable checks | MET (P2-01..P2-04, P2-06, P2-07 green in all 8 pairs) |
| R09 demonstrated safe or fixed+retested | MET (demonstrated safe; unchanged; P2-05 green) |
| Phase 1 regressions pass | MET (P2-08) |
| All browser/origin gaps recorded | MET for Chromium/Edge/Chrome/Firefox on file:// and localhost http; production origin recorded as OPEN |
| No merge / rollout | MET (nothing pushed; `main` untouched) |

## 7. Recommendation

Phase 2 is ready for the independent review decision on candidate `e9ddc57`. Recommend recording a Phase 2 pass with the production-launch-URL item kept open across phases. Do not start Phase 3 until the decision is recorded and the branch is pushed for review.
