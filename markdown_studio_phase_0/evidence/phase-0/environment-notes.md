# Environment reconciliation — Phase 0 evidence

Recorded in response to QAQC audit finding F4 (environment fields disagree across artifacts).

`tests/baseline-checks.cjs` writes the executing environment into
`evidence/phase-0/test-results.json` on every run, so re-running the suite in a
different environment overwrites that file. The overwrite was discovered during
the Phase 1 checkpoint commit (`a5b80ac`); the original Phase 0 record has been
restored and the rerun preserved as a separate run-stamped file.

| Artifact | Platform | Runtime | Timestamp (UTC) | Role |
| --- | --- | --- | --- | --- |
| `baseline.json` (`platform` field) | Windows-11-10.0.26200-SP0 | not recorded | 2026-11-03T13:06Z | Platform of the original baseline capture/packaging step |
| `test-results.json` (restored original, commit `20e552c`) | win32 x64 | Node v26.13.0 | 2026-11-03T13:07Z | Canonical Phase 0 mock/parser execution record |
| `test-results-rerun-2026-11-04.json` | win32 x64 | Node v24.20.0 | 2026-11-04T00:38Z | Rerun that overwrote the canonical file during the Phase 1 checkpoint; observations identical |
| `browser-results.json`, phase 0 report | linux x86-64 | Node v24.22.1 | 2026-11-03 | Sandbox where browser launch was attempted and blocked |
| QAQC audit (`reports/qaqc_audit_phase_0_phase_1.md`) | linux x86-64 | Node v22.23.4 | 2026-11-04 | Independent rerun; both suites reproduced committed observations |

The disagreement is between packaging/execution environments, not between
recorded observations: the B-series observations in the original and rerun
`test-results.json` are identical apart from environment and timestamp fields,
and independent reruns on Linux (QAQC audit and the F1–F8 remediation step)
reproduced them exactly. No Phase 0 observation depends on the Windows
environment records.

Rule going forward: phase evidence files are written once per phase checkpoint
and never overwritten in place; additional runs are saved under run-stamped
filenames as done here.
