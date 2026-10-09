---
name: pr-quality-triage
description: Inspects CI status and Sonar new-code findings on an existing pull request, verifies they belong to the current PR/head, classifies each finding, and fixes applicable issues in repository code. Use after a PR exists when the user asks to triage CI failures, Sonar issues, quality-gate results, or Sonar new-code smells. Do not use for GitHub PR review comments — including CodeRabbit, ChatGPT, and other review bots; that remains address-pr-comments.
argument-hint: "PR reference (e.g. owner/repo#123, #123, or URL) — add 'yolo' for hands-free commit/push"
---

# PR Quality Triage

Triage **CI and Sonar findings** on an existing pull request. Modify repository code when a
finding still applies.

## Input parsing

- The first argument is the PR reference. Accept any of:
  - `owner/repo#123`
  - `#123` — resolve `owner/repo` from the git remote (`git remote get-url origin`; handle
    `https://...`, `git@...`, and ssh forms)
  - a full URL like `https://github.com/owner/repo/pull/123`
- If no reference is given, derive the open PR from the current branch:
  1. Resolve `owner/repo` from the git remote.
  2. Get the current branch: `git rev-parse --abbrev-ref HEAD`.
  3. Search for its PR via the GitHub integration (`search_pull_requests` with
     `repo:<owner/repo> is:pr head:<branch>`, or `gh pr view --json number,url,headRefOid` when MCP
     is unavailable).
  4. If exactly one open PR matches, use it. If none or multiple, ask the user, listing candidates.
- Abort if no PR exists and none can be derived. This skill does not run as a pre-PR completion gate.
- **Yolo mode:** if the word `yolo` appears anywhere in the arguments, skip confirmation questions
  and proceed hands-free through implementation, local verification, commit, and push.

## Phase 1 — Resolve identity

1. Resolve repository, current branch, PR number, and current local HEAD
   (`git rev-parse HEAD` and `git rev-parse --abbrev-ref HEAD`).
2. Fetch PR identity from the available GitHub integration:
   - `pull_request_read` `method: get` — state, title, head/base refs, head SHA.
   - Confirm the PR is open. Abort if it is closed or merged.
3. Compare local HEAD to the PR head SHA. If they differ, say so before interpreting remote
   results: findings belong to the PR head, not to unpushed or divergent local commits.

## Phase 2 — Verify freshness

1. Inspect CI for **this PR's head commit** (`pull_request_read` `method: get_check_runs` and
   `get_status`, or `gh pr checks` / equivalent). Prefer checks attached to the PR head SHA.
2. If a required quality analysis (Sonar, the repository's zero-new-code check, or the failing
   static-analysis job) has not finished for this head, report that and wait or stop. Do not
   treat a previous SHA's results as current.
3. If a Sonar integration is available, query **this PR** (or the corresponding analyzed branch)
   rather than the default branch. Discover the Sonar PR key with `list_pull_requests` when needed;
   it is usually the host PR number but must be confirmed. Use `pullRequest` for PR-decorated
   analysis and `branch` only for branch analysis without a PR.
4. Confirm that inspected issues/quality-gate results are for that PR/branch and the relevant
   current head/revision. If analysis identity cannot be established, **report that freshness
   cannot be established** and do not treat the findings as actionable against current code.

## Phase 3 — Inspect findings (read-only)

Use whatever read-only integrations are actually available. Public contributors and machines without
Sonar MCP can still inspect CI; do not require a particular MCP installation.

1. Collect failing or relevant CI checks, logs, and annotations for the current PR head.
2. If Sonar tools are available, inspect **new-code** findings and quality status, for example:
   - `search_sonar_issues_in_projects` with `inNewCodePeriod: true` and
     `issueStatuses: ["OPEN", "CONFIRMED"]`, scoped to the discovered project key and PR/branch
   - `get_project_quality_gate_status` for the same PR/branch
   - `show_rule` for each implicated rule
3. Discover a Sonar project key from the repository when needed. Do not hardcode a project,
   organization, or path. Lookup order:
   - `.sonarlint/connectedMode.json` `projectKey`
   - `sonar.projectKey` in `sonar-project.properties`, `pom.xml`, `build.gradle`, `build.gradle.kts`,
     `package.json`
   - CI workflow config (`sonar.projectKey`, `SONAR_PROJECT_KEY`, equivalent)
   - `search_my_sonarqube_projects` when the key is still unknown
4. If Sonar MCP is missing, say so and continue with CI evidence. If neither CI nor Sonar data can
   be read, stop and report the limitation.

## Phase 4 — Gather evidence

For each finding, collect enough to judge it against **current** source:

- rule key and name
- message / check output
- file and location
- surrounding source context at that location
- whether the current file still contains the reported code
- rule documentation/details when a rule lookup tool exists

Skip findings whose file/location cannot be mapped onto the current tree; classify them stale or
report that evidence is insufficient.

## Phase 5 — Classify

Classify every finding:

- **Applicable** — current code still exhibits the problem, the rule is a real fit, and a
  repository-local code change is the right response.
- **Already fixed / stale** — the reported code is gone, the finding belongs to an older SHA, or
  a later commit already addressed it.
- **Apparently inapplicable** — the reported rule does not fit this code, or fixing it “to satisfy
  the analyzer” would change intended architecture or behavior.

A technically valid warning can still be a non-issue for this change. Do not optimize blindly
for static analysis.

## Phase 6 — Act

**Applicable**

1. Change repository code. Preserve intended architecture, behavior, public contracts, and tests.
2. Prefer a real fix over suppressions. Do not add suppressions, `NOSONAR`, or equivalent unless the
   user explicitly agrees.
3. Run the repository's deterministic local verification appropriate to the changed code (formatters,
   tests, coverage, architecture checks, or whatever `AGENTS.md` / README names as local gates).
   Do **not** run a local remote SonarCloud analysis as a substitute for those gates unless the user
   explicitly asks.

**Already fixed / stale**

Note it and skip. Do not reopen or otherwise mutate the remote issue.

**Apparently inapplicable**

Surface the evidence and rationale in the session (and in a PR comment only if the user asks).

## Phase 7 — Report and ship

Report:

- PR / head SHA used for inspection
- whether freshness was established
- classifications and actions
- local verification commands and outcomes
- residual risks, including findings left for humans

Do **not** claim that Sonar, the Quality Gate, or zero-new-code CI is complete because this skill
ran. After fixes are pushed, CI is the authority.

If code changed, propose a Conventional Commits message from the diff (use `commit-message` when
available). Ask before commit/push unless yolo mode is on. After push, treat the next CI/Sonar run
as the completion signal — optionally re-enter this skill once that analysis is fresh.

## Do not

- Mutate Sonar issue state, assignments, severities, tags, comments-as-resolution, or equivalent.
- Mark issues false-positive, won't-fix, accepted, confirmed-as-resolved, or reopen/close them
  through Sonar APIs or MCP tools (`change_sonar_issue_status`, `change_security_hotspot_status`,
  or any successor).
- Change quality profiles, quality gates, project administration, webhooks, or other Sonar
  configuration.
- Handle GitHub review comments, review-bot threads, replies or thread resolution; those belong
  to `address-pr-comments`.
- Encode one repository's paths, Sonar project keys, tracker IDs, or maintainer usernames into
  this skill's behavior.
- Treat a missing Sonar MCP installation as a repository failure. CI remains sufficient authority.
- Claim merge readiness from local triage alone.
