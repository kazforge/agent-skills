import assert from "node:assert/strict"
import test from "node:test"

import { Agent, Skill } from "@opencode/plugin"
import { Session } from "@opencode/schema"

import {
  applyReviewerAgents,
  applyReviewerPermissionPolicy,
  readCoreSkills,
  readReviewerAgents,
  reviewContract,
  reviewerPermissionPolicy,
  startReview,
  type AgentEditor,
  type PermissionRule,
  type ReviewContext,
  type ReviewInvocation,
  type ReviewerAgentDeclaration,
} from "../index.ts"

type AgentDraft = Parameters<Parameters<AgentEditor["update"]>[1]>[0]

const agentIds = {
  "design-review": "kazforge-design-reviewer",
  "plan-review": "kazforge-plan-reviewer",
  "implementation-review": "kazforge-implementation-reviewer",
} as const

const workflows = Object.keys(agentIds) as Array<keyof typeof agentIds>
const workflowByAgent = Object.fromEntries(
  workflows.map((workflow) => [agentIds[workflow], workflow]),
) as Record<string, keyof typeof agentIds>

/** The registered reviewer agents, readable by ID. */
function registerReviewers(): Map<string, AgentDraft> {
  const skills = readCoreSkills()
  const agents = readReviewerAgents()
  const registered = new Map<string, AgentDraft>()
  const editor: AgentEditor = {
    list: () => [...registered.values()],
    get: (id) => registered.get(id),
    default: () => {},
    update: (id, update) => {
      // OpenCode inserts a missing agent from the default template first.
      const agent = registered.get(id) ?? (Agent.Info.default(Agent.ID.make(id)) as AgentDraft)
      registered.set(id, agent)
      update(agent)
      agent.id = Agent.ID.make(id)
    },
    remove: (id) => void registered.delete(id),
  }
  applyReviewerAgents(
    editor,
    agents,
    Object.fromEntries(
      workflows.map((workflow) => [
        agentIds[workflow],
        skills.find((skill) => skill.id === workflow)?.description ?? "",
      ]),
    ),
  )
  return registered
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

test("the three review workflows map to their stable KazForge reviewer agent IDs", () => {
  assert.deepEqual(Object.values(agentIds).sort(), [
    "kazforge-design-reviewer",
    "kazforge-implementation-reviewer",
    "kazforge-plan-reviewer",
  ])
  for (const agent of Object.values(agentIds)) {
    assert.match(agent, /^kazforge-[a-z0-9-]+$/)
  }
})

test("reviewer agents are declared as OpenCode agent Markdown and register as subagents", () => {
  const agents = readReviewerAgents()
  const registered = registerReviewers()

  assert.deepEqual(Object.keys(agents).sort(), [...Object.values(agentIds)].sort())

  for (const [workflow, agentID] of Object.entries(agentIds)) {
    const agent = registered.get(agentID)
    assert.ok(agent, `${agentID} is registered`)

    assert.equal(agent.mode, "subagent")
    assert.equal(agent.hidden, false)
    assert.equal(agent.model, undefined, `${agentID} keeps model inheritance`)

    // The description comes from the skill the agent serves, not the agent file.
    assert.equal(
      agent.description,
      readCoreSkills().find((skill) => skill.id === workflow)?.description,
    )
    assert.ok(agent.description && agent.description.length > 0)

    // The registration carries only what the agent file declares.
    const declared = agents[agentID] as ReviewerAgentDeclaration
    assert.deepEqual(agent.permissions.slice(-declared.permissions.length), declared.permissions)
  }
})

test("reviewers inspect the repository but cannot mutate or reach external systems", () => {
  const registered = registerReviewers()

  for (const [workflow, agentID] of Object.entries(agentIds)) {
    const agent = registered.get(agentID)
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

    if (workflow === "implementation-review") {
      assert.equal(effectFor(agent, "shell", "npm test"), "ask")
    } else {
      assert.equal(effectFor(agent, "shell", "npm test"), "deny")
    }
  }
})

test("a review starts in a child reviewer session with only the review contract", async () => {
  const harness = reviewHarness()
  const invocation = designInvocation()

  const outcome = await startReview(harness.context, "design-review", invocation)

  assert.equal(outcome, "reviewer")
  assert.deepEqual(harness.created, [
    {
      parentID: "ses_author",
      agent: "kazforge-design-reviewer",
      title: "Design Review",
      permissions: readReviewerAgents()["kazforge-design-reviewer"].permissions,
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
  assert.match(harness.notices[0].text, /Design Review is running/)
  assert.match(harness.notices[0].text, /ses_reviewer/)
})

test("pinned session rules keep the reviewer profile against wider host rules", () => {
  const agentID = "kazforge-design-reviewer"
  const registered = registerReviewers().get(agentID)
  assert.ok(registered)
  const permissions = readReviewerAgents()["kazforge-design-reviewer"].permissions

  // OpenCode appends host-wide configuration rules to every agent and
  // evaluates the last matching rule, so a host "allow everything" rule would
  // otherwise widen the reviewer. Session rules merge after agent rules.
  const withHostRules = {
    ...registered,
    permissions: [
      ...registered.permissions,
      { action: "*", resource: "*", effect: "allow" as const },
      ...permissions,
    ],
  }

  assert.equal(effectFor(withHostRules, "edit", "src/index.ts"), "deny")
  assert.equal(effectFor(withHostRules, "shell", "npm test"), "deny")
  assert.equal(effectFor(withHostRules, "read", "src/index.ts"), "allow")
  assert.equal(effectFor(withHostRules, "read", ".env"), "deny")
})

test("the permission hook keeps verification shell at ask when a saved allow exists", () => {
  const evaluation = {
    sessionID: "ses_reviewer",
    agent: "kazforge-implementation-reviewer",
    action: "shell",
    resources: ["npm test"],
    // OpenCode has already merged a saved project-level allow and computed allow.
    effect: "allow" as const,
  }

  reviewerPermissionPolicy(evaluation)

  assert.equal(evaluation.effect, "ask")
})

test("the session-aware policy resolves the reviewer agent when only a session is named", async () => {
  const evaluation = {
    sessionID: "ses_reviewer",
    action: "shell",
    resources: ["npm test"],
    effect: "allow" as const,
  }

  await applyReviewerPermissionPolicy(evaluation, async () => "kazforge-implementation-reviewer")

  assert.equal(evaluation.effect, "ask")
})

test("the session-aware policy leaves non-reviewer sessions and resolution failures alone", async () => {
  const otherSession = {
    sessionID: "ses_build",
    action: "shell",
    resources: ["npm test"],
    effect: "allow" as const,
  }
  await applyReviewerPermissionPolicy(otherSession, async () => "build")
  assert.equal(otherSession.effect, "allow")

  const failedLookup = {
    sessionID: "ses_missing",
    action: "shell",
    resources: ["npm test"],
    effect: "allow" as const,
  }
  await applyReviewerPermissionPolicy(failedLookup, async () => {
    throw new Error("session not found")
  })
  assert.equal(failedLookup.effect, "allow")
})

test("the permission hook leaves read-only reviewers, denies and other actions alone", () => {
  const designShell = {
    agent: "kazforge-design-reviewer",
    action: "shell",
    resources: ["npm test"],
    effect: "allow" as const,
  }
  reviewerPermissionPolicy(designShell)
  assert.equal(designShell.effect, "allow")

  const implementationEdit = {
    agent: "kazforge-implementation-reviewer",
    action: "edit",
    resources: ["src/index.ts"],
    effect: "allow" as const,
  }
  reviewerPermissionPolicy(implementationEdit)
  assert.equal(implementationEdit.effect, "allow")

  const alreadyAsked = {
    agent: "kazforge-implementation-reviewer",
    action: "shell",
    resources: ["npm test"],
    effect: "ask" as const,
  }
  reviewerPermissionPolicy(alreadyAsked)
  assert.equal(alreadyAsked.effect, "ask")

  const denied = {
    agent: "kazforge-implementation-reviewer",
    action: "shell",
    resources: ["sudo rm -rf /"],
    effect: "deny" as const,
  }
  reviewerPermissionPolicy(denied)
  assert.equal(denied.effect, "deny")

  const otherAgent = {
    action: "shell",
    resources: ["npm test"],
    effect: "allow" as const,
  }
  reviewerPermissionPolicy(otherAgent)
  assert.equal(otherAgent.effect, "allow")
})

test("an unavailable reviewer agent falls back without reviewing in the authoring session", async () => {
  const harness = reviewHarness({ available: async () => false })

  const outcome = await startReview(harness.context, "plan-review", designInvocation())

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
  const harness = reviewHarness({
    create: async () => {
      throw new Error("session create failed")
    },
  })

  const outcome = await startReview(harness.context, "design-review", designInvocation())

  assert.equal(outcome, "fallback")
  assert.deepEqual(harness.delivered, [])
  assert.equal(harness.notices.length, 1)
  assert.match(harness.notices[0].text, /session create failed/)
  assert.match(harness.notices[0].text, /The review was not performed in this session/)
})

test("a review contract that cannot be delivered falls back instead of self-reviewing", async () => {
  const harness = reviewHarness({
    deliver: async () => {
      throw new Error("prompt rejected")
    },
  })

  const outcome = await startReview(harness.context, "implementation-review", designInvocation())

  assert.equal(outcome, "fallback")
  assert.equal(harness.created.length, 1)
  assert.equal(harness.notices.length, 1)
  assert.match(harness.notices[0].text, /prompt rejected/)
})

test("an undeclared review workflow falls back instead of self-reviewing", async () => {
  const harness = reviewHarness()

  const outcome = await startReview(harness.context, "unmapped-review", designInvocation())

  assert.equal(outcome, "fallback")
  assert.deepEqual(harness.created, [])
  assert.deepEqual(harness.delivered, [])
  assert.equal(harness.notices.length, 1)
  assert.match(harness.notices[0].text, /unmapped-review was not started/)
  assert.match(harness.notices[0].text, /no reviewer agent is declared/)
})

test("the review contract drops authoring context and keeps the review skill", () => {
  const contract = reviewContract("implementation-review", designInvocation().prompt)

  assert.deepEqual(contract, {
    text: "Review the attached design against the repository.",
    files: [{ uri: "file:///design.md", name: "design.md" }],
    skills: ["implementation-review"],
  })
})
