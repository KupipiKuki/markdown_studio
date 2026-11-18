# Markdown Studio live migration plan

Prepared November 14, 2026; status updated November 16, 2026  
Status: Phases 1–4 are implemented and reviewed. Phase 5 is added for fresh migration-path code verification and independent QA/QC; see the handoff and next steps below.

## Current status and next steps — November 16, 2026

### Implementation status

- **Phase 1:** reviewed and QA/QC complete.
- **Phase 2:** reviewed and QA/QC complete, including the builder clear-during-render remediation.
- **Phase 3:** reviewed and QA/QC complete, including soft-wrap gutter alignment and the 2,000-line typing-path performance remediation.
- **Phase 4:** reviewed and QA/QC complete, including the theme-change readiness race remediation.
- **Phase 4 candidate:** `ffadcc65f8d0e196b6498596991aaa146a024ace`; its live-file blob was `ca087ef54d44f17062eb0e3ec8fa6da30635c97e` at the prior review.
- **Active remote branches:** `main` is at `191a81451f12043a154c3aa1f3ee80997cd4ea4b`; `wp/studio_migration` is 34 commits ahead of `main`; `audit/phase6-final-c0da234` is at `dd56d3a4f30c147443fd885ec63581a0371da4c1`; and the Phase 6 handoff branch `vibe/phase6-final-audit-handoff-2ace24` has commit `df83f4a06d0ce3d91e07b16452adee6ed28783b1` (“Commit and push final audit handoff”). The frozen Phase 6 candidate and `reports/remediation_audit.md` are present on the handoff branch. However, the supplied local-history export records this commit deleting 957 paths, including 951 under `markdown_studio_phase_0/evidence/`; GitHub confirms `evidence/checksums.sha256` and `evidence/index.md` are absent at this ref. The Phase 6 handoff is therefore not self-contained at its current tip. Phase 5 will produce a fresh migration-path evidence package; restoring the old evidence tree is not a prerequisite. The audit branch carries the independent Phase 6 report. Phase 6 PASS applies to the frozen standalone candidate at `c0da234`, not automatically to the live Studio migration.
- **Branch relationship:** the Phase 6 handoff branch and audit-report branch each have one distinct commit after `c0da234`; GitHub compares them as diverged. The local-history export shows no integration merge commit after `df83f4a` and instead shows the evidence deletion. `wp/studio_migration` and the Phase 6 branches share `main` as their merge base; the remote refs do not show an integration merge. The migration branch is 34 commits ahead of `main`, while the Phase 6 audit branch is 71 commits ahead. These are remote/local-history observations only. Confirm the intended local integration commit/tree and merge direction before opening a PR.
- **PR/CI state:** no open PR was found. The Playwright workflow runs on PRs targeting `main` or `master`, so integration CI is pending.
- **Launch model:** Studio is expected to run from a local folder (`file://`) or a local server (for example, localhost). No hosted production URL is required for this plan. Test each supported launch mode separately; same-origin transfer between Studios should be verified on the local server when both are served from the same scheme, host, and port.
- **PDF status:** the user reports that Firefox print preview works and Firefox successfully generates a PDF. Record Firefox PDF export as manually verified. If the automated Playwright PDF artifact path remains unsupported, document that as an automation limitation only; it is not evidence that Firefox PDF export is blocked.

## Phase 6 correction review — November 17, 2026

Reviewed the frozen Phase 6 source (`markdown_studio_phase_0/final/markdown_studio.html`, blob `05359f4f5bf855a0e219a03687d6c3690d2cf098`) against the live migration source on `wp/studio_migration` (`scripts/markdown-studio.html`, blob `ca087ef54d44f17062eb0e3ec8fa6da30635c97e`). The Phase 6 report and the migration's accepted Phase 4 remediation review were used as evidence. The handoff branch at `df83f4a` has removed its evidence index and checksum inventory, so detailed Phase 6 artifacts must be referenced from the frozen `c0da234` candidate commit or audit report rather than assumed present at the handoff branch tip.

### Application changes: no additional Phase 6 code port identified

- **R13 readiness and retry exhaustion:** the migration helper uses bounded waits and checks `previewRenderSettledGen >= previewRenderGeneration`, retrying when a direct theme render advances the generation. Export, HTML copy, and print all stop when readiness returns false. The accepted P4-01R regression exercises the theme-change race; P4-05 verifies that a never-settling render produces no download, clipboard write, or print call. This is stricter than the Phase 6 standalone helper's content/tab retry check. Keep the migration implementation.
- **Clean output:** migration `getCleanRenderedContent()` also removes live-only transfer/action controls such as `.code-block-actions` and `.code-action-btn`, which are absent from the standalone candidate. Keep the live-specific behavior.
- **SVG/PNG:** migration `sanitizeSvgForExport()` matches the Phase 6 sanitizer. The live PNG and SVG helpers include additional error reporting/download handling. No source replacement is indicated.
- **Print pagination:** the migration print rules contain the Phase 6 multi-page layout behavior and the Phase 4 QA generated three-page PDFs on Chromium, Edge, and Chrome. Keep the live stylesheet and the user-facing print action.
- **Line-number gutter:** the migration implementation measures soft-wrapped logical lines and aligns each number with its first visual row. Phase 6's standalone candidate simply emits one number per logical line. Keep the migration gutter implementation; do not port the simpler candidate code over it.

### QA improvements to carry into migration release evidence

The migration implementation appears to cover the Phase 6 application fixes, but its Phase 4 tests do not fully reproduce several Phase 6 final-audit checks:

1. **Clipboard:** `tests/phase4.spec.js` replaces `navigator.clipboard.writeText` with a test stub and inspects calls to that stub. It checks exact raw Markdown and clean rendered HTML properties, but does not read back the browser clipboard. Add a read-back check or retain clear evidence of the exact payload delivered to the clipboard API for raw Markdown and rendered HTML.
2. **SVG/PNG artifacts:** P4-06 reopens an SVG and checks for text nodes and no `foreignObject`, but does not assert positive text-label bounds. P4-07 checks the PNG signature/size and failure cleanup, but does not reopen/decode the image or check its dimensions and rendered pixels. Adapt the Phase 6 output checks for both exported files.
3. **PDF content:** P4-08 checks print-layout DOM visibility and estimates PDF page count from `/Type /Page` plus file size. Those assertions do not prove all 26 step labels occur in the generated PDF or that pages are unclipped. Retain the PDFs and inspect/extract each page's content, including first/middle/final steps, for each supported browser. For Firefox, the user has manually confirmed PDF generation; retain and inspect a sample to verify pagination separately from automation capability.
4. **Empty export:** the migration rich-document export covers invalid Mermaid fallback, but the Phase 6 audit also exercised a truly empty document. Add an empty-document export/copy case if empty state remains a supported workflow.

The migration QA already isolates outputs by browser/project and checks URL cleanup, rendered SVG labels, retry aborts, and cross-phase controls; those controls do not need to be replaced by the Phase 6 generic control harness. Phase 5 will rerun and strengthen migration-path verification and generate a fresh evidence package. The Phase 6 evidence cleanup issue remains historical branch context; recovering that package is not a Phase 5 prerequisite.

## Added Phase 5 — migration code verification and QA/QC

Phase 5 revalidates the accepted Phase 1–4 migration candidate against the Phase 6 correction set, then runs an independent full QA/QC pass on one newly frozen migration candidate. The live migration remains the implementation target; use the Phase 6 standalone candidate as a behavior reference. Do not apply its patch wholesale or replace live-specific state, transfer, or gutter behavior.

- **Starting reference:** `wp/studio_migration`, last reviewed live-file blob `ca087ef54d44f17062eb0e3ec8fa6da30635c97e` (accepted code candidate `ffadcc65f8d0e196b6498596991aaa146a024ace`). Re-fetch the branch head and freeze a new Phase 5 candidate before work.
- **Phase 6 source reference:** frozen standalone candidate at `c0da234`; Git blob `05359f4f5bf855a0e219a03687d6c3690d2cf098`.
- **Coder scope:** inspect the live implementations and tests for current-render readiness/retry aborts, clean exports, clipboard behavior, SVG/PNG artifacts, print pagination, wrapped-line gutter alignment, persistence, and same-origin transfer. Make code changes only for reproduced migration-path failures. Add or strengthen tests for exact clipboard payload/readback, empty/invalid document exports, SVG label bounds, decoded PNG dimensions/pixels, and actual PDF page content.
- **QA/QC scope:** independently verify the frozen source identity and every changed line; run full phase regression and focused Phase 5 cases on `file://` and localhost in Chromium, Edge, Chrome, and Firefox. Retain per-browser/per-origin logs and artifacts; validate the evidence index and checksums. Inspect each generated tall-diagram PDF page for all 26 steps, including a native Firefox-generated sample when Playwright PDF capture is unavailable.
- **Gate:** freeze candidate and hash before independent QA. Require all non-deferred checks to pass with evidence tied to that exact hash. Record browser-native print success separately from automation capability. Any code fix restarts candidate freeze and independent QA for the changed candidate.

The coder and QA/QC work breakdown is in [markdown-studio-phase-5-handoff.md](markdown-studio-phase-5-handoff.md).

### Remaining steps, in order

1. **Complete Phase 5 on `wp/studio_migration`.** Re-pin the branch head, verify code parity with the Phase 6 correction set, close the listed evidence gaps, and freeze the final migration candidate.
2. **Run independent Phase 5 QA/QC.** Re-run full phase coverage on the frozen candidate, generate fresh artifacts and checksums, and resolve any failures through another freeze/retest cycle.
3. **Confirm integration direction and prepare one PR to `main`.** Compare the final Phase 5 tree with the local branch history and remote refs; record the canonical commit and complete diff inventory. The remote Phase 6 and migration refs were divergent at last review.
4. **Run and review pull-request CI.** Retain the PR run link, final head SHA, and resolution for any CI failures.
5. **Complete local launch acceptance.** Run the supported-browser matrix from both the local folder and local server, with separate profiles. Verify startup, persistence, latest-render export/print, and rollback compatibility. Verify Studio-to-Studio transfer on localhost when both apps share the exact origin.
6. **Finish release review and smoke-test the delivered package.** Record the pre-merge `main` revision; verify the local folder/server launch and that the rollback version reads existing user data without clearing or rewriting storage. Keep the Firefox PDF artifact-generation result distinct from manual/native browser PDF evidence.

After Phase 5 passes, the remaining work is integration, local-launch acceptance, and release/rollback readiness.

## Scope and authority

The kickoff prompt in the supplied handoff directs a read-only comparison of the current live entry point against the audited Phase 6 candidate at `c0da234`, followed by a plan for a selective port. The live entry point is the migration target; the audited standalone candidate is the reference for fixes to assess and port. The plan must preserve existing live persistence and cross-Studio transfer behavior, address the line-number gutter defect, and define verification, rollback, and a migration gate. Phases 1–4 have since been implemented and reviewed. The kickoff prompt does not specify that the two Git branches themselves should be merged; any branch merge plan must be established from the earlier session history and reconciled with current remote refs before integration.

## Pinned source state

| Item | Observed state | Source |
| --- | --- | --- |
| Live default branch | `main` at `191a81451f12043a154c3aa1f3ee80997cd4ea4b` | [main branch](https://github.com/KupipiKuki/markdown_studio/tree/main) |
| Live entry point | `scripts/markdown-studio.html`, Git blob `d3719af4d5e86458f6d7243779a1853e6aa4e9f6` (189,472 bytes, 5,243 lines) | [live script](https://github.com/KupipiKuki/markdown_studio/blob/main/scripts/markdown-studio.html) |
| Frozen remediation candidate | `c0da234d3640976e75c6cefe4c3353c9632f8e86`; `markdown_studio_phase_0/final/markdown_studio.html`, 5,467 lines, SHA-256 `d1b2f6f32007cef3e26d904575b9edc3fb97aa5ad015632090f23096d4d66c6e` | [candidate](https://github.com/KupipiKuki/markdown_studio/blob/c0da234d3640976e75c6cefe4c3353c9632f8e86/markdown_studio_phase_0/final/markdown_studio.html) |
| Independent audit | `audit/phase6-final-c0da234` at `dd56d3a4f30c147443fd885ec63581a0371da4c1` | [audit report](https://github.com/KupipiKuki/markdown_studio/blob/dd56d3a4f30c147443fd885ec63581a0371da4c1/markdown_studio_phase_0/reports/phase_6_independent_final_audit_c0da234.md) |
| Remediation reference branches | `vibe/code_revisions` and `vibe/phase6-final-audit-handoff-2ace24` both still point to `c0da234…` | [branch list](https://github.com/KupipiKuki/markdown_studio/branches/all) |

At the time of the original audit, the repository README only described an HTML editor, and no deployment URL or hosting configuration was present in the root listing. The current launch assumption is local folder or local server; acceptance should test both and treat them as separate storage profiles.

The candidate patch was generated against `baseline/markdown_studio.original.html`, not the live script. The candidate adds 1,150 net lines over that baseline; the live script is 5,243 lines and contains live-only workflows. Do not apply the full baseline patch or replace the live entry point wholesale. Port behavior in reviewed, focused changes against the pinned live file.

## Live compatibility contract

Preserve the following current live contracts unless a separate, explicit compatibility decision is made:

- `markflow_editor_state_v2`: JSON object `{ tabs, activeId }`. Tabs are loaded and saved as whole objects; `activeId` selects the active tab.
- `markflow_view_mode_v2`: JSON view state with `editorVisible`, `viewerVisible`, `lastSplitRatio`, and `wordWrap` fields.
- `markflow_viewer_full_width`: string preference (`'false'` disables the default expanded viewer).
- `markflow_theme`: current theme preference.
- Cross-Studio uses `BroadcastChannel('gemini_studio_bus')` and `gemini_studio_transfer_queue_v1`. Queue entries have `id`, `targetApp`, `title`, `language`, `content`, and `timestamp`; the queue is capped to its most recent 10 entries. Incoming messages targeted at `markdown` are removed from the queue and imported as a tab. BroadcastChannel and localStorage are origin-scoped, so cross-Studio behavior must be checked with both apps on the same origin.

The current script also includes native/open/save fallbacks, command-palette actions, code-block send actions, and slide-deck/presentation behavior outside the standalone remediation scope. Keep these workflows intact and include at least smoke coverage for adjacent controls affected by shared handlers.

## Port map and implementation batches

Use the frozen candidate and its [code diff report](https://github.com/KupipiKuki/markdown_studio/blob/c0da234d3640976e75c6cefe4c3353c9632f8e86/markdown_studio_phase_0/reports/code_diff_report.md) as a behavior map. The full [unified patch](https://github.com/KupipiKuki/markdown_studio/blob/c0da234d3640976e75c6cefe4c3353c9632f8e86/markdown_studio_phase_0/reports/markdown_studio.patch) is reference material only.

| Batch | Candidate behavior to assess/port | Live-specific concern |
| --- | --- | --- |
| 0. Baseline and compatibility | Freeze live file hash and branch head; capture saved-state fixtures, launch origins, and current behavior before edits. | Current source has live workflows absent from the standalone candidate. Use a cloned browser profile and synthetic fixtures; do not use personal saved documents. |
| 1. Diagram correctness | R01–R05 and D001: preserve Mermaid source across rerenders, keep error-card actions working, replace fence parsing with parser-consistent source spans, and avoid removing Mermaid measurement SVGs. | Validate against current `customRenderer`, Studio actions, error handling, and all supported fence variants before moving code. |
| 2. Render lifecycle and display | R06–R09 and R15: isolate SVG label typography, fit tall/wide diagrams, reapply document theme, avoid accumulating window listeners, discard stale async renders. | Check shared listeners and global Mermaid theme interactions with Studio and live-only views. |
| 3. Editor actions and gutter | R10–R12 plus shortcut guard: fix snippet/image insertion and escaped palette text; stop global shortcuts from mutating content while typing in inputs or dialogs. Reproduce the gutter issue before assigning its fix to this batch. | Live source already sets `lineNumbers.scrollTop = editor.scrollTop` in the editor scroll handler. It still styles gutter text at 13px and editor text at 13.5px, both with `line-height: 1.6`; the editor wraps while the gutter emits one number per logical line. Verify first-visual-row alignment through wraps, resize, sync on/off, and tab changes. |
| 4. Export and print | R13–R14 and A6 remediations: wait for the latest render before copy/HTML/print, export clean content, fail safely when retries or PNG export fail, sanitize SVG export, and paginate tall diagrams. | Preserve Markdown download/open/save actions and existing export controls. The older audit recorded a Firefox PDF automation limitation; the user has since verified Firefox print preview and PDF generation manually. |

The handoff says the live gutter does not move. Current source review contradicts that specific statement: the live handler sets gutter `scrollTop`. This may be a partial fix; the font-size mismatch and soft-wrap geometry remain. Capture a baseline reproduction before deciding whether gutter code changes belong in the port.

## Verification plan through the live entry point

Use one isolated browser profile per launch origin and synthetic saved-state/transfer fixtures. Record browser version, origin, source commit/blob, fixture identifier, expected result, actual result, and retained artifact for each check.

1. **Persistence and rollback compatibility:** seed multiple tabs, active-tab selection, editor/view preferences, theme, and full-width preference; reload; edit and reload; reopen on the same origin. Confirm tab/document content and preferences survive. Verify the pre-migration script can load the post-migration fixture without data loss.
2. **Transfer:** with both Studios open on the same origin, test live BroadcastChannel delivery, queued delivery after receiver focus/reload, target filtering, title extension, language/content preservation, duplicate delivery handling, and queue cap. Also confirm expected behavior when Studio origins differ (no false promise of cross-origin transfer).
3. **Markdown/Mermaid:** test render and error recovery for backtick and tilde fences, nested/quoted/indented fences, info strings, delayed renders, rapid edits, and Studio open/close. Test common Studio actions and templates, theme isolation, and repeated setup/cleanup.
4. **Editor controls:** test toolbar and palette insertion with empty and selected text, image insertion, keyboard shortcuts while focus is in editor/input/modal, tabs, wrap toggle, resize, and line-number alignment for long documents with wrapped lines. Repeat with preview sync on/off and after tab switches.
5. **Exports:** exercise raw Markdown copy, rendered HTML copy, standalone HTML export, SVG and PNG diagram export including invalid/empty diagrams and export failures, and clipboard fallback. Compare exported content with the current rendered document.
6. **Print:** use a tall 26-step diagram and confirm all steps appear across pages without clipping. Run Chromium, Edge, Chrome, and Firefox. Retain the user-verified Firefox PDF result and sample output; distinguish it from any unavailable automated PDF capture mechanism.
7. **Launch-mode and browser matrix:** execute the supported workflow matrix from a local folder and a local server in Chromium, Edge, Chrome, and Firefox. Include same-origin transfer when both Studios are served from the same local-server origin.

**Historical planning snapshot (November 14, 2026):** no runtime QA had been run at the time this plan was drafted. The handoff’s reported remediation matrix (619 passes, 0 failures, 1 blocked, 0 unrun) applied to the frozen standalone candidate, not to the live entry point. The phase-specific reviews and QA/QC results are summarized in the current status section at the top of this document.

## Branch, rollback, and gate

- **Historical implementation target:** the initial plan proposed `migration/phase6-live-port`. The implementation was instead carried on `wp/studio_migration`; use the current branch and candidate pins in the status section above for integration and release review. Re-pin all revisions before any future changes because branch heads may move.
- **Batches:** keep the batches above reviewable and separate where practical. Do not combine a storage schema change with rendering fixes. Prefer unchanged schemas; if a schema change becomes necessary, define forward and backward compatibility before coding.
- **Rollback pin:** record the exact pre-migration `main` commit, live path, and SHA-256 immediately before changes. Roll back by restoring that exact live file/version. Do not clear or rewrite browser storage during rollback. Prove the restored version reads the same documents and preferences from the same profile.
- **Migration gate:** coder supplies the candidate and change map; QA/QC tests one frozen candidate against this plan and retains browser-specific results and sample exports; an independent auditor makes the gate decision. Require all non-deferred criteria to pass, explain any blocked criterion with evidence and residual risk, and ensure no document/pref regression before release.

## Original implementation decision (completed)

The source supported a selective semantic port, not direct patch application. The original plan called for confirmed normal live launch origins, a reproduced live baseline for the gutter and each candidate fix, and a frozen pre-migration state before implementation. Phases 1–4 have since been implemented and reviewed. The outstanding launch-origin confirmation is now a production acceptance and release gate; see the current next steps above.
