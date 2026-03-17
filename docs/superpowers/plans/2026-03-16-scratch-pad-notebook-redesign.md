# Scratch Pad & Notebook Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce a two-tier capture system — a low-friction scratch pad for quick jots and an organized notebook for developed thinking — with smart append, a manifest index, promotion flow, and auto-capture nudges.

**Architecture:** Rewrite `/jot` to write to `.ddt/personal/scratch/` with smart append logic and a `.index.md` manifest. Update `/notebook` to support scratch pad browsing, promotion to notebook entries, and cleanup. Update the `muse` skill for auto-capture nudges. Update `CLAUDE.md`, the bootstrap script, and `README.md` to reflect the new structure.

**Tech Stack:** Markdown templates (Claude Code skills/commands), POSIX shell (bootstrap script)

**Spec:** `docs/superpowers/specs/2026-03-16-scratch-pad-notebook-redesign-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `templates/commands/jot.md` | Rewrite | Scratch pad capture: smart append, index management, file creation |
| `templates/commands/notebook.md` | Rewrite | Notebook browsing, scratch pad overview, promotion flow, cleanup |
| `templates/commands/brainstorm.md` | Modify | Add scratch pad context check at start |
| `templates/skills/muse/SKILL.md` | Modify | Update routing table, add auto-capture nudge behavior |
| `templates/CLAUDE.md` | Modify | Update workspace structure, add scratch pad docs, auto-capture behavior |
| `bootstrap/init-workspace.sh` | Modify | Create `.index.md` on bootstrap |
| `README.md` | Modify | Update workspace structure section |

---

## Chunk 1: Core Scratch Pad Commands

### Task 1: Rewrite `/jot` command

**Files:**
- Rewrite: `templates/commands/jot.md`

The core change. `/jot` moves from writing structured notebook entries to writing raw scratch pad sticky notes with smart append logic.

- [ ] **Step 1: Read the current `templates/commands/jot.md`**

Confirm current behavior: writes to `.ddt/personal/notebook/` with full frontmatter.

- [ ] **Step 2: Rewrite `templates/commands/jot.md`**

Replace the entire file with:

```markdown
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

` ` `markdown
# <Descriptive title>

- [HH:MM] <the user's thought, cleaned up minimally — preserve their voice>
` ` `

### 4. Append to existing sticky note (when matched)

Add a new timestamped line at the end of the matched file:

` ` `markdown
- [HH:MM] <the user's thought>
` ` `

### 5. Update the index

After every create or append:
- If new file: add a row to `.ddt/personal/scratch/.index.md` with the filename, a brief topic description, status `active`, and empty Promoted To.
- If append: no index change needed (file and topic haven't changed).
- If the index doesn't exist yet, create it with the table header and the new row.

### 6. Confirm

Report what was saved: whether it was a new sticky note or appended to an existing one, the filename, and the title. Keep confirmation brief — one or two lines.

## Tone

Fast, lightweight. Like jotting on a sticky note. Don't over-process what the user said.
```

Note: Replace the triple backticks with indentation that uses actual backticks (the escaped ones above are for the plan only).

- [ ] **Step 3: Verify the rewritten file**

Read `templates/commands/jot.md` and confirm:
- Description says "scratch pad" not "notebook"
- Smart append logic references `.index.md`
- File path targets `.ddt/personal/scratch/`
- Filename format is `YYYY-MM-DD-HHMM-<slug>.md`
- Content format uses `# Title` + timestamped entries
- Index update instructions are present

- [ ] **Step 4: Commit**

```bash
git add templates/commands/jot.md
git commit -m "rewrite /jot to target scratch pad with smart append logic"
```

---

### Task 2: Rewrite `/notebook` command

**Files:**
- Rewrite: `templates/commands/notebook.md`

Update notebook to show scratch pad overview, support promotion, and handle cleanup.

- [ ] **Step 1: Read the current `templates/commands/notebook.md`**

Confirm current behavior: lists notebook entries, supports revisit/develop/graduate.

- [ ] **Step 2: Rewrite `templates/commands/notebook.md`**

Replace the entire file with:

```markdown
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

` ` `markdown
---
date: YYYY-MM-DD
projects: []
status: developing
graduated_to:
---

# <Title>

<Synthesized content from scratch pad entry>
` ` `

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
2. Suggest the appropriate command: `/decide`, `/plan`, `/new-project`, etc.
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
```

- [ ] **Step 3: Verify the rewritten file**

Read `templates/commands/notebook.md` and confirm:
- Shows both scratch pad and notebook in overview
- Promotion flow reads index, synthesizes content, updates index status
- Graduation flow unchanged
- Cleanup is explicit, never auto-deletes
- Filtering supports both layers

- [ ] **Step 4: Commit**

```bash
git add templates/commands/notebook.md
git commit -m "rewrite /notebook to support scratch pad overview, promotion, and cleanup"
```

---

### Task 3: Update `/brainstorm` command

**Files:**
- Modify: `templates/commands/brainstorm.md:17-19` (the "Gather context" section)

- [ ] **Step 1: Read current `templates/commands/brainstorm.md`**

Confirm section 2 ("Gather context") currently checks notebook but not scratch pad.

- [ ] **Step 2: Add scratch pad check to "Gather context" section**

In section 2, after the line about checking `.ddt/personal/notebook/`, add a check for scratch pad:

```markdown
- Check `.ddt/personal/scratch/.index.md` for active entries related to the topic — surface connections if you find them.
```

The updated section 2 should read:

```markdown
### 2. Gather context

- Read `.ddt/profile.md` for the user's role and perspective.
- If the topic references a project, read relevant project artifacts for context.
- Check `.ddt/personal/notebook/` for related past entries — surface connections if you find them.
- Check `.ddt/personal/scratch/.index.md` for active scratch entries related to the topic — surface connections if you find them.
```

- [ ] **Step 3: Verify the edit**

Read `templates/commands/brainstorm.md` and confirm section 2 now checks both notebook and scratch pad.

- [ ] **Step 4: Commit**

```bash
git add templates/commands/brainstorm.md
git commit -m "add scratch pad context check to /brainstorm"
```

---

## Chunk 2: Skill, CLAUDE.md, Bootstrap, and README

### Task 4: Update `muse` skill

**Files:**
- Modify: `templates/skills/muse/SKILL.md`

Two changes: update the routing table to reflect scratch/notebook distinction, and add auto-capture nudge behavior.

- [ ] **Step 1: Read current `templates/skills/muse/SKILL.md`**

- [ ] **Step 2: Replace the description in frontmatter**

Replace the entire `description:` value in the frontmatter with the following (this is a full replacement, not an append):

```
description: Use this skill when the user wants to think through an idea, capture a quick thought, explore something uncertain, or revisit past thinking. Also activates when the user expresses an idea worth capturing during general conversation. Trigger when the user says "I'm thinking about...", "what if we...", "help me think through...", "I have an idea...", "jot this down...", "let me brainstorm...", "what are my options for...", or describes uncertain/exploratory thinking. Do not trigger for structured project management requests (use project-manager skill instead).
```

- [ ] **Step 3: Update the routing table**

Update the routing table to clarify that `/jot` goes to scratch pad:

```markdown
| User intent | Command to follow |
|---|---|
| Quick dump of a thought, wants to capture something fast | `/jot` (writes to scratch pad) |
| Wants to think through an idea interactively | `/brainstorm` |
| Wants to browse, revisit, promote, or manage past entries | `/notebook` |
```

- [ ] **Step 4: Add auto-capture nudge section**

After the "Boundary with project-manager" section, add:

```markdown
## Auto-Capture Nudge

When the user expresses an idea, option, or interesting thought during conversation — even if they haven't asked you to save it — proactively offer to capture it:

- "That sounds worth capturing — want me to jot it?"
- Wait for confirmation before writing. Do not silently capture in the background.
- If the user agrees, follow the `/jot` command approach (writes to scratch pad).
- If the user declines, continue the conversation without saving.
- Use judgment: don't offer after every sentence. Nudge when something substantive emerges that the user might want to revisit later.
```

- [ ] **Step 5: Verify the edits**

Read `templates/skills/muse/SKILL.md` and confirm:
- Routing table mentions scratch pad for `/jot`
- Auto-capture nudge section exists
- Boundary with project-manager is preserved

- [ ] **Step 6: Commit**

```bash
git add templates/skills/muse/SKILL.md
git commit -m "update muse skill with scratch pad routing and auto-capture nudge"
```

---

### Task 5: Update `CLAUDE.md` template

**Files:**
- Modify: `templates/CLAUDE.md`

Update the workspace structure and add scratch pad documentation.

- [ ] **Step 1: Read current `templates/CLAUDE.md`**

- [ ] **Step 2: Update the workspace structure diagram**

In the workspace structure section, update the `personal/` section to show both layers clearly:

```markdown
  personal/
    scratch/                        # quick-capture sticky notes (gitignored)
      .index.md                     # manifest: tracks entries, topics, promotion status
      YYYY-MM-DD-HHMM-<slug>.md    # sticky notes (timestamped jots)
    notebook/
      YYYY-MM-DD-<slug>.md          # developed notebook entries (thoughts, ideas, brainstorms)
```

- [ ] **Step 3: Add scratch pad section under "How You Work"**

After the existing "Think" section, clarify the two tiers. Update the "Think" section content:

```markdown
### Think
When the user has ideas that aren't fully formed:
- Capture thoughts quickly to the scratch pad (sticky notes in `.ddt/personal/scratch/`)
- Act as a thinking partner for brainstorming (results go to notebook)
- Surface connections to existing projects, notebook entries, and scratch pad topics
- Offer a path to promote scratch entries into notebook entries, and graduate notebook entries into structured artifacts when ready
- Proactively offer to capture ideas that surface during conversation: "That sounds worth capturing — want me to jot it?" Wait for confirmation before writing.
```

- [ ] **Step 4: Add scratch pad naming conventions**

In the Naming Conventions section, add:

```markdown
- Scratch pad entries: `YYYY-MM-DD-HHMM-<slug>.md` (e.g., `2026-03-16-1430-api-vendor-options.md`)
```

- [ ] **Step 5: Update "Shared vs. Personal" section**

In the "Shared vs. Personal" subsection, update the bullet about personal items. Change:
```markdown
- **Notebook entries, scratch, draft communications** are always personal. They never go to the shared repo.
```
To:
```markdown
- **Scratch pad entries, notebook entries, draft communications** are always personal. They never go to the shared repo.
```

- [ ] **Step 6: Verify the edits**

Read `templates/CLAUDE.md` and confirm:
- Workspace structure shows scratch pad with `.index.md`
- Think section mentions both tiers and auto-capture
- Naming conventions include scratch pad format
- Shared vs. Personal bullet uses "scratch pad" terminology

- [ ] **Step 7: Commit**

```bash
git add templates/CLAUDE.md
git commit -m "update CLAUDE.md with scratch pad structure and auto-capture behavior"
```

---

### Task 6: Update bootstrap script

**Files:**
- Modify: `bootstrap/init-workspace.sh`

Create `.index.md` on bootstrap and handle `--update` mode.

- [ ] **Step 1: Read current `bootstrap/init-workspace.sh`**

- [ ] **Step 2: Add `.index.md` creation after the `.gitkeep` section**

After the block that creates `.ddt/personal/scratch/.gitkeep` (around line 188), add:

```bash
# Scratch pad index
if [ ! -e "$TARGET_DIR/.ddt/personal/scratch/.index.md" ]; then
  cat > "$TARGET_DIR/.ddt/personal/scratch/.index.md" <<'INDEXEOF'
# Scratch Pad Index

| File | Topic | Status | Promoted To |
|------|-------|--------|-------------|
INDEXEOF
  echo "create: .ddt/personal/scratch/.index.md"
fi
```

Note: `.index.md` is a user file — it should never be overwritten by `--update` mode (same as config.md and profile.md). The `[ ! -e ]` guard handles this.

- [ ] **Step 3: Update the usage text**

In the `usage()` function, update the scratch pad description line from:
```
  - .ddt/personal/scratch/ (private scratch space, gitignored)
```
to:
```
  - .ddt/personal/scratch/ (quick-capture scratch pad with index, gitignored)
```

- [ ] **Step 4: Update the completion message**

In the `--update` completion message, add `.index.md` to the list of user files not touched:
```
User files (.ddt/config.md, profile.md, norms.md, projects/, notebook/, scratch/.index.md) were not touched.
```

- [ ] **Step 5: Verify the edits**

Read `bootstrap/init-workspace.sh` and confirm:
- `.index.md` is created with proper table header
- Not overwritten in `--update` mode
- Usage text updated

- [ ] **Step 6: Test the bootstrap script**

```bash
# Create a temp directory and bootstrap it
TMPDIR=$(mktemp -d)
./bootstrap/init-workspace.sh "$TMPDIR"
# Verify .index.md exists and has correct content
cat "$TMPDIR/.ddt/personal/scratch/.index.md"
# Verify --update doesn't overwrite it
echo "| test.md | test | active | |" >> "$TMPDIR/.ddt/personal/scratch/.index.md"
./bootstrap/init-workspace.sh --update "$TMPDIR"
cat "$TMPDIR/.ddt/personal/scratch/.index.md"
# Clean up
rm -rf "$TMPDIR"
```

Expected: `.index.md` created on first run, preserved (with extra row) on `--update`.

- [ ] **Step 7: Commit**

```bash
git add bootstrap/init-workspace.sh
git commit -m "create scratch pad .index.md on bootstrap"
```

---

### Task 7: Update README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Read current `README.md`**

- [ ] **Step 2: Update the workspace structure section**

In the "Workspace Structure" section, update the `personal/` block to match the new structure:

```markdown
    personal/
      scratch/                           # quick-capture scratch pad (gitignored)
        .index.md                        # manifest tracking entries and promotion status
        YYYY-MM-DD-HHMM-<slug>.md       # sticky notes
      notebook/                          # developed ideas and brainstorms (gitignored)
        YYYY-MM-DD-<slug>.md             # notebook entries
```

- [ ] **Step 3: Update the "Think" bullet in "The assistant helps with"**

Change:
```markdown
- **Think** — capture ideas, brainstorm interactively, develop thoughts over time
```
To:
```markdown
- **Think** — capture ideas to a scratch pad, brainstorm interactively, develop thoughts into notebook entries over time
```

- [ ] **Step 4: Update the Notebook & Thinking commands table**

Update the `/jot` and `/notebook` descriptions:

```markdown
| `/jot` | Quick-capture a thought to the scratch pad |
| `/brainstorm` | Think through an idea interactively |
| `/notebook` | Browse scratch pad and notebook, promote entries, manage thinking |
```

- [ ] **Step 5: Verify the edits**

Read `README.md` and confirm:
- Workspace structure shows scratch pad with `.index.md`
- Think description mentions scratch pad
- Command table descriptions updated

- [ ] **Step 6: Commit**

```bash
git add README.md
git commit -m "update README with scratch pad and two-tier capture structure"
```

---

## Task Dependency Summary

```
Task 1 (/jot)  ─────┐
Task 2 (/notebook) ──┤── Chunk 1: Core commands (independent of each other)
Task 3 (/brainstorm) ┘

Task 4 (muse skill) ─┐
Task 5 (CLAUDE.md) ──┤── Chunk 2: Supporting files (independent of each other,
Task 6 (bootstrap) ──┤   but should be done after Chunk 1 for consistency)
Task 7 (README) ─────┘
```

All tasks within each chunk are independent and can be executed in parallel.
