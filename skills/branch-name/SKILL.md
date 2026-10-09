---
name: branch-name
description: Proposes a git branch name from current changes. Use when the user asks for a branch name before creating a branch, when wrapping up work, or when they want branch metadata without creating a branch.
disable-model-invocation: false
---

# Branch Name

Propose a branch name from the current working tree. Do **not** create the branch unless the user explicitly asks.

Skip when the user explicitly asks to create a branch — follow their branch workflow instead.

## Inspect first

Run in parallel when in a git repository:

```bash
git status --short
git diff --stat
git log -5 --oneline
```

Read enough of `git diff` (or the user's stated goal) to infer intent and pick the right type prefix. Prefer the user's described outcome over a file inventory.

## Branch name

Conventional Commits does not define branch names; use a lightweight parallel convention:

**Format:** `<type>/<short-kebab-slug>`

| Prefix     | Typical use                     |
|------------|---------------------------------|
| `feat`     | New feature or capability       |
| `fix`      | Bug fix                         |
| `docs`     | Documentation only              |
| `chore`    | Tooling, deps, hygiene          |
| `refactor` | Behavior-preserving restructure |
| `ci`       | CI/CD changes                   |
| `test`     | Tests only                      |
| `perf`     | Performance work                |

- Lowercase, hyphen-separated; aim for ≤ 50 characters.
- Name the outcome, not touched paths (`add-oauth-login`, not `update-auth-files`).
- One coherent deliverable per branch; split unrelated work.

## Output format

```markdown
**Branch:** `type/slug`
```

State that nothing was created or pushed unless the user asked.

## Do not

- Run `git checkout -b`, `git commit`, `git push`, or `git add` unless explicitly requested.
- Use vague slugs (`updates`, `wip`, `changes`).

## Examples

**New feature**

```
feat/add-oauth-login
```

**Bug fix**

```
fix/duplicate-form-submission
```

**Behavior-preserving restructure**

```
refactor/extract-payment-service
```
