#!/usr/bin/env python3
from __future__ import annotations

import argparse
import filecmp
import os
import shutil
import stat
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RUNTIMES = ("claude", "codex")
COMMANDS = tuple(sorted(path.name for path in (ROOT / "core/commands").glob("*.md")))
SKILLS = (
    "project-manager/SKILL.md",
    "task-manager/SKILL.md",
    "think-partner/SKILL.md",
)
CODEX_COMMAND_SKILL = {
    "brainstorm.md": "think-partner",
    "create-project-update.md": "project-manager",
    "dashboard.md": "project-manager",
    "decide.md": "project-manager",
    "jot.md": "think-partner",
    "meeting.md": "project-manager",
    "new-project.md": "project-manager",
    "notebook.md": "think-partner",
    "project-comment.md": "project-manager",
    "project-scoping.md": "project-manager",
    "project-status.md": "project-manager",
    "self-tutorial.md": "project-manager",
    "sync.md": "project-manager",
    "todo.md": "task-manager",
}

PLACEHOLDERS = {
    ".ddt/projects/.gitkeep": "",
    ".ddt/personal/notebook/.gitkeep": "",
    ".ddt/personal/scratch/.gitkeep": "",
    ".ddt/personal/todo.json": '{\n  "version": 1,\n  "items": []\n}\n',
    ".ddt/personal/scratch/.index.md": (
        "# Scratch Pad Index\n\n"
        "| File | Topic | Status | Promoted To |\n"
        "|------|-------|--------|-------------|\n"
    ),
}


def copy_tree(src: Path, dst: Path) -> None:
    if src.is_file():
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)
        return
    for file in src.rglob("*"):
        if file.is_file():
            rel = file.relative_to(src)
            out = dst / rel
            out.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(file, out)


def write(path: Path, text: str, mode: int = 0o644) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")
    os.chmod(path, mode)


def render_codex_text(text: str) -> str:
    replacements = (
        ("CLAUDE.md", "AGENTS.md"),
        ("Claude Code", "Codex"),
        (".claude/dashboard", ".codex/dashboard"),
        (".claude/settings.json", ".codex/config.toml"),
        (".claude/skills", ".codex/skills"),
        (".claude/commands", ".codex/skills/*/references"),
        ("Slash Commands", "Command References"),
        ("Slash commands", "Command references"),
        ("slash commands", "command references"),
        ("slash command", "command reference"),
        ("Session sync", "Manual sync"),
        ("session sync", "manual sync"),
    )
    for old, new in replacements:
        text = text.replace(old, new)
    text = text.replace(
        'Explain **manual sync**: "When you open Codex, a hook automatically pulls all team repos '
        '(`git pull --ff-only`) so you start with fresh data."',
        'Explain **manual sync**: "Codex does not run an automatic workspace sync hook. Use the '
        '`sync` reference when you want to pull team repos before reading or writing shared artifacts."',
    )
    for command in COMMANDS:
        name = command.removesuffix(".md")
        text = text.replace(f"`/{name}`", f"`{name}` reference")
        text = text.replace(f"type `{name}` reference", f"ask for the `{name}` reference")
    return text


def render_codex_dashboard_server(text: str) -> str:
    text = text.replace("const { execSync } = require('child_process');\n", "")
    text = text.replace(".claude/dashboard", ".codex/dashboard")
    text = text.replace("'.claude', 'dashboard'", "'.codex', 'dashboard'")
    text = text.replace(
        """function syncTeamRepos(teamRepos) {
  const results = [];
  for (const [name, repoPath] of Object.entries(teamRepos)) {
    if (!fs.existsSync(path.join(repoPath, '.git'))) {
      results.push({ repo: name, status: 'error', message: 'Not a git repo' });
      continue;
    }
    try {
      const output = execSync('git pull --ff-only', {
        cwd: repoPath, timeout: 15000, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe']
      });
      if (/Already up to date/.test(output)) {
        results.push({ repo: name, status: 'ok' });
      } else {
        results.push({ repo: name, status: 'updated' });
      }
    } catch {
      results.push({ repo: name, status: 'error', message: 'Needs manual sync (diverged or conflicts)' });
    }
  }
  return results;
}
""",
        """function syncTeamRepos(teamRepos) {
  const results = [];
  for (const [name, repoPath] of Object.entries(teamRepos)) {
    if (!fs.existsSync(path.join(repoPath, '.git'))) {
      results.push({ repo: name, status: 'error', message: 'Not a git repo' });
      continue;
    }
    results.push({
      repo: name,
      status: 'skipped',
      message: 'Dashboard is read-only; use the sync workflow to pull latest data.'
    });
  }
  return results;
}
""",
    )
    return text


def render_claude(out_root: Path) -> None:
    out = out_root / "claude"
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)

    copy_tree(ROOT / "core/shared", out)
    copy_tree(ROOT / "adapters/claude", out)

    for command in COMMANDS:
        copy_tree(ROOT / "core/commands" / command, out / ".claude/commands" / command)
    for skill in SKILLS:
        copy_tree(ROOT / "core/skills" / skill, out / ".claude/skills" / skill)

    for rel, text in PLACEHOLDERS.items():
        write(out / rel, text)

    hook = out / ".claude/hooks/session-sync.sh"
    if hook.exists():
        os.chmod(hook, 0o755)


def render_codex(out_root: Path) -> None:
    out = out_root / "codex"
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)

    copy_tree(ROOT / "core/shared", out)
    copy_tree(ROOT / "adapters/codex", out)
    dashboard_src = ROOT / "adapters/claude/.claude/dashboard"
    dashboard_out = out / ".codex/dashboard"
    copy_tree(dashboard_src, dashboard_out)
    server = dashboard_out / "server.js"
    if server.exists():
        server.write_text(render_codex_dashboard_server(server.read_text(encoding="utf-8")), encoding="utf-8")

    for skill in SKILLS:
        src = ROOT / "core/skills" / skill
        write(out / ".codex/skills" / skill, render_codex_text(src.read_text(encoding="utf-8")))

    for command in COMMANDS:
        owner = CODEX_COMMAND_SKILL[command]
        src = ROOT / "core/commands" / command
        write(
            out / ".codex/skills" / owner / "references" / command,
            render_codex_text(src.read_text(encoding="utf-8")),
        )

    for rel, text in PLACEHOLDERS.items():
        write(out / rel, text)


def render_all(out_root: Path) -> None:
    out_root.mkdir(parents=True, exist_ok=True)
    render_claude(out_root)
    render_codex(out_root)


def compare_dirs(left: Path, right: Path) -> list[str]:
    problems: list[str] = []
    cmp = filecmp.dircmp(left, right)
    for name in cmp.left_only:
        problems.append(f"missing from generated: {Path(cmp.left) / name}")
    for name in cmp.right_only:
        problems.append(f"extra in generated: {Path(cmp.right) / name}")
    for name in cmp.diff_files:
        problems.append(f"stale generated file: {Path(cmp.right) / name}")
    for name in cmp.common_files:
        left_file = Path(cmp.left) / name
        right_file = Path(cmp.right) / name
        left_mode = stat.S_IMODE(left_file.stat().st_mode)
        right_mode = stat.S_IMODE(right_file.stat().st_mode)
        if left_mode != right_mode:
            problems.append(
                "stale generated mode: "
                f"{right_file} expected {left_mode:o} got {right_mode:o}"
            )
    for sub in cmp.common_dirs:
        problems.extend(compare_dirs(Path(cmp.left) / sub, Path(cmp.right) / sub))
    return problems


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()

    generated = ROOT / "generated"
    if args.check:
        with tempfile.TemporaryDirectory(prefix="office-work-render-check-") as tmp:
            tmp_path = Path(tmp)
            render_all(tmp_path)
            problems = compare_dirs(tmp_path, generated)
            if problems:
                print("generated templates are stale", file=sys.stderr)
                for problem in problems:
                    print(problem, file=sys.stderr)
                return 1
        print("generated templates are current")
        return 0

    render_all(generated)
    print("rendered templates")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
