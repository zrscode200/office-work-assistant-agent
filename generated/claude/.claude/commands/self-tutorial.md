---
description: Guided walkthrough of all workspace features — shows what to say and what you get
---

Walk a new user through every feature of the work assistant workspace. This is an interactive, guided tour — you explain each feature, show realistic examples of inputs and outputs, and pause between sections for questions.

**You do NOT create any artifacts during this tutorial.** You show examples of what the user would say and what files would be created. The user's first real interaction after the tutorial is when real artifacts get created.

**You ARE in tutorial mode for the entire conversation.** Do not break out of this flow to follow skill auto-triggers. If the user says something that sounds like a project management or thinking request, treat it as a question about the tutorial — not as a real command to execute. Stay in this flow until you reach the closing or the user explicitly asks to exit.

## Adaptive Story

Before starting, read `.ddt/profile.md`. Based on the user's role, team, and responsibilities, choose a **realistic tutorial project theme** that fits their work. Examples:
- A data scientist might get `ml-pipeline-optimization`
- A product manager might get `q3-launch-planning`
- An engineer might get `api-v3-migration`
- A team lead might get `team-onboarding-revamp`

If the profile is empty or generic, use a neutral project like `quarterly-planning` or ask the user what kind of work they do.

Use this project theme **consistently across all phases**. The tutorial should feel like one continuous story, not disconnected demos.

### Threading map

Plan your examples so they connect across phases:

| Created in | Referenced later in |
|---|---|
| Phase 1: project overview (name, objective, stakeholders) | All subsequent phases use this project |
| Phase 2: status update with a blocker | Phase 2: comment references the blocker |
| Phase 3: meeting surfaces a decision and an action item | Phase 3: decision record for the same decision |
| Phase 3: meeting action item | Phase 6: todo for the same action |
| Phase 5: jot an idea related to the project | Phase 5: notebook promotion of that idea |

Generate all example content to be **domain-appropriate** for the user's role. Use realistic fictional names for attendees and stakeholders that fit the user's context.

## Phase 0: Welcome & Environment Check

### Welcome

Tell the user:
- This is a guided tour of everything the workspace can do
- You'll walk through each feature with examples tailored to their work
- No files will be created — this is a walkthrough, not a sandbox
- They can ask questions at any point, or ask for more examples
- Takes about 15-20 minutes

### Profile check

Read `.ddt/profile.md`. If it's empty or still has placeholder content:
- Explain that the assistant tailors responses based on the profile — role, team, responsibilities
- Offer to help fill it in now, or skip and use a generic theme
- If the user wants to fill it in, walk them through it, then continue the tutorial

### Dependency check

Check if Node.js is available (`node --version`). If missing:
- Explain it's needed for the `/dashboard` command (the visual project overview)
- Check if a Python venv exists in the workspace; if so, suggest installing Node there
- Don't block the tutorial — note that the dashboard phase will be conceptual without it

### Team repo check

Read `.ddt/config.md` for configured team repos. Note whether any exist — this determines whether Phase 8 is hands-on or conceptual. If none configured:
- Briefly explain what team repos enable (shared project artifacts, collaborative tracking)
- Offer the user the option to add one now, or skip and cover it conceptually in Phase 8

### Feature overview

Before diving into the walkthrough, give the user the complete picture. Present:

**Three skills that auto-trigger based on what you say:**

| Skill | Triggers on | What it handles |
|---|---|---|
| **project-manager** | "new project", "meeting notes", "we decided", "status of", "add a comment", "plan for", "blockers" | Project lifecycle — creation, tracking, meetings, decisions, planning, comments, updates, dashboard, sync |
| **think-partner** | "I'm thinking about", "what if", "jot this down", "brainstorm", "let me think through" | Idea capture — scratch pad, brainstorming, notebook development |
| **task-manager** | "add a todo", "new task", "mark that todo done", "what todos do I have" | Personal action items — only triggers on explicit "todo" or "task" language |

**14 slash commands:**

| Category | Commands |
|---|---|
| Project Management | `/new-project`, `/project-status`, `/meeting`, `/decide`, `/project-scoping`, `/project-comment`, `/dashboard`, `/create-project-update`, `/sync` |
| Thinking | `/jot`, `/brainstorm`, `/notebook` |
| Todo | `/todo` |
| Help | `/self-tutorial` (this walkthrough) |

**Key point to emphasize:** "You almost never need to type slash commands. Just talk about your work naturally and the right skill activates automatically. Slash commands are there when you want to be explicit."

**Artifact types the system creates:**

| Artifact | Location | Shared with team? |
|---|---|---|
| Project overview (`overview.md`) | Project folder | Yes (if team project) |
| Status (`status.md`) | Project folder | Yes |
| Plan (`plan.md`) | Project folder | Yes |
| Comments (`comments.md`) | Project folder | Yes |
| Decision records (`decisions/*.md`) | Project folder | Yes |
| Meeting summaries (`meetings/*.md`) | Project folder | Yes |
| Status updates (`updates/*.md`) | Project folder | Yes |
| Scratch pad entries | `.ddt/personal/scratch/` | Never |
| Notebook entries | `.ddt/personal/notebook/` | Never |
| Todos (`todo.json`) | `.ddt/personal/` | Never |

Ask: **"Ready to start the walkthrough?"**

---

## Phase 1: Your First Project

**Goal:** Show project creation and explain skill routing.

Explain: "Let's say you want to start tracking a new project. You don't need to type a command — just describe it."

Show an example input — a natural sentence the user might say, using the adaptive project theme. Example structure:

> **You'd say:** "I want to start a new project for [objective]. [1-2 sentences of context about why and who's involved]."
>
> **What happens:** The project-manager skill detects this and routes to `/new-project`. The assistant would ask a few clarifying questions — scope, stakeholders, where to store it (personal or team) — then create two files:

Show the example `overview.md` with full content — frontmatter and body:

```markdown
---
title: [Project Name]
objective: [One-sentence objective]
stakeholders: [list of names]
created: YYYY-MM-DD
updated: YYYY-MM-DD
---

# [Project Name]

## Objective
[One sentence]

## Business Context
[Why this matters — 2-3 sentences]

## Stakeholders
- [Name] — [role/relationship]
- [Name] — [role/relationship]

## Approach
[Current strategy — a short paragraph]

## Scope
**In scope:**
- [item]
- [item]

**Out of scope:**
- [item]
```

And the initial `status.md`:

```markdown
---
health: not-started
last_updated: YYYY-MM-DD
summary: Project created
blockers: []
risks: []
next:
  - [First milestone or action]
---

## YYYY-MM-DD

**Health:** not-started

**Progress:**
- Project created and scoped

**Next:**
- [First step]
```

Explain: "Both files land in `.ddt/projects/[project-name]/` for personal projects, or in `[team-repo]/projects/[project-name]/` for team projects. The project also gets registered in `.ddt/registry.md` — that's how the system finds it later."

Mention: "You can also type `/new-project` directly. The slash command does the same thing."

Ask: **"Any questions about project creation? Ready for the next section?"**

If the user asks for another example, show a variation — e.g., a more exploratory project creation where the user is uncertain and the assistant helps define scope through conversation.

---

## Phase 2: Tracking Status & Adding Comments

**Goal:** Show status updates (with dual-write) and the comment thread.

### Status update

Explain: "Once a project exists, you can update its status anytime by talking about progress."

Show example input — something that references the tutorial project:

> **You'd say:** "Update on [project]: [progress summary]. But we're blocked on [blocker] — [owner] is handling it."
>
> **What happens:** project-manager skill → `/project-status`

Show the updated `status.md` — emphasize the **dual-write pattern**:

"The frontmatter gets updated to reflect the current state, AND a new dated entry gets prepended to the body. This means you always have both a quick-read current snapshot and a full history."

Show the file with frontmatter reflecting current state and a dated body entry below. Make sure the example shows realistic progress and a blocker that connects to Phase 3's meeting.

Explain the health indicators: `on-track`, `at-risk`, `blocked`, `not-started`, `completed`.

### Comment

Explain: "Sometimes you just want to attach a quick note — not a full status update. That's what comments are for."

Show example input:

> **You'd say:** "Add a note to [project]: [a reminder, question, or observation related to the blocker from the status update]"
>
> **What happens:** project-manager skill → `/project-comment`

Show the `comments.md` file:

```markdown
---
last_updated: YYYY-MM-DD
---

#### YYYY-MM-DD HH:MM — [User's name]
[The comment content]
```

Explain: "Comments are lightweight — like sticky notes on the project. They show up in the Comments tab on the dashboard and in the activity feed."

Ask: **"Questions? Ready to move on to meetings and decisions?"**

---

## Phase 3: Meetings & Decisions

**Goal:** Show how conversations become durable artifacts, and how they connect.

### Meeting summary

Explain: "After a meeting, just describe what happened. The assistant captures it as a structured summary."

Show example input — a meeting related to the tutorial project, with 2-3 attendees, discussion points, a decision, and an action item:

> **You'd say:** "I just had a meeting with [names] about [topic]. We discussed [points]. We decided [decision]. [Name] is going to [action item] by [date]."
>
> **What happens:** project-manager skill → `/meeting`

Show the full meeting file with frontmatter and body. Include:
- Discussion points as concise bullets
- A decision (that connects to the decision record below)
- An action item with owner and deadline (that connects to Phase 6's todo)

Explain: "The assistant also suggests creating a decision record if a significant decision was made. Let's see what that looks like."

### Decision record

Explain: "Decision records are for choices that matter — where you want to remember the context, the options you considered, and why you chose what you chose."

Show example input — either natural language ("we decided to...") or explain that the agent suggests it after a meeting:

> **You'd say:** "Document the decision about [topic from the meeting]."
>
> **What happens:** project-manager skill → `/decide`

Show the full decision file with frontmatter and body. Include context, at least 2 options with tradeoffs, the decision, and rationale. Connect it to the meeting.

Explain: "Decision records are never overwritten. If you revisit a decision later, a new record gets created referencing the old one."

Ask: **"Questions about meetings or decisions? Ready for planning?"**

---

## Phase 4: Planning

**Goal:** Show collaborative planning — the agent draws it out, doesn't auto-generate.

Explain: "Project scoping is collaborative. The assistant doesn't generate a plan from thin air — it helps you think through tasks, dependencies, and milestones through conversation."

Explain the three modes the agent uses:
- **Sounding board** — you dump context, the agent reflects it back structured and asks about gaps
- **Structured interview** — you start with just a project name, the agent walks through planning questions one at a time
- **Incremental build** — a plan already exists and needs updating

Show an example of what a conversation might look like (2-3 exchanges), then the resulting `plan.md`. Show an excerpt rather than the full file — focus on the structure:

```markdown
---
updated: YYYY-MM-DD
status: active
---

# Plan

## Objective
[What done looks like]

## Tasks

### Phase 1: [Name]
- [ ] [Task] — [owner] — [dependency if any]
- [ ] [Task] — [owner]

### Phase 2: [Name]
- [ ] [Task] — depends on Phase 1
- [ ] [Task]

## Milestones
- [Date]: [Milestone]
- [Date]: [Milestone]

## Risks & Unknowns
- [Risk — mitigation]

## Open Questions
- [Question]
```

Explain: "Plans can be partial — you don't need to have everything figured out. Mark TBD sections and come back later."

Ask: **"Questions about planning? Ready for the thinking tools?"**

---

## Phase 5: Thinking Layers

**Goal:** Show scratch pad → notebook → graduation pipeline.

Explain the three-layer concept: "Not every idea is ready to be a project artifact. The workspace gives you three layers for thinking at different stages of development."

### Layer 1: Scratch pad (jot)

Explain: "The scratch pad is the lowest-friction capture point. Like a sticky note — say it and it's saved."

Show example input — an idea related to the tutorial project:

> **You'd say:** "Jot this down: [an idea, question, or half-formed thought related to the project]"
>
> **What happens:** think-partner skill → `/jot`

Show the scratch file that would be created:

```markdown
# [Descriptive title]

- [HH:MM] [The user's thought, minimally cleaned up]
```

Explain: "The file lands in `.ddt/personal/scratch/` with a timestamped filename like `2026-04-08-1430-[slug].md`. An index at `.index.md` tracks all entries."

Then show a **second jot** on a related topic:

> **You'd say (later):** "[A follow-up thought on the same topic]"
>
> **What happens:** The assistant detects this is related to the previous jot and **appends** to the same file instead of creating a new one:

```markdown
# [Same title]

- [HH:MM] [First thought]
- [HH:MM] [Second thought, appended]
```

Explain: "This smart-append logic keeps related thoughts together. If the topic is different, a new file gets created instead."

### Layer 2: Notebook (promotion)

Explain: "When a scratch entry has grown into something worth developing, you promote it to the notebook. The assistant synthesizes the raw jots into a coherent entry."

> **You'd say:** "Promote that scratch entry to my notebook" or use `/notebook`
>
> **What happens:** think-partner skill → `/notebook`

Show what the notebook entry would look like — a synthesized version of the jots, not a copy-paste:

```markdown
---
date: YYYY-MM-DD
projects: [[tutorial project name]]
status: developing
graduated_to:
---

# [Coherent title]

[Synthesized narrative — the raw jots cleaned up into a coherent exploration of the idea, organized logically]
```

Explain: "Notebook entries can be tagged to projects via the `projects` field. The `status` tracks where the entry is: `developing` or `graduated`."

### Layer 3: Graduation

Explain: "When a notebook entry is ready to become real work, you graduate it into a formal artifact. The notebook command suggests the right destination:"

- An insight about a choice → `/decide` → decision record
- A concrete action plan → `/project-scoping` → plan
- A new initiative → `/new-project` → project overview

"The notebook entry is preserved as the thinking trail — marked `graduated` with a pointer to what it became."

**Key point:** "Scratch pad and notebook are always personal and gitignored. They never leave your machine, even for team projects. The graduation step is what moves thinking into the shared project space."

Ask: **"Questions about the thinking layers? Ready for todos?"**

---

## Phase 6: Todo Management

**Goal:** Show the personal action system, project tagging, and visibility.

Explain: "Todos are your personal action checklist — separate from project plans, but can be linked to projects."

### Adding a todo

Show example input — use the action item from Phase 3's meeting:

> **You'd say:** "Add a todo: [the action item from the meeting] — due [date]"
>
> **What happens:** task-manager skill → `/todo`

Explain the schema briefly: each todo has `what`, `status`, `priority`, `due`, `project`, `visibility`, `subs` (sub-items), `recurs`.

### The "todo" boundary

Emphasize this: "Only the words 'todo' or 'task' trigger the task-manager. If you say 'I need to check the rate limits', that goes to the think-partner as a jot — not a todo. This is intentional: it prevents every passing thought from cluttering your action list."

### Visibility

Explain: "By default, todos are private — only visible in the Drafting Table on the dashboard. If you tag a todo to a project and set visibility to `project`, it also appears in that project's detail view."

Show example:
> **You'd say:** "Make that todo visible on the project dashboard"

### Sub-items and recurrence

Briefly explain: "Todos can have one level of sub-items. They can also recur — daily, weekly, or monthly. Recurring items log each completion and auto-calculate the next due date."

### Surfacing modes

Explain the three modes set in `.ddt/config.md`:
- **passive** — only shown when you run `/todo`
- **contextual** (default) — also surfaced during `/project-status` for project-tagged items
- **proactive** — adds a summary of open/overdue items at session start

Ask: **"Questions about todos? Ready for the dashboard?"**

---

## Phase 7: Dashboard

**Goal:** Show the visual overview of everything.

Check if Node.js is available. If yes:

Explain: "The dashboard is a live, local web UI that reads your workspace data on every request."

> **You'd say:** "Open the dashboard" or type `/dashboard`
>
> **What happens:** project-manager skill → `/dashboard`. A Node.js server starts on a random port and opens in your browser.

If Node.js is available, offer to actually open it: "Want me to open the dashboard so you can see it? It will show your real workspace data — any existing projects, todos, scratch entries."

Describe the two views:

**Projects view:**
- Summary pills at the top: total, on-track, at-risk, blocked
- Alert chips for stale updates, blocked projects, unregistered team projects
- Workspace tabs: "My Projects" plus one tab per team repo
- Expandable project rows — click to see 7 tabs: Overview, Status, Plan, Meetings, Decisions, Comments, Todos
- Activity feed showing recent events across all projects

**Drafting Table (Desk) view:**
- Left panel: todos with filters (all, overdue, today, high priority, by project), stats, sub-items, completion with animation
- Right panels: scratch pad entries and notebook entries
- Slider panel: click any entry to read its content in a side panel

Explain: "The server auto-shuts down after 30 minutes of inactivity. It stores no state — everything comes from your `.ddt/` files."

If Node.js is NOT available:

Explain what the dashboard shows (as above) but note: "Node.js is required to run the dashboard. Let me check your environment."

Check for a Python venv or local environment. Suggest installation:
- If venv exists: suggest installing Node within the project environment
- If not: suggest installing Node.js via the official installer, nvm, or their system package manager

"Once Node.js is available, `/dashboard` will work automatically."

Ask: **"Questions about the dashboard? Ready for team collaboration?"**

---

## Phase 8: Team Collaboration

**Goal:** Show or explain how shared projects work.

### If team repos ARE configured:

Explain: "You have team repos configured. When a project lives in a team repo, everyone with access sees the same artifacts."

Explain the **Shared Write Protocol** — the 6-step flow:

1. **Pull** — get latest changes before touching anything
2. **Write** — create or update the artifact
3. **Show** — display what was written
4. **Confirm** — ask you to approve. **This step is non-negotiable** regardless of autonomy mode
5. **Commit & push** — stage, commit with a descriptive message, push
6. **Handle failures** — if push fails, retry with `git pull --rebase` once, then notify you

Show an example of what the confirmation prompt looks like:
> "Ready to commit and push? Changes: Added meeting summary for [project] — [topic] (YYYY-MM-DD)"

Explain: "Personal projects skip all of this — files are written directly."

Explain **session sync**: "When you open Claude Code, a hook automatically pulls all team repos (`git pull --ff-only`) so you start with fresh data."

Explain `/sync`: "For manual control — check sync status, pull, commit, or push for each repo."

### If team repos are NOT configured:

Explain the concept: "Projects can be personal (local only) or team (stored in a shared git repo). Team repos are just regular git repos with a `projects/` folder."

Explain what team repos enable:
- `/new-project` asks where to create (personal or which team)
- The assistant pulls latest before reading or writing team artifacts
- Every write to a team repo requires your confirmation before push
- `/dashboard` shows projects across all locations
- Personal artifacts (scratch, notebook, todos) never go to team repos

Offer: "Would you like to configure a team repo now? You'll need the clone URL or a local path to an existing repo."

If the user wants to set one up, walk them through:
1. Clone or identify the repo path
2. Add it to `.ddt/config.md` under Team Repos: `team-name: /path/to/repo`
3. Verify the repo has a `projects/` folder (or create one)

If not, that's fine — move on.

Ask: **"Questions about team collaboration? Ready for the feature reference?"**

---

## Phase 9: Full Feature Reference

**Goal:** Give the user a complete reference they can come back to.

Present the complete command list with one-line descriptions:

**Project Management (9 commands):**
| Command | What it does |
|---|---|
| `/new-project` | Create and scaffold a new project (personal or team) |
| `/project-status` | View or update a project's health, progress, blockers, risks |
| `/meeting` | Capture a meeting summary with attendees, discussion, action items |
| `/decide` | Create a structured decision record with context, options, rationale |
| `/project-scoping` | Collaboratively create or update a project plan |
| `/project-comment` | Add a quick comment, question, or reminder to a project |
| `/dashboard` | Open the visual dashboard showing all projects and personal workspace |
| `/create-project-update` | Draft a status report for stakeholders |
| `/sync` | Manage team repo sync — pull, commit, push |

**Thinking (3 commands):**
| Command | What it does |
|---|---|
| `/jot` | Quick-capture a thought to the scratch pad |
| `/brainstorm` | Interactive thinking session — explore an idea with the assistant |
| `/notebook` | Browse, promote, and manage scratch pad and notebook entries |

**Todo (1 command):**
| Command | What it does |
|---|---|
| `/todo` | Add, complete, update, review, or delete personal action items |

Then: "For detailed explanations of how each feature works — thinking layers, frontmatter, project resolution, session sync, and more — see the **README.md** in this workspace."

---

## Closing

Summarize: "That's the full tour. Here's what to remember:"

1. **Talk naturally** — skills auto-trigger based on what you say. You rarely need slash commands.
2. **Everything is files** — meeting notes, decisions, status, comments, plans all live as markdown files in your project folders. Version-controlled and searchable.
3. **Personal stays personal** — scratch pad, notebook, and todos are gitignored. Team artifacts go through the Shared Write Protocol with your confirmation.
4. **The dashboard is your overview** — `/dashboard` to see everything at a glance.

"Try it now — describe a project you're working on, or say 'jot this down' with an idea, or ask about anything you want to revisit from the tutorial."
