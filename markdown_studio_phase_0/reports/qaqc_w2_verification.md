# QAQC verification — W2 (R09 listener lifecycle) on `vibe/phase2-w2-r09` @ `b4badf3`

Date: 2026-11-07. Verifier: Linux x86-64, Node v22.23.4.

## Verdict: **W2 accepted** (mock level). Browser G2 stop point still owed.

## Implementation reviewed

Candidate `259cc23bcd912cc83147e57d871067acc9e87dcebfaaa4e10e3b4cfab91ef6df` (raw = LF, clean; 4,626 lines), vs base `ab0f99f7…`. The diff: `setupPreviewDiagramInteractivity()` now registers the window `mousemove`/`mouseup` pan handlers **at most once** (`window.__previewPanListenersBound` guard) and delegates per-card pan via a single `activePan` object released on mouseup and on every setup call; `setupPreviewDiagramInteractivity.cleanup()` removes the shared listeners; `cleanStrayMermaidElements(targetId)` no longer blanket-removes `body > svg` (D001-consistent). The three remaining window-listener sites (split resizer ~3578, builder pan ~4015, fullscreen pan ~4337) are top-level startup code that runs once — not per-render, so not leak paths. Baseline `11eaec36…` and live app untouched.

## Verification results

| Check | Result |
| --- | --- |
| `baseline-checks.cjs` / `phase-1-checks.cjs` / `phase-2-checks.cjs` (fresh scratch run) | exit 0 / **7/7** / **2/2** (P2-01, P2-03) |
| `phase-2-results.json` | `findingsResolved: [R05, R09]`, candidate `259cc23b…` LF (raw `2b5c6a21…` CRLF disk — provenance recorded) |
| P2-03 observation | 50 cycles, listeners 1+1 → 0+0 after cleanup, growth 0, `detachedNodeRetained: false`, interactivity preserved at cycle 50 |
| **Independent QAQC repro** (extracted real `setupPreviewDiagramInteractivity`, counting mock window) | 50 setup calls → exactly 1 mousemove + 1 mouseup listener; `cleanup()` → 0/0; simulated drag through the shared listener pans correctly (panX=60/panY=40 from 100,50→160,90); `activePan` null after mouseup |
| Checksums | were stale (3 entries); regenerated → **266/266 OK** |
| Audit | R09 register entry + phase-log row accurate; candidate lineage updated |

## Notes

- **W2-1 (owed):** browser stop point `G2-LISTENER-50` does not exist yet in `g0-capture-routine.cjs` and no `G2-*` manifests are on the branch. Add the stop point and rerun the 4-browser headed matrix on candidate `259cc23b…` before calling G2 progress browser-verified. (Mock-level R09 closure stands on its own per plan — mocks supplement, not replace, browser checks — but the G2 gate text explicitly wants the 50-cycle listener/retention inspection in a real browser.)
- **W2-2 (minor):** `cleanStrayMermaidElements` behavior change (no more blanket `body > svg` removal) is deliberate and D001-aligned; it is covered by the passing launch/render stop points.

Next: W3 (R15 render generation guard) per `reports/phase2_w2w3_kickoff.md`.
