#!/usr/bin/env sh
# Session-start hook: pulls all configured team repos for freshness.
# Runs automatically at the start of each Claude Code session.
# Outputs additionalContext so the agent knows the sync status.
set -eu

project_dir="${CLAUDE_PROJECT_DIR:-.}"
config_file="$project_dir/.ddt/config.md"

# No config — nothing to sync
if [ ! -f "$config_file" ]; then
  exit 0
fi

# Extract team repo entries: lines like "name: /absolute/path"
repos=$(grep -E '^[a-z][a-z0-9-]*: /' "$config_file" 2>/dev/null || true)
if [ -z "$repos" ]; then
  exit 0
fi

status=""

while IFS= read -r entry; do
  [ -z "$entry" ] && continue
  name="${entry%%:*}"
  path="${entry#*: }"
  # Trim whitespace
  path=$(echo "$path" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')

  if [ ! -d "$path/.git" ]; then
    status="${status}- ${name}: not a git repo (${path})\\n"
    continue
  fi

  output=$(git -C "$path" pull --ff-only 2>&1) || true
  case "$output" in
    *"Already up to date"*)
      status="${status}- ${name}: up to date\\n"
      ;;
    *"Updating"*|*"Fast-forward"*)
      status="${status}- ${name}: synced (pulled new changes)\\n"
      ;;
    *)
      status="${status}- ${name}: needs manual pull (local has diverged or has conflicts)\\n"
      ;;
  esac
done <<EOF
$repos
EOF

if [ -n "$status" ]; then
  printf '{"additionalContext": "## Team Repo Sync\\n%s"}\n' "$status"
fi
