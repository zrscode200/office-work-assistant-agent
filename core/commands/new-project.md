---
description: Create a new project with scaffold
---

Create a new project in the workspace.

## Step 1: Detect scenario

Read the user's input and determine which scenario applies:

**Scenario 1 — Exploratory:** user sounds uncertain or early-stage. Signals: uncertainty language ("thinking about", "exploring", "might", "idea for"), minimal or vague description, open questions embedded in their message, no clear stakeholders or scope yet.

**Scenario 2 — Direct:** user sounds certain and ready to create. Signals: declarative language ("we're building", "starting work on", "I need to track"), named stakeholders, defined objective, described scope. The project may be at any maturity level — what matters is that the user has what they know and just wants to record it.

**Ambiguous:** if neither is clear, ask one question:
> "Want to think this through together, or do you have what you need to create it directly?"

---

## Scenario 1: Exploratory flow

### 1. Background scan (silent)

Before responding, read:
- `.ddt/personal/scratch/.index.md` — scan the Title and Topic columns
- `.ddt/personal/notebook/` — scan entry filenames and first lines

Hold this as background context. Do not mention it yet. Do not load full entry content.

### 2. Open conversation

Start with a single open question. Keep it short — one question:
- "What's the idea?"
- "What's prompting this?"
- "Tell me about it."

Have a natural back-and-forth. Probe gently across: what it is, why now, who cares, what's in scope. Let the user lead. Ask one thing at a time.

**Mid-conversation — surfacing scratch/notebook connections:**
When a topic comes up that matches something from the background scan, surface it as a natural connection — not a database retrieval:
- "That connects to something you'd captured about X — want to pull that in?"
- "You had some notes on Y from last week — does that relate?"

If yes: read the full entry and weave relevant content into the conversation. If no: continue without it.

**Name check:** when a project name becomes clear during the conversation, check `.ddt/registry.md` immediately. If it already exists, tell the user: "Project '<name>' already exists [location, status]. Did you mean /project-status?" and stop.

### 3. Transition to synthesis

When the conversation reaches a natural lull, the user signals they've covered it ("I think that's it", "what do we have?"), or you sense sufficient clarity — offer:
> "I think I have a good picture — want me to pull this together and check for gaps?"

If the user just moves on or says "yeah, go ahead", follow their lead and proceed.

### 4. Gap-filling

Summarize what was captured in 3–4 bullet points. Identify what's still genuinely unclear. Ask only about the blanks — maximum 3 targeted questions. Do not re-ask things already covered in the conversation.

### 5. Draft and review

Produce a draft `overview.md` using the **Overview Template** below. Show it to the user. Wait for approval or corrections. Iterate if needed. Proceed only when the user approves.

### 6. Personal or team

Read `.ddt/config.md` for configured team repos:
- No team repos configured → project is personal, skip this question
- One team repo → ask: "Should this be a **<team-name>** project or **personal**?"
- Multiple team repos → ask: "Where should this project live?" and list the options

Accept `--personal` or `--<team-name>` as an argument to skip this question.

---

## Scenario 2: Direct flow

### 1. Record faithfully

Take what the user provided. Record only what is known. Do not invent content. Do not fill in what you don't know.

Read `.ddt/profile.md` for context that may help interpret what the user shared — but do not use it to fill in missing fields.

### 2. Name check

Read `.ddt/registry.md`. If a project with this name already exists:
> "Project '<name>' already exists [location, status]. Did you mean /status?"
Stop.

### 3. Personal or team

Same logic as Scenario 1 step 6.

### 4. Draft and review

Produce a draft `overview.md` using the **Overview Template** below — populated only with what the user provided. Show it to the user. Wait for approval. Proceed only when approved.

---

## Shared: Writing the project

Both scenarios converge here after the draft is approved.

### 1. Determine project root
- Personal: `.ddt/projects/<name>/`
- Team repo: look up path in `.ddt/config.md`, then `<path>/projects/<name>/`

Convert the project name to lowercase kebab-case for the folder name.

### 2. If team repo: follow the Shared Write Protocol (pull first)

### 3. Write files

**`<project-root>/overview.md`** — the approved draft

**`<project-root>/status.md`** with frontmatter and an initial body entry:

```markdown
---
health: not-started
last_updated: YYYY-MM-DD
summary:
blockers: []
risks: []
next: []
---

## YYYY-MM-DD

Project created.
```

### 4. Register

Add a row to `.ddt/registry.md`: name, location (`personal` or team repo name), status `active`, today's date.

### 5. If team repo: complete the Shared Write Protocol (show → confirm → commit → push)

### 6. Report

What was created, where it lives, and suggested next steps — e.g., "run /project-scoping to break this into tasks", "fill in stakeholders when you know them".

---

## Overview Template

Use this structure for `overview.md`. The YAML frontmatter holds structured data for machine parsing. The body is the human-readable narrative. Populate known fields with real content. For fields that are not yet known, use empty values in frontmatter and comment placeholders in the body — do not invent content.

```markdown
---
title: <Project Name>
objective: <one-sentence objective, or empty if not yet defined>
stakeholders: [<names, or empty list>]
created: YYYY-MM-DD
updated: YYYY-MM-DD
---

# <Project Name>

## Objective
<!-- not yet defined -->

## Business Context
<!-- not yet defined -->

## Stakeholders
<!-- not yet defined -->

## Approach
<!-- not yet defined -->

## Scope

### In scope
<!-- not yet defined -->

### Out of scope
<!-- not yet defined -->
```
