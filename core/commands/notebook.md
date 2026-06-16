---
description: Browse, revisit, and manage notebook entries and scratch pad
---

Help the user navigate their notebook entries and scratch pad.

## Instructions

### 1. If no arguments — show overview of both layers

**Scratch Pad** (`.ddt/personal/scratch/`):
- Read `.ddt/personal/scratch/.index.md`.
- Show active entries as a summary table:

| Date | Title | Topic | Status |
|------|-------|-------|--------|

- Sort by most recent first.
- If there are no active entries, say "Scratch pad is empty."

**Notebook** (`.ddt/personal/notebook/`):
- Read all entries in `.ddt/personal/notebook/`.
- Present a summary table:

| Date | Title | Status | Projects |
|------|-------|--------|----------|

- Sort by most recent first.
- If there are many entries, group by status or by project tag.

### 2. If the user wants to promote a scratch entry to a notebook entry

1. If they name a topic, find the matching entry in `.index.md`. If ambiguous, show candidates and ask.
2. Read the scratch file content.
3. Synthesize the timestamped jots into a coherent notebook entry — not a copy-paste, but a cleaned-up summary that preserves the key ideas.
4. Present the draft notebook entry for the user to review.
5. On approval, create `.ddt/personal/notebook/YYYY-MM-DD-<slug>.md` with:

```markdown
---
date: YYYY-MM-DD
projects: []
status: developing
graduated_to:
---

# <Title>

<Synthesized content from scratch pad entry>
```

6. Update `.ddt/personal/scratch/.index.md`: set the scratch entry's status to `promoted` and fill in the `Promoted To` column with the relative path (e.g., `notebook/YYYY-MM-DD-<slug>.md`).
7. Confirm what was created and where.

### 3. If the user picks a notebook entry to revisit

- Read the entry and present a summary.
- Ask what they want to do:
  - **Continue developing** — switch into brainstorm mode using this entry as the starting point. Append new thinking to the entry (don't overwrite original content). Update status to `developing` if it was `scratch`.
  - **Connect to a project** — update the `projects:` field in frontmatter.
  - **Graduate** — see graduation flow below.
  - **Just review** — no changes needed.

### 4. If the user wants to filter

Support filtering by:
- **Project:** "show me notebook entries about upstream-biologics"
- **Status:** "what's still developing?" or "what's been graduated?"
- **Date range:** "what did I jot down this week?"
- **Layer:** "show me just the scratch pad" or "show me just the notebook"

### 5. Graduation flow (notebook to formal artifact)

When the user wants to turn a notebook entry into a structured artifact:
1. Ask what it should become: decision record, plan input, meeting prep, project overview, etc.
2. Suggest the appropriate command: `/decide`, `/project-scoping`, `/new-project`, etc.
3. After the artifact is created, update the notebook entry:
   - Set status to `graduated`
   - Set `graduated_to:` to the path of the new artifact
4. The notebook entry is preserved — it's the thinking trail behind the artifact.

### 6. Cleanup

When the user asks to clean up the scratch pad (or you notice many promoted entries):
- Read `.index.md` and list promoted entries.
- Show the user which entries have been promoted and when.
- Ask which ones to delete. Never auto-delete.
- On confirmation, delete the scratch files and remove their rows from `.index.md`.

## Tone

Organized but not rigid. Like flipping through a notebook with someone helping you find things.
