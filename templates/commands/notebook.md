---
description: Browse, revisit, and manage notebook entries
---

Help the user navigate and work with their notebook entries.

## Instructions

### 1. If no arguments — show a summary

- Read all entries in `.ddt/personal/notebook/`.
- Present a summary table:

| Date | Title | Status | Projects |
|------|-------|--------|----------|

- Sort by most recent first.
- If there are many entries, group by status or by project tag.
- Keep it scannable.

### 2. If the user picks an entry to revisit

- Read the entry and present a summary.
- Ask what they want to do:
  - **Continue developing** — switch into brainstorm mode using this entry as the starting point. Append new thinking to the entry (don't overwrite original content). Update status to `developing` if it was `scratch`.
  - **Connect to a project** — update the `projects:` field in frontmatter.
  - **Graduate** — see graduation flow below.
  - **Just review** — no changes needed.

### 3. If the user wants to filter

Support filtering by:
- **Project:** "show me notebook entries about upstream-biologics"
- **Status:** "what's still in scratch?" or "what have I been developing?"
- **Date range:** "what did I jot down this week?"

### 4. Graduation flow

When the user wants to turn an entry into a structured artifact:
1. Ask what it should become: decision record, plan input, meeting prep, project overview, etc.
2. Suggest the appropriate command: `/decide`, `/plan`, `/new-project`, etc.
3. After the artifact is created, update the notebook entry:
   - Set status to `graduated`
   - Set `graduated_to:` to the path of the new artifact
4. The notebook entry is preserved — it's the thinking trail behind the artifact.

## Tone

Organized but not rigid. Like flipping through a notebook with someone helping you find things.
