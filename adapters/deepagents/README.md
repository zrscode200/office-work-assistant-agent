# Office Work Assistant — deepagents (lc-code)

Projects, notes, and linked work use the same shared runtime as the other assistant distributions. Quick capture develops in place; briefings assemble current sources. Jira owns execution fields for linked issues, and everyday conversation stays in Teams.

This distribution targets a LangChain deepagents client such as `lc-code` or `ddt-agent`, built on `deepagents-code`. It is designed for that client's own conventions, so stamp a workspace for this runtime alone rather than sharing it with another assistant.

## Start

From the root of this stamped workspace, launch your client:

```sh
cd /path/to/workspace
lc-code
```

Say “I'm new here. Help me get started.” for a paced tour, or start with “Capture this idea…”, “Track a follow-up…”, or “Brief me on…”. Set your name in `.ddt/config.md` first, or let the tour ask for it.

## What is installed

| Path | Purpose | Ownership |
| --- | --- | --- |
| `.deepagents/AGENTS.md` | The complete operating manual plus this runtime's surface notes; loaded into the system prompt at session start | Toolkit-managed, replaced on update |
| `AGENTS.md` | Workspace memory: your notes and the learnings your agent persists; loaded together with the manual | Yours; seeded once, never touched by updates |
| `.deepagents/skills/office-*` | `office-projects`, `office-notes`, `office-work`, each with `references/` for meetings, decisions, catch-up, sync, Jira and the tour | Toolkit-managed |
| `.deepagents/skills.toml` | Selects the office skills for this project and keeps the client's built-in skills | Yours; seeded once |
| `.deepagents/hooks.json` | A `SessionStart` hook that reports open follow-ups when `todo_surfacing` is `proactive` | Yours; seeded once |
| `.ddt/runtime/`, `.ddt/config.md`, records | The shared helper, dashboard, configuration and data, identical across runtimes | Helper managed; config and records yours |

The client combines `.deepagents/AGENTS.md` and the root `AGENTS.md` into one memory context. Keep learnings in the root file: the managed file is overwritten on every update, and its first line tells the agent the same.

## Approvals and the helper

Every record operation is a shell call to `node .ddt/runtime/ddt.js …` with a JSON request file. In **Manual** mode you approve each call with `y`; the manual asks the agent to batch reads and never swap a rejected command for another. In **Auto** mode the classifier decides; add `node` to the shell allow-list so helper calls are not gated: `shell.allow_list` in the client's TOML configuration, the `DEEPAGENTS_CODE_SHELL_ALLOW_LIST` environment variable, or `-S node` for a non-interactive run. Prefer naming `node` over `recommended` or `all`. The dashboard server and the session hook also run under `node`.

Non-interactive use follows the client's one-shot path, for example `lc-code -n "What changed in Atlas since Monday?" -S node`. Local shell access is off by default there, so the allow-list is required.

## Session hook

The hook in `.deepagents/hooks.json` prints the open and overdue follow-up counts in the Claude-compatible hook envelope the client reduces into session context. Project hooks run only when the client is launched with `--trust-project-hooks`; without it the hook is ignored and nothing else changes. The hook reads local records only and never pulls or contacts Jira.

## Check discovery

List the discovered skills with your client's skills command, or ask the agent which office skills it can see. With `include_builtin = true` the built-in `remember`, `skill-creator` and `deepagents-thread-inspector` skills stay available beside the three office skills. Confirm the status bar shows the approval mode you expect before a write-capable session. After an update, start a new session so the refreshed manual is loaded.

## Dashboard and updates

Requires Node.js 18+ and Git. The bootstrap script requires a POSIX shell; on Windows use WSL or another POSIX environment. No Node packages are needed.

```sh
node .ddt/runtime/server.js
```

Open the printed loopback URL. The dashboard reads the same records and can complete or reopen local follow-ups. Stop it with Ctrl-C.

Update from the toolkit with `bootstrap/init-workspace.sh --update --runtime deepagents /path/to/workspace`. The updater refreshes the managed manual, the office skills, the helper and this guide, and prints a notice when `skills.toml` or `hooks.json` differ from the current toolkit version. `AGENTS.md`, your configuration and all records are never touched. Legacy adoption remains explicit.

The client's own installation, model configuration, credentials and approval policy are managed separately. Setup does not install Python packages, log in, or publish anything.
