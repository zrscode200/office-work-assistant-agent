# Office Work Assistant

A portable assistant workspace for understanding projects, developing notes, and coordinating work through shared context. Install it into a working folder for Claude Code, Codex, OpenCode, or GitHub Copilot CLI.

The first team version uses three core records:

- **Projects:** purpose, scope, current understanding, health, and source references.
- **Notes:** quick capture, developed thinking, evidence, and decision rationale in one stable note.
- **Work:** lightweight local follow-ups or links to Jira issues. Completion updates the same local record; Jira owns its execution fields.

Briefings, project views, meeting preparation, and handovers assemble those records. Everyday conversation stays in MS Teams. The workspace works standalone and does not require Jira or a team server.

## Install

Requires Git and Node.js 18+. Python 3 is needed only to regenerate or test this toolkit. No package installation is required.

```sh
mkdir -p /path/to/workspace
./bootstrap/init-workspace.sh --runtime codex /path/to/workspace
# or --runtime claude / --runtime opencode / --runtime copilot
```

Set your name and autonomy mode in `.ddt/config.md`, then open your assistant in that workspace. Try “capture this idea,” “start a project,” “track this follow-up,” or “prepare a project briefing.” Existing commands remain convenient shortcuts into the same workflow.

```sh
cd /path/to/workspace
node .ddt/runtime/ddt.js overview
node .ddt/runtime/server.js
```

Open the dashboard’s printed loopback URL for projects, notebook, work, and changes. It reads the same records and can complete/reopen local follow-ups. Capture, reconciliation, sharing, and Jira refresh remain assistant workflows.

## Copilot CLI

Install with `./bootstrap/init-workspace.sh --runtime copilot /path/to/workspace`, then run `copilot --agent=office-work-assistant` from that workspace. Copilot must already be installed and authenticated.

This adapter uses a short `.github/copilot-instructions.md`, three native skills (`office-projects`, `office-notes`, `office-work`), and one optional custom agent. Detailed guidance is loaded as needed from the common runtime manual and skill references. Existing repository instructions are preserved on update; no global configuration, permission grants, or model settings are installed.

See [Copilot CLI guide](adapters/copilot/README.md) for discovery checks, examples, permissions, and upgrades. [Adapter design](docs/github-copilot-conversion-plan.md) documents the verified CLI surface and validation limits.

## Team use

Each teammate has a personal workspace and a separate local clone of the shared Git repository. Add the clone under `## Team Repos` in `.ddt/config.md`, for example `product: /absolute/path/to/product-context`.

Team records live under `projects/<slug>/`; private notes, projects, work, Jira connections, and snapshots stay in the personal workspace. A private note or follow-up can link to a team project without being shared. Repository permissions control access; author names provide attribution only.

Shared edits use expected revisions. Pull explicitly before contributing. Review exact file contents and destination before publishing with the helper; publication rejects stale content, existing staged work, or unrelated outgoing commits. Git handles cross-clone synchronization; people still reconcile conflicting meaning. Shared records are visible locally before publication, and the helper reports whether a push actually succeeded.

Jira support links issues and explicitly refreshes selected fields into a private cache. It supports a configured HTTPS API base and REST version 2/3 with an organization-approved bearer token supplied by an environment variable. It does not implement an OAuth consent service. No tenant credentials are bundled; live access must be configured for your organization. See [WORKFLOWS.md](core/runtime/WORKFLOWS.md) for exact commands and connection setup.

## Upgrade and legacy data

```sh
./bootstrap/init-workspace.sh --update --runtime codex /path/to/workspace
```

The updater refreshes managed instructions/helpers, preserves customized workspace/runtime configuration and all existing records, and reconciles each required ignore rule. It does not remove already tracked private files from Git history; check existing workspace sharing before distribution.

Legacy scratch, notebook, todos, and specialized project documents remain readable. Explicit adoption creates V1 records while preserving originals. Do not keep editing both copies; changed original notes reappear for reconciliation. Legacy recurrence/subtasks remain in the retained original payload and are not scheduled by V1. New projects do not generate the old document set.

## Development

`core/runtime/` owns storage, CLI, dashboard, and the shared workflow protocol. `core/manual.md`, `core/commands/`, and `core/skills/` define assistant behavior. `adapters/` adds runtime discovery/configuration; `generated/` contains the installable output for all four runtimes.

```sh
python3 scripts/render_templates.py
./tests/run.sh
```

See [TESTING.md](TESTING.md) for verification boundaries. The old `templates/` and `design-concepts/` directories are historical references, not installer inputs. Source work for this redesign is on `updates-and-multiplayer`.
