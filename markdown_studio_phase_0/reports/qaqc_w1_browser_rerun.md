# QAQC verification — W1 browser matrix re-run @ `ed832cb` (`vibe/phase2-w1-r05`)

Date: 2026-11-07. Verifies the four run-stamped manifests added by `ed832cb` ("Browser matrix re-run on W1 candidate ab0f99f7").

## Results verified

| Browser | Version | Stop points | Candidate | Isolation stop point |
| --- | --- | --- | --- | --- |
| Edge (msedge) | 157.0.4341.42 | **141/141 pass** | raw = LF = `ab0f99f7…` | pass — **blockquote case now correct** |
| Chrome (chrome) | 157.0.8103.39 | **141/141 pass** | `ab0f99f7…` | pass — blockquote correct |
| Firefox | 159.0 | **141/141 pass** | `ab0f99f7…` | pass — blockquote correct |
| Playwright Chromium | 158.0.8127.18 | **141/141 pass** | `ab0f99f7…` | pass — blockquote correct |

All headed, win32, file+http origins, zero non-pass records, zero console/resource errors on both launch modes. `G1-CLIP-SUCCESS` pass on all four (Firefox `rawMatch: true`; Chromium-family `rawMatch: false` / normalized `match: true` — Windows CRLF, as recorded before).

Key check — `G1-X1-ISOLATION-BROWSER` blockquote case: `originalTargetGone: true, otherBlockGone: false` on all four browsers (previously `otherBlockGone: true`, the recorded G1-X2 residual). **The R05 residual is now browser-verified as fixed.** Tilde-first mixed-fence case also correct everywhere.

Provenance is clean this time: raw and LF-normalized candidate hashes both equal the committed `ab0f99f7…` (LF checkout).

## Findings

- **B1 (low, cosmetic):** the observation key is still named `blockquoteFirstKnownResidual` although the case now passes — rename to `blockquoteFirst` (or annotate) in `g0-capture-routine.cjs` so future readers don't misread the values.
- **B2 (fixed here):** `checksums.sha256` was stale after the re-run (108 re-captured PNGs + 5 new run manifests unlisted/failed). Regenerated from committed content → **253/253 OK**. Note for the process: regenerate checksums at every evidence checkpoint (screenshots change every run by nature; the manifest must match the committed artifacts at that checkpoint).

## Verdict

W1 is fully verified at mock **and** browser level on four browser configurations: **accepted, G1 exception closed**. R05 is resolved. Next: W2 (R09 listener lifecycle) and W3 (R15 generation guard) toward Gate G2.
