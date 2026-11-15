# Markdown Studio Phase 3 independent review

Reviewed November 15, 2026  
Review scope: Phase 3 coder implementation, QA/QC evidence, and the Phase 3 handoff.

## Candidate reviewed

- Migration branch: [`wp/studio_migration`](https://github.com/KupipiKuki/markdown_studio/tree/wp/studio_migration)
- Branch tip at review: `9c1da9055baa3a7a3117fa8a30b80756c3abe4a6`
- Frozen Phase 3 code candidate: `921e60c91a4c960ce4e4c160bb0a4ffafbe7198a`
- Candidate live-file blob: `a250ede3571d718cf9a16782d664c430ea7d280e`
- Current branch live-file blob: `a250ede3571d718cf9a16782d664c430ea7d280e` (matches frozen candidate)
- QA results: [`PHASE3-QA-RESULTS.md`](https://github.com/KupipiKuki/markdown_studio/blob/wp/studio_migration/qa-artifacts/PHASE3-QA-RESULTS.md)
- Coder/QA auditor report: [`PHASE3-AUDITOR-REPORT.md`](https://github.com/KupipiKuki/markdown_studio/blob/wp/studio_migration/qa-artifacts/PHASE3-AUDITOR-REPORT.md)
- Handoff under review: [markdown-studio-phase-3-handoff.md](C:\Users\jmc53\OneDrive\Documents\ChatGPT\notepad_studio\markdown-studio-phase-3-handoff.md)

The candidate script is unchanged on the current branch. Follow-up commits contain QA artifacts, reports, the handoff, and test-harness updates; the QA report says the final matrix used the final spec against the frozen app blob. This review inspected the code and retained reports/evidence; it did not rerun Playwright.

## Review disposition by scope

| Area | Review result |
| --- | --- |
| R10 snippet/wrapper insertion | Confirmed in source and QA report: no-selection inserts wrapper pairs with caret between them; selected text is wrapped; the literal `text` fallback is removed. |
| R11 image insertion | Confirmed: selected text becomes alt text, otherwise `Alt text`; the full image Markdown snippet replaces the selection rather than appending a URL to it. |
| R12 palette decoding | Confirmed: `\\n` and `\\t` are decoded on insertion, with the Node Styling backslash content covered as unchanged. |
| Global shortcut guard | Confirmed: Escape dismissal is handled before the focus guard; shortcuts return early for editable controls and open overlays; regression evidence covers editor focus and modal/input contexts. |
| Gutter, nowrap | Confirmed: the baseline had 20.8 px gutter pitch against 21.6 px editor pitch, accumulating 31.8 px drift at line 40. The 13.5 px gutter font correction aligns pitch, with reported residuals within 2.5 px across the tested viewport/scroll conditions. |
| Phase 1/2 regressions | QA report records the full regression matrix passing, with four expected file-origin skips for shared-origin transfer. |

## Open acceptance item: gutter alignment in soft-wrap mode

The Phase 3 handoff's P3-06 requires checking line-number alignment while toggling wrap. The final spec measures wrap-mode drift but only asserts the nowrap cases. The retained Firefox HTTP evidence reports drift growing to **260.6 px by logical line 40** after prior lines wrap. The report calls this inherent to the one-number-per-logical-line design, but the handoff did not exempt soft-wrap alignment.

Therefore P3-06 is only partially satisfied: the nowrap drift is fixed and verified, while wrapped logical-line starts remain unaligned. The test's wrap-mode branch is an evidence capture, not a passing acceptance assertion. Do not mark the complete Phase 3 handoff as fully closed until one of these is recorded:

1. Implement and test gutter row positioning that tracks wrapped visual height, including the next logical line after a wrapped line; or
2. Explicitly defer soft-wrap line-number alignment as a known product limitation, revise the acceptance scope, and record the accepted user-facing behavior and residual risk.

## Other recorded exception

The production launch URL remains unknown. QA covered `file://` and localhost HTTP in four browsers; those results do not establish launch-origin coverage. This is a cross-phase rollout dependency, not a failure of the Phase 3 code tests.

## Overall decision

**Phase 3 code review: approved for R10–R12, shortcut guarding, and nowrap gutter correction. Phase 3 handoff: conditional / not fully closed due to unasserted soft-wrap gutter drift.** The reported matrix is otherwise strong: 144 passed, 4 expected skips, 0 failures on `file://`; 148 passed, 0 failures on localhost HTTP. Production launch-origin coverage remains open.

---

## Follow-up review — soft-wrap gutter remediation

Reviewed November 15, 2026.

### Candidate verification

- Latest migration branch tip: `0d493658e8a42a68293119df61d91e7d133107cd`.
- Frozen remediation candidate: `b792bf5cd0fdf34da072dcdbf4765662490e53a1`.
- Candidate and current branch live-file blob: `cb53b627c39fdb9fa51a69a0d3d7a6747dee189b` (match).
- QA reports: [`Phase 3 remediation QA/QC`](https://github.com/KupipiKuki/markdown_studio/blob/wp/studio_migration/qa-artifacts/PHASE3-REMEDIATION-QAQC.md) · [`Phase 3 QA results`](https://github.com/KupipiKuki/markdown_studio/blob/wp/studio_migration/qa-artifacts/PHASE3-QA-RESULTS.md).

The current branch is two commits ahead of the frozen code candidate. The live script remains byte-for-byte the same; the follow-up changes contain QA artifacts and reports. The updated P3-06 test asserts wrapped lines and the logical lines immediately after them. The remediation report records a negative control failing on the old candidate and the full Phase 1–3 matrices passing on the fix.

### Resolved finding

The soft-wrap misalignment is addressed: `updateLineNumbers()` positions each logical line number from mirrored text geometry, and the retained remediation evidence reports 0 px drift for sampled wrapped-line starts and following logical lines across the tested browsers and origins. The prior review's P3-06 acceptance gap is closed.

### New performance review concern

In the wrap-mode measurement loop, the code calls `mirror.querySelector('[data-ln="…"]')` once for every logical line. `updateLineNumbers()` also runs from the editor's `input` handler, so this repeated DOM search is on the typing path. Repeatedly searching the entire mirror for each line can scale superlinearly with document length; the QA fixture contains 40 logical lines and does not establish responsiveness on large Markdown files. See the [`updateLineNumbers()` implementation](https://github.com/KupipiKuki/markdown_studio/blob/b792bf5cd0fdf34da072dcdbf4765662490e53a1/scripts/markdown-studio.html#L3544-L3563) and [editor input handler](https://github.com/KupipiKuki/markdown_studio/blob/b792bf5cd0fdf34da072dcdbf4765662490e53a1/scripts/markdown-studio.html#L3928-L3937).

Recommended adjustment: collect the line spans once (for example with `querySelectorAll('[data-ln]')`) and index that collection in the loop, then exercise gutter updates on a representative large synthetic document. This is a static performance risk, not a measured user-visible failure; the remediation report's O(document) complexity statement overlooks the repeated per-line selector.

### Updated disposition

The original P3-06 functional exception is resolved. R10–R12, shortcut guard, nowrap and soft-wrap gutter behavior have passing reported coverage. I recommend resolving or measuring the typing-path lookup cost before final Phase 3 code sign-off. The production launch URL remains a separate cross-phase rollout dependency. I inspected the source and evidence but did not rerun Playwright.
