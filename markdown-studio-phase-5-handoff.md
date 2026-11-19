# Markdown Studio Phase 5 handoff — migration verification and QA/QC

Prepared November 17, 2026  
Status: ready for coder and independent QA/QC execution.

## Objective

Reverify the live Studio migration against the accepted Phase 6 correction set, close any implementation or test gaps found in the migration branch, and produce a fresh, independently checked QA package tied to one frozen candidate.

The live migration entry point is the target. The standalone Phase 6 candidate is a behavioral reference. Preserve live persistence, `markflow_*` state, `gemini_studio_*` transfer behavior, same-origin transfer contracts, and the migration's soft-wrap-aware line-number gutter. Do not replace the live entry point with the standalone candidate or apply its unified patch wholesale.

## Starting references

| Item | Reference |
| --- | --- |
| Migration branch | `wp/studio_migration` |
| Last reviewed migration candidate | commit `ffadcc65f8d0e196b6498596991aaa146a024ace`; live-file blob `ca087ef54d44f17062eb0e3ec8fa6da30635c97e` |
| Live migration file | `scripts/markdown-studio.html` |
| Phase 6 standalone source reference | commit `c0da234d3640976e75c6cefe4c3353c9632f8e86`; candidate blob `05359f4f5bf855a0e219a03687d6c3690d2cf098` |
| Phase 6 final audit | `audit/phase6-final-c0da234` at `dd56d3a4f30c147443fd885ec63581a0371da4c1` |

Before starting, fetch the remote and record the exact `wp/studio_migration` head and live-file blob. If either differs from the references above, review the intervening changes and update this handoff's candidate pin before editing.

## Coder work

### 1. Verify the ported application behavior

Review the current live code and make only focused changes for reproduced defects.

- **Render readiness and aborts:** inspect `ensurePreviewRenderReady()` and every export/copy/print caller. Verify that a newer theme render, tab switch, content edit, or debounce generation cannot be mistaken for a settled preview. Confirm a never-settling renderer returns failure and prevents download, clipboard write, and `window.print()`.
- **Clean rendered and standalone HTML:** confirm exports and rendered copy use the newest settled content, strip Studio-only controls and transient error UI, preserve valid diagram labels and code/Markdown content, and do not mutate the live preview. Cover valid, invalid-diagram, and empty documents.
- **Clipboard behavior:** check exact raw Markdown and rendered HTML payloads through the real user actions. Include permission denial and recovery; a toast-only assertion is insufficient.
- **SVG export:** verify that exported labels remain visible without `foreignObject`, dimensions/viewBox are usable, and text labels have positive rendered bounds when reopened.
- **PNG export:** verify valid decoded image dimensions and visible diagram pixels. Exercise image-load, serialization, canvas/taint, object-URL creation, `toBlob`, and cleanup failures; failures must not show success or leave URLs unreleased.
- **Print/PDF:** confirm the tall 26-step diagram paginates without clipping. Retain actual PDFs and verify page content, including first, middle, and final steps. Distinguish PDF generation from print-layout DOM assertions.
- **Gutter:** preserve the live soft-wrap implementation. Recheck long wrapped lines, font/width changes, pane visibility, scroll synchronization, and the 2,000-line typing path.
- **Live-only contracts:** confirm saved tabs/preferences remain readable and cross-Studio transfer still uses its existing message/storage contract. Avoid schema or origin-contract changes unless separately justified.

### 2. Strengthen the Playwright evidence

Add or adapt Phase 5 tests where the existing suite does not prove the result:

1. Read back the clipboard payload where browser permissions permit, or capture and compare the exact value passed to the real clipboard API while separately exercising denial. Assert equality to the expected Markdown and rendered HTML.
2. Test standalone export and rendered copy for valid, invalid-diagram, and empty documents; reopen the exported HTML in a fresh page and confirm the expected content and absence of transient controls.
3. Reopen SVG output and verify no `foreignObject`, positive text-label bounds, and usable dimensions. Reopen/decode PNG output and verify dimensions and non-background rendered pixels.
4. For PDFs, inspect each retained page for all 26 step labels. Use PDF text extraction plus rendered-page inspection, or an equivalent reliable check; page count and source-DOM visibility alone do not prove unclipped output.
5. Exercise Firefox's native/manual print-to-PDF path if Playwright cannot create a PDF artifact. Retain the resulting sample and inspect its pagination. Record automation limitations separately.

Keep the existing targeted theme-generation race and never-settling-render regressions. Keep per-browser output paths isolated.

### 3. Freeze the candidate

After any code or test changes, run the coder's focused checks, commit the complete candidate, and record:

- commit SHA and live-file Git blob;
- SHA-256 and byte/line counts for the live entry point;
- list of changed application and test files;
- focused test output and any open issue with a proposed disposition.

No application or test changes may be made after QA/QC begins. Any correction requires a new frozen candidate and a complete rerun of the affected checks.

## Independent QA/QC work

QA/QC must verify the frozen commit independently and run the full migration regression suite plus Phase 5 checks against it.

### Launches and browser matrix

- Run from both `file://` and a local HTTP server, using isolated profiles for each launch mode.
- Cover Chromium, Microsoft Edge, Google Chrome, and Firefox.
- Run the Phase 1–4 regression suites as well as Phase 5 checks.
- Verify same-origin Studio transfer on localhost when both Studios share the exact scheme, host, and port. Record that file-origin transfer is not the same-origin scenario.
- Do not clear or rewrite user storage; use synthetic fixtures and isolated profiles.

### Required artifact review

- Compare clipboard payloads with exact expected content; verify denial produces no payload or false-success message.
- Open standalone HTML and SVG exports in fresh browser pages. Decode PNGs and inspect actual rendered pixels.
- Inspect every retained tall-diagram PDF page and confirm all 26 steps appear without clipping. Include a Firefox-generated sample from the browser's native print flow if Playwright PDF capture is unavailable.
- Check console/page errors, download and clipboard side effects on failed readiness, and object-URL cleanup.
- Verify gutter position and scroll alignment for wrapped and long documents and run the existing typing-path performance case.
- Recheck persistence and transfer behavior on the frozen candidate.

### Evidence package

Retain a new Phase 5 evidence package rather than reconstructing the deleted Phase 6 evidence tree. Use isolated browser and launch-mode paths, for example:

- `qa-artifacts/phase5/<browser>/`
- `qa-artifacts-fileorigin/phase5/<browser>/`

Include run-stamped JSON results, test logs, screenshots, standalone HTML/SVG/PNG outputs, PDFs, PDF page inspections, browser/version and origin metadata, and SHA-256 checksums. The evidence index must map each acceptance item to its result and artifacts.

## Exit gate

Phase 5 passes only when:

- the frozen candidate matches the reviewed commit/blob/hash;
- all focused and Phase 1–4 regression checks pass across the required launch modes and browsers, with no unexplained failures;
- clipboard, SVG, PNG, and PDF outputs are validated as actual artifacts;
- persistence, transfer, and gutter behavior remain intact;
- evidence files are present, browser-specific, and covered by the fresh checksum inventory;
- every blocked item has a precise reason, evidence, impact, and release disposition.

The Phase 6 branches remain references for this work. Decide the final PR source and integration direction only after the Phase 5 candidate and evidence pass this gate and the local branch history has been reconciled.
