# Office Work Assistant — GitHub Copilot CLI

Projects, notes, and linked work use the same shared runtime as the other assistant distributions. Quick capture develops in place; briefings assemble current sources. Jira owns execution fields for linked issues, and everyday conversation stays in Teams.

## Start

Set your name and autonomy mode in `.ddt/config.md`. Add useful context in `.ddt/profile.md` and team conventions in `.ddt/norms.md`. From this workspace, start an installed, authenticated GitHub Copilot CLI:

```sh
copilot --agent=office-work-assistant
```

You can also run `copilot`, then use `/agent` to choose `office-work-assistant`. Normal chat can discover the office skills too. The named agent is useful when your repository already has its own coding instructions.

Try these prompts:

- “Use /office-notes to capture this idea and link it to Atlas privately.”
- “Use /office-projects to prepare a briefing on Atlas with sources.”
- “Use /office-work to track a follow-up with Maya for Friday.”

The three skills include references for jot, notebook, brainstorming, projects, meetings, decisions, todo, Jira, catch-up, dashboard, and synchronization. These references are guidance loaded as needed; their filenames are not standalone Copilot CLI commands.

## Check discovery

In an interactive CLI session:

```text
/instructions
/skills list
/skills info office-projects
/skills info office-notes
/skills info office-work
/agent
```

After an update, start a new session so instruction changes take effect. `/skills reload` refreshes skills in an existing session. If an office skill is disabled, enable it through `/skills`. Inspect the reported path if a personal skill or agent uses the same name.

## Workspace and permissions

Read `.ddt/runtime/ASSISTANT.md` for behavior and `.ddt/runtime/WORKFLOWS.md` for the command/data contract. Both are loaded when needed; the short `.github/copilot-instructions.md` provides initial guidance. No root `AGENTS.md` or `CLAUDE.md` is installed by this adapter.

Run Copilot from the personal workspace. Team clones remain separate and are configured under `## Team Repos` in `.ddt/config.md`. If Copilot needs access to a configured clone outside the workspace, grant that specific directory through its normal permission flow. Do not enable unrestricted paths/tools just to use the assistant. Workspace autonomy describes product behavior and does not override native permissions.

This distribution adds no automatic sync hooks, MCP servers, global config, or model override. Use the assistant's explicit synchronization/Jira workflows when needed. Existing repository instructions and custom unrelated agents/skills/hooks are retained; reconcile conflicting guidance in your own instructions.

## Dashboard and updates

Requires Node.js 18+ and Git. The bootstrap script requires a POSIX shell; on Windows use an appropriate POSIX environment such as WSL for installation. No Node packages are needed for the helper.

```sh
node .ddt/runtime/server.js
```

Open the printed loopback URL. The dashboard reads the same records and can complete/reopen local follow-ups. Stop it with Ctrl-C.

Update from the toolkit with `bootstrap/init-workspace.sh --update --runtime copilot /path/to/workspace`. The updater refreshes toolkit helpers, its namespaced office skills/agent, and this guide. It preserves `.github/copilot-instructions.md`, your configuration, unrelated customizations, and all existing data. Legacy adoption remains explicit. If the instructions file existed before installation, the named agent and skills still point directly to the installed operating manual.

Copilot CLI installation, account authentication, and organization policy are managed separately. Setup does not log in, install dependencies, or publish source/data.
