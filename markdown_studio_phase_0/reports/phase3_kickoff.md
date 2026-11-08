# Phase 3 kickoff — diagram styling, sizing & theme alignment (R06, R07, R08)

Date: 2026-11-08. Branch: `vibe/phase3-r06-r07-r08-2ace24` off `vibe/code_revisions` @ `2c3c383` (Phase 2 verified & merged via PRs #11/#12; candidate `1f10e112…`, 4,694 lines). F5 decided: original snapshot remains the target; live app and baseline untouched.

## Scope (plan §6) and current code refs

| ID | Finding | Current refs in `working/markdown_studio.html` |
| --- | --- | --- |
| **R06** | Markdown typography can affect HTML labels inside Mermaid SVGs (suspected; browser verification required) | `.preview-content` typography rules (~line 820+); Mermaid `htmlLabels: true` in `initMermaid` (2566); cards render into `.mermaid-canvas` inside `.preview-content` |
| **R07** | Tall diagrams clipped by the capped preview viewport (source-supported; visual verification required) | `.mermaid-viewport { max-height: 520px; … }` (~line 965–978); pan/zoom in `setupPreviewDiagramInteractivity` |
| **R08** | Studio theme initialization changes shared Mermaid configuration (source-confirmed shared state) | `initMermaid(themeName)` (2566) calls `mermaid.initialize` globally; called from studio open/theme change and preview render — one shared global config |

## Work items (plan §6)

1. Compare identical source in Studio vs Markdown preview; confirm or **disprove** R06 — do not claim fixed without evidence; log the outcome either way.
2. Scope Markdown typography so it cannot alter Mermaid label layout; avoid broad SVG text overrides that conflict with Mermaid styling.
3. Define consistent render config and explicit Studio-vs-document theme behavior (R08): per-render config instead of mutating the shared global, or documented policy with re-init.
4. Fit diagrams against **both** available dimensions on initial display (R07); retain pan and manual zoom; define Reset/Fit consistently; recompute fitting after pane resize and viewer hide/show; check narrow viewports, long labels, arrows, node borders, toolbar reachability.

## Gate G3 (plan §6, verbatim criteria)

Every built-in template and tall/wide fixture legible in **both** views; no clipping at initial fit; at manual zoom all content reachable by panning; labels have no unexplained spacing/truncation; light/dark and Studio custom themes follow the documented policy; repeat after split resizing, viewer hide/show, and at a narrow viewport.

Evidence: **paired Studio/preview screenshots** with source fixture, theme, viewport, and zoom recorded. R06 must be logged confirmed or disproved.

## Test plan

- Mock: `tests/phase-3-checks.cjs` — P3-01 theme isolation (initMermaid with studio theme must not change preview config object; or documented re-init), P3-02 fit computation (tall/wide fixture → fit scale uses min of both dimensions; cap removed or content reachable), P3-03 typography scoping (assert preview CSS selectors don't reach into `.mermaid-canvas svg` text).
- Browser: add `G3-*` stop points to `tests/g0-capture-routine.cjs` (paired studio/preview screenshots per fixture × theme × viewport incl. narrow; tall/wide fit; theme ×3 cycles; split-resize refit; viewer hide/show). Reuse fixtures `tall.md`, `wide.md`, templates; add a `long-labels.md`.
- Matrix: headed 4-browser runs (`--browser chromium|edge|chrome|firefox`, `--origin both`), run-stamped manifests, candidate LF-normalized hash must equal the new committed candidate.

## Process rules (unchanged)

Write-once + run-stamped evidence; regenerate `checksums.sha256` at every checkpoint (it arrived stale twice — do it before pushing); raw + LF-normalized candidate hashes; D-series IDs for new discoveries; no advancing past a failed gate; blocked/unrun ≠ pass; run on the **committed** candidate only.

## First commands (Windows PowerShell)

```powershell
git checkout vibe/phase3-r06-r07-r08-2ace24
git pull
cd markdown_studio_phase_0
node tests\baseline-checks.cjs
node tests\phase-1-checks.cjs
node tests\phase-2-checks.cjs
```
