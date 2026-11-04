# D001 Remediation Report — Browser-level diagram render defect

Date: 2026-11-04 (America/New_York). Remediation batch on `vibe/code_revisions`.
Candidate: `working/markdown_studio.html` `05de4260…` (4,376 lines) → **`55cb126470720d7deac4cc958cdf45a7f4b0c8955b65d8f13f590f97babb1218`** (4,382 lines).
Diff: **one CSS hunk, +8/−2 lines**; no script, markup, or feature changes.
Baseline untouched (`11eaec36…`); live app untouched (`scripts/markdown-studio.html`, `c5bfc749…`).

## 1. Discovery (D-series register entry)

| Field | Record |
| --- | --- |
| ID | **D001** |
| Discovered | 2026-11-03/04, during the first browser-capable verification of the Phase 1 checkpoint (the QAQC-recorded browser blocker was lifted by an in-app Chromium environment) |
| Symptom | In a real browser, both the immutable baseline and the working copy fail to render **sequence diagrams** (error: `svg element not in render tree`) and **edge-labeled flowcharts** (error: `Could not find a suitable point for the given distance`). Reproduces on the **pristine `welcome.md`** of a fresh load (2 cards → 2 error cards, 0 SVGs). Trivial flowcharts render. |
| Scope | Pre-existing defect in the original snapshot — **not a Phase 1 regression** (baseline behaves identically). The defect makes the application fail on its own welcome document and on standard fixtures containing sequence diagrams or labeled flowcharts. Mock harness could not catch it: P1 mocks replace Mermaid entirely, so the browser-only measurement path was never exercised. |
| Root cause | CSS "Safety Rule" (baseline lines 1216–1219): `body > svg, body > [id^="dmmd-"], body > [id^="mmd-"], … { display: none !important }` hides Mermaid 10.9.1's **in-flight render artifacts**, which Mermaid appends directly to `document.body` (see §2) |
| Fix | Narrowed the rule to error-specific selectors (see §3) |
| Validation | Browser battery (§4) + mock suites (§5); evidence in `evidence/phase-1/browser-evidence/` |
| Disposition | **Fixed** in the working copy in this batch |

## 2. Root cause analysis

Mechanism (established by instrumented browser experiments, not inference):

1. `renderAllPreviewDiagrams()` calls `mermaid.render('mmd-' + uid(), code)` **without a container** (working copy line 2636). Mermaid 10.9.1 then appends a temporary render container `d<uniqueId>` (i.e. `dmmd-…`) directly to `document.body`, renders inside it, measures label geometry, extracts the SVG string, and removes the container.
2. The application CSS rule intended to suppress Mermaid *error* artifacts matched these legitimate in-flight elements:
   - `body > [id^="dmmd-"]` hid the temp render container for every preview render (app render ids all start `mmd-`).
   - `body > svg` hid the **body-level measurement SVGs** the sequence-diagram renderer creates (a MutationObserver recorded a `DIV#dmmd-…` plus 4 id-less `body > svg` elements during a sequence render).
3. Hidden elements report `getBBox()` = 0×0. Mermaid 10.9.1's own sequence code throws `svg element not in render tree` on exactly this condition (string located in `mermaid.min.js`: `…getBBox(); if (oe.width===0 && oe.height===0) throw new Error("svg element not in render tree")`). Zero-size labels likewise make dagre's edge-label placement fail with `Could not find a suitable point for the given distance`.

Hypotheses eliminated by experiment (each tested in-browser):

| Hypothesis | Result |
| --- | --- |
| Mermaid configuration (theme/fonts/curve/securityLevel) | Disproved — bare page + the app's exact `initialize()` config renders both diagram types |
| Container vs no-container render call | Disproved — sequence fails in both modes in the app page; flowchart succeeds in both once the CSS rule is overridden |
| `mermaid.parse()` before render corrupting state | Disproved — direct parse→render sequence succeeds |
| Concurrent/duplicate render runs (R15-style) | Disproved — instrumented trace shows exactly 1 parse + 1 render per cycle, sequential |
| Render-id format | Explained by the CSS selector, not by Mermaid: only `mmd-`-prefixed ids produce temp elements matching `[id^="dmmd-"]`; this is why direct probes with other ids succeeded |
| **CSS rule hides in-flight render elements** | **Confirmed** — overriding only that rule (restoring display) made both failing fixtures render through the app's own path *before any code change* (1 SVG each, 0 errors) |

Corroboration: the live app (`scripts/markdown-studio.html`, stages 1–4.5) **does not contain this CSS rule** — the defect was independently fixed there by removal, confirming both the diagnosis and the fix direction. The original snapshot (and the working copy derived from it) retained it.

## 3. Fix applied (single hunk)

```diff
-  /* Safety Rule: Never allow Mermaid fallback SVGs to inject outside workspace */
-  body > svg, body > [id^="dmmd-"], body > [id^="mmd-"], body > .error-icon, body > [aria-roledescription="error"] {
+  /* Safety Rule: Never allow Mermaid fallback error artifacts to inject outside workspace.
+     D001: the previous "body > svg", [id^="dmmd-"], and [id^="mmd-"] selectors were removed —
+     … (full rationale recorded in the comment) */
+  body > .error-icon, body > [aria-roledescription="error"] {
     display: none !important;
   }
```

Residual protection is unchanged and layered: `suppressErrorRendering: true` in `initMermaid()` prevents Mermaid from injecting error SVGs; `cleanStrayMermaidElements()` removes any strays after renders; and the two retained selectors still hide genuine error artifacts. Post-fix checks found **zero stray `body > svg` / `dmmd-*` elements** and no visual clutter after renders (MathJax's SVG output unaffected: 2 MJX containers render alongside diagrams).

## 4. Browser verification (fixed candidate `55cb1264…`)

Environment: Linux x86-64 (X11); OpenCode 2.2.5 in-app Chromium **152.0.7977.167** (Electron 44.9.1); viewport 1296×866 @1x; origin `http://127.0.0.1:8931/markdown_studio.html` (local HTTP); Node v22.23.4 (suites). *Not Windows and not Firefox — recorded per plan §3; no Windows coverage is claimed.*

| # | Check | Result |
| --- | --- | --- |
| V1 | Pristine `welcome.md`, fresh load (storage cleared) | **2/2 diagrams render** (labeled flowchart + sequence), 0 error cards, 0 console errors — previously 0/2 |
| V2 | 7-type document (labeled flowchart, sequence, state-v2, ER, class, pie, gantt) | **7/7 SVGs**, 0 errors, ≈1.0 s |
| V3 | G1 Copy exactness (card 1 of 7; clipboard spy captures intended text before the unfocused-window rejection) | **Byte-exact** match with card 1's `data-mermaid-code` |
| V4 | G1 Edit exactness (card 1 of 7) | Studio modal opens with **byte-exact** source |
| V5 | G1 Fix in Studio (invalid flowchart beside a valid sequence) | 1 SVG + 1 error card; modal opens with **exact failing source** |
| V6 | G1 error-log Copy and Dismiss independence | Copy handler runs (spy-verified exact message); dismiss removes only the targeted entry |
| V7 | G1 repeated theme switches (×3, 7 diagrams) | **7/7 SVGs survive every redraw**, 0 blank canvases, 0 console errors |
| V8 | G1 cross-diagram update isolation (3-diagram backtick-fence doc; edit card 0 → Update) | **Only diagram 0 changed** (net +5 chars); diagrams 1–2 and both interstitial texts preserved |
| V9 | Math + diagram document | 2 MJX containers + 1 SVG, no stray body elements, 0 console errors |
| V10 | Console across the entire battery | **0 errors, 0 warnings** |

Clipboard **success** path remains environment-limited (the in-app tab is not the focused OS window, so `writeText` rejects with "Document is not focused"); the rejection path and the exact intended copy text are verified (V3, V6). The success path needs a focused visible window and stays an open verification item.

Screenshots (captured via the browser, full page): `browser-evidence/G1-D001-error-state-before.jpeg` (pre-fix error cards), `G1-D001-welcome-rendered-after.jpeg`, `G1-D001-multitype-light-after.jpeg`, `G1-D001-multitype-dark-after.jpeg`.

## 5. Mock-suite verification (Node v22.23.4, Linux x86-64, local)

- `node tests/phase-1-checks.cjs` → **exit 0, 6/6 pass** (P1-01…P1-06) against candidate `55cb1264…`; new canonical `evidence/phase-1/phase-1-results.json`; the prior canonical (candidate `05de4260…`) preserved run-stamped as `phase-1-results-candidate-05de4260-2026-11-04.json`.
- `node tests/baseline-checks.cjs` → exit 0; observations **identical** to the canonical Phase 0 record (environment fields differ only); rerun preserved as `evidence/phase-0/test-results-rerun-2026-11-04-local.json` (canonical file restored — write-once rule respected).

## 6. Additional finding: R05 reproduced at browser level (recorded, not fixed)

While verifying the G1 isolation criterion through the Studio round-trip, **R05 was reproduced for the first time in a real browser** (previously "browser reproduction pending"):

- Backtick-fence documents: update-isolation works correctly (V8).
- Tilde-fence document (`~~~mermaid` block 0 + backtick block 1): editing card 0 and updating **replaced the wrong block** — the tilde block was left untouched (original code intact) while the *backtick* diagram's content was overwritten with the edited code; interstitial text preserved.
- Mechanism confirmed in source: `btnBuilderInsert.onclick` (working copy lines 4008–4039) enumerates blocks with `/```mermaid[\s\S]*?```/g`, which counts only backtick fences, while card indexes count both fence styles.

R05 remains Phase 2 scope per the plan; no fix was applied in this batch. Its evidence level in the findings register is upgraded to *browser-reproduced*.

## 7. Minor-bug sweep during remediation

Per plan §1, defects discovered during the work were triaged:

- Apparent "duplicate `data-error-id`" in the error log → examined, **by design** (each row's Copy and Dismiss buttons both carry the row's id for delegation); no change.
- No other defects surfaced: console clean throughout the battery, no stray render artifacts post-fix, MathJax rendering unaffected, theme redraws stable.
- **D001 is the only code change in this batch.**

## 8. Gate impact and remaining steps

| Item | Status after this batch |
| --- | --- |
| G1 | All plan criteria now **browser-verified** in the available environment (Copy/Edit exactness, Fix in Studio, error-log independence, theme redraw without blanks or console errors, cross-diagram isolation on standard fences). Recorded limitations: clipboard success path needs a focused window; Windows/Edge/Chrome and Firefox targets unavailable. |
| G0 | Still **blocked** on completeness grounds: the full baseline capture (25-fixture screenshot sweep, 111-control execution, local-file vs HTTP launch modes) is pending — the capability blocker is now lifted, so this is executable next. |
| F5 remediation-target decision | Still open (required before Phase 6; recommended before Phase 2). Note: the live app already lacks the D001 CSS rule, so an eventual re-baseline would not reintroduce this defect. |
| Phase 2 | Next: R05 (now browser-reproduced), R09, R15. |
| Publish | Commits are local on `vibe/code_revisions` — this machine has no GitHub push credentials; push and PR #6 merge from a credentialed environment (the branch already contains PR #6's commits via fast-forward, so pushing auto-completes the PR merge). |
