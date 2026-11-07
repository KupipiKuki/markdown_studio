# QAQC review — G0 capture run @ `3807cf1` (win32, Playwright Chromium 156, headed)

Date: 2026-11-05. Reviewed `evidence/phase-0/g0-capture/` as committed on `vibe/g0-capture-checklist-2ace24` @ `3807cf1`.

## Result under review

`manifest.json`: **141/141 stop points pass, 0 fail / 0 blocked / 0 unrun**; `console-log.json` empty. Environment: win32 x64, Node v24.20.0, Playwright Chromium 156.0.8078.4, headed, origins file+http. Spot-checked records:

- `G0-LAUNCH-FILE` / `G0-LAUNCH-HTTP`: 2/2 welcome SVGs, 0 error cards, no console errors (favicon fix works — HTTP launch passes now).
- `G0-CTL-C014`/`C015`: label wiring + real file load via `setInputFiles` (tabs 1→2, synthetic doc loaded) — pass.
- `G0-CTL-C091`: exact-attribute resolution works — pass.
- `G1-X4-WELCOME-FULLPAGE`: full-page capture, 2/2 SVGs — pass (closes the viewport-only gap G1-X4/N1).
- `G1-X1-ISOLATION-BROWSER`: tilde-first mixed fences correctly isolated; blockquote-first case recorded as the **known G1-X2 residual** (`otherBlockGone: true`) — honestly recorded, not claimed fixed — pass as designed.
- `G1-CLIP-SUCCESS`: headed clipboard read succeeded; raw text has CRLF (Windows clipboard LF→CRLF normalization), normalized match true — pass with the platform note; raw/normalized recorded separately.

## Findings

| ID | Severity | Finding |
| --- | --- | --- |
| C1 | Medium (provenance) | Manifest candidate is `b15a4e8b…`, but `vibe/code_revisions` @ `a8d0a50` working copy is `e02aed95…`. The capture ran against a different file than the committed branch tip. Record the actual candidate in `remediation_audit.md` (or rerun against the committed candidate) so the 141/141 evidence attaches to an identifiable artifact. |
| C2 | Medium (evidence) | Commit message claims "tested on Firefox and Chrome", but only a Chromium manifest exists — the Firefox run's manifest was overwritten (write-once violation). Firefox coverage is currently **unevidenced**; the matrix row stays `blocked` until a Firefox run-stamped manifest exists. Routine now writes `runs/manifest-<browser>-<origin>-<ts>.json` per run (verified in dry-run). |
| C3 | Low (hygiene) | Commit includes inert/unsafe scaffold: nested `markdown_studio_phase_0/.github/workflows/playwright.yml` (GitHub reads only root `.github/workflows/`), `e2e/example.spec.js` visiting external `https://playwright.dev`, `playwright.config.js`, and a `package.json` whose description is a copy of the README and whose `main` points at a nonexistent `index.js`. Recommend removing the scaffold or replacing it with loopback-only app smoke tests; any real CI belongs at repo root and must not hit external URLs. Left untouched here (not my change to delete). |
| C4 | Low (cosmetic) | Artifact paths in the committed manifest use Windows backslashes. Routine now normalizes to POSIX separators in manifests. |

## Verdict

The capture run itself is sound: 141/141 pass on Windows Chromium (headed), both launch modes, clean console, all 111 controls executed, fixtures rendered, G1 exceptions exercised with the blockquote residual correctly recorded. G0's completeness gap is now **closed for Windows+Chromium(Playwright)** pending C1 provenance; Firefox and branded Edge/Chrome rows remain `blocked` pending their own run-stamped manifests (C2).
