# Markdown Studio — Phase 0 baseline checkpoint

Date: November 3, 2026 (America/New_York). Status: **blocked at G0; no application changes**.

The first phase in the approved plan is Phase 0, baseline, reproduction, and test setup. Baseline preservation, inventories, fixtures and repeatable non-browser checks are complete. Browser launch and visual capture are blocked. Phase 1 has not started; G0 is not claimed as passed.

## Baseline integrity

| Item | Recorded value |
| --- | --- |
| Original | `baseline/markdown_studio.original.html` (read-only permissions) |
| Separate working copy | `working/markdown_studio.html` |
| SHA-256 of both copies and supplied source | `11eaec367bb698f557abefafd359a5983d5ef0e08d1fce4e45ea08ec7277a83c` |
| Bytes / lines | 155,945 / 4,316 |
| Baseline change-history commit | `71da522` |
| Application additions / deletions | 0 / 0 |
| Dependencies declared in HTML | Marked 12.0.2; Mermaid 10.9.1; Highlight.js 11.9.0; MathJax 3.2.2; Inter and JetBrains Mono from Google Fonts |

Read-only permissions and checksums protect against accidental editing; this is not write-once storage. The supplied source and plan were resolved to their existing file identities, retained privately in `evidence/phase-0/baseline.json`. No authoritative source version number was returned, so none was inferred.

## Work and evidence

| Phase 0 requirement | Result | Evidence |
| --- | --- | --- |
| Preserve original and hash | Pass | `baseline/markdown_studio.original.html`; `evidence/checksums.sha256` |
| Separate working copy and change history | Pass | `working/markdown_studio.html`; `evidence/phase-0/change-history.txt` |
| Control inventory | Enumerated; execution unrun | `evidence/phase-0/controls.md` and `controls.json`: 111 static controls, plus dynamic families and keyboard routes |
| Fixed fixtures | Prepared | `evidence/phase-0/fixtures/`: 25 Markdown files, including all 16 built-in templates |
| Findings register | All 15 findings accounted for | Table below; `evidence/phase-0/test-results.json` |
| Source syntax | Pass | All inline scripts compile with Node's JavaScript parser |
| Browser-capable capture setup | Prepared; launch blocked | `tests/browser-baseline.cjs`; `evidence/phase-0/browser-results.json` |
| Local-file and local-HTTP application checks | Blocked before navigation | No browser executable; neither origin has been verified |
| Baseline visual screenshots and browser console | Blocked | No screenshots or browser-console captures claimed |
| Windows Edge/Chrome and secondary Firefox | Unrun | Host is Linux; Windows targets unavailable; Firefox binary missing |

Fixtures cover all templates, tall/wide diagrams, multiple diagrams, invalid syntax, long/multiline labels, mixed Markdown/math/code, mixed backtick/tilde fences, four-backtick outer fences containing literal triples, ordinary code with literal Mermaid text, and list/blockquote fences. Parser acceptance and application rendering of the nested and outer-fence cases still require verification through the complete application path.

## Reproduction register

The nine records in `test-results.json` comprise one passing baseline/syntax check and eight defect-observation checks covering nine R-series findings. A successful defect reproduction is **not** a successful application test. Extracted-function mocks cannot establish visual layout, browser event dispatch, clipboard access or exported-file correctness.

| Issue | Baseline observation / current evidence | Browser status | Follow-up phase |
| --- | --- | --- | --- |
| R01 | B01: actual renderer replaces canvas children; mock DOM loses raw source after first SVG insertion | Unverified | 1 |
| R02 | B01: second render skips same card; parse count stays at one | Theme switching unverified | 1 |
| R03 | B03: generated error button class does not match action-binding selector | Actual click unverified | 1 |
| R04 | B04: handler names invoked outside actual closure raise ReferenceError | Browser console unverified; recorded errors are from Node | 1 |
| R05 | B05: real Marked 12.0.2 sees two Mermaid blocks; replacement regex sees only the backtick block. Index zero maps to different diagrams | End-to-end Edit/Update unverified | 2 |
| R06 | Source hypothesis: preview paragraph rule can enter SVG HTML labels (baseline line 809; configuration at 2539) | Visual cause unverified | 3 |
| R07 | Source hypothesis: viewport max-height 520px and hidden overflow (965–991) | Clipping and fit unverified | 3 |
| R08 | Shared Mermaid initialization in Studio (3867–3872) | Theme divergence unverified | 3 |
| R09 | B09: two actual setup calls add four window handlers for one card | Real detached-node retention and 50-cycle test unrun | 2 |
| R10 | B10: divider insertion yields a trailing literal `text` | Pointer and selection variants unverified | 4 |
| R11 | B11: empty-selection image command produces `![Alt text](texthttps://example.test/image.png)` | Browser prompt path unverified | 4 |
| R12 | B12: subgraph attribute contains five literal backslash-n sequences and zero real newlines | Palette click unverified | 4 |
| R13 | Export/copy/print handlers have no render-ready wait (4096–4139) | Immediate-export race unverified | 5 |
| R14 | PNG load/canvas failure handling absent in reviewed path (2743–2783) | Failure injection and PNG labels unverified | 5 |
| R15 | Async renderer has no generation guard | Controlled out-of-order completion unrun | 2 |

No findings are closed. No incidental application corrections were made in this baseline phase. Future minor corrections must receive D-series entries and audit/diff mappings.

## Browser blocker and gate decision

Actual environment: Linux x86-64, Node v24.22.1, Playwright 1.62.1. Chromium and Firefox launch attempts failed because their executables do not exist. Standard Chromium and headless-shell installation attempts returned non-ZIP responses and failed extraction. An alternate browser archive endpoint returned a short “Site Unavailable” HTML response. These are environment/setup failures, not evidence of application failure or of clipboard/CDN restrictions inside the application.

The Marked dependency was fetched successfully for parser-only tests. That success does not establish dependency loading in a browser or either launch mode. `browser-results.json` preserves exact executable/launch errors. `setup-limitations.md` records the download observations.

**Gate G0: blocked.** The missing baseline screenshots and browser functional evidence prevent a pass. Continue by provisioning a browser-capable environment, running the capture harness, inspecting visual fixtures, and recording baseline control and clipboard behavior. Cover the available local-file and HTTP launch modes separately. Then review G0 and begin Phase 1 only after it passes. No application fixes have been applied ahead of the gate.

## Re-run instructions

From the extracted package root:

```sh
python3 tests/setup_baseline.py
node tests/baseline-checks.cjs
node tests/browser-baseline.cjs
```

The parser-only suite includes the baseline Marked dependency under `tests/vendor/`. Browser capture requires Playwright and its compatible Chromium/Firefox binaries. Install dependencies in a permitted environment; do not treat fixture screenshots as automatic functional passes. The capture harness creates isolated contexts and synthetic documents and does not open a user's saved browser profile.

The evidence bundle includes a Git bundle of the initial working-copy commit, the unchanged source copies, fixtures, scripts, checksums and initial audit/diff records. The final project audit and baseline-to-final patch remain deliverables of Phase 6.
