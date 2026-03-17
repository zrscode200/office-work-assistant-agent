---
description: Overview of all active projects
---

Show a dashboard of all projects.

## Instructions

1. Read `.ddt/registry.md` for all registered projects.
2. Read `.ddt/config.md`. If `team_repo` is configured, scan `<team_repo>/projects/` for directories not in the registry. Note any as "unregistered shared".
3. For each **active** project in the registry, read `status.md` and `overview.md`.
4. Present the active projects as a summary table:

| Project | Location | Health | Recent Progress | Top Blocker | Next Milestone |
|---------|----------|--------|-----------------|-------------|----------------|

   - Location is [shared] or [personal]
   - If `team_repo` is not configured, omit the Location column

5. If there are **completed** projects, show them in a separate "Recently completed" section (name, location, completion date). Keep it brief.
6. Omit **archived** projects unless the user asks for them.
7. Below the table, highlight:
   - Any projects that are **blocked** or **at-risk**
   - **Stale** projects (no artifact changes in 2+ weeks)
   - Overdue action items (check meeting notes for deadlines)
   - **Unregistered shared projects** (if any): "Found N shared projects not in your registry: [names]. Interact with them or run `/status <name>` to register."
8. Keep it scannable. This is a quick-glance view, not a deep dive.
