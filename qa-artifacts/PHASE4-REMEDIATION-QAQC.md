# Phase 4 remediation QA/QC — P4-01 theme-change readiness race

Responds to the independent review `markdown-studio-phase-4-review.md` (open
P2 code finding). Remediation candidate:

- Commit: `ffadcc65f8d0e196b6498596991aaa146a024ace` ("Phase 4 review fix:
  readiness requires the current render generation to settle")
- Live-file blob at candidate: `scripts/markdown-studio.html`,
  git blob `ca087ef54d44f17062eb0e3ec8fa6da30635c97e`
- Diff vs reviewed frozen candidate `1f06a9d` (blob `fe1c93e5`):
  `scripts/markdown-studio.html` **7 additions / 3 deletions** (one hunk),
  `tests/phase4.spec.js` **87 additions** (new P4-01R check + waitFor guard).
  No other files changed in the candidate.

## 1. The finding (review P2)

`ensurePreviewRenderReady()` snapshotted `watchGen = previewRenderGeneration`
before its awaits, and accepted readiness when
`previewRenderSettledGen >= watchGen`. The theme toggle
(`btnThemeToggle` → `applyTheme`) calls `renderAllPreviewDiagrams()` directly
(no debounce timer, no content/tab change), bumping the generation and
replacing `currentPreviewRenderPromise`. A readiness wait on generation N
could therefore accept generation N's snapshot after it settled, while the
newer generation N+1 (the themed rerender) was still in flight — exporting an
SVG rendered with the previous theme while the standalone document declares
the new theme.

## 2. The fix (application script, one hunk)

The snapshot and its comparison are gone. Readiness now requires the
**current** generation to have settled:

```js
const renderSettled = previewRenderSettledGen >= previewRenderGeneration;
```

If a newer pass starts while we are awaiting (theme toggle or any other
direct rerender), the settled generation lags the current one, the check
fails, and the next attempt awaits the *new* `currentPreviewRenderPromise`
until the newest pass settles — exactly the correction the review
recommended. The bounded loop (10 attempts, 1500ms per-await cap) and its
abort feedback are unchanged, so the P4-05 never-settling behavior is
preserved (the retry budget only needs the newest render to finish within it).

## 3. The regression check (tests/phase4.spec.js, new P4-01R)

Scenario, per the review's prescription:

1. A flowchart is rendered with the first pass delayed 1.5s (generation N).
2. With that render in flight, Export HTML is clicked — readiness begins
   waiting on generation N.
3. The theme toggle is clicked, starting the themed rerender with a 3s delay
   (generation N+1), so the OLD pass settles first while the NEW one is
   still rendering.
4. The test waits for the download and for both render passes to finish, then
   asserts in-page timing (single `performance.now()` clock):
   - exactly two themed render passes, older first (the stale-acceptance
     window existed in this run);
   - **the export's blob creation time >= the newer render's settle time**
     (export must never proceed before the newest render settles);
   - the exported standalone declares the theme current at export time
     (`data-theme` reflects the toggle).

### Negative control (test validity)

The P4-01R check was developed against the unfixed readiness code before the
fix was re-applied, and it failed there exactly at the core assertion — the
export proceeded ~1.5s after export-click, while the themed rerender was
still ~2s from finishing (`exportBlobAt` ≪ `renderLog[1].endedAt`). The
diagnostic trace of that run (readiness accepted the pre-toggle generation at
its settle time while the newer generation was mid-flight) is reproduced by
the probe `qa-artifacts/p4r-theme-race-probe.js`. One negative-control detail
recorded for transparency: the first control run accidentally moved the
`watchGen` capture to post-await positions, which changes semantics (that
variant happens to also survive the single-toggle race); the control was
repeated with the capture at its original pre-await position, where the
defect reliably reproduces. The committed test asserts ordering, not
placement, and is defeated only by real readiness (fix verified: passes).

## 4. Retest matrices (frozen remediation candidate `ffadcc6`, `--retries=0`)

Environments: Windows 11 x64; Playwright 1.65.1 headless; Chromium, Microsoft
Edge (channel), Google Chrome (channel), Firefox. Fresh context per test.
Origins: `file:///C:/Git/markdown_studio/scripts/markdown-studio.html` and
`http://127.0.0.1:8642/scripts/markdown-studio.html` (python http.server).

| Suite | file:// | http://127.0.0.1:8642 |
| --- | --- | --- |
| P4-01..P4-08 + P4-01R (`tests/phase4.spec.js`, 9 tests x 4 browsers) | 36 passed | 36 passed |
| Phase 1 regression (24 tests x 4 browsers) | 92 passed / 4 skipped (SM-03 origin-dependent, by design) | 96 passed |
| Phase 2 regression (7 tests x 4 browsers) | 28 passed | 28 passed |
| Phase 3 regression (7 tests x 4 browsers) | 28 passed | 28 passed |
| **Total (188 checks per origin)** | **184 passed / 4 skipped / 0 failed** | **188 passed / 0 failed** |

Logs: `qa-artifacts/phase4-remediation-sweep.log` (pre-freeze four-browser
sweep, 36/36), `qa-artifacts/phase4-remediation-matrix-fileorigin.log`,
`qa-artifacts/phase4-remediation-matrix-http.log` (post-freeze matrices,
exit 0, ~2.0m / 1.9m). File-origin P4-01R evidence preserved under
`qa-artifacts-fileorigin/PHASE4-P4-01R-fileorigin.evidence.json` (per-run
window: both render passes logged, export recorded after the newest settle,
`exportAfterNewestSettled: true`); matrix log preserved alongside.

P4-05 (bounded abort) passes unchanged on all eight browser-origin runs,
confirming the generation-check tightening did not alter the
never-settling abort path. P4-01's existing staleness cases
(edit mid-flight, tab switch mid-flight, print) all pass alongside.

## 5. Open items

- **Production launch URL: OPEN** (cross-phase rollout dependency, unchanged
  from all prior phases). file:// and localhost HTTP are not production
  coverage substitutes.
- Firefox PDF artifact for P4-08 remains BLOCKED-by-engine (documented in the
  Phase 4 QA report; unchanged by this remediation).

## 6. Recommendation

The review's open P2 finding is remediated: readiness requires the current
generation to settle, and the P4-01R regression — proven to fail on the
unfixed code — passes on all four browsers on both covered origins, with the
full Phase 1–4 matrix green. I recommend the reviewer re-inspect the
one-hunk candidate change and proceed to Phase 4 sign-off, subject to the
standing production-launch-URL dependency.
