# Code diff report — FINAL (Phase 6 handoff, Gate G6)

Date: 2026-11-12. Generated from the completed implementation; no planned or fabricated figures.

## 1. Compared files

| Role | Path | SHA-256 (LF-normalized) | Lines | Bytes (LF) |
| :--- | :--- | :--- | :--- | :--- |
| Baseline (immutable) | `baseline/markdown_studio.original.html` | `11eaec367bb698f557abefafd359a5983d5ef0e08d1fce4e45ea08ec7277a83c` | 4,316 | 155,945 |
| Final (frozen candidate) | `final/markdown_studio.html` | `563955c89c51e9362181733536258fb629340dd9db0368dec8dd63ea204d42b0` | 5,439 | 202,658 |
| Unified patch | `reports/markdown_studio.patch` | `b66900b0c94516c240973c83c0a00f49607a079fa268625a8e49a1c425f58e19` | 2,197 | 89,643 |

`final/markdown_studio.html` is byte-identical (LF) to the active candidate `working/markdown_studio.html`. The patch uses standard unified diff labels `--- a/baseline/markdown_studio.original.html` → `+++ b/final/markdown_studio.html` and was generated over LF-normalized content.

## 2. Statistics

- **46 hunks; +1,399 additions / −277 deletions; net +1,122 lines** (4,316 → 5,439).
- Dependency changes: **none**. CDN references are byte-identical to the baseline — marked 12.0.2 (cdnjs) and mermaid 10.9.1 (jsdelivr). The only resource-line change is inside the standalone export template's Google Fonts URL: weights `400;600;700` → `400;500;600;700` (baseline line 4106 → final line 5084), part of R13/G5 standalone theme fidelity (P5-03).
- Configuration changes: none. No new files, no build tooling, no package changes in the application artifact.
- Cosmetic-only hunks: none. Every hunk maps to an R-series finding or D001 (table below); no blanket reformatting was applied. Whitespace within hunks is incidental to the functional edits.

## 3. Per-change table (issue → code → evidence)

Baseline line numbers refer to `baseline/markdown_studio.original.html`; final line numbers to `final/markdown_studio.html`.

| ID | Affected functions / CSS selectors | Baseline → final lines | Behavioral change | Test evidence |
| :--- | :--- | :--- | :--- | :--- |
| R01 | `customRenderer.code` card markup (`.mermaid-raw-code` moved outside `.mermaid-canvas`); new `getCardMermaidCode()` | 2359–2368 → 2427–2434; fn @ 2657 | Hidden source survives `canvas.innerHTML = svg` | P1-02, P1-03 (7/7 suite); G1 browser battery 2026-11-04; 4-browser matrix 2026-11-12 |
| R02 | `renderAllPreviewDiagrams()` | 2562 → 2677 | Source read via `getCardMermaidCode`; no early-exit skip after source loss; render promise tracked | P1-02; matrix G1 stop points |
| R03 | Error-card button markup + delegated `click` on `card` matching `[data-action]` | 2580s → 2654+ | `Fix in Studio` carries `.diag-action-btn` and is clickable | P1-04; G1 stop points |
| R04 | Error-log buttons: inline `onclick` → `data-error-id`; new delegated listener on `#errorLogList`; new `copyToClipboard()` helper | 2448–2460, 2496–2506, 4308 → 2521–2560, 2600–2601, 5410–5432 | Zero inline handlers; Copy/Dismiss work inside closure; clipboard failure toast | P1-05, P1-06; matrix G1 stop points |
| R05 | `isMermaidLanguage()` (info-variant match); new `getMermaidSpans()` + `replaceDiagramSource()` replace `/```mermaid…```/g` regex | 2336–2341 → 2400–2403; 4247–4260 → 4637, 4774 | Card index ↔ source range alignment by construction across tilde/backtick/outer fences, blockquotes, indent, info strings | P1-07, P2-01; matrix G2 stop points |
| R06 | `.preview-content` typography selectors scoped with `:not(.mermaid-block-card *)`; new foreignObject resets (`.mermaid-canvas foreignObject *`) | 798–893 → 798–920 | Markdown typography no longer bleeds into SVG `foreignObject` labels | P3-03; G3-TYPOGRAPHY-LABELS 4/4 browsers |
| R07 | `.mermaid-viewport` / `.mermaid-canvas svg` / `#builderDiagramCanvas` CSS (`max-height` cap, `max-width`, overflow); new `computeDiagramFitScale()`; pan/zoom rework | 965–995, 1435–1446 → 1011–1025, 1469–1480; fn @ 2839; 2640–2790 → 2891–3310 | Bidirectional fit for tall/wide diagrams; no clipping at 520px cap | P3-02; G3 stop points 4/4 |
| R08 | `initMermaid(theme)` re-invocation inside `renderAllPreviewDiagrams()` | 2529, 2562 → 2624, 2683 | Document theme enforced before each preview render; Studio no longer leaks global theme | P3-01; G3-THEME stop points |
| R09 | `setupPreviewDiagramInteractivity()` — shared window pan handlers, per-card listeners removed | 2700s (per-card `window.addEventListener`) → fn @ 2858 | Constant window-listener count across 50 setup cycles; no detached-node retention | P2-03; G2-LISTENER-50 4/4 |
| R10 | `wrapSelection()` empty-selection fallback `'text'` removed; `insertSnippet()` caret positioning | 4247–4260 → 5355+ | No trailing literal `text` after divider/snippet/template insertion | P4-01, P4-05; G4-INSERT-COMMANDS 4/4 |
| R11 | Ribbon image action URL construction | (image handler hunk ~4092–4129) → 4963+ | Clean `![Alt text](url)` / `![selected](url)`; no `texthttps://…` concatenation | P4-02, P4-03; G4 stop points |
| R12 | Studio palette `data-insert` escape decoding (Subgraph Box C091) | 3924–3947 → 4595+ | Literal `\n` sequences decoded to real newlines on insert | P4-04; G4 stop points |
| (minor) | Editor shortcut guard while typing in `#builderCodeInput`, `#findInput`, `#replaceInput`; Escape still dismisses modals | → 4873+ | Shortcuts no longer mutate background document from inputs | P4-06; G4-SHORTCUT-GUARDS 4/4 |
| R13 | New `ensurePreviewRenderReady()`, `getCleanRenderedContent()`, `generateStandaloneHtml()`; `#btnExportHtml` / `#btnCopyHtml` / `#btnPrintPdf` handlers await render generation; retry budget exhaustion aborts with toast/error feedback; print CSS uncaps diagrams | 4096–4139 → 4969–5235; fns @ 4975, 5025, 5085; print CSS 1626–1640 → 1663–1700 | Export/copy/print wait for latest completed diagrams+math; clean document export (no error UI, transient controls, pan transforms); retry exhaustion aborts safely; tall diagrams not clipped in print | P5-01, P5-02 (exhaustion test), P5-03, P5-05; G5-EXPORT-STANDALONE, G5-PRINT-PDF-TALL 4/4 |
| R14 | `exportDiagramPng()` reworked; new `sanitizeSvgForExport()` (foreignObject→text) | 2743–2783 → 3075, 3150–3310 | Image-load/canvas/Blob failures surface actionable errors, temp URLs revoked on all paths, error log entry created, no false success; no canvas tainting | P5-04; G5-EXPORT-DIAGRAM-FILES, G5-EXPORT-PNG-FAILURE 4/4 |
| R15 | `previewRenderGeneration` / `studioRenderGeneration` tokens with in-flight invalidation | 2559–2562 → 2673–2677; studio analog | Out-of-order render completions discarded; no stale canvas overwrites | P2-02; G2 stop points 4/4 |
| D001 | "Safety Rule" CSS narrowed to `body > .error-icon, body > [aria-roledescription="error"]`; `cleanStrayMermaidElements(targetId)` no longer removes `body > svg` / `dmmd-` / `mmd-` | 1216–1219 → 1244–1252; 2393–2400 → 2460–2470 | Mermaid 10.9.1 in-flight render containers and measurement SVGs stay visible → `getBBox()` works; sequence diagrams and edge-labeled flowcharts render | `reports/d001_remediation_report.md`; P1 suite; G1 battery (Chromium 152, 2026-11-04); matrix 4/4 2026-11-12 |

Shared-fix note: R01+R02 are closed by the same change (source relocated outside the erased canvas and read through `getCardMermaidCode`); R13's render-ready wait reuses the Phase 2 generation guards (R15) so export, copy, and print share one synchronization mechanism.

## 4. Patch application validation (byte-for-byte reconstruction)

Executed 2026-11-12, win32 x64, unified diff hunk engine:

```
Reconstructed SHA-256: 563955c89c51e9362181733536258fb629340dd9db0368dec8dd63ea204d42b0
Expected SHA-256:      563955c89c51e9362181733536258fb629340dd9db0368dec8dd63ea204d42b0
Byte-for-byte match:   true
```

Result: all 46 hunks in `reports/markdown_studio.patch` apply cleanly to the pristine baseline blob and the reconstructed file hashes to `563955c89c51e9362181733536258fb629340dd9db0368dec8dd63ea204d42b0` — **byte-for-byte equal to `final/markdown_studio.html`**. Patch SHA-256: `b66900b0c94516c240973c83c0a00f49607a079fa268625a8e49a1c425f58e19`.

## 5. Integrity of untouched artifacts

- `baseline/markdown_studio.original.html`: unchanged, `11eaec367bb698f557abefafd359a5983d5ef0e08d1fce4e45ea08ec7277a83c` (verified 2026-11-12).
- Live application `scripts/markdown-studio.html`: unchanged in this effort, `c5bfc749c33af0336d44b0b6e9a6ac328687a23111600a16f4760d1454820bd9` (F5 decision, option 1 — see `reports/remediation_audit.md`).
- Full-package checksums: `evidence/checksums.sha256`.
