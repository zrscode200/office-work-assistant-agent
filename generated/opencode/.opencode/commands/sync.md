---
description: Sync team repos — pull changes, review pending work, push commits
---

Manage synchronization with team repos.

## Instructions

### 1. Check configuration

Read `.ddt/config.md` for configured team repos. If none are configured, tell the user:
"No team repos configured. Add repos to the Team Repos section in `.ddt/config.md`."

### 2. Determine which repo

- If a team repo name was provided as an argument, use it.
- If only one team repo is configured, use it.
- If multiple are configured and no name given:
  - For status (no sub-command): show a brief summary for each repo.
  - For pull/push/commit: ask which repo, or accept `--all` to operate on all.

### 3. If no sub-command — show sync status

For each targeted repo, run these checks:

- `git -C <repo-path> status` — are there uncommitted changes?
- `git -C <repo-path> fetch` then compare local vs remote — are there unpushed commits? Are there remote changes to pull?

Present a summary per repo:
- **Repo:** `<team-name>` (`<repo-path>`)
- **Branch:** current branch
- **Uncommitted changes:** none / list of changed files
- **Unpushed commits:** none / N commits (list summaries)
- **Remote changes available:** none / N commits to pull

### 4. If the user says "pull"

- Run `git -C <repo-path> pull`
- Report what came in: number of commits, files changed
- If conflicts arise, list the conflicted files and advise the user to resolve them manually in the repo directory
- With `--all`: pull each repo in sequence, report results per repo. Stop and report if any repo has conflicts.

### 5. If the user says "push"

- First check for uncommitted changes — if any, ask whether to commit them first
- Show unpushed commits
- Ask for confirmation: "Ready to push N commits to <team-name>. Proceed?"
- On confirmation: run `git -C <repo-path> push`
- If push fails (remote has new changes), run `git -C <repo-path> pull --rebase` and retry once. If that fails, notify the user.
- Report success or failure
- With `--all`: confirm once for all repos, then push each in sequence. Report results per repo.

### 6. If the user says "commit"

- Show `git -C <repo-path> diff` and `git -C <repo-path> status`
- Suggest a commit message based on the changed files (e.g., "Update status: project-x, Add meeting: project-y")
- Ask the user to confirm or edit the message
- Run `git -C <repo-path> add <changed files>` and `git -C <repo-path> commit -m "<message>"`
- Report what was committed
- With `--all`: show pending changes per repo, suggest a message for each, confirm all at once.

## Tone

Operational and clear. This is a git workflow — be precise about what's happening.
