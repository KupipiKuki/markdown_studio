# QAQC verification — W1 (R05 residual, parser-consistent source ranges) on `vibe/phase2-w1-r05` @ `54b6a25`

Date: 2026-11-07. Verifier: Linux x86-64, Node v22.23.4, vendored marked 12.0.2.

## Implementation reviewed

`working/markdown_studio.html` `ab0f99f70463536056c3868eae38c05298db3ba67affbaf5abd1659c7a90070e` (LF; 4,571 lines by `wc -l`, audit says 4,572 — trailing-newline cosmetic only). Diff vs `e02aed95…`: adds `isMermaidLanguage()` shared by the card renderer and span detection, `getMermaidSpans()` built on `marked.lexer` (walks top-level, blockquote, and list tokens; computes exact char spans with CRLF awareness), `replaceDiagramSource()` preserving line prefix/indent/fence/info string, and rewires `btnBuilderInsert.onclick` to it (old regex kept only as no-`marked` fallback). Baseline `11eaec36…` and live app `c5bfc749…` untouched on the branch.

## Verification results

| Check | Result |
| --- | --- |
| `baseline-checks.cjs` | exit 0 |
| `phase-1-checks.cjs` | 7/7 pass (P1-01..P1-07) |
| `phase-2-checks.cjs` (new) | P2-01 pass — extracts the real `isMermaidLanguage`/`getMermaidSpans`/`replaceDiagramSource`/handler and exercises all fence types |
| Independent QAQC repro (vendored marked + extracted new code), 6 cases × each card index | **all correct**: blockquote-nested, `mermaid-x` info-variant, `mermaid foo` info-token, mixed tilde/backtick, list-nested, 4-backtick outer fence — editing card *i* replaces exactly block *i*, everything else byte-identical. The three G1-X2 residual cases from the exit audit (blockquote, mermaid-x, info-token) now pass |
| Semantics note | ` ```mermaid foo ` now counts as a diagram card (shared `isMermaidLanguage` accepts `mermaid` + trailing info); card indexes and replacement spans agree by construction. `mermaid-x` (no whitespace) remains a non-diagram on both sides — consistent |
| Checksums | were 240/244 (3 phase-2 fixtures hashed from a CRLF disk — same autocrlf class as M1); regenerated from committed LF content → **248/248 OK** |

## Findings

- **W1-1 (low, fixed here):** `checksums.sha256` had been generated on a CRLF checkout, so the 3 new `evidence/phase-2/fixtures/*.md` entries didn't match their LF blobs. Regenerated → 248/248. Recommendation: add repo-root `.gitattributes` with `* text=auto eol=lf` (or at least `*.html,*.md,*.cjs text eol=lf`) so disk hashes equal blob hashes on Windows.
- **W1-2 (cosmetic):** audit says 4,572 lines; `wc -l` says 4,571 (trailing newline). No action needed.
- **W1-3 (follow-up):** browser re-verification of `G1-X1-ISOLATION-BROWSER` on the matrix (Edge/Chrome/Firefox/Chromium, `--headed`) is still owed — the blockquote case should flip from recorded residual to pass. Mock-level verification above is complete.
- **W1-4 (housekeeping):** when this branch merges back to `vibe/code_revisions`, update the Phase 0 row (full capture completed on the checklist branch, 141/141 × 4 browsers) and carry the G0 evidence over.

## Verdict

**W1 accepted.** The R05 residual is fixed at the source-mapping level (parser-consistent spans, not regex), all suites pass, the exit-audit's three residual cases are independently reproduced as fixed, and provenance (baseline/live untouched, hashes, checksums) is clean. Remaining for Phase 2: W2 (R09), W3 (R15), Gate G2, and the browser re-run of the isolation stop point.
