# Working with shared context

Requires Node.js 18 or later. Run from the installed workspace. No packages or database are needed.

```
node .ddt/runtime/ddt.js projects
node .ddt/runtime/ddt.js project --input /private/path/request.json
```

Requests and outputs are JSON. Write request files with the runtime's file tool, not shell interpolation. Commands return `{ok,result}` or `{ok:false,error}` with a nonzero exit code. Use `--workspace /absolute/path` when running elsewhere. Do not put request files containing private material into a shared team repository.

## Reading

| Command | Input | Result |
| --- | --- | --- |
| `projects` | none | Project records and unavailable/malformed-scope warnings |
| `project` | `scope`, `project` | Current context, notes, work, and local Git publication state |
| `notes` | optional `scope`, `project` | Unified notes including retained legacy sources |
| `work` | optional `scope`, `project` | Local/Jira references; personal list includes legacy todos |
| `overview` | none | All accessible local project/note/work views; useful for dashboard and my-work filtering |
| `brief` | `scope`, `project`, optional `audience` | Source-backed material to synthesize; creates no report file |
| `catch-up` | `since` ISO timestamp | Current records changed after that time, with attribution/history and scope warnings |

`scope` defaults to `personal`. Other values are team names under `## Team Repos` in `.ddt/config.md`. A project is a lowercase kebab-case slug. Team directories must be separate Git repositories outside the personal workspace. Projects use `project.json`; project notes and work are in `notes/` and `work/`. Unattached private records use `.ddt/personal/notes/` and `.ddt/personal/work/`.

## Create or reconcile a project

`project-save` creates at `expected: 0`; existing records require their current revision. Existing legacy directories are rejected: preview `project-adopt` first.

```json
{
  "scope": "personal", "project": "atlas", "expected": 0, "author": "Maya",
  "fields": {
    "title": "Atlas", "purpose": "Make onboarding faster",
    "scope_description": "First-use experience", "context": "Research is underway.",
    "health": "unknown", "status": "active", "sources": []
  }
}
```

Health: `unknown`, `on-track`, `at-risk`, `blocked`. Lifecycle: `active`, `completed`, `archived`. Update only changed fields. Keep current understanding concise; use links to supporting notes for detailed rationale. Do not copy Jira status into independently maintained project work fields.

## Capture and develop a note

Use `note-save`. Omit `project` for an unattached private note. To continue a note, supply its `id` and current `expected` revision. A note body is Markdown; its metadata is a JSON object inside frontmatter delimiters. The helper owns serialization and history.

```json
{
  "scope": "personal", "project": "atlas", "expected": 0, "author": "Maya",
  "fields": {
    "title": "Vendor review", "body": "The vendor needs another week. We agreed to retain the launch date.",
    "state": "agreed", "sources": [], "links": []
  }
}
```

`state` is `note`, `proposal`, or `agreed`; it describes the content, not a promotion pipeline. For private notes, `links` can reference `{ "scope": "team-name", "project": "atlas" }` without publishing the note. Use a source such as `{ "label": "Vendor review", "ref": "projects/atlas/notes/<id>.md", "scope": "team-name" }` when reconciling shared project context. Never embed private source paths in shared records.

Capture and reconciliation can involve multiple revision-checked saves; they are not one transaction. Preserve the saved source first, then reconcile the project and requested work. Report partial success rather than duplicating the capture on retry.

## Local follow-ups

Use `work-save` with `provider: local`. Optional fields: `owner`, ISO `due`, `status` (`open`, `in-progress`, `done`), source references, and `links` to projects (the same shape as note links). Examples:

```json
{"scope":"personal","project":"atlas","expected":0,"author":"Maya","fields":{"provider":"local","title":"Ask vendor for revised delivery date","owner":"Maya","due":"2026-09-11"}}
```

Completion and reopening update the same record with `fields: {"status":"done"}` or `{"status":"open"}` and the current revision. There is no archive move or reused sequential ID. Team work is stored in its team project; personal views reference that record. V1 provides lightweight follow-ups, not sprints, boards, dependencies, or a replacement for Jira. Legacy recurrence/subtasks are preserved on adoption as original data; they are not automatically scheduled by V1.

## Jira references

Create with `work-save`:

```json
{"scope":"personal","project":"atlas","expected":0,"author":"Maya","fields":{"provider":"jira","title":"Integration work","jira":{"site":"https://example.atlassian.net","key":"ATLAS-42"}}}
```

Status, owner, and due date are rejected for Jira references. `jira-refresh` takes `scope`, `project`, and `id`. It issues a read-only request, follows no redirects, and updates a private snapshot only after validating the response. A failure retains the previous snapshot and must be surfaced. `brief`/dashboard expose `fetched_at`; no background Jira requests occur.

Configure approved connections only in `.ddt/personal/jira.json`:

```json
{"sites":[{"site":"https://example.atlassian.net","api_base":"https://api.atlassian.com/ex/jira/YOUR-CLOUD-ID","api_version":3,"token_env":"TEAM_JIRA_ACCESS_TOKEN"}]}
```

Use your organization's approved OAuth access-token delivery. This toolkit does not implement an OAuth consent service or collect tokens. Set the named environment variable locally; never put its value in files, requests, screenshots, or shared records. For Data Center, configure the approved HTTPS API base (including any context path), API version 2, and the appropriate bearer-token environment variable. No tenant/credentials are bundled. Verify live access with your team administrator before rollout. The adapter can be tested with response fixtures without a Jira account.

API references: [Cloud get issue](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issues/#api-rest-api-3-issue-issueidorkey-get), [Cloud OAuth](https://developer.atlassian.com/cloud/jira/platform/oauth-2-3lo-apps/), [Data Center REST](https://developer.atlassian.com/server/jira/platform/rest/v10002/api-group-issue/).

## Team synchronization and publication

1. `sync-status` with `scope` shows local HEAD, branch, pending changes, and last-known upstream counts. It does not fetch; remote freshness is unknown.
2. When authorized, `sync-pull` fast-forwards a clean checkout. Dirty/diverged checkouts stop for reconciliation. Do not change other people's work to make a pull pass.
3. Read records, prepare changes, and save with expected revisions. Files remain local until publication. Attribution is informational; actual access is controlled by Git/repository permissions.
4. Run `publish-preview` with `scope` and exact `paths`. Show its file contents/diff and `destination` (URL/ref). After explicit authorization, use `publish` with the same `scope`, `paths`, `destination`, `expected_head` from preview, `expected_files` mapping each path to its preview digest, `message`, and `confirm: true`. Existing staged work, outgoing commits, and behind state are rejected. Only V1 record paths under `projects/<slug>/` can publish. Reviewed bytes are committed through Git plumbing, which does not run commit hooks; run required checks first. Unrelated unstaged files stay local.
5. A failed push leaves the commit in place and reports `published:false`. Inspect before retrying; `sync-push` requires `scope`, exact `expected_commit`, the reviewed `destination`, and `confirm:true`. It allows at most one outgoing project-only commit and pushes only that commit to that explicit branch. Never force push or silently rewrite history. A local save or commit is not evidence that the team received it.

Each teammate uses their own clone. Expected record revisions guard same-checkout stale edits; Git handles cross-clone synchronization. A clean merge does not prove two edits agree in meaning. Reconcile changed commitments, decisions, and context before publishing.

## Legacy adoption

`project-adopt` with `scope` and `project` previews source paths/digests. Add `confirm:true` and `author` to create an initially unassessed `project.json`. Read original documents and reconcile a concise current context with their source references. Original documents remain visible as legacy notes and are never deleted.

`note-adopt` takes a legacy note `id`, its `expected_source` digest, location, and `author`. It creates one stable editable note; repeated adoption returns that note. The original stays on disk and is hidden from the unified list once adopted. If it later changes, it reappears with `adoption_drift:true`; reconcile manually without silently replacing the adopted note. Do not continue editing both originals and V1 records.

`work-adopt` similarly converts a selected legacy personal todo to a stable personal work record, retaining the original payload and file. Adopt before editing in V1. Never automatically share old personal todos because they carry a project tag.

## Dashboard

Run `node .ddt/runtime/server.js` in the workspace. Open the printed loopback URL. Use project, notebook, work, and changes views. Enter your name before completing local work. The dashboard uses the same revision-checked helper; it performs no pull, publication, Jira refresh, or message sending on reads. Legacy records remain read-only until explicitly adopted. Stop the server with Ctrl-C.
