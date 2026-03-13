---
description: View or update a project's status
---

View or update the status of a project.

## Instructions

1. If a project name was provided, use it. If not, list available projects from `.ddt/projects/` and ask which one.
2. Read `.ddt/projects/<project>/status.md` and `.ddt/projects/<project>/overview.md` for context.
3. If the user is providing new status information, update `status.md`:
   - Add a new dated entry at the top (don't delete old entries)
   - Update the health indicator (on-track / at-risk / blocked / completed)
   - Update blockers, risks, and recent progress
4. If the user is just asking for status, summarize the current state from existing artifacts.
5. Proactively surface any blockers or overdue action items found in meeting notes or plans.
