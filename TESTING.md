# Testing

Run the local smoke harness from the repository root:

```sh
./tests/run.sh
```

The harness validates the current multi-runtime bootstrap:

- shell syntax for `bootstrap/init-workspace.sh`
- renderer freshness for `generated/claude`, `generated/codex`, and
  `generated/opencode`
- generated runtime shape for Claude, Codex, and OpenCode
- tracked generated personal placeholders that would otherwise be hidden by
  generated workspace `.gitignore` rules
- dashboard JavaScript syntax for all generated dashboard servers
- valid runtime config JSON where applicable, plus expected Codex TOML skill
  paths
- default Claude install and explicit `--runtime claude`
- explicit `--runtime codex`
- explicit `--runtime opencode`
- update-mode preservation of shared user-owned `.ddt` data
- preservation of runtime user config:
  `.claude/settings.json`, `.codex/config.toml`, and `opencode.json`
- managed-file refresh from checked-in generated output
- unsupported-runtime rejection before target mutation
- path-with-spaces hook behavior for the Claude session-sync hook

For renderer-only checks, run:

```sh
python3 scripts/render_templates.py --check
```

When changing shared behavior or runtime adapters, regenerate checked-in output
before running tests:

```sh
python3 scripts/render_templates.py
./tests/run.sh
```
