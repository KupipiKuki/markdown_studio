# Phase 1 remediation QA/QC report (for the auditor)

Scope: QA/QC of the remediation code task for the auditor's held finding **P2 — empty Mermaid blocks were skipped** (branch `wp/studio_migration`).

## 1. Remediation under test

- Remediation commit: `67341bacd7225c473f3ea4d254c24886e6fd6d8e` — "P2 fix: route empty Mermaid fences through parse to the repair path"
- App file: `scripts/markdown-studio.html`, blob `d59ab4bee1eb90720a47dffcce1f26d3422285e5`, SHA-256 `53b1a965f9ce8bd85a15d3452dd59fc655b0bb195dae4fdee74cc8ae577fa4b8`
- Parent application candidate: `68560b0` (unchanged since; harness/evidence commits after `67341ba` touch no app code)

## 2. Code audit of the remediation diff

`git show 67341ba -- scripts/markdown-studio.html` is a **single hunk**:

```diff
       const canvas = card.querySelector('.mermaid-canvas');
+      const hasSource = !!card.querySelector('.mermaid-raw-code');
       const code = getCardMermaidCode(card);
-      if (!canvas || !code) continue;
+      if (!canvas || !hasSource) continue;
```

Audit notes:

- The old guard conflated "no readable source" with "empty source". The new guard skips only cards with no canvas or no `.mermaid-raw-code` node (structurally unrenderable); empty/whitespace-only sources now reach `mermaid.parse('')`, which throws, and the existing parse-failure branch renders the syntax-error card with the "Fix in Studio" action. No new error path was invented — the fix reuses the audited R03/R04 machinery.
- Side-effect surface: exactly the set of cards whose source trims to empty previously skipped; they now show the error card and one error-log entry (via the existing `logError`). No other card class changes behavior. Cards without a canvas remain skipped as before.
- Contracts unchanged: no `markflow_*`, `gemini_studio_*`, `BroadcastChannel`, or CDN lines in the diff (grep-verified).
- Static syntax: both inline scripts parse (Node `new Function` check) on the committed file.

## 3. Regression coverage for the finding

New/extended checks in `tests/phase1.spec.js`:

| Check | What it proves |
| --- | --- |
| P1-04b | Empty and whitespace-only backtick fences both show the error card with repair action; repairing the empty fence writes only that fence and the card recovers to SVG |
| P2-01 | Empty **tilde** fence errors (not blank) and repair preserves `~~~` fences |
| P2-02 | Empty fences inside **blockquote** and **list item** contexts also surface the repair path |
| P2-03 | Two empty fences side by side: repairing index 1 rewrites exactly the second span; the first stays empty and still repairable (span/index fidelity with empty sources) |
| P2-04 | Empty **non-Mermaid** fence (` ```js ` empty) produces no diagram card and no error — the fix is Mermaid-scoped |
| P2-05 | Tab/whitespace-only fence content (not just spaces) surfaces the repair path |

## 4. Retest matrix (full 8-pair rerun on the remediation candidate)

24 tests × 4 browsers per origin, headless, fresh context per test, synthetic fixtures, no storage clearing:

| Origin | Result |
| --- | --- |
| `file:///C:/Git/markdown_studio/scripts/markdown-studio.html` | 92 passed, 4 skipped (SM-03 by design on file://) |
| `http://127.0.0.1:8642/scripts/markdown-studio.html` | 96 passed, 0 failed |

Browsers: Chromium 159.0.8154.6, Microsoft Edge 159.0.8154.6 (`msedge`), Google Chrome 159.0.8154.6 (`chrome`), Firefox 159.0. All P1-01..P1-07, P1-04b, P2-01..P2-05, SM-01..SM-05 pass in every pair. No unexplained failures. Evidence: `qa-artifacts/` (http run) and `qa-artifacts-fileorigin/` (file run), per-browser `P2-*` JSON + screenshots (e.g. `chromium__P2-03.json`, `firefox__P1-04b_error_state.png`).

## 5. Verdict on the held finding

**P2 is resolved on candidate `67341ba`.** Empty and whitespace-only Mermaid fences in every supported fence context (backtick, tilde, blockquote, list item) now render the syntax-error card with a working "Fix in Studio" repair path, span-targeted correctly even among multiple empty fences, and non-Mermaid empty fences are unaffected. The previously passing P1 checks show no regression in the full rerun.

## 6. Remaining open item (unchanged)

Production launch URL is still unestablished. Local `file://` and `http://127.0.0.1:8642` origins are covered; the production origin must be recorded and added to the matrix before launch-origin coverage is declared complete. Owner: QA. Residual risk: storage/cross-Studio behavior on an untested origin.

## 7. Recommendation

The auditor can lift the hold on the P2 finding for candidate `67341ba` and record the Phase 1 pass decision on that candidate, keeping the production-launch-URL item open. Phase 2 should not start until the decision is recorded.

Known later-phase observations (not Phase 1): slide/presentation render path (~l. 3549) has its own empty-source skip and may blank empty fences inside slides; list-item repair drops list indentation on code lines (inherited from the audited reference); Firefox print/PDF limitation deferred.
