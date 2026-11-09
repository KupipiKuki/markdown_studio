# QAQC verification — Phase 3 (R06, R07, R08) on `vibe/phase3-r06-r07-r08-2ace24` @ `c213020`

Date: 2026-11-08/09. Verifier: Linux x86-64, Node v22.23.4, vendored marked 12.0.2.

## Verdict: **Phase 3 accepted — Gate G3 met (P3 3/3 mock + 148/148 × 4 browsers).**

## Implementation reviewed

Candidate `66eb9ae30049f4ce4ca7f4262981d348faf2a3bab30fe36a90c12b5e8ba7d7ab` (raw = LF, clean; 4,940 lines) vs Phase 2 tip `1f10e112…`.

- **R06**: all `.preview-content` typography selectors scoped with `:not(.mermaid-block-card *)`; explicit foreignObject resets (margin/padding/line-height, `code` background/border neutralized) for `.mermaid-canvas` and `#builderDiagramCanvas`.
- **R07**: `getSvgIntrinsicDimensions` (viewBox → attrs → getBBox → rect) + `computeDiagramFitScale = min(scaleX, scaleY, 1.0)`; SVG `max-width:100%`/`height:auto` overrides removed (`overflow: visible`); dynamic minZoom floor; initial zoom = fitScale (pan reset unless manually adjusted); refit on split drag / 50-50 / viewer toggle / window resize; Reset/Fit toggle.
- **R08**: preview render path re-inits `initMermaid(getMermaidTheme())` before rendering (document theme policy enforced); `closeStudio` re-inits; studio theme dropdown sync. Policy: document owns preview theme; studio uses its own selection and restores on close.

Baseline blob still `11eaec36…`; live app untouched.

## Verification results

| Check | Result |
| --- | --- |
| Suites (fresh scratch): baseline / P1 / P2 / P3 | exit 0 / 7-7 / 3-3 / **3-3** |
| P3-01 / P3-02 / P3-03 (committed results) | theme isolation with re-init policy (light/dark/forest/neutral cycles isolated); tall 89.8×2176 → fitScale 0.224, wide 1800×49 → 0.293; unscoped selectors eliminated, foreignObject resets present |
| **Independent QAQC repro** (extracted real functions) | fit: tall→0.239, wide→0.307, small→1.0 (no upscale); viewBox intrinsic 1800×49 correct; **0** unscoped `.preview-content` typography selectors; foreignObject resets present; preview + closeStudio re-init both present in source |
| Browser matrix on `66eb9ae3…`: chromium 158, edge 157.0.4341.42, chrome 157.0.8103.39, firefox 159.0 (headed, file+http) | **148/148 pass each** (143 + 5 G3 stop points); `G3-FIT-TALL-WIDE`: tall diagram not clipped top/bottom; `G3-THEME-ISOLATION-3X`: preview theme isolated through studio theme cycles 4/4 browsers; `G3-TYPOGRAPHY-LABELS`: no code-bleed in foreignObject labels (computed styles clean); `G3-RESIZE-VIEWPORT-REFIT`: fit scale adapts on split drag/reset/toggle; zero non-pass, zero console errors |
| Checksums | coder's `update-checksums.cjs` hashed from a CRLF disk (68 entries wrong incl. baseline — blobs are fine, verified `11eaec36…`); regenerated from LF → **297/297 OK** |
| Audit | Phase 3 marked Verified; full candidate lineage through `66eb9ae3…` recorded with LF + raw hashes |

## G3 gate mapping (plan §6)

Templates + tall/wide legible in both views, no clipping at initial fit, pan-reachable at zoom (G3-FIT-TALL-WIDE) ✓; labels clean (G3-TYPOGRAPHY-LABELS) ✓; theme policy incl. 3× cycles (G3-THEME-ISOLATION-3X) ✓; repeat after split resize / viewer toggle / narrow viewport (G3-RESIZE-VIEWPORT-REFIT) ✓. R06 logged **confirmed and fixed** with evidence.

## Notes

- **P3-1 (process):** the new `tests/update-checksums.cjs` must hash LF-normalized content (or the repo needs a root `.gitattributes` with `* text=auto eol=lf`) — this is the third time a CRLF disk produced wrong checksums (M1, W2 fixtures, now 68 entries). Recommend adding `.gitattributes` at repo root.
- **P3-2:** `evidence/phase-3/phase-3-results.json` summary keys are absent (only `results[]` + candidate) — cosmetic; the per-test records are complete.

**Recommendation:** merge `vibe/phase3-r06-r07-r08-2ace24` into `vibe/code_revisions`, then start **Phase 4 (R10/R11/R12 insertion commands + control sweep, Gate G4)**.
