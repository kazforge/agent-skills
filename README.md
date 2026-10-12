# Agent Skills

Reusable engineering workflows for OpenCode: planning, design and code review,
implementation, and supporting tools. Skills remain readable Markdown and can
be used independently. They follow each repository's own rules and build commands.

## Workflows

Use workflows independently; they are not mandatory stages.

| Core skill | Purpose |
| --- | --- |
| [implementation-planning](skills/implementation-planning/SKILL.md) | Plan a repository-grounded change. |
| [design-review](skills/design-review/SKILL.md) | Challenge a design and consider simpler alternatives. |
| [plan-review](skills/plan-review/SKILL.md) | Check whether a plan is executable. |
| [implementation](skills/implementation/SKILL.md) | Implement and verify a requested change. |
| [implementation-review](skills/implementation-review/SKILL.md) | Review a change against its requested outcome. |

Support skills may require external tools; check their instructions before use.

| Support skill | Purpose |
| --- | --- |
| [branch-name](skills/branch-name/SKILL.md) | Propose a branch name without creating it. |
| [commit-message](skills/commit-message/SKILL.md) | Propose a Conventional Commits message without committing. |
| [address-pr-comments](skills/address-pr-comments/SKILL.md) | Assess and address GitHub PR review comments. |
| [pr-quality-triage](skills/pr-quality-triage/SKILL.md) | Investigate PR CI and Sonar findings and fix applicable issues. |

## Install

Install globally with OpenCode V2; no consumer-repository setup is needed:

```sh
opencode plugin add github:kazforge/agent-skills
opencode service restart
opencode plugin list
```

## Use

Each skill has a slash command with the same name:

```text
/implementation-planning Add retry handling to the import job
/branch-name
```

Arguments are optional. Planning and review do not authorize implementation; commit,
push and merge require separate authorization.

`/implementation` delegates an authorized change to `kazforge-implementer`; it
never implements in the parent as a fallback. The worker asks approval for shell
commands and returns material decisions to the parent. See the
[implementation skill](skills/implementation/SKILL.md) for handoff and review rules.
Direct skill use needs neither the plugin nor a formal plan.

Review commands start a fresh child session with the matching reviewer:

| Agent ID | Role |
| --- | --- |
| `kazforge-design-reviewer` | Design review |
| `kazforge-plan-reviewer` | Plan review |
| `kazforge-implementation-reviewer` | Implementation review |

Reviewer agents have no direct edit permission. Implementation-review shell commands
require approval.
If an independent review cannot start, the command reports the limitation and
points to the skill's fresh-session fallback.

Set `agents.<agent-id>.model` to configure a worker or reviewer model; leave it
unset to inherit the parent's model.

## Update and remove

Update:

```sh
opencode plugin check
opencode plugin update github:kazforge/agent-skills
opencode service restart
```

Remove:

```sh
opencode plugin remove github:kazforge/agent-skills
opencode service restart
```

To pin a revision, install `github:kazforge/agent-skills#<full-commit-sha>`.
Pinned commits are skipped by updates; remove the exact target shown by
`opencode plugin list` before installing another revision.

## Migrate from setup.sh

Install the plugin instead of using the removed symlink installer. Inspect old
entries in `~/.config/opencode/skills/`, `~/.config/opencode/command/`,
`~/.cursor/skills/` and `~/.agents/skills/`. Use `test -L` and `readlink` to confirm
each link, including broken links, targets the old checkout; remove only those
links with `unlink`. Preserve real files, unrelated links and destination directories.
Remove an old checkout plugin entry if switching to Git installation, then restart.

## Contributing

Run `npm ci`, then load the checkout through `opencode.jsonc` and restart OpenCode:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["/absolute/path/to/agent-skills"]
}
```

Do not load the checkout and Git package together. Restart after local changes;
package updates skip local paths. To remove it, delete its plugin entry and restart.

Keep workflow instructions in `skills/<name>/SKILL.md` with `name` and
`description` frontmatter. Keep skills repository-agnostic and list them here.
Use native Markdown for definitions and TypeScript only for necessary runtime glue.
Core workflows need an entry in `index.ts`; dedicated agents also need an `agents/*.md`
file and mapping. Support wrappers live in `commands/`, named after their skills;
do not add duplicate Core wrappers.

Run `npm test` and `npm run typecheck` before submitting changes.
