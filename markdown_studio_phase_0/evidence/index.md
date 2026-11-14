# Evidence Index — Phase 0 through Phase 6

## Phase 0
- `phase-0/baseline.json`: baseline hash, byte/line counts, dependencies, environment and retained source identities.
- `phase-0/controls.md` and `controls.json`: 111 static controls; dynamic families; keyboard inventory; execution status.
- `phase-0/fixtures/`: 26 fixed synthetic Markdown inputs (16 templates + tall, wide, multi, invalid, labels, long-labels, mixed, mixed-fences, outer-fence, nested).
- `phase-0/templates.json`: all 16 built-in template fixtures extracted from source.
- `phase-0/test-results.json`: exact observations for baseline/syntax check (B00 pass) and 8 non-browser defect reproductions (B01, B03, B04, B05, B09, B10, B11, B12).
- `checksums.sha256`: full package content checksums.
- `../reports/phase_0_baseline_report.md`: G0 decision and complete R-series register.
- `../reports/code_diff_report.md`: diff comparison and hunk analysis.

## Phase 1
- `../working/markdown_studio.html`: working application copy incorporating Phase 1–6 fixes (SHA-256 `d1b2f6f32007cef3e26d904575b9edc3fb97aa5ad015632090f23096d4d66c6e`, 5,467 lines).
- `../tests/phase-1-checks.cjs`: Phase 1 verification test suite (P1-01 through P1-07, 7/7 pass).
- `phase-1/phase-1-results.json`: test execution records for Gate G1.

## Phase 2
- `phase-2/phase-2-results.json`: Gate G2 records (P2-01 parser-consistent replacement, P2-02 generation guard, P2-03 listener lifecycle, 3/3 pass).
- `phase-2/fixtures/`: synthetic inputs used by the Phase 2 suite.

## Phase 3
- `phase-3/phase-3-results.json`: Gate G3 records (P3-01 theme isolation, P3-02 fit computation, P3-03 typography/foreignObject isolation, 3/3 pass).

## Phase 4
- `phase-4/phase-4-results.json`: Gate G4 records (P4-01..P4-06: insertion commands, image URL, escape decoding, shortcut guards, 6/6 pass).

## Phase 5
- `phase-5/phase-5-results.json`: Gate G5 records (P5-01..P5-05: render-ready export, mid-await refresh & retry exhaustion, clean export, PNG failure handling, multi-page print CSS, 5/5 pass).

## G0 Capture Matrix (All Phases' Browser Stop Points)
- `phase-0/g0-capture/manifest.json` and `stop-points.md`: stop-point definitions (155 stop points across G0–G5).
- `phase-0/g0-capture/runs/`: run-stamped manifests and per-run console logs for all 4 browsers on frozen candidate `d1b2f6f32007cef3e26d904575b9edc3fb97aa5ad015632090f23096d4d66c6e`:
  - `manifest-chromium-both-2026-11-14T02-54-51-422Z.json` (155 pass, 0 fail, 0 blocked)
  - `manifest-edge-both-2026-11-14T02-36-09-068Z.json` (155 pass, 0 fail, 0 blocked)
  - `manifest-chrome-both-2026-11-14T02-44-21-476Z.json` (155 pass, 0 fail, 0 blocked)
  - `manifest-firefox-both-2026-11-14T02-27-50-104Z.json` (154 pass, 0 fail, 1 blocked — `G5-PRINT-PDF-TALL` blocked per CDP `Page.printToPDF` unavailability; deferral accepted)
- `phase-0/g0-capture/artifacts/<browser>/`: per-browser screenshots, counts, and retained sample files (`chromium/`, `edge/`, `chrome/`, `firefox/`):
  - `export-standalone-sample.html`: Reopened and verified rendered MathJax and Mermaid SVGs.
  - `export-standalone-empty.html`: Reopened and verified clean empty document export.
  - `export-standalone-invalid.html`: Reopened and verified clean `<pre><code class="language-mermaid">` fallback without `.mermaid-error-card` or `"Fix in Studio"` UI.
  - `export-diagram-sample.svg`: Reopened in browser and verified positive `getBBox()` on `<text>` labels and zero `foreignObject` elements.
  - `export-diagram-sample.png`: Reopened in browser and verified exact 2× retina dimensions (`265×272`) and non-background rendered pixel count.
  - `print-tall-diagram.pdf`: Multi-page (3-page) tall-diagram CDP print-to-PDF capture preserving all 26 steps (`Step 0`–`Step 25`) without clipping (Chromium, Edge, Chrome).

## Phase 6 — Final Deliverables
- `../final/markdown_studio.html`: frozen final candidate, SHA-256 `d1b2f6f32007cef3e26d904575b9edc3fb97aa5ad015632090f23096d4d66c6e` (LF), 5,467 lines — byte-identical to `../working/markdown_studio.html` (LF).
- `../reports/markdown_studio.patch`: unified patch `a/baseline/markdown_studio.original.html` → `b/final/markdown_studio.html`, SHA-256 `237b3edc9552f0dce296d9034f752e4060f57fa0a14630660b10ca5340893c8e`, 46 hunks, +1,431/−281 lines. Validated: applying all 46 hunks reconstructs `final/markdown_studio.html` byte-for-byte.
- `../reports/code_diff_report.md`: final diff report — statistics, per-change R/D/A6 table, dependency statement, patch-application proof.
- `../reports/phase_6_independent_audit.md`, `../reports/phase_6_independent_reaudit_03366ba.md`, and `../reports/phase_6_independent_reaudit_b2ff632.md`: independent audit reports defining findings A6-01 through A6-05 and re-audit closure items.
- `../reports/qaqc_phase6_reaudit_verification.md`: QA/QC remediation and verification report for the Phase 6 re-audit.
- `../reports/remediation_audit.md`: final audit — resolution of all findings A6-01..A6-05, phase log (all gates passed), coverage counts, deliverables.
- `checksums.sha256`: package content checksums covering all deliverables and artifacts.
