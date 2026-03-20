---
description: Visual dashboard of all projects (opens in browser)
---

Open a visual project dashboard in the browser.

## Instructions

### 1. Gather data

1. Read `.ddt/registry.md` for all registered projects.
2. Read `.ddt/config.md`. For each configured team repo, run `git -C <repo-path> pull` to ensure data is current, then scan its `projects/` directory for projects not in the registry. Note any as unregistered, along with which team repo they're in.
3. For each **active** project in the registry, read `status.md` and `overview.md`.
4. For each **completed** project, note name, location, and completion date.
5. Identify alerts:
   - **Blocked** projects (health = blocked)
   - **At-risk** projects (health = at-risk)
   - **Stale** projects (no artifact changes in 2+ weeks)
   - **Unregistered** team projects found in step 2

### 2. Build JSON

Build a JSON object matching this schema exactly:

```json
{
  "generated": "ISO-8601 timestamp (now)",
  "owner": "from .ddt/config.md owner field",
  "projects": {
    "active": [
      {
        "name": "project-name",
        "location": "personal or team-repo-name",
        "health": "on-track | at-risk | blocked",
        "summary": "recent progress summary from status.md (1-2 sentences)",
        "blocker": "top blocker from status.md, or null if none",
        "nextMilestone": "next milestone from status.md, or null",
        "lastUpdated": "YYYY-MM-DD of most recent status.md entry"
      }
    ],
    "completed": [
      {
        "name": "project-name",
        "location": "personal or team-repo-name",
        "completedDate": "YYYY-MM-DD"
      }
    ]
  },
  "alerts": {
    "blocked": ["names of blocked projects"],
    "atRisk": ["names of at-risk projects"],
    "stale": ["names of stale projects"],
    "unregistered": [{"name": "project-name", "repo": "team-repo-name"}]
  }
}
```

Use empty arrays `[]` for any category with no entries. Use `null` for missing optional fields.

**Important:** When serializing the JSON, replace any occurrence of `</` with `<\/` to prevent breaking the HTML script tag.

### 3. Generate HTML

1. Read the dashboard template from `.claude/dashboard/template.html`.
2. Replace the exact string `__DASHBOARD_DATA__` with the JSON from step 2.
3. Write the result to `.ddt/personal/dashboard.html`.

### 4. Serve and open

Run a background HTTP server and open the dashboard:

```bash
# Kill any previous dashboard server
if [ -f .ddt/personal/.dashboard.pid ]; then
  kill "$(cat .ddt/personal/.dashboard.pid)" 2>/dev/null || true
  rm -f .ddt/personal/.dashboard.pid .ddt/personal/.dashboard.port
fi

# Start server on a random available port
python3 -c "
import http.server, socketserver, os, sys
os.chdir('.ddt/personal')
h = http.server.SimpleHTTPRequestHandler
s = socketserver.TCPServer(('127.0.0.1', 0), h)
p = s.server_address[1]
open('.dashboard.pid','w').write(str(os.getpid()))
open('.dashboard.port','w').write(str(p))
sys.stdout.write(str(p))
sys.stdout.flush()
s.serve_forever()
" &

# Wait briefly for port file, then read it
sleep 0.3
PORT=$(cat .ddt/personal/.dashboard.port 2>/dev/null)
echo "Dashboard: http://127.0.0.1:${PORT}/dashboard.html"
```

Then open it in the default browser:

- macOS: `open "http://127.0.0.1:${PORT}/dashboard.html"`
- Linux: `xdg-open "http://127.0.0.1:${PORT}/dashboard.html"`

### 5. Confirm

Print a short confirmation:

> Dashboard is live at **http://127.0.0.1:PORT/dashboard.html**
>
> _N active projects, N completed. Server running in background (PID in `.ddt/personal/.dashboard.pid`)._

### Notes

- Omit **archived** projects unless the user explicitly asks for them.
- If there are no projects at all, still generate the dashboard — it shows an empty state.
- The dashboard is a point-in-time snapshot. Run `/dashboard` again to refresh.
