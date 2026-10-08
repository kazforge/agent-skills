import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import { Agent, Plugin, Skill } from "@opencode/plugin"
import { AbsolutePath } from "@opencode/schema"

/**
 * OpenCode plugin entrypoint for Agent Skills Core.
 *
 * This file owns OpenCode mechanics only: it registers the Core workflow
 * contracts from `skills/<name>/SKILL.md` as plugin-provided skills, exposes
 * each one as an OpenCode-native command that selects that skill, and registers
 * one reviewer agent per review workflow so reviews can run in an independent
 * context. The workflow semantics stay in the skill files and are not
 * reimplemented here; command descriptions and reviewer agent descriptions are
 * read from the skill frontmatter rather than stored again. Per-reviewer model
 * routing is tracked separately (KAZ-198).
 */

/**
 * Command names deliberately match the skill IDs. OpenCode keeps one command
 * registry shared by config files and plugins, where a later definition
 * replaces an earlier same-named command, so the collection avoids generic
 * names such as `plan` or `review` that other sources are likely to define.
 */
const coreWorkflowIds = [
  "implementation-planning",
  "design-review",
  "plan-review",
  "implementation",
  "implementation-review",
] as const

const skillsRoot = new URL("skills/", import.meta.url)

type CommandEditor = Parameters<Parameters<Plugin.Context["command"]["transform"]>[0]>[0]
type CommandDefinition = Parameters<CommandEditor["add"]>[0]
type CommandInvocation = Parameters<CommandDefinition["execute"]>[0]
type SessionPromptInput = Parameters<Plugin.Context["session"]["prompt"]>[0]
type SendPrompt = (input: SessionPromptInput) => Promise<unknown>

/** The OpenCode agent editor received from `ctx.agent.transform`. */
export type AgentEditor = Parameters<Parameters<Plugin.Context["agent"]["transform"]>[0]>[0]
/** One native OpenCode permission rule. */
export type PermissionRule = Agent.Info["permissions"][number]

/**
 * A plugin-owned reviewer role. The agent ID is stable and namespaced because
 * OpenCode keeps one agent registry shared by every source; KAZ-198 can target
 * these IDs for user-controlled model routing. Reviewer agents intentionally
 * configure no model, so they keep normal OpenCode model inheritance.
 */
export interface ReviewerAgent {
  /** Core review workflow and skill ID this reviewer serves. */
  readonly workflow: string
  /** Stable plugin-owned agent ID. */
  readonly agentId: string
  /** Display name registered in the OpenCode agent registry. */
  readonly name: string
  /** Title for the independent reviewer session. */
  readonly title: string
  /**
   * Permission profile. Read-only reviews may inspect the repository but not
   * run commands; verification reviews may ask the user to run a repository
   * verification command without gaining blanket mutation capability.
   */
  readonly profile: "read-only" | "verification"
}

/**
 * The three review workflows run through dedicated reviewer agents instead of
 * the authoring session. IDs are deliberately prefixed so they cannot collide
 * with consumer-defined agents or built-in OpenCode agents.
 */
export const reviewerAgents: readonly ReviewerAgent[] = [
  {
    workflow: "design-review",
    agentId: "kazforge-design-reviewer",
    name: "Design Reviewer",
    title: "Design Review",
    profile: "read-only",
  },
  {
    workflow: "plan-review",
    agentId: "kazforge-plan-reviewer",
    name: "Plan Reviewer",
    title: "Plan Review",
    profile: "read-only",
  },
  {
    workflow: "implementation-review",
    agentId: "kazforge-implementation-reviewer",
    name: "Implementation Reviewer",
    title: "Implementation Review",
    profile: "verification",
  },
]

/**
 * Register the plugin-owned reviewer agents. `update` inserts a new agent built
 * from OpenCode's default agent template when the ID is unknown, so the
 * reviewer identity and permission profile are applied to the effective agent.
 * Descriptions come from the corresponding skill frontmatter, keeping the
 * review criteria in the skill file as the only source of truth.
 */
export function applyReviewerAgents(editor: AgentEditor, skills: readonly Skill.Info[]): void {
  for (const reviewer of reviewerAgents) {
    const skill = skills.find((candidate) => candidate.id === reviewer.workflow)
    editor.update(reviewer.agentId, (agent) => {
      agent.name = Agent.Name.make(reviewer.name)
      agent.description = skill?.description
      agent.mode = "subagent"
      agent.hidden = false
      agent.permissions.push(...reviewerPermissions(reviewer))
    })
  }
}

/**
 * Native per-agent permission rules for a reviewer. The whitelist starts by
 * denying every action and then allows only repository inspection, so tools,
 * MCP actions and any other external mutation stay denied by default. The
 * implementation reviewer additionally gets `shell: ask`: each
 * repository-provided verification command requires explicit user approval
 * rather than granting command capability.
 */
export function reviewerPermissions(reviewer: ReviewerAgent): PermissionRule[] {
  const rules: PermissionRule[] = [
    { action: "*", resource: "*", effect: "deny" },
    { action: "read", resource: "*", effect: "allow" },
    { action: "grep", resource: "*", effect: "allow" },
    { action: "glob", resource: "*", effect: "allow" },
    { action: "skill", resource: "*", effect: "allow" },
    // Secrets are not review evidence; keep them denied even though reads are allowed.
    { action: "read", resource: "*.env", effect: "deny" },
    { action: "read", resource: "*.env.*", effect: "deny" },
    { action: "read", resource: "*.env.example", effect: "allow" },
  ]
  if (reviewer.profile === "verification") {
    rules.push({ action: "shell", resource: "*", effect: "ask" })
  }
  return rules
}

/**
 * The subset of a native permission evaluation the reviewer policy reads and
 * adjusts. OpenCode passes its full evaluation here; only these fields matter,
 * and `effect` and `message` are mutable by contract.
 */
export interface ReviewerPermissionEvaluation {
  readonly sessionID?: string
  readonly agent?: string
  readonly action: string
  readonly resources?: readonly string[]
  effect: PermissionRule["effect"]
  message?: string
}

/** The reviewer that may request repository verification. */
const verificationReviewer = reviewerAgents.find(
  (reviewer) => reviewer.profile === "verification",
)

/**
 * Native `permission.evaluate` hook policy for the verification reviewer.
 *
 * OpenCode resolves agent and session rules first, then appends saved
 * project-level allow grants, so a saved shell approval would otherwise
 * upgrade the Implementation Reviewer's `shell: ask` to allow. This hook runs
 * after that merge and forces verification shell evaluation back to ask. It is
 * scoped to the reviewer agent and the shell action only; mutation and the
 * read-only reviewers never reach this path because their deny is a hard deny
 * evaluated before saved grants are merged.
 */
export function reviewerPermissionPolicy(evaluation: ReviewerPermissionEvaluation): void {
  if (verificationReviewer === undefined) return
  if (evaluation.agent !== verificationReviewer.agentId) return
  if (evaluation.action !== "shell") return
  if (evaluation.effect !== "allow") return
  evaluation.effect = "ask"
  evaluation.message = "Implementation Reviewer verification commands require explicit approval."
}

/**
 * Apply the reviewer permission policy to a native evaluation. Tool calls pass
 * the executing agent explicitly, but evaluations that name only a session
 * resolve that session's agent first so the policy holds on every path.
 */
export async function applyReviewerPermissionPolicy(
  evaluation: ReviewerPermissionEvaluation,
  resolveSessionAgent: (sessionID: string) => Promise<string | undefined>,
): Promise<void> {
  if (evaluation.agent !== undefined) {
    reviewerPermissionPolicy(evaluation)
    return
  }
  if (evaluation.sessionID === undefined) return

  const agent = await resolveSessionAgent(evaluation.sessionID).catch(() => undefined)
  if (agent === undefined) return

  const decision: ReviewerPermissionEvaluation = {
    agent,
    action: evaluation.action,
    effect: evaluation.effect,
  }
  reviewerPermissionPolicy(decision)
  evaluation.effect = decision.effect
  if (decision.message !== undefined) evaluation.message = decision.message
}

/**
 * The only input a reviewer context receives: the requester's own request and
 * the single Core review skill that defines the review contract. Authoring
 * session history, agent mentions, metadata and any other selected skills are
 * deliberately not carried.
 */
export interface ReviewContract {
  /** The requester's own words: review source, requested outcome, acceptance intent. */
  readonly text: string
  /** Attachments the requester supplied with the request. */
  readonly files?: CommandInvocation["prompt"]["files"]
  /** Core review skills defining the contract; exactly one per review. */
  readonly skills: readonly string[]
}

/** A review workflow invocation from a user-facing command. */
export interface ReviewInvocation {
  readonly sessionID: CommandInvocation["sessionID"]
  readonly prompt: CommandInvocation["prompt"]
}

/**
 * OpenCode mechanics a review workflow needs. Kept as a small injected surface
 * so the handoff can be tested with real types and without a running OpenCode.
 */
export interface ReviewContext {
  /** Whether the plugin-owned reviewer agent is registered in this OpenCode instance. */
  readonly available: (agentId: string) => Promise<boolean>
  /** Create the independent reviewer session as a child of the invoking session. */
  readonly create: (input: {
    readonly parentID: string
    readonly title: string
    readonly agent: string
    /**
     * Session-level rules, merged after the agent's rules and after rules the
     * host may append from global configuration, so they pin the reviewer
     * profile. They also replace any grants saved in the authoring session.
     */
    readonly permissions: readonly PermissionRule[]
  }) => Promise<{ readonly id: string }>
  /** Deliver the review contract to the reviewer session. */
  readonly deliver: (input: {
    readonly sessionID: string
    readonly contract: ReviewContract
  }) => Promise<unknown>
  /** Surface a user-visible notice in a session without prompting its agent. */
  readonly notice: (sessionID: string, text: string, description: string) => Promise<unknown>
}

/**
 * Start a review in its dedicated reviewer context. The reviewer receives only
 * the review contract and repository access through a fresh child session.
 *
 * When the reviewer agent is unavailable, session creation fails or delivery
 * fails, the review is not started in the authoring session: the limitation is
 * surfaced there and the skill's fresh-session fallback applies. This is
 * intentionally not a retry or state machine; it is a single attempt plus an
 * explicit fallback.
 */
export async function startReview(
  context: ReviewContext,
  reviewer: ReviewerAgent,
  invocation: ReviewInvocation,
): Promise<"reviewer" | "fallback"> {
  let available = false
  try {
    available = await context.available(reviewer.agentId)
  } catch {
    available = false
  }
  if (!available) {
    await context.notice(
      invocation.sessionID,
      reviewFallbackNotice(reviewer, "the reviewer agent is not registered"),
      `${reviewer.title} not started`,
    )
    return "fallback"
  }

  let sessionID: string
  try {
    const session = await context.create({
      parentID: invocation.sessionID,
      title: reviewer.title,
      agent: reviewer.agentId,
      // Session rules merge after agent rules and after consumer/global config
      // rules OpenCode appends later, so they pin the reviewer profile; they
      // also replace any grants saved in the authoring session.
      permissions: reviewerPermissions(reviewer),
    })
    sessionID = session.id
    await context.deliver({
      sessionID,
      contract: reviewContract(reviewer, invocation.prompt),
    })
  } catch (error) {
    await context.notice(
      invocation.sessionID,
      reviewFallbackNotice(reviewer, error instanceof Error ? error.message : String(error)),
      `${reviewer.title} not started`,
    )
    return "fallback"
  }

  // Best-effort pointer to the fresh context; a failed notice must not turn a
  // started review into a fallback.
  await context
    .notice(
      invocation.sessionID,
      `${reviewer.title} is running in the independent ${reviewer.name} context: session ${sessionID}.`,
      `${reviewer.title} started`,
    )
    .catch(() => {})

  return "reviewer"
}

/** Build the review contract from the requester's request and one review skill. */
export function reviewContract(
  reviewer: ReviewerAgent,
  prompt: CommandInvocation["prompt"],
): ReviewContract {
  return {
    text: prompt.text,
    files: prompt.files,
    skills: [reviewer.workflow],
  }
}

/** User-visible explanation of why no review ran, with the skill's fallback. */
function reviewFallbackNotice(reviewer: ReviewerAgent, detail: string): string {
  return [
    `${reviewer.title} was not started because an independent reviewer context is unavailable: ${detail}.`,
    "The review was not performed in this session.",
    `Start a fresh OpenCode session with access to this repository and follow the ${reviewer.workflow} skill's fresh-session fallback, passing only the review source, the requested outcome and acceptance intent, and how to return the result.`,
  ].join(" ")
}

/**
 * OpenCode mechanics the command adapters use. Non-review workflows deliver
 * their prompt in the invoking session; review workflows start a dedicated
 * reviewer context instead.
 */
export interface CommandRuntime {
  /** Deliver a prompt in the invoking session. */
  readonly prompt: SendPrompt
  /** Start a review workflow through its dedicated reviewer agent. */
  readonly review: (reviewer: ReviewerAgent, invocation: ReviewInvocation) => Promise<unknown>
}

export default Plugin.define({
  id: "kazforge.agent-skills",
  async setup(ctx) {
    const skills = readCoreSkills()

    try {
      await ctx.agent.transform((editor) => applyReviewerAgents(editor, skills))
    } catch {
      // Keep skills and commands available. Each review checks the live agent
      // registry, so a failed registration surfaces the fresh-session fallback
      // instead of silently degrading into a same-context review.
    }

    // Saved project-level permission grants are appended after agent and
    // session rules and can upgrade `shell: ask` to allow, so the verification
    // reviewer's shell approval is re-asserted after that merge. Evaluations
    // that name only a session are resolved to their agent first.
    await ctx.permission.hook("evaluate", (evaluation) =>
      applyReviewerPermissionPolicy(evaluation, async (sessionID) => {
        const session = await ctx.session.get({ sessionID })
        return session.agent
      }),
    )

    await ctx.skill.transform((editor) => {
      for (const skill of skills) {
        if (editor.get(skill.id)) {
          // A directory-sourced skill with the same ID is already registered
          // (for example through the setup.sh symlinks). Refresh it in place so
          // setup order cannot leave a stale copy behind.
          editor.update(skill.id, (draft) => {
            draft.name = skill.name
            draft.description = skill.description
            draft.path = skill.path
            draft.content = skill.content
          })
          continue
        }
        editor.add(skill)
      }
    })

    const runtime: CommandRuntime = {
      prompt: (input) => ctx.session.prompt(input),
      review: (reviewer, invocation) =>
        startReview(
          {
            available: async (agentId) => {
              try {
                await ctx.agent.get({ agentID: agentId })
                return true
              } catch {
                return false
              }
            },
            create: async ({ parentID, title, agent, permissions }) => {
              const session = await ctx.session.create({ parentID, agent, title, permissions })
              return { id: session.id }
            },
            deliver: async ({ sessionID, contract }) => {
              await ctx.session.prompt({
                sessionID,
                text: contract.text,
                files: contract.files,
                skills: contract.skills.map((id) => ({ id })),
              })
            },
            notice: async (sessionID, text, description) => {
              await ctx.session.synthetic({ sessionID, text, description, resume: false })
            },
          },
          reviewer,
          invocation,
        ),
    }

    await ctx.command.transform((editor) => {
      for (const command of coreCommands(skills, runtime)) {
        editor.add(command)
      }
    })
  },
})

/**
 * Read the Core workflow contracts. The skill file is the single source for the
 * contract body and for the description the command adapter exposes.
 */
export function readCoreSkills(): Skill.Info[] {
  return coreWorkflowIds.map((id) => readSkill(id))
}

/**
 * Thin OpenCode command adapters. Non-review commands select their skill and
 * pass the requester's own request through unchanged, so planning and
 * implementation authorization boundaries stay with the skill contract.
 * Review commands hand the request to their dedicated reviewer agent instead
 * of reviewing in the authoring session.
 */
export function coreCommands(
  skills: readonly Skill.Info[],
  runtime: CommandRuntime,
): CommandDefinition[] {
  return coreWorkflowIds.map((id) => {
    const skill = skills.find((candidate) => candidate.id === id)
    const reviewer = reviewerAgents.find((candidate) => candidate.workflow === id)
    return {
      name: id,
      description: skill?.description,
      execute: async ({ sessionID, prompt, delivery }) => {
        if (reviewer) {
          await runtime.review(reviewer, { sessionID, prompt })
          return
        }
        const selected = prompt.skills ?? []
        await runtime.prompt({
          ...prompt,
          sessionID,
          skills: selected.some((candidate) => candidate.id === id)
            ? selected
            : [...selected, { id }],
          delivery,
        })
      },
    }
  })
}

/** Read a packaged skill contract, keeping its Markdown body as the content. */
function readSkill(id: string): Skill.Info {
  const path = fileURLToPath(new URL(`${id}/SKILL.md`, skillsRoot))
  const { meta, content } = parseFrontmatter(readFileSync(path, "utf8"))
  return Skill.Info.make({
    id: Skill.ID.make(id),
    name: Skill.Name.make(meta.name ?? id),
    description: meta.description,
    path: AbsolutePath.make(path),
    content,
  })
}

const frontmatterPattern = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/

/** Split a skill file into its frontmatter fields and its Markdown body. */
function parseFrontmatter(raw: string): { meta: Record<string, string>; content: string } {
  const match = frontmatterPattern.exec(raw)
  if (!match) return { meta: {}, content: raw }

  const meta: Record<string, string> = {}
  for (const line of match[1].split(/\r?\n/)) {
    const entry = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line)
    if (entry) meta[entry[1]] = entry[2].trim()
  }
  return { meta, content: raw.slice(match[0].length) }
}
