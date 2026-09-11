#!/usr/bin/env python3
"""Render the same data runtime and workflows into supported assistant surfaces."""
from __future__ import annotations
import argparse
import filecmp
import shutil
import stat
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RUNTIMES = ("claude", "codex", "opencode", "copilot", "deepagents")
# Where each runtime's always-loaded manual lives; core text refers to it as {{MANUAL}}.
MANUAL_PATH = {"claude": "CLAUDE.md", "codex": "AGENTS.md", "opencode": "AGENTS.md", "copilot": ".ddt/runtime/ASSISTANT.md", "deepagents": ".deepagents/AGENTS.md"}
# deepagents clients load .deepagents/AGENTS.md and the root AGENTS.md together; the
# toolkit owns the former and the agent's learnings live in the latter.
DEEPAGENTS_NOTE = "Managed by the Office Work Assistant toolkit: this file is replaced on update. Record learnings in the workspace-root AGENTS.md, never here.\n\n"
TOKEN = "{{MANUAL}}"
# Runtimes whose skill catalogue mixes with other skills get namespaced names.
NAMESPACED_SKILLS = {"project-manager": "office-projects", "think-partner": "office-notes", "task-manager": "office-work"}
SKILL_DIRS = {"claude": ".claude/skills", "codex": ".codex/skills", "opencode": ".opencode/skills", "copilot": ".github/skills", "deepagents": ".deepagents/skills"}
INDEXED_RUNTIMES = ("copilot", "codex", "deepagents")
# Every core command is assigned explicitly; the renderer refuses to guess an owner.
COMMAND_OWNER = {
    "brainstorm": "think-partner", "jot": "think-partner", "notebook": "think-partner",
    "todo": "task-manager", "jira": "task-manager",
    "catch-up": "project-manager", "create-project-update": "project-manager", "dashboard": "project-manager",
    "decide": "project-manager", "meeting": "project-manager", "new-project": "project-manager",
    "project-comment": "project-manager", "project-scoping": "project-manager", "project-status": "project-manager",
    "self-tutorial": "project-manager", "sync": "project-manager",
}


def copy_tree(src: Path, dst: Path) -> None:
    for file in src.rglob("*"):
        if file.is_symlink():
            raise SystemExit(f"symlinks are not rendered: {file}")
        if file.is_file():
            target = dst / file.relative_to(src)
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(file, target)


def write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def render_text(text: str, runtime: str, source: Path) -> str:
    rendered = text.replace(TOKEN, f"`{MANUAL_PATH[runtime]}`")
    if "{{" in rendered:
        raise SystemExit(f"unrendered token in {source} for {runtime}")
    return rendered


def commands_by_owner() -> list[Path]:
    commands = sorted((ROOT / "core/commands").glob("*.md"))
    names = {command.stem for command in commands}
    missing = sorted(names - set(COMMAND_OWNER))
    extra = sorted(set(COMMAND_OWNER) - names)
    if missing or extra:
        raise SystemExit(f"COMMAND_OWNER must list every core command exactly (missing={missing}, extra={extra})")
    return commands


def render_all(out_root: Path) -> None:
    commands = commands_by_owner()
    for runtime in RUNTIMES:
        out = out_root / runtime
        if out.exists():
            shutil.rmtree(out)
        copy_tree(ROOT / "core/shared", out)
        copy_tree(ROOT / "adapters" / runtime, out)
        copy_tree(ROOT / "core/runtime", out / ".ddt/runtime")
        manual = "CLAUDE.md" if runtime == "claude" else "AGENTS.md"
        manual_text = (ROOT / "core/manual.md").read_text()
        if runtime == "copilot":
            # Keep always-loaded instructions small. Both the skills and the
            # named agent explicitly load this shared manual when needed.
            write(out / ".ddt/runtime/ASSISTANT.md", manual_text)
        elif runtime == "deepagents":
            write(out / MANUAL_PATH[runtime], DEEPAGENTS_NOTE + manual_text + "\n" + (ROOT / "adapters/deepagents" / MANUAL_PATH[runtime]).read_text())
        else:
            write(out / manual, manual_text + "\n" + (ROOT / "adapters" / runtime / manual).read_text())
        for skill in sorted((ROOT / "core/skills").iterdir()):
            name = NAMESPACED_SKILLS[skill.name] if runtime in ("copilot", "deepagents") else skill.name
            dest = out / SKILL_DIRS[runtime] / name
            copy_tree(skill, dest)
            # Native adapter guidance may specialize a common skill while the
            # renderer still owns its complete command-reference index.
            override = ROOT / "adapters" / runtime / dest.relative_to(out) / "SKILL.md"
            source = override if override.is_file() else skill / "SKILL.md"
            text = render_text(source.read_text().replace(f"name: {skill.name}\n", f"name: {name}\n"), runtime, source)
            if runtime in INDEXED_RUNTIMES:
                references = [command for command in commands if COMMAND_OWNER[command.stem] == skill.name]
                text += "\nAll workspace paths above are relative to the workspace root. Read the relevant reference when needed:\n\n"
                text += "".join(f"- [{command.stem}](references/{command.name})\n" for command in references)
            write(dest / "SKILL.md", text)
        for command in commands:
            owner = COMMAND_OWNER[command.stem]
            if runtime in INDEXED_RUNTIMES:
                folder = NAMESPACED_SKILLS[owner] if runtime in ("copilot", "deepagents") else owner
                dest = out / SKILL_DIRS[runtime] / folder / "references" / command.name
            else:
                dest = out / f".{runtime}/commands" / command.name
            override = ROOT / "adapters" / runtime / dest.relative_to(out)
            source = override if override.is_file() else command
            write(dest, render_text(source.read_text(), runtime, source))
        for folder in (".ddt/projects", ".ddt/personal/notes", ".ddt/personal/work"):
            write(out / folder / ".gitkeep", "")
        # Retain the old server entry point for existing bookmarks/workflows.
        if runtime in ("claude", "codex", "opencode"):
            write(out / f".{runtime}/dashboard/server.js", "#!/usr/bin/env node\nrequire('../../.ddt/runtime/server').start(process.cwd());\n")


def compare_dirs(left: Path, right: Path) -> list[str]:
    problems: list[str] = []
    cmp = filecmp.dircmp(left, right)
    for name in cmp.left_only:
        problems.append(f"missing from generated: {Path(cmp.left) / name}")
    for name in cmp.right_only:
        problems.append(f"extra in generated: {Path(cmp.right) / name}")
    for name in cmp.common_files:
        left_file = Path(cmp.left) / name
        right_file = Path(cmp.right) / name
        # Byte comparison: a same-size, same-mtime file can still differ.
        if not filecmp.cmp(left_file, right_file, shallow=False):
            problems.append(f"stale generated file: {right_file}")
        left_mode = stat.S_IMODE(left_file.stat().st_mode)
        right_mode = stat.S_IMODE(right_file.stat().st_mode)
        if left_mode != right_mode:
            problems.append(f"stale generated mode: {right_file} expected {left_mode:o} got {right_mode:o}")
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
