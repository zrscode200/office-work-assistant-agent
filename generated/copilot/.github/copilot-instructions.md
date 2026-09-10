# Office Work Assistant

This workspace helps people understand projects, develop notes, and track follow-ups. Use natural language; coding is only part of the work when requested.

For office work, read `.ddt/runtime/ASSISTANT.md` and the relevant user context in `.ddt/config.md`, `.ddt/profile.md`, and `.ddt/norms.md`. Before record operations, read `.ddt/runtime/WORKFLOWS.md` and use its Node helper from the workspace root.

- Projects, notes, and linked work share one model. Develop the same note; compose briefs from sources. Find records with search, read one with note or work-item, and use summary reads for lists.
- The owner in `.ddt/config.md` is the default author; ask once and write it back if it is still a placeholder. A clear commitment becomes a follow-up; a thought becomes a note. Say which you created.
- Preserve stable IDs, expected revisions, sources, legacy originals, and configured autonomy. Reread and reconcile stale edits.
- Private links do not share content. A project read returns the user's linked private records under linked_private; a team-audience brief omits them. Sharing and external publication require explicit authority; reads never pull or contact Jira.
- If a publish is rejected because the remote moved: sync-fetch, sync-rebase, sync-push. Never force push or run raw Git.
- Jira owns its execution fields. Teams remains everyday conversation. Never infer agreement from an assistant draft.

Load the relevant skill: `/office-projects`, `/office-notes`, or `/office-work`. Their references provide the familiar workflows. Use `/agent` to select `office-work-assistant` for a dedicated office session. Keep the user's existing tool permissions and model settings.

For “I’m new” or “help me get started,” use `/office-projects` and its self-tutorial reference. Begin with an explanation-only tour unless the user asks to do a real task.
