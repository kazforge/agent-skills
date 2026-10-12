import { readdirSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import matter from "gray-matter"
import { Agent, Plugin, Skill } from "@opencode/plugin"
import { AbsolutePath } from "@opencode/schema"

const coreWorkflowIds = [
  "implementation-planning",
  "design-review",
  "plan-review",
  "implementation",
  "implementation-review",
] as const

const packagedRoot = new URL("./", import.meta.url)

type CommandEditor = Parameters<Parameters<Plugin.Context["command"]["transform"]>[0]>[0]
type CommandDefinition = Parameters<CommandEditor["add"]>[0]
type CommandInvocation = Parameters<CommandDefinition["execute"]>[0]
type SessionPromptInput = Parameters<Plugin.Context["session"]["prompt"]>[0]
type SendPrompt = (input: SessionPromptInput) => Promise<unknown>

export type AgentEditor = Parameters<Parameters<Plugin.Context["agent"]["transform"]>[0]>[0]
export type PermissionRule = Agent.Info["permissions"][number]

export interface ReviewerRole {
  readonly agentId: string
  readonly title: string
}

const reviewerRoles = {
  "design-review": { agentId: "kazforge-design-reviewer", title: "Design Review" },
  "plan-review": { agentId: "kazforge-plan-reviewer", title: "Plan Review" },
  "implementation-review": {
    agentId: "kazforge-implementation-reviewer",
    title: "Implementation Review",
  },
} as const satisfies Record<string, ReviewerRole>

type ReviewerWorkflow = keyof typeof reviewerRoles

const reviewerWorkflows = Object.keys(reviewerRoles) as ReviewerWorkflow[]

const agentIds = Object.fromEntries(
  reviewerWorkflows.map((workflow) => [workflow, reviewerRoles[workflow].agentId]),
) as Record<ReviewerWorkflow, string>

const verificationAgent = "kazforge-implementation-reviewer"

export interface ReviewerAgentDeclaration {
  readonly mode: "subagent" | "primary" | "all"
  readonly hidden?: boolean
  readonly permissions: readonly PermissionRule[]
  readonly system?: string
}

// OpenCode discovers agent Markdown only in configuration roots, not plugin packages.
export function applyReviewerAgents(
  editor: AgentEditor,
  agents: Record<string, ReviewerAgentDeclaration>,
  descriptions: Record<string, string>,
): void {
  for (const [agentID, agent] of Object.entries(agents)) {
    editor.update(agentID, (draft) => {
      draft.description = descriptions[agentID]
      draft.mode = agent.mode
      draft.hidden = agent.hidden ?? false
      if (agent.system) draft.system = agent.system
      draft.permissions.push(...agent.permissions)
    })
  }
}

export interface ReviewerPermissionEvaluation {
  readonly sessionID?: string
  readonly agent?: string
  readonly action: string
  readonly resources?: readonly string[]
  effect: PermissionRule["effect"]
  message?: string
}

// Saved project grants are evaluated after session rules, so force worker/reviewer shell
// access back to explicit approval. Hard denies are resolved before saved grants.
export function reviewerPermissionPolicy(evaluation: ReviewerPermissionEvaluation): void {
  if (evaluation.agent !== verificationAgent && evaluation.agent !== "kazforge-implementer") return
  if (evaluation.action !== "shell") return
  if (evaluation.effect !== "allow") return
  evaluation.effect = "ask"
  evaluation.message = "Implementation and review shell commands require explicit approval."
}

// Not every evaluation names the executing agent; some supply only a session ID.
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

export interface ReviewContract {
  readonly text: string
  readonly files?: CommandInvocation["prompt"]["files"]
  readonly skills: readonly string[]
}

export interface ReviewInvocation {
  readonly sessionID: CommandInvocation["sessionID"]
  readonly prompt: CommandInvocation["prompt"]
}

export interface ReviewContext {
  readonly available: (agentId: string) => Promise<boolean>
  /** The reviewer agent's configured model, else the parent session's, else undefined. */
  readonly model: (agentId: string, parentSessionID: string) => Promise<ReviewerModelRef | undefined>
  readonly create: (input: {
    readonly parentID: string
    readonly title: string
    readonly agent: string
    readonly model?: ReviewerModelRef
    readonly permissions: readonly PermissionRule[]
  }) => Promise<{ readonly id: string }>
  readonly deliver: (input: {
    readonly sessionID: string
    readonly contract: ReviewContract
  }) => Promise<unknown>
  /** Display a notice without prompting the session's agent. */
  readonly notice: (sessionID: string, text: string, description: string) => Promise<unknown>
}

export interface ReviewerAgentLookup {
  readonly model?: ReviewerModelRef
}

/** Native model reference as carried by agent and session configuration. */
export interface ReviewerModelRef {
  readonly providerID: string
  readonly id: string
  readonly variant?: string
}

// Programmatic session creation does not apply the agent's configured model or inherit the
// parent session's model, so resolve it explicitly for the reviewer child session.
export async function resolveReviewerModel(
  getAgent: (agentID: string) => Promise<ReviewerAgentLookup | undefined>,
  getSession: (sessionID: string) => Promise<ReviewerAgentLookup | undefined>,
  agentId: string,
  parentSessionID: string,
): Promise<ReviewerModelRef | undefined> {
  const reviewer = await getAgent(agentId).catch(() => undefined)
  if (reviewer?.model !== undefined) return reviewer.model
  const parent = await getSession(parentSessionID).catch(() => undefined)
  return parent?.model
}

export async function startReview(
  context: ReviewContext,
  workflow: string,
  invocation: ReviewInvocation,
): Promise<"reviewer" | "fallback"> {
  const role = reviewerRoles[workflow as ReviewerWorkflow]
  if (role === undefined) {
    await context.notice(
      invocation.sessionID,
      reviewFallbackNotice(workflow, workflow, "no reviewer agent is declared for this workflow"),
      `${workflow} not started`,
    )
    return "fallback"
  }

  let available = false
  try {
    available = await context.available(role.agentId)
  } catch {
    available = false
  }
  if (!available) {
    await context.notice(
      invocation.sessionID,
      reviewFallbackNotice(role.title, workflow, "the reviewer agent is not registered"),
      `${role.title} not started`,
    )
    return "fallback"
  }

  let sessionID: string
  try {
    const model = await context.model(role.agentId, invocation.sessionID).catch(() => undefined)
    const session = await context.create({
      parentID: invocation.sessionID,
      title: role.title,
      agent: role.agentId,
      ...(model === undefined ? {} : { model }),
      // Session rules override agent/host rules and replace authoring-session grants.
      permissions: readReviewerAgents()[role.agentId].permissions,
    })
    sessionID = session.id
    await context.deliver({
      sessionID,
      contract: reviewContract(workflow, invocation.prompt),
    })
  } catch (error) {
    await context.notice(
      invocation.sessionID,
      reviewFallbackNotice(role.title, workflow, error instanceof Error ? error.message : String(error)),
      `${role.title} not started`,
    )
    return "fallback"
  }

  // A failed notice must not turn a started review into a fallback.
  await context
    .notice(
      invocation.sessionID,
      `${role.title} is running in an independent context (${role.agentId}): session ${sessionID}.`,
      `${role.title} started`,
    )
    .catch(() => {})

  return "reviewer"
}

// Allowlist the handoff: no authoring history, agent mentions or other selected skills.
export function reviewContract(
  workflow: string,
  prompt: CommandInvocation["prompt"],
): ReviewContract {
  return {
    text: prompt.text,
    files: prompt.files,
    skills: [workflow],
  }
}

function reviewFallbackNotice(title: string, workflow: string, detail: string): string {
  return [
    `${title} was not started because an independent reviewer context is unavailable: ${detail}.`,
    "The review was not performed in this session.",
    `Start a fresh OpenCode session with access to this repository and follow the ${workflow} skill's fresh-session fallback, passing only the review source, the requested outcome and acceptance intent, and how to return the result.`,
  ].join(" ")
}

export interface CommandRuntime {
  readonly prompt: SendPrompt
  readonly review: (workflow: string, invocation: ReviewInvocation) => Promise<unknown>
}

export default Plugin.define({
  id: "kazforge.agent-skills",
  async setup(ctx) {
    const skills = readPackagedSkills()
    const agents = readPackagedAgents()
    const descriptions = Object.fromEntries(
      reviewerWorkflows.flatMap((workflow) => {
        const description = skills.find((skill) => skill.id === workflow)?.description
        return description === undefined ? [] : [[agentIds[workflow], description]]
      }),
    )
    descriptions["kazforge-implementer"] = "Implements an explicitly authorized outcome from a complete approved handoff; returns changes, checks and material blockers to the parent."
    try {
      await ctx.agent.transform((editor) => applyReviewerAgents(editor, agents, descriptions))
    } catch {
      // Keep skills and commands available; startReview checks the live agent registry.
    }

    await ctx.permission.hook("evaluate", (evaluation) =>
      applyReviewerPermissionPolicy(evaluation, async (sessionID) => {
        const session = await ctx.session.get({ sessionID })
        return session.agent
      }),
    )

    await ctx.skill.transform((editor) => {
      for (const skill of skills) {
        if (editor.get(skill.id)) {
          // Refresh directory-sourced copies regardless of load order.
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
      review: (workflow, invocation) =>
        startReview(
          {
            available: async (agent) => {
              try {
                await ctx.agent.get({ agentID: agent })
                return true
              } catch {
                return false
              }
            },
            model: (agent, parentSessionID) => resolveReviewerModel(
              async (agentID) => (await ctx.agent.get({ agentID })).data,
              (sessionID) => ctx.session.get({ sessionID }),
              agent,
              parentSessionID,
            ),
            create: async ({ parentID, title, agent, model, permissions }) => {
              const session = await ctx.session.create({ parentID, agent, title, permissions, model })
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
          workflow,
          invocation,
        ),
    }

    await ctx.command.transform((editor) => {
      for (const command of [...coreCommands(skills, runtime), ...supportCommands(runtime)]) {
        editor.add(command)
      }
    })
  },
})

export function readCoreSkills(): Skill.Info[] {
  return coreWorkflowIds.map((id) => readSkill(id))
}

export function readPackagedSkills(): Skill.Info[] {
  return readdirSync(new URL("skills/", packagedRoot), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((entry) => readSkill(entry.name))
}

// Packaged support wrappers only need their literal prompt and $ARGUMENTS.
// This is not a general OpenCode command-template interpreter.
export function supportCommands(runtime: CommandRuntime): CommandDefinition[] {
  return readdirSync(new URL("commands/", packagedRoot))
    .filter((file) => file.endsWith(".md"))
    .sort()
    .map((file) => {
      const { data, content } = matter(
        readFileSync(new URL(`commands/${file}`, packagedRoot), "utf8"),
      )
      const template = content.trim()
      const id = file.slice(0, -3)
      return {
        name: id,
        description: data.description,
        execute: async ({ sessionID, prompt, delivery }) => {
          const text = template.includes("$ARGUMENTS")
            ? template.replaceAll("$ARGUMENTS", () => prompt.text)
            : [template, prompt.text].filter(Boolean).join("\n\n")
          const selected = prompt.skills ?? []
          await runtime.prompt({
            ...prompt, sessionID, text, delivery,
            skills: selected.some((candidate) => candidate.id === id)
              ? selected
              : [...selected, { id }],
          })
        },
      }
    })
}

export function coreCommands(
  skills: readonly Skill.Info[],
  runtime: CommandRuntime,
): CommandDefinition[] {
  return coreWorkflowIds.map((id) => {
    const skill = skills.find((candidate) => candidate.id === id)
    const reviewer = reviewerRoles[id as keyof typeof reviewerRoles]
    return {
      name: id,
      description: skill?.description,
      execute: async ({ sessionID, prompt, delivery }) => {
        if (reviewer) {
          await runtime.review(id, { sessionID, prompt })
          return
        }
        const selected = prompt.skills ?? []
        await runtime.prompt({
          ...prompt,
          sessionID,
          text: id === "implementation" ? implementationCoordinatorPrompt(prompt.text) : prompt.text,
          skills: selected.some((candidate) => candidate.id === id)
            ? selected
            : [...selected, { id }],
          delivery,
        })
      },
    }
  })
}

export function readReviewerAgents(): Record<string, ReviewerAgentDeclaration> {
  return Object.fromEntries(
    reviewerWorkflows.map((workflow) => [agentIds[workflow], readAgentFile(agentIds[workflow])]),
  )
}

export function readPackagedAgents(): Record<string, ReviewerAgentDeclaration> {
  return {
    ...readReviewerAgents(),
    "kazforge-implementer": readAgentFile("kazforge-implementer"),
  }
}

export function implementationCoordinatorPrompt(request: string): string {
  return `You are the implementation coordinator. Do not author the change in this parent session.
Your first, highest-priority step is the authorization check below; complete it before anything else.

Authorization check. Implementation is authorized when the requester asks for it — an explicit request
to implement, apply, make the change, or go ahead with implementation; invoking this command with a
change to make is such a request. Approving, accepting or praising a plan, design or review; calling
something ready, good or LGTM; declining to give further input; being able to delegate; or a worker
agent existing does not authorize implementation on its own. If the requester withholds authorization
or asks only what implementation would involve, do not act: use the question tool to ask the requester
to authorize implementation, then stop — do not delegate and do not change files.

Only when the check passes, quote the authorizing words, then resolve the outcome and acceptance
intent and display a reviewable handoff carrying:
- the explicit authorization and its scope;
- the outcome and acceptance intent;
- the actual supplied plan content, or an unambiguous accessible reference, never a summary in its place;
- accepted design decisions;
- material constraints;
- relevant repository evidence and location;
- known pre-existing changes;
- optional inputs not supplied;
- the expected completion report.
Do not forward the planning conversation or rejected alternatives. If essential context is missing or
a material choice is unresolved, ask the user before delegating. If this session forbids
implementation, say the user must switch agents; do not bypass that through delegation. If delegation
is unavailable, report the limitation; do not implement here as fallback.

Delegate with the native subagent tool in foreground, agent kazforge-implementer, and the handoff as
its prompt. Do not hardcode a model. If the agent or tool is unavailable, report the limitation.
Material deviations come back for a user decision; do not authorize a revised scope yourself.

On completion, keep the outcome, acceptance intent and agreed decisions for the separate
implementation review, and pass the reported change boundary — not the child's reasoning or
conclusions — for independent inspection. The worker must not start its own review; the parent
follows the implementation skill's bounded review procedure. Commit, push, merge, pull requests and
tracker changes stay separate authorized actions.

Implementation request:
${request}`
}

function readAgentFile(agent: string): ReviewerAgentDeclaration {
  const path = fileURLToPath(new URL(`agents/${agent}.md`, packagedRoot))
  const { data, content } = matter(readFileSync(path, "utf8"))
  return { ...data, system: content.trim() || undefined } as ReviewerAgentDeclaration
}

function readSkill(id: string): Skill.Info {
  const path = fileURLToPath(new URL(`skills/${id}/SKILL.md`, packagedRoot))
  const { data, content } = matter(readFileSync(path, "utf8"))
  return Skill.Info.make({
    id: Skill.ID.make(id),
    name: Skill.Name.make(data.name ?? id),
    description: data.description,
    path: AbsolutePath.make(path),
    content,
  })
}
