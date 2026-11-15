# Phase 1 QA/QC results

Frozen candidate under test:

- Branch: `wp/studio_migration`
- Commit: `67341bacd7225c473f3ea4d254c24886e6fd6d8e` ("P2 fix: route empty Mermaid fences through parse to the repair path")
- Live file: `scripts/markdown-studio.html`, git blob `d59ab4bee1eb90720a47dffcce1f26d3422285e5`, SHA-256 `53b1a965f9ce8bd85a15d3452dd59fc655b0bb195dae4fdee74cc8ae577fa4b8`
- Parent application candidate: `68560b0` (original Phase 1 port; tested previously, see git history of this report)

## Candidate history (QA freeze log)

1. `68560b0` — original Phase 1 port. Full matrix run 2026-11-14: file:// 60 pass / 4 skip; http:// 64 pass. Superseded by the P2 fix below.
2. `67341ba` — adds the auditor P2 fix (empty/whitespace-only Mermaid fences now flow into `mermaid.parse()` and surface the syntax-error card with the repair action instead of rendering blank) plus regression check P1-04b. **This is the current frozen candidate.** Retest results below are for this commit.

## Environments

- OS: Windows 11 x64 (Windows NT 10.0; Win64; x64)
- Harness: Playwright `@playwright/test` 1.65.1, spec `tests/phase1.spec.js`, config `playwright.config.js` (headless)
- Browsers:
  - Chromium (Playwright bundled) 159.0.8154.6
  - Microsoft Edge (channel `msedge`) 159.0.8154.6
  - Google Chrome (channel `chrome`) 159.0.8154.6
  - Firefox (Playwright bundled) 159.0 / rv:159.0
- Launch origins (both confirmed working):
  - `file:///C:/Git/markdown_studio/scripts/markdown-studio.html`
  - `http://127.0.0.1:8642/scripts/markdown-studio.html` (python http.server serving the repo root)
- Storage: each test ran in a fresh browser context (isolated profile, synthetic fixtures). No browser storage was cleared or rewritten.
- The normal production launch URL remains unestablished (handoff open item). It must be recorded and added to this matrix before launch-origin coverage is declared complete.

## Result matrix (candidate 67341ba)

19 spec tests per browser. `file://` run: 72 passed / 4 skipped (SM-03 requires shared http origin). `http://` run: 76 passed / 0 failed. No check has an unexplained failure.

| Check | Chromium (file) | Edge (file) | Chrome (file) | Firefox (file) | Chromium (http) | Edge (http) | Chrome (http) | Firefox (http) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P1-01 load & syntax smoke | PASS | PASS | PASS | PASS | PASS* | PASS* | PASS* | PASS |
| P1-02 render then edit/rerender | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| P1-03 multi-diagram association | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| P1-04 Fix in Studio repair | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| P1-04b empty/whitespace fences repair | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| P1-05 error-log Copy/Dismiss | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| P1-06a tilde fence | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| P1-06b info string | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| P1-06c blockquote fence | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| P1-06d list-item fence | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| P1-06e CRLF | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| P1-06f outer-fenced literal | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| P1-06g fake fence in js block | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| P1-07 measurement regression | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| SM-01 reload persistence | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| SM-02 command palette | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| SM-03 studio bus transfer | N/A (skips on file://) | N/A | N/A | N/A | PASS | PASS | PASS | PASS |
| SM-04 tab switching | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| SM-05 preferences persist | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |

\* see console note below.

## Per-check evidence notes

### P2 finding (auditor) — empty Mermaid fences

The render loop previously skipped cards whose source was empty (blank preview, no repair action). Candidate `67341ba` lets empty and whitespace-only sources reach `mermaid.parse()`, which raises a parse error; the standard syntax-error card with "Fix in Studio" is rendered. Regression check P1-04b verifies: an empty fence and a whitespace-only fence both display the error card with repair action; repairing the empty fence writes into exactly that fence, leaves the whitespace fence and a neighboring valid fence untouched, and the repaired card renders. Screenshots: `qa-artifacts/<browser>__P1-04b_*.png` (http run) and `qa-artifacts-fileorigin/<browser>__P1-04b_*.png` (file run).

### P1-01 — load and syntax smoke

Zero uncaught page errors (`pageerror`) in every browser/origin pair. Console clean except one benign pre-existing entry on Chrome/Edge http origin: `Failed to load resource: 404 (File not found)` — the repo has no `favicon.ico`, requested by branded browsers on http origins. Not related to the migration candidate; no action required for Phase 1.

### P1-05 — error-log Copy/Dismiss (R04)

Copy targets the selected row and Dismiss removes only that row in all eight pairs. A note on this retest round: each run used a fresh context, so headless Chromium's clipboard write permission state can vary by run; earlier runs demonstrated the failure-toast path (permission denied surfaced, no false success) and the Firefox `execCommand` fallback path with a verified clipboard payload. Both behaviors are asserted defensively by the spec (toast visibility + read-back probe recorded in evidence JSON).

### P1-06 — fence/span matrix

- Backtick and tilde fences, `mermaid title="..."` info strings, blockquote and list-item contexts, outer-fenced literals, and fake fences inside js blocks all behave per spec: a repair updates only the matching span, surrounding text is untouched.
- Known inherited note (also byte-identical in the audited frozen candidate `c0da234` and in candidate `68560b0`): when repairing a fence inside a list item, the re-emitted code lines lose the list indentation (fence lines keep it). Mermaid ignores leading whitespace, so rendered output is unaffected. Recorded for future candidate; not a Phase 1 blocker.
- CRLF: the textarea `value` API normalizes CRLF to LF, so the app never receives CRLF through the editor; the repair operates on the (single-fence, correctly targeted) normalized document. The parser-side CRLF handling in `getMermaidSpans` was additionally verified by Node unit tests against marked 12.0.2. Evidence: `qa-artifacts/*__P1-06e.json`.

### P1-07 — measurement-container regression (D001)

Sequence diagram and edge-labeled flowchart (with `-->|edge label|`) render in all pairs, survive a second full render pass, and leave zero error artifacts (`cleanStrayMermaidElements` selectors found nothing). The single body-level SVG observed after render is `MJX-SVG-global-cache` (MathJax's hidden font cache, `display:none`) — expected, not an error artifact, and untouched by cleanup. Evidence: `qa-artifacts/*__P1-07.json`, screenshots `*__P1-07_rendered.png`.

## Artifacts

- `tests/phase1.spec.js` — the acceptance spec (fixtures are inline; synthetic, no user data)
- `qa-artifacts-fileorigin/` — evidence from the `file://` origin run of candidate `67341ba` (JSON + screenshots)
- `qa-artifacts/` — evidence from the `http://127.0.0.1:8642` origin run of candidate `67341ba` (JSON + screenshots; results reports live alongside)
- Evidence filenames follow `<browser>__<check>[_<step>].{json,png}`

## Blocked / out of scope

- SM-03 on the `file://` origin: skipped by design; BroadcastChannel requires a shared http origin. Both origins were exercised as the handoff requires and behave as expected where applicable.
- Firefox print/PDF limitation: out of Phase 1 scope, still an explicit later-phase risk (not reclassified).
- Production launch URL: unestablished (see Environments). After it is recorded, QA must add it to the matrix before declaring launch-origin coverage complete.

## Verdict

Phase 1 acceptance checks P1-01 through P1-07 (including P1-04b for the auditor's P2 finding) plus the regression smoke pass on all four browsers at both confirmed launch origins against the frozen candidate `67341ba`. No unexplained failures. Remaining exit-gate items: record the production launch URL, then independent review sign-off.
