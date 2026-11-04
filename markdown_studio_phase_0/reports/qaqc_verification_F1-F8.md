# QAQC re-verification — remediation of findings F1–F9

Date: 2026-11-04. Verifies commit `00e2208` ("Remediate QAQC audit findings F1-F8") on `vibe/code_revisions` against `reports/qaqc_audit_phase_0_phase_1.md`. Verifier environment: Linux x86-64, Node v22.23.4, Python 3.12.15; no browser binaries (browser gap unchanged).

## Independent checks re-run

- `node tests/baseline-checks.cjs` → exit 0; B00 pass + 8 reproductions; (id, status, observation) identical to the restored `evidence/phase-0/test-results.json`.
- `node tests/phase-1-checks.cjs` → exit 0; 6/6 pass; P1-01 candidate SHA-256 `05de4260…` matches the working copy; P1-03 per-card fields all `true`.
- `sha256sum -c evidence/checksums.sha256` → **54/54 OK** (previously 31/47).
- Working copy `05de426050850de2a85c70abda7a3f0336af0c998273eb1e568e3f34c3d28915`, 4,376 lines; diff vs `a5b80ac` is exactly the 3-line removal of `window.dismissError`/`window.copyErrorText` — no other code change.
- Baseline `11eaec36…` and live `scripts/markdown-studio.html` (`c5bfc749…`) both untouched on the branch.

## Finding-by-finding verdict

| Finding | Claimed action | QAQC verdict |
| --- | --- | --- |
| F1 | Phase log corrected: Phase 0 blocked at G0, plan-noncompliant advance acknowledged | **Verified** — `reports/remediation_audit.md` phase log and process-correction note read exactly as claimed |
| F2 | G1 re-recorded as conditional mock-level pass; unverified criteria named | **Verified** — blocking gaps (browser console, theme screenshots, cross-diagram update isolation) explicitly listed |
| F3 | Checksum manifest regenerated incl. phase-1 results and new files | **Verified** — 54/54 pass; manifest contains `phase-1-results.json`, `qaqc_audit_response.md`, `environment-notes.md`, rerun file, and working copy at `05de4260…` |
| F4 | Original `test-results.json` (win32/v26.13.0) restored; rerun preserved run-stamped; environments reconciled | **Verified** — `test-results.json` @ `00e2208` is byte-identical to @ `20e552c`; `test-results-rerun-2026-11-04.json` present; `environment-notes.md` reconciles all five environment records and records the write-once/run-stamped rule |
| F5 | Remediation-target section added; re-baseline decision recorded as open before Phase 6; live app untouched | **Verified** — section present with both options and "decision is open"; `scripts/markdown-studio.html` hash unchanged (`c5bfc749…`); R01–R04 presence in live app re-confirmed at lines 2613–2615 / 2835, 2890 / 2756–2757 |
| F6 | P1-03 observations snapshotted at assertion time | **Verified** — diff of `tests/phase-1-checks.cjs` adds per-card const captures; committed and re-run results show all four fields `true` |
| F7 | Dead `window.*` exports removed; suite rerun 6/6 on new candidate | **Verified** — grep finds no exports; zero inline `onclick`; hash/line count match; rerun 6/6 |
| F8 | Counts/wording corrected (4,376 lines; 1 pass + 8 reproductions; 16 variants / 12 types) | **Verified** in `remediation_audit.md` and `evidence/index.md` |
| F9 | Rerun-overwrite behavior documented in evidence index | **Verified** — index documents overwrite-in-place and run-stamp rule; `information.txt` left empty as recorded |

## CI / PR state

- Repo has no `.github/workflows` (API 404); `gh pr checks 6` reports "no checks reported" — **no CI exists to monitor**; claim confirmed.
- PR #6 remains open (draft), base `vibe/code_revisions`, head `vibe/qaqc-phase0-1-audit-2ace24`; diff contains only the QAQC report files.

## Residual blockers (unchanged)

1. **Browser evidence for G0/G1** — no browser binaries in any available sandbox; stands as an accepted deferral until a browser-capable environment is provisioned. G0 remains **blocked**; G1 remains **conditional pass (mock harness)**.
2. **F5 target decision** — original-snapshot vs live-app re-baseline must be chosen and recorded before Phase 6 integration.

All nine findings are closed as remediated at the evidence/process level; the Phase 1 code changes remain verified correct, minimal, and in-scope.
