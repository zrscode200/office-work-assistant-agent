# Office Work Assistant — GitHub Copilot CLI

Projects, notes, and linked work use the same shared runtime as the other assistant distributions. Quick capture develops in place; briefings assemble current sources. Jira owns execution fields for linked issues, and everyday conversation stays in Teams.

## Start

From the root of this stamped workspace, start an installed, authenticated GitHub Copilot CLI:

```sh
copilot --agent=office-work-assistant
```

You can take the tour immediately. The assistant can help set your name before saving real work and explain the current autonomy setting. Personal profile and team norms are optional.

You can also run `copilot`, then use `/agent` to choose `office-work-assistant`. Normal chat can discover the office skills too. The named agent is useful when your repository already has its own coding instructions.

## New here? Start with a guided tour

Tell the assistant:

> I'm new here. Help me get started.

It will explain projects, notes, and follow-ups one small step at a time. The quick tour uses an example without saving it; you can switch to a real task, skip a topic, or stop whenever you like. Setup help covers your name, how much the assistant may do on its own, and optional team access. You can use the workspace privately without Jira or a team repository.

For a more specific start:

- “Give me a quick tour without saving anything.”
- “Help me set up my name, then capture this note privately: …”
- “Show me what stays private and what my teammates can see.”
- “Continue the tutorial from where we left off.”

The tutorial lives in the existing `office-projects` skill. If your usual instructions do not pick it up, say “Use /office-projects and its self-tutorial to help me get started,” or select the `office-work-assistant` agent. It starts when you ask; ordinary work does not trigger a welcome questionnaire. No extra onboarding documents are created.

## Everyday requests

Try these prompts:

- “Use /office-notes to capture this idea and link it to Atlas privately.”
- “Use /office-projects to prepare a briefing on Atlas with sources.”
- “Use /office-work to track a follow-up with Maya for Friday.”
- “What's on my plate this week?”
- “What changed in Atlas since Monday?” (includes teammates' changes that arrived through a pull and Jira refreshes)
- “Find the note about the vendor contract.”

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

Run Copilot from the personal workspace. Team clones are separate repositories configured under `## Team Repos` in `.ddt/config.md`; keep them under `teams/<name>` inside the workspace so Copilot needs no extra directory access. A clone elsewhere works too if you grant that specific directory through Copilot's normal permission flow. Do not enable unrestricted paths/tools just to use the assistant. Workspace autonomy describes product behavior and does not override native permissions.

This distribution adds no automatic sync hooks, MCP servers, global config, or model override. Use the assistant's explicit synchronization/Jira workflows when needed. Existing repository instructions and custom unrelated agents/skills/hooks are retained; reconcile conflicting guidance in your own instructions.

## Dashboard and updates

Requires Node.js 18+ and Git. The bootstrap script requires a POSIX shell; on Windows use an appropriate POSIX environment such as WSL for installation. No Node packages are needed for the helper.

```sh
node .ddt/runtime/server.js
```

Open the printed loopback URL. The dashboard reads the same records and can complete/reopen local follow-ups. Stop it with Ctrl-C.

Update from the toolkit with `bootstrap/init-workspace.sh --update --runtime copilot /path/to/workspace`. The updater refreshes toolkit helpers, its namespaced office skills/agent, and this guide. It preserves `.github/copilot-instructions.md`, your configuration, unrelated customizations, and all existing data, and prints a notice when a preserved file differs from the current toolkit version so you can merge the parts you want. Legacy adoption remains explicit. If the instructions file existed before installation, the named agent and skills still point directly to the installed operating manual.

When two teammates publish the same record, the second push is rejected and the assistant recovers with `sync-fetch`, `sync-rebase` and `sync-push`. Records are merged field by field; a field both people changed is shown to you for a decision. Nothing is force-pushed.

Copilot CLI installation, account authentication, and organization policy are managed separately. Setup does not log in, install dependencies, or publish source/data.
