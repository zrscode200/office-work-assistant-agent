# GitHub Copilot CLI adapter

Implemented for the current Office Work Assistant V1. This replaces the earlier proposal that mixed VS Code, cloud agent, and CLI behavior. Supported installation: `--runtime copilot`.

## Design

Use native CLI discovery while retaining the common project/notes/work model:

| Installed path | Purpose | Ownership |
| --- | --- | --- |
| `.github/copilot-instructions.md` | Short entry point and essential boundaries | Seeded when missing; existing contents preserved on update |
| `.github/agents/office-work-assistant.agent.md` | Optional dedicated office session | Toolkit-managed |
| `.github/skills/office-projects/SKILL.md` | Project context, meetings, decisions, briefings, catch-up, dashboard, sync | Toolkit-managed |
| `.github/skills/office-notes/SKILL.md` | Capture and develop notes; explore thinking | Toolkit-managed |
| `.github/skills/office-work/SKILL.md` | Local follow-ups and Jira references | Toolkit-managed |
| Each skill's `references/` | Relevant common workflow shortcuts | Generated from core commands |
| `.ddt/runtime/ASSISTANT.md` | Complete common assistant behavior | Generated from core/manual.md; loaded when needed |
| `.ddt/runtime/WORKFLOWS.md`, `ddt.js`, dashboard assets | Shared command/data/UI runtime | Same canonical core/runtime files as other adapters |

Only the compact repository instructions are automatically loaded by this adapter. The custom agent and skills explicitly read the full manual when used. The instruction seed stays small and points to managed guidance, so an update can preserve user edits while refreshing detailed behavior. Skills reference the relevant workflow files; there is no second implementation of capture, task completion, Git publication, or Jira refresh.

The namespaced skills avoid competing with generic project-manager/task-manager skills in existing workspaces. The named office agent provides a direct entry point even when a pre-existing repository instruction file is preserved. It does not define a model, MCP service, delegation workflow, or new permission grants.

## Using it

```sh
./bootstrap/init-workspace.sh --runtime copilot /path/to/workspace
cd /path/to/workspace
copilot --agent=office-work-assistant
```

Use `/agent` to select the profile inside a CLI session. Ask naturally or reference `/office-projects`, `/office-notes`, or `/office-work` in your prompt. `/skills list` and `/skills info office-projects` inspect skill discovery; `/instructions` inspects active instructions. Restart a session after instruction updates; `/skills reload` reloads skills.

Command references such as `meeting.md` and `todo.md` are loaded within those skills. The adapter does not advertise them as CLI slash commands. It does not generate IDE prompt files, VS Code handoffs, or automatic session sync hooks. Other Copilot surfaces may discover some of the files, but this adapter's supported target and verification scope are Copilot CLI.

## Preservation and boundaries

The installer does not overwrite existing `AGENTS.md`, `CLAUDE.md`, or `.github/copilot-instructions.md` for the Copilot target. Unrelated custom instructions, agents, skills, hooks, and configuration remain untouched. Its own namespaced skills/agent and runtime helpers are refreshed on update. The user's personal data and legacy originals retain the existing V1 preservation rules.

No user-global configuration is installed. Copilot access, authentication, model choice, and tool/directory approvals remain under the user's existing settings. A configured external team clone may require specific directory access through Copilot. Git synchronization/publication and Jira requests keep their explicit authority requirements. Teams communication and richer attribution/temporal design are unchanged.

Installation uses the existing POSIX-shell bootstrap. On Windows, use a POSIX environment such as WSL for installation and configure paths for the environment where the assistant actually runs. This change does not introduce a native PowerShell installer.

## Verification

The normal suite checks four-runtime parity, fresh/repeated/update behavior, the complete native Copilot directory structure, frontmatter names/descriptions, reference resolution, user customization preservation, and a synthetic installed Node-helper workflow. Existing shared runtime regression tests also run.

The available `copilot --help` command failed at startup with macOS `SecItemCopyMatching -50` during implementation. Native instruction/skill/agent discovery and model-backed execution therefore remain unverified here. Credentials and permissions were not altered. On a working installation, use the discovery commands above, then capture/develop a synthetic note, complete/reopen a follow-up, and prepare a brief before rollout.

## Capability sources

Checked against official GitHub documentation on 2026-09-08:

- [CLI custom instructions](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-custom-instructions)
- [CLI skills and invocation](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-skills)
- [CLI usage and custom agents](https://docs.github.com/en/copilot/how-tos/copilot-cli/use-copilot-cli/overview)
- [Custom-agent profile configuration](https://docs.github.com/en/copilot/reference/custom-agents-configuration)

Current official CLI capabilities take precedence over the superseded IDE/cloud proposal. Recheck these references when changing native discovery behavior.
