---
name: implementation
description: Implements a requested outcome as the smallest coherent change, discovers and executes the consumer repository's applicable verification, and requests an independent implementation review when the environment supports one. Use when the requester explicitly asks to implement, build or make a change. Planning completion is never implementation authorization.
---

# Implementation

Implement the **requested outcome and acceptance intent**. Judge success by the result in the
repository, not by adherence to a plan.

This skill is repository-agnostic: discover architecture, ownership, engineering rules, verification
commands, documentation obligations and completion expectations from the consumer repository. Never
assume a stack, build tool, file layout, tracker or scratch path.

Implementation begins only when the requester explicitly asks for the change. A plan, planning
output or review verdict is context, never authorization.

## Context

**Work context (required).** The requested outcome and acceptance intent at the level actually
supplied. A direct request is sufficient; no tracker, issue or formal acceptance criteria document
is required. Tracker IDs and status are optional orientation only and never correctness authority.
Do not infer requested work from tracker absence, Git history, branch names or existing plan files.

**Repository context (required).** Access to current repository reality: current code and tests,
repository-provided rules and canonical documentation, relevant contracts and architecture, and the
verification the repository provides. Discover only what the change implicates. Do not require a
specific instruction file such as `AGENTS.md`, a documentation layout or a build system.

**Execution context.** Capabilities of the active session:

- inspecting the repository is required;
- executing commands is optional and enables running verification;
- interacting with the requester is optional and enables resolving material decisions;
- an independent review context may or may not be available.

Missing capability removes or weakens only the affected behavior; never simulate it and never claim
an action or verification that did not happen. Report what was not run and the assurance limit.

## Resolve the requested work

1. Resolve an explicit requested outcome and acceptance intent from the requester. Ask when the
   intent is ambiguous.
2. Read a supplied plan or approach as orientation only; divergence from it is not failure by
   itself.
3. Investigate before asking: repository state, relevant guidance, contracts, and affected code and
   tests answer most questions.

## Implement the smallest coherent change

Satisfy the request with the smallest coherent change against current repository reality. Local
freedom is expected for harmless details — private helper names, routine extraction, ordinary
control flow, internal test structure — when they do not affect the requested outcome or repository
contracts.

Preserve requester control over material change. If repository reality contradicts a material
product or design decision — architecture, ownership or source of truth, public or observable
behavior, compatibility, migration, component boundaries, significant scope trade-offs, acceptance
intent — stop and ask rather than silently redesigning. If the requester cannot be asked
interactively, establish every discoverable fact first, then stop at the first unresolved material
decision and report exactly what must be decided.

## Discover and execute verification

Discover the applicable repository-provided verification for the change: build or compile, tests,
formatting or linting, architecture checks, documentation obligations and anything else the
repository defines. Use the repository's own commands and rules; never substitute commands from
this skill or another repository.

Execute every applicable check the active environment supports, narrowest useful set first, before
presenting the change as complete. Record the commands and their outcomes. A local check is
evidence, not the repository's full CI or merge authority. If a check cannot run, say so and treat
the result as unverified rather than assuming it passed.

## Request independent implementation review

When the environment can run an independent review context, request it using the separate
`implementation-review` skill. Pass the requested outcome and acceptance intent directly; a plan is
optional context at most.

Fresh context that did not author the change is the desired assurance property, not a required
subagent or session mechanism. Use whatever isolation the environment allows, and state the
assurance limit when the review shares context with the implementation. When the environment
cannot run an independent context, use the fresh-session fallback in `implementation-review`.

If the review reports material findings:

- fix the findings that are valid and within the authorized scope;
- re-run the affected verification;
- if a finding implies material redesign or a scope change, stop and ask the requester instead of
  deciding unilaterally;
- request at most one further independent review of the revised change, then stop. Do not start
  another fix/review cycle; report remaining findings to the requester.

## Report

Report the changed paths, the requested outcome and how the change satisfies it, verification
actually run and not run, the review outcome and assurance limit, unresolved material decisions,
and residual risks. Leave commit, push, pull request and tracker updates to the requester unless
they explicitly asked for them.
