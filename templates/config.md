# Workspace Configuration

## Autonomy Mode

mode: gated

Options:
- supervised: agent pauses before creating/modifying artifacts, asks for confirmation
- gated: agent works autonomously on artifact creation, pauses for cross-project changes or deletions
- autonomous: agent runs freely, pauses only for ambiguity

## Workspace

owner: [your name]
created: [date]

## Team Collaboration

team_repo:

<!-- Set this to the absolute path of your local clone of the shared team repo.
     Example: team_repo: /Users/yourname/repos/ddt-shared
     When set, shared projects are read from and written to this repo.
     When blank, all projects are personal (stored in .ddt/projects/).
     The shared repo should be a plain git repo with a projects/ folder at the root. -->
