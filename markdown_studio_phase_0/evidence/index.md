# Evidence Index — Phase 0 & Phase 1

## Phase 0
- `phase-0/baseline.json`: baseline hash, byte/line counts, dependencies, environment and retained source identities.
- `phase-0/controls.md` and `controls.json`: 111 static controls; dynamic families; keyboard inventory; execution status.
- `phase-0/fixtures/`: 25 fixed synthetic Markdown inputs (16 templates + tall, wide, multi, invalid, labels, mixed, mixed-fences, outer-fence, nested).
- `phase-0/templates.json`: all 16 built-in template fixtures (16 type variants across 12 diagram types) extracted from the unchanged source.
- `phase-0/test-results.json`: exact observations for the baseline/syntax check (B00 pass) and 8 non-browser defect reproductions (B01, B03, B04, B05, B09, B10, B11, B12). Written by `tests/baseline-checks.cjs` on every run; the executing environment in this file reflects the machine that last ran the suite (see `phase-0/environment-notes.md`).
- `phase-0/test-results-rerun-2026-11-04.json`: run-stamped preservation of the 2026-11-04 rerun that had overwritten the canonical record (audit F4); observations identical.
- `phase-0/test-results-rerun-2026-11-04-local.json`: run-stamped rerun on the D001 remediation machine (Linux x86-64, Node v22.23.4, 2026-11-04); observations identical to the canonical record; canonical file restored (write-once rule).
- `phase-0/environment-notes.md`: reconciliation of the differing environment records across artifacts (audit F4), including the D001 remediation environment.
- `phase-0/browser-results.json`: launch blockers under sandbox loopback isolation.
- `phase-0/setup-limitations.md`: environment setup attempts and evidence boundaries.
- `phase-0/change-history.txt`: baseline commit and clean working-copy state.
- `checksums.sha256`: baseline package contents checksums.
- `../reports/phase_0_baseline_report.md`: G0 decision and complete R-series register.
- `../reports/code_diff_report.md`: baseline zero-change comparison.

## Phase 1
- `../working/markdown_studio.html`: working application copy incorporating Phase 1 fixes + D001 fix + R05 cross-diagram update isolation fix (candidate `e02aed95…`, 4,390 lines).
- `../tests/phase-1-checks.cjs`: Phase 1 verification test suite (P1-01 through P1-07).
- `phase-1/phase-1-results.json`: test execution records for Gate G1 (regenerated 2026-11-04 after R05 update-isolation fix; candidate `e02aed95…`). Written by `tests/phase-1-checks.cjs` on every run — reruns overwrite it in place; keep run-stamped copies when contemporaneous records are required (audit F9):
  - `P1-01`: Inline script syntax validation (pass).
  - `P1-02`: Source preservation across SVG rendering & 3-cycle theme refresh (pass).
  - `P1-03`: Multi-diagram exact source matching on delegated Copy and Edit actions (pass).
  - `P1-04`: Fix in Studio button class and delegated action binding on syntax error cards (pass).
  - `P1-05`: Error log scoped event delegation; zero inline handlers; independent copy/dismiss (pass).
  - `P1-06`: Clipboard rejection and unavailability user toast feedback (pass).
  - `P1-07`: Cross-diagram update isolation across mixed tilde/backtick fences (pass).
- `phase-1/phase-1-results-candidate-05de4260-2026-11-04.json`: run-stamped preservation of the prior canonical record (candidate `05de4260…`, pre-D001).
- `phase-1/phase-1-results-candidate-55cb1264-2026-11-04.json`: run-stamped preservation of candidate `55cb1264…` (post-D001, pre-update-isolation).
- `phase-1/browser-evidence/`: browser verification screenshots for the D001 fix and G1 criteria (2026-11-04, Linux, in-app Chromium 152.0.7977.167, HTTP origin):
  - `G1-D001-error-state-before.jpeg`: pre-fix state — both welcome.md diagrams as error cards (candidate `05de4260…`).
  - `G1-D001-welcome-rendered-after.jpeg`: post-fix pristine welcome.md, both diagrams rendered.
  - `G1-D001-multitype-light-after.jpeg`: post-fix 7-type document battery viewport capture (labeled flowchart, sequence, state, pie in view), light theme.
  - `G1-D001-multitype-dark-after.jpeg`: same document after theme redraw, dark theme (7/7-type battery results in `reports/d001_remediation_report.md` §4).
- `../reports/remediation_audit.md`: phase progress and R01–R05 resolution register + D-series discoveries.
- `../reports/d001_remediation_report.md`: D001 remediation report — discovery, root-cause experiments, fix, browser and suite verification, R05 browser reproduction, minor-bug sweep, gate impact.
- `../reports/qaqc_audit_phase_0_phase_1.md`: independent QAQC audit of the Phase 0/Phase 1 checkpoint (findings F1–F9).
- `../reports/qaqc_audit_response.md`: finding-by-finding response and current gate status.
- `../reports/qaqc_verification_F1-F8.md`: QAQC re-verification of the F1–F9 remediation (all findings verified remediated at `00e2208`).
- `../reports/qaqc_d001_verification.md`: QAQC verification of D001 remediation and publish claims @ `0c5f543`.
- `checksums.sha256`: regenerated 2026-11-04 over the full phase-0 package including phase-1 results and audit reports.
