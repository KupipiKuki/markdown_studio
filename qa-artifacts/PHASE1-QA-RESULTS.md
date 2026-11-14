# Phase 1 QA/QC results

Frozen candidate under test:

- Branch: `wp/studio_migration`
- Commit: `68560b0208e7e1da86cd06f862de74f568e3a5af` ("Port Phase 1 Mermaid correctness fixes to live Studio")
- Live file: `scripts/markdown-studio.html`, git blob `4dd77e1a275c70b785a2565a4d0a111b6bf43bd2`, SHA-256 `3669a1a3afb29ff2abab55e7c5be5db534624476957bb93711a0273cf48e602a`
- Base for comparison: `main` @ `191a814` (pre-edit blob `d3719af...`)

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
- The normal production launch URL remains unestablished (handoff open item). It must be added to this matrix before launch-origin coverage is declared complete.

## Result matrix

All 16 spec tests ran per browser. `file://` run: 60 passed / 4 skipped (SM-03 requires shared http origin). `http://` run: 64 passed / 0 failed. No check has an unexplained failure.

| Check | Chromium (file) | Edge (file) | Chrome (file) | Firefox (file) | Chromium (http) | Edge (http) | Chrome (http) | Firefox (http) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P1-01 load & syntax smoke | PASS | PASS | PASS | PASS | PASS* | PASS* | PASS* | PASS |
| P1-02 render then edit/rerender | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| P1-03 multi-diagram association | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| P1-04 Fix in Studio repair | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
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

\* see console note below.

## Per-check evidence notes

### P1-01 — load and syntax smoke

Zero uncaught page errors (`pageerror`) in every browser/origin pair. Console clean except one benign pre-existing entry on Chrome/Edge http origin: `Failed to load resource: 404 (File not found)` — the repo has no `favicon.ico`, requested by branded browsers on http origins. Not related to the migration candidate; no action required for Phase 1.

### P1-05 — error-log Copy/Dismiss (R04)

Copy targets the selected row and Dismiss removes only that row in all eight pairs. Clipboard evidence:

| Browser | Copy path observed | Toast shown | Payload verification |
| --- | --- | --- | --- |
| Chromium (headless) | `navigator.clipboard.writeText` DENIED | "Clipboard copy failed: ... Write permission denied" | Failure correctly surfaced; no false success (R04 behavior confirmed under denial) |
| Google Chrome | `writeText` succeeded | "Error details copied to clipboard" | Read-back probe denied by permissions; toast text documented as fallback result |
| Microsoft Edge | `writeText` succeeded | "Error details copied to clipboard" | Read-back probe denied by permissions; toast text documented as fallback result |
| Firefox | `execCommand` fallback | "Error details copied to clipboard" | Read-back verified: clipboard contained exactly the logged error message |

### P1-06 — fence/span matrix

- Backtick and tilde fences, `mermaid title="..."` info strings, blockquote and list-item contexts, outer-fenced literals, and fake fences inside js blocks all behave per spec: a repair updates only the matching span, surrounding text is untouched.
- Known inherited note (also byte-identical in the audited frozen candidate `c0da234`): when repairing a fence inside a list item, the re-emitted code lines lose the list indentation (fence lines keep it). Mermaid ignores leading whitespace, so rendered output is unaffected. Recorded for future candidate; not a Phase 1 blocker.
- CRLF: the textarea `value` API normalizes CRLF to LF, so the app never receives CRLF through the editor; the repair operates on the (single-fence, correctly targeted) normalized document. The parser-side CRLF handling in `getMermaidSpans` was additionally verified by Node unit tests against marked 12.0.2 (17/18 checks; the one divergence is the list indentation note above). Evidence: `qa-artifacts/*__P1-06e.json`.

### P1-07 — measurement-container regression (D001)

Sequence diagram and edge-labeled flowchart (with `-->|edge label|`) render in all pairs, survive a second full render pass, and leave zero error artifacts (`cleanStrayMermaidElements` selectors found nothing). The single body-level SVG observed after render is `MJX-SVG-global-cache` (MathJax's hidden font cache, `display:none`) — expected, not an error artifact, and untouched by cleanup. Evidence: `qa-artifacts/*__P1-07.json`, screenshots `*__P1-07_rendered.png`.

## Artifacts

- `tests/phase1.spec.js` — the acceptance spec (fixtures are inline; synthetic, no user data)
- `qa-artifacts-fileorigin/` — evidence from the `file://` origin run (JSON + screenshots)
- `qa-artifacts/` — evidence from the `http://127.0.0.1:8642` origin run (JSON + screenshots)
- Evidence filenames follow `<browser>__<check>[_<step>].{json,png}`

## Blocked / out of scope

- SM-03 on the `file://` origin: skipped by design; BroadcastChannel requires a shared http origin. Both origins were exercised as the handoff requires and behave as expected where applicable.
- Firefox print/PDF limitation: out of Phase 1 scope, still an explicit later-phase risk (not reclassified).
- Production launch URL: unestablished (see Environments).

## Verdict

Phase 1 acceptance checks P1-01 through P1-07 plus the regression smoke pass on all four browsers at both confirmed launch origins against the frozen candidate `68560b0`. No unexplained failures. Exit-gate items remaining: independent review sign-off and confirmation (or definition) of the production launch URL.
