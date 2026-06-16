---
description: Create a structured decision record for a project
---

Document a decision.

## Instructions

1. Identify which project this decision relates to. Resolve the project using the Project Resolution Protocol. If unclear, ask.
2. Ask for (or extract from the user's message):
   - What decision needs to be / was made
   - Context: what prompted this
   - Options considered
   - What was chosen (or help the user think through it)
3. If the project is in a team repo, follow the **Shared Write Protocol** in CLAUDE.md (pull first).
4. Create `<project-root>/decisions/<decision-name>.md` with YAML frontmatter and a markdown body:

   ```markdown
   ---
   date: YYYY-MM-DD
   status: decided | pending | revisited
   participants: [<names>]
   ---

   # <Decision Name>

   ## Context
   What prompted this decision.

   ## Options Considered

   ### Option A
   Description, pros, cons.

   ### Option B
   Description, pros, cons.

   ## Decision
   What was chosen.

   ## Rationale
   Why this option over others.

   ## Revisit if
   Conditions that would warrant reopening this decision.
   ```
5. If the project is in a team repo, complete the Shared Write Protocol (show changes, confirm, commit, push).
6. If the decision is still pending (user is thinking it through), set status to "pending" and help structure the options and tradeoffs.
