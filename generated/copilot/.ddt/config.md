# Workspace Configuration

## Autonomy Mode

mode: gated

- supervised: show proposed record writes first.
- gated: clear in-scope local edits proceed; cross-project changes need authority.
- autonomous: clear local edits proceed; resolve ambiguity before consequential changes.
Existing explicit authority persists. Sharing/publication requires appropriate authority in every mode.

## Todo Surfacing

todo_surfacing: contextual

- passive: show work when requested.
- contextual: include relevant follow-ups while discussing a project.
- proactive: also show local follow-up counts at session start where the runtime installs a session hook (Claude Code).

## Workspace

owner: [your name]
created: [date]

## Team Repos

<!-- One team per line, no indentation: team-name: /absolute/path/to/local/clone
Team clones must be separate from this personal workspace and contain projects/.
Repository access controls team membership; author metadata provides attribution.
No configuration is needed for standalone personal use. -->
