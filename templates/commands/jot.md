---
description: Quick-capture a thought to the notebook
---

Capture the user's thought as a notebook entry with minimal friction.

## Instructions

1. Take whatever the user says and save it immediately. Do NOT ask a bunch of clarifying questions — the point is speed.
2. Generate a short kebab-case slug from the content for the filename.
3. If projects are mentioned or obvious from context, tag them in `projects:`. Otherwise leave it empty.
4. Create `.ddt/personal/notebook/YYYY-MM-DD-<slug>.md` with:

```markdown
---
date: YYYY-MM-DD
projects: []
status: scratch
graduated_to:
---

# <title derived from content>

<the user's thought, cleaned up minimally — preserve their voice>
```

5. Set status to `scratch`.
6. Confirm what was saved: filename, title, and any project tags. Keep the confirmation brief.

## Tone

Fast, lightweight. Like jotting on a sticky note. Don't over-process what the user said.
