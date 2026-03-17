# office-work-assistant-agent

A portable toolkit that turns any directory into a work assistant workspace powered by Claude Code.

This is a bootstrap repository, not an application. It provides templates and a setup script that you copy into a target directory to make Claude Code behave like a work assistant — helping you document, track, plan, and think through work.

Workspace artifacts live in a `.ddt/` directory (short for **d**ocument, **d**ecide, **t**rack).

## How It Works

You bootstrap a target directory with a `CLAUDE.md` operating manual, `.ddt/` workspace structure, skills at `.claude/skills/`, and slash commands at `.claude/commands/`. When you open Claude Code in that directory, two skills auto-trigger based on what you're doing:

- **project-manager** — activates when you talk about projects, meetings, decisions, status, or planning
- **think-partner** — activates when you're exploring ideas, brainstorming, or capturing quick thoughts

The assistant helps with:
- **Document** — meeting summaries, decision records, project context
- **Track** — project status, blockers, risks, action items
- **Plan** — task breakdowns, milestones, dependencies
- **Think** — capture ideas to a scratch pad, brainstorm interactively, develop thoughts into notebook entries over time

## What You'll Need

**Prerequisites:** git, a POSIX shell (sh/bash/zsh), and [Claude Code](https://docs.anthropic.com/en/docs/claude-code)

**Repos involved:**

| Repo | Purpose | Required? |
|------|---------|-----------|
| **This repo** (office-work-assistant-agent) | Source of templates. Clone it, run the bootstrap script, done. You only need it again to pull updates. | Yes |
| **Your workspace** | The directory you bootstrap. This is where you open Claude Code and do your work. Git-initialized by the script if it isn't already. | Yes |
| **Team repo(s)** | A plain git repo with a `projects/` folder. Multiple people point their workspaces at it for shared project artifacts. You can configure multiple — one per team. | Only for team collaboration |

After bootstrapping, your workspace has no dependency on this repo — all templates are copied into the target directory.

## Quick Setup

```sh
# 1. Clone this repo (one-time)
git clone <this-repo-url> office-work-assistant-agent

# 2. Bootstrap your workspace
./office-work-assistant-agent/bootstrap/init-workspace.sh /path/to/your-workspace

# 3. Open Claude Code in the workspace
cd /path/to/your-workspace
claude
```

To update an existing workspace with latest templates (preserves your data):

```sh
./office-work-assistant-agent/bootstrap/init-workspace.sh --update /path/to/your-workspace
```

This stamps the target directory with:
- `README.md` — workspace guide (structure, commands, conventions)
- `CLAUDE.md` — agent operating manual
- `.ddt/config.md` — workspace settings, autonomy mode, and team repo config
- `.ddt/profile.md` — your profile (role, team, context)
- `.ddt/norms.md` — team working principles
- `.ddt/registry.md` — project registry (tracks all known projects)
- `.ddt/projects/` — where personal project artifacts live
- `.ddt/personal/notebook/` — private notebook for ideas and brainstorms (gitignored)
- `.ddt/personal/scratch/` — private scratch space (gitignored)
- `.claude/skills/` — auto-triggering skills (project-manager, think-partner)
- `.claude/commands/` — slash commands for common operations
- `.claude/hooks/` — session-start hook that auto-syncs team repos
- `.claude/settings.json` — hook configuration

Then fill in `.ddt/profile.md` with your info and open Claude Code.

## Team Collaboration

Projects can be **personal** (local only) or **team** (stored in a team git repo). You can configure multiple team repos — one per team.

To add a team repo:

1. Clone the team's shared repo: `git clone <team-repo-url> /path/to/team-shared`
2. Add it to the Team Repos section in `.ddt/config.md`:
   ```
   team-name: /path/to/team-shared
   ```

Once configured:
- `/new-project` asks where a project should live (personal or which team)
- The agent reads from team repos for context (always live)
- When writing to team projects, the agent pulls first, writes, then asks you to confirm before committing and pushing
- `/sync` gives you manual control over pull/push/commit for each repo
- `/dashboard` shows projects from all locations
- Personal artifacts (notebook, scratch) never go to a team repo

Each team repo is a plain git data repo — just a `projects/` folder, no agent config needed.

## Autonomy Modes

Set in `.ddt/config.md`:

- **supervised** — pauses before creating/modifying artifacts, asks for confirmation
- **gated** (default) — works autonomously on artifact creation, pauses for cross-project changes or deletions
- **autonomous** — runs freely, pauses only for ambiguity

Note: writing to a team repo always requires user confirmation, regardless of autonomy mode.

## Slash Commands

### Project Management

| Command | Description |
|---------|-------------|
| `/new-project` | Scaffold a new project (personal or team) |
| `/status` | View or update a project's status |
| `/meeting` | Capture a meeting summary |
| `/decide` | Create a structured decision record |
| `/plan` | Create or update a project plan (collaborative, not auto-generated) |
| `/dashboard` | Overview of all active projects across all locations |
| `/update` | Draft a status update or report for stakeholders |
| `/sync` | Sync team repos — pull, commit, push |

### Notebook & Thinking

| Command | Description |
|---------|-------------|
| `/jot` | Quick-capture a thought to the scratch pad |
| `/brainstorm` | Think through an idea interactively |
| `/notebook` | Browse scratch pad and notebook, promote entries, manage thinking |

## Workspace Structure

After bootstrapping, your workspace looks like:

```
your-workspace/
  README.md                              # workspace guide (structure, commands, conventions)
  CLAUDE.md                              # agent operating manual
  .ddt/
    config.md                            # workspace settings (autonomy mode, team repos)
    profile.md                           # your role, team, context
    norms.md                             # team working principles
    registry.md                          # project registry (tracks all projects)
    projects/                            # personal projects (local only)
      <project-name>/
        overview.md                      # scope, goals, stakeholders
        status.md                        # health, blockers, risks
        plan.md                          # tasks, milestones, timeline
        decisions/
          <decision-name>.md             # decision records
        meetings/
          YYYY-MM-DD-<topic>.md          # meeting summaries
        updates/
          YYYY-MM-DD.md                  # status updates / reports
    personal/
      scratch/                           # quick-capture scratch pad (gitignored)
        .index.md                        # manifest tracking entries and promotion status
        YYYY-MM-DD-HHMM-<slug>.md       # sticky notes
      notebook/                          # developed ideas and brainstorms (gitignored)
        YYYY-MM-DD-<slug>.md             # notebook entries
  .claude/
    skills/
      project-manager/SKILL.md           # PM skill (routes to project commands)
      think-partner/SKILL.md              # thinking partner skill
    commands/
      new-project.md, status.md, meeting.md, decide.md,
      plan.md, dashboard.md, update.md, sync.md,
      jot.md, brainstorm.md, notebook.md
    hooks/
      session-sync.sh                     # auto-syncs team repos on session start
    settings.json                          # hook configuration

# For each team repo configured in .ddt/config.md:
/path/to/team-shared/                    # separate git repo, cloned locally
  projects/                              # team projects (visible to that team)
    <project-name>/
      overview.md, status.md, plan.md
      decisions/, meetings/, updates/
```

## Repository Contents

```
office-work-assistant-agent/
  README.md
  bootstrap/
    init-workspace.sh                    # one-command setup script (supports --update)
  templates/
    README.md                            # workspace guide template
    CLAUDE.md                            # agent operating manual template
    config.md                            # workspace config template
    profile.md                           # user profile template
    norms.md                             # team norms template
    registry.md                          # project registry template
    gitignore                            # workspace .gitignore entries
    skills/
      project-manager/
        SKILL.md                         # project manager skill
      think-partner/
        SKILL.md                         # thinking partner skill
    commands/
      new-project.md, status.md, meeting.md, decide.md,
      plan.md, dashboard.md, update.md, sync.md,
      jot.md, brainstorm.md, notebook.md
    hooks/
      session-sync.sh                     # auto-syncs team repos on session start
    settings.json                          # Claude Code hook configuration
```

## Design Principles

- **Natural language first** — describe what you need, the skills handle routing
- **Artifact-driven** — meeting notes, decisions, and status are saved to files, not lost in chat
- **Project-centric** — all project artifacts hang off projects, keeping context together
- **Thinking-friendly** — ideas don't need to be structured to be captured; they can mature over time
- **Team-aware** — shared projects live in a team repo; personal work stays local
- **Audience-aware** — reads your profile to calibrate responses to your role
- **Non-destructive** — status history is appended, decision records are never overwritten, notebook entries are preserved
- **Convention over configuration** — sensible defaults, customize when needed
