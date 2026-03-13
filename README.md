# office-work-assistant-agent

A portable toolkit that turns any directory into a project management workspace powered by Claude Code.

This is a bootstrap repository, not an application. It provides templates and a setup script that you copy into a target directory to make Claude Code behave like a project management assistant — helping you document, track, and plan work.

## How It Works

You bootstrap a target directory with a `CLAUDE.md` operating manual, `.ddt/` workspace structure, a project manager skill at `.claude/skills/project-manager/`, and slash commands at `.claude/commands/`. When you open Claude Code in that directory and talk about projects, meetings, decisions, or planning, the skill auto-triggers and follows structured workflows.

The assistant helps with:
- **Document** — meeting summaries, decision records, project context
- **Track** — project status, blockers, risks, action items
- **Plan** — task breakdowns, milestones, dependencies

## Quick Setup

```sh
./bootstrap/init-workspace.sh /path/to/your-workspace
```

This stamps the target directory with:
- `CLAUDE.md` — agent operating manual (project management assistant)
- `.ddt/config.md` — workspace settings and autonomy mode
- `.ddt/profile.md` — your profile (role, team, context)
- `.ddt/norms.md` — team working principles
- `.ddt/projects/` — where project artifacts live
- `.ddt/personal/scratch/` — private scratch space (gitignored)
- `.claude/skills/project-manager/` — auto-triggering PM workflow skill
- `.claude/commands/` — slash commands for common operations

Then fill in `.ddt/profile.md` with your info and open Claude Code.

## Autonomy Modes

Set in `.ddt/config.md`:

- **supervised** — pauses before creating/modifying artifacts, asks for confirmation
- **gated** (default) — works autonomously on artifact creation, pauses for cross-project changes or deletions
- **autonomous** — runs freely, pauses only for ambiguity

## Slash Commands

| Command | Description |
|---------|-------------|
| `/new-project` | Scaffold a new project with overview and status files |
| `/status` | View or update a project's status |
| `/meeting` | Capture a meeting summary |
| `/decide` | Create a structured decision record |
| `/plan` | Create or update a project plan with tasks and milestones |
| `/dashboard` | Overview of all active projects |
| `/update` | Draft a status update or report for stakeholders |

## Workspace Structure

After bootstrapping, your workspace looks like:

```
your-workspace/
  CLAUDE.md                              # agent operating manual
  .ddt/
    config.md                            # workspace settings
    profile.md                           # your role, team, context
    norms.md                             # team working principles
    projects/
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
      scratch/                           # private thinking space (gitignored)
  .claude/
    skills/
      project-manager/SKILL.md           # auto-triggering PM skill
    commands/
      new-project.md                     # /new-project
      status.md                          # /status
      meeting.md                         # /meeting
      decide.md                          # /decide
      plan.md                            # /plan
      dashboard.md                       # /dashboard
      update.md                          # /update
```

## Repository Contents

```
office-work-assistant-agent/
  README.md
  bootstrap/
    init-workspace.sh                    # one-command setup script
  templates/
    CLAUDE.md                            # agent operating manual template
    config.md                            # workspace config template
    profile.md                           # user profile template
    norms.md                             # team norms template
    gitignore                            # workspace .gitignore entries
    skills/
      project-manager/
        SKILL.md                         # project manager skill
    commands/
      new-project.md
      status.md
      meeting.md
      decide.md
      plan.md
      dashboard.md
      update.md
```

## Design Principles

- **Natural language first** — describe what you need, the skill handles routing
- **Artifact-driven** — meeting notes, decisions, and status are saved to files, not lost in chat
- **Project-centric** — all artifacts hang off projects, keeping context together
- **Audience-aware** — reads your profile to calibrate responses to your role
- **Non-destructive** — status history is appended, decision records are never overwritten
- **Convention over configuration** — sensible defaults, customize when needed
