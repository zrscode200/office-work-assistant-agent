---
description: Create a new project with scaffold
---

Create a new project in the workspace.

## Instructions

1. If a project name was provided as an argument, use it. Otherwise, ask the user for a name and brief description.
2. Convert the name to lowercase kebab-case for the folder name.
3. Read `.ddt/config.md`. If `team_repo` is configured, ask: "Should this be a **shared** project (visible to the team) or **personal** (local only)?" Accept `--shared` or `--personal` as an argument to skip this question. If `team_repo` is not configured, all projects are personal.
4. Read `.ddt/profile.md` for context about the user's role and team.
5. Determine the project root:
   - If personal: `.ddt/projects/<name>/`
   - If shared: `<team_repo>/projects/<name>/`
6. If shared, follow the **Shared Repo Write Flow** in CLAUDE.md (pull first before writing).
7. Create the following files at the project root:

**`<project-root>/overview.md`** with:
- Objective (one sentence)
- Business context (why this matters)
- Stakeholders (who cares about this)
- Approach (high-level strategy, if known)
- Scope: what's in, what's explicitly out
- Fill in what you know, mark unknowns with `[TBD]`

**`<project-root>/status.md`** with:
- Health: not-started
- Created date
- Empty blockers and risks sections

8. If shared, complete the Shared Repo Write Flow (show changes, confirm, commit, push).
9. Report what was created, note whether it's shared or personal, and suggest next steps (e.g., "fill in the overview", "run /plan to break this into tasks").
