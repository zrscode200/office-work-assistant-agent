#!/usr/bin/env sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
python3 "$ROOT/scripts/render_templates.py" --check
sh -n "$ROOT/bootstrap/init-workspace.sh"
sh -n "$ROOT/adapters/claude/.claude/hooks/session-sync.sh"
for script in "$ROOT"/core/runtime/*.js; do node --check "$script"; done
node --test "$ROOT/tests/runtime.test.js" "$ROOT/tests/distribution.test.js"
