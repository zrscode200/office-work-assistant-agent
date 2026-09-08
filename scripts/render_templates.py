#!/usr/bin/env python3
"""Render the same data runtime and workflows into supported assistant surfaces."""
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
RUNTIMES = ("claude", "codex", "opencode", "copilot")
COPILOT_SKILLS = {"project-manager": "office-projects", "think-partner": "office-notes", "task-manager": "office-work"}
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
        if runtime == "copilot":
            # Keep always-loaded instructions small. Both the skills and the
            # named agent explicitly load this shared manual when needed.
            write(out / ".ddt/runtime/ASSISTANT.md", (ROOT / "core/manual.md").read_text())
        else:
            write(out / manual, (ROOT / "core/manual.md").read_text() + "\n" + (ROOT / "adapters" / runtime / manual).read_text())
        for skill in sorted((ROOT / "core/skills").iterdir()):
            if runtime == "copilot":
                name = COPILOT_SKILLS[skill.name]
                dest = out / ".github/skills" / name
                copy_tree(skill, dest)
                text = (dest / "SKILL.md").read_text()
                text = text.replace(f"name: {skill.name}\n", f"name: {name}\n")
                text = text.replace("the root operating manual", "`.ddt/runtime/ASSISTANT.md`")
                references = [command for command in sorted((ROOT / "core/commands").glob("*.md"))
                              if COMMAND_OWNER.get(command.stem, "project-manager") == skill.name]
                text += "\nAll workspace paths above are relative to the workspace root. Read the relevant reference when needed:\n\n"
                text += "".join(f"- [{command.stem}](references/{command.name})\n" for command in references)
                write(dest / "SKILL.md", text)
            else:
                copy_tree(skill, out / f".{runtime}/skills" / skill.name)
        for command in sorted((ROOT / "core/commands").glob("*.md")):
            owner = COMMAND_OWNER.get(command.stem, "project-manager")
            text = command.read_text()
            if runtime == "copilot":
                dest = out / ".github/skills" / COPILOT_SKILLS[owner] / "references" / command.name
                text = text.replace("the workspace operating manual", "`.ddt/runtime/ASSISTANT.md`")
            elif runtime == "codex":
                dest = out / ".codex/skills" / owner / "references" / command.name
            else:
                dest = out / f".{runtime}/commands" / command.name
            write(dest, text)
        for folder in (".ddt/projects", ".ddt/personal/notes", ".ddt/personal/work"):
            write(out / folder / ".gitkeep", "")
        # Retain the old server entry point for existing bookmarks/workflows.
        if runtime != "copilot":
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
