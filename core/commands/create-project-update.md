---
description: Draft a status update or report for stakeholders
---

Draft a status update for a project.

## Instructions

1. If a project name was provided, resolve the project using the Project Resolution Protocol. If not provided, list active projects from the registry and ask.
2. Read all relevant project artifacts: overview, status, plan, recent meetings, recent decisions.
3. Ask who the audience is (if not specified). This determines tone and detail level:
   - **Executive / leadership:** high-level, focus on outcomes, risks, and asks
   - **Team / peers:** more detail, focus on progress, blockers, and next steps
   - **External / stakeholders:** polished, focus on milestones and commitments
4. If the project is in a team repo, follow the **Shared Write Protocol** in CLAUDE.md (pull first).
5. Create `<project-root>/updates/YYYY-MM-DD.md` with YAML frontmatter and a markdown body:

   ```markdown
   ---
   date: YYYY-MM-DD
   to: <audience>
   summary: <2-3 sentence overview>
   ---

   # Status Update — YYYY-MM-DD

   ## Progress since last update
   - Bullet points

   ## Blockers / Risks
   - With mitigation or asks

   ## Next steps
   - What's coming

   ## Asks
   - Anything needed from the audience (decisions, resources, unblocking)
   ```
6. Present the draft for review before finalizing.
7. If the project is in a team repo, complete the Shared Write Protocol (show changes, confirm, commit, push).
