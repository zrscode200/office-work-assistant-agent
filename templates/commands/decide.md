---
description: Create a structured decision record for a project
---

Document a decision.

## Instructions

1. Identify which project this decision relates to. If unclear, ask.
2. Ask for (or extract from the user's message):
   - What decision needs to be / was made
   - Context: what prompted this
   - Options considered
   - What was chosen (or help the user think through it)
3. Create `.ddt/projects/<project>/decisions/<decision-name>.md` with:
   - **Date:** YYYY-MM-DD
   - **Status:** decided / pending / revisited
   - **Context:** what prompted this decision
   - **Options Considered:**
     - Option A: description, pros, cons
     - Option B: description, pros, cons
     - (more as needed)
   - **Decision:** what was chosen
   - **Rationale:** why this option over others
   - **Participants:** who was involved in making this decision
   - **Revisit if:** conditions that would warrant reopening this decision
4. If the decision is still pending (user is thinking it through), set status to "pending" and help structure the options and tradeoffs.
