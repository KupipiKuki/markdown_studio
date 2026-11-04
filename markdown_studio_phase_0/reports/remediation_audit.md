# Remediation audit — Phase 1 checkpoint

Status: Phase 0 completed with non-browser reproductions; Phase 1 passed Gate G1.
Baseline SHA-256: `11eaec367bb698f557abefafd359a5983d5ef0e08d1fce4e45ea08ec7277a83c` (4,316 lines)
Working copy SHA-256: `0273e79e08d2fefa289be8b92cf025e1448e4694f20b9c07065b8ad4bd827db0` (4,380 lines)

| Phase | Status | Result | Next action |
| --- | --- | --- | --- |
| 0 | Complete (Mocks/Parser) | Baseline hash verified; 111 static controls cataloged; 25 synthetic fixtures generated; 9 baseline reproduction checks passed; browser visual screenshots blocked by sandbox loopback isolation | Documented boundary; proceeded to Phase 1 |
| 1 | Passed | R01, R02, R03, R04 resolved. Canonical Mermaid source preserved outside SVG target; getCardMermaidCode helper added; Fix in Studio button class and delegated card actions restored; error log inline handlers replaced with delegated listeners; clipboard fallback and rejection toasts added | Proceed to Phase 2 (Lifecycle & source mapping) |
| 2 | Not started | Source replacement & render lifecycle (R05, R09, R15) | Await start of Phase 2 |
| 3 | Not started | Diagram styling, sizing & theme alignment (R06, R07, R08) | Await Gate G2 |
| 4 | Not started | Insertion commands & control sweep (R10, R11, R12) | Await Gate G3 |
| 5 | Not started | Export determinism & failure handling (R13, R14) | Await Gate G4 |
| 6 | Not started | Final regression, unified diff & byte-for-byte patch validation | Await Gate G5 |

## Phase 1 Resolved Findings

| Finding ID | Title | Root Cause | Remediation in Working Copy | Verification |
| :--- | :--- | :--- | :--- | :--- |
| **R01** | Diagram canvas HTML replacement deletes hidden source | `.mermaid-raw-code` was placed inside `.mermaid-canvas`, erased by `canvas.innerHTML = svg` | Moved `.mermaid-raw-code` outside `.mermaid-canvas`; added `getCardMermaidCode(card)` reading decoded `data-mermaid-code` and `.mermaid-raw-code` | `P1-02`, `P1-03` passed: source preserved across SVG injection; exact source returned |
| **R02** | Theme refresh skips diagrams after source deletion | `renderAllPreviewDiagrams()` exited early (`if (!canvas || !rawCodeEl) continue;`) because raw element was null | `renderAllPreviewDiagrams()` now retrieves source via `getCardMermaidCode(card)` | `P1-02` passed: 3 consecutive render cycles succeed with full parse/render counts |
| **R03** | Fix in Studio buttons unclickable | Error card generated button with class `btn btn-sm btn-primary`, omitting `.diag-action-btn` | Added `.diag-action-btn` to error buttons and added delegated click handling on `card` matching `[data-action]` | `P1-04` passed: clicking Fix in Studio triggers `openStudioWithCode` with exact failing syntax |
| **R04** | Error-log inline handlers cause ReferenceError | `onclick="copyErrorText(...)"` and `dismissError(...)` evaluated in global window scope outside closure | Replaced inline onclicks with `data-error-id` attributes and delegated `click` listener on `errorLogList` | `P1-05` passed: zero inline handlers in HTML; Copy and Dismiss operate independently |

Evidence: `evidence/phase-1/phase-1-results.json` (6 passing tests, 0 failures).
Candidate working copy: `working/markdown_studio.html`.
Original baseline copy: `baseline/markdown_studio.original.html` (read-only, untouched).
