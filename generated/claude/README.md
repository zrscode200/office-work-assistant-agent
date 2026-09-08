# Office Work Assistant — Claude Code

A workspace for projects, notes, and linked work. Quick capture develops in the same note. Project context and briefings draw on those records; Jira can own execution and Teams remains everyday conversation.

1. Set your name, autonomy mode, and optional team clone paths in `.ddt/config.md`.
2. Add relevant context in `.ddt/profile.md` and working principles in `.ddt/norms.md`.
3. Open Claude Code here and ask to capture a note, start a project, track a follow-up, or prepare a briefing.
4. For the dashboard, run `node .ddt/runtime/server.js` and open its loopback URL. Node.js 18+ is required; no packages are needed.

Read `CLAUDE.md` for assistant behavior and `.ddt/runtime/WORKFLOWS.md` for commands, Jira setup, team publication, and legacy adoption. Personal records live outside team clones and are ignored by Git. Shared records live under each team’s `projects/` directory and are local until explicitly published. Existing Git repository access controls membership.

Updates preserve user data and configuration. Legacy documents/todos remain readable and can be explicitly adopted; fresh projects use one context record, notes, and work. Run the toolkit installer with `--update --runtime claude` to refresh managed helpers/instructions. Custom runtime configs remain yours; compare new hook/skill settings manually when needed.
