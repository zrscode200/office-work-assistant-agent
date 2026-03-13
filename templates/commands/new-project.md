---
description: Create a new project with scaffold
---

Create a new project in the workspace.

## Instructions

1. If a project name was provided as an argument, use it. Otherwise, ask the user for a name and brief description.
2. Convert the name to lowercase kebab-case for the folder name.
3. Read `.ddt/profile.md` for context about the user's role and team.
4. Create the following files:

**`.ddt/projects/<name>/overview.md`** with:
- Objective (one sentence)
- Business context (why this matters)
- Stakeholders (who cares about this)
- Approach (high-level strategy, if known)
- Scope: what's in, what's explicitly out
- Fill in what you know, mark unknowns with `[TBD]`

**`.ddt/projects/<name>/status.md`** with:
- Health: not-started
- Created date
- Empty blockers and risks sections

5. Report what was created and suggest next steps (e.g., "fill in the overview", "run /plan to break this into tasks").
