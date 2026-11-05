# QAQC audit — Phase 1 exit claim (`vibe/code_revisions` @ `a8d0a50`)

Audit date: 2026-11-04. Auditor environment: Linux x86-64, Node v22.23.4; no browser binaries in this sandbox (browser claims verified by artifact inspection, source-level re-derivation, and mock re-execution — not browser re-execution).
Branch under audit: `vibe/code_revisions` @ `a8d0a50` (new since the last verification @ `00e2208`: `0c5f543` D001 fix, `a8d0a50` R05 update-isolation fix).
Claim under audit: *"Phase 1 — Verified (mock harness + browser battery)"*, R01–R05 resolved, P1-01..P1-07 pass 7/7.

## 1. Independently re-executed / re-verified

| Check | Result |
| --- | --- |
| Working copy SHA-256 / lines | `e02aed95cfa610eac62c5b1e82b37ba1e237731f0c285257acadc191f0b387b7`, 4,390 lines — matches all register claims ✓ |
| Candidate lineage | `0c5f543` blob = `55cb1264…` (4,382 lines); `a8d0a50` blob = `e02aed95…` — lineage in `remediation_audit.md` reconciles with git blobs ✓ |
| `sha256sum -c evidence/checksums.sha256` | **65/65 OK** (matches the commit-message claim; includes all 4 browser JPEGs, run-stamped copies, D001/R05 reports) ✓ |
| `node tests/baseline-checks.cjs` (fresh temp copy) | exit 0; (id, status, observation) identical to canonical `test-results.json` ✓ |
| `node tests/phase-1-checks.cjs` (fresh temp copy) | exit 0, **7/7 pass**; results identical to committed `phase-1-results.json` except timestamps; P1-01 candidate = `e02aed95…` ✓ |
| Run-stamped discipline | `phase-1-results-candidate-05de4260-…` and `-55cb1264-…` present with matching candidate hashes; canonical restored; local baseline rerun preserved (`test-results-rerun-2026-11-04-local.json`, observations identical to canonical) ✓ |
| Baseline / live app untouched | baseline `11eaec36…`; `scripts/markdown-studio.html` `c5bfc749…`; zero inline `onclick` in working copy ✓ |
| D001 fix = single CSS hunk | diff `00e2208..0c5f543` on the working copy is exactly the Safety-Rule narrowing (+8/−2); no script/markup changes ✓ |
| D001 root cause (source level) | baseline rule `body > svg, body > [id^="dmmd-"], body > [id^="mmd-"]` present at 1216–1219; live app's equivalent selector already narrowed (independent corroboration) ✓ |
| Residual protections | `suppressErrorRendering: true` in `initMermaid()`; `cleanStrayMermaidElements()` removes strays post-render ✓ |
| welcome.md composition | exactly 2 mermaid blocks (edge-labeled `flowchart TD` + `sequenceDiagram`) — precisely the two types D001 broke; 2/2 claim is coherent ✓ |
| Browser JPEGs (opened and read) | before-shot shows the exact D001 symptom (`svg element not in render tree`, no SVG); after-shots show rendered SVGs (flowchart + pie in light, flowchart + sequence in dark), no error cards; consistent with V1/V2 and the reconciled captions ✓ |
| Report reconciliations N2/N4 | publish-text staleness removed from `d001_remediation_report.md` §8; multitype caption fixed in `evidence/index.md` ✓ |
| P1-07 test quality | extracts the real `btnBuilderInsert.onclick` via `vm`, updates tilde diagram 0 then backtick diagram 1 in a mixed document, asserts exact isolation of the other diagram and both interstitial texts, both directions ✓ |

## 2. New findings

| ID | Severity | Finding |
| --- | --- | --- |
| G1-X1 | Medium (evidence overstatement) | `remediation_audit.md` phase-1 row lists *"cross-diagram update isolation verified across backtick and tilde fences"* inside the **browser-verification** sentence, and the verification-level paragraph says *"Browser verification of code logic is now closed."* The browser battery (V1–V10) ran on candidate `55cb1264` **before** the R05 fix — at which point tilde-fence browser isolation **failed** (`d001_remediation_report.md` §6). After the fix (`e02aed95`), tilde-fence isolation is verified **only at mock level** (P1-07); no post-fix browser evidence exists (no new screenshots or browser results). Tilde-fence browser isolation must not be claimed. |
| G1-X2 | Medium (functional residual / premature closure) | R05 is recorded as **resolved** (`findingsResolved` includes R05; register row cites P1-07), but the new fence regex's enumeration still disagrees with the app's actual Marked-12 parser — demonstrated with the repo's own vendored `marked.min.js` and the app's extracted update code: **(a)** blockquote-nested fences (`> ```mermaid`) — marked creates a card, the regex cannot match it; editing that card (index 0) **overwrites the wrong (top-level) block** with the quoted diagram's new code. **(b)** info-string variants (` ```mermaid-x `) — marked assigns language `mermaid-x` (no card), the regex counts it via `mermaid\b`; editing the real diagram (marked index 0) **overwrites the `mermaid-x` block** instead. Per plan §2 a finding may be closed fixed, disproved, or deferred with a reason — R05 should read *"partially fixed (top-level backtick/tilde fences); blockquote-nested fences and info-string variants deferred to Phase 2 parser-consistent mapping"*, not resolved. The G1 isolation criterion holds for top-level-fence documents only. |
| G1-X3 | Low (edge cases, Phase-2 scope) | The replacement hardcodes the `mermaid` info string, dropping any extra info tokens (e.g. ` ```mermaid foo ` → ` ```mermaid `); a closing-fence line indented ≥4 spaces is treated as closing by the regex but is fence content per CommonMark/marked. Both are index-mapping edge cases for Phase 2; record as D-candidates or fold into the Phase 2 mapping work. |
| G1-X4 | Low (documentation) | `G1-D001-welcome-rendered-after.jpeg` still does not visually evidence the "2/2" headline — the diagrams are below the fold (previous verification note N1; only the caption was reconciled). The numeric V1–V10 results rest on the report's DOM assertions, which no sandbox has re-executed. Attach scrolled or full-page captures when the browser environment is next available. |
| G1-X5 | Info (doc drift) | `d001_remediation_report.md` §6/§8 still state R05 *"remains Phase 2 scope… no fix was applied in this batch"* and list R05 as Phase 2 work — accurate at `0c5f543`, superseded by `a8d0a50`. Chronologically readable, but a one-line supersession note would prevent misreading. |

Positive observations: limitation-scoping remains honest (clipboard success path recorded as environment-limited; no Windows/Firefox coverage claimed); write-once/run-stamp discipline was respected under suite reruns; the D-series register and minor-bug sweep follow the plan; P1-07 is a genuine behavioral test of the shipped code path, not a tautology.

## 3. Gate assessment

| Gate | Claimed | QAQC verdict |
| --- | --- | --- |
| G1 | Verified (mock + browser) | **Accepted with exceptions.** Browser-verified criteria (welcome 2/2, 7 types 7/7, Copy/Edit byte-exact via clipboard spy, Fix in Studio exact source, error-log Copy/Dismiss independence, theme ×3 without blanks/console errors, math coexistence, clean console) stand on candidate `55cb1264` and are unaffected by the R05 hunk. The update-isolation criterion is mock-verified on `e02aed95` (P1-07) for top-level mixed fences, but is (i) not browser-re-verified post-fix and (ii) not satisfied for blockquote-nested or info-variant documents (G1-X2). Phrase G1 as *"verified with recorded exceptions"* rather than unqualified. |
| G0 | Blocked (capability now available) | **Still blocked on completeness** — full capture (25-fixture screenshot sweep, 111-control execution, local-file vs HTTP launch modes) pending and now executable; the phase log correctly records this as the next action. The blocked gate is explicitly recorded, per plan §1. |

## 4. Required corrections before Phase 2 start (all documentation-level)

1. Reword the phase-1 browser-verification sentence: tilde-fence update isolation = mock-verified (P1-07); browser re-check pending (G1-X1).
2. Change R05's disposition to *partially fixed / deferred-with-reason* and remove R05 from `findingsResolved` in the next suite record until the Phase 2 parser-consistent mapping lands (G1-X2); attach the two reproduction cases above as register evidence.
3. Record G1-X3 edge cases in the D-candidate list or Phase 2 scope.
4. When the browser environment is next available: one minimal post-fix browser isolation check (tilde + blockquote documents) and scrolled/full-page captures for V1 (G1-X1, G1-X4).

None of these block starting Phase 2, which owns the full parser-consistent source mapping that subsumes them. No code changes are requested in this audit; the D001 and R05-top-level fixes are correct, minimal, and verified.
