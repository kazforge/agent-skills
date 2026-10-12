---
name: commit-message
description: Proposes a Conventional Commits 1.0.0 message that passes the commitlint config-conventional ruleset. Use when the user asks for a commit message before committing, when wrapping up work, or when they want commit metadata without committing or pushing.
disable-model-invocation: false
---

# Commit Message

Propose a [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/) message from the current working tree. Do **not** stage, commit, or push unless the user explicitly asks.

Skip when the user explicitly asks to commit or push — follow their commit workflow instead.

## Inspect first

Run in parallel when in a git repository:

```bash
git status --short
git diff --stat
git log -5 --oneline
```

Read enough of `git diff` (or the user's stated goal) to infer intent. When `git log` shows an established style, match its casing, scope habits, and verbosity. Prefer the user's described outcome over a file inventory.

## Commit message

Follow [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/#specification):

```
<type>[optional scope][optional !]: <description>

[optional body]

[optional footer(s)]
```

## Validate before returning

Self-check against commitlint [config-conventional](https://github.com/conventional-changelog/commitlint/tree/master/%40commitlint/config-conventional).
Defer to the repository's commitlint config on conflict; otherwise use these defaults,
matching established Git history where it differs:

- Type is lowercase and one of `build`, `chore`, `ci`, `docs`, `feat`, `fix`, `perf`,
  `refactor`, `revert`, `style`, `test`; use `feat` for features and `fix` for fixes.
- Optional scope is a lowercase noun identifying the affected area.
- Description is non-empty and imperative, not sentence-case, start-case, pascal-case
  or upper-case, with no surrounding whitespace or trailing period.
- Header and each body/footer line are ≤ 100 characters; separate header, body and footers
  with blank lines. There is no total body-length limit.
- Default to a subject-only message. Add a brief why-focused body only when the diff
  does not explain the rationale or the user asks for detail.
- Footers use Git-trailer syntax and are only for trailers or breaking changes.
  Mark breaking changes with `!` before the colon, a `BREAKING CHANGE:` (or
  `BREAKING-CHANGE:`) footer, or both.
- Split mixed-type changes into separate commits/messages when possible.

## Output format

**Commit:**

```text
type(scope): description
```

State that nothing was committed or pushed unless the user asked.

## Do not

- Run `git commit`, `git push`, or `git add` unless explicitly requested.
- List every changed file in the body.
- Add a body that restates the diff, exceeds a few lines, or pads with boilerplate.
- Combine unrelated changes in one message.
