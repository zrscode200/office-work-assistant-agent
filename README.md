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

The installer never overwrites existing files: a pre-existing README.md, CLAUDE.md or AGENTS.md is recorded as yours. It initializes a Git repository in the target unless one exists or `--no-git` is given, and writes `.ddt/runtime/manifest.<runtime>.txt` listing the files it manages.

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

See [Copilot CLI guide](adapters/copilot/README.md) for discovery checks, examples, permissions, and upgrades. [Adapter design](docs/copilot-cli-adapter.md) documents the verified CLI surface and validation limits.

## Team use

Each teammate has a personal workspace and a separate local clone of the shared Git repository. Add the clone under `## Team Repos` in `.ddt/config.md`, for example `product: /absolute/path/to/product-context`.

Team records live under `projects/<slug>/`; private notes, projects, work, Jira connections, and snapshots stay in the personal workspace. A private note or follow-up can link to a team project without being shared. Repository permissions control access; author names provide attribution only.

Shared edits use expected revisions. Fetch or pull explicitly before contributing. Review exact file contents and destination before publishing with the helper; publication rejects stale content, existing staged work, or unrelated outgoing commits. When two people publish the same record, the second push is rejected and the helper recovers with `sync-fetch`, `sync-rebase` (records are merged field by field; a field both changed is returned for a decision) and `sync-push`, never a force push. Git handles cross-clone synchronization; people still reconcile conflicting meaning. Shared records are visible locally before publication, and the helper reports whether a push actually succeeded. Catch-up reports what you authored, what arrived through a pull, and what Jira refreshed.

Jira support links issues and explicitly refreshes selected fields into a private cache. It supports Jira Cloud API tokens (basic auth with your account email) and OAuth or Data Center bearer tokens, both read from an environment variable, with REST version 2/3 and an optional API base. It does not implement an OAuth consent service. No tenant credentials are bundled; live access must be configured for your organization. See [WORKFLOWS.md](core/runtime/WORKFLOWS.md) for exact commands and connection setup.

## Upgrade and legacy data

```sh
./bootstrap/init-workspace.sh --update --runtime codex /path/to/workspace
```

The updater refreshes the files its manifest records as toolkit-managed, keeps files recorded as yours, preserves user-owned configuration and all records, prints a notice when a user-owned file differs from the current toolkit version, reports files an older version managed but this one no longer ships, and reconciles each required ignore rule. A workspace installed before manifests existed gets its root README.md, CLAUDE.md or AGENTS.md backed up beside the refreshed copy. Without `--runtime`, the updater detects the installed runtime from the manifest. It does not remove already tracked private files from Git history; check existing workspace sharing before distribution.

Legacy scratch, notebook, todos, and specialized project documents remain readable. Explicit adoption creates V1 records while preserving originals. Do not keep editing both copies; changed original notes reappear for reconciliation. Legacy recurrence/subtasks remain in the retained original payload and are not scheduled by V1. New projects do not generate the old document set.

## Development

`core/runtime/` owns storage, CLI, dashboard, and the shared workflow protocol. `core/manual.md`, `core/commands/`, and `core/skills/` define assistant behavior. `adapters/` adds runtime discovery/configuration; `generated/` contains the installable output for all four runtimes.

```sh
python3 scripts/render_templates.py
./tests/run.sh
```

See [TESTING.md](TESTING.md) for verification boundaries. `VERSION` stamps installed manifests; bump it with behavior changes. GitHub Actions runs the same suite on Node 18 and 22.
