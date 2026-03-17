# Scratch Pad & Notebook Redesign

**Date:** 2026-03-16
**Status:** Approved

## Problem

The current system has three issues:

1. `/jot` writes to `.ddt/personal/notebook/` with full frontmatter (date, projects, status, title) — too much ceremony for quick thought capture.
2. `.ddt/personal/scratch/` is created by the bootstrap but nothing reads or writes to it — a dead directory.
3. Ideas that surface naturally in conversation aren't captured. The agent never proactively offers to save thoughts.

## Design

### Two-Tier Capture System

**Tier 1 — Scratch Pad** (`.ddt/personal/scratch/`)

The quick-capture layer. Low friction, raw, append-friendly.

- `/jot` writes here instead of notebook.
- Files are "sticky notes": `YYYY-MM-DD-HHMM-<topic-slug>.md` (time component allows multiple jots per day per topic and provides timestamps for recency checks; notebook entries use `YYYY-MM-DD` since they are less frequent)
- Content format:

```markdown
# Descriptive Title

- [14:30] First thought captured here...
- [15:10] Related follow-up thought...
- [16:45] Another addition...
```

- **Smart append logic:** When a jot comes in, the agent:
  1. Reads `.ddt/personal/scratch/.index.md` (the manifest — one file, cheap).
  2. Matches the incoming topic against existing entry topics in the index.
  3. If a topically similar entry exists and is recent enough, appends to that file. Recency heuristic: prefer same-day entries by default; for entries older than 24 hours, only append if the topic match is strong; for entries older than a week, create a new file. If multiple entries are plausible matches, prefer the most recent; if still ambiguous, ask the user.
  4. Only reads the content of a candidate file if the topic match is ambiguous from the filename/index alone.
  5. Otherwise, creates a new sticky note file.
- **Manifest:** `.ddt/personal/scratch/.index.md` tracks all entries:

```markdown
# Scratch Pad Index

| File | Topic | Status | Promoted To |
|------|-------|--------|-------------|
| 2026-03-16-1430-api-vendor-options.md | API vendor evaluation | active | |
| 2026-03-15-0900-onboarding-flow.md | New hire onboarding ideas | promoted | notebook/2026-03-16-onboarding-redesign.md |
```

- The agent updates the index whenever it creates or promotes an entry. On append, no index update is needed since the filename, topic, and status are unchanged.

**Tier 2 — Notebook** (`.ddt/personal/notebook/`)

The organized layer. Structured entries with frontmatter. Unchanged from current design.

- Fed from: promoted scratch entries, brainstorm sessions, or created directly.
- Frontmatter (date, projects, status, graduated_to) stays as-is.
- Graduation to formal artifacts (`/decide`, `/plan`, `/new-project`) stays as-is.

### Auto-Capture Behavior

The agent proactively nudges during conversation when ideas surface:

- When the user describes an idea, option, or thought that isn't being formally captured, the agent offers: "That sounds worth capturing — want me to jot it?"
- The agent waits for confirmation before writing. It does not silently capture in the background.
- This behavior is defined in the `muse` skill and referenced in `CLAUDE.md`.

### Promotion Flow (Scratch to Notebook)

When the user wants to organize scratch entries (via `/notebook` or natural language):

1. Agent reads `.index.md` for overview — no need to read every file.
2. User picks specific topics or asks for suggestions.
3. Agent reads only the selected scratch file(s).
4. Synthesizes timestamped jots into a coherent notebook entry with proper frontmatter.
5. Writes to `.ddt/personal/notebook/`.
6. Updates `.index.md`: sets status to `promoted`, fills in `Promoted To` path.
7. Scratch file is preserved — it's the thinking trail.

### Cleanup

- Agent can suggest tidying promoted entries older than a user-defined threshold.
- Cleanup is always explicit — never auto-deletes.
- Triggered by `/notebook` overview or natural language ("clean up my scratch pad").

### Promotion Path

```
conversation -> auto-nudge / /jot -> scratch pad (.index.md tracks it)
                                         |
                                         v (organize when ready)
                               /notebook promote -> notebook entry
                                                        |
                                                        v (graduate when ready)
                                                 /decide, /plan, /new-project
```

## Files Changed

| File | Change |
|------|--------|
| `templates/commands/jot.md` | Rewrite: target scratch pad, smart append logic, index updates |
| `templates/commands/notebook.md` | Add: scratch pad overview, promotion flow, cleanup support |
| `templates/commands/brainstorm.md` | Update: check scratch pad for related entries as starting context |
| `templates/skills/muse/SKILL.md` | Update: routing for scratch/notebook distinction, auto-capture nudge |
| `templates/CLAUDE.md` | Update: workspace structure docs, add auto-capture behavior |
| `bootstrap/init-workspace.sh` | Update: create `.index.md` on bootstrap |
| `README.md` | Update: workspace structure section |

## What Doesn't Change

- `/brainstorm` still writes to notebook (it's a developed session, not a jot)
- Notebook frontmatter and graduation flow
- All project-manager commands and skill
- Shared repo behavior
- `.ddt/personal/scratch/` remains gitignored
