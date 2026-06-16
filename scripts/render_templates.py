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
RUNTIMES = ("claude",)
COMMANDS = tuple(sorted(path.name for path in (ROOT / "core/commands").glob("*.md")))
SKILLS = (
    "project-manager/SKILL.md",
    "task-manager/SKILL.md",
    "think-partner/SKILL.md",
)

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


def render_all(out_root: Path) -> None:
    out_root.mkdir(parents=True, exist_ok=True)
    render_claude(out_root)


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
