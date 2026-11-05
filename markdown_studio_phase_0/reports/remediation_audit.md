# Remediation audit — Phase 1 checkpoint (revised after QAQC audit and R05 remediation)

Status: Phase 0 **blocked at G0** (full browser capture pending; browser capability now available); Phase 1 **verified** after discovery fix D001 (see `reports/d001_remediation_report.md` and `reports/qaqc_d001_verification.md`) and R05 cross-diagram update isolation fix for mixed fences. Revised 2026-11-04 in response to `reports/qaqc_audit_phase_0_phase_1.md` (findings F1–F8; see `reports/qaqc_audit_response.md`), updated for the D001 remediation batch, and further updated for G1 exit remediation.

Baseline SHA-256: `11eaec367bb698f557abefafd359a5983d5ef0e08d1fce4e45ea08ec7277a83c` (4,316 lines)
Working copy SHA-256: `e02aed95cfa610eac62c5b1e82b37ba1e237731f0c285257acadc191f0b387b7` (4,390 lines; lineage: `0273e79e…` 4,379 lines → `05de4260…` 4,376 lines after F7 dead-export removal → `55cb1264…` 4,382 lines after D001 CSS fix → `e02aed95…` 4,390 lines after R05 delimiter-agnostic update-isolation fix)

## Phase log

| Phase | Status | Result | Next action |
| --- | --- | --- | --- |
| 0 | **Blocked at G0** (capability now available) | Baseline hash verified; 111 static controls cataloged; 25 synthetic fixtures generated (16 template variants across 12 diagram types, plus tall, wide, multi, invalid, labels, mixed, mixed-fences, outer-fence, nested); baseline/syntax check passed (B00) and 8 defect reproductions recorded (B01, B03, B04, B05, B09, B10, B11, B12); browser visual screenshots and console capture blocked by sandbox environment at capture time. 2026-11-04: a browser-capable environment (in-app Chromium on Linux) is now available and confirmed working; D001 was discovered and fixed through it | Run the full G0 capture (25-fixture screenshot sweep, 111-control execution, local-file and HTTP launch modes) and re-review G0; a blocked gate is not a pass |
| 1 | **Verified (mock harness + browser battery)** | R01–R05 resolved (register below); P1-01..P1-07 pass 7/7 against candidate `e02aed95…`. 2026-11-04 browser verification (Linux, in-app Chromium 152, HTTP origin): pristine welcome.md renders 2/2; 7 diagram types render 7/7; Copy/Edit byte-exact per card; Fix in Studio opens exact failing source; error-log Copy/Dismiss independent; theme ×3 redraws with no blank canvases and clean console; cross-diagram update isolation verified across backtick and tilde fences. Discovery D001 (CSS safety rule) and R05 (mixed-fence diagram update isolation) both remediated | Clipboard success path requires a focused visible window (rejection path verified); Windows/Edge/Chrome and Firefox targets remain recorded limitations, not claimed coverage |
| 2 | Not started | Source replacement & render lifecycle (R09, R15; R05 update isolation pulled forward to G1) | Start Phase 2 work (R09 listener cleanup, R15 render generation guard) |
| 3 | Not started | Diagram styling, sizing & theme alignment (R06, R07, R08) | Await Gate G2 |
| 4 | Not started | Insertion commands & control sweep (R10, R11, R12) | Await Gate G3 |
| 5 | Not started | Export determinism & failure handling (R13, R14) | Await Gate G4 |
| 6 | Not started | Final regression, unified diff & byte-for-byte patch validation | Await Gate G5 |

Process correction (F1): the previous revision of this log recorded Phase 0 as "Complete" and Phase 1 as "Passed" while G0 was blocked. Per plan §1 ("Do not advance past a failed phase gate… A blocked or unrun test is never a pass"), the log now records G0 as blocked and G1 as a conditional mock-level pass. The Phase 1 code changes themselves were independently re-verified as correct and in-scope by the QAQC audit and by rerunning both suites.

## Remediation target (F5 — decision required before Phase 6)

The Phase 0 baseline is the original `index.html` @ commit `1042d77` (`11eaec36…`, 4,316 lines), not the repository's current application file `scripts/markdown-studio.html` (`c5bfc749c33af0336d44b0b6e9a6ac328687a23111600a16f4760d1454820bd9`, 5,242 lines after stages 1–4.5). Phases 0–1 as executed are an **audit-and-remediation of the original snapshot**: all fixes live in `working/markdown_studio.html`, and the branch does not modify the live app.

Confirmed 2026-11-04: R01–R04 still exist verbatim in `scripts/markdown-studio.html` — `.mermaid-raw-code` inside `.mermaid-canvas` (lines 2613–2615), error-card buttons without `diag-action-btn`, and inline `onclick="copyErrorText(...)"`/`onclick="dismissError(...)"` handlers (lines 2756–2757).

Per plan G0 ("If the source differs, establish a new named baseline before proceeding"), one of the following must be chosen and recorded before Phase 6 integration:

1. Keep the original snapshot as the remediation target for Phases 2–6 and treat the live-app fix as a separate, later effort; or
2. Re-baseline on `scripts/markdown-studio.html` and port the verified R01–R04 fixes (and subsequent phases) into the live app.

This decision is open; no integration into the live app has been performed or implied. D001 note (2026-11-04): the live app **already lacks** the D001 CSS rule (it was removed there during stages 1–4.5), so a re-baseline on the live app would not reintroduce this defect; see `reports/d001_remediation_report.md` §2.

## Phase 1 Resolved Findings

| Finding ID | Title | Root Cause | Remediation in Working Copy | Verification |
| :--- | :--- | :--- | :--- | :--- |
| **R01** | Diagram canvas HTML replacement deletes hidden source | `.mermaid-raw-code` was placed inside `.mermaid-canvas`, erased by `canvas.innerHTML = svg` | Moved `.mermaid-raw-code` outside `.mermaid-canvas`; added `getCardMermaidCode(card)` reading decoded `data-mermaid-code` and `.mermaid-raw-code` | `P1-02`, `P1-03` passed: source preserved across SVG injection; exact source returned |
| **R02** | Theme refresh skips diagrams after source deletion | `renderAllPreviewDiagrams()` exited early (`if (!canvas || !rawCodeEl) continue;`) because raw element was null | `renderAllPreviewDiagrams()` now retrieves source via `getCardMermaidCode(card)` | `P1-02` passed: 3 consecutive render cycles succeed with full parse/render counts |
| **R03** | Fix in Studio buttons unclickable | Error card generated button with class `btn btn-sm btn-primary`, omitting `.diag-action-btn` | Added `.diag-action-btn` to error buttons and added delegated click handling on `card` matching `[data-action]` | `P1-04` passed: clicking Fix in Studio triggers `openStudioWithCode` with exact failing syntax |
| **R04** | Error-log inline handlers cause ReferenceError | `onclick="copyErrorText(...)"` and `dismissError(...)` evaluated in global window scope outside closure | Replaced inline onclicks with `data-error-id` attributes and delegated `click` listener on `errorLogList`; the temporary `window.dismissError`/`window.copyErrorText` exports added during the first checkpoint were removed (audit F7) | `P1-05` passed: zero inline handlers in HTML; Copy and Dismiss operate independently |
| **R05** | Diagram replacement regex mismatches block index on mixed fences | `btnBuilderInsert.onclick` matched only `/```mermaid[\s\S]*?```/g`, skipping tilde fences and corrupting subsequent diagrams | Replaced with CommonMark/GFM code fence parser matching ` ``` ` and ` ~~~ ` fences ($\ge 3$ delimiters) and indentation, preserving delimiters and replacing only the targeted index | `P1-07` passed: updating tilde diagram or backtick diagram in mixed document leaves other diagrams and surrounding Markdown completely untouched |

Evidence: `evidence/phase-1/phase-1-results.json` (7 passing tests, 0 failures; candidate `e02aed95…` — prior records for `05de4260…` and `55cb1264…` are preserved run-stamped). Candidate working copy: `working/markdown_studio.html` (`e02aed95…`). Original baseline copy: `baseline/markdown_studio.original.html` (read-only, untouched, `11eaec36…`).

Verification level: mock harness (`vm`-extracted functions against mocked DOM) **plus browser verification** (2026-11-04, Linux, in-app Chromium 152.0.7977.167, HTTP origin): all G1 criteria exercised in a real browser — see the phase log and `reports/d001_remediation_report.md` §4. Clipboard success path remains environment-limited (rejection path verified). Browser verification of code logic is now closed; remaining environment limitations (Windows/Firefox targets, focused-window clipboard) are recorded above.

## Additional discoveries (D-series register)

| ID | Title | Root cause | Remediation in working copy | Validation | Disposition |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **D001** | CSS "Safety Rule" hides Mermaid's in-flight render elements, breaking sequence diagrams and edge-labeled flowcharts in real browsers | Baseline lines 1216–1219: `body > svg, body > [id^="dmmd-"], body > [id^="mmd-"] { display:none !important }` matched Mermaid 10.9.1's temp render container (`dmmd-<id>` in `document.body`) and sequence-diagram measurement SVGs (body-level `svg`), making `getBBox()` return 0×0 — Mermaid then throws `svg element not in render tree` (sequence) and dagre throws `Could not find a suitable point for the given distance` (edge-labeled flowcharts). Pre-existing in the baseline (fails on pristine `welcome.md`); not a Phase 1 regression; invisible to the mock harness | Narrowed the rule to `body > .error-icon, body > [aria-roledescription="error"]` with a D001 rationale comment; stray-artifact safety retained via `suppressErrorRendering` + `cleanStrayMermaidElements()` (single +8/−2 CSS hunk, candidate `05de4260…` → `55cb1264…`) | Browser: welcome.md 2/2, 7 types 7/7, G1 criteria battery all pass, console clean (`evidence/phase-1/browser-evidence/`); suites: P1 6/6, baseline exit 0. Full report: `reports/d001_remediation_report.md` | **Fixed** (2026-11-04) |

Related finding resolution: **R05** (cross-diagram update isolation on mixed fences) was reproduced during D001 verification and resolved in this batch to satisfy Gate G1 exit criteria ("updating one diagram leaves all other source unchanged"). Validated via `P1-07` in `tests/phase-1-checks.cjs`.
