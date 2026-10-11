# Agent Skills

[`kazforge/agent-skills`](https://github.com/kazforge/agent-skills) provides small,
reusable engineering workflows for coding agents. These are instructions, not a
workflow engine or orchestration framework.

## Workflows

Core skills are repository-agnostic and independently usable, not mandatory
workflow stages.

| Core skill | Purpose |
| --- | --- |
| [implementation-planning](skills/implementation-planning/SKILL.md) | Develop a repository-grounded approach for one implementation increment. |
| [design-review](skills/design-review/SKILL.md) | Challenge a design against repository contracts and simpler alternatives. |
| [plan-review](skills/plan-review/SKILL.md) | Assess executability, material gaps and harmful over-specification. |
| [implementation](skills/implementation/SKILL.md) | Make the smallest coherent change, verify it and request independent review when supported. |
| [implementation-review](skills/implementation-review/SKILL.md) | Judge the actual change against the requested outcome, acceptance intent and repository contracts. |

Optional support skills may depend on particular tools or conventions:

| Support skill | Purpose |
| --- | --- |
| [branch-name](skills/branch-name/SKILL.md) | Propose a branch name without creating it. |
| [commit-message](skills/commit-message/SKILL.md) | Propose a Conventional Commits message without committing. |
| [address-pr-comments](skills/address-pr-comments/SKILL.md) | Assess and address GitHub PR review comments. |
| [pr-quality-triage](skills/pr-quality-triage/SKILL.md) | Investigate PR CI and Sonar findings and fix applicable issues. |

## Product and architecture boundary

Consumer repositories own engineering truth: architecture, contracts, build
commands, CI gates, tests and documentation policy. Skills discover and follow
that guidance; they do not replace it. The user or work item supplies the
requested outcome and acceptance intent. No consumer repository must install,
vendor or reference this collection for correctness.

**Use native declarative OpenCode capabilities for definitions. Use TypeScript
only for runtime behavior or safety that cannot be expressed cleanly declaratively.**

| Concern | Owner |
| --- | --- |
| Workflow semantics | `skills/<name>/SKILL.md` |
| OpenCode agent mechanics | `agents/<agent-id>.md` |
| Plugin registration, fresh reviewer sessions and permission safety | `index.ts` |
| Optional support command wrappers | `commands/*.md` |

Core and support are documented roles in the same flat skills directory, not
separate registries. Core command and reviewer descriptions come from skill frontmatter;
support command descriptions come from their Markdown wrappers.

## Install and use with OpenCode

Install globally with OpenCode V2 (the plugin targets the 2.0.26 API):

```sh
opencode plugin add github:kazforge/agent-skills
opencode service restart
opencode plugin list
```

OpenCode installs the Git package and its dependencies. No npm publication,
symlinks, generated configuration or consumer-repository files are required.
All nine skills, the five Core commands, four support commands and three reviewer
agents are exposed from packaged Markdown through thin public-API adapters.
Read support skills' tool requirements before using them.

### Update and remove

```sh
opencode plugin check
opencode plugin update github:kazforge/agent-skills
opencode service restart
```

For reproducibility, install `github:kazforge/agent-skills#<full-commit-sha>`
instead. Full commit pins are skipped by updates; remove the configured target
before adding another revision. Use `opencode plugin list` to find its exact spelling.

```sh
opencode plugin remove github:kazforge/agent-skills
opencode service restart
```

Removal removes the configured plugin entry; no plugin-owned global files or links
need cleanup. OpenCode manages its package cache. Skills remain readable in the
repository and reusable independently of the plugin.

### Local development

From this checkout, install dependencies:

```sh
npm ci
```

Point an `opencode.jsonc` at the checkout directory, then restart OpenCode:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["/absolute/path/to/agent-skills"]
}
```

Use a global configuration for access across repositories. Do not load the Git
package and checkout simultaneously. After pulling or editing the checkout,
restart OpenCode; package update commands skip local paths. To remove the local
plugin, delete only its entry from `plugins` and restart.

The plugin registers all five Core skills and commands named after them:
`/implementation-planning`, `/design-review`, `/plan-review`, `/implementation`
and `/implementation-review`.

```text
/implementation-planning Add retry handling to the import job
```

Arguments are optional; the skill establishes missing task context. No tracker
is required. Planning and review do not authorize implementation.

### Reviewer agents

The plugin registers these as OpenCode subagents:

| Stable agent ID | Repository access |
| --- | --- |
| `kazforge-design-reviewer` | Inspect only |
| `kazforge-plan-reviewer` | Inspect only |
| `kazforge-implementation-reviewer` | Inspect, plus verification commands with per-command approval |

Review commands start a fresh child session with the matching reviewer agent.
Only the requester's text, attachments and the corresponding review skill are
passed; authoring history, conclusions and other selected skills are excluded.
Reviewers retain normal OpenCode model inheritance.

Reviewers cannot mutate the repository, access secrets, delegate or reach
external systems. Host permissions and saved approvals do not widen the review
session's declared profile; verification commands still require explicit approval.

If a reviewer is unavailable or its session cannot be created or receive the
request, the command reports the limitation instead of reviewing in the authoring
session. Follow the review skill's fresh-session fallback.

### Migrate from setup.sh

The multi-harness installer has been removed. Install the plugin, remove any old
checkout plugin entry if switching to Git installation, then inspect these legacy
destinations:

- `~/.config/opencode/skills/`
- `~/.config/opencode/command/` (the old singular directory)
- `~/.cursor/skills/`
- `~/.agents/skills/`

For each old skill or command entry, use `test -L /path/to/entry` and
`readlink /path/to/entry` to confirm it is a symlink targeting your old checkout's
`skills/` or `commands/` directory. This also identifies broken links if the
checkout moved or was deleted. Remove only confirmed links with
`unlink /path/to/entry`; never delete whole destination directories, real files,
or same-named links targeting another collection. Restart OpenCode afterward.
No automatic global migration or Cursor/Codex installation support remains.

## Contributing and maintenance

Add skills at `skills/<name>/SKILL.md` with descriptive `name` and `description`
frontmatter, and list their Core or support role here. Keep Core instructions
repository-agnostic; do not assume a stack, tracker, harness launcher or scratch
path. Prefer small instructional changes backed by real use.

Keep agent files mechanical; review criteria and output contracts belong in the
skills. New Core workflows need an entry in `index.ts`; review workflows also
need an agent file and reviewer mapping. Do not introduce a registry, schema,
DSL, code generator or orchestration framework.

OpenCode's shared command registry replaces earlier same-named definitions.
Keep Core command names aligned with skill IDs, and do not add Core wrappers in
`commands/`; wrappers are only for optional support skills.

Keep the plugin entrypoint at the root `index.ts` for OpenCode directory loading.
Packaged definitions require plugin registration because native discovery does
not load them from inside a plugin package.

Run `npm test` and `npm run typecheck` after changes. For a manual plugin check
without setup links, confirm all nine skills and commands appear through
`opencode api get /api/skill` and `opencode api get /api/command` once a session
exists, then invoke a Core command with a sample request.

See the [installation verification record](docs/installation-verification.md)
for the live Git-package checks and their limitations.
