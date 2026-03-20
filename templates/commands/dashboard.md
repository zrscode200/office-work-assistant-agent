---
description: Visual dashboard of all projects (opens in browser)
---

Open the project dashboard in the browser.

## Instructions

1. Kill any previous dashboard server:

   ```bash
   if [ -f .ddt/personal/.dashboard.pid ]; then
     kill "$(cat .ddt/personal/.dashboard.pid)" 2>/dev/null || true
     rm -f .ddt/personal/.dashboard.pid .ddt/personal/.dashboard.port
   fi
   ```

2. Start the dashboard server in the background and capture the URL:

   ```bash
   node .claude/dashboard/server.js &
   sleep 0.5
   PORT=$(cat .ddt/personal/.dashboard.port 2>/dev/null)
   ```

3. Open in the default browser:

   - macOS: `open "http://127.0.0.1:${PORT}"`
   - Linux: `xdg-open "http://127.0.0.1:${PORT}"`

4. Print:

   > Dashboard running at **http://127.0.0.1:PORT**
   >
   > The server reads live data from `.ddt/` — use the refresh button in the browser to update.
   > It auto-shuts down after 30 minutes of inactivity.

## Notes

- The server reads `.ddt/registry.md`, `.ddt/config.md`, and project `status.md` files directly from disk on each refresh — no need to regenerate anything.
- If Node.js is not available, tell the user: "Dashboard requires Node.js. Install it from https://nodejs.org"
- If the server fails to start, check that `.claude/dashboard/server.js` and `.claude/dashboard/template.html` exist. If missing, the workspace may need an update (`bootstrap/init-workspace.sh --update`).
