# Agent Skills

[`kazforge/agent-skills`](https://github.com/kazforge/agent-skills) is the canonical
implementation repository for the KazForge Agent Skills Core project: small,
reusable engineering workflows for coding agents, extracted from real projects.
These are instructions, not a workflow engine or an orchestration framework.

## Organization

Keep skills in the existing flat `skills/<name>/SKILL.md` layout. Core and support
are documented roles, not a directory hierarchy or a registry.

| Concern | Purpose and location |
| --- | --- |
| **Core workflow skills** | Repository-agnostic planning, review and implementation instructions in `skills/<name>/SKILL.md`. `implementation-planning`, `design-review`, `plan-review`, `implementation` and `implementation-review` have landed. |
| **Optional support skills** | Convenient, independently usable helpers in the same `skills/<name>/SKILL.md` layout. They may rely on particular tools or support conventions. |
| **Harness/distribution support** | The thin OpenCode plugin boundary in `index.ts` (which registers the Core skills and exposes each as a command), OpenCode invocation wrappers in `commands/*.md` for support skills, and local symlink installation in `setup.sh`. None defines Core policy or is required by Core semantics. |

The Core skills available so far, plus the optional support skills:

| Skill | Purpose |
| --- | --- |
| [implementation-planning](skills/implementation-planning/SKILL.md) | Core: turn a requested outcome into a repository-grounded implementation approach for one increment. |
| [design-review](skills/design-review/SKILL.md) | Core: challenge whether a proposed design is sound, simple, repository-compatible and justified against simpler alternatives. |
| [plan-review](skills/plan-review/SKILL.md) | Core: assess whether an implementation approach is executable without material guessing or harmful over-specification. |
| [implementation](skills/implementation/SKILL.md) | Core: implement the requested outcome as the smallest coherent change, run repository-provided verification, and request independent review. |
| [implementation-review](skills/implementation-review/SKILL.md) | Core: independently judge whether an actual change-set satisfies the requested outcome, acceptance intent and repository contracts. |
| [branch-name](skills/branch-name/SKILL.md) | Propose a branch name without creating it. |
| [commit-message](skills/commit-message/SKILL.md) | Propose a Conventional Commits message without committing. |
| [address-pr-comments](skills/address-pr-comments/SKILL.md) | Assess and address GitHub PR review comments. |
| [pr-quality-triage](skills/pr-quality-triage/SKILL.md) | Investigate PR CI and Sonar findings and fix applicable issues. |

Review independence is a desired property, not a harness requirement. Each review
skill carries its own fresh-session fallback: when the active session cannot
provide an independent reviewer context, the review moves to a fresh session
carrying only the review contract — review type, source, requested outcome and
acceptance intent, repository access, and how to return the result — never the
authoring session's reasoning, conclusions or narrative. Core skills stay
independently usable and are not mandatory workflow stages: `implementation-review`
stands alone, and `implementation` requests it only when the environment supports
an independent context.

## Consumer repositories own engineering truth

Skills can be used while working on a consumer repository, but that repository
does not depend on Agent Skills. No consumer must vendor, install or reference
this collection for correctness.

Architecture, build commands, CI gates, tests, documentation ownership and
engineering rules remain with each consumer repository. Skills discover and
follow that repository's evidence and guidance; they do not supply replacement
policy. Requested outcomes and acceptance criteria come from the user or work
item, not from this collection. Core must not assume a stack, tracker, harness
launcher or fixed scratch path.

## Local setup

Read a skill's instructions and tool requirements before using it. To expose the
collection to the currently supported harnesses, run from this checkout:

```sh
bash setup.sh
```

The script links all skill directories into:

- OpenCode: `~/.config/opencode/skills/`
- Cursor: `~/.cursor/skills/`
- Codex: `~/.agents/skills/`

It also links command wrappers into `~/.config/opencode/command/`. This is an
optional local distribution convenience, not synchronization into consumer
repositories. Keep the checkout at its linked location. The script creates
destination directories and replaces same-named symlinks; inspect existing
entries before running it. Restart OpenCode after changing installed skills or
commands so changes take effect reliably.

## OpenCode plugin

The repository can be loaded as an OpenCode plugin. `package.json` declares the
package and `index.ts` is the single entrypoint. Loading it registers the Core
workflow skills from their packaged `skills/<name>/SKILL.md` files and exposes
each one as an OpenCode-native command:

| Command | Core skill |
| --- | --- |
| `/implementation-planning` | [implementation-planning](skills/implementation-planning/SKILL.md) |
| `/design-review` | [design-review](skills/design-review/SKILL.md) |
| `/plan-review` | [plan-review](skills/plan-review/SKILL.md) |
| `/implementation` | [implementation](skills/implementation/SKILL.md) |
| `/implementation-review` | [implementation-review](skills/implementation-review/SKILL.md) |

Command arguments carry the requester's own words:

```text
/implementation-planning Add retry handling to the import job
```

Arguments are optional; when they are missing, the skill establishes the
requested outcome as it normally would. No Linear, GitHub or other tracker is
required to invoke a workflow. The command is a thin adapter: it selects the
skill and passes the request through, so implementation authorization and
repository-context discovery stay exactly with the skill contract.

Command names intentionally match the skill IDs. OpenCode keeps one command
registry shared by configuration, Markdown and plugin sources, and a later
definition replaces an earlier command with the same name, so the collection
avoids generic names such as `/plan` or `/review` that another source is likely
to define. Do not add `commands/*.md` wrappers for Core workflows; they would
collide with the plugin-provided commands.

Workflow semantics stay in the `skills/<name>/SKILL.md` files and are not
reimplemented as plugin code. Reviewer agents and per-reviewer model routing are
tracked separately.

Install the entrypoint's runtime dependency once from the checkout:

```sh
npm install
```

To load the plugin for local development, point an `opencode.jsonc` at the
checkout directory, then restart OpenCode:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["/absolute/path/to/agent-skills"]
}
```

Loading the plugin is optional, and no consumer repository is required to
install it for its own correctness. `setup.sh` remains the path for Cursor and
Codex skill linking until that distribution story is settled, but OpenCode no
longer needs it once the plugin is configured.

OpenCode loads a configured plugin directory from a root `index.ts`, so keep the
entrypoint at the repository root. Run `npm test` and `npm run typecheck` to
check the entrypoint contract, command registration and package contents.

## Maintaining the collection

Add a skill at `skills/<name>/SKILL.md` with descriptive `name` and `description`
frontmatter, and document whether it is Core or optional support here. Keep Core
instructions repository-agnostic; leave consumer facts and verification commands
with the consumer. The plugin registers every Core skill and exposes it as a
command named after the skill, so no command wrapper is needed for Core. Add an
OpenCode command wrapper only when useful for an optional support skill, not as a
prerequisite for the skill.

Prefer small instructional changes backed by real use. The OpenCode plugin
boundary stays deliberately thin: no workflow DSL, registry, custom
orchestration runtime or adapter framework, and no package metadata beyond what
the single plugin entrypoint requires.
