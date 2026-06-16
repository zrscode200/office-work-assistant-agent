#!/usr/bin/env sh
set -eu

usage() {
  cat <<'EOF'
Usage:
  bootstrap/init-workspace.sh [--update] [--runtime claude|codex|opencode] /path/to/target-dir

Stamps a target directory with the office work assistant agent:
  - README.md (workspace guide — structure, commands, conventions)
  - Runtime operating manual (CLAUDE.md for Claude, AGENTS.md for Codex/OpenCode)
  - .ddt/config.md (workspace settings and autonomy mode)
  - .ddt/profile.md (user profile template — role, team, context)
  - .ddt/norms.md (team working principles)
  - .ddt/registry.md (project registry — tracks all known projects)
  - .ddt/projects/ (where project artifacts live)
  - .ddt/personal/notebook/ (private notebook for ideas and brainstorms, gitignored)
  - .ddt/personal/scratch/ (quick-capture scratch pad with index, gitignored)
  - Runtime skills (Claude .claude/skills, Codex .codex/skills, OpenCode .opencode/skills)
  - .ddt/personal/todo.json (personal todo list, gitignored)
  - Runtime dashboard assets (Claude .claude/dashboard, Codex .codex/dashboard, OpenCode .opencode/dashboard)
  - Runtime user config (.claude/settings.json, .codex/config.toml, or opencode.json — never overwritten on update)
  - Runtime command/reference files

Options:
  --runtime claude|codex|opencode
              Select the runtime surface to install. Currently supported:
              claude, codex, opencode. If omitted, claude is used.
  --update    Update system files for the selected runtime in an existing workspace.
              User files (.ddt/config.md, profile.md, norms.md, registry.md,
              .claude/settings.json, .codex/config.toml, opencode.json, projects/) are never touched.

If no path is given, the current directory is used.
Existing files are never overwritten unless --update is specified.
EOF
}

UPDATE_MODE=false
SUPPORTED_RUNTIMES="claude codex opencode"
RUNTIME_INPUT="claude"
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
    --runtime)
      shift
      if [ $# -eq 0 ]; then
        echo "Error: --runtime requires a value" >&2
        exit 1
      fi
      RUNTIME_INPUT="$1"
      ;;
    --runtime=*)
      RUNTIME_INPUT="${1#--runtime=}"
      ;;
    *)
      TARGET_INPUT="$1"
      ;;
  esac
  shift
done

TARGET_INPUT="${TARGET_INPUT:-.}"

case "$RUNTIME_INPUT" in
  claude|codex|opencode) ;;
  *)
    echo "Error: unsupported runtime: $RUNTIME_INPUT" >&2
    echo "Supported runtimes: $SUPPORTED_RUNTIMES" >&2
    exit 1
    ;;
esac

if [ ! -d "$TARGET_INPUT" ]; then
  echo "Error: target directory does not exist: $TARGET_INPUT" >&2
  exit 1
fi

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
RUNTIME_TEMPLATE_ROOT="$REPO_ROOT/generated/$RUNTIME_INPUT"
TARGET_DIR=$(CDPATH= cd -- "$TARGET_INPUT" && pwd)

if [ "$TARGET_DIR" = "$REPO_ROOT" ]; then
  echo "Error: refusing to bootstrap the toolkit repository itself: $REPO_ROOT" >&2
  echo "Use a separate target directory." >&2
  exit 1
fi

if [ ! -d "$RUNTIME_TEMPLATE_ROOT" ]; then
  echo "Error: missing generated template for runtime '$RUNTIME_INPUT': $RUNTIME_TEMPLATE_ROOT" >&2
  exit 1
fi

template_files() {
  (cd "$RUNTIME_TEMPLATE_ROOT" && find . -type f -print | sed 's#^\./##' | sort)
}

is_user_owned_file() {
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
    .codex/config.toml|\
    opencode.json)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

ensure_parent_dir() {
  mkdir -p "$(dirname -- "$1")"
}

apply_template_mode() {
  mode_src="$1"
  mode_dst="$2"

  if [ -x "$mode_src" ]; then
    chmod 755 "$mode_dst"
  else
    chmod 644 "$mode_dst"
  fi
}

# Copy a file, skipping if it already exists
copy_if_missing() {
  src="$1"
  dst="$2"
  label="$3"

  if [ -e "$dst" ]; then
    echo "skip: $label already exists"
    return
  fi

  ensure_parent_dir "$dst"
  cp "$src" "$dst"
  apply_template_mode "$src" "$dst"
  echo "create: $label"
}

# Copy a file, overwriting if it exists (for --update mode)
copy_and_overwrite() {
  src="$1"
  dst="$2"
  label="$3"
  tmp="$dst.tmp.$$"

  ensure_parent_dir "$dst"
  if [ -e "$dst" ]; then
    cp "$src" "$tmp"
    apply_template_mode "$src" "$tmp"
    if cmp -s "$tmp" "$dst"; then
      apply_template_mode "$src" "$dst"
      rm -f "$tmp"
      echo "unchanged: $label"
      return
    fi
    mv "$tmp" "$dst"
    echo "update: $label"
  else
    cp "$src" "$dst"
    apply_template_mode "$src" "$dst"
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

install_gitignore() {
  src="$RUNTIME_TEMPLATE_ROOT/.gitignore"

  if [ -e "$TARGET_DIR/.gitignore" ]; then
    if grep -q ".ddt/personal/notebook/" "$TARGET_DIR/.gitignore" 2>/dev/null; then
      echo "skip: .gitignore already contains workspace entries"
    elif grep -q ".ddt/personal/scratch/" "$TARGET_DIR/.gitignore" 2>/dev/null; then
      # Existing workspace from before notebook feature — add notebook entry.
      tmp_gitignore="$TARGET_DIR/.gitignore.tmp.$$"
      sed 's|.ddt/personal/scratch/|.ddt/personal/notebook/\
.ddt/personal/scratch/|' "$TARGET_DIR/.gitignore" > "$tmp_gitignore"
      mv "$tmp_gitignore" "$TARGET_DIR/.gitignore"
      echo "update: added notebook to .gitignore"
    else
      echo "" >> "$TARGET_DIR/.gitignore"
      cat "$src" >> "$TARGET_DIR/.gitignore"
      echo "update: appended workspace entries to .gitignore"
    fi
  else
    cp "$src" "$TARGET_DIR/.gitignore"
    apply_template_mode "$src" "$TARGET_DIR/.gitignore"
    echo "create: .gitignore"
  fi
}

install_template_file() {
  rel="$1"
  src="$RUNTIME_TEMPLATE_ROOT/$rel"
  dst="$TARGET_DIR/$rel"

  if [ "$rel" = ".gitignore" ]; then
    install_gitignore
  elif is_user_owned_file "$rel"; then
    copy_if_missing "$src" "$dst" "$rel"
  else
    $copy_fn "$src" "$dst" "$rel"
  fi
}

RUNTIME_FILES_TMP="${TMPDIR:-/tmp}/office-work-runtime-files.$$"
trap 'rm -f "$RUNTIME_FILES_TMP"' EXIT HUP INT TERM
template_files > "$RUNTIME_FILES_TMP"
if [ ! -s "$RUNTIME_FILES_TMP" ]; then
  echo "Error: generated template for runtime '$RUNTIME_INPUT' has no files: $RUNTIME_TEMPLATE_ROOT" >&2
  exit 1
fi

while IFS= read -r rel; do
  [ -n "$rel" ] || continue
  install_template_file "$rel"
done < "$RUNTIME_FILES_TMP"

# Init git if not already a repo
if ! git -C "$TARGET_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git -C "$TARGET_DIR" init
  echo "create: initialized git repository"
fi

if [ "$UPDATE_MODE" = true ]; then
  cat <<'EOF'

Update complete. System files for the selected runtime have been refreshed.
User files (.ddt/config.md, profile.md, norms.md, registry.md, .claude/settings.json, .codex/config.toml, opencode.json, projects/, scratch/.index.md, todo.json) were not touched.
EOF
else
  if [ "$RUNTIME_INPUT" = "codex" ]; then
    cat <<'EOF'

Setup complete. Next steps:
- Fill in .ddt/profile.md with your role, team, and context
- Review .ddt/norms.md and customize your team's working principles
- Edit .ddt/config.md to set your name and autonomy mode
- Open Codex in the workspace directory
- Try: "new project: <name>" or use the project-manager skill references for common workflows
- Available workflows: new-project, project-status, meeting, decide, project-scoping, project-comment, dashboard, create-project-update, sync, jot, brainstorm, notebook, todo, self-tutorial
- For team collaboration: add team repos to the Team Repos section in .ddt/config.md
EOF
  elif [ "$RUNTIME_INPUT" = "opencode" ]; then
    cat <<'EOF'

Setup complete. Next steps:
- Fill in .ddt/profile.md with your role, team, and context
- Review .ddt/norms.md and customize your team's working principles
- Edit .ddt/config.md to set your name and autonomy mode
- Open OpenCode in the workspace directory
- Try: "new project: <name>" or use /new-project to scaffold your first project
- Available commands: /new-project, /project-status, /meeting, /decide, /project-scoping, /project-comment, /dashboard, /create-project-update, /sync, /jot, /brainstorm, /notebook, /todo, /self-tutorial
- For team collaboration: add team repos to the Team Repos section in .ddt/config.md
EOF
  else
    cat <<'EOF'

Setup complete. Next steps:
- Fill in .ddt/profile.md with your role, team, and context
- Review .ddt/norms.md and customize your team's working principles
- Edit .ddt/config.md to set your name and autonomy mode
- Open Claude Code in the workspace directory
- Try: "new project: <name>" or use /new-project to scaffold your first project
- Available commands: /new-project, /project-status, /meeting, /decide, /project-scoping, /project-comment, /dashboard, /create-project-update, /sync, /jot, /brainstorm, /notebook, /todo, /self-tutorial
- For team collaboration: add team repos to the Team Repos section in .ddt/config.md
EOF
  fi
fi
