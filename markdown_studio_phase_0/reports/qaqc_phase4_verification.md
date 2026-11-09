# QAQC verification — Phase 4 (R10, R11, R12) on `vibe/phase4-r10-r11-r12-2ace24` @ `4c9df21`

Date: 2026-11-09. Verifier: Linux x86-64, Node v22.23.4, vendored marked 12.0.2.

## Verdict: **Phase 4 accepted — Gate G4 met (P4 6/6 mock + 151/151 × 4 browsers).**

## Implementation reviewed

Candidate `9ca1ebd65601b75ab5ab7903167903f1642c705c754cc8fa38d0c7be328c4201` (raw = LF, clean; 4,980 lines) vs Phase 3 tip `66eb9ae3…`. Diff is tightly scoped:

- **R10**: new `insertSnippet()` (replaces selection, caret after snippet, no placeholder); `wrapSelection` drops the `'text'` fallback and positions the caret when the selection is empty; hr/table/quick-diagram/builder-insert paths use `insertSnippet`.
- **R11**: image command builds `![Alt text](url)` (or `![selected text](url)`) via `insertSnippet` — real URL only.
- **R12**: palette handler decodes `\n`/`\t` from `data-insert` into real characters at insertion time (C091 subgraph button @2119 unchanged in markup, decoded on use).
- Shortcut guard: global keydown handler returns early when Studio is open or focus is in another input/textarea/select/contentEditable; Escape still dismisses dialogs globally.

Baseline blob `11eaec36…` and live app untouched.

## Verification results

| Check | Result |
| --- | --- |
| Suites (fresh scratch): baseline / P1 / P2 / P3 / P4 | exit 0 / 7-7 / 3-3 / 3-3 / **6-6** |
| P4 committed results | P4-01 no stray `text` on empty-selection inserts; P4-02 exact `![Alt text](https://…)` and `![diagram of the system](…)`; P4-03 `The *quick* **brown** `fox` jumps` wrapping preserved; P4-04 subgraph decodes to 5 real newlines, 0 literal `\n`; P4-05 selection replaced without placeholder; P4-06 studio/find-input protected, Escape dismisses, editor shortcuts work when focused |
| **Independent QAQC repro** (extracted real `insertSnippet`/`wrapSelection`, and the app's actual decode expression applied to the real C091 attribute) | hr snippet at caret → `"hello\n\n---\n\n world"` (no `text`); bold empty sel → `****` at caret; bold selection → `**quick**`; surroundings preserved (`AAA---BBB`); image → `![Alt text](https://example.test/image.png)`; C091 attribute → real multi-line subgraph, `\n` count 0 |
| Browser matrix on `9ca1ebd6…`: chromium 158, edge 157.0.4341.42, chrome 157.0.8103.39, firefox 159.0 (headed, file+http) | **151/151 pass each**; `G4-INSERT-COMMANDS` (hr exact/no-text, image exact), `G4-SHORTCUT-GUARDS` (editor unmutated in studio/find input, Escape closes, bold works in editor), `G4-PERSISTENCE-ROUNDTRIP` (tab switch + reload preserve documents) — all pass 4/4 browsers, zero console errors, zero non-pass |
| Checksums | 12 stale entries on arrival (CRLF disk again); regenerated from LF → **308/308 OK** |
| Audit | Phase 4 marked Verified; lineage extended to `9ca1ebd6…` (LF + raw) |

## G4 gate mapping (plan §7)

All controls pass or documented (matrix) ✓; no stray `text` / malformed image destination / literal escapes (P4-01/02/04 + G4-INSERT-COMMANDS) ✓; insertions preserve unrelated content (repro + P4-05) ✓; keyboard & pointer routes behave (G4-SHORTCUT-GUARDS) ✓; tab switching/saving/reloading retain documents (G4-PERSISTENCE-ROUNDTRIP) ✓.

## Notes

- **P4-1 (process, 4th occurrence):** checksums arrived stale again — the CRLF disk issue keeps recurring. Strongly recommend committing a repo-root `.gitattributes` with `* text=auto eol=lf` (or LF-normalizing inside `tests/update-checksums.cjs`). Until then: regenerate checksums from LF content before every push.

**Recommendation:** merge `vibe/phase4-r10-r11-r12-2ace24` into `vibe/code_revisions`, then start **Phase 5 (R13/R14 export determinism & failure handling, Gate G5)**.
