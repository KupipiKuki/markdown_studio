# Markdown Studio migration — Phase 1 handoff

Prepared November 14, 2026  
Audience: implementation coder and QA/QC  
Status: Phase 1 implementation candidate committed; QA/QC pending.

## Phase 1 objective

Port the first diagram-correctness fixes from the audited standalone candidate into the live Markdown Studio entry point while preserving the live app’s existing workflows. This phase covers Mermaid source preservation, error recovery/actions, parser-consistent diagram-to-source mapping, and safe Mermaid cleanup. It does not include layout/zoom, theme/lifecycle work, editor insertions or gutter work, exports, or print changes; those belong to later phases.

## Pinned references

- **Live starting point:** repository `KupipiKuki/markdown_studio`, branch `main`, commit `191a81451f12043a154c3aa1f3ee80997cd4ea4b`; live file `scripts/markdown-studio.html`, blob `d3719af4d5e86458f6d7243779a1853e6aa4e9f6`.
- **Audited behavior reference:** commit `c0da234d3640976e75c6cefe4c3353c9632f8e86`; frozen file `markdown_studio_phase_0/final/markdown_studio.html`, SHA-256 `d1b2f6f32007cef3e26d904575b9edc3fb97aa5ad015632090f23096d4d66c6e`.
- **Detailed behavior map:** [Phase 6 code diff report](https://github.com/KupipiKuki/markdown_studio/blob/c0da234d3640976e75c6cefe4c3353c9632f8e86/markdown_studio_phase_0/reports/code_diff_report.md).
- **Source files:** [live script](https://github.com/KupipiKuki/markdown_studio/blob/main/scripts/markdown-studio.html) · [frozen candidate](https://github.com/KupipiKuki/markdown_studio/blob/c0da234d3640976e75c6cefe4c3353c9632f8e86/markdown_studio_phase_0/final/markdown_studio.html).

Before implementation, the coder re-read the current `main` head and live-file blob. They matched the pins above. Implementation is on `wp/studio_migration`, based on the confirmed live head. The pre-edit source blob was `d3719af4d5e86458f6d7243779a1853e6aa4e9f6`.

## Current implementation candidate

- **Branch:** [`wp/studio_migration`](https://github.com/KupipiKuki/markdown_studio/tree/wp/studio_migration)
- **Frozen Phase 1 commit:** [`68560b0208e7e1da86cd06f862de74f568e3a5af`](https://github.com/KupipiKuki/markdown_studio/commit/68560b0208e7e1da86cd06f862de74f568e3a5af)
- **Updated live-file blob:** `4dd77e1a275c70b785a2565a4d0a111b6bf43bd2`
- **Commit scope:** retained Mermaid code outside the replaceable canvas, use shared card-source lookup, recognize Mermaid info-string variants, add delegated repair for syntax-error cards, replace regex-only diagram replacement with the audited token-span mapper, and delegate error-log Copy/Dismiss with clipboard feedback. D001 cleanup was reviewed and left unchanged because the live implementation already uses error-specific selectors rather than removing arbitrary body SVGs or Mermaid measurement elements.
- **Tests:** no runtime tests or browser matrix have been run on this candidate. QA/QC should test this exact SHA and record any later candidate separately.

**Do not apply the full Phase 6 patch to the live script.** It was generated against a smaller standalone baseline. Port the reviewed behavior into the pinned live source in focused edits; keep live-only code and controls.

## Coder handoff

### In-scope behavior

Assess and port the following candidate fixes only where the current live behavior lacks them:

1. **R01 — Keep Mermaid source available after SVG render.** The hidden source must survive the render step that replaces canvas contents with SVG. The candidate moves source outside the replaced canvas and reads it through `getCardMermaidCode()`.
2. **R02 — Make rerender use preserved source.** `renderAllPreviewDiagrams()` must consistently read each card’s current source and must not silently skip a card because a prior render replaced its source node.
3. **R03 — Keep invalid-diagram repair actionable.** The error-card “Fix in Studio” action must reach the correct diagram and allow repair without losing its source or changing another card’s source. Preserve any working live delegated-action pattern.
4. **R04 — Keep error-log actions functional.** If porting the candidate’s error-log changes, use closure-safe event delegation for Copy/Dismiss, avoid inline event handlers, and surface clipboard failure instead of reporting false success. This is part of the Phase 1 candidate change map but must remain isolated from diagram rendering.
5. **R05 — Map rendered cards to Markdown source reliably.** Use Mermaid-aware language recognition and parser-consistent source spans/replacement. Do not rely on a broad `/```mermaid…```/g` regex that breaks on tildes, outer fences, blockquotes, indentation, or info strings.
6. **D001 — Preserve Mermaid’s temporary render/measurement SVGs.** Narrow stray-error cleanup so it removes known error artifacts without deleting Mermaid’s in-flight measurement nodes or unrelated body-level SVGs needed by `getBBox()`.

The live source already has a `Fix in Studio` button with `data-action`, and its cleanup code already distinguishes some error elements. Verify actual end-to-end behavior before porting either area; do not duplicate or overwrite an equivalent live fix. The candidate report is a behavior map, not a mandate to copy every hunk.

### Implementation constraints

- Keep persistence and transfer contracts unchanged: `markflow_editor_state_v2`, `markflow_view_mode_v2`, `markflow_viewer_full_width`, `markflow_theme`, `BroadcastChannel('gemini_studio_bus')`, and `gemini_studio_transfer_queue_v1`.
- Preserve native/open/save fallback paths, command palette, cross-Studio actions, code-block actions, and slide/presentation features. Touch shared helpers only when necessary and include regression coverage for any shared behavior changed.
- Keep Mermaid and existing CDN dependency versions unchanged in this phase.
- Avoid mixing in R06–R15 or editor gutter work. Do not port render-generation guards or export/print readiness here; record dependencies if Phase 1 exposes a need for them.
- Do not clear or rewrite browser storage to make tests pass. QA uses an isolated profile and synthetic fixtures.

### Coder deliverables

- A focused migration branch/PR containing only Phase 1 changes and any explicitly justified shared helper adjustment. The current candidate is listed above.
- A concise change map from each changed behavior to the corresponding R/D finding and live source location.
- A before/after note for any finding intentionally not changed because the live script already satisfies it.
- Reproduction steps and candidate commit SHA for QA/QC. Do not merge or publish as part of this phase handoff.

## QA/QC handoff

Test exactly one frozen Phase 1 candidate. Record its full commit SHA, live-file SHA-256, browser/version, launch URL and origin, fixture ID, expected/actual result, and artifact path for each run. The normal launch URL(s) were not established in the source inventory; identify them before calling the origin matrix complete. Do not assume `file://` and HTTP(S) have equivalent storage or cross-Studio behavior.

### Phase 1 acceptance checks

| ID | Check | Pass condition / evidence |
| --- | --- | --- |
| P1-01 | Load and syntax smoke | Live entry point opens through its normal launch path with no new parse/runtime error; capture console and startup state. |
| P1-02 | Render then edit/rerender a valid Mermaid card | Diagram source remains intact after SVG replaces canvas content; subsequent edits rerender the correct source. Retain before/after source and screenshot. |
| P1-03 | Multiple diagrams and source association | Editing or fixing one diagram changes only its matching Markdown fence/card, including after a rerender. Retain the fixture and resulting Markdown. |
| P1-04 | Invalid diagram → “Fix in Studio” → repair | Action opens the intended diagram; corrected source is written to the intended location and preview recovers. Retain error/recovery screenshots and resulting source. |
| P1-05 | Error-log Copy/Dismiss (if R04 is changed) | Copy uses the correct error text; Dismiss removes only the selected entry; clipboard denial/failure does not show a success toast. Retain clipboard payload or a documented fallback result. |
| P1-06 | Mermaid fence and source-span matrix | Verify backtick and tilde fences, Mermaid info strings, CRLF input if supported, Mermaid inside a blockquote/indented or outer-fenced context, and ordinary non-Mermaid fences. A repair updates only the matching span. Record fixture and output for each case. |
| P1-07 | Measurement-container regression | Sequence diagram and edge-labeled flowchart render successfully; Mermaid measurement SVGs survive until layout measurement completes; after success/failure there are no unrelated SVGs removed and no persistent rogue error UI. Retain screenshots and console output. |

Run the Phase 1 checks in Chromium, Edge, Chrome, and Firefox at each confirmed supported launch origin. Report every browser/origin pair; if an environment is unavailable, mark it blocked with reason and residual risk, not passed. Include a short regression smoke for normal tab switching, document reload/persistence, the command palette, and cross-Studio transfer on a shared origin so shared closures and render handlers do not break live features.

The Phase 6 candidate’s reported aggregate matrix is not evidence for the migrated live script. QA/QC must report Phase 1 results from the frozen migration candidate only. Firefox’s prior print/PDF limitation is out of Phase 1 scope, but it remains an explicit later-phase risk and must not be reclassified as resolved.

## Phase 1 exit gate

Phase 1 is ready for independent review when:

- Coder’s change map identifies which R01–R05/D001 behaviors were changed or already present in live code.
- QA/QC tested the same frozen candidate commit and retained the evidence above for every supported browser/origin pair.
- No Phase 1 acceptance check has an unexplained failure; blocked checks have a named reason, owner, and residual risk.
- Saved tabs/preferences, cross-Studio actions, and the live-only smoke checks show no regression.
- The independent reviewer can reproduce the results from the retained fixtures and artifacts.

If a finding fails, coder updates the candidate; QA/QC freezes and retests the new candidate. Do not move to Phase 2 display/lifecycle changes until this gate has a recorded decision.

## Known issues and deferred work

- The migration plan noted a discrepancy in the inherited gutter report: the current live scroll handler already sets `lineNumbers.scrollTop = editor.scrollTop`, while gutter/editor font sizes differ and soft wraps can still drift. Gutter reproduction/fix is deferred to the editor phase.
- Diagram sizing, theme reapplication, shared pan-listener lifecycle, stale-render generation guards, editor insertion/shortcut fixes, standalone/clipboard/PNG export, and tall-diagram print are later phases.
- The repo source inventory did not establish the normal production launch URL. Capture it for QA before declaring launch-origin coverage complete.
