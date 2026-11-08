# QAQC verification — W3 (R15 render generation guard) on `vibe/phase2-w3-r15` @ `c46caa1`

Date: 2026-11-08. Verifier: Linux x86-64, Node v22.23.4, vendored marked 12.0.2.

## Verdict: **W3 accepted — Gate G2 criteria met (mock + 4-browser matrix). Phase 2 can close.**

## Implementation reviewed

Candidate `1f10e11242f7d42e2acec50ec8616fddd67e24d1c5e36620b380d91c4e00864c` (raw = LF, clean; 4,694 lines) vs W2 base `259cc23b…`. Preview path: `previewRenderGeneration` + `renderAllPreviewDiagrams.generation`, `isCurrent()` checked before each card, after `mermaid.parse`, and after `mermaid.render` (stale → discard + scoped stray cleanup + return), active-tab snapshot invalidation, `card.isConnected` checks, and `setupPreviewDiagramInteractivity()` only called when current. Studio path: `studioRenderGeneration` + `renderBuilderDiagram.generation`, `isStudioCurrent()` (generation + modal-open) checked after parse and after render; generation bumped on tab switch, `openStudioWithCode`, and `closeStudio`. Stray-element cleanup narrowed to the specific `uniqueId`. Baseline `11eaec36…` and live app `c5bfc749…` untouched.

## Verification results

| Check | Result |
| --- | --- |
| `baseline-checks.cjs` / `phase-1-checks.cjs` / `phase-2-checks.cjs` (fresh scratch run) | exit 0 / **7/7** / **3/3** |
| P2-02 (committed) | out-of-order handled, stale commit blocked, tab-switch + modal-close interleavings handled; previewGen/studioGen counts consistent |
| **Independent QAQC repro** (extracted real `renderAllPreviewDiagrams`, deferred mock `mermaid.render`) | gen1 issued 1 render then early-aborted at card 1 when gen2 started; resolving gen2's renders then the stale gen1 render **last**: canvases hold `GEN2`, stale never overwrote → `STALE OVERWROTE: false`, `GEN2 COMMITTED: true` |
| Browser matrix on candidate `1f10e112…` (4 new run-stamped manifests: chromium 158, edge 157.0.4341.42, chrome 157.0.8103.39, firefox 159.0; headed, win32, file+http) | **143/143 pass each** (141 + new `G2-LISTENER-50` + `G2-RENDER-GEN`); `G2-RENDER-GEN`: gen2 committed, stale did not overwrite, rapid typing settled, studio close/reopen clean, badge valid, 0 console errors; `G2-LISTENER-50`: 0 listeners added across 50 cycles; zero non-pass records |
| Checksums | 13 stale entries before; regenerated → **273/273 OK** |
| Audit | Phase 2 row marked Verified with W1/W2/W3 register entries; candidate lineage `ab0f99f7 → 259cc23b → 1f10e112` recorded (LF + raw CRLF disk hashes) |

## G2 gate mapping (plan §5)

- Mixed-fence edits change only their source range → P2-01 + `G1-X1-ISOLATION-BROWSER` pass 4/4 browsers ✓
- Rapid edits / tab switches / modal reopen / out-of-order completion → newest only → P2-02 + `G2-RENDER-GEN` ✓
- 50 cycles: listener count constant, no detached retention, still interactive → P2-03 + `G2-LISTENER-50` ✓

## Notes

- W3-1: Phase 2 is complete on this branch. Recommend merging `vibe/phase2-w3-r15` into `vibe/code_revisions` and opening Phase 3 (R06/R07/R08, Gate G3) from there.
- W3-2 (housekeeping, recurring): regenerate `checksums.sha256` at every checkpoint — this branch was 13 entries stale on arrival; fixed here.
