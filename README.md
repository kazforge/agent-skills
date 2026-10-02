# Agent Skills

[`kazforge/agent-skills`](https://github.com/kazforge/agent-skills) is the canonical
implementation repository for the KazForge Agent Skills Core project: small,
reusable engineering workflows for coding agents, extracted from real projects.
These are instructions, not a workflow runtime or an orchestration framework.

## Organization

Keep skills in the existing flat `skills/<name>/SKILL.md` layout. Core and support
are documented roles, not a directory hierarchy or a registry.

| Concern | Purpose and location |
| --- | --- |
| **Core workflow skills** | Repository-agnostic planning, review and implementation instructions in `skills/<name>/SKILL.md`. `implementation-planning` has landed; the remaining Core extractions are in progress. |
| **Optional support skills** | Convenient, independently usable helpers in the same `skills/<name>/SKILL.md` layout. They may rely on particular tools or support conventions. |
| **Harness/distribution support** | OpenCode invocation wrappers in `commands/*.md` and local symlink installation in `setup.sh`. Neither defines Core policy nor is required by Core semantics. |

The Core skill available so far, plus the optional support skills:

| Skill | Purpose |
| --- | --- |
| [implementation-planning](skills/implementation-planning/SKILL.md) | Core: turn a requested outcome into a repository-grounded implementation approach for one increment. |
| [branch-name](skills/branch-name/SKILL.md) | Propose a branch name without creating it. |
| [commit-message](skills/commit-message/SKILL.md) | Propose a Conventional Commits message without committing. |
| [address-pr-comments](skills/address-pr-comments/SKILL.md) | Assess and address GitHub PR review comments. |
| [pr-quality-triage](skills/pr-quality-triage/SKILL.md) | Investigate PR CI and Sonar findings and fix applicable issues. |
| [handoff](skills/handoff/SKILL.md) | Carry conversation context into another session. |

The remaining Core extractions in KAZ-185–186 belong alongside these skills:
`skills/design-review/SKILL.md`, `skills/plan-review/SKILL.md`,
`skills/implementation/SKILL.md` and `skills/implementation-review/SKILL.md`.
These are destinations, not implemented skills or mandatory workflow stages.
KAZ-187's fresh-review fallback belongs in support guidance: a small skill or
reference here, or inline guidance in the review skills if a separate helper
adds no value.

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

The existing `handoff` skill writes to `.agentWork/.session/`, and this repository
ignores that path. This is current support behavior only, not a Core contract or
a requirement for consumers. Do not assume another repository ignores it.

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

## Maintaining the collection

Add a skill at `skills/<name>/SKILL.md` with descriptive `name` and `description`
frontmatter, and document whether it is Core or optional support here. Keep Core
instructions repository-agnostic; leave consumer facts and verification commands
with the consumer. Add an OpenCode command wrapper only when useful for invocation,
not as a prerequisite for the skill.

Prefer small instructional changes backed by real use. This baseline introduces
no registries, manifests, schemas, workflow DSLs, runtime APIs, package-manager
infrastructure or adapter frameworks.
