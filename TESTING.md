# Verification

Run `./tests/run.sh` from the toolkit. Requires Node.js 18+, Python 3, Git, and POSIX shell; no dependencies or live services are installed/contacted.

- Renderer parity and syntax checks cover the common runtime and all generated distributions.
- Installer fixtures cover all runtimes, paths with spaces, repeat installation, update restoration of managed files, customized config/data preservation, individual ignore-rule reconciliation, executable hook modes, unsupported runtimes, and symlink preflight.
- Runtime fixtures cover note identity, linked work, completion/reopening, stale revision rejection, failed-write preservation, scope/symlink boundaries, explicit legacy adoption, retained source bytes, and adoption drift.
- Jira fixtures inject responses to verify API selection, execution ownership, private cache provenance, retained snapshots on errors, concurrent refresh rejection, and older-response protection. They do not verify a real tenant or its OAuth configuration.
- Collaboration fixtures use two disposable local clones and a local bare remote. They verify exact-byte publication, explicit destinations, staged/outgoing exclusions, propagation, and failed-push retry. No production repository is used.
- HTTP fixtures exercise the real request handler in process to test navigation, read-only GETs, token/origin/Host protections, and revision-checked completion. Safe DOM construction is checked. The managed execution sandbox blocked a loopback bind (EPERM), so listening sockets and real browser QA remain unverified.

Fixture directories are uniquely allocated under the system temporary directory and removed after checks. Tests never rewrite source or expected snapshots to obtain a pass. Installer tests compare every generated file; user-owned sentinels are compared byte-for-byte after upgrades.

Before accepting a change, run the full suite and independently review the combined source diff against its intended behavior. Report live service, native assistant discovery, and browser verification separately from deterministic fixture results.
