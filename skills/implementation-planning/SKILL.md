---
name: implementation-planning
description: Turns a requested outcome into a repository-grounded implementation approach for one coherent increment, separating facts established from repository evidence from material decisions the requester owns. Use when the user asks for an implementation plan, approach refinement, or planning before implementation. Planning never authorizes implementation.
---

# Implementation Planning

Produce a grounded approach for one coherent implementation increment. This skill is
repository-agnostic: discover architecture, verification commands, tests, documentation
ownership and engineering policy from the consumer repository instead of assuming names,
paths or a stack.

Planning never authorizes implementation. See
[Implementation authorization](#implementation-authorization).

## Context

**Work context (required).** The requested outcome and the acceptance intent at the level
actually supplied. A direct request is sufficient; no tracker, issue or formal acceptance
criteria document is required. Tracker IDs, status and decomposition metadata are optional
orientation only and never correctness authority. Do not infer requested work from tracker
absence, Git history, branch names or existing plan files.

**Repository context (required).** Access to authoritative repository evidence: current
code and tests, repository-provided rules and canonical documentation, relevant contracts
and architecture, and the applicable verification commands. Discover only what is relevant
to the work. Do not require a specific file such as `AGENTS.md`, a documentation layout, or
a build system. Repository evidence overrides plans and tracker metadata when they disagree
about current reality.

**Execution context.** Capabilities of the active session:

- inspecting the repository is required for a repository-grounded result;
- executing commands is optional and enables bounded spikes;
- interacting with the requester is optional and enables resolving material decisions;
- writing scratch files is optional and enables persisting a working plan.

Missing capability removes or weakens only the affected behavior; never simulate it and
never claim an action or verification that did not happen. If the requester cannot be
asked interactively, establish every discoverable fact first, then stop at the first
unresolved material decision and report exactly what must be decided rather than guessing.
If repository access is unavailable, planning cannot be repository-grounded; report that
limitation instead of inventing a result.

## Resolve the requested work

1. Resolve an explicit requested outcome and acceptance intent from the requester. A
   coordinating layer or tracker may supply this context; planning must work without one.
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

Leave harmless local choices to the implementer: private helper names, routine extraction,
ordinary control flow, local sequencing, exhaustive file inventories, and internal
test-helper structure — anything that does not materially affect the requested outcome or
repository contracts.

## Optional working plan

A working plan is optional, non-authoritative, disposable working memory. It is not backlog,
not architecture truth, not a merge gate and not permission to implement. Use one when it
helps reasoning or context transport, and skip it when it does not; the absence of a plan
file is not a planning failure. A plan need not match the final implementation.

Keep the plan in the session by default. Persist it only when useful and only when the
execution environment allows scratch writes. No fixed path, directory convention or
`.gitignore` change is required, and a location outside the repository is fine.

When a plan helps, a minimal illustrative shape is:

```markdown
# <title>

## Goal

## Current understanding

## Approach

## Constraints and checks

## Open questions
```

Omit any section that adds nothing. Do not add a status field or a plan dependency graph.

## Bounded planning spikes

A spike is disposable executable work that answers one concrete technical question; the
answer is the output, not the code. Use one only when the question is explicit, execution
materially reduces uncertainty compared with reasoning or static inspection, and command
execution is available.

Before running, state the technical question and the cheapest decisive experiment. A spike
may compile or run small experiments and inspect library or framework behavior, must not
modify production code, and needs no production-quality architecture, tests or docs. Stop
as soon as the question is answered or the experiment can no longer answer it, and record
only the resulting fact when it matters later. Delete the spike when it is no longer useful.

If execution is unavailable, report the limitation rather than working around it. If a spike
stops answering its question and starts building production behavior, stop the spike and
return to planning. A spike never grants implementation authorization.

## Implementation authorization

Planning ends ready for implementation; it does not begin it. Planning completion —
including any accepted review of the approach — never authorizes implementation.
Implementation begins only when the requester or coordinating layer explicitly authorizes
it, as a separate action rather than a side effect of planning. Report readiness and stop.

## Report

Report:

- one coherent increment, or **Needs decomposition**;
- facts established, and material facts that remain unresolved;
- material decisions resolved and decisions still open;
- spike outcomes when a spike was used;
- where the working plan lives, or that it stayed in-session;
- that implementation requires separate explicit authorization.
