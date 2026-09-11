# Office Work Assistant — deepagents (lc-code)

Projects, notes, and linked work use the same shared runtime as the other assistant distributions. Quick capture develops in place; briefings assemble current sources. Jira owns execution fields for linked issues, and everyday conversation stays in Teams.

This distribution targets a LangChain deepagents client such as `lc-code` or `ddt-agent`, built on `deepagents-code`, and follows that client's own conventions.

## Start

From the root of this stamped workspace, launch your client:

```sh
cd /path/to/workspace
lc-code
```

The first time, the client asks whether to allow this project's hooks; choose to always allow them so the follow-up count appears at session start (see below). Then say “I'm new here. Help me get started.” for a paced tour, or start with “Capture this idea…”, “Track a follow-up…”, or “Brief me on…”. Set your name in `.ddt/config.md` first, or let the tour ask for it.

## Workspace requirements

- **Its own Git root.** The client finds project memory, skills and hooks at the nearest Git root. The installer initializes a repository in the workspace even when the folder sits inside another repository, and refuses `--no-git` for this runtime.
- **Stamped alone.** The root `AGENTS.md` is the client's memory file, and another runtime would use that same file as its manual. The installer refuses to add this runtime to a workspace stamped for another one, and the reverse. Use a separate folder per runtime.
- Node.js 18+ and Git on the machine; no Node packages.

## What is installed

| Path | Purpose | Ownership |
| --- | --- | --- |
| `.deepagents/AGENTS.md` | The complete operating manual plus this runtime's surface notes | Toolkit-managed; replaced on update, with a backup when it was edited in place |
| `AGENTS.md` | Workspace memory: your notes and the learnings your agent persists | Yours; seeded once, never touched by updates |
| `.deepagents/skills/office-*` | `office-projects`, `office-notes`, `office-work`, each with `references/` for meetings, decisions, catch-up, sync, Jira and the tour | Toolkit-managed |
| `.deepagents/skills.toml` | Selects the office skills for this project and keeps the client's built-in skills | Yours; seeded once, reported when it differs |
| `.deepagents/hooks.json` | A `SessionStart` hook that reports open follow-ups when `todo_surfacing` is `proactive` | Yours; seeded once, reported when it differs |
| `.ddt/runtime/`, `.ddt/config.md`, records | The shared helper, dashboard, configuration and data, identical across runtimes | Helper managed; config and records yours |

## Memory and the manual

The client loads `.deepagents/AGENTS.md` and the root `AGENTS.md` together and presents them to the model as agent memory: reference material that an explicit request always outranks, which is also how the manual expects to be treated. Keep learnings in the root file; the managed file says so on its first line. When memory auto-save is on, the agent may still edit the managed file in place. An update replaces it with the current toolkit version and saves the edited copy beside it as `AGENTS.md.before-update-<timestamp>`, so nothing is lost; move anything worth keeping into the root file.

## Approvals and the helper

Every record operation is a shell call to `node .ddt/runtime/ddt.js …` with a JSON request file.

- **Manual** (the default): the client asks before each call; approve with `y`. To let helper calls through without a prompt while everything else still asks, put `node` on the shell allow-list: `shell.allow_list` in the client's TOML configuration, the `DEEPAGENTS_CODE_SHELL_ALLOW_LIST` environment variable, or `-S node` at launch. Name `node` rather than `recommended` or `all`.
- **Auto**: the classifier decides each call and may still ask you. The allow-list does not bypass it for broad interpreters such as `node`, so expect occasional prompts.
- **YOLO**: no review of gated actions. Not recommended in a workspace with team clones.
- **Non-interactive**: local shell access is off by default, so the allow-list is required: `lc-code -n "What changed in Atlas since Monday?" -S node`.

## Session hook

The hook in `.deepagents/hooks.json` prints the open and overdue follow-up counts in the Claude-compatible hook envelope the client reduces into session context. It changes directory to the Git root first, so it works from any launch directory inside the workspace, and it reads local records only. Interactive launches ask you to allow project hooks once, remembered per project; headless runs need `--trust-project-hooks`. If hooks are denied, nothing else changes.

## Check discovery

`lc-code skills list` shows the three office skills beside the built-in `remember`, `skill-creator` and `deepagents-thread-inspector`; in a session, `/skill:office-projects` invokes one directly. Confirm the status bar shows the approval mode you expect before a write-capable session. After an update, start a new session so the refreshed manual is loaded; a resumed thread keeps the memory it loaded first.

## Dashboard and updates

```sh
node .ddt/runtime/server.js
```

Open the printed loopback URL. The dashboard reads the same records and can complete or reopen local follow-ups. Stop it with Ctrl-C. The bootstrap script requires a POSIX shell; on Windows use WSL or another POSIX environment.

Update from the toolkit with `bootstrap/init-workspace.sh --update --runtime deepagents /path/to/workspace`, or with `--update` alone once the manifest exists. The updater refreshes the managed manual (backing up in-place edits), the office skills, the helper and this guide, and prints a notice when `skills.toml` or `hooks.json` differ from the current toolkit version. `AGENTS.md`, your configuration and all records are never touched. Legacy adoption remains explicit.

The client's own installation, model configuration, credentials and approval policy are managed separately. Setup does not install Python packages, log in, or publish anything.
