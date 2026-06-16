# office-work-assistant-agent

A portable bootstrap toolkit that turns any directory into a work assistant
workspace for Claude Code, Codex, or OpenCode.

This is a bootstrap repository, not an application. It provides shared sources,
runtime adapters, checked-in generated outputs, and a setup script that copies a
selected generated runtime surface into a target directory. The stamped
workspace helps you document, track, plan, and think through work.

Workspace artifacts live in a `.ddt/` directory: document, decide, track.

## Supported Runtimes

| Runtime | Install flag | Generated output | Primary surfaces |
|---------|--------------|------------------|------------------|
| Claude Code | default or `--runtime claude` | `generated/claude` | `CLAUDE.md`, `.claude/commands`, `.claude/skills`, `.claude/hooks`, `.claude/dashboard`, `.claude/settings.json` |
| Codex | `--runtime codex` | `generated/codex` | `AGENTS.md`, `.codex/config.toml`, `.codex/skills`, command references, `.codex/dashboard` |
| OpenCode | `--runtime opencode` | `generated/opencode` | `AGENTS.md`, `opencode.json`, `.opencode/commands`, `.opencode/skills`, `.opencode/dashboard` |

If `--runtime` is omitted, the installer uses Claude Code for backward
compatibility.

GitHub Copilot is not currently supported. The planning note in
`docs/github-copilot-conversion-plan.md` records prior thinking, but Copilot
implementation remains deferred until current official docs are checked and the
scope is explicitly reopened.

## How It Works

Canonical behavior lives under `core/`, with runtime-specific files under
`adapters/`. `scripts/render_templates.py` renders those sources into checked-in
runtime directories under `generated/`. `bootstrap/init-workspace.sh` installs
from the selected generated directory into a target workspace.

The shared `.ddt/` workspace model is runtime-neutral. Runtime adapters provide
the native instruction, command, skill, config, hook, and dashboard surfaces for
each harness.

The assistant helps with:

- **Document** - meeting summaries, decision records, project context.
- **Track** - project status, blockers, risks, action items.
- **Plan** - task breakdowns, milestones, dependencies.
- **Think** - scratch-pad capture, brainstorming, and notebook development.
- **Todo** - personal action-item management.

## What You'll Need

Prerequisites:

- `git`
- a POSIX shell such as `sh`, `bash`, or `zsh`
- `node` for the local dashboard checks and dashboard server
- at least one target runtime: Claude Code, Codex, or OpenCode

Repos involved:

| Repo | Purpose | Required? |
|------|---------|-----------|
| This repo | Source of generated workspace outputs. Clone it, run the bootstrap script, and later pull updates from it. | Yes |
| Your workspace | The directory you bootstrap and open with the selected runtime. The script initializes git if needed. | Yes |
| Team repo(s) | Plain git repos with `projects/` folders for shared project artifacts. | Only for team collaboration |

After bootstrapping, your workspace has no runtime dependency on this repo.
Generated files are copied into the target directory.

## Quick Setup

```sh
# 1. Clone this repo one time.
git clone <this-repo-url> office-work-assistant-agent

# 2. Bootstrap your workspace. Defaults to Claude Code.
./office-work-assistant-agent/bootstrap/init-workspace.sh /path/to/your-workspace

# Or choose a runtime explicitly.
./office-work-assistant-agent/bootstrap/init-workspace.sh --runtime codex /path/to/your-workspace
./office-work-assistant-agent/bootstrap/init-workspace.sh --runtime opencode /path/to/your-workspace

# 3. Open the selected runtime in the workspace.
cd /path/to/your-workspace
```

Open Claude Code, Codex, or OpenCode from the target workspace directory,
matching the runtime you installed.

To update an existing workspace while preserving user data:

```sh
./office-work-assistant-agent/bootstrap/init-workspace.sh --update --runtime codex /path/to/your-workspace
```

Use the same runtime that was installed in that workspace. On update, the
installer refreshes managed generated files and preserves user-owned files:

- `.ddt/config.md`
- `.ddt/profile.md`
- `.ddt/norms.md`
- `.ddt/registry.md`
- `.ddt/projects/`
- `.ddt/personal/todo.json`
- `.ddt/personal/scratch/.index.md`
- `.ddt/personal` placeholders
- `.claude/settings.json`
- `.codex/config.toml`
- `opencode.json`

## Installed Files

Every runtime installs shared workspace files:

- `README.md` - workspace guide
- `.gitignore` - ignores personal scratch/notebook content
- `.ddt/config.md` - workspace settings, autonomy mode, team repo config
- `.ddt/profile.md` - user profile template
- `.ddt/norms.md` - team working principles
- `.ddt/registry.md` - project registry
- `.ddt/projects/` - personal project artifacts
- `.ddt/personal/notebook/` - private notebook
- `.ddt/personal/scratch/` - private scratch pad
- `.ddt/personal/todo.json` - personal todo list

Runtime-specific files:

| Runtime | Installed files |
|---------|-----------------|
| Claude Code | `CLAUDE.md`, `.claude/commands/`, `.claude/skills/`, `.claude/hooks/session-sync.sh`, `.claude/dashboard/`, `.claude/settings.json` |
| Codex | `AGENTS.md`, `.codex/config.toml`, `.codex/skills/`, command reference files under skills, `.codex/dashboard/` |
| OpenCode | `AGENTS.md`, `opencode.json`, `.opencode/commands/`, `.opencode/skills/`, `.opencode/dashboard/` |

## Team Collaboration

Projects can be personal or team-scoped. Personal project artifacts live under
the workspace `.ddt/projects/` directory. Team projects live in configured team
repos under their `projects/` folders.

To add a team repo:

1. Clone the team's shared repo.
2. Add it to the Team Repos section in `.ddt/config.md`.
3. Use the work assistant normally; project resolution uses `.ddt/registry.md`.

When writing team artifacts, the assistant must pull first, write, show the
change, and ask before committing or pushing. Personal artifacts do not use that
git ceremony.

Scratch pad entries, notebook entries, and todos are always personal and
gitignored.

## Commands And Skills

The shared behavior provides project management, thinking, and todo workflows.
Runtime surfaces differ:

- Claude Code exposes slash commands under `.claude/commands`.
- Codex exposes skills under `.codex/skills` and command behavior as skill
  reference files.
- OpenCode exposes commands under `.opencode/commands` and skills under
  `.opencode/skills`.

Common workflows:

| Workflow | Purpose |
|----------|---------|
| `new-project` | Scaffold a new project |
| `project-status` | View or update project health, progress, blockers, risks |
| `meeting` | Capture a meeting summary |
| `decide` | Create a decision record |
| `project-scoping` | Create or update a project plan |
| `project-comment` | Add a quick project comment |
| `dashboard` | Open the local project dashboard |
| `create-project-update` | Draft a stakeholder update |
| `sync` | Sync team repos explicitly |
| `jot`, `brainstorm`, `notebook` | Capture and develop ideas |
| `todo` | Manage personal action items |
| `self-tutorial` | Walk through the workspace features |

## Workspace Structure

Claude target:

```text
your-workspace/
  README.md
  CLAUDE.md
  .ddt/
  .claude/
    commands/
    skills/
    hooks/
    dashboard/
    settings.json
```

Codex target:

```text
your-workspace/
  README.md
  AGENTS.md
  .ddt/
  .codex/
    config.toml
    skills/
    dashboard/
```

OpenCode target:

```text
your-workspace/
  README.md
  AGENTS.md
  opencode.json
  .ddt/
  .opencode/
    commands/
    skills/
    dashboard/
```

Team repos are separate git repos configured in `.ddt/config.md`:

```text
/path/to/team-shared/
  projects/
    <project-name>/
      overview.md
      status.md
      plan.md
      decisions/
      meetings/
      updates/
```

## Repository Contents

```text
office-work-assistant-agent/
  README.md
  TESTING.md
  bootstrap/
    init-workspace.sh                  # runtime-aware installer
  core/
    shared/                            # runtime-neutral .ddt files and .gitignore
    commands/                          # canonical work-assistant commands
    skills/                            # canonical work-assistant skills
  adapters/
    claude/                            # Claude root docs, settings, hook, dashboard
    codex/                             # Codex root docs and config
    opencode/                          # OpenCode root docs and config
  generated/
    claude/                            # checked-in installer source for Claude
    codex/                             # checked-in installer source for Codex
    opencode/                          # checked-in installer source for OpenCode
  scripts/
    render_templates.py                # renders generated outputs and checks freshness
  templates/                           # legacy Claude transition tree, not installer source
  tests/
    run.sh                             # local smoke and generated-parity checks
```

When changing workspace behavior, edit `core/` or the relevant runtime adapter,
then run:

```sh
python3 scripts/render_templates.py
./tests/run.sh
```

`bootstrap/init-workspace.sh` installs from `generated/<runtime>`. Direct edits
to `templates/` are legacy-only and do not change installed output.

## Design Principles

- **Natural language first** - describe what you need; skills and commands
  handle routing.
- **Artifact-driven** - meeting notes, decisions, plans, and status are files.
- **Project-centric** - project artifacts stay grouped by project.
- **Thinking-friendly** - rough ideas can be captured and developed over time.
- **Team-aware** - shared projects live in team repos; personal work stays local.
- **Runtime-native** - each runtime uses its own discovery surface.
- **Non-destructive** - update mode preserves user-owned workspace data.
