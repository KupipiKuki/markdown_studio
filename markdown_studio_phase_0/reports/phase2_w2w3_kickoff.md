# Phase 2 kickoff — W2 (R09) & W3 (R15) preparation package

Date: 2026-11-07. Base: `vibe/code_revisions` @ merge of `vibe/phase2-w1-r05` (W1 done, candidate `ab0f99f7…`, all suites green: baseline exit 0, P1 7/7, P2-01 pass; browser matrix 141/141 × Edge/Chrome/Firefox/Chromium with the blockquote isolation case fixed). F5 decided: original snapshot remains the target; live app untouched.

## W2 — R09: preview setup repeatedly adds window listeners without removal

- **Evidence**: B09 reproduced — two setup calls add 4 window handlers (`mousemove`/`mouseup` ×2 per card). Detached-node retention and 50-cycle test still unrun.
- **Current code refs** (working copy): `setupPreviewDiagramInteractivity()` (~line 2684) adds `window.addEventListener('mousemove'|'mouseup')` at 2715/2722 on every call; same pattern at 3523/3534 and 3960/3967 (studio canvas drag).
- **Work**: shared pan handlers or explicit lifecycle cleanup per preview build. Do **not** remove another active render's temp elements or unrelated SVG assets (plan §5). Gate G2 requires: after 50 refresh cycles, window listener count constant per cycle and no detached diagram objects retained by handlers (investigate sustained growth, not one heap reading).

## W3 — R15: async render lacks a generation guard

- **Evidence**: source-confirmed; controlled out-of-order completion never reproduced yet.
- **Current code refs**: `renderAllPreviewDiagrams()` (line 2612) loops cards, `await mermaid.parse` then `await mermaid.render(uniqueId, code)` (2646) with a fresh `uniqueId` per call — two overlapping invocations (rapid edits, tab switches, theme switches, modal reopen) can interleave and a stale completion can overwrite a newer canvas. Studio render path at 3921.
- **Work**: generation counter / invalidation token per render pass; commit a result only when its document version, target card, and generation are still current. Gate G2 requires: rapid edits, tab switches, modal reopening, and controlled out-of-order completion show the newest result only; diagrams remain interactive after rerender.

## Test plan (extend `tests/phase-2-checks.cjs`, pattern after P2-01 — extract real code with `vm`)

- **P2-02 (W3)**: mock `mermaid.render` with controllable deferred promises; start render gen 1 and gen 2 on the same card, resolve gen 2 then gen 1; assert canvas holds gen 2's SVG and no error/log from gen 1. Also tab-switch and modal-reopen interleavings.
- **P2-03 (W2)**: call the real preview setup N times against a mock window with listener counting; assert `addEventListener` count for mousemove/mouseup stays constant across 50 simulated cycles and that detached cards' handlers don't retain them (use a WeakRef-style check or handler-registry size assertion).
- Browser re-verification: add `G2-RENDER-GEN` and `G2-LISTENER-50` stop points to `tests/g0-capture-routine.cjs`; rerun the 4-browser matrix headed (`--browser edge|chrome|firefox|chromium`, `--origin both`), run-stamped manifests, then regenerate `checksums.sha256` at the checkpoint.

## Process rules (unchanged)

Write-once evidence + run-stamped reruns; candidate hash recorded raw + LF-normalized; baseline `11eaec36…` and live app `c5bfc749…` stay untouched; new discoveries get D-series IDs; no advancing past a failed gate; a blocked/unrun test is never a pass. PowerShell note: run commands line-by-line (`;` not `&&`).

## First commands (Windows PowerShell)

```powershell
git checkout vibe/code_revisions
git pull
cd markdown_studio_phase_0
node tests\baseline-checks.cjs
node tests\phase-1-checks.cjs
node tests\phase-2-checks.cjs
# then start W2 or W3 on a fresh branch off vibe/code_revisions
```
