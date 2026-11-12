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

## Phase 2
- `phase-2/phase-2-results.json`: Gate G2 records (P2-01 parser-consistent replacement, P2-02 generation guard, P2-03 listener lifecycle), candidate-stamped; re-run 2026-11-12 on the frozen final candidate `9bb0fcd9…` (3/3).
- `phase-2/fixtures/`: synthetic inputs used by the Phase 2 suite.

## Phase 3
- `phase-3/phase-3-results.json`: Gate G3 records (P3-01 theme isolation, P3-02 fit computation, P3-03 typography/foreignObject isolation); re-run 2026-11-12 on `9bb0fcd9…` (3/3).

## Phase 4
- `phase-4/phase-4-results.json`: Gate G4 records (P4-01..P4-06: insertion commands, image URL, escape decoding, shortcut guards); re-run 2026-11-12 on `9bb0fcd9…` (6/6).

## Phase 5
- `phase-5/phase-5-results.json`: Gate G5 records (P5-01..P5-05: render-ready export, mid-await refresh, clean export, PNG failure handling, print CSS); re-run 2026-11-12 on `9bb0fcd9…` (5/5).

## G0 capture matrix (all phases' browser stop points)
- `phase-0/g0-capture/manifest.json` and `stop-points.md`: stop-point definitions (155 stop points across G0–G5).
- `phase-0/g0-capture/runs/`: 31 run-stamped manifests. Final frozen-candidate runs 2026-11-11 (candidate LF `9bb0fcd959af032f762474826d86ca7e237616e5ab29014036ee24323e563519`, headed, origins file:// + http://, win32 x64, Node v24.20.0): `manifest-chromium-both-2026-11-11T03-35-41-030Z.json` (155/155), `manifest-edge-both-2026-11-11T03-44-48-566Z.json` (155/155), `manifest-chrome-both-2026-11-11T09-47-51-379Z.json` (155/155), `manifest-firefox-both-2026-11-11T10-14-24-473Z.json` (155/155). Total 620/620, 0 fail, 0 blocked, 0 unrun. Earlier runs (including the superseded `4b4bd07c…` G5 sweep, QAQC P5-0) are retained as run-stamped history.
- `phase-0/g0-capture/artifacts/`, `console-log.json`: screenshots and console capture from the capture runs.

## Phase 6 — final deliverables (2026-11-12)
- `../final/markdown_studio.html`: frozen final candidate, SHA-256 `9bb0fcd959af032f762474826d86ca7e237616e5ab29014036ee24323e563519` (LF), 5,424 lines — byte-identical to `../working/markdown_studio.html` (LF).
- `../reports/markdown_studio.patch`: unified patch `a/baseline/markdown_studio.original.html` → `b/final/markdown_studio.html`, SHA-256 `0d5f41f185f3be42b1e65dd53eed1c657fadea1978503f0b57259be4698554c4`, 46 hunks, +1,385/−277. Validated: `patch -p1` on the pristine baseline blob reconstructs `final/markdown_studio.html` byte-for-byte (`cmp` clean, hash `9bb0fcd9…`).
- `../reports/code_diff_report.md`: final diff report — statistics, per-change R/D table, dependency statement, patch-application proof.
- `../reports/remediation_audit.md`: final audit — executive result, phase log (all gates passed), R01–R15 + D001 dispositions, coverage counts, limitations/deferrals, rollback, links.
- `checksums.sha256`: regenerated 2026-11-12 over the full package including `final/` and the Phase 6 reports (see file for count and hashes).
- Final regression: `phase-0/test-results.json` and `phase-1..5/phase-*-results.json` re-run 2026-11-12 on candidate `9bb0fcd9…` (B00 + B01–B12 observations; P1 7/7, P2 3/3, P3 3/3, P4 6/6, P5 5/5).
