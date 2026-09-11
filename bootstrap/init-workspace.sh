#!/usr/bin/env sh
set -eu

usage() {
  cat <<'USAGE'
Usage:
  bootstrap/init-workspace.sh [--update] [--runtime claude|codex|opencode|copilot|deepagents] [--no-git] /path/to/target-dir

Installs the selected assistant surface and shared runtime:
  - Operating manual and README (Copilot loads its manual from .ddt/runtime/,
    deepagents clients from .deepagents/AGENTS.md beside your own AGENTS.md)
  - .ddt/config.md, profile.md, norms.md (user-owned; seeded only when missing)
  - .ddt/projects/ and .ddt/personal/notes|work/ (private records; never touched)
  - .ddt/runtime/ (shared helper, workflows, and local dashboard; Node.js 18+)
  - Runtime skills, command/reference shortcuts, and user config
  - .ddt/runtime/manifest.<runtime>.txt recording which files the toolkit manages

Fresh install: existing files are never overwritten. A pre-existing README.md,
CLAUDE.md or AGENTS.md is kept and recorded as yours. The target becomes a Git
repository unless it already is one or --no-git is given. A deepagents workspace
is always made its own Git root, must be stamped for that runtime alone, and
keeps the root AGENTS.md as the client's memory file.

--update refreshes the files the manifest records as toolkit-managed and keeps
files recorded as yours. User-owned files (.ddt/config.md, profile.md, norms.md,
.claude/settings.json, .codex/config.toml, opencode.json,
.github/copilot-instructions.md, and for deepagents AGENTS.md, .deepagents/skills.toml
and .deepagents/hooks.json, plus projects and personal records) are never
touched; a notice is printed when one differs from the current toolkit version.
A workspace installed before manifests existed gets its root README.md,
CLAUDE.md or AGENTS.md backed up as <file>.before-update-<timestamp> before
they are refreshed. Files an older version managed but this version no longer
ships are reported, never deleted. Without --runtime, --update detects the
installed runtime from the manifest.

Options:
  --runtime claude|codex|opencode|copilot|deepagents
                                            Runtime surface (fresh install default: claude)
  --update                                  Update an existing workspace
  --no-git                                  Do not initialize a Git repository
USAGE
}

UPDATE_MODE=false
NO_GIT=false
SUPPORTED_RUNTIMES="claude codex opencode copilot deepagents"
RUNTIME_INPUT=""
TARGET_INPUT=""

while [ $# -gt 0 ]; do
  case "$1" in
    -h|--help)
      usage
      exit 0
      ;;
    --update)
      UPDATE_MODE=true
      ;;
    --no-git)
      NO_GIT=true
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
    -*)
      echo "Error: unknown option: $1" >&2
      echo "Run with --help for usage." >&2
      exit 1
      ;;
    *)
      if [ -n "$TARGET_INPUT" ]; then
        echo "Error: only one target directory is allowed (got '$TARGET_INPUT' and '$1')" >&2
        exit 1
      fi
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

# Physical paths, so a symlink alias cannot slip past the toolkit-tree guard.
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd -P)
TARGET_DIR=$(CDPATH= cd -- "$TARGET_INPUT" && pwd -P)
TOOLKIT_VERSION=$(cat "$REPO_ROOT/VERSION" 2>/dev/null || echo unknown)
STAMP=$(date -u +%Y%m%dT%H%M%SZ)

case "$TARGET_DIR" in
  "$REPO_ROOT"|"$REPO_ROOT"/*)
    echo "Error: refusing to bootstrap inside the toolkit repository: $TARGET_DIR" >&2
    echo "Use a separate target directory." >&2
    exit 1
    ;;
esac

detect_runtimes() {
  for manifest in "$TARGET_DIR"/.ddt/runtime/manifest.*.txt; do
    [ -f "$manifest" ] || continue
    name="${manifest##*/manifest.}"
    echo "${name%.txt}"
  done
}

if [ -z "$RUNTIME_INPUT" ]; then
  if [ "$UPDATE_MODE" = true ]; then
    detected=$(detect_runtimes)
    count=$(printf '%s\n' "$detected" | grep -c . || true)
    if [ "$count" -eq 1 ]; then
      RUNTIME_INPUT="$detected"
      echo "notice: updating installed runtime '$RUNTIME_INPUT' (from manifest)"
    elif [ "$count" -gt 1 ]; then
      echo "Error: several runtimes are installed ($(printf '%s' "$detected" | tr '\n' ' ')); pass --runtime" >&2
      exit 1
    else
      echo "Error: no manifest found in $TARGET_DIR; pass --runtime for this workspace" >&2
      exit 1
    fi
  else
    RUNTIME_INPUT="claude"
  fi
fi

case "$RUNTIME_INPUT" in
  claude|codex|opencode|copilot|deepagents) ;;
  *)
    echo "Error: unsupported runtime: $RUNTIME_INPUT" >&2
    echo "Supported runtimes: $SUPPORTED_RUNTIMES" >&2
    exit 1
    ;;
esac

RUNTIME_TEMPLATE_ROOT="$REPO_ROOT/generated/$RUNTIME_INPUT"
if [ ! -d "$RUNTIME_TEMPLATE_ROOT" ]; then
  echo "Error: missing generated template for runtime '$RUNTIME_INPUT': $RUNTIME_TEMPLATE_ROOT" >&2
  exit 1
fi

if [ "$RUNTIME_INPUT" = "deepagents" ] && [ "$NO_GIT" = true ]; then
  echo "Error: deepagents clients locate the workspace by its Git root; --no-git is not supported for this runtime" >&2
  exit 1
fi

# deepagents workspaces are stamped alone: the client loads the root AGENTS.md as
# memory, and another runtime uses that same file as its manual.
for manifest in "$TARGET_DIR"/.ddt/runtime/manifest.*.txt; do
  [ -f "$manifest" ] || continue
  name="${manifest##*/manifest.}"
  name="${name%.txt}"
  [ "$name" = "$RUNTIME_INPUT" ] && continue
  if [ "$RUNTIME_INPUT" = "deepagents" ] || [ "$name" = "deepagents" ]; then
    echo "Error: this workspace is stamped for '$name'; deepagents workspaces are stamped alone because the root AGENTS.md is the client's memory file and another runtime's manual. Use a separate folder." >&2
    exit 1
  fi
done
# Workspaces installed before manifests existed are recognized by their office skills.
if [ "$RUNTIME_INPUT" = "deepagents" ]; then
  for marker in .claude/skills/project-manager .codex/skills/project-manager .opencode/skills/project-manager .github/skills/office-projects; do
    if [ -e "$TARGET_DIR/$marker" ]; then
      echo "Error: this workspace carries another runtime's office skills ($marker); deepagents workspaces are stamped alone. Use a separate folder." >&2
      exit 1
    fi
  done
elif [ -f "$TARGET_DIR/.deepagents/AGENTS.md" ] && grep -q '^Managed by the Office Work Assistant toolkit' "$TARGET_DIR/.deepagents/AGENTS.md"; then
  echo "Error: this workspace is stamped for deepagents, whose root AGENTS.md is the client's memory file; deepagents workspaces are stamped alone. Stamp '$RUNTIME_INPUT' in a separate folder." >&2
  exit 1
fi

MANIFEST_REL=".ddt/runtime/manifest.$RUNTIME_INPUT.txt"
OLD_MANIFEST="$TARGET_DIR/$MANIFEST_REL"
HAVE_MANIFEST=false
if [ -f "$OLD_MANIFEST" ] && grep -Eq '^(managed|kept) ' "$OLD_MANIFEST" 2>/dev/null; then
  HAVE_MANIFEST=true
fi

# Files an earlier toolkit version managed. Reported for workspaces without a manifest.
LEGACY_ORPHANS=".claude/dashboard/template.html .ddt/registry.md .claude/commands/status.md .claude/commands/plan.md .claude/commands/update.md"

template_files() {
  (cd "$RUNTIME_TEMPLATE_ROOT" && find . -type f -print | sed 's#^\./##' | sort)
}

is_user_owned_file() {
  # deepagents clients treat the root AGENTS.md as workspace memory the agent
  # writes to; the toolkit's manual lives in .deepagents/AGENTS.md instead.
  if [ "$RUNTIME_INPUT" = "deepagents" ]; then
    case "$1" in
      AGENTS.md|.deepagents/skills.toml|.deepagents/hooks.json) return 0 ;;
    esac
  fi
  case "$1" in
    .ddt/config.md|\
    .ddt/profile.md|\
    .ddt/norms.md|\
    .ddt/projects/*|\
    .ddt/personal/*|\
    .github/copilot-instructions.md|\
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

# Paths only the toolkit writes; never a user's own file even without a manifest.
is_toolkit_internal() {
  case "$1" in
    .ddt/runtime/*) return 0 ;;
    *) return 1 ;;
  esac
}

# Files the agent itself may edit in place; keep a copy when an update replaces them.
is_backup_on_update() {
  case "$RUNTIME_INPUT:$1" in
    deepagents:.deepagents/AGENTS.md) return 0 ;;
    *) return 1 ;;
  esac
}

is_root_doc() {
  case "$1" in
    README.md|CLAUDE.md|AGENTS.md) return 0 ;;
    *) return 1 ;;
  esac
}

# Runtime configuration the toolkit seeds once; personal config/profile/norms are
# expected to diverge and never produce a notice.
is_runtime_config() {
  case "$1" in
    .claude/settings.json|.codex/config.toml|opencode.json|.github/copilot-instructions.md|.deepagents/skills.toml|.deepagents/hooks.json) return 0 ;;
    *) return 1 ;;
  esac
}

manifest_has() {
  [ "$HAVE_MANIFEST" = true ] && grep -Fqx -- "$1 $2" "$OLD_MANIFEST"
}

# Another runtime installed in the same workspace may own a shared file such as README.md.
other_runtime_managing() {
  for other in "$TARGET_DIR"/.ddt/runtime/manifest.*.txt; do
    [ -f "$other" ] || continue
    [ "$other" = "$OLD_MANIFEST" ] && continue
    if grep -Fqx -- "managed $1" "$other"; then
      name="${other##*/manifest.}"
      echo "${name%.txt}"
      return 0
    fi
  done
  return 1
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

copy_new() {
  src="$1"
  dst="$2"
  label="$3"
  ensure_parent_dir "$dst"
  cp "$src" "$dst"
  apply_template_mode "$src" "$dst"
  echo "create: $label"
}

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
    copy_new "$src" "$dst" "$label"
  fi
}

RUNTIME_FILES_TMP="${TMPDIR:-/tmp}/office-work-runtime-files.$$"
NEW_MANIFEST_TMP="${TMPDIR:-/tmp}/office-work-manifest.$$"
NORMALIZED_IGNORE_TMP="${TMPDIR:-/tmp}/office-work-gitignore.$$"
trap 'rm -f "$RUNTIME_FILES_TMP" "$NEW_MANIFEST_TMP" "$NORMALIZED_IGNORE_TMP"' EXIT HUP INT TERM
template_files > "$RUNTIME_FILES_TMP"
: > "$NEW_MANIFEST_TMP"
if [ ! -s "$RUNTIME_FILES_TMP" ]; then
  echo "Error: generated template for runtime '$RUNTIME_INPUT' has no files: $RUNTIME_TEMPLATE_ROOT" >&2
  exit 1
fi

record() {
  echo "$1 $2" >> "$NEW_MANIFEST_TMP"
}

install_gitignore() {
  src="$RUNTIME_TEMPLATE_ROOT/.gitignore"
  dst="$TARGET_DIR/.gitignore"
  if [ ! -e "$dst" ]; then
    copy_new "$src" "$dst" ".gitignore"
    return
  fi
  # Match rules against a CR-stripped copy so Windows line endings do not
  # cause duplicates; never override a rule the user negated on purpose.
  tr -d '\r' < "$dst" > "$NORMALIZED_IGNORE_TMP"
  while IFS= read -r rule || [ -n "$rule" ]; do
    case "$rule" in ''|'#'*) continue ;; esac
    if grep -Fqx -- "$rule" "$NORMALIZED_IGNORE_TMP"; then
      continue
    fi
    if grep -Fqx -- "!$rule" "$NORMALIZED_IGNORE_TMP"; then
      echo "notice: .gitignore negates '$rule'; the toolkit rule was not added, so files under it may be committed"
      continue
    fi
    if [ -s "$dst" ] && [ "$(tail -c 1 "$dst" | wc -l | tr -d ' ')" -eq 0 ]; then
      printf '\n' >> "$dst"
    fi
    printf '%s\n' "$rule" >> "$dst"
    printf '%s\n' "$rule" >> "$NORMALIZED_IGNORE_TMP"
    echo "update: .gitignore (+$rule)"
  done < "$src"
}

# Check all destinations before any copy. Do not follow a user symlink outside
# the selected workspace, including links at directory or dangling file leaves.
check_destination() {
  relative="$1"
  current="$TARGET_DIR"
  while [ -n "$relative" ]; do
    component="${relative%%/*}"
    current="$current/$component"
    if [ -L "$current" ]; then
      echo "Error: managed destination is a symlink: $current" >&2
      exit 1
    fi
    case "$relative" in */*) relative="${relative#*/}" ;; *) relative="" ;; esac
  done
}

install_template_file() {
  rel="$1"
  src="$RUNTIME_TEMPLATE_ROOT/$rel"
  dst="$TARGET_DIR/$rel"

  if [ "$rel" = ".gitignore" ]; then
    install_gitignore
    return
  fi

  if is_user_owned_file "$rel"; then
    if [ -e "$dst" ]; then
      if cmp -s "$src" "$dst"; then
        echo "unchanged: $rel (user-owned)"
      elif is_runtime_config "$rel"; then
        echo "differs: $rel is user-owned and differs from the toolkit version; compare with generated/$RUNTIME_INPUT/$rel and merge what you want"
      else
        echo "unchanged: $rel (user-owned; yours to edit)"
      fi
    else
      copy_new "$src" "$dst" "$rel"
    fi
    return
  fi

  if [ -e "$dst" ] && owner=$(other_runtime_managing "$rel"); then
    echo "shared: $rel is managed by the $owner install in this workspace; left unchanged (the $RUNTIME_INPUT version is at generated/$RUNTIME_INPUT/$rel)"
    return
  fi

  if [ "$UPDATE_MODE" = true ]; then
    if manifest_has kept "$rel"; then
      echo "kept: $rel (yours; not toolkit-managed)"
      record kept "$rel"
      return
    fi
    if [ -e "$dst" ] && [ "$HAVE_MANIFEST" = true ] && ! manifest_has managed "$rel"; then
      echo "kept: $rel (pre-existing and not recorded as toolkit-managed; compare with generated/$RUNTIME_INPUT/$rel)"
      record kept "$rel"
      return
    fi
    if [ -e "$dst" ] && [ "$HAVE_MANIFEST" = false ] && is_root_doc "$rel" && ! cmp -s "$src" "$dst"; then
      cp -p "$dst" "$dst.before-update-$STAMP"
      echo "backup: $rel saved as $rel.before-update-$STAMP (no manifest; refreshing the toolkit version)"
    elif [ -e "$dst" ] && is_backup_on_update "$rel" && ! cmp -s "$src" "$dst"; then
      cp -p "$dst" "$dst.before-update-$STAMP"
      echo "backup: $rel saved as $rel.before-update-$STAMP (edited in place; the managed copy is refreshed, move anything worth keeping to AGENTS.md)"
    fi
    copy_and_overwrite "$src" "$dst" "$rel"
    record managed "$rel"
    return
  fi

  if [ -e "$dst" ]; then
    # Without a manifest, a file identical to the template or inside the runtime
    # folder is the toolkit's; anything else is recorded as yours. Use --update to
    # refresh an older toolkit-installed workspace.
    if manifest_has managed "$rel" || { [ "$HAVE_MANIFEST" = false ] && { cmp -s "$src" "$dst" || is_toolkit_internal "$rel"; }; }; then
      echo "skip: $rel already exists (toolkit-managed)"
      record managed "$rel"
    else
      echo "kept: $rel already exists (yours; updates will leave it alone)"
      record kept "$rel"
    fi
  else
    copy_new "$src" "$dst" "$rel"
    record managed "$rel"
  fi
}

if [ "$UPDATE_MODE" = true ]; then
  echo "=== Update mode: refreshing toolkit-managed files for $RUNTIME_INPUT ==="
elif [ "$HAVE_MANIFEST" = false ] && [ -f "$TARGET_DIR/.ddt/runtime/ddt.js" ]; then
  echo "notice: this workspace already has the toolkit runtime but no manifest; use --update to refresh toolkit files"
fi

while IFS= read -r rel; do
  [ -n "$rel" ] || continue
  check_destination "$rel"
done < "$RUNTIME_FILES_TMP"

while IFS= read -r rel; do
  [ -n "$rel" ] || continue
  install_template_file "$rel"
done < "$RUNTIME_FILES_TMP"

# Report files an older version managed that this version no longer ships.
if [ "$HAVE_MANIFEST" = true ]; then
  grep '^managed ' "$OLD_MANIFEST" | while IFS= read -r line; do
    old_rel="${line#managed }"
    if ! grep -Fqx -- "$old_rel" "$RUNTIME_FILES_TMP" && [ -e "$TARGET_DIR/$old_rel" ]; then
      echo "orphan: $old_rel is no longer part of the toolkit; remove it manually if unused"
    fi
  done
else
  for old_rel in $LEGACY_ORPHANS; do
    if [ -e "$TARGET_DIR/$old_rel" ]; then
      echo "orphan: $old_rel is no longer part of the toolkit; remove it manually if unused"
    fi
  done
fi

if [ "$RUNTIME_INPUT" = "claude" ] && [ -f "$TARGET_DIR/.claude/settings.json" ] && grep -q 'sh \$CLAUDE_PROJECT_DIR/\.claude/hooks/session-sync\.sh' "$TARGET_DIR/.claude/settings.json"; then
  echo "warning: .claude/settings.json runs the session hook with an unquoted path; it fails when the workspace path contains spaces. Change the command to: sh \"\$CLAUDE_PROJECT_DIR/.claude/hooks/session-sync.sh\""
fi

mkdir -p "$(dirname -- "$OLD_MANIFEST")"
{
  echo "# Office Work Assistant install manifest. 'managed' files are refreshed by --update; 'kept' files are yours."
  echo "toolkit_version $TOOLKIT_VERSION"
  echo "runtime $RUNTIME_INPUT"
  echo "installed_at $STAMP"
  sort -u "$NEW_MANIFEST_TMP"
} > "$OLD_MANIFEST"

if [ "$NO_GIT" = false ]; then
  if [ "$RUNTIME_INPUT" = "deepagents" ]; then
    # The client resolves memory, skills and hooks at the nearest Git root, so the
    # workspace must be its own repository even when nested inside another.
    toplevel=$(git -C "$TARGET_DIR" rev-parse --show-toplevel 2>/dev/null || true)
    if [ -n "$toplevel" ]; then
      toplevel=$( (CDPATH= cd -- "$toplevel" 2>/dev/null && pwd -P) || true)
    fi
    if [ "$toplevel" != "$TARGET_DIR" ]; then
      git -C "$TARGET_DIR" init
      echo "create: initialized git repository in $TARGET_DIR (deepagents clients need the workspace to be its own Git root)"
      if [ -n "$toplevel" ]; then
        echo "notice: this workspace sits inside the repository at $toplevel; it is now its own repository, which the outer one shows as an untracked folder"
      fi
    fi
  elif ! git -C "$TARGET_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    git -C "$TARGET_DIR" init
    echo "create: initialized git repository in $TARGET_DIR (use --no-git to skip)"
  fi
fi

if [ "$UPDATE_MODE" = true ]; then
  echo "Update complete. Toolkit-managed files refreshed; user configuration, kept files and existing records retained."
  echo "Legacy records remain readable. Review .ddt/runtime/WORKFLOWS.md before explicit adoption."
else
  echo "Setup complete for $RUNTIME_INPUT (toolkit $TOOLKIT_VERSION). Set your name in .ddt/config.md and open your assistant here."
  echo "Try capturing a note, starting a project, or tracking a follow-up. Add team clone paths when ready."
  echo "Dashboard: node .ddt/runtime/server.js (Node.js 18+; no packages required)."
  if [ "$RUNTIME_INPUT" = "copilot" ]; then
    echo "Copilot CLI: run copilot --agent=office-work-assistant from the workspace."
    echo "Existing Copilot repository instructions are preserved; check /instructions and /skills list."
  fi
  if [ "$RUNTIME_INPUT" = "deepagents" ]; then
    echo "deepagents: run lc-code (or your client) from this folder, which must stay its own Git root."
    echo "Allow project hooks when the client asks (headless: --trust-project-hooks) for follow-up counts at session start."
    echo "The manual is .deepagents/AGENTS.md (managed); AGENTS.md at the root is yours for learnings."
  fi
fi
