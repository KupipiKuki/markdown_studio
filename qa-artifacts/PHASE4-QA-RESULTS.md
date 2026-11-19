# Phase 4 QA/QC results and change map

Frozen candidate under test:

- Branch: `wp/studio_migration`
- Commit: `1f06a9dfb75ad4e74caad8b56402cf8a902f9211` ("Phase 4: export/print render readiness, clean standalone export, bounded retry abort, print pagination, SVG/PNG export hardening")
- Live file blob at the candidate: `scripts/markdown-studio.html`, git blob `fe1c93e50f686d50a8471507d9cfc78cd112bced`
- Implementation base (per Phase 4 handoff pins, re-verified before coding): tip `6e43ca7620a0a630c56d7ada48bab8917caf0b82` (`6e43ca7`), live blob `cd0b2826906af730fd41a2c9b53a99e24bc3888f` — the Phase 3 accepted candidate, identical to the frozen Phase 3 sign-off blob
- Changed files: `scripts/markdown-studio.html` (**556 additions / 74 deletions** vs base `6e43ca7`), new `tests/phase4.spec.js` (735 lines), plus the Phase 3 final approval record appended to `markdown-studio-phase-3-review.md` and the new `markdown-studio-phase-4-handoff.md` (no code changes in either)

## Candidate history (QA freeze log)

1. Implementation drafted against the pinned base, with the Phase 4 spec written alongside (`tests/phase4.spec.js`, checks P4-01..P4-08 plus P4-09/P4-10 regression coverage executed via the full phase1-3 suites).
2. Spec-tuning runs (chromium, `--retries=0`) surfaced harness-side issues only, fixed in the spec before freezing: negative cleanliness assertions originally matched the standalone template's own defensive CSS (scoped to the body payload instead); the P4-06 label count over-asserted (flowchart has exactly two node labels, relaxed to `>= 2`); the 2.8s toast window fed stale matches into successive PNG-failure steps (a `clearToast` reset was inserted before each of the five PNG clicks); the P4-08 probe selected the card's header-icon svg instead of the diagram (`.mermaid-canvas svg`); and the fake object-URL injection legitimately logs a browser console error on the rejected anchor load, which is now filtered as expected instrumentation noise (Chromium: "Not allowed to load local resource: blob:FAKE-URL"; Firefox: `"Security Error: ... may not load data from blob:FAKE-URL."`).
3. **One application defect was found and fixed during this tuning, before the freeze**: the first standalone-export run contained two `<button class="code-action-btn">` elements — the live app's per-code-block "↗ Notepad++ / ▶ Run in Notebook" transfer bars (Stage 4 cross-studio feature) survive into the exported document as dead buttons (their handlers reference functions that do not exist in the exported page). `getCleanRenderedContent()` now removes `.code-block-actions` / `.code-action-btn` along with the diagram action furniture, and `generateStandaloneHtml()`'s defensive hiding CSS was extended to the same classes. P4-03 asserts zero buttons in the exported document; this was the defect failing it.
4. Candidate frozen as `1f06a9d` (blob `fe1c93e5`). Full four-browser sweep of `tests/phase4.spec.js`: **32 passed / 0 failed** in 56s (smoke log `qa-artifacts/phase4-fullmatrix-smoke.log`, run against the exact frozen content pre-commit). Full matrices below ran against the committed candidate.
5. One engine-capability update discovered during the sweep: Playwright 1.65 exposes `page.pdf()` on Firefox, so the handoff's "Firefox PDF = BLOCKED" assumption is now recorded dynamically rather than assumed — the attempt is made for every engine; Firefox's call throws and the outcome is recorded as `pdfBlocked` evidence (print-layout assertions still gate), while Chromium-family engines produce an actual multi-page PDF artifact.

## Change map (handoff finding -> verdict -> live location)

| Finding | Verdict | Live location (candidate) | Notes |
| --- | --- | --- | --- |
| R13 export/print readiness (A6-01) | CHANGED | `ensurePreviewRenderReady()` (~l.5565) | Bounded readiness loop: up to 10 attempts, each await capped at 1500ms via `Promise.race`; watches the new `previewRenderSettledGen` (advanced by the `renderAllPreviewDiagrams` wrapper in `try/finally`, ~l.2950) so only a fully settled pass counts; render churn during waiting triggers `updatePreview()`; a stall pauses 150ms between attempts. On abort: toast "Document rendering is still in progress. Please wait and retry." plus `logError('Export', 'Aborted: ...')`. Cannot hang on a never-settling render (improvement over the reference port). |
| Retry exhaustion (bounded abort, no stale output) | CHANGED | same as above; evidence P4-05 | A never-settling render (instrument stall) aborts every export/print/copy path after the bounded window; no download occurs, the error log gains one entry, and the toast is shown on all five surfaces tested (HTML export, print, copy HTML, copy MD, card-set exports covered separately). |
| A6-03 clean content for export/copy | CHANGED | `getCleanRenderedContent()` (~l.5627) + `generateStandaloneHtml()` (~l.5700) | Clone-based (no live-mutation — P4-02 asserts the live preview's action buttons/headers/error cards/zoom attrs are unchanged after every copy); removes `.mermaid-header`, `.diag-action-btn`, `.mermaid-actions`, `.mermaid-raw-code`, and (the in-QA fix) `.code-block-actions`/`.code-action-btn`; error/unrendered cards become their Mermaid source as `<pre><code class="language-mermaid">`; valid cards get transforms/zoom/viewport caps reset. Template ships full typography CSS; defensive hiding CSS covers all removed classes. |
| Export handlers | CHANGED | `#btnExportHtml` / `#btnPrintPdf` / `#btnCopyHtml` / `#btnCopyMd` handlers (~l.5804-5840) | All export/print/copy surfaces gate on `ensurePreviewRenderReady()` first; export = ready -> clean content -> standalone HTML -> `triggerDownload`; print = ready -> `window.print()`; copy HTML = ready -> clean content -> `copyToClipboard`; copy MD uses current editor content through `copyToClipboard`. |
| Render staleness (P4-01) | CHANGED | `updatePreview()` debounce + `currentPreviewRenderPromise` / `currentMathJaxPromise` (~l.2925-2950) | The debounce now assigns the render pass's promise; readiness awaits the newest generation, so an export after a tab switch or a last-keystroke edit reflects the newest document, not the previously settled render. Verified with a slow-marker render: slow render pending -> edit + export -> export file reflects the edit; exported-after-tab-switch reflects the second tab's document (P4-01 evidence). |
| Print pagination of tall diagrams | CHANGED | `@media print` (~l.1766) | Print flow: workspace/preview panes set to normal flow, editor pane hidden, cards `break-inside: auto` with pre/blockquote/error-card avoid rules, viewport overflow visible + max-height none, canvas transform none, svg max-width 100%. Verified on a 26-step chain diagram (intrinsic svg height 2176px): all 26 step labels present in print media, document spans > 2 viewports, viewport not clipping. Chromium-family: actual A4 PDF produced per browser (`PHASE4-P4-08_tall_<project>.pdf`, > 30KB each, page-count heuristic > 1 page). Firefox: `page.pdf()` throws in Playwright 1.65; recorded BLOCKED with layout assertions gating (`PHASE4-P4-08.evidence.json`, `pdfBlocked`). |
| R14 SVG sanitize (foreignObject) | CHANGED | `sanitizeSvgForExport()` (~l.3357) + `exportDiagramSvg()` (~l.3393) | Exported SVG gets intrinsic dimensions + viewBox; foreignObject content (Mermaid edge labels) converted to SVG text with inherited fills; no foreignObject remains in the exported file (P4-06), node labels preserved (`FCLABEL_ONE` / `SEQLABEL_ping`). |
| R14 PNG failure paths | CHANGED | `exportDiagramPng()` (~l.3431) | Full reference port: image load, blob creation, and canvas conversion each surfaced with an actionable toast + `logError('Export', ...)`, and `URL.revokeObjectURL` runs on success and every failure path — no leaked object URLs on any of the 5 exercised paths (valid export + image-load failure + bad blob URL + toBlob failure + recovery, P4-07 evidence `"objectUrlHygiene"`). |

Constraints audit: the application diff touches only the regions above; no changes to the editor pipeline, markdown parser, Mermaid dependency/version, slide/presentation logic, storage keys, `markflow_*` / `gemini_studio_*` /
`BroadcastChannel` machinery, or CDN tags (grep of the candidate diff vs base `6e43ca7`). The only template-level additions are inside `generateStandaloneHtml()`'s own output. Notably, the `.code-action-btn` removal is a *replacement-rule* addition in the export clean-content step; the live studio behavior (Stage 4 transfer buttons) is unchanged.

## QA matrix (candidate `1f06a9d`, frozen)

Environments: Windows 11 x64; Playwright 1.65.1 headless; Chromium, Edge (channel), Chrome (channel), Firefox. Origins: `file:///C:/Git/markdown_studio/scripts/markdown-studio.html` and `http://127.0.0.1:8642/scripts/markdown-studio.html` (python http.server). Fresh context per test, `--retries=0`.

| Suite | file:// | http://127.0.0.1:8642 |
| --- | --- | --- |
| P4-01..P4-08 (`tests/phase4.spec.js`, 8 tests x 4 browsers) | 32 passed | 32 passed |
| P4-09 Phase 1 regression (`tests/phase1.spec.js`, 24 tests x 4 browsers) | 92 passed / 4 skipped (SM-03 origin-dependent) | 96 passed |
| P4-09 Phase 2 regression (`tests/phase2.spec.js`, 7 tests x 4 browsers) | 28 passed | 28 passed |
| P4-09 Phase 3 regression (`tests/phase3.spec.js`, 7 tests x 4 browsers) | 28 passed | 28 passed |
| **Total (184 checks per origin, P4-10 record)** | **180 passed / 4 skipped / 0 failed** | **184 passed / 0 failed** |

Logs: `qa-artifacts/phase4-matrix-fileorigin.log`, `qa-artifacts/phase4-matrix-http.log` (both exit 0, 1.9m each). File-origin Phase 4 evidence preserved under `qa-artifacts-fileorigin/` (`PHASE4-P4-0x-fileorigin.evidence.json`, `PHASE4-P4-08_tall_<project>-fileorigin.pdf`, matrix log). The 4 skips are the by-design SM-03 file-origin skips carried over from the Phase 1 suite.

### Per-check evidence highlights (Phase 4)

- P4-01 (staleness): slow-marker render pending -> copy HTML reflects "Version B" (the newer edit); export after a tab switch produces a file reflecting "Second Tab Doc"; print preview reflects the same. Evidence: `PHASE4-P4-01.evidence.json`.
- P4-02 (clean, no mutation): live preview before/after copy identical (actionButtons 16, headers 2, errorCards 1, zoom attr 1.25 — recorded `liveBefore`/`liveAfter` pairs); copied HTML drops all of them. Evidence: `PHASE4-P4-02.evidence.json`.
- P4-03 (standalone quality): exported file opens in a fresh context; h1 present, rendered svg present, **0 buttons**, Inter body font, body width within template cap; error card converted to Mermaid source with `INVALID_DIAG_MARKER` visible; payload contains no `diag-action-btn` / `mermaid-header` / `mermaid-error-card` / `data-`-action-zoom attributes; no page errors on load. Evidence: `PHASE4-P4-03.evidence.json` (+ `P4-03_rich_<project>.html` exports under the OS temp dir).
- P4-04 (clipboard): raw-MD copy x2 uses current content; denial surfaces feedback on both copy surfaces; rendered-HTML copy succeeds once with the cleaned content (`clipboardOps: "raw x2, denial x2, rendered x1"`). Evidence: `PHASE4-P4-04.evidence.json`.
- P4-05 (bounded abort): a never-settling render aborts each of the 4 export/print/copy surfaces; no download observed; error-log count 0 -> 1 per surface; toast messages recorded. ~27s per browser by design (10 attempts x (1500ms cap + 150ms pause)). Evidence: `PHASE4-P4-05.evidence.json`.
- P4-06 (SVG sanitize): exported SVGs contain no foreignObject; flowchart node label `FCLABEL_ONE hello` and sequence label `SEQLABEL_ping` survive as text; intrinsic width/viewBox present. Evidence: `PHASE4-P4-06.evidence.json`.
- P4-07 (PNG paths): valid export produces a real PNG (~5KB recorded); the three failure paths surface distinct actionable toasts ("image could not be loaded", "Blob URL creation failed", "image conversion failed"); all created object URLs revoked on success and failure paths; a recovery export after failures succeeds. Evidence: `PHASE4-P4-07.evidence.json`.
- P4-08 (print pagination): print-media layout — card flows (`display: block`, `break-inside: auto`), viewport `overflow: visible` / `max-height: none`, editor pane hidden, svg computed height 2176px, all 26 step labels present, document scroll height 2284px > 2x the 720px viewport. Chromium/Edge/Chrome: actual A4 PDFs saved as artifacts (> 30KB, multi-page); Firefox: PDF portion recorded BLOCKED (engine limitation), layout assertions passed. Evidence: `PHASE4-P4-08.evidence.json` + `PHASE4-P4-08_tall_<project>.pdf`.

## Deprecated checks

None this phase. All P4-01..P4-08 checks are new and retained; the regression record (P4-09/P4-10) is the R15-style matrix above.

## Open items / deviations

- **Production launch URL: still OPEN** (cross-phase rollout dependency). Coverage is on file:// and http://127.0.0.1:8642 origins only; the production-origin pass-through remains to be recorded when the URL is known.
- **Firefox PDF export of the tall-fixture artifact is BLOCKED-by-engine** (documented in P4-08 evidence): Playwright's Firefox cannot produce `page.pdf()`. The handoff allowed this exact disposition. The user-facing print path on Firefox is exercised through the print-media layout assertions and the `window.print()` readiness gate (P4-01 print case, which passes on Firefox).
- Deviations from the reference port: `ensurePreviewRenderReady()` uses a bounded attempt loop (10 x 1500ms) instead of an unbounded wait, per the handoff's own improvement note; the `getCleanRenderedContent()` rule set additionally removes the Stage 4 code-block transfer bars (defect found in QA, item 3 of the freeze log).
- QA also fixed a stale-name issue in its own smoke log (`phase4-fullmatrix-smoke.log` predates the freeze by minutes with identical content; the authoritative post-freeze logs are the two matrix logs).

## Run commands (reproducibility)

```bash
npx playwright test tests/phase1.spec.js tests/phase2.spec.js tests/phase3.spec.js tests/phase4.spec.js \
  --project=chromium --project="Microsoft Edge" --project="Google Chrome" --project=firefox --retries=0
# http origin: python -m http.server 8642 at repo root, then
P1_BASE_URL=http://127.0.0.1:8642/scripts/markdown-studio.html npx playwright test ... (same)
```
