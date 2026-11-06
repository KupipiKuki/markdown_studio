# Phase 2 kickoff — preparation package (no code changes yet)

Date: 2026-11-06. Prepared for tomorrow's coding session. Scope per plan §5 (`remediation_implementation_plan.md`): **source replacement & render lifecycle — R05 (residual), R09, R15**, gated by **G2**.

## 1. Current state (verified on `vibe/g0-capture-checklist-2ace24` @ `d25d2a4`)

- Candidate working copy: `working/markdown_studio.html` = `e02aed95cfa610eac62c5b1e82b37ba1e237731f0c285257acadc191f0b387b7` (4,390 lines). Baseline untouched `11eaec36…`; live app untouched `c5bfc749…`; `main` untouched.
- Suites: `baseline-checks.cjs` exit 0; `phase-1-checks.cjs` 7/7 (P1-01..P1-07).
- Browser matrix (headed, win32, file+http): **Edge 156 / Chrome 157 / Firefox 157 / Playwright Chromium 156 — 141/141 stop points pass each**, run-stamped manifests in `evidence/phase-0/g0-capture/runs/`. Candidate-hash question resolved (M1): runs executed committed `e02aed95` content via a CRLF checkout; routine now records LF-normalized hash.
- Checksums: 239/239 OK over the full package incl. capture evidence.
- Gates: **G0 completeness captured** (formal re-review still owed in the phase log); **G1 verified with recorded exceptions**; **G2 not started**.

## 2. Required recorded decision before coding (F5)

Phases 0–1 remediated the **original snapshot** (`index.html` @ `1042d77`); the live app `scripts/markdown-studio.html` still contains R01–R04 verbatim and was never touched. Before Phase 2 code lands, record one choice in `remediation_audit.md`:

1. Keep the original snapshot as the remediation target for Phases 2–6 (live-app fix as a separate later effort) — **recommended**, since all verified work and the whole browser matrix target `working/markdown_studio.html`; or
2. Re-baseline on `scripts/markdown-studio.html` and port fixes into the live app (note: the live app already lacks the D001 CSS rule).

Per plan G0 this must be a named, recorded decision — required before Phase 6, recommended now.

## 3. Phase 2 work items (from plan §5 + current evidence)

| Item | Finding | Current state / evidence | Work for tomorrow |
| --- | --- | --- | --- |
| W1 | **R05 residual** — replacement mapping still disagrees with parser on blockquote-nested and info-variant fences | Fixed for top-level mixed ` ``` `/`~~~` fences (P1-07; browser-verified `G1-X1-ISOLATION-BROWSER`). QAQC repro (vendored marked 12.0.2 + extracted handler): `> ```mermaid` blockquote first → editing card 0 overwrites the top-level block, editing card 1 appends; ` ```mermaid-x ` / ` ```mermaid foo ` first → editing the real card overwrites the info-variant block. Root cause: card indexes come from marked (`language === 'mermaid'` exact, working line ~2347), replacement regex uses `mermaid\b` + line-start fences (line ~4016) | Replace regex/index matching with **parser-consistent source ranges** (marked lexer tokens → exact source spans), so card index ↔ source range mapping is by construction. Preserve fence style, indent, and info string; support all fence forms the parser accepts |
| W2 | **R09** — repeated preview setup adds window listeners without removal | B09 reproduced: two setup calls add 4 window handlers (`mousemove`/`mouseup` ×2 per card); detached-node retention and 50-cycle test unrun | Shared pan handlers or explicit lifecycle cleanup per preview build; no broad cleanup that could remove an active render's temp elements or unrelated SVGs |
| W3 | **R15** — async render has no generation guard | Source-confirmed; controlled out-of-order completion never reproduced | Generation IDs / invalidation: commit a render result only when its document, target, and generation are still current; stale work must not overwrite current preview, Studio validation, or closed/reopened modal state |

## 4. Gate G2 (plan §5, verbatim criteria) and evidence

- Mixed-fence fixtures: editing any diagram changes only its source range; exact text comparisons show surrounding Markdown preserved.
- Rapid edits, tab switches, modal reopening, controlled out-of-order render completion → newest result only.
- After 50 refresh cycles: listener counts do not grow per cycle; no detached diagram objects retained by handlers (investigate sustained growth, not a single heap reading); diagrams remain interactive after rerender.
- Evidence: source comparisons, render-generation trace, repeat-cycle results, listener/retention inspection. Reuse `tests/g0-capture-routine.cjs` (browser, loopback-only) + add mock tests.

## 5. Test/evidence plan for Phase 2

- New mock suite `tests/phase-2-checks.cjs` (pattern after `phase-1-checks.cjs`, vm-extracted real handlers):
  - P2-01 parser-consistent replacement: tilde/backtick/4-backtick-outer, blockquote-nested, info-variant fences — edit each card index, byte-compare whole document, assert only the targeted range changed.
  - P2-02 generation guard: simulated out-of-order render completions commit only the latest generation.
  - P2-03 listener lifecycle: N preview setups → window listener count constant; no growth over 50 cycles.
- New fixtures under `evidence/phase-0/fixtures/` (or a phase-2 set): blockquote-fence doc, info-variant doc (`mermaid-x`, `mermaid foo`), mixed outer-fence doc. Add corresponding `G2-FIX-*` stop points to the capture routine.
- Browser re-verification on the matrix (Edge/Chrome/Firefox/Chromium, `--headed`, run-stamped manifests) for the G2 criteria, esp. `G1-X1-ISOLATION-BROWSER` blockquote case flipping from residual to pass.
- Rules unchanged: write-once evidence + run-stamped reruns; regenerate `checksums.sha256` at each checkpoint; record candidate raw + LF-normalized hashes; register any new discoveries as D-series IDs; never advance past a failed gate; a blocked/unrun test is never a pass.

## 6. First commands tomorrow

```sh
cd markdown_studio_phase_0
git pull
node tests/baseline-checks.cjs && node tests/phase-1-checks.cjs   # sanity: still green on e02aed95
# record the F5 decision in reports/remediation_audit.md
# then start W1 (R05 residual) on a fresh working copy branch
```
