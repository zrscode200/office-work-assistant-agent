---
description: Add a comment, question, or note to a project
---

Add a quick comment to a project's comment thread.

## Instructions

### 1. Capture immediately

Take whatever the user says and treat it as the comment content. Like `/jot`, speed matters — do NOT over-process or ask clarifying questions about the content itself.

### 2. Resolve the project

If the user names a project, resolve it using the Project Resolution Protocol. If unclear from context, ask which project.

### 3. Get commenter identity

Read the `name` field from `.ddt/profile.md`. If not set, ask the user's name once and use it.

### 4. If team repo: Shared Write Protocol (pull first)

If the project is in a team repo, follow the **before writing** steps of the Shared Write Protocol in CLAUDE.md.

### 5. Write the comment

Read or create `<project-root>/comments.md`. Prepend a new entry immediately after the frontmatter:

```markdown
---
last_updated: YYYY-MM-DD
---

#### YYYY-MM-DD HH:MM — Author Name
The comment content here.

#### <previous entries...>
```

**Format rules:**
- Use `####` as the entry delimiter
- Timestamp includes date and time: `YYYY-MM-DD HH:MM`
- Author name from profile.md
- Content: preserve the user's voice, minimal cleanup only
- Newest entries first (prepend)
- Update `last_updated` in frontmatter to today's date

**If `comments.md` doesn't exist yet**, create it with the frontmatter and the first entry.

### 6. If team repo: Shared Write Protocol (complete)

Show what was written, confirm with user, commit and push.

**Commit message:** `"Add comment: <project> (YYYY-MM-DD)"`

### 7. Confirm

Brief confirmation: which project, that the comment was added. One or two lines — don't repeat the comment back unless it was substantially cleaned up.

## Tone

Fast and lightweight. A comment is a sticky note on the project, not a formal artifact.
