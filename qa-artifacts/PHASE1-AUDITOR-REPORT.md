# Phase 1 auditor report — coder work + QA/QC per the Phase 1 handoff

Prepared: 2026-11-14 (session date). Audience: independent reviewer / auditor.
Handoff under audit: `C:\Git\markdown-studio-phase-1-handoff.md`.

## 1. Candidate identity (re-verified, not assumed)

| Pin from handoff | Expected | Actual | Match |
| --- | --- | --- | --- |
| Branch | `wp/studio_migration` | `wp/studio_migration` (local; not pushed, not merged) | yes |
| Candidate commit | `68560b0208e7e1da86cd06f862de74f568e3a5af` | `68560b0` present as parent of harness commit | yes |
| Live file blob | `4dd77e1a275c70b785a2565a4d0a111b6bf43bd2` | `git ls-tree 68560b0` shows exactly this blob for `scripts/markdown-studio.html` | yes |
| Live file SHA-256 | (not pinned in handoff; recorded) | `3669a1a3afb29ff2abab55e7c5be5db534624476957bb93711a0273cf48e602a` | recorded |
| Base commit | `191a814` (main head, live blob `d3719af…`) | diff base `191a814..68560b0` used for all audits | yes |
| Audited reference | `c0da234…` frozen candidate | ported functions byte-identical (see §3) | yes |

## 2. Coder deliverables vs handoff checklist

| Handoff deliverable | Status | Evidence |
| --- | --- | --- |
| Focused migration branch containing only Phase 1 changes | PASS | `git diff --stat 191a814 68560b0`: exactly one file, `scripts/markdown-studio.html`, +280/−30; no other paths touched |
| Change map from changed behavior to R/D finding + live location | PASS | §3 table below (also mirrored in scratchpad `phase1-change-map.md`); locations verified against the committed file |
| Before/after note for findings intentionally not changed | PASS | D001: live `cleanStrayMermaidElements()` (line 2646) already uses error-specific selectors only; candidate port intentionally not duplicated. P1-07 browser runs confirm zero error artifacts and no collateral SVG removal |
| Reproduction steps + candidate SHA for QA | PASS | `tests/phase1.spec.js` (committed `2d2bb01`); evidence in `qa-artifacts/` (http run) and `qa-artifacts-fileorigin/` (file run); summary `qa-artifacts/PHASE1-QA-RESULTS.md` |
| Do not merge or publish | PASS | No push performed; `main` untouched; only local commits on `wp/studio_migration` |
| Keep persistence/transfer contracts unchanged | PASS | `git diff 191a814 68560b0` contains zero added/removed lines matching `markflow_*`, `gemini_studio_*`, `BroadcastChannel`, or any `src="http…"` CDN tag |
| Keep CDN dependency versions unchanged | PASS | same grep: no CDN `src`/`href` lines in the candidate diff |
| No R06–R15 / gutter / export / print mixing | PASS | diff hunks are confined to: renderer fence recognition, error-log UI + delegation, `renderAllPreviewDiagrams` source handling, card interactivity/`card.onclick`, `getMermaidSpans`/`replaceDiagramSource` + insert handler, `#errorLogList` listener. No gutter, export, print, or generation-guard code |

## 3. Finding-by-finding verdicts (code audit + browser evidence)

| Finding | Coder action | Verdict | Evidence |
| --- | --- | --- | --- |
| R01 source preserved through SVG render | `.mermaid-raw-code` moved outside `.mermaid-canvas`; `getCardMermaidCode()` (l. 2838) | CONFIRMED | P1-02 passes all 8 pairs; source text asserted after render and after rerender |
| R02 rerender uses preserved source | card loop reads `getCardMermaidCode(card)`, no in-canvas source requirement (l. 2851–2855) | CONFIRMED | P1-02/P1-03: rerender after edit re-renders correct code (SVG text contains new node) |
| R03 "Fix in Studio" repair | delegated `card.onclick` for `data-action="edit-diagram"` on non-`.diag-action-btn` elements (l. 3045–3052), wired for error cards because `setupPreviewDiagramInteractivity()` runs post-loop | CONFIRMED | P1-04 passes all 8 pairs: error card → modal with original source → insert → only target fence rewritten, preview recovers |
| R04 error-log Copy/Dismiss | inline `onclick` strings removed; `data-error-id` + delegated listener on `#errorLogList` (l. 5466); `copyToClipboard` with failure toasts | CONFIRMED | P1-05 all 8 pairs. Headless Chromium write denial produced the failure toast (no false success); Firefox fallback produced a verifiable clipboard payload; dismiss removed only the selected row |
| R05 parser-consistent span mapping | `isMermaidLanguage`, `getMermaidSpans`, `replaceDiagramSource` byte-identical to audited `c0da234`; old `/```mermaid…```/g` path replaced (regex fallback kept only for no-`marked` environments) | CONFIRMED | P1-06a–g all 8 pairs (tilde, info string, blockquote, list, CRLF-normalized, outer-fence literal, fake fence in js block). Node unit run vs marked 12.0.2: 17/18 (only divergence = list-indent note, §5) |
| D001 measurement-safe cleanup | intentionally unchanged (live already narrow) | CONFIRMED (no-op by design) | P1-07 all 8 pairs: sequence + edge-labeled flowchart render twice, zero error artifacts, only benign `MJX-SVG-global-cache` at body level |

## 4. QA/QC matrix summary

Harness: Playwright `@playwright/test` 1.65.1, headless, fresh context per test (isolated profile, synthetic fixtures, no storage clearing). Browsers: Chromium 159.0.8154.6, Edge 159.0.8154.6 (channel), Chrome 159.0.8154.6 (channel), Firefox 159.0. Origins: `file:///C:/Git/markdown_studio/scripts/markdown-studio.html` and `http://127.0.0.1:8642/scripts/markdown-studio.html` (python http.server at repo root).

- file:// run: 60 passed / 4 skipped (SM-03 by design on file://)
- http:// run: 64 passed / 0 failed
- Supplemental smoke (SM-04 tab switching, SM-05 theme/viewer-width/view-mode persistence across reload): 8/8 passed on each origin
- No unexplained failure in any pair. Full matrix + notes: `qa-artifacts/PHASE1-QA-RESULTS.md`; per-check JSON/screenshot evidence in `qa-artifacts/` and `qa-artifacts-fileorigin/`.

## 5. Known issues / residual risks (carried, not reclassified)

1. List-item fence repair re-emits code lines without list indentation (fence lines keep it). Byte-identical in the audited reference; Mermaid-output-neutral. Candidate for a later phase if cosmetic fidelity matters.
2. CRLF: the textarea `value` API normalizes CRLF→LF, so the editor never receives CRLF; parser-side CRLF mapping exists and was unit-verified, browser-verified on the normalized document (P1-06e).
3. Benign pre-existing `favicon.ico` 404 console entry on branded browsers over http origin. Unrelated to the candidate.
4. Production launch URL still unestablished (handoff open item). Both local origins pass; a deploy origin must join the matrix before launch-origin coverage is declared complete.
5. Firefox print/PDF limitation remains an explicit later-phase risk; not resolved here.
6. Gutter scroll/font/soft-wrap drift remains deferred to the editor phase, per handoff.

## 6. Phase 1 exit-gate assessment

| Gate item | Status |
| --- | --- |
| Change map identifies R01–R05/D001 changed vs already-present | MET (§3) |
| QA/QC tested the same frozen candidate and retained evidence for every supported browser/origin pair | MET (§4; 8 pairs × 18 tests) |
| No unexplained acceptance-check failure; blocked items have reason/owner/risk | MET (none failed; SM-03-on-file:// is a by-design skip; production-URL coverage is the named open item, owner: QA, risk: storage/bus behavior on untested origin) |
| Saved tabs/preferences, cross-Studio actions, live-only smoke show no regression | MET (SM-01 reload persistence, SM-02 palette, SM-03 bus transfer on http, SM-04 tabs, SM-05 prefs) |
| Reviewer can reproduce from retained fixtures and artifacts | MET: `git checkout 68560b0 && npm ci && npx playwright test tests/phase1.spec.js` (optionally `P1_BASE_URL=http://127.0.0.1:8642/scripts/markdown-studio.html` with `python -m http.server 8642` at repo root) |

## 7. Recommendation

The frozen candidate `68560b0` satisfies the Phase 1 handoff: scoped diff, faithful port of the audited behaviors (R01–R05 changed; D001 verified already-satisfied), contracts and CDN versions untouched, and a fully green 8-pair QA matrix with retained evidence. Recommend the independent reviewer record a Phase 1 pass decision, with the production launch URL as the single open item before declaring launch-origin coverage complete. Do not proceed to Phase 2 until that decision is recorded.
