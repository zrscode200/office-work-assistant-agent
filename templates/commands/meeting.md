---
description: Capture a meeting summary for a project
---

Capture a meeting summary.

## Instructions

1. Identify which project this meeting relates to. If unclear, ask. If it spans multiple projects, pick the primary one and cross-reference.
2. Ask for (or extract from the user's message):
   - Date (default to today if not specified)
   - Attendees
   - Purpose / topic
   - What was discussed
3. Create `.ddt/projects/<project>/meetings/YYYY-MM-DD-<topic>.md` with:
   - **Date:** YYYY-MM-DD
   - **Attendees:** list
   - **Purpose:** one line
   - **Discussion:** key points as bullets (concise, not a transcript)
   - **Decisions:** any decisions made (with brief rationale)
   - **Action Items:** each with owner and deadline
4. If significant decisions were made, suggest creating a decision record with `/decide`.
5. If action items affect project status or plan, mention that `/status` can be updated.
