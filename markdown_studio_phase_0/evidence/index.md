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
- `../working/markdown_studio.html`: working application copy incorporating Phase 1 fixes + D001 fix + R05 cross-diagram update isolation fix.
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
- `phase-5/phase-5-results.json`: Gate G5 records (P5-01..P5-05: render-ready export, mid-await refresh & retry exhaustion, clean export, PNG failure handling, print CSS, 5/5 pass).

## G0 Capture Matrix (All Phases' Browser Stop Points)
- `phase-0/g0-capture/manifest.json` and `stop-points.md`: stop-point definitions (155 stop points across G0–G5).
- `phase-0/g0-capture/runs/`: run-stamped manifests and per-run console logs for all 4 browsers (Chromium, Edge, Chrome, Firefox), 155/155 pass each (620/620 total passes, 0 fail, 0 blocked).
- `phase-0/g0-capture/artifacts/`: screenshots, counts, and retained sample files:
  - `export-standalone-sample.html`: Reopened and verified rendered MathJax and Mermaid SVGs.
  - `export-diagram-sample.svg`: Validated SVG with sanitized `<foreignObject>` labels.
  - `export-diagram-sample.png`: Validated 2x retina PNG export.
  - `print-tall-diagram.pdf`: Multi-page tall-diagram CDP print-to-PDF capture.

## Phase 6 — Final Deliverables
- `../final/markdown_studio.html`: frozen final candidate, SHA-256 `563955c89c51e9362181733536258fb629340dd9db0368dec8dd63ea204d42b0` (LF), 5,439 lines — byte-identical to `../working/markdown_studio.html` (LF).
- `../reports/markdown_studio.patch`: unified patch `a/baseline/markdown_studio.original.html` → `b/final/markdown_studio.html`, SHA-256 `b66900b0c94516c240973c83c0a00f49607a079fa268625a8e49a1c425f58e19`, 46 hunks, +1,399/−277 lines. Validated: applying all 46 hunks reconstructs `final/markdown_studio.html` byte-for-byte.
- `../reports/code_diff_report.md`: final diff report — statistics, per-change R/D/A6 table, dependency statement, patch-application proof.
- `../reports/phase_6_independent_audit.md`: independent audit report defining findings A6-01 through A6-05.
- `../reports/remediation_audit.md`: final audit — resolution of all findings A6-01..A6-05, phase log (all gates passed), coverage counts, deliverables.
- `checksums.sha256`: package content checksums covering all deliverables and artifacts.
