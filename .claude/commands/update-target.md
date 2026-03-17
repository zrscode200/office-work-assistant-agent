---
description: Update an existing workspace with the latest templates
allowed-tools: Bash, Read, Edit, AskUserQuestion
---

Update an existing work assistant workspace with the latest system files from this repo.

## Step 1: Get target directory

If a path was provided as an argument, use it. Otherwise, ask:

"Which workspace do you want to update? Give me the path to the directory."

## Step 2: Validate

Check that the target looks like a bootstrapped workspace:
- Directory exists
- Has `.ddt/config.md` or `CLAUDE.md` at the root

If it doesn't look like a workspace:
- If the directory doesn't exist: "That directory doesn't exist. Did you mean a different path?"
- If it exists but isn't a workspace: "That doesn't look like a work assistant workspace (no `.ddt/` or `CLAUDE.md` found). Did you mean to run `/setup-new` to create a new workspace there?"

## Step 3: Show what will happen

Tell the user:

> This will update **system files** in `<path>`:
> - CLAUDE.md (agent operating manual)
> - README.md (workspace guide)
> - Skills (project-manager, think-partner)
> - Commands (new-project, status, meeting, decide, plan, dashboard, update, sync, jot, brainstorm, notebook)
> - Hooks (session-sync)
>
> Your **data and config are safe** — these are never touched:
> - .ddt/config.md, profile.md, norms.md, registry.md
> - .claude/settings.json
> - All project artifacts, notebook, and scratch pad
>
> Ready to proceed?

Wait for confirmation.

## Step 4: Run update

Run: `./bootstrap/init-workspace.sh --update <path>`

Show the full output so the user can see what was updated, created, or unchanged.

## Step 5: Report

Summarize the results:
- How many files were updated vs unchanged
- If any new files were created (happens when the workspace was missing newer features)
- Remind them: "Open Claude Code in `<path>` to use the updated workspace."

If the update output shows errors, help diagnose and fix them.

## Tone

Clear and operational. This is a maintenance task — be concise but reassuring about data safety.
