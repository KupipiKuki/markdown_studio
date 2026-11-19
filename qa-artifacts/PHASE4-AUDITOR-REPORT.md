# Phase 4 auditor report — QA/QC of the coder's Phase 4 work

Prepared for the independent reviewer. Handoff under audit: `markdown-studio-phase-4-handoff.md` (repo root).

## 1. Candidate identity (re-verified, not assumed)

| Pin from handoff | Expected | Actual | Match |
| --- | --- | --- | --- |
| Migration branch | `wp/studio_migration` | local tip `1f06a9d` (Phase 4 commits not yet pushed; remote still the Phase 3 tip) | yes |
| Implementation base (handoff tip) | `6e43ca7620a0a630c56d7ada48bab8917caf0b82` | re-hashed from the tree — identical | yes |
| Live-file blob at base | `cd0b2826906af730fd41a2c9b53a99e24bc3888f` | `git hash-object` of base's `scripts/markdown-studio.html` — identical (Phase 3 sign-off blob) | yes |
| Phase 4 frozen candidate | (recorded in PHASE4-QA-RESULTS.md) | `1f06a9dfb75ad4e74caad8b56402cf8a902f9211` ("Phase 4: export/print render readiness, …") | yes |
| Live file blob at candidate | (recorded) | `fe1c93e50f686d50a8471507d9cfc78cd112bced` | recorded |
| Changed files | candidate scope only | `scripts/markdown-studio.html` **556 additions / 74 deletions** vs base `6e43ca7`; new `tests/phase4.spec.js` (735/0). Evidence/report adds QA artifacts only | yes |
| Other candidate content | — | the reviewer's Phase 3 final approval record (`markdown-studio-phase-3-review.md`, +40 lines, documentation only) and the handoff document itself, committed with the candidate per prior-phase practice | recorded |

Freeze discipline: the app script was frozen in `1f06a9d` and **not modified afterwards** — both full matrices (§4) ran against the committed candidate; the working tree is clean apart from freshly generated QA evidence and this report.

## 2. Scope / boundary audit

- Boundary grep over the candidate app diff (`git diff 6e43ca7..1f06a9d -- scripts/markdown-studio.html`, added lines): **no** hits for `markflow_*`, `gemini_studio_*`, `BroadcastChannel`, `localStorage`/`sessionStorage`, CDN tags, or slide/presentation identifiers; no changes to the markdown parser, Mermaid dependency/version, or the editor pipeline. All added regions map to the handoff's scope: render-state tracking + readiness gate (export/print/copy handlers), clean-content + standalone-HTML generation, card SVG/PNG export with sanitize + failure paths, and the `@media print` block.
- One addition beyond the handoff's literal rule list, flagged here for the reviewer: `getCleanRenderedContent()` also removes `.code-block-actions` / `.code-action-btn` — the Stage 4 per-code-block transfer bars. Reason: the very first standalone-export run left those two live-studio buttons in the exported document as dead controls (their handlers do not exist in the exported page). The live Studio behavior is unchanged; only the exported copy is cleaned. P4-03 now asserts zero buttons in the exported document (see freeze log item 3 in the QA results).
- Phase 1–3 preservation confirmed two ways: (a) code — no earlier-phase regions appear in the diff hunk header set; (b) tests — `tests/phase1-3.spec.js` are byte-identical to the Phase 3 accepted state and rerun fully green against the candidate (P4-09, §4).

## 3. Finding-by-finding verdicts (code audit + QA evidence)

| Finding | Coder verdict | Auditor verdict | Basis |
| --- | --- | --- | --- |
| R13 export/print readiness (A6-01) | CHANGED | CONFIRMED | `ensurePreviewRenderReady()` (~l.5565): bounded loop (10 attempts, 1500ms per-await cap via `Promise.race`), settled-generation check against the new `previewRenderSettledGen` advanced by the `renderAllPreviewDiagrams` wrapper's `try/finally` (~l.2950); churn triggers `updatePreview()`; stall pauses 150ms. All five export/print/copy surfaces gate on it first (~l.5804-5840). P4-01/P4-05: export/copy reflect the newest document under a pending slow render and across a tab switch; a never-settling render aborts all surfaces with the documented toast + error-log entry and **no stale output** (no download observed) — 8/8 browser-origin pairs |
| Retry exhaustion (bounded abort) | CHANGED | CONFIRMED | Handoff asked for "bounded attempts then abort with feedback (no hang, no stale output)" — the port is bounded (≈10 × 1.65s) and P4-05 exercises the never-settling case on all four browsers × both origins; abort latency ≈27s per surface by design; evidence records `errorLogBefore: 0 → errorLogAfterExport: 1` and `exportDownloadObserved: false` |
| A6-03 clean content | CHANGED | CONFIRMED | Clone-based `getCleanRenderedContent()` (~l.5627): live preview unchanged by copies (`liveBefore` == `liveAfter`: 16 action buttons, 2 headers, 1 error card, zoom 1.25 — P4-02); error/unrendered cards exported as `<pre><code class="language-mermaid">` source with `INVALID_DIAG_MARKER` present; standalone file (P4-03) opens clean in a fresh context: 1 heading, ≥1 svg, **0 buttons**, Inter font, template width cap, zero page errors, no `diag-action-btn`/`mermaid-header`/`mermaid-error-card`/zoom-data attributes in the body payload — 8/8 pairs |
| Print pagination of tall diagrams | CHANGED | CONFIRMED | `@media print` block (~l.1766): normal flow, editor hidden, cards `break-inside: auto`, error-card/pre/blockquote avoid, viewport `overflow: visible` / `max-height: none`, canvas transform none, svg max-width 100%. P4-08 on the 26-step chain: svg computed height 2176px, all 26 step labels counted in print media including first/middle/final, document scroll 2284px > 2 × 720px viewport, editor pane `display: none` — 8/8 pairs. Chromium-family additionally produced real A4 PDFs (artifacts `PHASE4-P4-08_tall_<project>.pdf`, > 30KB, multi-page heuristic) |
| R14 SVG sanitize (foreignObject) | CHANGED | CONFIRMED | `sanitizeSvgForExport()` (~l.3357): foreignObject → SVG text; P4-06 asserts no foreignObject in exported SVGs while the flowchart label (`FCLABEL_ONE hello`) and sequence label (`SEQLABEL_ping`) survive; `exportDiagramSvg()` adds intrinsic dimensions + viewBox so files open at correct size — 8/8 pairs |
| R14 PNG failure paths | CHANGED | CONFIRMED | `exportDiagramPng()` (~l.3431): valid export produces a real PNG (~5KB evidence); the three injected failure paths (image load, blob URL creation, canvas conversion) surface three distinct actionable toasts; `URL.revokeObjectURL` runs on success and each failure path (`objectUrlHygiene: "all created URLs revoked on success and failure paths"`); a post-failure recovery export succeeds — 8/8 pairs |
| Clipboard surfaces (A6-03 shadow) | CHANGED | CONFIRMED | P4-04: raw-MD copy uses current content on both surfaces; denial surfaces feedback; rendered-HTML copy delivers the cleaned document (`clipboardOps: "raw x2, denial x2, rendered x1"`) — 8/8 pairs |

## 4. QA/QC matrix (frozen candidate `1f06a9d`)

Environments: Windows 11 x64; Playwright 1.65.1 headless; Chromium, Microsoft Edge (channel `msedge`), Google Chrome (channel `chrome`), Firefox. Origins: `file:///C:/Git/markdown_studio/scripts/markdown-studio.html` and `http://127.0.0.1:8642/scripts/markdown-studio.html` (python http.server at repo root). Fresh context per test; `--retries=0` (no failure was retried away).

| Suite (per handoff) | file:// | http://127.0.0.1:8642 |
| --- | --- | --- |
| P4-01..P4-08 (8 tests x 4 browsers) | 32 passed | 32 passed |
| P4-09 Phase 1 regression (24 x 4) | 92 passed / 4 skipped (SM-03 origin-dependent, by design) | 96 passed |
| P4-09 Phase 2 regression (7 x 4) | 28 passed | 28 passed |
| P4-09 Phase 3 regression (7 x 4) | 28 passed | 28 passed |
| **Total (184 per origin, P4-10 record)** | **180 passed / 4 skipped / 0 failed** | **184 passed / 0 failed** |

Logs: `qa-artifacts/phase4-matrix-fileorigin.log`, `qa-artifacts/phase4-matrix-http.log` (exit 0, 1.9m each); Phase 4 smoke log `qa-artifacts/phase4-fullmatrix-smoke.log` (32/32 pre-freeze, identical content). File-origin Phase 4 evidence preserved under `qa-artifacts-fileorigin/` (evidence JSONs, tall PDFs, matrix log); tracked evidence regenerated by the matrix run and committed alongside (prior-phase practice).

### Fit-for-purpose deviations (documented, not hidden)

- **Firefox PDF (P4-08 artifact)**: recorded BLOCKED, not passed. Playwright 1.65 exposes `page.pdf()` on Firefox but the call throws; the handoff allows exactly this disposition ("record the check as blocked rather than passed") when no supported workflow exists. Print-media layout assertions and the `window.print()` readiness gate do pass on Firefox, so the user-facing print path is covered; only the automated PDF artifact is engine-blocked.
- **`ensurePreviewRenderReady()` bounded vs unbounded**: the reference port waits without a bound; the handoff itself required a bounded abort, and the QA notes the port cannot hang on never-settling renders (P4-05), which is an improvement over the reference.
- **`.code-action-btn`/`.code-block-actions` removal** (§2): export-only cleaning of Stage 4 transfer bars, found by QA before freeze; live behavior unchanged.

## 5. Open items

- **Production launch URL: OPEN** (cross-phase rollout dependency since Phase 1). Coverage here is file:// and localhost HTTP only and is not labeled production coverage. Once the URL is supplied, a production-origin pass is required before launch-origin coverage can be declared complete.
- Replay cost of P4-05 (~27s/browsers × 8 runs across the matrices) is by design (bounded abort window); no action needed.

## 6. Recommendation

Phase 4 candidate `1f06a9d` (blob `fe1c93e5`) implements every handoff finding with confirmed coverage on Chromium, Edge, Chrome, and Firefox over both covered origins, with zero failures across the 184-check matrix (180 pass / 4 expected origin-dependent skips per file-origin run). The one in-QA application fix (export cleanliness of the Stage 4 transfer bars) is low-risk, export-scoped, and verified. Subject to the standing production-launch-URL dependency, I recommend the reviewer proceed to Phase 4 sign-off.
