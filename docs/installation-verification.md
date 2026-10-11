# KAZ-199 installation verification

Verified on 2026-10-11 with OpenCode 2.0.26 and Linux/WSL, without setup links.
The smoke test used an empty directory and separate HOME/XDG config, data, cache
and state directories. Normal user configuration was not modified.

## Git package installation

`opencode plugin add github:kazforge/agent-skills` succeeded. Before PR #19 is
merged, this default-main target exposes five Core skills/commands and three
reviewers; `/branch-name` returns `CommandNotFoundError` (HTTP 404).

After removing that target, installed:

```sh
opencode plugin add 'github:kazforge/agent-skills#feature/kaz-199-plugin-distribution'
```

OpenCode's plugin API reported `kazforge.agent-skills` active at revision
`f672d871f2a518aaf161ca8bdb0433b7f414a8e6`. Skills resolved from OpenCode's
installed Git-package cache, not the development checkout.

## Discovery and execution

Used a dedicated `opencode serve --hostname 127.0.0.1 --port 49391` server and
`opencode api --server http://127.0.0.1:49391` for the live checks. Created a
session in the empty directory and invoked commands through
`POST /api/session/{sessionID}/command`.

- `/api/skill`: all nine packaged skills.
- `/api/command`: all five Core and four support commands, plus OpenCode builtins.
- `/api/agent`: all three stable `kazforge-*` reviewer IDs in subagent mode.
- `/implementation-planning`: selected its skill and produced a repository-grounded
  README plan without implementation.
- `/branch-name`: selected its skill and proposed `docs/add-readme` without changes.
  A separate invocation with `implementation-planning` already selected preserved
  that attachment and added `branch-name`, confirmed in persisted session context.

Both commands completed with `opencode/big-pickle`. The initial default
`opencode/exo-free` returned HTTP 410 (deprecated); changing the smoke session's
model resolved this provider failure. No user credentials were copied.

## Update, removal and limitations

- The native `/api/plugin/check` and `/api/plugin/update` endpoints accepted the
  installed Git targets. Updating an unchanged revision was exercised; advancement
  to a newer Git revision was not verified.
- `opencode plugin remove` removed the default-main target from configuration.
  After `/api/location/reload`, the plugin no longer appeared in `/api/plugin`.
  Removing the PR-branch target also cleared the plugin and its commands; only
  OpenCode's builtin `init` and `review` commands remained.
- The managed-service default port was occupied. A dedicated server avoided
  interfering with the user's service. Plugin update CLI cannot take `--server`,
  so update verification used the documented native API rather than the CLI.
- Reviewer discovery was checked, not an additional live review or permission
  approval scenario. Existing tests cover reviewer isolation/fallback/safety.
- `npm test`: 30 passed. `npm run typecheck`: passed. Portable artifact-test paths
  and npm invocation were checked on Linux only; no Windows/macOS run was performed.
  The artifact test still requires npm and a `tar` executable.
