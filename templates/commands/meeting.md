---
description: Capture a meeting summary for a project
---

Capture a meeting summary.

## Instructions

1. Identify which project this meeting relates to. Resolve the project using the Project Resolution Protocol. If unclear, ask.
2. Ask for (or extract from the user's message):
   - Date (default to today if not specified)
   - Attendees
   - Purpose / topic
   - What was discussed
3. If the project is shared, follow the **Shared Write Protocol** in CLAUDE.md (pull first).
4. Create `<project-root>/meetings/YYYY-MM-DD-<topic>.md` with:
   - **Date:** YYYY-MM-DD
   - **Attendees:** list
   - **Purpose:** one line
   - **Discussion:** key points as bullets (concise, not a transcript)
   - **Decisions:** any decisions made (with brief rationale)
   - **Action Items:** each with owner and deadline
5. If the project is shared, complete the Shared Write Protocol (show changes, confirm, commit, push).
6. If significant decisions were made, suggest creating a decision record with `/decide`.
7. If action items affect project status or plan, mention that `/status` can be updated.
