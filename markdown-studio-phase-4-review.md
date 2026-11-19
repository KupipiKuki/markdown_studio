# Markdown Studio Phase 4 independent review

Reviewed November 15, 2026  
Scope: frozen Phase 4 code candidate, QA/QC evidence, and handoff acceptance.

## Candidate verified

- Migration branch: [`wp/studio_migration`](https://github.com/KupipiKuki/markdown_studio/tree/wp/studio_migration)
- Branch tip at review: `945fb23745ae138772ec1b3b777109dc18720219`
- Frozen Phase 4 candidate: `1f06a9dfb75ad4e74caad8b56402cf8a902f9211`
- Candidate live-file blob: `fe1c93e50f686d50a8471507d9cfc78cd112bced`
- Current branch live-file blob: `fe1c93e50f686d50a8471507d9cfc78cd112bced` (matches frozen candidate)
- QA results: [`PHASE4-QA-RESULTS.md`](https://github.com/KupipiKuki/markdown_studio/blob/wp/studio_migration/qa-artifacts/PHASE4-QA-RESULTS.md)
- Independent QA/QC: [`PHASE4-QAQC.md`](https://github.com/KupipiKuki/markdown_studio/blob/wp/studio_migration/qa-artifacts/PHASE4-QAQC.md)
- Coder/auditor report: [`PHASE4-AUDITOR-REPORT.md`](https://github.com/KupipiKuki/markdown_studio/blob/wp/studio_migration/qa-artifacts/PHASE4-AUDITOR-REPORT.md)

Commits after the frozen candidate add QA reports and artifacts; no application code changed after freeze. QA reports full reruns with zero failures: `file://` 180 passed / 4 expected transfer skips; localhost HTTP 184 passed, across Chromium, Edge, Chrome, and Firefox. I inspected source, logs, reports, and artifacts; I did not rerun Playwright.

## Confirmed Phase 4 areas

- Clean-content export clones the live preview, removes Studio-only controls, and keeps the live preview unchanged.
- The QA caught and corrected leaked Stage 4 code-block transfer buttons before the candidate freeze; standalone output now contains no dead buttons.
- The bounded abort path records an error and stops export/print/copy when rendering never settles, without a stale download.
- SVG sanitization removes `foreignObject` and retains tested flowchart and sequence labels. PNG QA records distinct failure messages and object-URL cleanup on success and failure.
- Tall-diagram print layout passes in all browsers. Chromium, Edge, and Chrome produced three-page PDFs for the 26-step fixture. Firefox PDF artifact generation is explicitly **blocked**, while its print-layout assertions pass.

## Open code finding — P4-01 readiness can accept an older render after a theme change

**Severity: P2.** `ensurePreviewRenderReady()` snapshots `watchGen`, waits on the current render promise, then accepts readiness when `previewRenderSettledGen >= watchGen`. The theme toggle calls `renderAllPreviewDiagrams()` directly and replaces `currentPreviewRenderPromise` without changing document content or starting `renderDebounceTimer`.

If an export/print readiness check is waiting on render generation N, and the user toggles the theme so generation N+1 starts, the readiness check can still be awaiting generation N's already-captured promise. Once N settles, the check sees unchanged tab/content, no debounce timer, and `previewRenderSettledGen >= watchGen`, then returns ready even though N+1 is still rendering. The export can therefore clone an SVG from the old theme while the standalone document uses the new theme.

Relevant code: [`ensurePreviewRenderReady()`](https://github.com/KupipiKuki/markdown_studio/blob/1f06a9dfb75ad4e74caad8b56402cf8a902f9211/scripts/markdown-studio.html#L5575-L5625), especially the generation check around line 5605; the direct theme rerender is in [`applyTheme()`](https://github.com/KupipiKuki/markdown_studio/blob/1f06a9dfb75ad4e74caad8b56402cf8a902f9211/scripts/markdown-studio.html#L5890-L5912).

Recommended correction: after each await, confirm that the generation being awaited is still the current generation and that the current generation has settled; if not, retry using the current promise/generation. Add a P4-01 regression that delays one render, starts an export, toggles the document theme so a newer render starts, allows the old render to settle first, and verifies export/print waits for the newer themed diagram. Rerun all Phase 1–4 matrices against the new frozen candidate.

## Exceptions and disposition

- **Production launch URL:** still unknown. Keep launch-origin coverage open; `file://` and localhost are not production-origin substitutes.
- **Firefox PDF artifact:** correctly recorded as blocked by the Playwright engine limitation, not as passed. Keep the print-layout check pass and artifact-generation check blocked as separate results.
- **Overall:** R13/R14 implementation and QA are strong, but P4-01 does not yet cover the theme-change race. Phase 4 sign-off should remain open until that race is fixed and retested. No other new issue was found in this review.
