# Code diff report — FINAL (Phase 6 handoff, Gate G6)

Date: 2026-11-12. Generated from the completed implementation; no planned or fabricated figures.

## 1. Compared files

| Role | Path | SHA-256 (LF-normalized) | Lines | Bytes (LF) |
| :--- | :--- | :--- | :--- | :--- |
| Baseline (immutable) | `baseline/markdown_studio.original.html` | `11eaec367bb698f557abefafd359a5983d5ef0e08d1fce4e45ea08ec7277a83c` | 4,316 | 155,945 |
| Final (frozen candidate) | `final/markdown_studio.html` | `9bb0fcd959af032f762474826d86ca7e237616e5ab29014036ee24323e563519` | 5,424 | 202,036 |
| Unified patch | `reports/markdown_studio.patch` | `0d5f41f185f3be42b1e65dd53eed1c657fadea1978503f0b57259be4698554c4` | 2,182 | 88,943 |

`final/markdown_studio.html` is byte-identical (LF) to the active candidate `working/markdown_studio.html`; the raw on-disk working copy is CRLF (`36cddddcc5e832fb0609e2c36e68c728e5325a6c0902c2928f6cd9d275e3c583`) and normalizes to `9bb0fcd9…`. The patch uses labels `a/baseline/markdown_studio.original.html` → `b/final/markdown_studio.html` and was generated with GNU `diff -u` over LF-normalized content.

## 2. Statistics

- **46 hunks; +1,385 additions / −277 deletions; net +1,108 lines** (4,316 → 5,424).
- Dependency changes: **none**. CDN references are byte-identical to the baseline — marked 12.0.2 (cdnjs) and mermaid 10.9.1 (jsdelivr). The only resource-line change is inside the standalone export template's Google Fonts URL: weights `400;600;700` → `400;500;600;700` (baseline line 4106 → final line 5084), part of R13/G5 standalone theme fidelity (P5-03).
- Configuration changes: none. No new files, no build tooling, no package changes in the application artifact.
- Cosmetic-only hunks: none. Every hunk maps to an R-series finding or D001 (table below); no blanket reformatting was applied. Whitespace within hunks is incidental to the functional edits.

## 3. Per-change table (issue → code → evidence)

Baseline line numbers refer to `baseline/markdown_studio.original.html`; final line numbers to `final/markdown_studio.html`.

| ID | Affected functions / CSS selectors | Baseline → final lines | Behavioral change | Test evidence |
| :--- | :--- | :--- | :--- | :--- |
| R01 | `customRenderer.code` card markup (`.mermaid-raw-code` moved outside `.mermaid-canvas`); new `getCardMermaidCode()` | 2359–2368 → 2427–2434; fn @ 2657 | Hidden source survives `canvas.innerHTML = svg` | P1-02, P1-03 (7/7 suite); G1 browser battery 2026-11-04; 4-browser matrix 2026-11-11 |
| R02 | `renderAllPreviewDiagrams()` | 2562 → 2677 | Source read via `getCardMermaidCode`; no early-exit skip after source loss; render promise tracked | P1-02; matrix G1 stop points |
| R03 | Error-card button markup + delegated `click` on `card` matching `[data-action]` | 2580s → 2654+ | `Fix in Studio` carries `.diag-action-btn` and is clickable | P1-04; G1 stop points |
| R04 | Error-log buttons: inline `onclick` → `data-error-id`; new delegated listener on `#errorLogList`; new `copyToClipboard()` helper | 2448–2460, 2496–2506, 4308 → 2521–2560, 2600–2601, 5395–5421 | Zero inline handlers; Copy/Dismiss work inside closure; clipboard failure toast | P1-05, P1-06; matrix G1 stop points |
| R05 | `isMermaidLanguage()` (info-variant match); new `getMermaidSpans()` + `replaceDiagramSource()` replace `/```mermaid…```/g` regex | 2336–2341 → 2400–2403; 4247–4260 → 4637, 4774 | Card index ↔ source range alignment by construction across tilde/backtick/outer fences, blockquotes, indent, info strings | P1-07, P2-01; matrix G2 stop points |
| R06 | `.preview-content` typography selectors scoped with `:not(.mermaid-block-card *)`; new foreignObject resets (`.mermaid-canvas foreignObject *`) | 798–893 → 798–920 | Markdown typography no longer bleeds into SVG `foreignObject` labels | P3-03; G3-TYPOGRAPHY-LABELS 4/4 browsers |
| R07 | `.mermaid-viewport` / `.mermaid-canvas svg` / `#builderDiagramCanvas` CSS (`max-height` cap, `max-width`, overflow); new `computeDiagramFitScale()`; pan/zoom rework | 965–995, 1435–1446 → 1011–1025, 1469–1480; fn @ 2839; 2640–2790 → 2891–3310 | Bidirectional fit for tall/wide diagrams; no clipping at 520px cap | P3-02; G3 stop points 4/4 |
| R08 | `initMermaid(theme)` re-invocation inside `renderAllPreviewDiagrams()` | 2529, 2562 → 2624, 2683 | Document theme enforced before each preview render; Studio no longer leaks global theme | P3-01; G3-THEME stop points |
| R09 | `setupPreviewDiagramInteractivity()` — shared window pan handlers, per-card listeners removed | 2700s (per-card `window.addEventListener`) → fn @ 2858 | Constant window-listener count across 50 setup cycles; no detached-node retention | P2-03; G2-LISTENER-50 4/4 |
| R10 | `wrapSelection()` empty-selection fallback `'text'` removed; `insertSnippet()` caret positioning | 4247–4260 → 5340+ | No trailing literal `text` after divider/snippet/template insertion | P4-01, P4-05; G4-INSERT-COMMANDS 4/4 |
| R11 | Ribbon image action URL construction | (image handler hunk ~4092–4129) → 4948+ | Clean `![Alt text](url)` / `![selected](url)`; no `texthttps://…` concatenation | P4-02, P4-03; G4 stop points |
| R12 | Studio palette `data-insert` escape decoding (Subgraph Box C091) | 3924–3947 → 4580+ | Literal `\n` sequences decoded to real newlines on insert | P4-04; G4 stop points |
| (minor) | Editor shortcut guard while typing in `#builderCodeInput`, `#findInput`, `#replaceInput`; Escape still dismisses modals | → 4858+ | Shortcuts no longer mutate background document from inputs | P4-06 |
| R13 | New `ensurePreviewRenderReady()`, `getCleanRenderedContent()`, `generateStandaloneHtml()`; `#btnExportHtml` / `#btnCopyHtml` / `#btnPrintPdf` handlers await render generation; print CSS uncaps diagrams | 4096–4139 → 4948–5190; fns @ 4954, 4995, 5066; print CSS 1626–1640 → 1663–1700 | Export/copy/print wait for latest completed diagrams+math; clean document export (no error UI, transient controls, pan transforms); tall diagrams not clipped in print | P5-01, P5-02, P5-03, P5-05; G5-EXPORT-STANDALONE, G5-PRINT-PDF-TALL 4/4 |
| R14 | `exportDiagramPng()` reworked; new `sanitizeSvgForExport()` (foreignObject→text) | 2743–2783 → 3075, 3150–3310 | Image-load/canvas/Blob failures surface actionable errors, temp URLs revoked on all paths, no false success; no canvas tainting | P5-04; G5-EXPORT-DIAGRAM-FILES, G5-EXPORT-PNG-FAILURE 4/4 |
| R15 | `previewRenderGeneration` / `studioRenderGeneration` tokens with in-flight invalidation | 2559–2562 → 2673–2677; studio analog | Out-of-order render completions discarded; no stale canvas overwrites | P2-02; G2 stop points 4/4 |
| D001 | "Safety Rule" CSS narrowed to `body > .error-icon, body > [aria-roledescription="error"]`; `cleanStrayMermaidElements(targetId)` no longer removes `body > svg` / `dmmd-` / `mmd-` | 1216–1219 → 1244–1252; 2393–2400 → 2460–2470 | Mermaid 10.9.1 in-flight render containers and measurement SVGs stay visible → `getBBox()` works; sequence diagrams and edge-labeled flowcharts render | `reports/d001_remediation_report.md`; P1 suite; G1 battery (Chromium 152, 2026-11-04); matrix 4/4 2026-11-11 |

Shared-fix note: R01+R02 are closed by the same change (source relocated outside the erased canvas and read through `getCardMermaidCode`); R13's render-ready wait reuses the Phase 2 generation guards (R15) so export, copy, and print share one synchronization mechanism.

## 4. Patch application validation (byte-for-byte reconstruction)

Executed 2026-11-12T00:14Z, win32 x64, Git Bash (GNU patch):

```
mkdir -p val/baseline
git show HEAD:markdown_studio_phase_0/baseline/markdown_studio.original.html > val/baseline/markdown_studio.original.html
cd val && patch -p1 --batch < ../markdown_studio.patch
sha256sum baseline/markdown_studio.original.html   # → 9bb0fcd959af032f762474826d86ca7e237616e5ab29014036ee24323e563519
cmp baseline/markdown_studio.original.html ../final/markdown_studio.html   # → identical
```

Result: the patch applies cleanly to the pristine baseline blob and the reconstructed file hashes to `9bb0fcd959af032f762474826d86ca7e237616e5ab29014036ee24323e563519` — **byte-for-byte equal to `final/markdown_studio.html`** (`cmp` exit 0). Patch SHA-256: `0d5f41f185f3be42b1e65dd53eed1c657fadea1978503f0b57259be4698554c4`.

## 5. Integrity of untouched artifacts

- `baseline/markdown_studio.original.html`: unchanged, `11eaec36…` (verified 2026-11-12).
- Live application `scripts/markdown-studio.html`: unchanged in this effort, `c5bfc749c33af0336d44b0b6e9a6ac328687a23111600a16f4760d1454820bd9` (F5 decision, option 1 — see `reports/remediation_audit.md`).
- Full-package checksums: `evidence/checksums.sha256` (regenerated after this report; see file header count).
