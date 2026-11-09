# Phase 5 kickoff — export determinism & diagnosable failures (R13, R14)

Date: 2026-11-09. Branch: `vibe/phase5-r13-r14-2ace24` off `vibe/code_revisions` @ `786aaf3` (Phase 4 merged via PR #15; candidate `9ca1ebd6…`, 4,980 lines; suites: baseline 0, P1 7/7, P2 3/3, P3 3/3, P4 6/6; matrix 151/151 × 4 browsers). F5 decided: original snapshot target; baseline `11eaec36…` and live app untouched.

## Scope (plan §8) and current code refs

| ID | Finding | Current refs in `working/markdown_studio.html` |
| --- | --- | --- |
| **R13** | Export, copy, and print can run before diagram/math rendering finishes (source-confirmed missing wait; browser repro pending) | `btnExportHtml` handler @4720; `btnPrintPdf` → `window.print()` @4756–4757 (note: capture routine stubs `window.print` — real print/PDF output is G5 scope); copy-rendered-HTML path in export menu @4779+ |
| **R14** | PNG export lacks image-load and canvas failure handling (source-confirmed; browser behavior pending) | `exportDiagramPng(containerEl, filename)` @3051 |

## Work items (plan §8)

1. **Render-ready operation**: await current document's Mermaid + MathJax work before HTML export, rendered-HTML copy, and print; if the document changes while awaiting, refresh the generation or require retry — never silently export stale (reuse the Phase 2 generation guards).
2. Export a **clean document** (no transient controls, error UI, or active pan/zoom transforms).
3. Validate SVG dimensions/styling/labels and standalone reopening; validate PNG independently; export-specific label mode only if browser evidence requires it.
4. **R14**: handle image-load, canvas, and Blob failures in PNG export; release temp URLs on success and failure; actionable user feedback; no false success.
5. Remove print clipping and viewport height constraints from diagram print layout (print CSS).
6. Verify standalone HTML preserves diagram/math readability and document theme intent.

## Gate G5 (plan §8, verbatim criteria)

Immediately after editing, HTML export and rendered HTML copy contain the latest completed diagrams and math. Reopened SVG and PNG files show complete labels and diagram bounds at expected dimensions. PNG failure tests report errors without false success. Print/PDF includes tall diagrams without clipping. Empty and invalid diagrams have explicit, consistent export behavior.

Evidence: exported sample files, dimensions, reopened-file inspection, print/PDF inspection, controlled failure logs. Environment-blocked export checks stay marked blocked (e.g. headless print dialog).

## Test plan

- `tests/phase-5-checks.cjs` (vm-extracted real handlers): P5-01 export waits for in-flight render generation (deferred mermaid.render; export during render captures the completed generation, not stale); P5-02 document change during await triggers refresh/retry, no stale export; P5-03 exported HTML contains no error UI / transient controls / pan transforms; P5-04 PNG path: image-load failure and canvas failure produce error feedback, temp URL revoked, no success toast; P5-05 print CSS has no viewport height cap on diagrams.
- Browser: `G5-EXPORT-*` stop points in `g0-capture-routine.cjs` — export standalone HTML right after an edit and byte-compare diagram SVGs against current canvas; download SVG/PNG artifacts and reopen (parse dimensions, labels); controlled PNG failure (block image URL) → assert error surfaced; print-to-PDF via CDP `Page.printToPDF` (headed) for tall diagram — assert no clipping. 4-browser headed matrix, run-stamped manifests, candidate LF hash must match committed candidate. Note: `window.print` is stubbed in the routine; use CDP printToPDF for real print verification.

## Process rules (unchanged)

Write-once + run-stamped evidence; regenerate `checksums.sha256` from **LF-normalized** content before every push (4th recurring CRLF-disk incident — root `.gitattributes` with `* text=auto eol=lf` still recommended); raw + LF-normalized candidate hashes; D-series IDs; no advancing past a failed gate; blocked/unrun ≠ pass; committed candidate only.

## First commands (Windows PowerShell)

```powershell
git checkout vibe/phase5-r13-r14-2ace24
git pull
cd markdown_studio_phase_0
node tests\baseline-checks.cjs
node tests\phase-1-checks.cjs
node tests\phase-2-checks.cjs
node tests\phase-3-checks.cjs
node tests\phase-4-checks.cjs
```
