# Work Assistant Workspace

Most work context disappears. Meetings happen and the takeaways live in someone's head. Decisions get made in Slack threads that no one can find a month later. Project status lives in a spreadsheet that's always a week stale. Half-formed ideas never get written down because there's no low-friction place to put them.

This workspace changes that. It's powered by Claude Code and designed around one idea: **talk naturally about your work, and durable artifacts get created automatically.** Meeting summaries, decision records, status updates, project plans, quick comments, personal todos, and even rough ideas — all captured to files, organized by project, and versioned in git.

You don't manage the system. You talk about your work, and the assistant handles the rest — routing your intent to the right workflow, creating the right files in the right places, and keeping everything structured and findable.

## Getting Started

1. Fill in `.ddt/profile.md` with your role, team, and context
2. Review `.ddt/config.md` to set your name and autonomy mode
3. Optionally customize `.ddt/norms.md` with your team's working principles
4. Open Claude Code in this directory: `claude`
5. Run `/self-tutorial` for a guided walkthrough of every feature, with examples tailored to your role

## How Skill Routing Works

The workspace has three skills that **auto-trigger based on what you say** — you never need to invoke them directly. Each skill listens for natural language patterns and routes to the right slash command behind the scenes.

| Skill | Activates when you say... | Routes to |
|-------|--------------------------|-----------|
| **project-manager** | "new project", "meeting notes", "we decided", "what's the status of", "add a comment to", "plan for", "blockers" | `/new-project`, `/meeting`, `/decide`, `/project-status`, `/project-comment`, `/project-scoping`, `/create-project-update`, `/dashboard`, `/sync` |
| **think-partner** | "I'm thinking about", "what if we", "jot this down", "help me brainstorm", "let me think through" | `/jot`, `/brainstorm`, `/notebook` |
| **task-manager** | "add a todo", "new task", "mark that todo done", "what todos do I have" | `/todo` |

**The boundary matters:** saying "I need to check the rate limits" does *not* create a todo — it goes to think-partner as a jot. Only the explicit words "todo" or "task" trigger the task-manager. This prevents the system from cluttering your todo list with every passing thought.

You can also invoke any slash command directly (e.g., `/meeting`) to skip the routing.

## Slash Commands

### Project Management

| Command | Description |
|---------|-------------|
| `/new-project` | Scaffold a new project (personal or team) |
| `/project-status` | View or update a project's status |
| `/meeting` | Capture a meeting summary |
| `/decide` | Create a structured decision record |
| `/project-scoping` | Create or update a project plan (collaborative, not auto-generated) |
| `/project-comment` | Add a quick comment, question, or reminder to a project |
| `/dashboard` | Overview of all active projects across all locations |
| `/create-project-update` | Draft a status update or report for stakeholders |
| `/sync` | Sync team repos — pull, commit, push |

### Notebook & Thinking

| Command | Description |
|---------|-------------|
| `/jot` | Quick-capture a thought to the scratch pad |
| `/brainstorm` | Think through an idea interactively |
| `/notebook` | Browse scratch pad and notebook, promote entries, manage thinking |

### Todo

| Command | Description |
|---------|-------------|
| `/todo` | Manage personal action items — add, complete, update, review, delete |

### Getting Started

| Command | Description |
|---------|-------------|
| `/self-tutorial` | Guided walkthrough of all features with examples tailored to your role |

## Thinking Layers: Scratch Pad, Notebook, and Formal Artifacts

Ideas rarely arrive fully formed. The workspace provides three layers so you can capture thoughts at any stage of development and promote them as they mature.

**Layer 1 — Scratch Pad** (`.ddt/personal/scratch/`)
The lowest-friction capture point. Say "jot this down" or just mention an idea during a brainstorm, and it's saved as a timestamped sticky note. If you jot something related to an existing note, the assistant appends to it instead of creating a new file. Think of this as sticky notes on your desk.

**Layer 2 — Notebook** (`.ddt/personal/notebook/`)
When a scratch entry has grown into something worth synthesizing, you promote it via `/notebook`. The assistant reads the raw jots and produces a cleaned-up, coherent entry — not a copy-paste, but an actual synthesis. Notebook entries can be tagged to projects and have a status: `developing` or `graduated`.

**Layer 3 — Formal Artifacts** (project directories)
When a notebook entry is ready to become real work, it graduates into a formal artifact via the appropriate command — a decision record (`/decide`), a project plan (`/project-scoping`), or even a new project (`/new-project`). The notebook entry is preserved as the thinking trail, marked `graduated` with a pointer to what it became.

Both the scratch pad and notebook are **personal and gitignored**. They never leave your machine, even when working on team projects.

## Project Resolution: How the Agent Finds Projects

The workspace uses a **registry-based lookup**, not filesystem scanning. When any command needs to find a project, it follows this protocol:

1. Read `.ddt/registry.md` — the master list of all known projects
2. Find the matching row and derive the file path from the `location` column (`personal` maps to `.ddt/projects/`, a team name maps to the configured repo path)
3. If the project is in a team repo, pull latest changes before reading
4. If not found in the registry, scan team repos for unregistered projects and auto-register any it finds
5. If still not found, tell you what projects do exist

**Why a registry?** It provides a single source of truth across personal and multiple team workspaces. It also tracks project lifecycle — `active`, `completed`, or `archived` — so the dashboard and commands know what to show without scanning every directory.

## Frontmatter: The Data Contract

Every project artifact uses **YAML frontmatter** (the `---` block at the top of markdown files) as a structured data layer. The frontmatter holds machine-readable fields; the markdown body holds the human-readable narrative.

```markdown
---
health: on-track
last_updated: 2026-04-01
summary: API integration complete, starting load testing
blockers:
  - Waiting on staging credentials — DevOps
next:
  - Load test results by Friday
---

## 2026-04-01
...
```

The dashboard reads frontmatter directly for reliable data extraction. When you update an artifact, the assistant keeps frontmatter and body in sync. If you encounter a legacy file without frontmatter, the assistant adds it on next update.

**`status.md` uses dual-write:** the frontmatter always reflects the *current* snapshot (latest health, blockers, next steps), while the body is an append-only history of dated entries. This means you get both a quick-read current state and a full audit trail.

## Dashboard

The `/dashboard` command opens a **live, local web dashboard** in your browser. It's not a static file — it's a lightweight Node.js server that reads your workspace data on each request.

The dashboard has two views:

- **Projects** — summary pills (all, on-track, at-risk, blocked), alert chips for stale or blocked projects, workspace tabs (personal + each team), expandable project rows with tabs for overview, status history, plan, meetings, decisions, comments, and todos
- **Drafting Table** — your personal workspace: todos with filters and stats, scratch pad entries, and notebook entries with a slider panel for reading content

The server starts on a random port, auto-shuts down after 30 minutes of inactivity, and stores no state — it reads live from your `.ddt/` directory every time.

## Todo System

Personal action items live in `.ddt/personal/todo.json`. Each todo can have a description, due date, priority, project tag, sub-items, and recurrence.

**Visibility:** By default, todos are `private` — only visible in the Drafting Table. If you tag a todo to a project and set its visibility to `project`, it also appears in that project's detail view on the dashboard. You can toggle visibility from the dashboard.

**Surfacing modes** (set `todo_surfacing` in `.ddt/config.md`):
- `passive` — only shown when you run `/todo`
- `contextual` (default) — also surfaced during `/project-status` for project-tagged items
- `proactive` — adds a summary of open/overdue items at session start

Completed items are moved to `todo-complete.json` and automatically cleaned up after 30 days.

## Session Sync

When you open Claude Code in this workspace, a **hook runs automatically** before your first interaction. It does two things:

1. **Pulls team repos** — runs `git pull --ff-only` on every team repo in `.ddt/config.md` so you always start with fresh data. If a pull fails (diverged history), it tells you.
2. **Cleans old completed todos** — removes completed items older than 30 days from `todo-complete.json`.

If todo surfacing is set to `proactive`, the hook also outputs a summary of open, overdue, and due-today items so the assistant can mention them at the start of your session.

You don't need to configure this — it's set up automatically during workspace creation via `.claude/settings.json`.

## Team Collaboration

Projects can be **personal** (local only, in `.ddt/projects/`) or **team** (in a shared git repo's `projects/` folder). You can configure multiple team repos — one per team.

To add a team repo:

1. Clone the team's shared repo: `git clone <team-repo-url> /path/to/team-shared`
2. Add it to the Team Repos section in `.ddt/config.md`:
   ```
   team-name: /path/to/team-shared
   ```

### The Shared Write Protocol

When the assistant writes to a team project, it follows a strict protocol to prevent conflicts:

1. **Pull** — `git pull` to get the latest changes before writing anything
2. **Write** — create or update the artifact
3. **Show** — display what was written (file path and content summary)
4. **Confirm** — ask you to approve before committing. This step is **non-negotiable** regardless of autonomy mode.
5. **Commit & Push** — stage, commit with a descriptive message, and push
6. **Handle failures** — if push fails, retry with `git pull --rebase` once, then notify you

Personal projects skip this entirely — files are written directly with no git ceremony.

### What stays personal

Scratch pad entries, notebook entries, and todos are always personal and gitignored. They never go to a team repo. Only formal project artifacts (overview, status, plan, decisions, meetings, comments, updates) live in team repos.

Each team repo is a plain git data repo — just a `projects/` folder, no agent config needed.

## Autonomy Modes

Set `mode` in `.ddt/config.md`:

- **supervised** — pauses before creating/modifying artifacts, asks for confirmation
- **gated** (default) — works autonomously on artifact creation, pauses for cross-project changes or deletions
- **autonomous** — runs freely, pauses only for ambiguity

Writing to a team repo always requires confirmation, regardless of mode.

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
      status.md                        # current status, health, blockers, risks
      plan.md                          # task breakdown, milestones, timeline
      comments.md                      # comment thread (notes, questions, reminders)
      decisions/
        <decision-name>.md             # decision records
      meetings/
        YYYY-MM-DD-<topic>.md          # meeting summaries
      updates/
        YYYY-MM-DD.md                  # status updates / reports
  personal/
    todo.json                          # personal action items (gitignored)
    scratch/                           # quick-capture scratch pad (gitignored)
      .index.md                        # manifest tracking entries and promotion status
      YYYY-MM-DD-HHMM-<slug>.md       # sticky notes
    notebook/                          # developed ideas and brainstorms (gitignored)
      YYYY-MM-DD-<slug>.md            # notebook entries

.claude/
  skills/                              # auto-triggering skills (managed by bootstrap)
    project-manager/SKILL.md
    think-partner/SKILL.md
    task-manager/SKILL.md
  commands/                            # slash commands (managed by bootstrap)
    new-project.md, project-status.md, meeting.md, decide.md,
    project-scoping.md, project-comment.md, dashboard.md,
    create-project-update.md, sync.md,
    jot.md, brainstorm.md, notebook.md, todo.md, self-tutorial.md
  hooks/
    session-sync.sh                    # auto-syncs team repos on session start
  dashboard/
    server.js                          # dashboard backend (Node.js)
    template.html                      # dashboard frontend (single-page app)
  settings.json                        # hook configuration
```

## Conventions

- **Project registry:** `.ddt/registry.md` tracks all known projects (personal and team)
- **Project folders:** lowercase kebab-case (`cloud-migration`, `q2-budget`)
- **Meeting files:** `YYYY-MM-DD-<topic>.md` (e.g., `2026-03-12-kickoff.md`)
- **Decision files:** descriptive kebab-case (e.g., `vendor-selection.md`)
- **Status updates:** `YYYY-MM-DD.md`
- **Comments:** single `comments.md` per project, entries prepended with `####` headers
- **Notebook entries:** `YYYY-MM-DD-<slug>.md` (e.g., `2026-03-13-api-vendor-options.md`)
- **Scratch pad entries:** `YYYY-MM-DD-HHMM-<slug>.md` (e.g., `2026-03-16-1430-api-vendor-options.md`)

## Updating

To pull the latest templates from the toolkit repo (preserves your data and config):

```sh
/path/to/office-work-assistant-agent/bootstrap/init-workspace.sh --update .
```

This refreshes system files (CLAUDE.md, skills, commands, hooks, dashboard, this README) without touching user files (config, profile, norms, registry, settings.json, projects, scratch pad).
