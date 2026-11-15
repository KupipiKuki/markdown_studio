# Phase 4 remediation — independent QA/QC verification report

Prepared for the independent auditor. This verifies the coder's remediation of
the review's open P2 finding (`markdown-studio-phase-4-review.md`), reported by
the coder in `qa-artifacts/PHASE4-REMEDIATION-QAQC.md`. The QA pass did not
trust the coder's logs or claims: pins were re-hashed, the diff re-audited, the
negative control re-run from a clean worktree, and both matrices rerun fresh.

## 1. Candidate identity — re-verified from git

| Item | Expected | Re-verified | Match |
| --- | --- | --- | --- |
| Branch | `wp/studio_migration` | `wp/studio_migration`, working tree clean at `77962ff` | yes |
| Reviewed (unfixed) candidate | `1f06a9dfb75ad4e74caad8b56402cf8a902f9211`, blob `fe1c93e5...` | re-hashed `fe1c93e50f686d50a8471507d9cfc78cd112bced` | yes |
| Remediation candidate | `ffadcc65f8d0e196b6498596991aaa146a024ace` | identical; app blob re-hashed to `ca087ef54d44f17062eb0e3ec8fa6da30635c97e` | yes |
| App blob at HEAD | unchanged since candidate | HEAD's `scripts/markdown-studio.html` hashes to the same `ca087ef5` — freeze discipline holds | yes |

## 2. Boundary audit of the remediation diff (`1f06a9d..ffadcc6`)

- Application script: exactly **2 hunks, 7 additions / 3 deletions**, all inside
  `ensurePreviewRenderReady()` (~l.5588-5612): the `watchGen` snapshot and its
  comparison are removed; readiness is now
  `previewRenderSettledGen >= previewRenderGeneration` with an explanatory
  comment. This is precisely the correction the review recommended (awaited
  generation must still be the current one and the current one must be
  settled; otherwise the next attempt re-awaits the new
  `currentPreviewRenderPromise`).
- Spec: `tests/phase4.spec.js` +87 lines (new P4-01R test plus a
  `waitForFunction` guard so the ordering assertion is evaluated after both
  render passes settle even on broken builds).
- Forbidden-scope grep over added app lines (storage keys, studio-bus ids,
  BroadcastChannel, CDN, slide/presentation): **0 hits**. All other files in
  the range are QA artifacts only.

## 3. Independent negative control (does P4-01R actually catch the defect?)

- Created a clean git worktree at the **unfixed** candidate `1f06a9d`, copied
  the current `tests/phase4.spec.js` into it, and ran P4-01R on Chromium with
  `P1_BASE_URL` pointing at the worktree's app file.
- Result: **fails** with `Error: export must not proceed before the newest
  render settles` — the core ordering assertion. The unfixed readiness
  accepted the pre-toggle generation while the themed rerender was still in
  flight, exactly the review's scenario.
- Worktree removed afterwards (`git worktree list` shows only the main tree).
- On the fixed candidate the same check passes 4/4 browsers on both origins
  (below), so the test discriminates correctly.

## 4. Independent test rerun (QA rerun, not the coder's logs)

Fresh runs against the working tree (app blob `ca087ef5`), Playwright 1.65.1
headless, `--retries=0`, fresh context per test:

| Run | Result |
| --- | --- |
| `qa-artifacts/phase4-rem-qaqc-rerun-fileorigin.log` (phase1-4 x 4 browsers, file://) | **184 passed / 4 skipped / 0 failed** (1.9m, exit 0) |
| `qa-artifacts/phase4-rem-qaqc-rerun-http.log` (same, http://127.0.0.1:8642) | **188 passed / 0 failed** (1.9m, exit 0) |

- The 4 file-origin skips are the by-design SM-03 "shared http origin only" skips.
- Sorted outcome sets of both QA reruns are **identical** to the coder's
  committed remediation matrix logs (`phase4-remediation-matrix-*.log`), 188
  lines each — same passes, same skips, zero failures.
- P4-01R: 4/4 on each origin. P4-05 (bounded abort on never-settling renders)
  still passes on all 8 browser-origin runs, confirming the tighter
  generation check did not disturb the abort path.

## 5. Evidence validation

- `qa-artifacts/PHASE4-P4-01R.evidence.json` (http origin, firefox):
  `renderLog` ends at 3558ms and 5468ms; `exportBlobAt` = 5470ms;
  `exportAfterNewestSettled: true` — the export demonstrably waited for the
  newer themed render.
- `qa-artifacts-fileorigin/PHASE4-P4-01R-fileorigin.evidence.json`: file://
  launch, same ordering property holds.
- Diagnostic probe retained: `qa-artifacts/p4r-theme-race-probe.js`
  (in-page readiness/wrapper timing trace of the race scenario).

## 6. Findings

- No new defects. The remediation is minimal (one logical app change), exactly
  in the reviewed location, and the regression is proven to fail without it.
- Observation (informational): in-place per-check evidence JSONs hold the
  last-running project; file-origin copies live under `qa-artifacts-fileorigin/`
  (same convention as earlier phases).

## 7. Open items (unchanged)

- **Production launch URL: OPEN** — coverage is file:// and localhost HTTP
  only; not production coverage.
- Firefox PDF artifact for P4-08: BLOCKED-by-engine, documented with evidence.

## 8. QA/QC recommendation

The review's P2 finding is verifiably remediated: pins match, the diff is a
single in-scope hunk, the new P4-01R check fails on the unfixed candidate at
the exact readiness-ordering assertion and passes on the fixed candidate across
all four browsers on both covered origins, and the full 188-check matrix is
green with zero failures on both origins. Subject to the standing
production-launch-URL dependency, I recommend the auditor proceed to Phase 4
sign-off on candidate `ffadcc6`.
