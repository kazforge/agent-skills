---
name: design-review
description: Reviews whether a proposed technical design is sound, appropriately simple, compatible with repository architecture and contracts, and preferable to credible simpler alternatives. Use when the user asks for a design review or wants a proposed design challenged before planning or implementation. Findings are advisory; this never authorizes implementation.
---

# Design Review

Ask: **Is the proposed technical design sound, appropriately simple, compatible with the
repository's architecture and contracts, and preferable to credible simpler alternatives?**

Challenge the design, rather than endorse or redesign it. The separate `plan-review` skill
owns executability. Do not create a plan as part of this review.

## Inputs

**Design (required).** The design to review, supplied directly as text or as an accessible
document the requester names. Supplied text is sufficient; no design file, template, tracker
item or fixed path is required. State the reviewed boundary — which design text and which
repository evidence were in scope.

**Requested outcome (recommended).** The outcome and acceptance intent the design is meant to
serve, at the level actually supplied. When it is missing, check internal coherence and
repository compatibility only, and say so.

**Repository context (required for a grounded review).** Access to the consumer repository's
current reality: contributor guidance, architecture and accepted decisions, specifications and
public contracts, affected code and tests, and ownership boundaries. Discover only what this
design implicates. Do not assume a stack, module layout, documentation set or build system.

**Execution context.** Inspecting the repository is required; interacting with the requester is
optional and enables resolving ambiguity; writing scratch files is optional and never required.

If the design cannot be read, or repository evidence needed to judge a design claim is
unavailable, report **Unable to assess** with the missing input rather than inventing a design
from conversation memory.

## Independence

Review is most credible when performed with fresh context that did not author or shape the
design, and that receives the design plus repository access rather than the authoring session's
conclusions or summary. Treat this as a desired property of the review, not as a required
harness mechanism: perform the review with whatever isolation the active session allows, and
state the assurance limit when the review shares context with the design's author.

## Fresh-session fallback

When the active session cannot provide an independent reviewer context, hand the review to a
fresh session instead of reviewing in the authoring context. Start a new session with access
to the consumer repository and pass only:

- the review type and skill to follow: design review;
- the design source: the design text or an accessible document the reviewer can open;
- the requested outcome and acceptance intent, when supplied;
- how to return the result: findings and assessment reported in the session, no artifact.

Carry no authoring-session reasoning, conclusions, narrative, hidden state or summarized review
opinion. The fresh reviewer reads this skill and derives its own conclusions from the design and
repository evidence.

## Procedure

1. Establish the review boundary: design source, requested outcome, repository evidence.
2. Read the full design once before judging any part of it.
3. Map its goal, approach and constraints to the repository reality it must fit.
4. Challenge it, looking especially for:
   - conflict with accepted architecture, contracts or decisions;
   - ownership or source-of-truth ambiguity, and application policy hidden in low-level types;
   - boundary or dependency-direction damage, and public or observable behavior changes whose
     compatibility or migration obligations are unaddressed;
   - types or interfaces that make illegal states representable;
   - accidental complexity, new abstractions that existing mechanisms already cover, and
     unresolved competing approaches left side by side.
5. Give a concrete simpler alternative that still meets the requested outcome, or explain
   specifically why none survives the constraints.
6. Consolidate findings from an exhaustive pass. Return one set of material findings rather
   than a stream of minor observations.

## Findings and severity

Every finding names a concrete location in the design or repository evidence and carries an
impact and a recommendation. Severity describes the reviewer's recommendation only; it is not a
gate, and the requester may knowingly accept any trade-off.

- **Blocking** — the reviewer believes implementation should not proceed without resolving this
  concern.
- **Required** — the design is materially incomplete or incorrect in a way that does not, by
  itself, require a different architecture.
- **Advisory** — optional improvement, simplification, wording or preference. An Advisory
  finding never implies stopping.

## Assessment

- **Unable to assess** — a required input or repository evidence is missing or ambiguous.
- **Concerns found** — at least one material Blocking or Required concern remains.
- **No material concerns** — otherwise; Advisory findings may remain.

## Boundaries

- Report the review in the session. Do not require an artifact; if the requester explicitly
  wants a durable copy, use a location and format they choose.
- Do not modify the design, plan or repository as part of the review.
- Do not start another review automatically after the design changes; the requester decides
  whether and when to re-review.
- Review completion is not implementation authorization. Implementation requires separate
  explicit authorization from the requester or coordinating layer.
