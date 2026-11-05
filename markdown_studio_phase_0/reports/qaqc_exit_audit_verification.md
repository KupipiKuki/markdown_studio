# QAQC verification of the Phase 1 exit audit (`reports/qaqc_phase1_exit_audit.md` @ `01e3439`)

Date: 2026-11-04. Verifies the exit audit of `vibe/code_revisions` @ `a8d0a50` (R05 update-isolation fix). Verifier environment: Linux x86-64, Node v22.23.4; no browser binaries — browser claims checked by artifacts, not re-executed.

## Exit-audit claims re-verified

| Claim | Verdict |
| --- | --- |
| Working copy `e02aed95…`, 4,390 lines; lineage `0273e79e→05de4260→55cb1264→e02aed95` reconciles with git blobs | **Confirmed** (`sha256sum`, `wc -l`, blob hashes per commit) |
| `checksums.sha256` 65/65 OK | **Confirmed** — 65/65 via `sha256sum -c` |
| `baseline-checks.cjs` exit 0, observations identical to canonical | **Confirmed** by fresh rerun |
| `phase-1-checks.cjs` 7/7 (new P1-07), candidate `e02aed95…`, P1-03 fields true | **Confirmed** by fresh rerun; committed `phase-1-results.json` matches (ids P1-01..P1-07, `findingsResolved` includes R05) |
| Run-stamped preservation (`-05de4260-`, `-55cb1264-` copies; local baseline rerun) | **Confirmed** — files present |
| Baseline `11eaec36…`, live app `c5bfc749…` untouched; zero inline `onclick` in working copy | **Confirmed** |
| R05 fix diff = delimiter-agnostic fence regex preserving fence style/indent | **Confirmed** — single hunk at working lines ~4013–4030; regex handles ` ``` `/`~~~` ≥3, ≤3-space indent, mixed fences |
| P1-07 is a genuine behavioral test of the shipped handler | **Confirmed** — extracts real `btnBuilderInsert.onclick` via `vm`, edits both directions in a mixed tilde/backtick doc, asserts other diagram + interstitial text untouched |
| N2/N4 reconciliations (D001 §8 publish text; index multitype caption) | **Confirmed** — publish row now reads "Confirmed pushed … PR #6 auto-merged"; caption now says "7-type battery viewport capture (… in view)" |
| PR #6 MERGED with head `01e3439` holding the exit audit | **Confirmed** — `state: MERGED`, head `vibe/qaqc-phase0-1-audit-2ace24` @ `01e3439` |

## G1-X2 independently reproduced (vendored marked 12.0.2 + the app's extracted update handler)

| Case | marked cards (lang) | edit card 0 result |
| --- | --- | --- |
| A: `> ```mermaid` blockquote fence first, then top-level | 2 (`mermaid`,`mermaid`) | **wrong block**: overwrites the top-level diagram; editing card 1 appends a new block instead of replacing |
| B: ` ```mermaid-x ` first, then real ` ```mermaid ` | 1 (`mermaid-x` no card, `mermaid` card) | **wrong block**: overwrites the `mermaid-x` block |
| C: `~~~mermaid` + ` ```mermaid ` top-level (the fixed case) | 2 | correct: tilde↔card0, backtick↔card1, interstitial text preserved |
| D: ` ```mermaid foo ` first, then real | 1 (`mermaid foo` no card) | **wrong block**: overwrites the `foo` block; also confirms G1-X3(a) — replacement hardcodes the `mermaid` info string |

Root cause matches the audit: card indexes come from marked (`language === 'mermaid'` exact match, working line 2347) while the replacement regex uses `mermaid\b` and line-start fences — the two enumerations disagree on blockquote-nested fences and info-string variants.

## Verdict on the exit audit

**The exit audit is accurate and its findings stand.** G1-X1 (tilde-fence isolation claimed inside the browser-verified sentence, but the browser battery ran pre-R05-fix on `55cb1264`; post-fix evidence is mock-only P1-07), G1-X2 (R05 closed as resolved while blockquote/info-variant mismatches are reproduced above), G1-X3 (info-token drop, indented closing fence), G1-X4 (welcome-after JPEG is viewport-only, diagrams below fold), G1-X5 (D001 report §6/§8 superseded but not marked) — all confirmed against the branch.

Agreed gate phrasing: **G1 = "verified with recorded exceptions"** (browser-verified criteria stand on `55cb1264`; update isolation mock-verified on `e02aed95` for top-level mixed fences only, not browser re-verified, not valid for blockquote/info-variant docs). **G0 = still blocked on completeness** (full capture now executable). R05 disposition should read *partially fixed; remainder deferred to Phase 2 parser-consistent mapping* — Phase 2 owns the full fix, so none of the four required corrections block Phase 2 start.
