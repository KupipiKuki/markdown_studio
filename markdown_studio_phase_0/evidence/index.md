# Evidence Index — Phase 0 & Phase 1

## Phase 0
- `phase-0/baseline.json`: baseline hash, byte/line counts, dependencies, environment and retained source identities.
- `phase-0/controls.md` and `controls.json`: 111 static controls; dynamic families; keyboard inventory; execution status.
- `phase-0/fixtures/`: 25 fixed synthetic Markdown inputs (16 templates + tall, wide, multi, invalid, labels, mixed, mixed-fences, outer-fence, nested).
- `phase-0/templates.json`: all 16 templates extracted from the unchanged source.
- `phase-0/test-results.json`: exact observations for baseline/syntax and 8 non-browser reproduction checks (B00–B12).
- `phase-0/browser-results.json`: launch blockers under sandbox loopback isolation.
- `phase-0/setup-limitations.md`: environment setup attempts and evidence boundaries.
- `phase-0/change-history.txt`: baseline commit and clean working-copy state.
- `checksums.sha256`: baseline package contents checksums.
- `../reports/phase_0_baseline_report.md`: G0 decision and complete R-series register.
- `../reports/code_diff_report.md`: baseline zero-change comparison.

## Phase 1
- `../working/markdown_studio.html`: working application copy incorporating Phase 1 fixes.
- `../tests/phase-1-checks.cjs`: Phase 1 verification test suite (P1-01 through P1-06).
- `phase-1/phase-1-results.json`: test execution records for Gate G1:
  - `P1-01`: Inline script syntax validation (pass).
  - `P1-02`: Source preservation across SVG rendering & 3-cycle theme refresh (pass).
  - `P1-03`: Multi-diagram exact source matching on delegated Copy and Edit actions (pass).
  - `P1-04`: Fix in Studio button class and delegated action binding on syntax error cards (pass).
  - `P1-05`: Error log scoped event delegation; zero inline handlers; independent copy/dismiss (pass).
  - `P1-06`: Clipboard rejection and unavailability user toast feedback (pass).
- `../reports/remediation_audit.md`: phase progress and R01–R04 resolution register.
