#!/usr/bin/env python3
"""Render the same data runtime and workflows into three assistant surfaces."""
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
RUNTIMES = ("claude", "codex", "opencode")
COMMAND_OWNER = {"jot": "think-partner", "notebook": "think-partner", "brainstorm": "think-partner", "todo": "task-manager", "jira": "task-manager"}


def copy_tree(src: Path, dst: Path) -> None:
    for file in src.rglob("*"):
        if file.is_file():
            target = dst / file.relative_to(src)
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(file, target)


def write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def render_all(out_root: Path) -> None:
    for runtime in RUNTIMES:
        out = out_root / runtime
        if out.exists():
            shutil.rmtree(out)
        copy_tree(ROOT / "core/shared", out)
        copy_tree(ROOT / "adapters" / runtime, out)
        copy_tree(ROOT / "core/runtime", out / ".ddt/runtime")
        manual = "CLAUDE.md" if runtime == "claude" else "AGENTS.md"
        write(out / manual, (ROOT / "core/manual.md").read_text() + "\n" + (ROOT / "adapters" / runtime / manual).read_text())
        for skill in (ROOT / "core/skills").iterdir():
            copy_tree(skill, out / f".{runtime}/skills" / skill.name)
        for command in sorted((ROOT / "core/commands").glob("*.md")):
            if runtime == "codex":
                owner = COMMAND_OWNER.get(command.stem, "project-manager")
                dest = out / ".codex/skills" / owner / "references" / command.name
            else:
                dest = out / f".{runtime}/commands" / command.name
            write(dest, command.read_text())
        for folder in (".ddt/projects", ".ddt/personal/notes", ".ddt/personal/work"):
            write(out / folder / ".gitkeep", "")
        # Retain the old server entry point for existing bookmarks/workflows.
        write(out / f".{runtime}/dashboard/server.js", "#!/usr/bin/env node\nrequire('../../.ddt/runtime/server').start(process.cwd());\n")


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
