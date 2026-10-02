---
name: plan-review
description: Reviews whether an implementation plan or approach is executable without material guessing, and flags harmful over-specification separately from genuine gaps. Use when the user asks for a plan review or wants an approach checked before implementation. Findings are advisory; this never authorizes implementation.
---

# Plan Review

Ask: **Can an implementer proceed on the requested outcome without inventing material
product or design behavior — and does the approach over-specify harmless local detail?**

This reviews executability, not design soundness: whether the architecture itself is sound is
owned by the separate `design-review` skill. Findings are advisory recommendations to the
requester. Plan Review does not edit or rewrite the plan and never authorizes implementation.

## Inputs

**Requested outcome (required).** What the work must achieve, as supplied by the requester or a
coordinating layer. A direct request is sufficient; no tracker, issue or formal acceptance
criteria document is required.

**Acceptance intent (required).** How success would be recognized, at the level actually
supplied. Binary acceptance intent is preferred; when it cannot be stated, report that as a
finding rather than inventing criteria.

**Plan or approach (required).** Supplied directly as text or as an accessible plan document
the requester names. Supplied text is sufficient; no persistent plan file, template or fixed
location is required. The plan need not match what would eventually be built exactly — it is a
sufficient aid, not a contract.

**Repository context (required for a grounded review).** Access to the consumer repository's
current reality: relevant code and tests, ownership and contracts, applicable verification
commands and engineering rules. Discover only what the plan implicates. Do not assume a stack,
module layout or build system.

**Execution context.** Inspecting the repository is required; interacting with the requester is
optional; writing scratch files is optional and never required.

If the outcome, acceptance intent or approach cannot be read, report **Unable to assess** with
the missing input rather than reconstructing the plan from conversation memory.

## Independence

Review is most credible when performed with fresh context that did not author or shape the
plan, and that receives the plan plus repository access rather than the authoring session's
conclusions or summary. Treat this as a desired property of the review, not as a required
harness mechanism: perform the review with whatever isolation the active session allows, and
state the assurance limit when the review shares context with the plan's author.

## Procedure

Review these dimensions in one exhaustive pass:

1. **Outcome and acceptance intent** — coherent, unambiguous, and stated at a level an
   implementer can satisfy without guessing; the approach actually targets them.
2. **Approach coherence** — consistent with repository reality, existing mechanisms, ownership
   and current contracts as verified in the repository; no step depends on behavior the
   repository does not have.
3. **Material decisions** — architecture, ownership and source of truth, public or observable
   behavior, compatibility, migration, boundaries and significant scope trade-offs are either
   resolved or explicitly recorded as open. An unresolved material decision that forces guessing
   is a finding.
4. **Verification** — the plan establishes how the result will be checked, or the repository
   already provides applicable checks. Missing verification that hides material risk is a
   finding.
5. **Contradictions and gaps** — internal inconsistency, missing ordering that makes the
   approach unexecutable, or unstated prerequisites.
6. **Over-specification (Advisory)** — prescription of harmless local detail: private helper
   structure, method names, exhaustive file-by-file inventories, routine extraction or control
   flow, and internal test-helper design. Flag this separately from material gaps; it constrains
   the implementer without reducing risk.

Stay within executability. Do not turn Plan Review into a second design contest: if a genuine
unresolved architectural choice blocks execution, report it as a concern and point to the
separate `design-review` skill instead of resolving it here.

## Findings and severity

Every finding names the location in the plan or repository evidence, the impact if not resolved,
and a specific recommendation. Severity is a recommendation to the requester, not a gate; any
trade-off may be knowingly accepted.

- **Blocking** — the reviewer believes implementation should not proceed without resolving this
  concern. The requester may still accept it knowingly.
- **Required** — the plan is materially incomplete or incorrect in a way that does not, by
  itself, require a different architecture.
- **Advisory** — optional improvement, wording, preference, or over-specification of harmless
  local detail. An Advisory finding never implies stopping.

## Assessment

- **Unable to assess** — a required input or repository evidence is missing or ambiguous.
- **Concerns found** — at least one material Blocking or Required concern remains.
- **No material concerns** — otherwise; Advisory findings may remain.

## Boundaries

- Report the review in the session. Do not require an artifact; if the requester explicitly
  wants a durable copy, use a location and format they choose.
- Do not modify the plan, design or repository as part of the review.
- Do not start another review automatically after the plan changes; the requester decides
  whether and when to re-review.
- Review completion is not implementation authorization. Implementation requires separate
  explicit authorization from the requester or coordinating layer.
