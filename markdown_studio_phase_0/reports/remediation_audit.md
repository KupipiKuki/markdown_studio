# Remediation audit — Phase 1 checkpoint (revised after QAQC audit)

Status: Phase 0 **blocked at G0** (browser evidence missing); Phase 1 **conditional pass at mock-harness level**, browser verification pending. Revised 2026-11-04 in response to `reports/qaqc_audit_phase_0_phase_1.md` (findings F1–F8); see `reports/qaqc_audit_response.md` for the finding-by-finding response.

Baseline SHA-256: `11eaec367bb698f557abefafd359a5983d5ef0e08d1fce4e45ea08ec7277a83c` (4,316 lines)
Working copy SHA-256: `05de426050850de2a85c70abda7a3f0336af0c998273eb1e568e3f34c3d28915` (4,376 lines; was `0273e79e08d2fefa289be8b92cf025e1448e4694f20b9c07065b8ad4bd827db0`, 4,379 lines, before removal of the dead `window.dismissError`/`window.copyErrorText` exports recorded as F7)

## Phase log

| Phase | Status | Result | Next action |
| --- | --- | --- | --- |
| 0 | **Blocked at G0** | Baseline hash verified; 111 static controls cataloged; 25 synthetic fixtures generated (16 template variants across 12 diagram types, plus tall, wide, multi, invalid, labels, mixed, mixed-fences, outer-fence, nested); baseline/syntax check passed (B00) and 8 defect reproductions recorded (B01, B03, B04, B05, B09, B10, B11, B12); browser visual screenshots and console capture blocked by sandbox environment | Provision a browser-capable environment, run the capture harness, and re-review G0; a blocked gate is not a pass |
| 1 | **Conditional pass (mock harness)** | R01, R02, R03, R04 resolved in the working copy and verified by P1-01..P1-06 (6/6 pass) against mocked DOM. No browser run, console capture, or theme screenshots exist; the G1 criterion "updating one diagram leaves all other source unchanged" is not covered by any P1 test (it exercises the R05/Phase-2 replacement path) | Browser verification of G1 criteria, including cross-diagram update isolation and clean console, before Phase 2 |
| 2 | Not started | Source replacement & render lifecycle (R05, R09, R15) | Await browser-verified G1 and start of Phase 2 |
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

This decision is open; no integration into the live app has been performed or implied.

## Phase 1 Resolved Findings

| Finding ID | Title | Root Cause | Remediation in Working Copy | Verification |
| :--- | :--- | :--- | :--- | :--- |
| **R01** | Diagram canvas HTML replacement deletes hidden source | `.mermaid-raw-code` was placed inside `.mermaid-canvas`, erased by `canvas.innerHTML = svg` | Moved `.mermaid-raw-code` outside `.mermaid-canvas`; added `getCardMermaidCode(card)` reading decoded `data-mermaid-code` and `.mermaid-raw-code` | `P1-02`, `P1-03` passed: source preserved across SVG injection; exact source returned |
| **R02** | Theme refresh skips diagrams after source deletion | `renderAllPreviewDiagrams()` exited early (`if (!canvas || !rawCodeEl) continue;`) because raw element was null | `renderAllPreviewDiagrams()` now retrieves source via `getCardMermaidCode(card)` | `P1-02` passed: 3 consecutive render cycles succeed with full parse/render counts |
| **R03** | Fix in Studio buttons unclickable | Error card generated button with class `btn btn-sm btn-primary`, omitting `.diag-action-btn` | Added `.diag-action-btn` to error buttons and added delegated click handling on `card` matching `[data-action]` | `P1-04` passed: clicking Fix in Studio triggers `openStudioWithCode` with exact failing syntax |
| **R04** | Error-log inline handlers cause ReferenceError | `onclick="copyErrorText(...)"` and `dismissError(...)` evaluated in global window scope outside closure | Replaced inline onclicks with `data-error-id` attributes and delegated `click` listener on `errorLogList`; the temporary `window.dismissError`/`window.copyErrorText` exports added during the first checkpoint were removed (audit F7) | `P1-05` passed: zero inline handlers in HTML; Copy and Dismiss operate independently |

Evidence: `evidence/phase-1/phase-1-results.json` (6 passing tests, 0 failures; P1-03 observation fields recomputed at assertion time per audit F6). Candidate working copy: `working/markdown_studio.html` (`05de4260…`). Original baseline copy: `baseline/markdown_studio.original.html` (read-only, untouched, `11eaec36…`).

Verification level: mock harness only (`vm`-extracted functions against mocked DOM). This verifies code logic, not browser layout, event dispatch, clipboard access, or console behavior.
