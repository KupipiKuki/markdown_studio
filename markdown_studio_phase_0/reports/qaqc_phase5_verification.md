# QAQC verification — Phase 5 (R13, R14) on `vibe/phase5-r13-r14-2ace24` @ `56df1ad`

Date: 2026-11-10. Verifier: Linux x86-64, Node v22.23.4, vendored marked 12.0.2.

## Verdict: **implementation accepted at mock level; G5 browser evidence STALE — re-run required on the committed candidate.**

## ⚠ Provenance finding (P5-0) — browser manifests do not attach to the committed candidate

The four G5 run manifests (`2026-11-10`, 155/155 pass each on chromium/edge/chrome/firefox) record `candidateSha256LfNormalized = 4b4bd07c…`, but the committed `working/markdown_studio.html` on this branch is `9bb0fcd9…`, and `4b4bd07c…` matches **no committed blob on any branch** (checked every commit of the branch and every branch tip). The browser sweep therefore ran against an uncommitted local variant — same failure class as M1, inverted: here the committed candidate is the *newer* one. Per the rules (evidence must attach to the committed candidate; an unrun/mismatched test is never a pass), **the G5 browser stop points must be re-run on committed `9bb0fcd9…`** before Gate G5 can close. The manifests are retained as run-stamped history of `4b4bd07c…`.

## Implementation reviewed (candidate `9bb0fcd9…`, raw = LF, 5,424 lines)

- **R13**: `ensurePreviewRenderReady()` — flushes pending debounce, awaits MathJax + in-flight Mermaid render promise, re-checks tab/content after await and retries on change (max 10); wired into HTML export, copy-rendered-HTML, and print paths. `getCleanRenderedContent()` strips headers/action buttons/raw source and pan/zoom attributes; `generateStandaloneHtml()` preserves theme.
- **R14**: `exportDiagramPng` returns `{success:false, error}` with `logError` + toast on serialization / Blob-URL / image-load / canvas failures; temp object URLs revoked on all paths; foreignObject→text conversion to avoid canvas tainting.
- Print CSS: `.mermaid-viewport` uncapped (`max-height:none`, `overflow:visible`), canvas `transform:none`, `page-break-inside: avoid` on cards.

Baseline blob `11eaec36…` and live app untouched.

## Verification results (on committed `9bb0fcd9…`)

| Check | Result |
| --- | --- |
| Suites (fresh scratch): baseline / P1 / P2 / P3 / P4 / P5 | exit 0 / 7-7 / 3-3 / 3-3 / 6-6 / **5-5** |
| P5-01…P5-05 (committed) | in-flight awaited; mid-await change → refresh/retry (stale v1 ignored, fresh v2 captured); clean export (no headers/error UI/transforms, theme preserved); PNG failures handled with URL release and no false success; print CSS uncapped + page-break avoid |
| **Independent QAQC repro** (extracted real `ensurePreviewRenderReady` + deferred render promise) | export did **not** proceed before render resolved (`false`), proceeded after (`true`); PNG path source has `img.onerror` + `revokeObjectURL` + `success:false` + failure toast; print CSS has `max-height:none` + `transform:none` |
| G5 browser manifests | 155/155 on 4 browsers — but against `4b4bd07c…` (uncommitted); see P5-0 — **must re-run on `9bb0fcd9…`** |
| Checksums | 12 stale on arrival (CRLF disk, 5th occurrence); regenerated from LF → **320/320 OK** |

## Required before Gate G5 closes

1. Re-run the 4-browser headed matrix on the **committed** candidate (`git status` clean, LF-normalized hash = `9bb0fcd9…`), push run-stamped manifests, regenerate checksums.
2. Optional hardening: commit a repo-root `.gitattributes` (`* text=auto eol=lf`) — the CRLF-disk checksum/manifest issue has now occurred five times.

After the browser re-run passes, merge to `vibe/code_revisions` and proceed to **Phase 6 (final regression, audit, handoff)**.
