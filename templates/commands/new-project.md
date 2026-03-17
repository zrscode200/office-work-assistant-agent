---
description: Create a new project with scaffold
---

Create a new project in the workspace.

## Instructions

1. If a project name was provided as an argument, use it. Otherwise, ask the user for a name and brief description.
2. Convert the name to lowercase kebab-case for the folder name.
3. Read `.ddt/registry.md`. If a project with this name already exists:
   - Tell the user: "Project '<name>' already exists [location, status]. Did you mean /status?"
   - Stop.
4. Read `.ddt/config.md` for configured team repos.
   - If no team repos configured, the project is personal.
   - If one team repo configured, ask: "Should this be a **<team-name>** project or **personal** (local only)?"
   - If multiple team repos configured, ask: "Where should this project live?" and list the options: personal, plus each team repo name.
   - Accept `--personal` or `--<team-name>` as an argument to skip this question.
5. Read `.ddt/profile.md` for context about the user's role and team.
6. Determine the project root:
   - If personal: `.ddt/projects/<name>/`
   - If a team repo: look up the repo path in `.ddt/config.md`, then `<path>/projects/<name>/`
7. If in a team repo, follow the Shared Write Protocol (pull first).
8. Create the following files at the project root:

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

9. Register the project in `.ddt/registry.md`: add a row with the name, location (`personal` or the team repo name), status `active`, and today's date.
10. If in a team repo, complete the Shared Write Protocol (show changes, confirm, commit, push).
11. Report what was created, note the location (personal or team repo name), and suggest next steps (e.g., "review the overview", "run /plan to break this into tasks").
