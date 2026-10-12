---
name: implementation-review
description: Independently evaluates whether an actual change-set correctly satisfies the requested outcome and acceptance intent, against repository contracts, tests and verification evidence. Establishes its own change-set boundary and never treats a plan as correctness authority. Use when the user asks for an implementation review or a code review of a completed change.
---

# Implementation Review

Ask: **Does the actual change correctly satisfy the requested outcome and acceptance intent, and
remain compatible with the repository's contracts and rules?**

A plan is orientation, not correctness authority or a substitute for the requested outcome and
acceptance intent. Divergence from it is not a defect by itself. Fixes require a separate request.

## Inputs

**Requested outcome (required).** What the change must achieve, supplied by the requester or
coordinating layer. A direct request is sufficient; no tracker or formal document is required.

**Acceptance intent (required).** How success would be recognized, at the level actually supplied.
If either the requested outcome or the acceptance intent is missing, the verdict is **Blocked**. Do
not reconstruct the requested work from a plan, branch name, tracker item, Git history or the diff
itself.

**Change set (established by the reviewer).** Use a supplied diff, pull request or commit range
when available; otherwise establish the boundary from repository state, such as the working tree
plus the branch against an explicit base. State the inspected boundary and any unexamined areas.
Never imply unexamined code was reviewed.

**Repository context (required for a grounded review).** Relevant guidance, architecture, accepted
decisions, specifications, public contracts, code, tests and verification. Discover them from the
consumer repository; do not assume a stack, layout or build system.

**Execution context.** Repository inspection is required; commands, requester interaction and
scratch writes are optional.

If the change set or the repository evidence needed to judge the change is unavailable, report
**Blocked** with the missing input rather than guessing.

## Independence

Use fresh context that did not author or shape the change, receiving the requested outcome,
acceptance intent and repository access rather than authoring conclusions. Independence is a
desired property, not a required harness mechanism; use available isolation and state any
shared-context assurance limit.

## Fresh-session fallback

If independent context is unavailable, use a fresh session with repository access instead of
reviewing in the authoring context. Pass only:

- the review type and skill to follow: implementation review;
- the requested outcome and acceptance intent;
- any approved plan (actual content or an accessible unambiguous reference), accepted design
  decisions and material constraints, as evidence of agreed intent rather than a requirement to
  reproduce incidental implementation details;
- the change set when supplied as a diff, pull request, commit range or base branch, or enough
  state for the reviewer to establish it;
- how to return the result: findings and verdict reported in the session, no artifact.

Carry no authoring reasoning, conclusions, narrative, hidden state, summarized opinion or
implementer verdict. The reviewer reads this skill, establishes the change-set boundary, inspects
the diff and verifies reported checks independently. Approved plans and accepted decisions are
intent evidence, not review authority.

## Procedure

1. Resolve the requested outcome and acceptance intent from the task inputs.
2. Establish the change-set boundary yourself and state it.
3. Read the changed code in full, plus the repository evidence it implicates: guidance, contracts,
   architecture decisions, documentation obligations, tests and current behavior around the change.
4. Consider verification evidence. Identify the repository-provided checks applicable to the
   change; run or verify them when the environment supports it, record commands and outcomes, and
   report checks that were not run rather than assuming their result.
5. Judge the implementation against the requested outcome and acceptance intent:
   - **correctness and scope** — the change achieves the outcome without unrequested behavior,
     regressions, or missing validation and tests;
   - **compatibility** — repository contracts, architecture, ownership, compatibility and migration
     obligations are respected;
   - **completeness** — applicable documentation, formatting and repository-policy obligations are
     satisfied or explicitly justified;
   - **accidental harm** — unrelated changes, hidden boundary or dependency-direction damage, and
     new illegal states.
6. Consolidate findings from one exhaustive pass. Return one set of material findings rather than a
   stream of minor observations.

Do not reopen accepted architecture or decisions as personal taste. A material conflict with an
accepted decision, a contract or the requested outcome is a finding.

## Findings and severity

Every finding names a concrete location in the change or repository evidence, the requirement it
affects, the impact, and a specific recommendation. Severity describes the reviewer's recommendation
only; it is not a gate, and the requester may knowingly accept a trade-off.

- **Critical** — the change is unsafe or incorrect in a way that should not ship.
- **High** — the requested outcome is not correctly satisfied, or a repository contract is broken.
- **Medium** — material incompleteness or a real defect that is not immediately harmful.
- **Low** — limited impact; optional improvement or preference.

## Verdict

- **Pass** — no actionable findings; the acceptance intent has sufficient evidence.
- **Changes required** — actionable findings remain.
- **Blocked** — the requested outcome, acceptance intent, change set or required evidence is
  unavailable.

## Boundaries

- Report the review in the session. Do not require an artifact; if the requester explicitly wants a
  durable copy, use a location and format they choose.
- Do not fix findings or modify the repository as part of the review.
- Do not start another review automatically after the change; the requester decides whether and when
  to re-review.
- Review completion is evidence for the requester. It does not commit, merge or automatically gate
  anything.
