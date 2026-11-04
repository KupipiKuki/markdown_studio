# QAQC Audit — Phase 0 & Phase 1 Remediation (`vibe/code_revisions`)

Audit date: 2026-11-04. Auditor environment: Linux x86-64, Node v22.23.4, Python 3.12.15; no Playwright module or browser binaries (consistent with the recorded browser blocker).
Branch under audit: `vibe/code_revisions` @ `a5b80ac` (commits `20e552c` Phase 0, `a5b80ac` Phase 0+1 checkpoint). No PR exists for this branch yet.
Reference plan: `markdown_studio_remediation_plan.md` (baseline SHA-256 `11eaec367bb698f557abefafd359a5983d5ef0e08d1fce4e45ea08ec7277a83c`).

## 1. What was independently re-executed or re-verified

| Check | Result |
| --- | --- |
| SHA-256 of `baseline/markdown_studio.original.html` | `11eaec36…` — matches plan and `baseline.json` ✓ |
| Baseline provenance | Blob equals `index.html` @ commit `1042d77` ("Add files via upload"); it does **not** equal any version of the current `scripts/markdown-studio.html` (see F5) |
| `git bundle verify evidence/phase-0/baseline-history.bundle` | OK; contains `71da522` as recorded in `change-history.txt` ✓ |
| Working copy SHA-256 | `0273e79e…` — matches `reports/remediation_audit.md` ✓ (4,379 lines per `wc -l`; report says 4,380 — see F8) |
| `node tests/baseline-checks.cjs` rerun (this sandbox) | exit 0; B00 pass + 8 defect reproductions (B01, B03, B04, B05, B09, B10, B11, B12); observations match committed `test-results.json` ✓ |
| `node tests/phase-1-checks.cjs` rerun (this sandbox) | exit 0; 6/6 pass; results byte-identical to committed `evidence/phase-1/phase-1-results.json` except timestamps ✓ |
| `sha256sum -c evidence/checksums.sha256` | **31 OK, 16 FAILED** (see F3) |
| On-disk vs git blob identity for all audited files | identical — failures are stale manifest entries, not checkout corruption |
| Baseline→working diff review | 10 hunks, ~110 additions / ~47 deletions; every hunk maps to R01–R04 or clipboard feedback; no unrelated changes ✓ |
| Fixture/control counts | 25 fixture files ✓; `controls.json` 111 entries, all "unrun; browser unavailable" ✓; `templates.json` 16 type-variant fixtures across 12 diagram types (see F8) |
| Live app check on `main`/`scripts/markdown-studio.html` | R01–R04 defects still present verbatim (see F5) |
| Browser harness | cannot rerun here (no `playwright` module); recorded blockers in `browser-results.json`/`setup-limitations.md` are internally consistent |

## 2. Phase 1 code-change verification (baseline → working)

- **R01** ✓ `.mermaid-raw-code` moved outside `.mermaid-canvas` (working line 2362); `getCardMermaidCode(card)` added, reads `data-mermaid-code` (present since baseline, line 2345) with raw-element fallback.
- **R02** ✓ `renderAllPreviewDiagrams()` no longer depends on the canvas-contained raw element; mock rerun shows parse/render counts 2→4→6 across 3 cycles with source preserved.
- **R03** ✓ both error-card buttons now carry `diag-action-btn`; per-button `onclick` replaced by delegated `card.onclick` using `e.target.closest('[data-action]')`, which also covers dynamically created error buttons.
- **R04** ✓ zero inline `onclick="` handlers remain in the working copy (baseline had 2 at lines 2508–2509); delegated listener added on `#errorLogList` at bootstrap (line ~4353); copy uses the message from `errorLogs` by `data-error-id`.
- **Clipboard feedback** ✓ new `copyToClipboard()` with rejection catch and `execCommand` fallback; wired into copy-code, `btnCopyHtml`, `btnCopyMd`, and error-log copy.

The phase-1 changes are correct, minimal, and in-scope. The code itself passes audit; the problems are in gate discipline and evidence integrity (below).

## 3. Findings

| ID | Severity | Finding |
| --- | --- | --- |
| F1 | High (process) | G0 was **blocked** (no browser screenshots/console; no Windows Edge/Chrome/Firefox coverage), yet work advanced to Phase 1 and `reports/remediation_audit.md` logs Phase 0 as "Complete". Plan §1: "Do not advance past a failed phase gate… A blocked or unrun test is never a pass." The phase log should record Phase 0 as *blocked*, not *Complete*. |
| F2 | High (evidence) | "Phase 1 passed Gate G1" is a **mock-only** claim. All six P1 tests execute `vm`-extracted functions against mocked DOM; there is no browser run, no captured console output, no theme screenshots. G1 also requires "updating one diagram leaves all other source unchanged" — not covered by any P1 test (that is the R05/Phase-2 replacement path) — and "no new console errors", which is unverifiable without a browser. G1 should be recorded as *passed in mock harness; browser verification blocked*. |
| F3 | Medium (evidence integrity) | `evidence/checksums.sha256` is stale: 16 of 47 entries fail against committed content. `working/markdown_studio.html` is still listed with the baseline hash `11eaec36…` (actual `0273e79e…`); `evidence/phase-1/phase-1-results.json` is absent from the manifest; `evidence/index.md`, `reports/remediation_audit.md`, and `evidence/phase-0/test-results.json` were modified in the phase-1 commit without regenerating checksums. No phase-1 checksum manifest exists. |
| F4 | Medium (evidence consistency) | Environment records disagree across artifacts: `baseline.json` = Windows-11; `test-results.json` @ `20e552c` = win32 / Node v26.13.0 (2026-11-03T13:07Z); the same file @ `a5b80ac` = win32 / Node v24.20.0 (2026-11-04T00:38Z) — i.e. the Phase 0 evidence file was **overwritten by a rerun** in the phase-1 commit (original survives only in git history); `browser-results.json` and the phase-0 report say linux / Node v24.22.1. No note explains the multiple environments or the rerun. |
| F5 | Medium (traceability/scope) | The baseline is the **original `index.html` @ `1042d77`**, not the repo's current application file `scripts/markdown-studio.html` (5,242 lines after stages 1–4.5). The branch does not modify the live app, and R01–R04 still exist verbatim in it (`.mermaid-raw-code` inside `.mermaid-canvas` at 2613–2615; error buttons missing `diag-action-btn` at 2835/2890; inline `onclick` at 2756–2757). Phase 1 fixes exist only in `markdown_studio_phase_0/working/`. Per plan G0 ("if the source differs, establish a new named baseline"), the audit-of-original vs remediate-current intent must be stated explicitly before Phase 6 integration. |
| F6 | Low (evidence quality) | In committed `phase-1-results.json`, P1-03 records `card0Copied: false` and `card0EditExact: false` while `status: "pass"`. The underlying asserts did verify card 0, but the observation fields are computed after card-1 actions overwrote the state, so the record reads as a card-0 failure. Recompute or capture per-card snapshots at assertion time. |
| F7 | Low (code hygiene) | Working copy still exposes `window.dismissError = dismissError;` and `window.copyErrorText = copyErrorText;` (lines 2482–2483) although no inline handlers remain. Dead code that partially undoes the R04 closure fix; remove. |
| F8 | Low (documentation) | `remediation_audit.md` says working copy is "4,380 lines" (`wc -l` = 4,379) and "9 baseline reproduction checks passed" (actually 1 pass + 8 defect reproductions). `templates.json` `count: 16` counts type-variant fixtures; the `templates` map holds 12 diagram types. Clarify wording. |
| F9 | Info | `tests/phase-1-checks.cjs` overwrites `evidence/phase-1/phase-1-results.json` on every run; keep run-stamped copies if contemporaneous records are required. `markdown_studio_phase_0/information.txt` is an empty placeholder. |

## 4. Gate assessment

| Gate | Recorded status | QAQC verdict |
| --- | --- | --- |
| G0 | blocked (phase-0 report); "Complete" (audit report) | **Blocked — do not mark complete.** Hash/baseline/inventory/fixtures verified; browser evidence missing. Advance to Phase 1 was a documented but plan-noncompliant exception (F1). |
| G1 | passed | **Conditional pass (mock harness only).** Code changes verified correct and rerun reproduces 6/6; browser, console, and cross-diagram-update criteria unverified (F2). |

## 5. Recommendations before Phase 2

1. Correct the phase log: Phase 0 = blocked at G0; Phase 1/G1 = mock-level pass pending browser evidence.
2. Regenerate `checksums.sha256` for the phase-1 checkpoint and add `evidence/phase-1/phase-1-results.json`; stop overwriting phase-0 evidence files (F3, F4).
3. Decide and record whether the remediation target is the original `index.html` snapshot or the current `scripts/markdown-studio.html`; if the latter, re-baseline per plan G0 (F5).
4. Remove the `window.dismissError`/`window.copyErrorText` exports (F7) and fix the P1-03 observation fields (F6).
5. Provision a browser-capable environment (or record an accepted deferral with impact) before claiming any unqualified G1/G0 pass; browser checks remain the blocking evidence gap.
