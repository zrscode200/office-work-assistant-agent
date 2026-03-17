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

## Team Repos

<!-- Add team repos below. Each line: name: /absolute/path/to/local/clone
     Example:
       design-team: /Users/yourname/repos/design-shared
       platform: /Users/yourname/repos/platform-shared
     Names should be lowercase kebab-case.
     Each repo should be a plain git repo with a projects/ folder at the root.
     When no repos are listed, all projects are personal. -->
