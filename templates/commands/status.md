---
description: View or update a project's status
---

View or update the status of a project.

## Instructions

1. Resolve the project using the Project Resolution Protocol. If no name provided, list active projects from the registry and ask.
2. Read `<project-root>/status.md` and `<project-root>/overview.md` for context.
3. If the user is providing new status information, update `status.md`:
   - Add a new dated entry at the top (don't delete old entries)
   - If the project is in a team repo, follow the Shared Write Protocol.
   - Each entry follows this format:

   ```markdown
   ## YYYY-MM-DD

   **Health:** on-track / at-risk / blocked / completed

   **Progress:**
   - What happened since last update

   **Blockers:**
   - Blocker description — owner

   **Risks:**
   - Risk description — mitigation

   **Next:**
   - Upcoming milestones or actions
   ```
4. If health is set to `completed`, also update `.ddt/registry.md`: set the project's status to `completed`.
5. If the user asks to reactivate an archived or completed project, update the registry status back to `active`.
6. If the user is just asking for status, summarize the current state from existing artifacts.
7. Proactively surface any blockers or overdue action items found in meeting notes or plans.
