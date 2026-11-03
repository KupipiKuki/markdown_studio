# Browser setup observations

Captured November 3, 2026. Host: Linux; no Windows coverage.

1. Playwright Chromium launch: executable missing (`chromium_headless_shell-1234`).
2. Playwright Firefox launch: executable missing (`firefox-1538`).
3. Standard `playwright install chromium`: archive extraction failed with “End of central directory record signature not found” after repeated non-ZIP downloads; process exited 1.
4. Standard `playwright install chromium --only-shell`: same non-ZIP archive failure; process exited 1.
5. Alternate browser archive endpoint: HTTP 200 with a 195-byte HTML “Site Unavailable” response, not an archive.
6. Marked 12.0.2 and Mermaid 10.9.1 CDN HTTP probes returned JavaScript bytes. Only Marked was retained as a parser test dependency. No browser CDN test was possible.

Exact launch messages are in `browser-results.json`. Download observations above are transcribed from tool output; a raw installer log file was not retained. No browser was installed, no application page was loaded, and no saved user browser profile was used.
