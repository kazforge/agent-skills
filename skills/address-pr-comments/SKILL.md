---
name: address-pr-comments
description: Reads the comments of a GitHub pull request via the GitHub MCP, assesses which are reasonable, plans and implements the needed changes, and offers to commit, push, and reply on the PR. Use when the user wants PR comments or review feedback addressed, e.g. "address the comments on PR #12", "handle the review on owner/repo#42", or adds "yolo" for hands-free commit/push/reply.
argument-hint: "PR reference (e.g. owner/repo#123, #123, or URL) — add 'yolo' for hands-free commit/push/reply"
---

# Address PR Comments

## Input parsing

- The first argument is the PR reference. Accept any of:
  - `owner/repo#123`
  - `#123` — resolve `owner/repo` from the git remote (`git remote get-url origin`; handle `https://...`, `git@...`, and ssh forms)
  - a full URL like `https://github.com/owner/repo/pull/123`
- If no reference is given, derive the PR from the current branch:
  1. Resolve `owner/repo` from the git remote (see Phase 1).
  2. Get the current branch: `git rev-parse --abbrev-ref HEAD`.
  3. Search for its PR via the GitHub MCP: `github_search_pull_requests` with query `repo:<owner/repo> is:pr head:<branch>` (repo-scoped so fork branches match).
  4. If exactly one open PR matches, use it. If none or multiple, ask the user via the `question` tool, listing the candidates.
- **Yolo mode:** if the word `yolo` appears anywhere in the arguments, skip every confirmation question (plan approval and the commit/push/reply question) and proceed hands-free.

## Phase 1 — Gather context

1. Resolve the repository and PR number; if the PR reference lacks `owner/repo`, derive it from the git remote. If the working directory is not a git repo and the reference is ambiguous, ask the user.
2. Fetch the PR via the GitHub MCP:
   - `github_pull_request_read` with `method: get` — state, title, head/base refs.
   - `method: get_review_comments` — inline review threads. Paginate (`after` cursor, `perPage` up to 100) until all threads are collected.
   - `method: get_comments` — general PR thread comments.
   - `method: get_reviews` — review summaries.
   - `method: get_diff` — only if needed to understand the context of inline comments.
3. Check the PR is not closed or merged — abort with a message if it is.
4. Verify the local branch matches the PR head branch (`git rev-parse --abbrev-ref HEAD` vs the head ref). If they differ, warn the user; changes would land on the wrong branch.
5. Reconstruct the comment threads: a thread's root is a comment without `in_reply_to_id`; replies nest under their root. Treat each thread as one unit for assessment.

## Phase 2 — Assess

For every thread and general comment, classify it:

- **Actionable** — requests a concrete change (bug, correctness, style that matters, missing test, etc.).
- **Reply only** — a question to answer, a suggestion you will decline with justification, or a discussion that needs a response but no code change.
- **Outdated / superseded** — already fixed by a later commit, contradicted by a newer comment, or no longer applies. Note it and skip.

Be honest about reasonableness: a comment can be technically valid but a non-issue for this PR (decline with a short justification); an unreasonable or already-addressed comment needs no code change. Do not implement changes you disagree with silently — put them in the plan marked as declined.

## Phase 3 — Plan and approval

Include:

- **Changes**: per-file list of edits grouped by topic, with the thread(s) each change addresses.
- **Replies**: per-thread and per-comment draft reply text. For addressed threads, summarize the fix. For declined threads, give a concise technical justification. For questions, answer them.
- **Resolutions**: which threads to resolve after replying (addressed threads; declined threads stay unresolved).
- **Commit strategy**: a suggested type and scope for the batch of changes. The final message is produced by the `commit-message` skill after implementation (see Phase 4).

Present the plan and ask for approval with the `question` tool (approve / adjust). In yolo mode, skip this and proceed.

## Phase 4 — Implement

1. Make the planned edits on the current branch. Keep changes scoped to what the comments require.
2. Run the relevant tests and/or lint to verify nothing is broken; fix any failures.
3. If the `commit-message` skill is available in the workspace, load it via the skill tool and follow it to propose the commit message from the current diff, then commit with it. If it is not available, apply its rules directly: Conventional Commits 1.0.0, subject-only by default, description ≤ 72 characters.

## Phase 5 — Ship

Ask a single `question` with options: "Commit + push + reply", "Commit + push only", "Replies only", "Nothing". In yolo mode, skip and take the first option.

1. Push the current branch (`git push`).
2. For every thread and general comment that needs a reply, post it with `github_add_reply_to_pull_request_comment`:
   - `commentId` — the numeric ID of the latest comment in the thread (from `get_review_comments` / `get_comments`).
   - Body summarizes what changed and references the commit SHA (or short hash). For declined threads, state the justification and that no change was made.
3. Resolve addressed review threads with `github_pull_request_review_write` `method: resolve_thread` using the thread's node ID (the `PRRT_...` id from `get_review_comments`). Never resolve threads whose feedback was declined.

## Do not

- Commit, push, or post replies without the user's explicit go-ahead — except in yolo mode.
- Work around opencode's permission rules: `git commit` / `git push` may still prompt, even in yolo mode; let the prompts stand.
- Rebase, force-push, or touch branches other than the current one.
- Reply to threads that are outdated or superseded.
