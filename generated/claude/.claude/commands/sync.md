---
description: "Pull or publish shared context"
---

Read sync-status, then sync-fetch for fresh ahead/behind counts. Pull only when authorized. Show exact destination, record changes, and message before publication; use the documented digest-checked publish command. If a push is rejected because the remote moved, use sync-fetch, sync-rebase (field-level record merge with explicit resolution), then sync-push. Never stage all, force push, run raw Git rebase, or send unrelated commits.

Read `CLAUDE.md` and `.ddt/runtime/WORKFLOWS.md`. Use its shared helper and revision/privacy rules. These commands are convenience entry points; the user can express the same intent naturally.
