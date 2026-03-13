---
description: Sync the shared team repo — pull changes, review pending work, push commits
---

Manage synchronization with the shared team repo.

## Instructions

### 1. Check configuration

Read `.ddt/config.md` and look for the `team_repo` field. If not set or blank, tell the user:
"No shared team repo is configured. Set `team_repo: /path/to/clone` in `.ddt/config.md` to enable team collaboration."

### 2. If no arguments — show sync status

Run these checks on the team repo at `<team_repo>`:

- `git -C <team_repo> status` — are there uncommitted changes?
- `git -C <team_repo> fetch` then compare local vs remote — are there unpushed commits? Are there remote changes to pull?

Present a summary:
- **Repo path:** `<team_repo>`
- **Branch:** current branch
- **Uncommitted changes:** none / list of changed files
- **Unpushed commits:** none / N commits (list summaries)
- **Remote changes available:** none / N commits to pull

### 3. If the user says "pull"

- Run `git -C <team_repo> pull`
- Report what came in: number of commits, files changed
- If conflicts arise, list the conflicted files and advise the user to resolve them manually in the shared repo directory

### 4. If the user says "push"

- First check for uncommitted changes — if any, ask whether to commit them first
- Show unpushed commits
- Ask for confirmation: "Ready to push N commits to the shared repo. Proceed?"
- On confirmation: run `git -C <team_repo> push`
- If push fails (remote has new changes), run `git -C <team_repo> pull --rebase` and retry once. If that fails, notify the user.
- Report success or failure

### 5. If the user says "commit"

- Show `git -C <team_repo> diff` and `git -C <team_repo> status`
- Suggest a commit message based on the changed files (e.g., "Update status: project-x, Add meeting: project-y")
- Ask the user to confirm or edit the message
- Run `git -C <team_repo> add <changed files>` and `git -C <team_repo> commit -m "<message>"`
- Report what was committed

## Tone

Operational and clear. This is a git workflow — be precise about what's happening.
