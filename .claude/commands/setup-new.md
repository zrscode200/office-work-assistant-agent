---
description: Set up a new work assistant workspace — guided step by step
---

Guide the user through creating and configuring a new work assistant workspace. Be friendly and patient — the user may be new to Claude Code.

## Important: How to ask questions
- **For workspace location (at step 2):** Ask directly as a free-text question. Only present one assumed options - `~/work-assistant-agent` otherwise, Just ask and let them type.
- **For personal info (name, role, team, responsibilities, etc.):** Ask directly as a free-text question. Do NOT present assumed options — you don't know the user's name, role, or team. Just ask and let them type.
- **For known choices (autonomy mode, yes/no):** Present the actual options.
- **Always include "Skip for now" where the field is optional.** The user can fill in details later by editing the files directly.
- **Never add a "let me type" / "type something different" / "I'll enter my own" option.** The option selection UI already has a built-in text input at the bottom ("Type something"). Adding an explicit option for this is redundant. Only present real, meaningful options.

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

Ask where they want their workspace. Present one default option: `~/work-assistant-agent`. No other path suggestions — if the user wants a different location, they can type it.

Validate:
- If the path exists and already has `.ddt/` or `CLAUDE.md`, tell them it looks like an existing workspace and suggest `/update-target` instead.
- If the path exists and is non-empty, warn them and confirm they want to bootstrap into it.
- If the path doesn't exist, offer to create it: `mkdir -p <path>`

## Step 3: Run bootstrap

Run: `./bootstrap/init-workspace.sh <path>`

Show the output. If it fails, help diagnose (missing directory, permission issues, etc.).

## Step 4: Configure profile

Tell the user: "Let's fill in your profile so the assistant knows how to help you. This helps it tailor responses to your role."

Ask these as direct free-text questions — no option menus. Group naturally:

1. "What's your name?"
2. "What's your role and team?" (e.g., "engineering manager on the platform team")
3. "What are your main responsibilities? A few bullet points is fine."
4. "Anything else that helps the assistant understand how you work — what you care about, your communication style, recurring meetings, team dynamics, or anything else relevant. No format required."

After gathering answers, write them into `<workspace>/.ddt/profile.md`. Show the user the result.

## Step 5: Team norms (optional)

Tell the user: "You can set team norms — working principles the assistant will follow when creating artifacts. Things like preferred meeting note format, how decisions should be documented, communication style, or any team conventions."

Ask: "Any team norms or working principles to add? You can always edit `.ddt/norms.md` later."

If the user provides norms, write them into `<workspace>/.ddt/norms.md`. Show the user the result.

## Step 6: Configure workspace settings

Explain the three autonomy modes simply, then present them as options:

- **Supervised** — "Asks before creating or changing anything. Full control."
- **Gated** (default) — "Works freely on artifacts, pauses for cross-project changes. Good balance."
- **Autonomous** — "Works freely, only pauses when genuinely ambiguous. Fast."

This is a real choice with known options — present as options.

Update `<workspace>/.ddt/config.md` with their name (owner field), chosen mode, and today's date.

## Step 7: Team repos (optional)

Ask: "Do you work with any teams that have shared git repos for project collaboration? You can always add these later."

Present as options: "Yes, I have team repos to add" / "No, skip for now"

If yes, for each team repo:
1. Ask for the team name (free text — e.g., "design-team", "platform")
2. Ask if they've already cloned it locally, or need to clone it:
   - If not cloned: ask for the clone URL, suggest a path like `~/repos/<team-name>`, clone it
3. Verify the repo has a `projects/` directory. If not, offer to create one and push it.
4. Add the entry to `<workspace>/.ddt/config.md` under Team Repos
5. Ask: "Any more team repos to add?" — options: "Yes, add another" / "No, that's all"

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
>
> You can always refine your profile, norms, and config later by editing the files in `.ddt/`.

## Tone

Friendly, patient, and encouraging. Avoid jargon where possible. Explain "why" briefly when configuring things. Don't rush — let the user drive the pace.
