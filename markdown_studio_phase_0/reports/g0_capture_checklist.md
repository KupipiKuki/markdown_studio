# Process checklist — missing-requirement capture (G0 completeness + G1 exceptions)

Date: 2026-11-04. Companion routine: `tests/g0-capture-routine.cjs`. Candidate under capture: `working/markdown_studio.html` (`e02aed95…` @ `a8d0a50`); baseline `11eaec36…` stays untouched.

The routine generates one **stop point** per capture in `evidence/phase-0/g0-capture/manifest.json` (+ human-readable `stop-points.md`). A stop point is a checkpoint you must review (artifact + observation + status) before moving on. Statuses: `pass` / `fail` / `blocked` / `unrun`. A blocked or unrun stop point is never a pass (plan §1).

## 0. Pre-flight (do once, record in the manifest environment block)

- [ ] Record actual environment: OS, browser + version, launch origin, viewport, Node. Do **not** label a Linux run as Windows coverage (plan §3). Windows Edge/Chrome and Firefox rows stay `blocked` unless genuinely run there.
- [ ] Verify candidate hash: `sha256sum working/markdown_studio.html` must equal the hash in `reports/remediation_audit.md` (`e02aed95…`). The routine embeds the candidate hash in the manifest — if they disagree, the run was against a different file: record the actual hash or rerun against the audited candidate.
- [ ] The manifest environment block records platform/browser/version exactly as run. Playwright Chromium on win32 is a Chromium build on Windows — record it as such; branded Edge/Chrome rows stay separate.
- [ ] Verify baseline hash unchanged: `sha256sum baseline/markdown_studio.original.html` = `11eaec36…`.
- [ ] Browser-capable environment provisioned (Playwright + browser binary). In this sandbox: not available → every browser stop point is `blocked`, emit manifest with `--dry-run` and record the blocker.
- [ ] Use an isolated browser profile/context with synthetic documents only; never open a real saved profile (plan §1, §10).

## 1. Emit the stop-point manifest (always possible)

```sh
node tests/g0-capture-routine.cjs --dry-run
```

Expected: 2 launch + 25 fixture + 111 control + 3 G1-exception = **141 stop points** in `evidence/phase-0/g0-capture/manifest.json`. Review `stop-points.md` and confirm the list matches this checklist before executing anything.

## 2. Launch modes — stop points `G0-LAUNCH-FILE`, `G0-LAUNCH-HTTP`

- [ ] `G0-LAUNCH-HTTP`: serve the package on **127.0.0.1 only** (the routine does this itself) and load `working/markdown_studio.html` over HTTP. Record: page load, `#editor` present, pristine `welcome.md` renders **2/2 SVGs, 0 error cards, 0 console errors**, full-page screenshot.
- [ ] `G0-LAUNCH-FILE`: same via `file://`. Record clipboard and CDN restrictions **separately** from application failures (plan §3).
- [ ] Stop and review both launch stop points before running fixtures.

## 3. Fixture sweep — stop points `G0-FIX-*` (25 fixtures)

Run: `node tests/g0-capture-routine.cjs --origin http` (captures full-page PNG + counts + console per fixture into `artifacts/`).

- [ ] Every fixture has a stop point with a full-page screenshot, SVG/error-card counts, console errors = 0.
- [ ] `invalid.md` produces ≥1 error card (explicit invalid behavior).
- [ ] Mixed/outer-fence/nested fixtures: record how many diagrams the parser actually renders — this feeds the Phase 2 parser-consistent mapping (R05 residual, G1-X2).
- [ ] Stop on any `fail` if `--stop-on-fail`; otherwise review all 25 before the control sweep.

## 4. Control execution — stop points `G0-CTL-C001..C111` (111 controls)

- [ ] Each control executed on a synthetic document; observation + screenshot per control; modals/dropdowns closed after each probe (Escape + cleanup in the routine).
- [ ] Buttons with `data-action`/`data-template`/`data-insert` (46 dynamic-family controls) verified against their expected label/behavior, not just clicked.
- [ ] Selects/inputs: value changed + `change`/`input` dispatched; checkbox/radio clicked. Textareas (2): focus-only probe unless a behavioral check is defined — record as manual if so.
- [ ] **C015** (`input[type=file]#fileInput`, hidden): probed via `setInputFiles` with a synthetic fixture (`artifacts/synthetic-upload.md`) — setting `.value` on a file input throws in browsers, which is why a naive probe reports blocked. Pass = new tab/document appears. **C014** (its label) records the `for` wiring; the native file dialog itself is not automatable — covered by C015.
- [ ] **C091 and the other `data-insert`/`data-template`/`data-action` controls**: the routine resolves them by *exact in-page attribute equality*, not CSS attribute-string selectors — literal backslash sequences in `data-insert` (e.g. C091's `\n` subgraph payload, the R12 subject) are unescaped by CSS and would never match.
- [ ] Keyboard routes (shortcuts, find/replace, tab switch, pane toggles) — cover via dedicated probes after the 111; record as extra stop points if added.
- [ ] Any control that fails gets a preserved before-state record (plan §10) and a follow-up ID.

## 5. G1 exception re-checks — stop points `G1-*`

- [ ] `G1-X4-WELCOME-FULLPAGE`: full-page (not viewport) capture of welcome.md showing both diagrams — closes the N1/G1-X4 evidence gap from the earlier viewport-only JPEGs.
- [ ] `G1-X1-ISOLATION-BROWSER`: post-R05-fix browser check of update isolation on (a) tilde-first mixed-fence doc — must pass; (b) blockquote-fence-first doc — expected to show the **known G1-X2 residual**; record actual behavior, never claim fixed.
- [ ] `G1-CLIP-SUCCESS`: clipboard **success** path requires a focused visible window — rerun with `--headed` on a real display (the routine grants clipboard permissions and brings the page to front). Headless runs correctly record `blocked` with the rejection reason. Rejection path is already mock-verified (P1-06). Compare **normalized** text: the Windows clipboard round-trips LF as CRLF, so record `rawMatch` and `match` (normalized) separately — a raw-only mismatch on Windows is platform newline normalization, not an app defect.
- [ ] Favicon note: browsers request `/favicon.ico` on http origins only; the routine's loopback server answers 204, and the launch check ignores `.ico` 404s while still failing on any other console error or ≥400 resource response.

## 6. Environment matrix rows (plan §3)

- [ ] Windows + current Edge: `node tests/g0-capture-routine.cjs --origin both --headed --browser edge` (channel `msedge`; requires Edge installed on the host — if missing, Playwright errors and the row stays `blocked`).
- [ ] Windows + current Chrome (branded): same with `--browser chrome` (channel `chrome`). Playwright's bundled Chromium (`--browser chromium`, default) is a separate row and must be labeled as such — it is not branded Chrome/Edge.
- [ ] Firefox (secondary): `blocked` unless a Firefox binary exists — `--browser firefox`.
- [ ] Any row not genuinely executed stays `blocked`; do not borrow another environment's result. Each browser row needs its own run-stamped manifest (§6b).

## 6b. Multi-browser evidence rules

- [ ] Each browser run gets its own run-stamped manifest under `g0-capture/runs/manifest-<browser>-<origin>-<ts>.json` (the routine does this automatically) — a second browser never overwrites the first. `manifest.json` is only the latest pointer.
- [ ] Firefox coverage requires a Firefox manifest + env record with the Firefox version; a commit message saying "tested on Firefox" is not evidence. Until then the Firefox row stays `blocked`.
- [ ] Repo hygiene: do not commit Playwright scaffold that targets external URLs (e.g. an `e2e` spec visiting `https://playwright.dev`) or nested `.github/workflows/` files — GitHub only reads workflows from the repo-root `.github/workflows/`, so a nested workflow is inert. Any CI must run loopback-only app tests with no external URLs.

## 7. Close-out

- [ ] `manifest.json` totals reviewed: pass/fail/blocked/unrun counts separated (plan §11.4).
- [ ] Every `fail` has a preserved before-state artifact and a follow-up ID; every `blocked` has a reason string.
- [ ] Console log (`console-log.json`) reviewed: 0 errors expected on the happy path; any error is a finding.
- [ ] Regenerate `evidence/checksums.sha256` over the package including the new capture dir; keep prior records run-stamped (write-once rule, environment-notes.md).
- [ ] Update `reports/remediation_audit.md` phase log: G0 stays **blocked** until every required stop point is pass or has an accepted, recorded deferral.
