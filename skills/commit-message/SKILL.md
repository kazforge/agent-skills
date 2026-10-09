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

### Required elements

- **type** — noun prefix and required colon + space. Must be one of the commitlint type-enum (closed set): `build`, `chore`, `ci`, `docs`, `feat`, `fix`, `perf`, `refactor`, `revert`, `style`, `test`. Use `feat` for new features, `fix` for bug fixes.
- **description** — short imperative summary immediately after the prefix (e.g. `fix: array parsing issue when multiple spaces were contained in string`).

### Optional elements

- **scope** — noun in parentheses for the affected area: `feat(parser): add array support`.
- **body** — optional why-focused paragraph (1-2 lines).
- **footers** — blank line after body; git-trailer style (`Refs: #123`, `Reviewed-by: Name`). Use `BREAKING CHANGE: <description>` (or `BREAKING-CHANGE:`) for breaking changes. Footer lines wrap at ≤ 100 chars.

### Breaking changes

Indicate either:

- `!` before the colon: `feat(api)!: remove legacy endpoints`, or
- footer: `BREAKING CHANGE: environment variables now take precedence over config files`

Both may be used together per the spec.

### Style defaults

Unless the repository's `git log` clearly differs:

- Lowercase type and scope (`type-case`, `scope-case`).
- Imperative description: "add", "fix", "remove" — not "added" or "adds".
- Header (type + scope + description) ≤ 100 characters, per commitlint's `header-max-length`.
- Description must not be sentence-case, start-case, pascal-case, or upper-case (`subject-case`), and has no leading/trailing whitespace or trailing period (`subject-full-stop`).
- Body and footer lines wrap at ≤ 100 characters (`body-max-line-length`, `footer-max-line-length`); there is no total body-length limit.
- Blank line between description and body, and between body and footers (`body-leading-blank`, `footer-leading-blank`).
- Default to a **subject-only** message (single line). Add a brief (1-2 line) why-focused body only when the change's rationale isn't evident from the diff, or the user explicitly asks for more detail.
- Split mixed-type changes into separate commits/messages when possible.

## Validate before returning

Self-check the proposal against the commitlint [config-conventional](https://github.com/conventional-changelog/commitlint/tree/master/%40commitlint/config-conventional) rules:

- Header ≤ 100 chars; type present, lowercase, in the type-enum; scope lowercase (if used).
- Description non-empty, lowercase-style, no trailing period, no surrounding whitespace.
- Blank lines between description/body and body/footers; body and footer lines ≤ 100 chars.
- `BREAKING CHANGE:` footer or `!` for breaking changes, never both absent.

If the repository defines its own commitlint config (`commitlint.config.*`, `package.json` `commitlint` field), defer to it on conflict.

## Output format

```markdown
**Commit:**
```
type(scope): description
```

Footers only for breaking changes or trailers.

State that nothing was committed or pushed unless the user asked.

## Do not

- Run `git commit`, `git push`, or `git add` unless explicitly requested.
- List every changed file in the body.
- Add a body that restates the diff, exceeds a few lines, or pads with boilerplate.
- Combine unrelated changes in one message.

## Examples

**Feature with scope**

```
feat(auth): add refresh token rotation
```

**With body (why not evident from diff)**

```
feat(auth): add refresh token rotation

Issuing short-lived access tokens narrows the session hijack window.
```

**Fix, description only**

```
fix: prevent duplicate form submission on double-click
```

**Breaking change**

```
feat(api)!: rename user profile endpoint

BREAKING CHANGE: `/v1/profile` is now `/v1/users/me`.
```

**Docs**

```
docs: correct installation steps for Node 20
```
