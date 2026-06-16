---
description: View or update a project's status
---

View or update the status of a project.

## Instructions

1. Resolve the project using the Project Resolution Protocol. If no name provided, list active projects from the registry and ask.
2. Read `<project-root>/status.md` and `<project-root>/overview.md` for context.
3. If the user is providing new status information, update `status.md` using the **dual-write** approach:
   - **Update the YAML frontmatter** to reflect the current state (health, last_updated, summary, blockers, risks, next).
   - **Prepend a new dated entry** to the markdown body (don't delete old entries).
   - If the project is in a team repo, follow the Shared Write Protocol.

   The file should look like:

   ```markdown
   ---
   health: on-track
   last_updated: YYYY-MM-DD
   summary: <1-2 sentence current progress>
   blockers:
     - <current blocker — owner>
   risks:
     - <current risk — mitigation>
   next:
     - <upcoming milestone or action>
   ---

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

   ## <previous entries below...>
   ```

   The frontmatter always reflects the **current** state. The body preserves the full history.
4. If health is set to `completed`, also update `.ddt/registry.md`: set the project's status to `completed`.
5. If the user asks to reactivate an archived or completed project, update the registry status back to `active`.
6. If the user is just asking for status, summarize the current state from existing artifacts.
7. Proactively surface any blockers or overdue action items found in meeting notes or plans.
8. **Contextual todo surfacing:** Check `todo_surfacing` in `.ddt/config.md`. If `contextual` or `proactive`, query project-tagged todos:
   ```bash
   node -e "
     const fs=require('fs');
     const f='.ddt/personal/todo.json';
     if(!fs.existsSync(f))process.exit(0);
     const t=JSON.parse(fs.readFileSync(f,'utf8'));
     const p=t.items.filter(i=>i.project==='PROJECT_NAME'&&i.status!=='done');
     if(p.length)console.log(JSON.stringify(p.map(i=>({id:i.id,what:i.what,due:i.due,priority:i.priority}))));
   "
   ```
   Replace `PROJECT_NAME` with the resolved project name. If items are found, append to the status output: "You have N personal todos for this project:" with a brief list.
