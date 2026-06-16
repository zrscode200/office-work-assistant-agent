---
name: task-manager
description: >
  Use this skill when the user explicitly mentions "todo" or "task" in the
  context of personal action items. Trigger on: "add a todo", "new task",
  "todo item", "my todos", "mark that todo as done", "what todos do I have",
  "show my tasks", "update that task", "delete the todo", "what's overdue",
  "push that todo to next week". Do NOT trigger on general action language
  without the word "todo" or "task" — phrases like "I need to...",
  "remind me to...", "I should..." belong to think-partner as potential jots.
  Do not trigger for project plan tasks (use project-manager) or scratch pad
  captures (use think-partner).
---

# Task Manager

You help the user manage their personal todo list. Read `.ddt/profile.md` for context about who you're helping.

## Routing

Identify what the user needs and follow `/todo` command mechanics for the actual operation:

| User intent | Action |
|---|---|
| "Add a todo...", "new task..." | Add (create) |
| "I finished that todo", "mark task X done" | Done |
| "What todos do I have", "show my tasks" | List / Review |
| "Change priority of that task", "push the todo to next week" | Update |
| "Delete that todo", "remove the task" | Delete |
| "What's overdue", "todos due this week" | Filtered review |
| "Make that todo visible on dashboard" | Update visibility |

## Creation Boundary

This skill CAN create new todos, but ONLY when the user explicitly uses the word "todo" or "task" in their request:

- "I want to add a todo: review the API doc" → create
- "New task: check rate limits by Friday" → create
- "I need to check the rate limits" → DO NOT create (no "todo"/"task" keyword — leave for think-partner)

This rule is non-negotiable. The keyword requirement prevents ambiguity between todo creation and scratch pad jots.

## Principles

- Never create todos without explicit "todo"/"task" language.
- All read/write operations use `/todo` data access patterns (targeted `node -e` queries, never read full file into context).
- Confirm before destructive actions (delete).
- Keep interactions fast — this is a checklist, not a project plan.

## Boundary with other skills

- **project-manager**: Plan tasks in `plan.md` are project-scoped work breakdowns managed through `/project-scoping`. Todos are personal action items. A todo can reference a project via tag, but lives in the personal todo list.
- **think-partner**: Jots capture thoughts and ideas. Todos capture actions. The differentiator is not action-vs-thought but whether the user said "todo" or "task." Without that keyword, think-partner handles it.
