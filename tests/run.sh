#!/usr/bin/env sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
BOOTSTRAP="$ROOT/bootstrap/init-workspace.sh"
GENERATED_CLAUDE="$ROOT/generated/claude"
GENERATED_CODEX="$ROOT/generated/codex"
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

generated_files() {
  generated_root="$1"

  (cd "$generated_root" && find . -type f -print | sed 's#^\./##' | sort)
}

codex_command_reference() {
  command_name="$1"

  case "$command_name" in
    brainstorm.md|jot.md|notebook.md)
      printf '%s\n' "$GENERATED_CODEX/.codex/skills/think-partner/references/$command_name"
      ;;
    todo.md)
      printf '%s\n' "$GENERATED_CODEX/.codex/skills/task-manager/references/$command_name"
      ;;
    *)
      printf '%s\n' "$GENERATED_CODEX/.codex/skills/project-manager/references/$command_name"
      ;;
  esac
}

is_user_owned_generated_file() {
  case "$1" in
    .ddt/config.md|\
    .ddt/profile.md|\
    .ddt/norms.md|\
    .ddt/registry.md|\
    .ddt/projects/.gitkeep|\
    .ddt/personal/notebook/.gitkeep|\
    .ddt/personal/scratch/.gitkeep|\
    .ddt/personal/todo.json|\
    .ddt/personal/scratch/.index.md|\
    .claude/settings.json|\
    .codex/config.toml)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

is_preserved_on_update() {
  case "$1" in
    .gitignore)
      return 0
      ;;
    *)
      is_user_owned_generated_file "$1"
      ;;
  esac
}

assert_install_matches_generated() {
  generated_root="$1"
  install_target="$2"

  generated_files "$generated_root" | while IFS= read -r rel; do
    assert_file "$install_target/$rel"
    assert_same "$generated_root/$rel" "$install_target/$rel"
    if [ -x "$generated_root/$rel" ]; then
      assert_executable "$install_target/$rel"
    fi
  done
}

stale_system_files() {
  generated_root="$1"
  update_target="$2"

  generated_files "$generated_root" | while IFS= read -r rel; do
    is_preserved_on_update "$rel" && continue
    printf 'STALE MANAGED FILE: %s\n' "$rel" > "$update_target/$rel"
    chmod 644 "$update_target/$rel"
  done
}

assert_user_files_preserved() {
  update_target="$1"
  runtime="$2"

  assert_contains "$update_target/.ddt/config.md" "USER CONFIG SENTINEL"
  assert_contains "$update_target/.ddt/profile.md" "USER PROFILE SENTINEL"
  assert_contains "$update_target/.ddt/norms.md" "USER NORMS SENTINEL"
  assert_contains "$update_target/.ddt/registry.md" "USER REGISTRY SENTINEL"
  assert_contains "$update_target/.ddt/personal/todo.json" '"keep"'
  assert_contains "$update_target/.ddt/personal/scratch/.index.md" "scratch index sentinel"
  assert_contains "$update_target/.ddt/projects/.gitkeep" "projects placeholder sentinel"
  assert_contains "$update_target/.ddt/personal/notebook/.gitkeep" "notebook placeholder sentinel"
  assert_contains "$update_target/.ddt/personal/scratch/.gitkeep" "scratch placeholder sentinel"
  assert_file "$update_target/.ddt/projects/sample/status.md"

  case "$runtime" in
    claude)
      assert_contains "$update_target/.claude/settings.json" '"user"'
      ;;
    codex)
      assert_contains "$update_target/.codex/config.toml" "USER CODEX CONFIG SENTINEL"
      ;;
    *)
      fail "unknown runtime for preservation assertion: $runtime"
      ;;
  esac
}

write_shared_user_sentinels() {
  update_target="$1"

  printf 'USER CONFIG SENTINEL\n' > "$update_target/.ddt/config.md"
  printf 'USER PROFILE SENTINEL\n' > "$update_target/.ddt/profile.md"
  printf 'USER NORMS SENTINEL\n' > "$update_target/.ddt/norms.md"
  printf 'USER REGISTRY SENTINEL\n' > "$update_target/.ddt/registry.md"
  mkdir -p "$update_target/.ddt/projects/sample"
  printf 'project data\n' > "$update_target/.ddt/projects/sample/status.md"
  printf '{ "version": 1, "items": [{"id":"keep"}] }\n' > "$update_target/.ddt/personal/todo.json"
  printf 'scratch index sentinel\n' > "$update_target/.ddt/personal/scratch/.index.md"
  printf 'projects placeholder sentinel\n' > "$update_target/.ddt/projects/.gitkeep"
  printf 'notebook placeholder sentinel\n' > "$update_target/.ddt/personal/notebook/.gitkeep"
  printf 'scratch placeholder sentinel\n' > "$update_target/.ddt/personal/scratch/.gitkeep"
}

assert_system_files_refreshed() {
  generated_root="$1"
  update_target="$2"

  generated_files "$generated_root" | while IFS= read -r rel; do
    is_preserved_on_update "$rel" && continue
    assert_same "$generated_root/$rel" "$update_target/$rel"
    if [ -x "$generated_root/$rel" ]; then
      assert_executable "$update_target/$rel"
    fi
  done
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

assert_file "$GENERATED_CODEX/AGENTS.md"
assert_file "$GENERATED_CODEX/README.md"
assert_file "$GENERATED_CODEX/.codex/config.toml"
assert_file "$GENERATED_CODEX/.gitignore"
assert_file "$GENERATED_CODEX/.ddt/config.md"
assert_file "$GENERATED_CODEX/.ddt/profile.md"
assert_file "$GENERATED_CODEX/.ddt/norms.md"
assert_file "$GENERATED_CODEX/.ddt/registry.md"
assert_file "$GENERATED_CODEX/.ddt/projects/.gitkeep"
assert_file "$GENERATED_CODEX/.ddt/personal/notebook/.gitkeep"
assert_file "$GENERATED_CODEX/.ddt/personal/scratch/.gitkeep"
assert_file "$GENERATED_CODEX/.ddt/personal/scratch/.index.md"
assert_file "$GENERATED_CODEX/.ddt/personal/todo.json"
assert_tracked "generated/codex/.ddt/personal/notebook/.gitkeep"
assert_tracked "generated/codex/.ddt/personal/scratch/.gitkeep"
assert_tracked "generated/codex/.ddt/personal/scratch/.index.md"
assert_tracked "generated/codex/.ddt/personal/todo.json"
assert_file "$GENERATED_CODEX/.codex/skills/project-manager/SKILL.md"
assert_file "$GENERATED_CODEX/.codex/skills/think-partner/SKILL.md"
assert_file "$GENERATED_CODEX/.codex/skills/task-manager/SKILL.md"
assert_file "$GENERATED_CODEX/.codex/dashboard/template.html"
assert_file "$GENERATED_CODEX/.codex/dashboard/server.js"
assert_missing "$GENERATED_CODEX/.claude"
assert_missing "$GENERATED_CODEX/CLAUDE.md"
node --check "$GENERATED_CODEX/.codex/dashboard/server.js"
assert_contains "$GENERATED_CODEX/.codex/config.toml" "./skills/project-manager"
assert_contains "$GENERATED_CODEX/.codex/config.toml" "./skills/think-partner"
assert_contains "$GENERATED_CODEX/.codex/config.toml" "./skills/task-manager"
assert_contains "$GENERATED_CODEX/.codex/skills/project-manager/SKILL.md" "AGENTS.md"
assert_not_contains "$GENERATED_CODEX/.codex/skills/project-manager/SKILL.md" "CLAUDE.md"
assert_contains "$GENERATED_CODEX/.codex/skills/project-manager/references/dashboard.md" \
  ".codex/dashboard/server.js"
assert_not_contains "$GENERATED_CODEX/.codex/skills/project-manager/references/dashboard.md" \
  ".claude/dashboard"
assert_contains "$GENERATED_CODEX/.codex/dashboard/server.js" "'.codex', 'dashboard'"
assert_not_contains "$GENERATED_CODEX/.codex/dashboard/server.js" ".claude/dashboard"
assert_not_contains "$GENERATED_CODEX/.codex/dashboard/server.js" "git pull --ff-only"
assert_not_contains "$GENERATED_CODEX/.codex/dashboard/server.js" "execSync"
assert_not_contains "$GENERATED_CODEX/.codex/skills/project-manager/references/self-tutorial.md" '`/'
assert_not_contains "$GENERATED_CODEX/.codex/skills/project-manager/references/self-tutorial.md" \
  "slash command"
assert_not_contains "$GENERATED_CODEX/.codex/skills/project-manager/references/self-tutorial.md" \
  "hook automatically pulls"
assert_contains "$GENERATED_CODEX/.codex/skills/project-manager/references/self-tutorial.md" \
  "Codex does not run an automatic workspace sync hook"
for shared_file in \
  .gitignore \
  .ddt/config.md \
  .ddt/profile.md \
  .ddt/norms.md \
  .ddt/registry.md \
  .ddt/projects/.gitkeep \
  .ddt/personal/notebook/.gitkeep \
  .ddt/personal/scratch/.gitkeep \
  .ddt/personal/scratch/.index.md \
  .ddt/personal/todo.json; do
  assert_same "$GENERATED_CLAUDE/$shared_file" "$GENERATED_CODEX/$shared_file"
done
for command_template in "$ROOT/core/commands/"*.md; do
  command_name=$(basename "$command_template")
  assert_file "$(codex_command_reference "$command_name")"
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
assert_install_matches_generated "$GENERATED_CLAUDE" "$target"
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
assert_install_matches_generated "$GENERATED_CLAUDE" "$runtime_target"

codex_target="$TMP_ROOT/codex runtime workspace"
mkdir -p "$codex_target"
"$BOOTSTRAP" --runtime codex "$codex_target" > "$TMP_ROOT/codex-bootstrap.log"

assert_file "$codex_target/AGENTS.md"
assert_file "$codex_target/README.md"
assert_file "$codex_target/.codex/config.toml"
assert_file "$codex_target/.codex/skills/project-manager/SKILL.md"
assert_file "$codex_target/.codex/skills/think-partner/SKILL.md"
assert_file "$codex_target/.codex/skills/task-manager/SKILL.md"
assert_file "$codex_target/.codex/dashboard/template.html"
assert_file "$codex_target/.codex/dashboard/server.js"
assert_file "$codex_target/.ddt/config.md"
assert_file "$codex_target/.ddt/profile.md"
assert_file "$codex_target/.ddt/norms.md"
assert_file "$codex_target/.ddt/registry.md"
assert_file "$codex_target/.ddt/personal/todo.json"
assert_missing "$codex_target/CLAUDE.md"
assert_missing "$codex_target/.claude"
assert_install_matches_generated "$GENERATED_CODEX" "$codex_target"
node --check "$codex_target/.codex/dashboard/server.js"
git -C "$codex_target" rev-parse --is-inside-work-tree >/dev/null 2>&1 ||
  fail "codex target should be a git worktree"

unsupported_target="$TMP_ROOT/unsupported runtime workspace"
mkdir -p "$unsupported_target"
printf 'keep\n' > "$unsupported_target/keep.txt"
if "$BOOTSTRAP" --runtime opencode "$unsupported_target" > "$TMP_ROOT/unsupported.log" 2> "$TMP_ROOT/unsupported.err"; then
  fail "unsupported runtime should fail"
fi
assert_contains "$TMP_ROOT/unsupported.err" "unsupported runtime: opencode"
assert_file "$unsupported_target/keep.txt"
assert_missing "$unsupported_target/.ddt"
assert_missing "$unsupported_target/.claude"
assert_missing "$unsupported_target/.codex"
assert_missing "$unsupported_target/README.md"

write_shared_user_sentinels "$target"
printf '{"user":"settings"}\n' > "$target/.claude/settings.json"

stale_system_files "$GENERATED_CLAUDE" "$target"
"$BOOTSTRAP" --update "$target" > "$TMP_ROOT/default-update.log"
assert_user_files_preserved "$target" claude
assert_system_files_refreshed "$GENERATED_CLAUDE" "$target"

stale_system_files "$GENERATED_CLAUDE" "$target"
"$BOOTSTRAP" --update --runtime claude "$target" > "$TMP_ROOT/update.log"
assert_user_files_preserved "$target" claude
assert_system_files_refreshed "$GENERATED_CLAUDE" "$target"

write_shared_user_sentinels "$codex_target"
printf 'USER CODEX CONFIG SENTINEL\n' > "$codex_target/.codex/config.toml"

stale_system_files "$GENERATED_CODEX" "$codex_target"
"$BOOTSTRAP" --update --runtime codex "$codex_target" > "$TMP_ROOT/codex-update.log"
assert_user_files_preserved "$codex_target" codex
assert_system_files_refreshed "$GENERATED_CODEX" "$codex_target"
assert_missing "$codex_target/CLAUDE.md"
assert_missing "$codex_target/.claude"

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
