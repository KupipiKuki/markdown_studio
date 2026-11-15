# Markdown Studio migration — Phase 3 handoff

Prepared November 15, 2026  
Audience: implementation coder and QA/QC  
Status: ready for Phase 3 implementation; no application code or tests changed in preparing this handoff.

## Objective

Port the editor action and keyboard safety fixes into the live Markdown Studio. Reproduce the reported line-number gutter issue against the current script, then either fix it within this phase or document with evidence that the current behavior already meets the requirement.

Phase 3 covers migration findings R10–R12, the global shortcut guard, and a conditional gutter correction. Export, print, and diagram-file export findings R13–R14 remain Phase 4 work.

## Pinned references

- **Migration branch:** [`wp/studio_migration`](https://github.com/KupipiKuki/markdown_studio/tree/wp/studio_migration)
- **Branch tip when prepared:** `c25154a67e82ca51c76377f0f29688f8a85d3172`
- **Accepted Phase 2 frozen code candidate:** `4c2701a8fa6dadaf7a8a1e03460b1b72e1bbb80b`
- **Live entry point:** `scripts/markdown-studio.html`
- **Current live-file blob:** `4623d798d35dcf30961504e2a9206eb67c002a14` (confirmed at the branch tip above)
- **Phase 2 QA results:** [`PHASE2-QA-RESULTS.md`](https://github.com/KupipiKuki/markdown_studio/blob/wp/studio_migration/qa-artifacts/PHASE2-QA-RESULTS.md)
- **Phase 2 remediation QA/QC:** [`PHASE2-REMEDIATION-QAQC.md`](https://github.com/KupipiKuki/markdown_studio/blob/wp/studio_migration/qa-artifacts/PHASE2-REMEDIATION-QAQC.md)
- **Audited behavior map:** [`Phase 6 code diff report`](https://github.com/KupipiKuki/markdown_studio/blob/c0da234d3640976e75c6cefe4c3353c9632f8e86/markdown_studio_phase_0/reports/code_diff_report.md)

The branch and file blob are frozen references for this handoff, not assumptions about the next coding checkout. Before editing, re-read the remote branch head and live-file blob, verify Phase 2 remains present, and record the exact Phase 3 implementation base and candidate SHA.

## Baseline to preserve

Phase 1 and Phase 2 have been reviewed. Phase 2's accepted code candidate includes its empty-input stale-render remediation. Preserve the Mermaid source/parser fixes, render-generation guards, diagram fitting, zoom memory, theme isolation, and listener behavior. The Phase 2 QA report records all required checks passing on `file://` and localhost HTTP across Chromium, Edge, Chrome, and Firefox. The production launch URL remains unidentified, so launch-origin coverage remains open.

Keep the current persistence and transfer contracts unchanged: `markflow_editor_state_v2`, `markflow_view_mode_v2`, `markflow_viewer_full_width`, `markflow_theme`, `BroadcastChannel('gemini_studio_bus')`, and `gemini_studio_transfer_queue_v1`.

## Scope and coding direction

| Finding | Intended behavior | Implementation guidance |
| --- | --- | --- |
| R10 | Snippet/divider/template insertion places the intended text at the caret or replaces the selected text without stray literal text. | Review `wrapSelection()` and `insertSnippet()` in the live source. Remove the empty-selection fallback that inserts literal `text` only if it is still present; preserve selection replacement and correct caret positioning. |
| R11 | Ribbon image action creates a valid Markdown image link. | Check URL construction with no selection and with selected alt text. Prevent accidental concatenation such as `texthttps://…`; preserve normal Markdown escaping and the existing insertion behavior. |
| R12 | Studio palette items decode escaped newline sequences into actual newlines on insertion. | Verify the source `data-insert` value, decoding, and insertion position. Avoid double-decoding or changing unrelated backslash sequences. |
| Shortcut guard | Global editor-mutating shortcuts do not act on the background document while a text field or dialog is being used. Escape must still close/dismiss the active modal or palette as designed. | Identify the actual global shortcuts in the current source. Guard typing contexts including `#builderCodeInput`, `#findInput`, `#replaceInput`, and other editable controls; test buttons and modal focus as well. |
| Gutter alignment | Line numbers stay aligned with visible editor rows, including soft wraps. | Reproduce before changing code. The migration plan notes that the live editor already synchronizes gutter `scrollTop`; the remaining risk is row geometry because the editor wraps while the gutter emits one number per logical line and uses a slightly different font size. Port a focused fix only if the baseline demonstrates drift. |

The Phase 6 diff report is a behavior reference. Do not apply its broad patch to this live script. Preserve live-only controls and workflows; make small changes against the re-verified Phase 2 source.

### Boundaries

- Do not include export/copy/standalone HTML/print/PNG/SVG work from R13–R14.
- Do not refactor the editor, storage layer, parser, Mermaid initialization, or unrelated keyboard handling.
- Do not alter persistence keys, transfer queue shape, BroadcastChannel behavior, CDN dependency versions, or slide/presentation behavior.
- Do not clear or rewrite browser storage for testing; use isolated contexts and synthetic documents.
- If a shared editor helper affects another control, add a specific regression check for that workflow.

## Coder deliverables

- Focused Phase 3 code changes for R10–R12 and shortcut guarding; gutter changes only if reproduction confirms a defect.
- A change map identifying each item as changed, already satisfied, or deferred, with source locations and rationale.
- A concise before/after gutter reproduction record, including viewport, wrap, sync, and resize conditions.
- A frozen candidate commit SHA, changed-file list, Playwright reproduction instructions, and synthetic fixtures.

## QA/QC plan

Test one frozen candidate. Record its full SHA, live-file hash, browser/version, URL and origin, fixture, expected/actual result, console output, and evidence path. Use the installed Playwright setup and keep per-browser artifacts.

| ID | Check | Pass evidence |
| --- | --- | --- |
| P3-01 | Insert with no selection | Insert representative snippet, divider, and template at multiple caret positions. Only the intended text is added; no literal `text` fallback appears; the caret lands at the expected location. |
| P3-02 | Insert over selected text | Snippet/wrap action replaces or wraps only the selection, leaves surrounding text intact, and positions the caret correctly. Include empty and multiline selections where supported. |
| P3-03 | Image action | With no selection and with selected alt text, output is a single valid `![…](…)` image link, with no stray prefix or concatenated URL. Verify the insertion point and surrounding text. |
| P3-04 | Studio palette newline decoding | Insert an item containing escaped newlines (including the Subgraph Box case); the editor receives actual line breaks, preserves unrelated literal backslashes, and the resulting diagram remains editable/renderable. |
| P3-05 | Global shortcut guard | While focus is in builder, find, replace, and other editable fields, typing or shortcut combinations do not mutate the background Markdown. Escape still dismisses the expected overlay/modal. Verify normal editor shortcuts still work when the editor owns focus. |
| P3-06 | Gutter baseline and correction | Use long text with multiple soft-wrapped lines; compare line-number baselines to visual editor rows while scrolling, resizing, dragging the split pane, toggling wrap and sync, and switching tabs. If no drift reproduces, retain measurements/screenshots and leave gutter code unchanged. |
| P3-07 | Phase 1/2 regression | Rerun Phase 1 and Phase 2 Playwright suites, including empty Mermaid source, stale preview render, builder clear-during-render, and theme/zoom behavior. |
| P3-08 | Adjacent workflow smoke | Check tabs, save/reload persistence, command palette, cross-Studio transfer where the same-origin setup is available, and slide/presentation entry/exit if shared code was changed. |

Run Chromium, Edge, Chrome, and Firefox on each supported launch origin. Use `file://` and localhost HTTP as comparison baselines where available, but do not treat them as substitutes for the actual production URL. Record the actual production origin when supplied; until then, leave launch-origin acceptance explicitly open. Keep `file://` BroadcastChannel limitations marked as origin-dependent skips rather than failures or passes.

## Phase 3 exit gate

Phase 3 is ready for independent review when the candidate and source hash are frozen; R10–R12 and shortcut checks pass; the gutter issue is either fixed and verified or shown not to reproduce; Phase 1/2 regressions pass; and every browser/origin result is recorded. The known production launch-origin gap remains open until the actual URL is tested.

## Not performed in this handoff

No application code was changed, and no tests were run. This document prepares Phase 3 coding and QA/QC.
