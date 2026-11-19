# Phase 2 QA/QC results and change map

Frozen candidate under test:

- Branch: `wp/studio_migration`
- Commit: `4c2701a8fa6dadaf7a8a1e03460b1b72e1bbb80b` ("P2 fix: invalidate pending builder renders on empty input")
- Live file: `scripts/markdown-studio.html`, git blob `4623d798d35dcf30961504e2a9206eb67c002a14`
- Implementation base (per Phase 2 handoff pins, re-verified before coding): tip `0efbc87`, live blob at reviewed Phase 1 candidate `d59ab4b` (`67341ba`)
- Changed files: `scripts/markdown-studio.html` (307 additions / 14 deletions vs base) and new `tests/phase2.spec.js`

## Candidate history (QA freeze log)

1. `e9ddc57` — original Phase 2 candidate (R06/R07/R08/R15 + P2-01..P2-07). App-script diff vs base: **303 additions / 14 deletions** (corrected per the auditor's review; earlier drafts of this report and the auditor report listed inconsistent counts). Full matrix run: file:// 120 passed / 4 skips; http:// 124 passed. Superseded by the builder empty-input fix below.
2. `4c2701a` — auditor P2 remediation: `renderBuilderDiagram` advances `studioRenderGeneration` at the top of every pass, including the empty-input path, so a delayed render in flight when the builder is cleared can never restore stale output. P2-07 extended with that exact case (slow render → clear → wait out delay → empty state remains). **Current frozen candidate.** Retest results below are for this commit.

## Change map (handoff finding -> verdict -> live location)

| Finding | Verdict | Live location (candidate) | Notes |
| --- | --- | --- | --- |
| R06 SVG label typography | CHANGED | CSS ~l.1000-1033 | Scoped `foreignObject` resets (`line-height`, `box-sizing`, `margin/padding:0` on p/div/span, `code` transparent/inherit) for `.mermaid-canvas` and `#builderDiagramCanvas` only; Mermaid `fontFamily` (Inter) already set at init. |
| R07 tall/wide fitting | CHANGED | `getSvgIntrinsicDimensions` / `computeDiagramFitScale` / `refitAllDiagrams` / `requestRefitAllDiagrams` (~l.2995-3110); render loop intrinsic-dimension capture (~l.2926); `setupPreviewDiagramInteractivity` fit math; builder fit in `renderBuilderDiagram` (~l.4680); refit hooks: split-resizer drag/mouseup/dblclick (~l.4100), window `resize` listener, `setPaneVisibility` | Initial zoom = fit scale, wheel/button clamps use `min(0.05, fit*0.5)`..5, zoom-reset returns to fit, refits skip manually-adjusted viewports. Beyond the audited reference (required by P2-03): manual zoom/pan memory is kept in a per-document map (`window._diagramInteractionMemory`) keyed by tab id + diagram index + source code fingerprint, so unrelated text edits that rebuild the preview DOM no longer reset deliberate interaction, while editing the diagram itself returns it to fit. |
| R08 theme isolation | CHANGED | `renderAllPreviewDiagrams` head (initMermaid(theme) per pass); `closeStudio` (restores `initMermaid(getMermaidTheme())`; also bumps builder generation) | Live already re-rendered diagrams on document theme toggle (`applyTheme` calls `initMermaid()` + rerender). The new guards prevent the builder's custom theme from leaking into preview renders and restore the document theme on Studio close. |
| R09 listener lifecycle | ALREADY SATISFIED (no change) | `setupPreviewDiagramInteractivity` (~l.3135) | Differential validation: live registers window mousemove/mouseup once (`window._diagramListenersAttached`) and assigns per-card handlers via properties, so repeated renders cannot accumulate. P2-05 (50 render/edit/tab/toggle cycles + patched `addEventListener` counter) demonstrates zero new window-listener registrations and exact pan/pan-delta response. |
| R15 stale async renders | CHANGED | Preview: `previewRenderGeneration` + `isCurrent()` (tab snapshot + generation) + `card.isConnected` checks in both success/error paths; handler wiring gated on current generation. Builder: `studioRenderGeneration` + `isStudioCurrent()` (modal open + generation) with checks after parse/render/error; generation bumped on `openStudioWithCode` and `closeStudio` | Both flows ported from the audited reference behavior with the generation scoped to each target. |

Constraints audit: no changes to `markflow_*` / `gemini_studio_*` keys, `BroadcastChannel`, slide/presentation path, exports, print, gutter, or CDN tags (grep of the candidate diff). Slide rendering untouched.

## QA matrix (candidate `4c2701a`)

Environments: Windows 11 x64; Playwright 1.65.1 headless; Chromium 159.0.8154.6, Edge 159 (channel), Chrome 159 (channel), Firefox 159. Origins: `file:///C:/Git/markdown_studio/scripts/markdown-studio.html` and `http://127.0.0.1:8642/scripts/markdown-studio.html`. Fresh context per test; no storage clearing.

| Suite | file:// | http://127.0.0.1:8642 |
| --- | --- | --- |
| Phase 2 checks (P2-01..P2-07, 7 tests × 4 browsers) | 28 passed | 28 passed |
| P2-08 Phase 1 regression (`tests/phase1.spec.js`, 24 tests × 4 browsers) | 92 passed / 4 skipped (SM-03 origin-dependent skips) | 96 passed |
| **Total** | **120 passed / 4 skipped / 0 failed** | **124 passed / 0 failed** |

The 4 skips are the by-design SM-03 file-origin skips (BroadcastChannel requires a shared http origin). The first http run surfaced 4 failures that were all the pre-existing benign favicon 404 console line on Edge/Chrome caught by an overly strict test assertion; the assertion now records it as noise (samples retained in evidence JSONs) and the rerun is fully green with zero functional failures.

### Per-check evidence highlights

- P2-01: foreignObject labels computed `font-family` includes Inter, margin/padding 0px at normal and narrow widths; screenshots per browser.
- P2-02: tall (13-node) and wide diagrams render at fit scale (<=1.0) with scaled SVG within viewport bounds; split-resizer drag and window resize recalculate fit without clipping or runaway scale.
- P2-03: after wheel-zoom + drag-pan, an unrelated text edit and a window resize keep the exact manual zoom/pan (dataset + transform verified); refits skip the card.
- P2-04: builder Forest theme visibly differs from the document theme, does not leak after Studio close (preview fill returns to the document-theme fill), and document theme toggle restyles diagrams and the normal preview control (h1 color).
- P2-05 (R09): 50 cycles — zero new window-listener registrations, zero console/page errors until first assertion, pan delta exact (50,20 within 2px).
- P2-06: delayed (2.5s) render finishes after a newer edit and after a tab switch; only the newest document/source is displayed in both races.
- P2-07: slow builder render superseded by a quick edit shows only the newest diagram; stale error badge cannot overwrite a newer valid render; closing mid-render leaves the builder canvas byte-identical; and (auditor P2 case) clearing the builder mid-render leaves the "Empty diagram" state intact after the delayed render completes — `emptyStateSurvivesMidRenderClear` is true in the P2-07 evidence JSONs. Evidence JSON files record the last concurrent writer per label per run; per-browser pass/fail is the matrix result rows above.

Evidence: `qa-artifacts/PHASE2-*.evidence.json` and `qa-artifacts/PHASE2-P2-*_<browser>_*.png` (http run latest in `qa-artifacts/`, file run in `qa-artifacts-fileorigin/`).

## Reproduction

```bash
git checkout 4c2701a
npm ci
npx playwright test tests/phase2.spec.js tests/phase1.spec.js --project=chromium --project="Microsoft Edge" --project="Google Chrome" --project=firefox
# http origin variant:
python -m http.server 8642   # repo root
P1_BASE_URL=http://127.0.0.1:8642/scripts/markdown-studio.html npx playwright test ...
```

## Open items

- Production launch URL remains unestablished (Phase 1 and Phase 2 handoffs): launch-origin coverage stays open until it is supplied and exercised.
- Known deferred (per handoff): editor gutter, export/clipboard/PNG, print/PDF, slide-path behaviors, Firefox print limitation.

## Exit gate status

Candidate frozen (`4c2701a`), change map complete, R06-R08 and R15 pass all applicable checks (P2-01 through P2-07, including the auditor's empty-input stale-render case), R09 demonstrated already satisfied by differential test, Phase 1 regression suite fully green (P2-08), live workflow smoke green (P2-09, via SM-01..SM-05), and browser/origin coverage recorded for Chromium/Edge/Chrome/Firefox on file:// and localhost HTTP — with the production origin explicitly open.
