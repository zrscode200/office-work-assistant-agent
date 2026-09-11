# Verification

Run `./tests/run.sh` from the toolkit. Requires Node.js 18+, Python 3, Git, and POSIX shell; no dependencies or live services are installed/contacted.

- Renderer parity and syntax checks cover the common runtime and all five generated distributions.
- Installer fixtures cover all five runtimes, paths with spaces, repeat installation, update restoration of managed files, customized config/data preservation, individual ignore-rule reconciliation (including CRLF files and user negations), executable hook modes, unsupported runtimes, symlink preflight, the install manifest (kept versus managed files, legacy backups, drift notices for user-owned files, orphan reports, runtime detection), strict flag parsing, `--no-git`, and the toolkit-tree guard.
- Runtime fixtures cover note identity, linked work, completion/reopening, stale revision rejection, failed-write preservation, scope/symlink boundaries, explicit legacy adoption with field validation and id-keyed todos, retained source bytes, adoption drift and its acknowledgement, author defaulting, team-wide listing, linked private context and brief audiences, search and single-record reads, malformed-record isolation, file-name identity, and dead-writer lock recovery.
- Jira fixtures inject responses to verify API selection, bearer and basic authentication headers, default site resolution, execution ownership, private cache provenance, retained snapshots on errors, concurrent refresh rejection, older-response protection, and refresh visibility in catch-up. They do not verify a real tenant or its OAuth configuration.
- Collaboration fixtures use two disposable local clones and a local bare remote, including clones nested under `teams/` inside each workspace with the containment refusals (a team location equal to or containing the workspace, inside `.ddt`, or not a repository) and the workspace-ignore report. They verify exact-byte publication, explicit destinations, staged/outgoing exclusions, propagation, failed-push retry, arrival-aware catch-up, pull tolerance of untracked files, and fetch/rebase recovery with field-level record merging and explicit conflict resolution, including plumbing replay that bypasses repository hooks, records created on both sides, upstream removals, identity fields, and validation of resolved records. Helper Git calls run with a neutral global configuration. No production repository is used.
- HTTP fixtures exercise the real request handler in process to test navigation, read-only GETs, token/origin/Host protections, and revision-checked completion. Safe DOM construction and the documented SessionStart hook output shape are checked. Listening sockets and real browser QA remain unverified by the suite.

Fixture directories are uniquely allocated under the system temporary directory and removed after checks. Tests never rewrite source or expected snapshots to obtain a pass. Installer tests compare every generated file; user-owned sentinels are compared byte-for-byte after upgrades.

Before accepting a change, run the full suite and independently review the combined source diff against its intended behavior. Report live service, native assistant discovery, and browser verification separately from deterministic fixture results.

## Copilot CLI adapter

Distribution fixtures additionally verify native `.github` skill/agent placement, name/frontmatter agreement, reference resolution, the concise instruction entry point, and byte-identical shared runtime/manual. They exercise the installed Node CLI for a project, stable note, and linked follow-up. Existing `AGENTS.md`, `CLAUDE.md`, Copilot repository instructions, and unrelated customizations remain byte-for-byte intact through install/update.

Native verification is separate: launch an installed/authenticated Copilot CLI in a disposable installed workspace, inspect `/instructions`, `/skills list`, `/skills info office-projects`, and `/agent`, then exercise capture/develop/brief on synthetic content. Never replace this with a claim that fixture parsing proves Copilot discovery. In this implementation environment the installed CLI failed at startup with `SecItemCopyMatching -50`, so native discovery and model-backed execution remain unverified; no credentials or permissions were changed to bypass it.

### Copilot tutorial conversation checks

The renderer supports Copilot-native skill/reference overrides with common fallback. Distribution checks verify those exact tutorial/skill assets reach fresh and updated workspaces, while unrelated customization remains intact. File and installer checks do not establish the assistant's conversational behavior.

On a working authenticated Copilot CLI, use disposable content and review these scenarios. These model-driven scenarios have not been executed in this environment:

| Scenario | Expected behavior |
| --- | --- |
| Fresh workspace: “I'm new. Give me a tour without saving.” | Discover the tutorial through the agent or office-projects skill, explain one step at a time, mark examples unsaved, perform no record/config writes, team scan, network requests, or server startup. |
| Existing workspace with custom instructions and records: “Help me get started.” | Managed agent/skill still offers the tour; preserve the instruction file and existing records; avoid inventorying personal/team contents just for examples. |
| “Set my name to Maya and save this note privately: Access instructions need work.” | Preserve other config, use the supplied name/content, save one private note through the helper, read it back, and report actual scope. Follow configured autonomy and existing authority without repeated confirmation for covered writes. |
| “Add this detail to that note” or “Track a follow-up” | Develop the returned note ID in place or save the requested work item; do not create a duplicate notebook entry, mandatory project, or invented commitment. |
| “Explain sharing and Jira; do not connect anything.” | Explain private links, local versus published team context, source audience, Jira ownership/snapshot time and Teams conversations; no external calls or permission changes. |
| “Skip this,” “Stop,” or “Continue the tutorial” | Respect pacing and known context; no persisted onboarding marker/checklist. With missing history, ask where to continue instead of scanning all records. |
| Ordinary “Brief me on Atlas,” missing owner, or missing Node/team access | Ordinary request stays ordinary; owner is not required for explanation; real writes need actual attribution. Explain missing prerequisites and retain conversational help without installs or credential prompts. |

After upgrade, repeat discovery with a preserved custom `.github/copilot-instructions.md`, `/skills reload`, and a fresh named-agent session. A guided tour is not a standalone `/self-tutorial` Copilot command.

## deepagents (lc-code) adapter

Distribution fixtures verify the managed `.deepagents/AGENTS.md` (the toolkit note, the complete manual and the runtime surface), the short user-owned root `AGENTS.md`, the `[skills]`-only `skills.toml` selecting `.deepagents/skills` with built-ins kept, the three namespaced skills with resolvable reference indexes, the `SessionStart` hook command and its Claude-compatible envelope output from the workspace root and from a subfolder, and an update that refreshes the managed manual while leaving learnings appended to the root `AGENTS.md` untouched. Installer guards are covered too: `--no-git` is refused, a workspace nested in another repository becomes its own Git root, mixing this runtime with another in one workspace is refused in both directions, in-place edits to the managed manual are backed up on update, and a changed `skills.toml` is reported rather than touched. No client-specific directories from other runtimes are generated.

Native verification is separate: install `lc-code` (or `ddt-agent`) from the factory repository, stamp a disposable workspace with `--runtime deepagents`, launch the client from the workspace root and allow project hooks when asked (or pass `--trust-project-hooks` headless), confirm the status bar shows Manual approval, run `lc-code skills list` to see the office skills beside the built-ins, and exercise a capture, a note development, a follow-up completion and a brief through approved helper calls. Check that the session-start context reports follow-up counts when `todo_surfacing` is `proactive`, and that learnings the agent persists land in the root `AGENTS.md`. These client-driven scenarios have not been executed in this environment.
