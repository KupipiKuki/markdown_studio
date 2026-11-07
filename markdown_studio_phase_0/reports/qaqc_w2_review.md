# QAQC review — `vibe/phase2-w2-r09` @ `3996669` ("coding has been completed and ready for qaqc")

Date: 2026-11-07. Verdict: **W2 (R09) NOT implemented — returned for rework.** No application code changed.

## What the branch actually contains (diff `84c7fc7..3996669`)

| File | Change |
| --- | --- |
| `working/markdown_studio.html` | **none** — hash still `ab0f99f7…` (identical to the W1 base) |
| `tests/phase-2-checks.cjs` | +6/−3: CRLF→LF normalization when reading the 3 phase-2 fixtures (legit harness fix, keep it) |
| `evidence/phase-2/phase-2-results.json` | regenerated; still only **P2-01 / R05** — no P2-02 (R15) or P2-03 (R09) tests exist |
| 4 × `g0-capture/runs/manifest-*-2026-11-07T2*.json` | G0 matrix re-runs on the same candidate `ab0f99f7…`: 141/141 pass each, but **no `G2-*` stop points exist** |

## R09 confirmed still present

- The working copy still has all four `window.addEventListener('mousemove'|'mouseup')` call sites (2715/2722 preview, 3523/3534, 3960/3967 studio) inside per-setup functions — B09 reproduction conditions unchanged.
- `remediation_audit.md` on the branch still lists "W2 (R09 listener cleanup), W3 (R15 render generation guard) next" — the audit itself does not claim R09 resolved.

## What "done" must include for W2 (per `reports/phase2_w2w3_kickoff.md`)

1. Actual code change in `working/markdown_studio.html`: shared pan handlers or explicit cleanup so repeated preview builds don't grow window listeners (new candidate hash, lineage recorded in the audit).
2. `P2-03` in `phase-2-checks.cjs`: real extracted setup called N times against a counting mock window; listener count constant over 50 cycles; no detached retention.
3. Browser stop point `G2-LISTENER-50` in the capture routine + 4-browser headed re-run with run-stamped manifests (candidate LF-normalized hash must match the new committed candidate).
4. Checksums regenerated at the checkpoint; phase log updated.

Same shape for W3 (R15): generation guard in `renderAllPreviewDiagrams`/studio render, `P2-02` out-of-order mock test, `G2-RENDER-GEN` browser stop point.

## Kept

The CRLF fixture normalization in `phase-2-checks.cjs` is correct and stays.
