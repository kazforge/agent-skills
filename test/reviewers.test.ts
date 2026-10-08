import assert from "node:assert/strict"
import test from "node:test"

import { Agent, Skill } from "@opencode/plugin"
import { Session } from "@opencode/schema"

import {
  applyReviewerAgents,
  readCoreSkills,
  reviewContract,
  reviewerAgents,
  reviewerPermissions,
  startReview,
  type AgentEditor,
  type PermissionRule,
  type ReviewContext,
  type ReviewInvocation,
  type ReviewerAgent,
} from "../index.ts"

type AgentDraft = Parameters<Parameters<AgentEditor["update"]>[1]>[0]

/** The registered reviewer agents, readable by ID. */
function registerReviewers(skills = readCoreSkills()): Map<string, AgentDraft> {
  const agents = new Map<string, AgentDraft>()
  const editor: AgentEditor = {
    list: () => [...agents.values()],
    get: (id) => agents.get(id),
    default: () => {},
    update: (id, update) => {
      // OpenCode inserts a missing agent from the default template first.
      const agent = agents.get(id) ?? (Agent.Info.default(Agent.ID.make(id)) as AgentDraft)
      agents.set(id, agent)
      update(agent)
      agent.id = Agent.ID.make(id)
    },
    remove: (id) => void agents.delete(id),
  }
  applyReviewerAgents(editor, skills)
  return agents
}

/** Approximate OpenCode's action/resource matching for the patterns used here. */
function matches(pattern: string, value: string): boolean {
  const escaped = pattern.replace(/[|\\{}()[\]^$+?.]/g, "\\$&")
  return new RegExp(`^${escaped.replaceAll("*", ".*")}$`).test(value)
}

/** The effective rule for an action, using OpenCode's last-match-wins ordering. */
function effectFor(agent: AgentDraft, action: string, resource: string): string | undefined {
  const rules = agent.permissions as readonly PermissionRule[]
  return rules
    .filter((rule) => matches(rule.action, action) && matches(rule.resource, resource))
    .at(-1)?.effect
}

interface ReviewHarness {
  readonly context: ReviewContext
  readonly created: Array<{
    parentID: string
    agent: string
    title: string
    permissions: readonly PermissionRule[]
  }>
  readonly delivered: Array<{ sessionID: string; contract: ReturnType<typeof reviewContract> }>
  readonly notices: Array<{ sessionID: string; text: string; description: string }>
}

/** Record the reviewer handoff without a running OpenCode. */
function reviewHarness(overrides: Partial<ReviewContext> = {}): ReviewHarness {
  const created: ReviewHarness["created"] = []
  const delivered: ReviewHarness["delivered"] = []
  const notices: ReviewHarness["notices"] = []
  const context: ReviewContext = {
    available: async () => true,
    create: async (input) => {
      created.push(input)
      return { id: "ses_reviewer" }
    },
    deliver: async (input) => void delivered.push(input),
    notice: async (sessionID, text, description) => void notices.push({ sessionID, text, description }),
    ...overrides,
  }
  return { context, created, delivered, notices }
}

function reviewerFor(workflow: string): ReviewerAgent {
  const reviewer = reviewerAgents.find((candidate) => candidate.workflow === workflow)
  assert.ok(reviewer, `${workflow} reviewer exists`)
  return reviewer
}

function designInvocation(): ReviewInvocation {
  return {
    sessionID: Session.ID.make("ses_author"),
    prompt: {
      text: "Review the attached design against the repository.",
      files: [{ uri: "file:///design.md", name: "design.md" }],
      agents: [{ name: "build" }],
      skills: [{ id: Skill.ID.make("implementation-planning") }],
    },
  }
}

test("reviewer agents use stable KazForge IDs for the three review workflows", () => {
  assert.deepEqual(
    reviewerAgents.map((reviewer) => reviewer.workflow).sort(),
    ["design-review", "implementation-review", "plan-review"],
  )
  assert.deepEqual(
    reviewerAgents.map((reviewer) => reviewer.agentId).sort(),
    [
      "kazforge-design-reviewer",
      "kazforge-implementation-reviewer",
      "kazforge-plan-reviewer",
    ],
  )
  for (const reviewer of reviewerAgents) {
    assert.match(reviewer.agentId, /^kazforge-[a-z0-9-]+$/)
    assert.ok(reviewer.name.length > 0)
  }
})

test("reviewers register as subagents with skill descriptions and no explicit model", () => {
  const skills = readCoreSkills()
  const agents = registerReviewers(skills)

  for (const reviewer of reviewerAgents) {
    const agent = agents.get(reviewer.agentId)
    assert.ok(agent, `${reviewer.agentId} is registered`)

    assert.equal(agent.name, reviewer.name)
    assert.equal(agent.mode, "subagent")
    assert.equal(agent.hidden, false)
    assert.equal(agent.model, undefined, `${reviewer.agentId} keeps model inheritance`)
    assert.equal(
      agent.description,
      skills.find((skill) => skill.id === reviewer.workflow)?.description,
    )
  }
})

test("reviewers inspect the repository but cannot mutate or reach external systems", () => {
  const agents = registerReviewers()

  for (const reviewer of reviewerAgents) {
    const agent = agents.get(reviewer.agentId)
    assert.ok(agent)

    // Repository inspection is allowed.
    assert.equal(effectFor(agent, "read", "src/index.ts"), "allow")
    assert.equal(effectFor(agent, "grep", "**/*.ts"), "allow")
    assert.equal(effectFor(agent, "glob", "**/*.ts"), "allow")
    assert.equal(effectFor(agent, "read", ".env.example"), "allow")

    // Mutation, delegation and external systems are denied by default.
    assert.equal(effectFor(agent, "edit", "src/index.ts"), "deny")
    assert.equal(effectFor(agent, "question", "*"), "deny")
    assert.equal(effectFor(agent, "subagent", "explore"), "deny")
    assert.equal(effectFor(agent, "webfetch", "https://example.com"), "deny")
    assert.equal(effectFor(agent, "websearch", "query"), "deny")
    assert.equal(effectFor(agent, "browser", "*"), "deny")
    assert.equal(effectFor(agent, "external_directory", "/tmp/elsewhere"), "deny")
    assert.equal(effectFor(agent, "linear.create_issue", "*"), "deny")

    // Secrets stay denied even though repository reads are allowed.
    assert.equal(effectFor(agent, "read", ".env"), "deny")
    assert.equal(effectFor(agent, "read", "config/.env.local"), "deny")

    if (reviewer.profile === "read-only") {
      assert.equal(effectFor(agent, "shell", "npm test"), "deny")
    } else {
      assert.equal(effectFor(agent, "shell", "npm test"), "ask")
    }
  }
})

test("a review starts in a child reviewer session with only the review contract", async () => {
  const reviewer = reviewerFor("design-review")
  const harness = reviewHarness()
  const invocation = designInvocation()

  const outcome = await startReview(harness.context, reviewer, invocation)

  assert.equal(outcome, "reviewer")
  assert.deepEqual(harness.created, [
    {
      parentID: "ses_author",
      agent: "kazforge-design-reviewer",
      title: "Design Review",
      permissions: reviewerPermissions(reviewer),
    },
  ])
  assert.equal(harness.delivered.length, 1)
  assert.deepEqual(harness.delivered[0], {
    sessionID: "ses_reviewer",
    contract: {
      text: "Review the attached design against the repository.",
      files: [{ uri: "file:///design.md", name: "design.md" }],
      skills: ["design-review"],
    },
  })
  // The stray agent mention and the requester's other skill selection are not carried.
  assert.ok(!("agents" in harness.delivered[0].contract))
  assert.equal(harness.notices.length, 1)
  assert.match(harness.notices[0].text, /Design Reviewer/)
  assert.match(harness.notices[0].text, /ses_reviewer/)
})

test("pinned session rules keep the reviewer profile against wider host rules", () => {
  const reviewer = reviewerFor("design-review")
  const registered = registerReviewers().get(reviewer.agentId)
  assert.ok(registered)

  // OpenCode appends host-wide configuration rules to every agent and
  // evaluates the last matching rule, so a host "allow everything" rule would
  // otherwise widen the reviewer. Session rules merge after agent rules.
  const withHostRules = {
    ...registered,
    permissions: [
      ...registered.permissions,
      { action: "*", resource: "*", effect: "allow" as const },
      ...reviewerPermissions(reviewer),
    ],
  }

  assert.equal(effectFor(withHostRules, "edit", "src/index.ts"), "deny")
  assert.equal(effectFor(withHostRules, "shell", "npm test"), "deny")
  assert.equal(effectFor(withHostRules, "read", "src/index.ts"), "allow")
  assert.equal(effectFor(withHostRules, "read", ".env"), "deny")
})

test("an unavailable reviewer agent falls back without reviewing in the authoring session", async () => {
  const reviewer = reviewerFor("plan-review")
  const harness = reviewHarness({ available: async () => false })

  const outcome = await startReview(harness.context, reviewer, designInvocation())

  assert.equal(outcome, "fallback")
  assert.deepEqual(harness.created, [])
  assert.deepEqual(harness.delivered, [])
  assert.equal(harness.notices.length, 1)
  assert.equal(harness.notices[0].sessionID, "ses_author")
  assert.match(harness.notices[0].text, /Plan Review was not started/)
  assert.match(harness.notices[0].text, /fresh OpenCode session/)
  assert.match(harness.notices[0].text, /plan-review skill's fresh-session fallback/)
})

test("a reviewer session that cannot be created falls back instead of self-reviewing", async () => {
  const reviewer = reviewerFor("design-review")
  const harness = reviewHarness({
    create: async () => {
      throw new Error("session create failed")
    },
  })

  const outcome = await startReview(harness.context, reviewer, designInvocation())

  assert.equal(outcome, "fallback")
  assert.deepEqual(harness.delivered, [])
  assert.equal(harness.notices.length, 1)
  assert.match(harness.notices[0].text, /session create failed/)
  assert.match(harness.notices[0].text, /The review was not performed in this session/)
})

test("a review contract that cannot be delivered falls back instead of self-reviewing", async () => {
  const reviewer = reviewerFor("implementation-review")
  const harness = reviewHarness({
    deliver: async () => {
      throw new Error("prompt rejected")
    },
  })

  const outcome = await startReview(harness.context, reviewer, designInvocation())

  assert.equal(outcome, "fallback")
  assert.equal(harness.created.length, 1)
  assert.equal(harness.notices.length, 1)
  assert.match(harness.notices[0].text, /prompt rejected/)
})

test("the review contract drops authoring context and keeps the review skill", () => {
  const reviewer = reviewerFor("implementation-review")
  const contract = reviewContract(reviewer, designInvocation().prompt)

  assert.deepEqual(contract, {
    text: "Review the attached design against the repository.",
    files: [{ uri: "file:///design.md", name: "design.md" }],
    skills: ["implementation-review"],
  })
})
