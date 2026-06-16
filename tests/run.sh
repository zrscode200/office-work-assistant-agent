#!/usr/bin/env sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
BOOTSTRAP="$ROOT/bootstrap/init-workspace.sh"
GENERATED_CLAUDE="$ROOT/generated/claude"
TMP_ROOT="${TMPDIR:-/tmp}/office-work-assistant-agent-test-$$"

fail() {
  echo "FAIL: $1" >&2
  exit 1
}

assert_file() {
  [ -f "$1" ] || fail "missing file: $1"
}

assert_missing() {
  [ ! -e "$1" ] || fail "expected missing path: $1"
}

assert_dir() {
  [ -d "$1" ] || fail "missing directory: $1"
}

assert_executable() {
  [ -x "$1" ] || fail "expected executable file: $1"
}

assert_contains() {
  grep -q -- "$2" "$1" || fail "expected '$2' in $1"
}

assert_not_contains() {
  if grep -q -- "$2" "$1"; then
    fail "did not expect '$2' in $1"
  fi
}

assert_same() {
  cmp -s "$1" "$2" || fail "files differ: $1 $2"
}

assert_tracked() {
  git -C "$ROOT" ls-files --error-unmatch "$1" >/dev/null 2>&1 ||
    fail "expected tracked file: $1"
}

settings_command() {
  node -e '
const fs = require("fs");
const settings = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
process.stdout.write(settings.hooks.SessionStart[0].hooks[0].command);
' "$1"
}

stale_system_files() {
  update_target="$1"

  printf 'STALE SYSTEM CLAUDE\n' > "$update_target/CLAUDE.md"
  printf 'STALE SYSTEM README\n' > "$update_target/README.md"
  printf 'STALE COMMAND\n' > "$update_target/.claude/commands/todo.md"
  printf 'STALE SKILL\n' > "$update_target/.claude/skills/project-manager/SKILL.md"
  printf 'STALE THINK SKILL\n' > "$update_target/.claude/skills/think-partner/SKILL.md"
  printf 'STALE TASK SKILL\n' > "$update_target/.claude/skills/task-manager/SKILL.md"
  printf '#!/usr/bin/env sh\n# stale hook\n' > "$update_target/.claude/hooks/session-sync.sh"
  printf 'STALE DASHBOARD HTML\n' > "$update_target/.claude/dashboard/template.html"
  printf 'STALE DASHBOARD JS\n' > "$update_target/.claude/dashboard/server.js"
}

assert_user_files_preserved() {
  update_target="$1"

  assert_contains "$update_target/.ddt/config.md" "USER CONFIG SENTINEL"
  assert_contains "$update_target/.ddt/profile.md" "USER PROFILE SENTINEL"
  assert_contains "$update_target/.ddt/norms.md" "USER NORMS SENTINEL"
  assert_contains "$update_target/.ddt/registry.md" "USER REGISTRY SENTINEL"
  assert_contains "$update_target/.claude/settings.json" '"user"'
  assert_contains "$update_target/.ddt/personal/todo.json" '"keep"'
  assert_contains "$update_target/.ddt/personal/scratch/.index.md" "scratch index sentinel"
  assert_file "$update_target/.ddt/projects/sample/status.md"
}

assert_system_files_refreshed() {
  update_target="$1"

  assert_same "$GENERATED_CLAUDE/CLAUDE.md" "$update_target/CLAUDE.md"
  assert_same "$GENERATED_CLAUDE/README.md" "$update_target/README.md"
  for command_template in "$GENERATED_CLAUDE/.claude/commands/"*.md; do
    command_name=$(basename "$command_template")
    assert_same "$command_template" "$update_target/.claude/commands/$command_name"
  done
  assert_same "$GENERATED_CLAUDE/.claude/skills/project-manager/SKILL.md" \
    "$update_target/.claude/skills/project-manager/SKILL.md"
  assert_same "$GENERATED_CLAUDE/.claude/skills/think-partner/SKILL.md" \
    "$update_target/.claude/skills/think-partner/SKILL.md"
  assert_same "$GENERATED_CLAUDE/.claude/skills/task-manager/SKILL.md" \
    "$update_target/.claude/skills/task-manager/SKILL.md"
  assert_same "$GENERATED_CLAUDE/.claude/hooks/session-sync.sh" \
    "$update_target/.claude/hooks/session-sync.sh"
  assert_same "$GENERATED_CLAUDE/.claude/dashboard/template.html" \
    "$update_target/.claude/dashboard/template.html"
  assert_same "$GENERATED_CLAUDE/.claude/dashboard/server.js" \
    "$update_target/.claude/dashboard/server.js"
  assert_executable "$update_target/.claude/hooks/session-sync.sh"
}

trap 'rm -rf "$TMP_ROOT"' EXIT HUP INT TERM
mkdir -p "$TMP_ROOT"

echo "test root: $TMP_ROOT"

sh -n "$BOOTSTRAP"
sh -n "$ROOT/templates/hooks/session-sync.sh"
node --check "$ROOT/templates/dashboard/server.js"
python3 "$ROOT/scripts/render_templates.py" --check >/dev/null

assert_file "$ROOT/generated/claude/README.md"
assert_file "$ROOT/generated/claude/CLAUDE.md"
assert_file "$ROOT/generated/claude/.gitignore"
assert_file "$ROOT/generated/claude/.ddt/config.md"
assert_file "$ROOT/generated/claude/.ddt/profile.md"
assert_file "$ROOT/generated/claude/.ddt/norms.md"
assert_file "$ROOT/generated/claude/.ddt/registry.md"
assert_file "$ROOT/generated/claude/.ddt/projects/.gitkeep"
assert_file "$ROOT/generated/claude/.ddt/personal/notebook/.gitkeep"
assert_file "$ROOT/generated/claude/.ddt/personal/scratch/.gitkeep"
assert_file "$ROOT/generated/claude/.ddt/personal/scratch/.index.md"
assert_file "$ROOT/generated/claude/.ddt/personal/todo.json"
assert_tracked "generated/claude/.ddt/personal/notebook/.gitkeep"
assert_tracked "generated/claude/.ddt/personal/scratch/.gitkeep"
assert_tracked "generated/claude/.ddt/personal/scratch/.index.md"
assert_tracked "generated/claude/.ddt/personal/todo.json"
assert_file "$ROOT/generated/claude/.claude/settings.json"
assert_file "$ROOT/generated/claude/.claude/hooks/session-sync.sh"
assert_executable "$ROOT/generated/claude/.claude/hooks/session-sync.sh"
assert_file "$ROOT/generated/claude/.claude/dashboard/template.html"
assert_file "$ROOT/generated/claude/.claude/dashboard/server.js"
assert_file "$ROOT/generated/claude/.claude/skills/project-manager/SKILL.md"
assert_file "$ROOT/generated/claude/.claude/skills/think-partner/SKILL.md"
assert_file "$ROOT/generated/claude/.claude/skills/task-manager/SKILL.md"
sh -n "$ROOT/generated/claude/.claude/hooks/session-sync.sh"
node --check "$ROOT/generated/claude/.claude/dashboard/server.js"
node -e 'const fs=require("fs"); JSON.parse(fs.readFileSync(process.argv[1],"utf8"));' \
  "$ROOT/generated/claude/.claude/settings.json"
node -e 'const fs=require("fs"); JSON.parse(fs.readFileSync(process.argv[1],"utf8"));' \
  "$ROOT/generated/claude/.ddt/personal/todo.json"
for command_template in "$ROOT/core/commands/"*.md; do
  command_name=$(basename "$command_template")
  assert_file "$ROOT/generated/claude/.claude/commands/$command_name"
done

target="$TMP_ROOT/work assistant workspace"
mkdir -p "$target"
"$BOOTSTRAP" "$target" > "$TMP_ROOT/bootstrap.log"

assert_file "$target/README.md"
assert_file "$target/CLAUDE.md"
assert_file "$target/.gitignore"
assert_file "$target/.ddt/config.md"
assert_file "$target/.ddt/profile.md"
assert_file "$target/.ddt/norms.md"
assert_file "$target/.ddt/registry.md"
assert_file "$target/.ddt/projects/.gitkeep"
assert_file "$target/.ddt/personal/notebook/.gitkeep"
assert_file "$target/.ddt/personal/scratch/.gitkeep"
assert_file "$target/.ddt/personal/scratch/.index.md"
assert_file "$target/.ddt/personal/todo.json"
assert_file "$target/.claude/settings.json"
assert_file "$target/.claude/dashboard/template.html"
assert_file "$target/.claude/dashboard/server.js"
assert_file "$target/.claude/hooks/session-sync.sh"
assert_executable "$target/.claude/hooks/session-sync.sh"
assert_file "$target/.claude/skills/project-manager/SKILL.md"
assert_file "$target/.claude/skills/think-partner/SKILL.md"
assert_file "$target/.claude/skills/task-manager/SKILL.md"
for command_template in "$GENERATED_CLAUDE/.claude/commands/"*.md; do
  command_name=$(basename "$command_template")
  assert_file "$target/.claude/commands/$command_name"
  assert_same "$command_template" "$target/.claude/commands/$command_name"
done

git -C "$target" rev-parse --is-inside-work-tree >/dev/null 2>&1 ||
  fail "target should be a git worktree"

assert_contains "$target/.gitignore" ".ddt/personal/notebook/"
assert_contains "$target/.gitignore" ".ddt/personal/scratch/"
assert_same "$GENERATED_CLAUDE/README.md" "$target/README.md"
assert_same "$GENERATED_CLAUDE/CLAUDE.md" "$target/CLAUDE.md"
assert_same "$GENERATED_CLAUDE/.gitignore" "$target/.gitignore"
assert_same "$GENERATED_CLAUDE/.ddt/config.md" "$target/.ddt/config.md"
assert_same "$GENERATED_CLAUDE/.ddt/profile.md" "$target/.ddt/profile.md"
assert_same "$GENERATED_CLAUDE/.ddt/norms.md" "$target/.ddt/norms.md"
assert_same "$GENERATED_CLAUDE/.ddt/registry.md" "$target/.ddt/registry.md"
assert_same "$GENERATED_CLAUDE/.ddt/personal/todo.json" "$target/.ddt/personal/todo.json"
assert_same "$GENERATED_CLAUDE/.ddt/personal/scratch/.index.md" \
  "$target/.ddt/personal/scratch/.index.md"
assert_same "$GENERATED_CLAUDE/.claude/settings.json" "$target/.claude/settings.json"
assert_same "$GENERATED_CLAUDE/.claude/hooks/session-sync.sh" \
  "$target/.claude/hooks/session-sync.sh"
assert_same "$GENERATED_CLAUDE/.claude/dashboard/template.html" \
  "$target/.claude/dashboard/template.html"
assert_same "$GENERATED_CLAUDE/.claude/dashboard/server.js" \
  "$target/.claude/dashboard/server.js"
assert_same "$GENERATED_CLAUDE/.claude/skills/project-manager/SKILL.md" \
  "$target/.claude/skills/project-manager/SKILL.md"
assert_same "$GENERATED_CLAUDE/.claude/skills/think-partner/SKILL.md" \
  "$target/.claude/skills/think-partner/SKILL.md"
assert_same "$GENERATED_CLAUDE/.claude/skills/task-manager/SKILL.md" \
  "$target/.claude/skills/task-manager/SKILL.md"
node -e 'const fs=require("fs"); JSON.parse(fs.readFileSync(process.argv[1],"utf8"));' \
  "$target/.ddt/personal/todo.json"
node -e 'const fs=require("fs"); JSON.parse(fs.readFileSync(process.argv[1],"utf8"));' \
  "$target/.claude/settings.json"

runtime_target="$TMP_ROOT/runtime explicit workspace"
mkdir -p "$runtime_target"
"$BOOTSTRAP" --runtime claude "$runtime_target" > "$TMP_ROOT/runtime-bootstrap.log"

assert_same "$GENERATED_CLAUDE/README.md" "$runtime_target/README.md"
assert_same "$GENERATED_CLAUDE/CLAUDE.md" "$runtime_target/CLAUDE.md"
assert_same "$GENERATED_CLAUDE/.ddt/profile.md" "$runtime_target/.ddt/profile.md"
assert_same "$GENERATED_CLAUDE/.claude/settings.json" \
  "$runtime_target/.claude/settings.json"
assert_same "$GENERATED_CLAUDE/.claude/hooks/session-sync.sh" \
  "$runtime_target/.claude/hooks/session-sync.sh"
assert_executable "$runtime_target/.claude/hooks/session-sync.sh"
for command_template in "$GENERATED_CLAUDE/.claude/commands/"*.md; do
  command_name=$(basename "$command_template")
  assert_same "$command_template" "$runtime_target/.claude/commands/$command_name"
done

unsupported_target="$TMP_ROOT/unsupported runtime workspace"
mkdir -p "$unsupported_target"
printf 'keep\n' > "$unsupported_target/keep.txt"
if "$BOOTSTRAP" --runtime codex "$unsupported_target" > "$TMP_ROOT/unsupported.log" 2> "$TMP_ROOT/unsupported.err"; then
  fail "unsupported runtime should fail"
fi
assert_contains "$TMP_ROOT/unsupported.err" "unsupported runtime: codex"
assert_file "$unsupported_target/keep.txt"
assert_missing "$unsupported_target/.ddt"
assert_missing "$unsupported_target/.claude"
assert_missing "$unsupported_target/README.md"

printf 'USER CONFIG SENTINEL\n' > "$target/.ddt/config.md"
printf 'USER PROFILE SENTINEL\n' > "$target/.ddt/profile.md"
printf 'USER NORMS SENTINEL\n' > "$target/.ddt/norms.md"
printf 'USER REGISTRY SENTINEL\n' > "$target/.ddt/registry.md"
printf '{"user":"settings"}\n' > "$target/.claude/settings.json"
mkdir -p "$target/.ddt/projects/sample"
printf 'project data\n' > "$target/.ddt/projects/sample/status.md"
printf '{ "version": 1, "items": [{"id":"keep"}] }\n' > "$target/.ddt/personal/todo.json"
printf 'scratch index sentinel\n' > "$target/.ddt/personal/scratch/.index.md"

stale_system_files "$target"
"$BOOTSTRAP" --update "$target" > "$TMP_ROOT/default-update.log"
assert_user_files_preserved "$target"
assert_system_files_refreshed "$target"

stale_system_files "$target"
"$BOOTSTRAP" --update --runtime claude "$target" > "$TMP_ROOT/update.log"
assert_user_files_preserved "$target"
assert_system_files_refreshed "$target"

hook_target="$TMP_ROOT/hook workspace with spaces"
mkdir -p "$hook_target"
"$BOOTSTRAP" "$hook_target" > "$TMP_ROOT/hook-bootstrap.log"
command=$(settings_command "$hook_target/.claude/settings.json")
CLAUDE_PROJECT_DIR="$hook_target" sh -c "$command"

case "$command" in
  'sh "$CLAUDE_PROJECT_DIR/.claude/hooks/session-sync.sh"') ;;
  *) fail "unexpected hook command: $command" ;;
esac

echo "all tests passed"
