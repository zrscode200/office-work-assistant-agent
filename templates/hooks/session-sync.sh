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

# --- Todo cleanup: remove completed items older than 30 days ---
todo_complete="$project_dir/.ddt/personal/todo-complete.json"
if [ -f "$todo_complete" ]; then
  node -e "
    const fs=require('fs');
    const f='$todo_complete';
    const t=JSON.parse(fs.readFileSync(f,'utf8'));
    const cutoff=new Date();cutoff.setDate(cutoff.getDate()-30);
    const cut=cutoff.toISOString().slice(0,10);
    const before=t.items.length;
    t.items=t.items.filter(i=>!i.completed||i.completed>cut);
    if(t.items.length<before){
      fs.writeFileSync(f,JSON.stringify(t,null,2));
    }
  " 2>/dev/null || true
fi

# --- Todo proactive summary (if configured) ---
todo_surfacing=$(grep -E '^todo_surfacing:' "$config_file" 2>/dev/null | sed 's/^todo_surfacing:[[:space:]]*//' || true)
todo_file="$project_dir/.ddt/personal/todo.json"
if [ "$todo_surfacing" = "proactive" ] && [ -f "$todo_file" ]; then
  todo_summary=$(node -e "
    const t=JSON.parse(require('fs').readFileSync('$todo_file','utf8'));
    const o=t.items.filter(i=>i.status!=='done');
    const now=new Date().toISOString().slice(0,10);
    const overdue=o.filter(i=>i.due&&i.due<now).length;
    const today=o.filter(i=>i.due===now).length;
    if(o.length)console.log('Todos: '+o.length+' open'+(overdue?' ('+overdue+' overdue)':'')+(today?' ('+today+' due today)':''));
  " 2>/dev/null || true)
  if [ -n "$todo_summary" ]; then
    status="${status}${todo_summary}\\n"
  fi
fi

# --- Output additional context ---
if [ -n "$status" ]; then
  printf '{"additionalContext": "## Session Sync\\n%s"}\n' "$status"
fi
