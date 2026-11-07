# QAQC verification — browser matrix capture @ `2630829` ("Testing completed on all three browsers")

Date: 2026-11-06. Reviewed `evidence/phase-0/g0-capture/runs/` on `vibe/g0-capture-checklist-2ace24` @ `2630829`.

## Runs verified

| Browser (as recorded) | Version | Platform | Headed | Origins | Stop points | Result |
| --- | --- | --- | --- | --- | --- | --- |
| Edge (channel `msedge`) | 156.0.4314.58 | win32 x64, Node v24.20.0 | yes | file + http | 141 | **141/141 pass** |
| Chrome (channel `chrome`) | 157.0.8103.39 | win32 x64, Node v24.20.0 | yes | file + http | 141 | **141/141 pass** |
| Firefox | 157.0 | win32 x64, Node v24.20.0 | yes | file + http | 141 | **141/141 pass** |
| (earlier) Playwright Chromium | 156.0.8078.4 | win32 x64 | yes | file + http | 141 | 141/141 pass (`3807cf1`) |

All runs have run-stamped manifests under `runs/` (no overwrites), zero non-pass records, empty console logs. Spot checks on the Edge manifest: `G0-LAUNCH-HTTP` pass with no console/resource errors (favicon fix holds); `G0-CTL-C019` pass with `printInvoked: 1, printStubbed: true` (no manual dialog Cancel needed); `G1-X1-ISOLATION-BROWSER` pass with tilde-fence isolation correct and the blockquote G1-X2 residual honestly recorded; `G1-CLIP-SUCCESS` pass with `rawMatch: false` (Windows CRLF) / `match: true` (normalized) — headed clipboard success now verified on all browsers.

## Findings

| ID | Severity | Finding |
| --- | --- | --- |
| M1 | Medium → **RESOLVED** | All three browser runs recorded candidate `b15a4e8b…` vs committed `e02aed95…`. Proven: the committed blob is pure LF (0 CR bytes), and LF→CRLF of that blob hashes to exactly `b15a4e8b…` — i.e. the runs executed the committed `e02aed95` content checked out with CRLF line endings (Windows autocrlf), which is also why `git diff` on the test machine was empty. The 141/141 matrix results therefore **do** attach to the committed candidate. The routine now records `candidateSha256LfNormalized` alongside the raw hash in every manifest. Optional hygiene: a `.gitattributes` with `*.html text eol=lf` would make on-disk hashes match the blob. |
| M2 | Low (closed here) | `evidence/checksums.sha256` did not cover the new `g0-capture/` evidence. Regenerated over the full package: 239 entries, 239/239 verify, and all 65 previously listed entries still match (the capture only added files). |

## Matrix status after this review

- Windows + branded Edge 156: **pass (141/141)** — pending M1.
- Windows + branded Chrome 157: **pass (141/141)** — pending M1.
- Windows + Firefox 157 (secondary): **pass (141/141)** — pending M1.
- Windows + Playwright Chromium 156: **pass (141/141)** — pending M1.
- G0 completeness (fixtures, controls, launch modes, console) is now covered on four browser configurations; G1 exceptions (isolation, full-page welcome, clipboard success) pass on all.
