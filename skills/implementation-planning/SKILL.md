---
name: implementation-planning
description: Turns a requested outcome into a repository-grounded implementation approach for one coherent increment, separating facts established from repository evidence from material decisions the requester owns. Use when the user asks for an implementation plan, approach refinement, or planning before implementation. Planning never authorizes implementation.
---

# Implementation Planning

Produce a repository-grounded approach for one coherent implementation increment.

## Context

**Work context (required).** The requested outcome and acceptance intent as supplied.
A direct request is sufficient; tracker IDs, status and decomposition metadata are
optional orientation, not correctness authority. Do not infer work from tracker absence,
Git history, branch names or existing plan files.

**Repository context (required).** Current code, tests, rules, canonical documentation,
contracts, architecture, documentation ownership and verification commands relevant to the work.
Discover them from the consumer repository; do not assume a stack, layout, build system or `AGENTS.md`.
Repository evidence overrides plans and tracker metadata about current reality.

**Execution context.** Repository inspection is required; commands, requester interaction
and scratch writes are optional. Report unavailable capabilities and actions not performed;
never simulate them. Without repository access, report that planning cannot be grounded.

## Resolve the requested work

1. Resolve the requested outcome and acceptance intent from the requester or coordinating
   layer. A tracker is optional.
2. Decide whether the work is **one coherent implementation increment**: it can be
   implemented and independently reviewed as one change against repository reality that
   exists now.
3. If later design materially depends on earlier work that is not yet implemented, stop and
   report **Needs decomposition** to the requester or coordinating layer. Do not invent a
   multi-plan dependency graph and do not contact a tracker.

## Establish facts before asking

Facts are the planner's responsibility. Investigate in order:

1. repository evidence;
2. primary documentation or specifications;
3. a bounded executable spike when command execution is available and materially reduces
   uncertainty.

Do not ask the requester what investigation can answer. If a material fact cannot be
established, report that boundary rather than asserting fabricated certainty.

## Material decisions and implementation freedom

Material product and design decisions belong to the requester: architecture, ownership and
source of truth, public or observable behavior, compatibility, migration, boundaries between
components, significant scope trade-offs, and acceptance intent. Ask only material
questions, briefly state the trade-off, and recommend an answer with rationale.

If requester interaction is unavailable, establish the discoverable facts, then stop at
the first unresolved material decision and report what must be decided.

Leave harmless local choices to the implementer: names, routine extraction, control flow,
sequencing, file inventories and test-helper structure that do not affect the outcome or contracts.

## Optional working plan

Keep the plan in-session by default. It is optional, disposable working memory, not
backlog, architecture truth or a merge gate, and need not match the final implementation.
Persist it only when useful and scratch writes are allowed; no fixed path or `.gitignore`
change is required, and an external location is fine. Include only useful content; do not
add a status field or dependency graph.

## Bounded planning spikes

A spike answers one explicit technical question when execution is available and materially
reduces uncertainty beyond static inspection. State the question and cheapest decisive
experiment before running. It may compile small experiments or inspect library behavior,
but must not modify production code or turn into implementation; it needs no production
architecture, tests or docs. Stop when answered, when the experiment cannot answer it, or
when it starts building production behavior. Record only useful resulting facts and delete
the spike when no longer useful. If execution is unavailable, report the limitation.

## Implementation authorization

Neither planning, spikes nor an accepted review authorize implementation. It requires separate
explicit authorization from the requester or coordinating layer. Report readiness and stop.

## Report

- one coherent increment, or **Needs decomposition**;
- facts established, and material facts that remain unresolved;
- material decisions resolved and decisions still open;
- spike outcomes when a spike was used;
- where the working plan lives, or that it stayed in-session;
- that implementation requires separate explicit authorization.
