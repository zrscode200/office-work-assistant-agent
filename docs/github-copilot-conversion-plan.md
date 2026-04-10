# GitHub Copilot Conversion Plan

## Goal

Prepare a GitHub Copilot-native version of this bootstrap repo without carrying over Claude-specific structure that Copilot now replaces with its own customization system.

This document is a migration plan, not the conversion itself.

## Recommendation

Target **VS Code + GitHub Copilot agent mode + Copilot coding agent + Copilot CLI** as the primary experience.

Reason:

- This is the richest Copilot customization surface today.
- It supports repository instructions, path-specific instructions, custom agents, prompt files, skills, and hooks.
- It lets us preserve almost all of the current repo's behavior with native Copilot constructs.

Treat **GitHub.com** support as secondary:

- Custom agents, hooks, repository instructions, path instructions, and skills are usable there.
- Prompt files are not the right primary abstraction for GitHub.com workflows.

## What Changes

### 1. Split `CLAUDE.md` into smaller Copilot-native layers

Do **not** port the current [templates/CLAUDE.md](/Users/ziruisu/Rui_Space/WorkSpace_Playground/personal_projects/claude_bootstrap_agent_repo/office-work-assistant-agent/templates/CLAUDE.md) verbatim into `.github/copilot-instructions.md`.

Use this split instead:

- `.github/copilot-instructions.md`
  - Short, always-on repository rules
  - Naming conventions
  - High-level workspace contract
  - "Read existing artifacts before writing"
  - "Team repo writes require confirmation"
- `AGENTS.md`
  - Longer operating manual for Copilot agent surfaces
  - Project resolution protocol
  - Shared write protocol
  - Artifact schemas and workflow behavior
- `.github/instructions/*.instructions.md`
  - Path- or topic-specific instructions
  - Example: project artifacts, dashboard files, shell scripts, personal todo data

Reason:

- GitHub recommends repository instructions stay short and broadly applicable.
- Copilot code review only reads the first 4,000 characters of custom instruction files.
- The current `CLAUDE.md` is too large and too operationally dense for a single always-on instruction file.

### 2. Convert Claude slash commands into Copilot prompt files

Current command templates under [templates/commands](/Users/ziruisu/Rui_Space/WorkSpace_Playground/personal_projects/claude_bootstrap_agent_repo/office-work-assistant-agent/templates/commands) should become workspace prompt files under `.github/prompts`.

Recommended mapping:

| Current asset | Copilot target |
|---|---|
| `new-project.md` | `.github/prompts/new-project.prompt.md` |
| `project-status.md` | `.github/prompts/project-status.prompt.md` |
| `meeting.md` | `.github/prompts/meeting.prompt.md` |
| `decide.md` | `.github/prompts/decide.prompt.md` |
| `project-scoping.md` | `.github/prompts/project-scoping.prompt.md` |
| `create-project-update.md` | `.github/prompts/create-project-update.prompt.md` |
| `sync.md` | `.github/prompts/sync.prompt.md` |
| `jot.md` | `.github/prompts/jot.prompt.md` |
| `brainstorm.md` | `.github/prompts/brainstorm.prompt.md` |
| `notebook.md` | `.github/prompts/notebook.prompt.md` |
| `todo.md` | `.github/prompts/todo.prompt.md` |
| `dashboard.md` | `.github/prompts/dashboard.prompt.md` |

Notes:

- Prompt files behave like reusable slash commands in Copilot chat.
- They are the closest native equivalent to the current explicit command entry points.
- Keep them thin where possible, and reference shared instruction files instead of duplicating logic.

### 3. Keep skills, but move them to `.github/skills`

The current Claude skills are structurally reusable. Copilot supports skill folders with `SKILL.md`.

Recommended mapping:

| Current asset | Copilot target |
|---|---|
| `templates/skills/project-manager/SKILL.md` | `.github/skills/project-manager/SKILL.md` |
| `templates/skills/think-partner/SKILL.md` | `.github/skills/think-partner/SKILL.md` |
| `templates/skills/task-manager/SKILL.md` | `.github/skills/task-manager/SKILL.md` |

Adjustment needed:

- Rewrite descriptions to mention Copilot rather than Claude.
- Remove references to `.claude/commands`.
- Point skills at `.github/prompts` and `.github/instructions` instead.
- Add supporting files only where the workflow needs reusable examples or scripts.

### 4. Add custom agents for role-based entry points

This repo currently uses one large operating manual plus skills. Copilot gives a better option: lightweight role agents.

Recommended initial agents:

- `.github/agents/work-assistant.agent.md`
  - Default agent for project documentation and tracking
- `.github/agents/think-partner.agent.md`
  - Exploration, brainstorming, and notebook promotion
- `.github/agents/task-manager.agent.md`
  - Personal todo operations with restricted focus
- `.github/agents/planner.agent.md`
  - Optional planning-only agent for scoping without writing files until approved

Suggested design:

- Keep tool access fairly broad for `work-assistant`
- Constrain `planner` toward read-heavy / plan-heavy use
- Use handoffs between agents where natural
- Reference shared instruction files instead of repeating full workflow text

### 5. Replace `.claude` hook wiring with native Copilot hooks

Current hook assets:

- [templates/hooks/session-sync.sh](/Users/ziruisu/Rui_Space/WorkSpace_Playground/personal_projects/claude_bootstrap_agent_repo/office-work-assistant-agent/templates/hooks/session-sync.sh)
- [templates/settings.json](/Users/ziruisu/Rui_Space/WorkSpace_Playground/personal_projects/claude_bootstrap_agent_repo/office-work-assistant-agent/templates/settings.json)

Copilot-native target:

- `.github/hooks/session-sync.json`
- `.github/scripts/session-sync.sh`

Why:

- Copilot supports native JSON hook configuration in `.github/hooks/*.json`
- It supports `sessionStart`, which maps cleanly to the current Claude `SessionStart` behavior
- Hook output can inject additional context into the conversation

Recommended migration:

- Move shell logic into `.github/scripts/session-sync.sh`
- Create a small JSON hook config that runs it at `sessionStart`
- Keep the script's responsibilities narrow:
  - pull configured team repos
  - summarize sync state
  - optionally summarize todo state
  - emit structured additional context

### 6. Stop using `.claude/*` as the primary customization root

Copilot can discover some Claude-format files, but the Copilot version of this repo should be natively structured around `.github`.

Recommended target root:

```text
.github/
  copilot-instructions.md
  instructions/
    project-artifacts.instructions.md
    dashboard.instructions.md
    shell.instructions.md
    todo.instructions.md
  prompts/
    new-project.prompt.md
    project-status.prompt.md
    meeting.prompt.md
    decide.prompt.md
    project-scoping.prompt.md
    create-project-update.prompt.md
    sync.prompt.md
    jot.prompt.md
    brainstorm.prompt.md
    notebook.prompt.md
    todo.prompt.md
    dashboard.prompt.md
  agents/
    work-assistant.agent.md
    think-partner.agent.md
    task-manager.agent.md
    planner.agent.md
  skills/
    project-manager/
      SKILL.md
    think-partner/
      SKILL.md
    task-manager/
      SKILL.md
  hooks/
    session-sync.json
  scripts/
    session-sync.sh
AGENTS.md
.ddt/
  ...
```

## Direct Mapping From This Repo

### Safe to reuse with light edits

- `.ddt/` workspace model
- artifact schemas
- markdown templates and conventions
- dashboard runtime
- most workflow logic in commands and skills
- bootstrap script shape

### Needs substantive rewrite

- `CLAUDE.md` content and file placement
- `.claude/commands` layout
- `.claude/settings.json` hook registration
- docs and README language
- command references embedded inside skills and templates

### Can stay nearly unchanged

- `templates/config.md`
- `templates/profile.md`
- `templates/norms.md`
- `templates/registry.md`
- `templates/gitignore`
- `templates/dashboard/server.js`
- `templates/dashboard/template.html`

These are product-agnostic workspace assets.

## Recommended Conversion Strategy

### Phase 1: Create a Copilot-native scaffold

Create a parallel output structure rather than editing the Claude version in place.

Recommended new top-level layout:

```text
copilot/
  README.md
  bootstrap/
    init-workspace.sh
  templates/
    AGENTS.md
    README.md
    config.md
    profile.md
    norms.md
    registry.md
    gitignore
    dashboard/
      server.js
      template.html
    hooks/
      session-sync.json
    scripts/
      session-sync.sh
    .github/
      copilot-instructions.md
      instructions/
      prompts/
      agents/
      skills/
```

Reason:

- Keeps the Claude and Copilot editions isolated
- Makes it easier to diff behavior
- Avoids confusing mixed `.claude` and `.github` customization systems in one template set

### Phase 2: Build the minimum viable Copilot edition

Ship these first:

- `.github/copilot-instructions.md`
- `AGENTS.md`
- three skills
- four prompt files:
  - `new-project`
  - `project-status`
  - `meeting`
  - `todo`
- session sync hook
- updated bootstrap script
- updated README

This gives a usable workspace without waiting on every workflow.

### Phase 3: Add the rest of the prompts

Add:

- `decide`
- `project-scoping`
- `create-project-update`
- `sync`
- `jot`
- `brainstorm`
- `notebook`
- `dashboard`

### Phase 4: Add specialized custom agents

Once the base prompts and skills are working, add custom agents for cleaner role separation.

Do not start with too many agents. Four is enough for v1.

## Design Decisions To Keep

- Preserve the `.ddt/` data model
- Preserve explicit artifact schemas
- Preserve human-readable markdown over opaque JSON, except for todos
- Preserve team repo separation and write confirmation rules
- Preserve lightweight personal scratch + notebook flow

## Design Decisions To Change

- Replace a single large persona file with layered Copilot customizations
- Use prompt files for explicit command-like entry points
- Use agents for persona selection, not long inline routing logic
- Keep always-on instructions short
- Make hooks first-class and native to Copilot

## Constraints And Risks

### Prompt files are not universal

Prompt files are great for IDE and CLI workflows, but they should not be the only mechanism if you want strong GitHub.com usage.

Implication:

- Put reusable workflow intelligence in skills and agents
- Use prompt files as the convenient entry layer for IDE users

### Support differs by surface

Not every Copilot surface supports every customization type the same way.

Implication:

- Build for VS Code first
- Keep GitHub.com-compatible behavior in `AGENTS.md`, skills, hooks, and repository instructions

### Do not overload `copilot-instructions.md`

The current Claude operating manual is too large for Copilot's always-on instruction role.

Implication:

- Keep repository instructions concise
- Move detailed operational workflows into prompt files, skills, and `AGENTS.md`

## First Conversion Backlog

1. Create `copilot/` sibling scaffold.
2. Port bootstrap script to write `.github/*` instead of `.claude/*`.
3. Draft `.github/copilot-instructions.md`.
4. Split `CLAUDE.md` into `AGENTS.md` plus topic-specific instruction files.
5. Port the three skills to `.github/skills`.
6. Port the twelve commands to `.github/prompts/*.prompt.md`.
7. Rewrite the session sync hook into `.github/hooks/session-sync.json` plus script.
8. Rewrite README copy from "Claude Code" to "GitHub Copilot".
9. Test the prompt, agent, and hook discovery paths in VS Code.
10. Validate a sample bootstrapped workspace end to end.

## Sources

Official sources used for this plan:

- GitHub Docs, "About customizing GitHub Copilot responses"  
  https://docs.github.com/en/copilot/concepts/prompting/response-customization
- GitHub Docs, "Support for different types of custom instructions"  
  https://docs.github.com/en/copilot/reference/custom-instructions-support
- GitHub Docs, "About hooks"  
  https://docs.github.com/en/copilot/concepts/agents/coding-agent/about-hooks
- GitHub Docs, "About custom agents"  
  https://docs.github.com/en/copilot/concepts/agents/coding-agent/about-custom-agents
- GitHub Docs, "Creating custom agents for Copilot coding agent"  
  https://docs.github.com/en/copilot/how-tos/use-copilot-agents/coding-agent/create-custom-agents
- GitHub Docs, "Copilot customization cheat sheet"  
  https://docs.github.com/en/copilot/reference/customization-cheat-sheet
- GitHub Docs, "Creating agent skills for GitHub Copilot"  
  https://docs.github.com/en/copilot/how-tos/use-copilot-agents/coding-agent/create-skills
- VS Code Docs, "Custom agents in VS Code"  
  https://code.visualstudio.com/docs/copilot/customization/custom-agents
- VS Code Docs, "Use prompt files in VS Code"  
  https://code.visualstudio.com/docs/copilot/customization/prompt-files
- VS Code Docs, "Agent hooks in Visual Studio Code (Preview)"  
  https://code.visualstudio.com/docs/copilot/customization/hooks
- VS Code Docs, "Customization"  
  https://code.visualstudio.com/docs/copilot/concepts/customization
