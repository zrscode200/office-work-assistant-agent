#!/usr/bin/env sh
set -eu

usage() {
  cat <<'EOF'
Usage:
  bootstrap/init-workspace.sh [--update] /path/to/target-dir

Stamps a target directory with the office work assistant agent:
  - README.md (workspace guide — structure, commands, conventions)
  - CLAUDE.md (agent operating manual — project management assistant)
  - .ddt/config.md (workspace settings and autonomy mode)
  - .ddt/profile.md (user profile template — role, team, context)
  - .ddt/norms.md (team working principles)
  - .ddt/registry.md (project registry — tracks all known projects)
  - .ddt/projects/ (where project artifacts live)
  - .ddt/personal/notebook/ (private notebook for ideas and brainstorms, gitignored)
  - .ddt/personal/scratch/ (quick-capture scratch pad with index, gitignored)
  - .claude/skills/project-manager/ (auto-triggering PM workflow skill)
  - .claude/skills/think-partner/ (auto-triggering thinking partner skill)
  - .claude/hooks/session-sync.sh (auto-syncs team repos on session start)
  - .claude/dashboard/template.html (HTML template for visual project dashboard)
  - .claude/settings.json (hook configuration — never overwritten on update)
  - .claude/commands/ (slash commands: new-project, project-status, meeting, decide, project-scoping, dashboard, create-project-update, jot, brainstorm, notebook)

Options:
  --update    Update system files (CLAUDE.md, skills, commands, hooks) in an existing workspace.
              User files (.ddt/config.md, profile.md, norms.md, registry.md, .claude/settings.json, projects/) are never touched.

If no path is given, the current directory is used.
Existing files are never overwritten unless --update is specified.
EOF
}

UPDATE_MODE=false
TARGET_INPUT=""

# Parse flags and positional args in any order
while [ $# -gt 0 ]; do
  case "$1" in
    -h|--help)
      usage
      exit 0
      ;;
    --update)
      UPDATE_MODE=true
      ;;
    *)
      TARGET_INPUT="$1"
      ;;
  esac
  shift
done

TARGET_INPUT="${TARGET_INPUT:-.}"

if [ ! -d "$TARGET_INPUT" ]; then
  echo "Error: target directory does not exist: $TARGET_INPUT" >&2
  exit 1
fi

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
TARGET_DIR=$(CDPATH= cd -- "$TARGET_INPUT" && pwd)

if [ "$TARGET_DIR" = "$REPO_ROOT" ]; then
  echo "Error: refusing to bootstrap the toolkit repository itself: $REPO_ROOT" >&2
  echo "Use a separate target directory." >&2
  exit 1
fi

# Validate required template files
for file in \
  "$REPO_ROOT/templates/README.md" \
  "$REPO_ROOT/templates/CLAUDE.md" \
  "$REPO_ROOT/templates/config.md" \
  "$REPO_ROOT/templates/profile.md" \
  "$REPO_ROOT/templates/norms.md" \
  "$REPO_ROOT/templates/registry.md" \
  "$REPO_ROOT/templates/gitignore" \
  "$REPO_ROOT/templates/skills/project-manager/SKILL.md" \
  "$REPO_ROOT/templates/skills/think-partner/SKILL.md" \
  "$REPO_ROOT/templates/hooks/session-sync.sh" \
  "$REPO_ROOT/templates/dashboard/template.html" \
  "$REPO_ROOT/templates/settings.json"; do
  if [ ! -f "$file" ]; then
    echo "Error: missing template file: $file" >&2
    exit 1
  fi
done

if [ ! -d "$REPO_ROOT/templates/commands" ]; then
  echo "Error: missing commands directory: $REPO_ROOT/templates/commands" >&2
  exit 1
fi

# Create directory structure
mkdir -p "$TARGET_DIR/.ddt/projects"
mkdir -p "$TARGET_DIR/.ddt/personal/scratch"
mkdir -p "$TARGET_DIR/.claude/commands"
mkdir -p "$TARGET_DIR/.claude/dashboard"
mkdir -p "$TARGET_DIR/.ddt/personal/notebook"
mkdir -p "$TARGET_DIR/.claude/skills/project-manager"
mkdir -p "$TARGET_DIR/.claude/skills/think-partner"
mkdir -p "$TARGET_DIR/.claude/hooks"

# Copy a file, skipping if it already exists
copy_if_missing() {
  src="$1"
  dst="$2"
  label="$3"

  if [ -e "$dst" ]; then
    echo "skip: $label already exists"
    return
  fi

  cp "$src" "$dst"
  echo "create: $label"
}

# Copy a file, overwriting if it exists (for --update mode)
copy_and_overwrite() {
  src="$1"
  dst="$2"
  label="$3"

  if [ -e "$dst" ]; then
    if cmp -s "$src" "$dst"; then
      echo "unchanged: $label"
      return
    fi
    cp "$src" "$dst"
    echo "update: $label"
  else
    cp "$src" "$dst"
    echo "create: $label"
  fi
}

# --- System files (updated with --update) ---

if [ "$UPDATE_MODE" = true ]; then
  echo "=== Update mode: refreshing system files ==="
  copy_fn="copy_and_overwrite"
else
  copy_fn="copy_if_missing"
fi

# README.md
$copy_fn "$REPO_ROOT/templates/README.md" "$TARGET_DIR/README.md" "README.md"

# CLAUDE.md
$copy_fn "$REPO_ROOT/templates/CLAUDE.md" "$TARGET_DIR/CLAUDE.md" "CLAUDE.md"

# Skills
$copy_fn "$REPO_ROOT/templates/skills/project-manager/SKILL.md" \
  "$TARGET_DIR/.claude/skills/project-manager/SKILL.md" \
  ".claude/skills/project-manager/SKILL.md"

$copy_fn "$REPO_ROOT/templates/skills/think-partner/SKILL.md" \
  "$TARGET_DIR/.claude/skills/think-partner/SKILL.md" \
  ".claude/skills/think-partner/SKILL.md"

# Session-sync hook
$copy_fn "$REPO_ROOT/templates/hooks/session-sync.sh" \
  "$TARGET_DIR/.claude/hooks/session-sync.sh" \
  ".claude/hooks/session-sync.sh"
chmod +x "$TARGET_DIR/.claude/hooks/session-sync.sh"

# Slash commands
for cmd in "$REPO_ROOT/templates/commands/"*.md; do
  cmd_name=$(basename "$cmd")
  $copy_fn "$cmd" "$TARGET_DIR/.claude/commands/$cmd_name" ".claude/commands/$cmd_name"
done

# Dashboard template
$copy_fn "$REPO_ROOT/templates/dashboard/template.html" \
  "$TARGET_DIR/.claude/dashboard/template.html" \
  ".claude/dashboard/template.html"

# --- User files (never overwritten, even with --update) ---

copy_if_missing "$REPO_ROOT/templates/config.md" "$TARGET_DIR/.ddt/config.md" ".ddt/config.md"
copy_if_missing "$REPO_ROOT/templates/profile.md" "$TARGET_DIR/.ddt/profile.md" ".ddt/profile.md"
copy_if_missing "$REPO_ROOT/templates/norms.md" "$TARGET_DIR/.ddt/norms.md" ".ddt/norms.md"
copy_if_missing "$REPO_ROOT/templates/registry.md" "$TARGET_DIR/.ddt/registry.md" ".ddt/registry.md"
copy_if_missing "$REPO_ROOT/templates/settings.json" "$TARGET_DIR/.claude/settings.json" ".claude/settings.json"

# Gitignore (append if .gitignore exists, create if not)
if [ -e "$TARGET_DIR/.gitignore" ]; then
  if grep -q ".ddt/personal/notebook/" "$TARGET_DIR/.gitignore" 2>/dev/null; then
    echo "skip: .gitignore already contains workspace entries"
  elif grep -q ".ddt/personal/scratch/" "$TARGET_DIR/.gitignore" 2>/dev/null; then
    # Existing workspace from before notebook feature — add notebook entry
    tmp_gitignore="$TARGET_DIR/.gitignore.tmp.$$"
    sed 's|.ddt/personal/scratch/|.ddt/personal/notebook/\
.ddt/personal/scratch/|' "$TARGET_DIR/.gitignore" > "$tmp_gitignore"
    mv "$tmp_gitignore" "$TARGET_DIR/.gitignore"
    echo "update: added notebook to .gitignore"
  else
    echo "" >> "$TARGET_DIR/.gitignore"
    cat "$REPO_ROOT/templates/gitignore" >> "$TARGET_DIR/.gitignore"
    echo "update: appended workspace entries to .gitignore"
  fi
else
  cp "$REPO_ROOT/templates/gitignore" "$TARGET_DIR/.gitignore"
  echo "create: .gitignore"
fi

# Placeholder files for empty directories
if [ ! -e "$TARGET_DIR/.ddt/projects/.gitkeep" ]; then
  touch "$TARGET_DIR/.ddt/projects/.gitkeep"
  echo "create: .ddt/projects/.gitkeep"
fi
if [ ! -e "$TARGET_DIR/.ddt/personal/notebook/.gitkeep" ]; then
  touch "$TARGET_DIR/.ddt/personal/notebook/.gitkeep"
  echo "create: .ddt/personal/notebook/.gitkeep"
fi
if [ ! -e "$TARGET_DIR/.ddt/personal/scratch/.gitkeep" ]; then
  touch "$TARGET_DIR/.ddt/personal/scratch/.gitkeep"
  echo "create: .ddt/personal/scratch/.gitkeep"
fi

# Scratch pad index
if [ ! -e "$TARGET_DIR/.ddt/personal/scratch/.index.md" ]; then
  cat > "$TARGET_DIR/.ddt/personal/scratch/.index.md" <<'INDEXEOF'
# Scratch Pad Index

| File | Topic | Status | Promoted To |
|------|-------|--------|-------------|
INDEXEOF
  echo "create: .ddt/personal/scratch/.index.md"
fi

# Init git if not already a repo
if ! git -C "$TARGET_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git -C "$TARGET_DIR" init
  echo "create: initialized git repository"
fi

if [ "$UPDATE_MODE" = true ]; then
  cat <<'EOF'

Update complete. System files (CLAUDE.md, skills, commands, hooks) have been refreshed.
User files (.ddt/config.md, profile.md, norms.md, registry.md, .claude/settings.json, projects/, scratch/.index.md) were not touched.
EOF
else
  cat <<'EOF'

Setup complete. Next steps:
- Fill in .ddt/profile.md with your role, team, and context
- Review .ddt/norms.md and customize your team's working principles
- Edit .ddt/config.md to set your name and autonomy mode
- Open Claude Code in the workspace directory
- Try: "new project: <name>" or use /new-project to scaffold your first project
- Available commands: /new-project, /project-status, /meeting, /decide, /project-scoping, /dashboard, /create-project-update, /sync, /jot, /brainstorm, /notebook
- For team collaboration: add team repos to the Team Repos section in .ddt/config.md
EOF
fi
