# Phase 4 QA/QC report — independent verification of the coder's Phase 4 work

Prepared for the independent auditor. This is the QA/QC pass over the coder's
Phase 4 implementation; the coder's own results are in `PHASE4-QA-RESULTS.md`
and `PHASE4-AUDITOR-REPORT.md` (commit `a4d5bd9`). Handoff under test:
`markdown-studio-phase-4-handoff.md`.

## 1. Candidate identity — re-verified from git, not assumed

| Item | Expected | Re-verified actual | Match |
| --- | --- | --- | --- |
| Branch | `wp/studio_migration` | `wp/studio_migration`, working tree clean | yes |
| Handoff base tip | `6e43ca7620a0a630c56d7ada48bab8917caf0b82` | identical | yes |
| Live blob at base | `cd0b2826906af730fd41a2c9b53a99e24bc3888f` | re-hashed from `6e43ca7:scripts/markdown-studio.html` — identical (Phase 3 sign-off blob) | yes |
| Phase 4 candidate | `1f06a9d` | `1f06a9dfb75ad4e74caad8b56402cf8a902f9211` | yes |
| Live blob at candidate | `fe1c93e5...` | `fe1c93e50f686d50a8471507d9cfc78cd112bced`, re-hashed — identical; also identical at evidence tip `a4d5bd9` (freeze discipline holds: app untouched after freeze) | yes |
| Changed files (candidate) | app + new spec only | `git diff --numstat 6e43ca7..1f06a9d -- scripts tests`: `556 74 scripts/markdown-studio.html`, `735 0 tests/phase4.spec.js`; nothing else | yes |
| Evidence commit | QA artifacts only | `a4d5bd9d28348118221270d0f103cf30dffc0ed1` — 193 files, all under `qa-artifacts/` and `qa-artifacts-fileorigin/` | yes |

## 2. Scope / boundary audit (independent)

- The app diff has exactly **10 hunks**, all mapping to handoff scope:
  - `@@1764` — `@media print` pagination CSS
  - `@@2868/2886/2895` — render-state tracking (`currentPreviewRenderPromise`, `currentMathJaxPromise`, `previewRenderSettledGen`), debounce promise capture
  - `@@3280/3297` — `sanitizeSvgForExport`, `exportDiagramSvg`, `exportDiagramPng`
  - `@@3643` — MathJax promise capture + debounce capture in `updatePreview`
  - `@@5305` — `ensurePreviewRenderReady`, `getCleanRenderedContent`, `generateStandaloneHtml`
  - `@@5342/5426` — export/print/copy handlers; initial-render promise capture
- Forbidden-scope grep over added lines: **no** hits for `markflow_*`, `gemini_studio_*`, `BroadcastChannel`, `localStorage`/`sessionStorage`, slide/presentation identifiers, or Mermaid dependency/version changes. The single `googleapis.com` hit is the Inter font `<link>` inside `generateStandaloneHtml()`'s own exported template (a string, matching the audited reference), not a live-app dependency change. The `cdnjs.cloudflare.com` highlight.js theme line appears only as unchanged context.
- Phase 1–3 spec files are byte-identical between base and candidate; no earlier-phase code regions appear in the hunk set.
- The one extra clean-content rule beyond the handoff's literal list (`.code-block-actions`/`.code-action-btn` removal) was traced to a real defect the coder's own QA caught pre-freeze: the Stage 4 per-code-block transfer bars otherwise ship in standalone exports as dead buttons. Export-scoped only; live Studio behavior unchanged. Accepted.

## 3. Independent test rerun (QA did not trust the coder's logs)

Fresh runs against the committed candidate `1f06a9d` (worktree = `a4d5bd9`, app blob `fe1c93e5`), Playwright 1.65.1 headless, `--retries=0`, fresh context per test, 10 workers:

| Run | Command basis | Result |
| --- | --- | --- |
| `qa-artifacts/phase4-qaqc-rerun-fileorigin.log` | phase1+2+3+4 specs × 4 browsers, `file:///...scripts/markdown-studio.html` | **180 passed / 4 skipped / 0 failed** (1.9m, exit 0) |
| `qa-artifacts/phase4-qaqc-rerun-http.log` | same, `P1_BASE_URL=http://127.0.0.1:8642/scripts/markdown-studio.html` (python http.server 8642) | **184 passed / 0 failed** (1.8m, exit 0) |

- The 4 file-origin skips are exactly the by-design SM-03 "shared http origin only" skips (one per browser).
- Sorted outcome sets of the QA reruns are **identical** to the coder's committed matrix logs (`phase4-matrix-fileorigin.log`, `phase4-matrix-http.log`), 184 lines each — same passes, same skips, zero failures in both.
- Phase 4 checks: 32/32 on both origins (8 checks × 4 browsers).

## 4. Evidence artifact validation

- All 8 `PHASE4-P4-0x.evidence.json` parse and carry per-check payloads (http-origin copies hold the last-running project, firefox; file-origin copies under `qa-artifacts-fileorigin/` hold `file:///` launches — verified: P4-01 file-origin evidence shows `copiedHtmlReflects: "Version B while the exported-after-tab-switch file reflects Second Tab Doc"`).
- P4-08 tall PDFs: `PHASE4-P4-08_tall_{chromium,Microsoft Edge,Google Chrome}.pdf` are valid `%PDF-1.4` files, ~30KB each, **3 pages** each by the `/Type /Page` heuristic — the 26-step diagram spans three printed pages with no clipping (layout evidence: svg computed height 2176px, 26/26 step labels, viewport overflow visible / max-height none, editor pane hidden, document 2284px > 2×720px viewport).
- Firefox P4-08: `pdfPages: null`, `pdfBlocked: "page.pdf unavailable or failed for this engine; print-layout assertions still passed"` — the handoff-sanctioned BLOCKED disposition, recorded as evidence rather than passed. Noted for the auditor: Playwright 1.65 exposes `page.pdf` on Firefox but the call throws; the spec now attempts it per-engine and records the outcome dynamically instead of hard-coding the assumption.
- P4-05 bounded-abort evidence: `exportDownloadObserved: false`, error-log count 0 → 1 on abort; ~27s per browser by design (10 × (1500ms cap + 150ms pause)).
- P4-07 evidence: valid PNG bytes recorded, three distinct failure toasts, `objectUrlHygiene: "all created URLs revoked on success and failure paths"`.
- File-origin preservation is additive (11 PHASE4 files + matrix log under `qa-artifacts-fileorigin/`); no tracked evidence was deleted.

## 5. Findings

- No new defects found in this pass. The candidate matches its reports; the freeze discipline held (app blob identical at `1f06a9d` and `a4d5bd9`).
- Observation (not a defect): per-check evidence JSONs in `qa-artifacts/` are overwritten by each project in turn, so they hold the last-running project (firefox, http origin). The `qa-artifacts-fileorigin/` copies preserve the file-origin values. Same convention as prior phases; noted so the auditor reads them correctly.

## 6. Open items (unchanged)

- **Production launch URL: OPEN** — coverage here is file:// and localhost HTTP only; not production coverage. Required before launch-origin coverage can be declared complete.
- Firefox automated PDF artifact: BLOCKED-by-engine (P4-08), documented with evidence.

## 7. QA/QC recommendation

Phase 4 candidate `1f06a9d` (blob `fe1c93e5`) is verified independently: pins match, diff is in-scope, both origins rerun clean with zero failures across 184 checks × 2 origins × 4 browsers, and evidence artifacts validate. Recommend the auditor proceed to Phase 4 sign-off, subject to the standing production-launch-URL dependency.
