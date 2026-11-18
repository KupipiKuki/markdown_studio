# Markdown Studio Phase 5 QA/QC Handoff — Frozen Candidate Verification

Prepared November 17, 2026  
Coder: Antigravity (Gemini 4 Hydrogen)  
Target QA/QC Reviewer: Independent QA/QC (Mistral)  
Reference Plan: `markdown-studio-phase-5-handoff.md`

---

## 1. Frozen Candidate Pin

No application or test changes may be made during QA/QC. Any defect requiring a code or test edit invalidates this freeze and requires a new frozen commit.

| Item | Value |
| --- | --- |
| Branch | `wp/studio_migration` |
| Frozen Commit SHA | `02b53632939d658fb41c7ec80a091d6378bb1633` |
| Live Entry Point | `scripts/markdown-studio.html` |
| Live-File Git Blob | `ca087ef54d44f17062eb0e3ec8fa6da30635c97e` |
| Live-File SHA-256 | `F401A2EF2FD2DA064D6E1ADAA33AF2C90AA831B9563DE9521D07DA04F84BD1F7` |
| Live-File Size | `243,953` bytes / `6,398` lines |
| Phase 6 Standalone Reference | commit `c0da234d3640976e75c6cefe4c3353c9632f8e86`, blob `05359f4f5bf855a0e219a03687d6c3690d2cf098` |

### Files Added in Frozen Commit (`02b5363`)
- `tests/phase5.spec.js` — Phase 5 Playwright verification suite (`P5-01` through `P5-05`)
- `qa-artifacts/phase5/firefox/tall-diagram.pdf` — Manual Firefox print-to-PDF capture of the 26-step tall diagram (`73,766` bytes, `4` pages)
- `qa-artifacts/phase5/firefox/PHASE5-P5-04-firefox-tall-diagram.evidence.json` — `pdf.js` per-page text and pixel inspection of the Firefox PDF
- `qa-artifacts/phase5/firefox/tall-diagram-page-1.png` through `tall-diagram-page-4.png` — Rendered page images of the Firefox PDF

No changes were made to `scripts/markdown-studio.html` (verified identical to blob `ca087ef54d44f17062eb0e3ec8fa6da30635c97e`).

---

## 2. Coder Verification Summary

### Live Code Review (`scripts/markdown-studio.html`)
- **Render readiness & aborts** (`ensurePreviewRenderReady()`, lines 5565–5629): Bounded awaits on `currentMathJaxPromise` and `currentPreviewRenderPromise`, checks `previewRenderSettledGen >= previewRenderGeneration`, and aborts `#btnExportHtml`, `#btnPrintPdf`, and `#btnCopyHtml` on stall.
- **Clean HTML / Standalone HTML** (`getCleanRenderedContent()`, `generateStandaloneHtml()`, lines 5631–5805): Strips Studio controls/error UI, degrades error cards to `language-mermaid` source blocks, and leaves live preview untouched.
- **Clipboard** (`copyToClipboard()`, lines 2793–2819): Surfaces denial/failure without false-success toasts.
- **SVG & PNG Export** (`sanitizeSvgForExport()`, `exportDiagramSvg()`, `exportDiagramPng()`, lines 3357–3590): Converts `foreignObject` to `<text>`, sets explicit dimensions/`viewBox`, handles serialization/blob/load/canvas/`toBlob` failures, and revokes temporary object URLs.
- **Print/PDF** (`@media print`, lines 1766–1834): Uncaps viewport/card height and overflow for multi-page flow.
- **Gutter & Live-only contracts**: Soft-wrap gutter sync, `markflow_*` `localStorage` keys, and `gemini_studio_bus` / `gemini_studio_transfer_queue_v1` preserved.

### Focused Coder Test Runs
- **Phase 1–4 baseline (`file://`, Chromium)**: `46 passed`, `1 skipped` (`SM-03` HTTP-only transfer).
- **Phase 5 (`http://127.0.0.1:4173/scripts/markdown-studio.html`, Chromium / Edge / Chrome / Firefox)**: `19 passed`, `1 skipped` (`P5-04` on Firefox).
- **Phase 5 (`file://`, Chromium / Edge / Chrome / Firefox)**: `19 passed`, `1 skipped` (`P5-04` on Firefox).
- **Firefox manual `tall-diagram.pdf` inspection**: `4` pages, `0` missing steps (`Step 1`–`Step 12` on p.2, `Step 12`–`Step 23` on p.3, `Step 24`–`Step 26` on p.4).

---

## 3. Independent QA/QC Execution Instructions

1. **Verify the frozen candidate before running tests**:
   - Confirm `git rev-parse HEAD` is `02b53632939d658fb41c7ec80a091d6378bb1633` (or note any QA/QC-only evidence commits on top without modifying `scripts/markdown-studio.html` or `tests/`).
   - Confirm `git hash-object scripts/markdown-studio.html` is `ca087ef54d44f17062eb0e3ec8fa6da30635c97e` and SHA-256 matches `F401A2EF2FD2DA064D6E1ADAA33AF2C90AA831B9563DE9521D07DA04F84BD1F7`.

2. **Run full Phase 1–5 regression matrix** across **Chromium, Microsoft Edge, Google Chrome, and Firefox** in both launch modes using isolated profiles:
   - **`file://` launch mode**:
     ```powershell
     npx playwright test tests/phase1.spec.js tests/phase2.spec.js tests/phase3.spec.js tests/phase4.spec.js tests/phase5.spec.js
     ```
   - **Local HTTP server launch mode** (required for `SM-03` and `P5-05` same-origin `gemini_studio_bus` transfer):
     Serve the repo root over `http://127.0.0.1:<port>` and run with `P1_BASE_URL=http://127.0.0.1:<port>/scripts/markdown-studio.html`.
     *(Note: `file://` transfer is not the same-origin HTTP scenario and should be recorded separately.)*

3. **Artifact & Evidence Package**:
   - Retain browser- and launch-mode-isolated evidence under:
     - `qa-artifacts/phase5/<browser>/`
     - `qa-artifacts-fileorigin/phase5/<browser>/`
   - Include run-stamped JSON results, test logs, screenshots, standalone HTML/SVG/PNG outputs, PDFs, PDF page inspections, browser/version and origin metadata, SHA-256 checksums, and an evidence index mapping each acceptance item to its result and artifacts.

---

## 4. Open Items & Dispositions

1. **Firefox automated PDF generation (`P5-04`)**
   - **Reason**: Playwright throws `page.pdf: PDF generation is only supported for Headless Chromium` on Firefox.
   - **Evidence**: `qa-artifacts-fileorigin/phase5/firefox/PHASE5-P5-04.evidence.json`, `qa-artifacts/phase5/firefox/tall-diagram.pdf`, `qa-artifacts/phase5/firefox/PHASE5-P5-04-firefox-tall-diagram.evidence.json`, and `tall-diagram-page-1.png`–`4.png`.
   - **Disposition**: Automation limitation; covered by the retained manual Firefox print-to-PDF sample showing all 26 steps rendered across pages 2–4 without clipping.

2. **Code-block transfer buttons in `@media print`**
   - **Observation**: In a manual Firefox PDF of the starter document (`qa-artifacts/phase5/firefox/Markdown Editor & Mermaid Studio.pdf`, page 3), `.code-block-actions, .code-action-btn` (`↗ Notepad++`, `▶ Run in Notebook`) appeared in print output because `@media print` at `scripts/markdown-studio.html:1797` hides `.mermaid-header, .diag-action-btn, .mermaid-actions` but omits `.code-block-actions, .code-action-btn` (which are stripped by `getCleanRenderedContent()` at line 5638).
   - **Disposition**: Low-severity cosmetic item; frozen candidate left untouched. QA/QC should record whether to accept as-is or require a follow-up fix before PR integration.
