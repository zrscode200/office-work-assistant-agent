---
description: Set up a new work assistant workspace — guided step by step
---

Guide the user through creating and configuring a new work assistant workspace. Be friendly and patient — the user may be new to Claude Code.

## Step 1: Welcome and prerequisites

Tell the user:

> This will set up a new work assistant workspace. I'll walk you through each step.
>
> **What you'll need:**
> - **git** — for version control
> - **A directory** for your workspace (I'll help you pick one)
> - **Team repo URL(s)** (optional) — if your team uses shared repos for project collaboration

Check prerequisites by running:
- `which git` — if missing, explain how to install git for their platform (check `uname`)

## Step 2: Choose workspace location

Ask: "Where would you like your workspace? Give me a path, or I can suggest one."

Suggestions if they're unsure:
- `~/work-assistant`
- `~/workspace`
- A subdirectory of wherever they keep projects

Validate:
- If the path exists and already has `.ddt/` or `CLAUDE.md`, tell them it looks like an existing workspace and suggest `/update-target` instead.
- If the path exists and is non-empty, warn them and confirm they want to bootstrap into it.
- If the path doesn't exist, offer to create it: `mkdir -p <path>`

## Step 3: Run bootstrap

Run: `./bootstrap/init-workspace.sh <path>`

Show the output. If it fails, help diagnose (missing directory, permission issues, etc.).

## Step 4: Configure profile

Tell the user: "Let's fill in your profile so the assistant knows how to help you."

Walk through each field conversationally — don't dump all questions at once. Ask one or two at a time:

1. "What's your name?"
2. "What's your role? (e.g., engineering manager, product designer, project lead)"
3. "What team are you on?"
4. "What organization? (company or division — optional, skip if you prefer)"
5. "Who's your manager? (optional)"
6. "What are your main responsibilities? Give me a few bullet points."
7. "What are you focused on right now? Any key projects or initiatives?"
8. "Any key stakeholders I should know about? (people you work with regularly)"
9. "Anything else about how you work — communication style, recurring meetings, team dynamics? (optional)"

After gathering answers, write them into `<workspace>/.ddt/profile.md`. Show the user the result.

## Step 5: Configure workspace settings

Ask: "What's your preference for how autonomous the assistant should be?"

Explain the three modes simply:
- **Supervised** — "I'll ask before creating or changing anything. Good if you want full control."
- **Gated** (default) — "I'll work freely on creating artifacts but pause before making cross-project changes or deletions. Good balance for most people."
- **Autonomous** — "I'll work freely and only pause when something is genuinely ambiguous. Good if you trust the workflow and want speed."

Update `<workspace>/.ddt/config.md` with their name (owner field) and chosen mode. Set created date to today.

## Step 6: Team repos (optional)

Ask: "Do you work with any teams that have shared git repos for project collaboration? (If not, skip this — you can always add team repos later.)"

If yes, for each team repo:
1. Ask for the team name (e.g., "design-team", "platform")
2. Ask if they've already cloned it locally. If not, ask for the clone URL and help them clone it:
   - Suggest a path: `~/repos/<team-name>`
   - Run: `git clone <url> <path>`
3. Verify the repo has a `projects/` directory. If not, offer to create one:
   - `mkdir -p <path>/projects`
   - `git -C <path> add projects/.gitkeep && git -C <path> commit -m "Add projects directory" && git -C <path> push`
4. Add the entry to `<workspace>/.ddt/config.md` under Team Repos: `<team-name>: <path>`
5. Ask: "Any more team repos?"

## Step 7: Review team norms (optional)

Tell the user: "Your workspace has default team norms in `.ddt/norms.md` — principles like 'decisions are documented' and 'action items have owners.' Want to review or customize them now, or skip and do it later?"

If they want to customize, read the current norms, discuss with the user, and update.

## Step 8: Summary

Show a summary:

> **Workspace ready!**
>
> - **Location:** `<path>`
> - **Profile:** <name>, <role> on <team>
> - **Mode:** <mode>
> - **Team repos:** <list or "none (all projects are personal)">
>
> **To start using it:**
> ```
> cd <path>
> claude
> ```
>
> **Try saying:**
> - "new project: <something>" to create your first project
> - "what can you help me with?" for an overview
> - Any of these commands: /new-project, /status, /meeting, /decide, /plan, /dashboard, /update, /sync, /jot, /brainstorm, /notebook

## Tone

Friendly, patient, and encouraging. Avoid jargon where possible. Explain "why" briefly when configuring things ("This helps the assistant tailor its responses to your role"). Don't rush — let the user drive the pace.
