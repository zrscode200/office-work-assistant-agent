---
description: Create or update a project plan with tasks and milestones
---

Create or update a project plan.

## Instructions

1. If a project name was provided, use it. If not, list available projects and ask.
2. Read `.ddt/projects/<project>/overview.md` for scope and context.
3. Read `.ddt/projects/<project>/plan.md` if it exists (update rather than replace).
4. Read `.ddt/profile.md` to understand the user's role and calibrate the plan's altitude.
5. Create or update `.ddt/projects/<project>/plan.md` with:
   - **Objective:** (from overview)
   - **Approach:** high-level strategy
   - **Tasks:**
     - Organized in logical phases or workstreams
     - Each task: description, owner (if known), dependencies, status (not-started / in-progress / done)
   - **Milestones:** key checkpoints with target dates (if known)
   - **Risks & Unknowns:** things that could derail the plan
   - **Open Questions:** things that need answers before proceeding
6. Keep the plan at the right level of detail for the user's role. An executive's plan has fewer, larger tasks. An engineer's plan has more granular tasks.
