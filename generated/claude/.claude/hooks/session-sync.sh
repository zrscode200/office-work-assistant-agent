#!/usr/bin/env sh
# Read local context only. Shared synchronization always requires explicit intent.
set -eu
project_dir="${CLAUDE_PROJECT_DIR:-$PWD}"
if command -v node >/dev/null 2>&1 && [ -f "$project_dir/.ddt/runtime/session.js" ]; then
  node "$project_dir/.ddt/runtime/session.js" "$project_dir"
fi
