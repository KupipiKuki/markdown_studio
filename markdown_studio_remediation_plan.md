# Markdown & Mermaid Studio — Remediation Implementation Plan

Date: November 3, 2026  
Status: Planned; application code has not been modified.  
Source: `markdown_studio.html` (4,316 lines in the reviewed snapshot)  
Baseline SHA-256: `11eaec367bb698f557abefafd359a5983d5ef0e08d1fce4e45ea08ec7277a83c`

## 1. Objective and execution rules

Make Mermaid diagrams render consistently in Studio and Markdown preview, restore all affected controls, and produce a traceable audit and code diff at completion. Preserve the existing single-file application and its current features unless a documented defect requires a change.

This document authorizes no claim that remediation has already been implemented or verified. Begin implementation as a separate work step after this planning deliverable.

During remediation:

- Automatically fix minor bugs discovered within the application, without separate approval for each routine correction. Record every such fix in the issue register and final audit, including its discovery, impact, code change, and validation.
- Treat a minor issue as a localized correctness, presentation, accessibility, cleanup, or error-handling defect that preserves intended features and saved-document compatibility.
- Do not use this allowance for unrelated features, architectural rewrites, dependency migrations, destructive storage changes, or external publication. Document larger discoveries and continue independent work; request a decision only if a material scope choice is necessary.
- Keep changes focused. Avoid blanket reformatting so the final diff remains readable.
- Do not advance past a failed phase gate. Repair and retest, or explicitly record the blocked gate. A blocked or unrun test is never a pass.
- Preserve the original source and browser-stored documents. Test with isolated browser profiles and synthetic documents.

## 2. Findings register and traceability

Line numbers refer to the reviewed baseline and will move as fixes are made. Confirm causes in Phase 0; do not treat suspected visual or browser behavior as already reproduced.

| ID | Finding | Initial evidence level | Phase |
| --- | --- | --- | --- |
| R01 | Replacing diagram canvas HTML deletes the hidden source used by Edit and Copy | Reproduced with extracted function and mocked DOM | 1 |
| R02 | Theme refresh skips diagrams after that source is deleted | Reproduced with extracted function and mocked DOM | 1 |
| R03 | Fix in Studio buttons fall outside the handler selector | Source-confirmed | 1 |
| R04 | Error-log inline handlers reference functions hidden in application scope | Source-confirmed | 1 |
| R05 | Regex-based diagram replacement disagrees with parsed block indexes | Source-confirmed mismatch; browser reproduction pending | 2 |
| R06 | Markdown typography can affect HTML labels inside Mermaid SVGs | Suspected visual cause; browser verification required | 3 |
| R07 | Tall diagrams can be clipped by the capped preview viewport | Source-supported; visual verification required | 3 |
| R08 | Studio theme initialization changes shared Mermaid configuration | Source-confirmed shared state; visual verification pending | 3 |
| R09 | Preview setup repeatedly adds window listeners without removing them | Source-confirmed | 2 |
| R10 | Generic wrapping helper adds fallback or selected text after inserted blocks | Fallback text reproduced with extracted function | 4 |
| R11 | Image command constructs an incorrect destination | Source-confirmed | 4 |
| R12 | Subgraph palette inserts literal newline escape sequences | Source-confirmed | 4 |
| R13 | Export, copy, and print can run before diagram/math rendering finishes | Source-confirmed missing wait; browser reproduction pending | 5 |
| R14 | PNG export lacks image-load and canvas failure handling | Source-confirmed; browser behavior pending | 5 |
| R15 | Async rendering lacks a latest-request check | Source-confirmed; stale-result reproduction pending | 2 |

Assign additional discoveries IDs `D001`, `D002`, and so on. Link each issue to its change batch, tests, evidence, and final diff section. A finding may be closed as fixed, disproved, or deferred with a reason; never silently drop it.

## 3. Phase 0 — Baseline, reproduction, and test setup

### Work

- [ ] Preserve an immutable baseline copy and record its SHA-256, file size, dependency versions, and original Library identity.
- [ ] Create a separate working copy and change history; never overwrite the baseline.
- [ ] Inventory all header menus, toolbar commands, diagram actions, modals, shortcuts, and export options. Record expected behavior and current result.
- [ ] Reproduce each finding using synthetic Markdown fixtures and record actual results.
- [ ] Establish browser-capable functional checks and visual inspection. Mocks supplement browser checks; they do not establish layout or download correctness.
- [ ] Target current Edge and Chrome on Windows where available, plus Firefox as a secondary compatibility check. Record actual browser/OS/version; do not label another environment as Windows coverage.
- [ ] Test the intended local-file launch mode and a local HTTP origin. Record clipboard and CDN restrictions separately from application failures.

### Fixtures

Use a small fixed fixture set: every built-in diagram template; a tall flowchart; a wide flowchart; a multi-diagram document; intentional invalid Mermaid; long and multiline labels; mixed Markdown/math/code; backtick and tilde Mermaid fences; four-backtick outer fences containing literal triples; and literal Mermaid examples inside ordinary code blocks. Include nested list/blockquote fences when the parser accepts them.

### Gate G0

Baseline hash matches this document, original remains unchanged, control inventory is complete, fixtures are identified, and every known finding has either reproduction evidence or an explicit unverified status. Capture baseline screenshots for visual cases and console output for failing controls. If the source differs, establish a new named baseline before proceeding.

## 4. Phase 1 — Preserve diagram source and restore actions

### Work

- [ ] Keep canonical Mermaid source outside the SVG replacement target; reuse the existing encoded source attribute where suitable.
- [ ] Make rendering, Edit, Copy Code, retry, and theme refresh read the same source.
- [ ] Bind preview actions consistently, including dynamically created error buttons; prefer delegated handlers.
- [ ] Replace error-log inline handlers with listeners that can access application functions.
- [ ] Provide clear feedback for unavailable or rejected clipboard operations.

### Gate G1

For multiple rendered diagrams, Copy returns the exact corresponding code, Edit opens that code, and updating one diagram leaves all other source unchanged. Invalid diagrams open through Fix in Studio. Error-log Copy and Dismiss work independently. Repeated theme switches redraw existing diagrams without blank content or new console errors.

Evidence: exact clipboard/source comparisons, before/after action results, theme screenshots, and captured console errors or an explicit clean result.

## 5. Phase 2 — Correct source replacement and render lifecycle

### Work

- [ ] Replace independent regex/index matching with parser-consistent source ranges or equivalent stable source mapping.
- [ ] Preserve fence style and surrounding document content when updating an existing diagram. Support the valid fence forms accepted by the application parser.
- [ ] Coordinate render work with generation IDs or equivalent invalidation. Commit results only when their document, target, and generation are still current.
- [ ] Prevent queued or stale work from overwriting current previews, Studio validation, or closed/reopened modal state.
- [ ] Use shared pan handlers or explicit lifecycle cleanup so repeated preview builds do not retain old DOM trees.
- [ ] Avoid broad cleanup that could remove another active render's temporary elements or unrelated SVG assets.

### Gate G2

In mixed-fence fixtures, editing any diagram changes only its source range. Exact text comparisons show surrounding Markdown is preserved. Rapid edits, tab switches, modal reopening, and controlled out-of-order render completion show the newest result only. After 50 refresh cycles, listener counts do not grow per cycle and detached diagram objects are not retained by application handlers. Diagrams remain interactive after rerendering.

Evidence: source comparisons, render-generation trace, repeat-cycle results, and listener/retention inspection. Investigate sustained growth; do not rely solely on a single heap-size reading.

## 6. Phase 3 — Align diagram styling, sizing, and themes

### Work

- [ ] Compare identical source in Studio and Markdown preview to verify or disprove typography interference.
- [ ] Scope Markdown typography so it cannot alter Mermaid label layout; avoid broad SVG text overrides that conflict with Mermaid styling.
- [ ] Define consistent rendering configuration and explicit Studio-versus-document theme behavior.
- [ ] Fit diagrams against both available dimensions on initial display; retain pan and manual zoom.
- [ ] Define Reset/Fit behavior consistently and recompute fitting after pane resizing or visibility changes where needed.
- [ ] Check long labels, arrows, node borders, toolbar reachability, and narrow viewport overflow.

### Gate G3

Every built-in template and tall/wide fixture is legible in both views. At the initial fit, no diagram content is clipped; at manual zoom, all content remains reachable by panning. Labels have no unexplained spacing or truncation. Light/dark changes and Studio custom themes follow the documented policy. Repeat after split resizing, viewer hide/show, and at a narrow viewport.

Evidence: paired Studio/preview screenshots with source fixture, theme, viewport, and zoom recorded. Log whether R06 was confirmed or disproved; do not call it fixed without evidence.

## 7. Phase 4 — Repair insertion commands and complete control coverage

### Work

- [ ] Separate selection-wrapping commands from whole-snippet insertion commands.
- [ ] Specify selection behavior: formatting wraps selected text; snippet insertion replaces the selection or inserts at the caret without extra placeholder text.
- [ ] Correct image Markdown generation and convert palette newline escapes to real newlines.
- [ ] Verify table, divider, code, math, link, quick diagram, and Studio insertion with empty and nonempty selections.
- [ ] Complete the Phase 0 control inventory, including find/replace, file open, tabs, pane toggles, dropdown dismissal, modal close, zoom, and shortcuts.
- [ ] Ensure editor shortcuts do not unexpectedly modify the document while typing in Studio or other input fields.
- [ ] Automatically correct localized defects discovered during this sweep and add their D-series audit entries.

### Gate G4

Every inventoried control has a pass or a documented blocker. Exact-text checks show no stray `text`, malformed image destination, or literal newline escapes. Insertions and replacements preserve unrelated content. Keyboard and pointer routes produce the intended behavior. Tab switching, saving, and reloading retain documents correctly.

Evidence: control coverage matrix, input/output text samples, persistence round-trip comparisons, and checks for each additional minor fix.

## 8. Phase 5 — Make exports deterministic and diagnosable

### Work

- [ ] Establish a render-ready operation that waits for the current document's Mermaid and MathJax work before HTML export, rendered HTML copy, or print.
- [ ] If the document changes while awaiting readiness, refresh the captured generation or explicitly require retry; never silently export stale content.
- [ ] Export a clean document rather than transient controls, error UI, or active pan/zoom transforms.
- [ ] Validate SVG dimensions, styling, label rendering, and standalone reopening. Validate PNG independently; consider an export-specific label mode only if browser evidence requires it.
- [ ] Handle image load, canvas, and Blob failures; release temporary URLs on success and failure and provide actionable user feedback.
- [ ] Remove print clipping and viewport height constraints from diagram print layout.
- [ ] Verify the standalone HTML output preserves diagram/math readability and document theme intent.

### Gate G5

Immediately after editing, HTML export and rendered HTML copy contain the latest completed diagrams and math. Reopened SVG and PNG files show complete labels and diagram bounds at the expected dimensions. PNG failure tests report errors without false success. Print/PDF includes tall diagrams without clipping. Empty and invalid diagrams have explicit, consistent export behavior.

Evidence: exported sample files, dimensions, reopened-file inspection, print/PDF inspection, and controlled failure logs. Environment-blocked export checks stay marked blocked.

## 9. Phase 6 — Final regression, audit, and handoff

### Work

- [ ] Run all prior gates against one frozen final candidate.
- [ ] Complete the target-browser matrix and document any unavailable environments.
- [ ] Confirm original baseline integrity and verify the final source hash.
- [ ] Review the baseline-to-final diff for accidental changes, embedded test data, removed features, and unrecorded fixes.
- [ ] Generate the final audit report, code diff report, and machine-readable unified patch.
- [ ] Validate that the patch applies to the baseline and reconstructs the final file byte for byte.
- [ ] Save the completed deliverables and evidence index together with clear version identifiers.

### Gate G6 — Completion criteria

All required gates pass, all in-scope findings are resolved or disproved with evidence, and no unexplained functional or visual regression remains. Required blocked tests prevent an unqualified completion claim. Any accepted deferral must have its impact and acceptance recorded. Every additional minor correction appears in the audit and diff mapping. All report links resolve to retained evidence.

## 10. Evidence capture and execution records

Keep evidence contemporaneously, before replacing a failing state. Use synthetic data. Capture screenshots only of the application fixtures; exclude unrelated browser content or personal information.

Suggested delivery structure:

- `baseline/markdown_studio.original.html`
- `final/markdown_studio.html`
- `reports/remediation_audit.md`
- `reports/code_diff_report.md`
- `reports/markdown_studio.patch`
- `evidence/index.md`
- `evidence/phase-N/` — fixtures, permitted screenshots, console logs, exported samples, and test results
- `evidence/checksums.sha256`

Each test record must contain:

| Field | Required content |
| --- | --- |
| Test and issue IDs | Stable test ID, related R/D IDs, and gate |
| Candidate | Source SHA-256 and change batch or commit |
| Environment | OS, browser/version, launch origin, viewport, theme, zoom |
| Procedure | Exact fixture, steps, and expected result |
| Observation | Actual result, timestamp with timezone, pass/fail/blocked |
| Evidence | Relative paths to screenshots, logs, comparisons, and sample exports |
| Follow-up | Fix reference and retest result; preserve original failure record |

Use an evidence filename such as `G3-R06-labels-preview-dark-after.png`. Record both before and after states where a visible change is claimed. Keep screenshots contextual; pair them with source and exact assertions for behaviors a screenshot cannot prove.

Maintain a phase log with status `not started`, `in progress`, `blocked`, or `passed`, plus candidate hash, test totals, evidence references, and next action. Current status: every phase is not started.

## 11. Final audit report requirements

The final audit must include:

1. Executive result, scope, baseline/final hashes, implementation dates, and actual environments tested.
2. One row for every R-series finding and every D-series discovery: root cause, severity, fix, affected functions, tests, evidence, and final disposition.
3. A dedicated list of automatically fixed minor issues, including why each qualified as minor and its regression coverage.
4. Gate results and browser/control coverage, with passed, failed, blocked, and unrun counts separated.
5. Visual findings and export findings, distinguishing verified causes from disproved hypotheses.
6. Remaining limitations, accepted deferrals, dependency behavior, and any launch-mode differences.
7. Rollback procedure: retain the final artifact, restore the immutable baseline, and preserve document storage; do not reset saved documents as a routine rollback step.
8. Links to the final source, evidence index, code diff report, unified patch, and checksum list.

## 12. Code diff report requirements

Produce both a readable Markdown explanation and a raw unified patch from the immutable baseline to the final file. The report must include:

- Exact filenames, baseline/final hashes, and additions/deletions statistics.
- A per-change table linking R/D issue IDs to affected functions or CSS selectors, baseline/final line locations, behavioral changes, and test evidence.
- Explanations of shared fixes that close multiple findings, especially source preservation and rendering lifecycle changes.
- Dependency and configuration changes, explicitly stating when there are none.
- Separate identification of cosmetic edits, if any, so functional changes remain reviewable.
- Patch application result and a hash comparison proving the reconstructed file equals the delivered final file.

Do not fabricate final diff statistics, test results, screenshots, or issue closure while planning. Generate these from the actual completed implementation.

## 13. First implementation checkpoint

Begin with Phase 0, then complete Phase 1 as the first functional change batch. At that checkpoint, provide the updated source, G0/G1 results, evidence references, and the initial audit entries before continuing through the remaining gates.
