# Testing

Run the local smoke harness from the repository root:

```sh
./tests/run.sh
```

The harness validates the current Claude bootstrap baseline: shell syntax,
dashboard JavaScript syntax, initial workspace creation, update-mode
preservation of user-owned files, and hook command behavior for workspace paths
with spaces.
