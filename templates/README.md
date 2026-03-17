# Work Assistant Workspace

This directory is a Claude Code workspace for documenting, tracking, planning, and thinking through work. Open Claude Code here and talk naturally — the assistant handles routing to the right workflow.

## Getting Started

1. Fill in `.ddt/profile.md` with your role, team, and context
2. Review `.ddt/config.md` to set your name and autonomy mode
3. Optionally customize `.ddt/norms.md` with your team's working principles
4. Open Claude Code in this directory: `claude`

Two skills auto-trigger based on what you're doing:

- **project-manager** — activates when you talk about projects, meetings, decisions, status, or planning
- **think-partner** — activates when you're exploring ideas, brainstorming, or capturing quick thoughts

You don't need to invoke skills directly. Describe what you need and the assistant routes to the right one.

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

```
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
      YYYY-MM-DD-<slug>.md            # notebook entries

.claude/
  skills/                              # auto-triggering skills (managed by bootstrap)
    project-manager/SKILL.md
    think-partner/SKILL.md
  commands/                            # slash commands (managed by bootstrap)
    new-project.md, status.md, meeting.md, decide.md,
    plan.md, dashboard.md, update.md, sync.md,
    jot.md, brainstorm.md, notebook.md
  hooks/
    session-sync.sh                    # auto-syncs team repos on session start
  settings.json                        # hook configuration
```

### What's gitignored

Personal scratch pad and notebook entries are gitignored by default. They never leave your machine, even if you use team collaboration.

## Autonomy Modes

Set `mode` in `.ddt/config.md`:

- **supervised** — pauses before creating/modifying artifacts, asks for confirmation
- **gated** (default) — works autonomously on artifact creation, pauses for cross-project changes or deletions
- **autonomous** — runs freely, pauses only for ambiguity

Writing to a team repo always requires confirmation, regardless of mode.

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
- The assistant reads from team repos for context (always live)
- When writing to team projects, the assistant pulls first, writes, then asks you to confirm before committing and pushing
- `/sync` gives you manual control over pull/push/commit for each repo
- `/dashboard` shows projects from all locations
- Personal artifacts (notebook, scratch) never go to a team repo

Each team repo is a plain git data repo — just a `projects/` folder, no agent config needed.

## Conventions

- **Project registry:** `.ddt/registry.md` tracks all known projects (personal and team)
- **Project folders:** lowercase kebab-case (`cloud-migration`, `q2-budget`)
- **Meeting files:** `YYYY-MM-DD-<topic>.md` (e.g., `2026-03-12-kickoff.md`)
- **Decision files:** descriptive kebab-case (e.g., `vendor-selection.md`)
- **Status updates:** `YYYY-MM-DD.md`
- **Notebook entries:** `YYYY-MM-DD-<slug>.md` (e.g., `2026-03-13-api-vendor-options.md`)
- **Scratch pad entries:** `YYYY-MM-DD-HHMM-<slug>.md` (e.g., `2026-03-16-1430-api-vendor-options.md`)

## Updating

To pull the latest templates from the toolkit repo (preserves your data and config):

```sh
/path/to/office-work-assistant-agent/bootstrap/init-workspace.sh --update .
```

This refreshes system files (CLAUDE.md, skills, commands, hooks, this README) without touching user files (config, profile, norms, registry, settings.json, projects, scratch pad).
