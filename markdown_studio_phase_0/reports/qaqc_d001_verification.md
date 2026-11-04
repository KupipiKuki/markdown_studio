# QAQC verification — D001 remediation & publish claims (`vibe/code_revisions` @ `0c5f543`)

Date: 2026-11-04. Verifier environment: Linux x86-64, Node v22.23.4, Python 3.12.15; no browser binaries in this sandbox (browser claims verified by artifact inspection + internal consistency, not re-execution).

## Claims checked vs. observed

| Claim | Verdict | Evidence |
| --- | --- | --- |
| Branch pushed to `0c5f543`; PR #6 auto-merged | **Confirmed** | `origin/vibe/code_revisions` = `0c5f543` containing `72f7ceb`+`00de313` (PR #6 head commits); `gh pr view 6` → `state: MERGED`, `mergedAt: 2026-11-04T02:56:30Z`, mergeCommit `00de313`. GitHub marks a PR merged when all head commits land in base — mechanism as described |
| Candidate `55cb1264…` after D001 | **Confirmed** | `sha256sum working/markdown_studio.html` = `55cb126470720d7deac4cc958cdf45a7f4b0c8955b65d8f13f590f97babb1218`, 4,382 lines |
| D001 fix = single CSS hunk | **Confirmed** | diff `00e2208..0c5f543` on the working copy is exactly the narrowing of the "Safety Rule" (baseline lines 1216–1219, verified verbatim) to `body > .error-icon, body > [aria-roledescription="error"]`. No script/markup changes |
| Root cause real | **Confirmed at source level** | Baseline rule `body > svg, body > [id^="dmmd-"], body > [id^="mmd-"] { display:none !important }` present at 1216–1219; live app's equivalent selector is narrowed to error-icon forms only (`scripts/markdown-studio.html` 1225/2645) — corroborates the report's claim that stages 1–4.5 removed the defect there |
| Residual protections retained | **Confirmed** | `suppressErrorRendering: true` (working line 2565); `cleanStrayMermaidElements()` (line 2398) removes `body > [id^="dmmd-"]/[id^="mmd-"]/[id*="mermaid-error"]` strays |
| welcome.md = 2 diagrams (labeled flowchart + sequence) | **Confirmed** | `starterMarkdown` (working line 2872) contains exactly 2 mermaid blocks: edge-labeled `flowchart TD` + `sequenceDiagram` — precisely the two types D001 broke |
| Suites pass on new candidate | **Confirmed by rerun** | `node tests/phase-1-checks.cjs` → exit 0, 6/6, P1-01 candidate `55cb1264…`, P1-03 all four fields `true`; `node tests/baseline-checks.cjs` → exit 0, observations identical to canonical record |
| Checksums regenerated | **Confirmed** | `sha256sum -c evidence/checksums.sha256` → **63/63 OK**, includes phase-1 results, browser-evidence JPEGs, run-stamped copies, D001 report |
| Run-stamp / write-once discipline | **Confirmed** | `phase-1-results-candidate-05de4260-2026-11-04.json` and `test-results-rerun-2026-11-04-local.json` present; canonical files restored; `environment-notes.md` gained the D001 environment row |
| Baseline & live app untouched | **Confirmed** | baseline `11eaec36…`, `scripts/markdown-studio.html` `c5bfc749…`, `origin/main` = `191a814` — all unchanged |
| R05 browser-reproduced (tilde-fence wrong-block) | **Plausible; mechanism verified in source** | replacement regex `/```mermaid[\s\S]*?```/g` at working line 4015 counts only backtick fences while card indexes count both fence styles — matches the described misbehavior; remains Phase 2 scope |
| Browser battery V1–V10 (2/2 welcome, 7/7 types, G1 criteria) | **Artifacts consistent; not independently re-executable here** | See notes N1/N3 below — accepted on internal consistency + honestly recorded limitations |

## Browser-evidence inspection (screenshots opened and read)

- `G1-D001-error-state-before.jpeg` — shows a Mermaid error card with `svg element not in render tree` (the exact D001 symptom), no SVG. Consistent with pre-fix state.
- `G1-D001-welcome-rendered-after.jpeg`, `G1-D001-multitype-light-after.jpeg`, `G1-D001-multitype-dark-after.jpeg` — show rendered SVG diagrams (flowchart + pie visible) with **zero error cards** post-fix.

## Notes / minor findings

- **N1 (doc accuracy):** all four screenshots are 1296×866 **viewport** captures, but `d001_remediation_report.md` §4 says "full page". In the welcome-after shot the scrollbar is at top and the frame ends at the "Live Interactive Mermaid Diagrams" intro — the two diagrams are below the fold, so that image alone does not visually prove "2/2"; the multitype-light shot shows 2 of the diagrams in frame. The numeric battery results (2/2, 7/7, V1–V10) rest on the report's DOM assertions, which this sandbox cannot re-run. Recommend attaching full-page or scrolled captures so the headline numbers are visually evidenced.
- **N2 (stale text):** `d001_remediation_report.md` §8 still says "commits are local… this machine has no GitHub push credentials" — the push did land (`0c5f543` on the remote) and PR #6 is merged. Update the publish paragraph.
- **N3 (environment honesty — good):** browser env is in-app Chromium 152.0.7977.167 (Electron, OpenCode 2.2.5) on Linux over `http://127.0.0.1:8931`, not Windows Edge/Chrome or Firefox; clipboard success path needs a focused window. These are recorded as limitations, not claimed coverage — correct per plan §3.
- **N4:** `evidence/index.md` captions the multitype shots as a "4-type document" while the report §4 describes a 7-type battery; reconcile the caption.

## Verdict

**D001 remediation accepted.** Root cause verified in source, fix is a single minimal CSS hunk with retained safety layers, candidate hash/lineage/checksums all reconcile, both suites rerun clean, PR #6 merge state confirmed, live app and baseline untouched. Browser numeric claims are internally consistent and honestly limitation-scoped; N1/N2/N4 are documentation nits, not blockers.

**Still open (unchanged):** full G0 browser capture (25-fixture sweep, 111-control execution, launch modes); F5 remediation-target decision before Phase 6 (recommended before Phase 2); clipboard success path + Windows/Firefox coverage; Phase 2 (R05 now browser-reproduced, R09, R15).
