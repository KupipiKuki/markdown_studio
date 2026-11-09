# Phase 4 kickoff — insertion commands & control sweep (R10, R11, R12)

Date: 2026-11-09. Branch: `vibe/phase4-r10-r11-r12-2ace24` off `vibe/code_revisions` @ `33fd834` (Phase 3 merged via PR #13; candidate `66eb9ae3…`, 4,940 lines; suites: baseline 0, P1 7/7, P2 3/3, P3 3/3; browser matrix 148/148 × 4 browsers). F5 decided: original snapshot target; live app and baseline untouched.

## Scope (plan §7) and current code refs

| ID | Finding | Evidence | Current refs in `working/markdown_studio.html` |
| --- | --- | --- | --- |
| **R10** | Generic wrapping helper adds fallback `text` after inserted blocks | B10 reproduced | `wrapSelection()` @3495: `const selected = text.substring(start, end) || 'text';` — fallback placeholder pollutes snippet insertions (e.g. divider) |
| **R11** | Image command constructs incorrect destination | B11 reproduced: `![Alt text](texthttps://example.test/image.png)` | image case @3551: `wrapSelection('![Alt text](', `${imgUrl})`)` — fallback `text` concatenated into the URL |
| **R12** | Subgraph palette inserts literal `\n` escapes | B12 reproduced (literalBackslashNCount > 0) | `data-insert="\\n  subgraph ClusterName…"` @2119 (control C091) — attribute holds literal backslash-n, not newlines |

## Work items (plan §7)

1. Separate selection-wrapping commands from whole-snippet insertion: formatting wraps the selection; snippet insertion replaces the selection or inserts at caret **without** extra placeholder text (fix R10/R11 at the `wrapSelection`/insert path — decide the helper API, keep behavior for format commands like bold).
2. Correct image Markdown generation (R11): `![Alt text](url)` with the real URL only.
3. Convert palette `data-insert` newline escapes to real newlines (R12) — decode `\n` when reading the attribute (or store real newlines); verify C091 inserts an actual multi-line subgraph.
4. Verify table, divider, code, math, link, quick-diagram, and Studio insertion with empty and nonempty selections.
5. Complete the control sweep: find/replace, file open, tabs, pane toggles, dropdown dismissal, modal close, zoom, shortcuts (the G0 inventory covers 111 controls — all were executed in the matrix; this phase adds behavioral assertions for insertion/persistence).
6. Editor shortcuts must not modify the document while typing in Studio or other input fields.
7. Register any new localized defects as D-series IDs.

## Gate G4 (plan §7, verbatim criteria)

Every inventoried control has a pass or a documented blocker. Exact-text checks show no stray `text`, malformed image destination, or literal newline escapes. Insertions and replacements preserve unrelated content. Keyboard and pointer routes produce the intended behavior. Tab switching, saving, and reloading retain documents correctly.

Evidence: control coverage matrix, input/output text samples, persistence round-trip comparisons, per-fix checks.

## Test plan

- `tests/phase-4-checks.cjs` (vm-extracted real handlers): P4-01 wrapSelection empty-selection for divider/code/math/link/table/quick-diagram — assert no stray `text`, surrounding content preserved; P4-02 image with synthetic URL → exact `![Alt text](https://…)`; P4-03 nonempty selection wrapping (bold) still works; P4-04 palette `data-insert` decoded — subgraph inserts real newlines (byte-compare editor value); P4-05 snippet insertion replaces selection without placeholder; P4-06 shortcut guard while focused in inputs.
- Browser: add `G4-INSERT-*` stop points to `g0-capture-routine.cjs` (input/output text samples per command, persistence round-trip: edit → switch tab → back → reload page → compare). 4-browser headed matrix, run-stamped manifests, candidate LF hash must match committed candidate.

## Process rules (unchanged)

Write-once + run-stamped evidence; regenerate `checksums.sha256` from **LF-normalized** content before every push (see `qaqc_phase3_verification.md` note P3-1 — CRLF disk hashes have invalidated the manifest three times; prefer a root `.gitattributes` with `* text=auto eol=lf`); raw + LF-normalized candidate hashes; D-series registration; no advancing past a failed gate; blocked/unrun ≠ pass; committed candidate only.

## First commands (Windows PowerShell)

```powershell
git checkout vibe/phase4-r10-r11-r12-2ace24
git pull
cd markdown_studio_phase_0
node tests\baseline-checks.cjs
node tests\phase-1-checks.cjs
node tests\phase-2-checks.cjs
node tests\phase-3-checks.cjs
```
