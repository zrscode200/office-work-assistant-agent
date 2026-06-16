# Work Assistant Workspace

This workspace is powered by OpenCode and organized around one idea: talk
naturally about your work, and durable project artifacts get created as files.
Meeting summaries, decision records, status updates, project plans, comments,
personal todos, and rough ideas all live under `.ddt/`.

## Getting Started

1. Fill in `.ddt/profile.md` with your role, team, and context.
2. Review `.ddt/config.md` to set your name, autonomy mode, and team repos.
3. Optionally customize `.ddt/norms.md` with your team's working principles.
4. Open OpenCode in this directory.
5. Ask for `/self-tutorial` for a guided walkthrough.

## How Skill Routing Works

OpenCode discovers three workspace skills and a command set:

| Skill | Activates when you say... | Uses commands for |
|-------|--------------------------|-------------------|
| **project-manager** | "new project", "meeting notes", "we decided", "status of", "add a comment", "plan for", "blockers" | project creation, status, meetings, decisions, planning, comments, updates, dashboard, sync |
| **think-partner** | "I'm thinking about", "what if", "jot this down", "brainstorm", "let me think through" | scratch pad, brainstorm, notebook |
| **task-manager** | "add a todo", "new task", "mark that todo done", "what todos do I have" | personal action items |

The behavior details live as command files under `.opencode/commands/`. You
usually do not need to name a command directly. Describe the work naturally and
the matching skill should use the right command behavior.

## Workspace Structure

```text
README.md
AGENTS.md
opencode.json
.ddt/
  config.md
  profile.md
  norms.md
  registry.md
  projects/
  personal/
    todo.json
    scratch/
    notebook/
.opencode/
  commands/
  skills/
  dashboard/
```

Team projects live in configured team repos under their `projects/` folders.
Scratch pad entries, notebook entries, and todos are always personal.

## Dashboard

The dashboard is a local Node.js server that reads workspace data from `.ddt/`
on each request. It is read-only: it does not pull or mutate team repos. Use
the sync workflow when you want to pull or push team repo changes.

To open it, ask OpenCode to open the dashboard or use `/dashboard`. The
project-manager skill uses the dashboard command, starts the local server, and
reports the URL.

## Team Repos

Team repos are plain git repos with a `projects/` directory. Add them to
`.ddt/config.md` under Team Repos. When writing team artifacts, the assistant
must show the intended change and get your confirmation before commit or push.

## Personal Notes And Todos

Scratch pad entries, notebook entries, and todos are stored under
`.ddt/personal/` and are gitignored. They are not shared with team repos.
