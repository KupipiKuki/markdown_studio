# Markdown Studio migration — Phase 2 handoff

Prepared November 14, 2026  
Audience: implementation coder and QA/QC  
Status: ready for Phase 2 implementation planning; no Phase 2 application changes have been made.

## Objective

Port the next focused set of diagram display and lifecycle behaviors into the live Markdown Studio while preserving the reviewed Phase 1 source-preservation and parser fixes. Phase 2 covers label typography, diagram fitting, document-theme isolation, listener lifecycle, and stale asynchronous render protection.

## Pinned references

- **Migration branch:** [`wp/studio_migration`](https://github.com/KupipiKuki/markdown_studio/tree/wp/studio_migration)
- **Current branch tip at handoff:** `0efbc8756d3ada463a6417fbd5eafb2de9219beb`
- **Phase 1 reviewed implementation commit:** `67341bacd7225c473f3ea4d254c24886e6fd6d8e`
- **Live script blob at that candidate:** `d59ab4bee1eb90720a47dffcce1f26d3422285e5` (SHA-256 `53b1a965f9ce8bd85a15d3452dd59fc655b0bb195dae4fdee74cc8ae577fa4b8`)
- **Audited behavior reference:** `c0da234d3640976e75c6cefe4c3353c9632f8e86`, [`Phase 6 code diff report`](https://github.com/KupipiKuki/markdown_studio/blob/c0da234d3640976e75c6cefe4c3353c9632f8e86/markdown_studio_phase_0/reports/code_diff_report.md)
- **Phase 1 QA evidence:** [`QA results`](https://github.com/KupipiKuki/markdown_studio/blob/wp/studio_migration/qa-artifacts/PHASE1-QA-RESULTS.md) · [`remediation QA/QC`](https://github.com/KupipiKuki/markdown_studio/blob/wp/studio_migration/qa-artifacts/PHASE1-REMEDIATION-QAQC.md)

Before coding, confirm the branch tip and live-file blob again; branch activity may have advanced since this handoff was prepared. Record the exact implementation base and candidate commit in the Phase 2 QA report.

## Phase 1 baseline to preserve

The Phase 1 remediation candidate has been pushed and reviewed. Its QA matrix reports 24 checks per browser at each of two origins: `file://` had 92 passed and 4 origin-dependent skips; localhost HTTP had 96 passed and no failures. Phase 2 must retain the Phase 1 Mermaid source preservation, parser-consistent source mapping, and empty/whitespace source validation behavior, including P1-04b and P2-01 through P2-05 coverage.

The live production launch URL is still unknown. The existing origin results do not establish coverage for that URL; QA should keep launch-origin coverage open until the supported launch URL(s) are supplied and exercised.

## Scope and implementation guidance

| Finding | Phase 2 intent | Live-source assessment / coder direction |
| --- | --- | --- |
| R06 | Mermaid SVG label typography | Compare labels rendered through SVG `foreignObject` with the intended Studio typography. Port only the relevant, scoped style behavior. |
| R07 | Fit tall and wide diagrams to the available viewport | Add or adapt intrinsic SVG dimension measurement and fit-scale calculation where live behavior lacks it. Refit after pane size changes without disrupting deliberate user zoom. |
| R08 | Keep document themes isolated from diagram styling | Verify theme application and reapplication on preview rerender. Scope Mermaid styles so switching document themes does not leak or corrupt diagram styling. |
| R09 | Avoid duplicate diagram pan/zoom listeners | **Differential validation first.** The live script already uses `window._diagramListenersAttached` for one-time global pan listener registration. Preserve it if repeated render/initialization is already safe; change only if QA demonstrates a lifecycle defect. |
| R15 | Prevent stale asynchronous diagram renders from overwriting newer state | Add render-generation invalidation to preview and Studio/builder flows where async completion can land after a newer render or document switch. Keep the generation scoped to the relevant render target. |

The audited candidate contains behaviors such as `getSvgIntrinsicDimensions`, `computeDiagramFitScale`, `refitAllDiagrams`, and render-generation guards. Treat those as a behavior reference, not a patch to apply wholesale: it was produced against a different baseline. The current live script did not contain those named helpers/guards in the prior inspection. Verify against the pinned branch source before implementation.

### Boundaries

- Keep Phase 1 empty Mermaid source handling and all source-span mapping fixes intact.
- Do not mix in editor gutter/shortcut/insert behavior, export/clipboard/PNG, print/PDF, or broad refactors.
- Preserve saved-tab and preference storage keys, cross-Studio transfer contracts, existing Mermaid dependency versions, and live-only controls.
- Do not change presentation/slide rendering unless a shared helper requires it; if touched, add explicit regression coverage for that path.
- Do not clear or rewrite browser storage to make QA pass; use isolated profiles and fixtures.

## Coder deliverables

- Focused changes for R06–R08 and R15, plus R09 only if differential testing finds a defect.
- A change map listing each finding as changed, already satisfied, or deferred, with live source locations and rationale.
- A frozen candidate commit SHA, changed-file list, concise reproduction notes, and QA-ready fixture set.
- No merge or production rollout as part of the handoff.

## QA/QC plan

Test one frozen candidate and record its full SHA, live script hash, browser/version, launch URL and origin, fixture ID, expected/actual result, console errors, and evidence path for each run. Reuse the installed Playwright setup and retain machine-readable results plus screenshots/video where useful.

| ID | Check | Pass evidence |
| --- | --- | --- |
| P2-01 | SVG label typography | Representative flowchart and sequence labels remain legible and match intended Studio typography at normal and narrow preview widths. Capture screenshots. |
| P2-02 | Tall/wide fitting | Tall and wide diagrams fit the preview viewport; changing split-pane width and resizing the window recalculates fit without clipping or runaway scale. |
| P2-03 | User zoom retention | After auto-fit, manual zoom/pan remains usable and is not unexpectedly reset by unrelated edits or refits. |
| P2-04 | Theme isolation | Switch document themes and rerender diagrams; document colors update while SVG labels/background remain readable and scoped. Include a normal markdown preview control. |
| P2-05 | Listener lifecycle | Repeatedly render, edit, switch tabs, and reopen preview (at least 50 cycles). Pan/zoom produces one response per gesture; no duplicate handlers or console errors. Report R09 as already satisfied if live behavior passes. |
| P2-06 | Preview stale-render race | Delay an earlier render, make a newer edit or switch documents, then release the earlier render. Only the newest document/source may be displayed. |
| P2-07 | Studio/builder stale-render race | Repeat the race for the Studio/builder render flow. Confirm stale errors and completion callbacks cannot overwrite the latest state. |
| P2-08 | Phase 1 regression | Rerun Phase 1 source-preservation, fence/source mapping, empty/whitespace Mermaid, repair, and error-action checks against the Phase 2 candidate. |
| P2-09 | Live workflow smoke | Check reload/persistence, tab switching, command palette, and cross-Studio transfer where available; retain output and console evidence. |

Run in Chromium, Edge, Chrome, and Firefox on each confirmed supported launch origin. Include the established `file://` and localhost HTTP baselines for comparison where available; do not substitute those for the actual production launch origin. Mark unavailable browser/origin pairs blocked with reason and risk rather than passed. The production launch URL is an open dependency for full launch acceptance.

## Exit gate

Phase 2 is ready for review when the candidate is frozen, the change map is complete, R06–R08 and R15 pass their applicable checks, R09 is either demonstrated safe or fixed and retested, Phase 1 regressions pass, and all browser/origin gaps are explicitly recorded. Do not declare launch-origin coverage complete until the actual supported URL has been tested.

## Not performed in this handoff

No application code was changed, and no tests were run. This document prepares the coder and QA/QC work for Phase 2.
