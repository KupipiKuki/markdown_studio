# Markdown Studio migration — Phase 4 handoff

Prepared November 15, 2026  
Audience: implementation coder and QA/QC  
Status: ready for final-phase implementation; no application code or tests changed in preparing this handoff.

## Objective

Complete the live migration's export and print work: ensure exports use the newest completed preview, produce clean rendered output, fail safely when rendering or rasterization cannot complete, sanitize SVG diagram exports, and paginate tall diagrams in print/PDF.

This phase covers R13–R14 and the associated A6 export/print remediations in the audited behavior map. It is the final planned implementation phase; the release/launch-origin coverage gate remains separate.

## Pinned references

- **Migration branch:** [`wp/studio_migration`](https://github.com/KupipiKuki/markdown_studio/tree/wp/studio_migration)
- **Current branch tip at handoff:** `6e43ca7620a0a630c56d7ada48bab8917caf0b82`
- **Accepted Phase 3 code candidate:** `2cd8810404fc91762524a76b75f99905f0f2a226`
- **Live entry point:** `scripts/markdown-studio.html`
- **Live-file blob at accepted Phase 3 candidate/current branch:** `cd0b2826906af730fd41a2c9b53a99e24bc3888f`
- **Phase 3 final review:** [local review record](C:\Users\jmc53\OneDrive\Documents\ChatGPT\notepad_studio\markdown-studio-phase-3-review.md)
- **Phase 3 QA results:** [`PHASE3-QA-RESULTS.md`](https://github.com/KupipiKuki/markdown_studio/blob/wp/studio_migration/qa-artifacts/PHASE3-QA-RESULTS.md)
- **Phase 3 remediation QA/QC:** [`PHASE3-REMEDIATION-QAQC.md`](https://github.com/KupipiKuki/markdown_studio/blob/wp/studio_migration/qa-artifacts/PHASE3-REMEDIATION-QAQC.md)
- **Audited behavior map:** [`Phase 6 code diff report`](https://github.com/KupipiKuki/markdown_studio/blob/c0da234d3640976e75c6cefe4c3353c9632f8e86/markdown_studio_phase_0/reports/code_diff_report.md)

Before coding, re-read the branch head and live-file blob and verify the Phase 3 implementation is present. Record the exact base commit, source hash, new candidate commit, changed-file list, and test source hash in the Phase 4 QA report.

## Accepted baseline to preserve

Phase 1–3 code has been reviewed and accepted through candidate `2cd8810`. The Phase 3 QA report records the full regression matrix passing on `file://` and localhost HTTP across Chromium, Edge, Chrome, and Firefox. The 4 file-origin skips are the expected same-origin transfer checks. Preserve:

- Phase 1 Mermaid source preservation, source-span mapping, empty/whitespace source validation, repair actions, and error handling.
- Phase 2 diagram typography, fit/refit, zoom retention, theme isolation, one-time listener setup, and stale-render generation invalidation, including the builder-clear race fix.
- Phase 3 snippet/image/palette insertion, shortcut guards, nowrap and soft-wrap gutter positioning, and linear large-document gutter measurement.
- Existing Markdown save/open/download behavior, storage and cross-Studio transfer contracts, Mermaid/CDN dependencies, editor controls, and slide/presentation paths.

The supported production launch URL remains unidentified. The existing `file://` and localhost matrices do not stand in for production launch-origin coverage.

## Scope and implementation direction

| Finding | Intended behavior | Coder direction |
| --- | --- | --- |
| R13 / A6-01 | Copy rendered HTML, standalone HTML export, and print wait for the latest preview render to settle. | Add/adapt a shared readiness helper (audited name: `ensurePreviewRenderReady()`) that tracks the current render generation and waits for Mermaid/math work. A stale earlier render must not satisfy readiness for a newer edit or document switch. |
| R13 / A6-03 | Exports contain clean document content only. | Add/adapt a clean-content helper and standalone generator (audited names: `getCleanRenderedContent()` and `generateStandaloneHtml()`). Exclude transient buttons, error UI, preview-only wrappers, and pan/zoom transforms while preserving Markdown-rendered content, code, tables, and diagram labels. Do not mutate the live preview as a side effect. |
| R13 retry exhaustion | If a render cannot complete within the bounded retry policy, copy/export/print must stop with clear feedback rather than emit stale or partial content or report false success. | Preserve a finite timeout/retry budget. Test a failing/never-settling render and verify no clipboard payload, downloaded file, or print action is reported as successful. |
| R13 print pagination | Tall diagrams paginate across printed pages without clipping or disappearing. | Use the audited print CSS behavior selectively against the current live layout. Retain the 26-step tall diagram fixture and verify first, middle, and final steps across pages. |
| R14 SVG/PNG export | SVG export is safe for standalone use; PNG export reports actionable errors and releases temporary resources on every path. | Add/adapt SVG sanitization (audited name: `sanitizeSvgForExport()`), including conversion of Mermaid `foreignObject` labels to a supported SVG text representation. For PNG, handle image load, canvas, taint, and Blob failures; revoke object URLs on success and failure; log actionable errors; never show success on failure. |

The audited Phase 6 patch is a behavior reference only. It was made against a different baseline. Port reviewed semantics into the live Phase 3 script in focused edits; do not replace the entry point or apply the unified patch wholesale.

### Boundaries

- Keep Phase 1–3 behavior and storage/transfer schemas unchanged.
- Do not mix in new editor, parser, Mermaid dependency, slide/presentation, or theme changes.
- Preserve Markdown download/open/save and command palette actions adjacent to the export controls.
- Do not clear or rewrite browser storage during QA; use isolated contexts and synthetic documents.
- Firefox print/PDF was previously blocked because the audited CDP check was unavailable. A missing automation capability is not a pass; use a supported direct print/PDF verification path or record the browser/origin as blocked with evidence and residual risk.

## Coder deliverables

- Focused implementation for R13–R14/A6 findings, with a finding-to-code change map and before/after behavior notes.
- Bounded retry/readiness policy, failure feedback, and cleanup paths described in the change map.
- New or extended Playwright coverage and stable synthetic fixtures for delayed rendering, failure, clean output, export variants, and tall-diagram printing.
- Frozen candidate commit and live-file hash, changed-file list, reproducible test commands, and retained artifacts.
- No merge or production rollout as part of this handoff.

## QA/QC plan

Test exactly one frozen Phase 4 candidate. For every run, record commit and live-file hash, browser/version, URL and origin, fixture ID, expected/actual result, console errors, artifact path, and whether the assertion covers the app behavior or a harness limitation.

| ID | Check | Pass evidence |
| --- | --- | --- |
| P4-01 | Latest-render readiness | Trigger copy HTML, standalone export, and print while a diagram render is delayed; edit the document or switch tabs before it finishes. Each output/action waits for and reflects only the newest document state. |
| P4-02 | Clean rendered HTML | Export a document with headings, lists, code, tables, Mermaid diagrams, and preview controls. Compare export to the final rendered document; no error cards, transient controls, pan transforms, or unrelated preview wrappers appear. Live preview remains unchanged. |
| P4-03 | Standalone HTML | Open the generated file in a fresh browser context. Verify styles/dependencies and diagrams work as intended, and content matches the latest document. Confirm a failed readiness attempt does not download a stale file. |
| P4-04 | Clipboard paths | Verify Markdown copy and rendered HTML copy use the correct current content. Exercise clipboard denial/fallback; no false-success toast or stale clipboard payload. |
| P4-05 | Retry/timeout exhaustion | Force Mermaid/math rendering to fail or remain pending past the readiness budget. Each copy/export/print action aborts with actionable feedback and emits no stale/partial result. |
| P4-06 | SVG diagram export | Export flowchart and sequence diagrams with HTML labels/`foreignObject`. Open or parse the exported SVG independently; labels remain readable, unsafe/transient markup is absent, and export errors are visible. |
| P4-07 | PNG export and cleanup | Verify valid diagram PNG output. Force image-load, canvas/taint, and Blob failure paths; each reports an actionable failure, writes an error entry where designed, does not show success, and revokes temporary URLs. |
| P4-08 | Tall-diagram print/PDF | Print the 26-step fixture. All steps appear over the expected pages without clipping, overlap, hidden overflow, or broken page boundaries. Run Chromium, Edge, Chrome, and Firefox; retain PDFs or page screenshots plus step-presence evidence. |
| P4-09 | Phase 1–3 regressions | Rerun the Phase 1, Phase 2, and Phase 3 Playwright suites, including empty Mermaid source, stale-render races, editor insertion, shortcut guards, gutter wrapping, and 2,000-line performance budget. |
| P4-10 | Adjacent workflow smoke | Verify Markdown save/download/open, tab persistence, command palette, cross-Studio transfer on a shared origin, and slide/presentation open/close if a shared helper was changed. |

Run Chromium, Edge, Chrome, and Firefox on every confirmed supported launch origin. Keep `file://` and localhost HTTP baselines where available, but do not label them production coverage. The production launch URL remains a release dependency until supplied and tested. For Firefox PDF, use an actual supported print-to-PDF workflow; if unavailable, record the check as blocked rather than passed.

## Phase 4 exit gate

Phase 4 is ready for independent review when the candidate/hash are frozen; P4-01 through P4-10 pass or each documented exception has an owner and residual risk; retries abort safely; exports match the latest document and contain clean content; SVG/PNG cleanup is verified; tall-diagram pagination is evidenced in every supported browser; Phase 1–3 regressions pass; and all browser/origin gaps are recorded. The actual production-origin coverage must remain explicitly open until the supported launch URL is exercised.

## Not performed in this handoff

No application code was changed, and no tests were run. This document prepares the final implementation and QA/QC phase.
