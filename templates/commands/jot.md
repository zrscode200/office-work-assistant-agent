---
description: Quick-capture a thought to the scratch pad
---

Capture the user's thought as a scratch pad entry with minimal friction.

## Instructions

### 1. Capture immediately

Take whatever the user says and save it. Do NOT ask clarifying questions — the point is speed.

### 2. Smart append: decide whether to create or append

Read `.ddt/personal/scratch/.index.md` (the manifest). Scan the table for a topically similar entry that is still `active`.

**If a matching active entry exists and the topic is clearly related:**
- Check the timestamp in the matching filename. Recency heuristic: prefer same-day entries by default; for entries older than 24 hours, only append if the topic match is strong; for entries older than a week, create a new file instead.
- If multiple entries are plausible matches, prefer the most recent. If still ambiguous, ask the user.
- If yes: append to the existing file with a new timestamped line.
- If the topic match is ambiguous from the filename and index alone, read the content of that one candidate file to decide.

**If no match or the existing entry feels like a different train of thought:**
- Create a new sticky note file.

### 3. Create a new sticky note (when needed)

Generate a short kebab-case slug from the content and a descriptive title.

Create `.ddt/personal/scratch/YYYY-MM-DD-HHMM-<slug>.md` with:

```markdown
# <Descriptive title>

- [HH:MM] <the user's thought, cleaned up minimally — preserve their voice>
```

### 4. Append to existing sticky note (when matched)

Add a new timestamped line at the end of the matched file:

```markdown
- [HH:MM] <the user's thought>
```

### 5. Update the index

After every create or append:
- If new file: add a row to `.ddt/personal/scratch/.index.md` with the filename, a brief topic description, status `active`, and empty Promoted To.
- If append: no index change needed (file and topic haven't changed).
- If the index doesn't exist yet, create it with the table header and the new row.

### 6. Confirm

Report what was saved: whether it was a new sticky note or appended to an existing one, the filename, and the title. Keep confirmation brief — one or two lines.

## Tone

Fast, lightweight. Like jotting on a sticky note. Don't over-process what the user said.
