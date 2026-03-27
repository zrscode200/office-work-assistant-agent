---
description: Manage personal todo list — add, complete, update, review, delete
---

Create and manage personal todo items. Todos are personal action items — things you need to do across your day/week. They can optionally be tagged to a project and made visible on the project dashboard.

## Storage

Active items live in `.ddt/personal/todo.json`. Completed items are moved to `.ddt/personal/todo-complete.json`. Both use the same schema.

### Initialization

If `.ddt/personal/todo.json` does not exist, create it:

```json
{
  "version": 1,
  "items": []
}
```

Same for `todo-complete.json` when first needed.

### Item Schema

```json
{
  "id": "t1",
  "what": "Review API design doc",
  "status": "open",
  "priority": "normal",
  "due": "2026-03-28",
  "project": "upstream-biologics",
  "visibility": "private",
  "group": "reviews",
  "recurs": null,
  "created": "2026-03-25",
  "completed": null,
  "completions": [],
  "subs": [
    {
      "id": "t1.1",
      "what": "Read Sarah's proposal",
      "status": "open"
    }
  ]
}
```

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `id` | string | auto | `t{n}` | Monotonic, next = max existing + 1 |
| `what` | string | yes | — | Task description |
| `status` | enum | yes | `open` | `open` / `in-progress` / `done` |
| `priority` | enum | no | `normal` | `high` / `normal` / `low` |
| `due` | date | no | null | YYYY-MM-DD |
| `project` | string | no | null | Project name from registry |
| `visibility` | enum | no | `private` | `private` / `project` |
| `group` | string | no | null | User-defined category |
| `recurs` | enum | no | null | `daily` / `weekly` / `monthly` |
| `created` | date | auto | today | |
| `completed` | date | auto | null | Set when status → done |
| `completions` | date[] | auto | [] | History for recurring items |
| `subs` | item[] | no | [] | One level only. Sub-items have: id, what, status |

Only `what` is required from the user. Everything else has defaults or is optional.

---

## Data Access

Do NOT read the full JSON file into context. Use targeted `node -e` queries to retrieve only what is needed.

### Read Queries

**Summary counts:**
```bash
node -e "
  const t=JSON.parse(require('fs').readFileSync('.ddt/personal/todo.json','utf8'));
  const o=t.items.filter(i=>i.status!=='done');
  const now=new Date().toISOString().slice(0,10);
  const overdue=o.filter(i=>i.due&&i.due<now).length;
  const today=o.filter(i=>i.due===now).length;
  const high=o.filter(i=>i.priority==='high').length;
  console.log(JSON.stringify({total:o.length,overdue,today,high}));
"
```

**List open items (compact — omits subs and completions):**
```bash
node -e "
  const t=JSON.parse(require('fs').readFileSync('.ddt/personal/todo.json','utf8'));
  const o=t.items.filter(i=>i.status!=='done');
  console.log(JSON.stringify(o.map(i=>({id:i.id,what:i.what,due:i.due,priority:i.priority,project:i.project,group:i.group,status:i.status,hasSubs:!!(i.subs&&i.subs.length)}))));
"
```

**Items for a specific project:**
```bash
node -e "
  const t=JSON.parse(require('fs').readFileSync('.ddt/personal/todo.json','utf8'));
  const p=t.items.filter(i=>i.project==='PROJECT_NAME'&&i.status!=='done');
  console.log(JSON.stringify(p));
"
```

**Find item by keyword match:**
```bash
node -e "
  const t=JSON.parse(require('fs').readFileSync('.ddt/personal/todo.json','utf8'));
  const m=t.items.filter(i=>i.what.toLowerCase().includes('KEYWORD'));
  console.log(JSON.stringify(m.map(i=>({id:i.id,what:i.what,status:i.status}))));
"
```

**Single item by ID (full detail):**
```bash
node -e "
  const t=JSON.parse(require('fs').readFileSync('.ddt/personal/todo.json','utf8'));
  const i=t.items.find(x=>x.id==='ID');
  console.log(JSON.stringify(i));
"
```

**Overdue items:**
```bash
node -e "
  const t=JSON.parse(require('fs').readFileSync('.ddt/personal/todo.json','utf8'));
  const now=new Date().toISOString().slice(0,10);
  const o=t.items.filter(i=>i.due&&i.due<now&&i.status!=='done');
  console.log(JSON.stringify(o.map(i=>({id:i.id,what:i.what,due:i.due,project:i.project}))));
"
```

**Due this week:**
```bash
node -e "
  const t=JSON.parse(require('fs').readFileSync('.ddt/personal/todo.json','utf8'));
  const now=new Date();
  const end=new Date(now);end.setDate(end.getDate()+(7-end.getDay()));
  const s=now.toISOString().slice(0,10);
  const e=end.toISOString().slice(0,10);
  const o=t.items.filter(i=>i.due&&i.due>=s&&i.due<=e&&i.status!=='done');
  console.log(JSON.stringify(o.map(i=>({id:i.id,what:i.what,due:i.due,priority:i.priority,project:i.project}))));
"
```

**Items with visibility=project (for dashboard):**
```bash
node -e "
  const t=JSON.parse(require('fs').readFileSync('.ddt/personal/todo.json','utf8'));
  const p=t.items.filter(i=>i.visibility==='project'&&i.status!=='done');
  console.log(JSON.stringify(p.map(i=>({id:i.id,what:i.what,due:i.due,priority:i.priority,project:i.project,status:i.status}))));
"
```

### Write Pattern

For all mutations, use a single `node -e` call that reads, mutates, writes back, and outputs a confirmation:

```bash
node -e "
  const fs=require('fs');
  const f='.ddt/personal/todo.json';
  const t=JSON.parse(fs.readFileSync(f,'utf8'));
  // ... mutation logic ...
  fs.writeFileSync(f,JSON.stringify(t,null,2));
  console.log(JSON.stringify({ok:true}));
"
```

### Next ID Generation

```bash
node -e "
  const t=JSON.parse(require('fs').readFileSync('.ddt/personal/todo.json','utf8'));
  const max=t.items.reduce((m,i)=>Math.max(m,parseInt(i.id.slice(1))||0),0);
  console.log('t'+(max+1));
"
```

---

## Operations

### 1. Add

User invokes `/todo` with a description, or the task-manager skill routes here when the user uses explicit "todo"/"task" language.

**Parse the input.** Extract what you can from the user's message:
- Description → `what`
- Date references ("by Friday", "due March 28") → `due`
- Priority words ("urgent", "high priority", "low") → `priority`
- Project names → `project` (validate against `.ddt/registry.md` via query; if not found, tag anyway but note "project 'X' not in registry — tagged anyway")
- Sub-items ("review doc: read proposal, check limits, write feedback") → `subs`

**If only `what` was provided** (no other fields parsed), offer the optional fields as a single prompt after creating the item:

> Added: "check API rate limits" (t5)
>
> Want to add details?
> - Due date
> - Priority (high / normal / low)
> - Project tag
> - Group
> - Sub-items
>
> Say "done" to leave it as is, or add what you'd like.

The user responds with as many or as few as they want in one message. A single follow-up — not a field-by-field interview.

**If 2+ fields were provided**, the user knows what they want. Just confirm:

> Added: "review Sarah's proposal" (t6)
> Due: 2026-03-28 | Priority: high | Project: upstream-biologics

No follow-up needed.

### 2. Mark Done

User says they finished something. Use keyword match query to find the item.

**Single match → complete immediately, no confirmation:**
1. Set `status: done`, `completed: today`.
2. Move item from `todo.json` to `todo-complete.json`.
3. Confirm: "Done: <what>"

**Multiple matches → show candidates and ask:**
1. Present matching items with IDs.
2. User picks one.
3. Complete as above.

**No match:**
"No matching todo found for '<keyword>'. Your open items:" and list them briefly.

**Item with sub-todos:**
- User marks a sub-item done → update sub `status` in place.
- When all subs are done, ask: "All sub-items done — mark parent '<what>' as done too?"
- User marks parent done directly → moves the whole item (including subs) regardless of sub status.

**Recurring item:**
1. Log today in `completions[]`.
2. Calculate next `due` based on `recurs`:
   - `daily`: tomorrow
   - `weekly`: +7 days
   - `monthly`: same day next month
3. Keep `status: open`. Item stays in `todo.json`.
4. Confirm: "Completed this occurrence of '<what>'. Next due: <date>"

### 3. List / Review

**Default (no filters):**
1. Run summary counts query.
2. List open items sorted by: overdue first, then by priority (high → normal → low), then by due date.
3. Present as a table:

```
3 overdue | 2 due today | 12 total open

| ID | Todo              | Due    | Pri  | Project            |
|----|-------------------|--------|------|--------------------|
| t1 | Review API doc    | Mar 28 | high | upstream-biologics |
| t2 | Buy donuts        | Mar 27 | norm | —                  |
| t3 | Weekly metrics    | Apr 2  | norm | —                  |
```

**Filtered views:**
- By project: "todos for upstream-biologics" → project query
- By group: "show my reviews" → filter by group field
- By timeframe: "what's due this week" → due-this-week query, "what's overdue" → overdue query
- By priority: "high priority todos" → filter by priority

**Weekly review:**
Combines: overdue items, due this week, recurring items with next occurrence, items with no due date. Grouped by project if items span multiple projects.

### 4. Update

User wants to modify an existing item. Find by keyword match or ID.

Supported updates:
- **Priority:** "make the API review high priority"
- **Due date:** "push donuts to next Monday"
- **Project tag:** "tag the API review to upstream-biologics"
- **Group:** "put that in the reviews group"
- **Visibility:** "make the API review visible on dashboard" → set `visibility: project`. Clarify: "This will show the item on the project dashboard. The todo itself stays in your personal list."
- **Status:** "I'm working on the API review" → `in-progress`
- **Description:** "rename that to 'review API v2 doc'"
- **Recurrence:** "make the metrics review weekly"

Confirm the change: "Updated t1: priority → high". Write back.

### 5. Delete

User wants to remove a todo permanently.

1. Find item by keyword match.
2. **Single match:** "Delete '<what>'? This removes it permanently (not the same as marking done)."
3. **Recurring item extra warning:** "This is a recurring item (repeats <recurs>). Delete it entirely?"
4. On confirmation, remove from `todo.json`. Do NOT move to `todo-complete.json` — deleted items are gone.
5. Confirm: "Deleted: <what>"

### 6. Sub-todo Management

**Add sub-item to existing todo:**
- "Add sub-task to the API review: check authentication section"
- Find parent, append to `subs[]` with ID `t{parent}.{next}`.
- Confirm: "Added sub-item to t1: check authentication section"

**Complete sub-item:**
- "I finished reading Sarah's proposal"
- Match against sub-item `what` fields across all items.
- Set sub `status: done`.
- If all subs now done, prompt about parent (see Mark Done).

**Remove sub-item:**
- Find and remove from `subs[]`. Confirm first.

---

## Contextual Surfacing

When the agent reads todo data outside of `/todo` or the task-manager skill. Controlled by `todo_surfacing` in `.ddt/config.md` (default: `contextual`).

### Passive mode
Never read todos unless the user invokes `/todo` or the task-manager skill triggers.

### Contextual mode (default)
During `/project-status` for a specific project:
- Run the project-specific query.
- If open items exist, append to the status output: "You have N personal todos tagged to this project:" followed by a brief list (what + due).
- Do NOT surface during brainstorm, exploration, jot, or general conversation.

### Proactive mode
Everything in contextual, plus:
- Session-start hook injects a summary line into `additionalContext`: "Todos: N open (X overdue, Y due today)"
- The agent may mention this summary at the start of the session if overdue items exist.

---

## Dashboard Integration

The project dashboard reads `.ddt/personal/todo.json` to display todos that have `visibility: project`.

- Only items with `visibility: project` AND a `project` tag appear on the dashboard.
- Items with `visibility: private` never appear, even if project-tagged. Tagging a project is for personal filtering; visibility controls dashboard exposure.
- Display on the project card: todo description, due date, priority badge.

---

## Session-Start Cleanup

The session-start hook auto-cleans completed items older than 30 days from `todo-complete.json`. This runs automatically regardless of surfacing mode. No user confirmation needed — items were already completed and aged out.

---

## Tone

Fast and operational for adds. Organized and scannable for reviews. Confirm before destructive actions (delete). When offering optional fields on quick add, keep it light — a nudge, not a form. This is a checklist tool, not a project plan.
