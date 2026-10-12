---
name: implementation
description: Implements a requested outcome as the smallest coherent change, discovers and executes the consumer repository's applicable verification, and requests an independent implementation review when the environment supports one. Use when the requester explicitly asks to implement, build or make a change. Planning completion is never implementation authorization.
---

# Implementation

Implement the **requested outcome and acceptance intent**. Judge success by the result in the
repository, not by adherence to a plan.

Implementation begins only when the requester explicitly asks for the change. A plan, planning
output or review verdict is context, never authorization.

## Context

**Work context (required).** The requested outcome and acceptance intent as supplied. A direct
request is sufficient; tracker IDs and status are optional orientation, not correctness authority.
Do not infer work from tracker absence, Git history, branch names or existing plan files.

**Repository context (required).** Relevant code, tests, rules, canonical documentation,
contracts, architecture, ownership, verification and completion obligations. Discover them from
the consumer repository; do not assume a stack, build tool, layout, tracker, scratch path or `AGENTS.md`.

**Execution context.** Repository inspection is required; commands, requester interaction and
independent review may be unavailable. Report unavailable capabilities, checks not run and assurance
limits; never simulate an action or verification.

## Resolve the requested work

1. Resolve an explicit requested outcome and acceptance intent from the requester. Ask when the
   intent is ambiguous.
2. Read a supplied plan or approach as orientation only; divergence from it is not failure by
   itself.
3. Establish discoverable facts before asking, using repository state and the relevant evidence.

## Delegated execution

Direct use of this skill remains valid without a plugin, child agent or formal plan. When a
coordinator delegates to a dedicated worker, the worker receives only an explicit, authorized,
context-rich handoff — outcome, acceptance intent, the actual plan or an accessible reference,
accepted decisions and constraints — never the authoring conversation. A worker returns the change
and the checks it ran, stops at missing inputs or material deviations instead of redesigning, and
never performs separately authorized commit, push, merge, PR or tracker actions or starts its own
review. The coordinator owns user decisions and the independent review.

## Implement the smallest coherent change

Make the smallest coherent change. Adapt harmless names, routine extraction, control flow and
test structure freely when they do not affect the outcome or repository contracts.

Preserve requester control over material change. If repository reality contradicts a material
product or design decision — architecture, ownership or source of truth, public or observable
behavior, compatibility, migration, component boundaries, significant scope trade-offs, acceptance
intent — stop and ask rather than silently redesigning. If the requester cannot be asked
interactively, establish every discoverable fact first, then stop at the first unresolved material
decision and report exactly what must be decided.

## Discover and execute verification

Use the repository's own applicable checks: build, tests, formatting, linting, architecture,
documentation and other obligations. Never substitute another repository's commands or this skill's.

Execute every applicable check the active environment supports, narrowest useful set first, before
presenting the change as complete. Record the commands and their outcomes. A local check is
evidence, not the repository's full CI or merge authority. If a check cannot run, say so and treat
the result as unverified rather than assuming it passed.

## Request independent implementation review

When the environment can run an independent review context, request it using the separate
`implementation-review` skill. Pass the requested outcome and acceptance intent directly, plus any
approved plan and accepted design decisions as agreed-intent evidence, not incidental correctness
requirements. Pass the diff boundary for independent inspection, not implementation reasoning or
conclusions. A supplied plan remains optional.

Fresh context that did not author the change is the desired assurance property, not a required
subagent or session mechanism. Use available isolation and state any shared-context assurance
limit. If independent context is unavailable, use the fresh-session fallback in `implementation-review`.

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
