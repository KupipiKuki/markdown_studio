# Evidence index — Phase 0

- `phase-0/baseline.json`: baseline hash, byte/line counts, dependencies, environment and retained source identities.
- `phase-0/controls.md` and `controls.json`: 111 static controls; dynamic families; keyboard inventory; execution status.
- `phase-0/fixtures/`: 25 fixed synthetic Markdown inputs.
- `phase-0/templates.json`: all 16 templates extracted from the unchanged source.
- `phase-0/test-results.json`: exact observations for baseline/syntax and eight non-browser reproduction checks.
- `phase-0/browser-results.json`: Chromium and Firefox launch blockers, with both launch modes identified.
- `phase-0/setup-limitations.md`: environment setup attempts and evidence boundaries.
- `phase-0/change-history.txt`: baseline commit and clean working-copy state.
- `checksums.sha256`: package contents excluding the checksum file itself and Git internals.
- `../reports/phase_0_baseline_report.md`: G0 decision and complete R-series register.
- `../reports/remediation_audit.md`: initial audit and phase log.
- `../reports/code_diff_report.md`: unchanged application comparison.

Screenshots, browser-console logs, clipboard comparisons and export samples: **not captured**. Browser launch failed before application navigation. No visual, clipboard, download or compatibility pass is implied.
