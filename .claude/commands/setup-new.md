---
description: Install this toolkit into a new workspace
---

Resolve the target directory and desired runtime (claude, codex, opencode, or copilot). Read README.md. Run `bootstrap/init-workspace.sh --runtime <runtime> <target>` with shell-safe arguments. Never target the toolkit itself. The installer initializes a local Git repository when needed (pass --no-git to skip), preserves existing files, and records what it manages in .ddt/runtime/manifest.<runtime>.txt. Help the user set their owner/autonomy/team locations; do not invent credentials or team repositories. No dependencies or remote publication are part of setup.
