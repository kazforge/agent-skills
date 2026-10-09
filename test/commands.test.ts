import assert from "node:assert/strict"
import { readdirSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import test from "node:test"

import { Skill } from "@opencode/plugin"
import { Session } from "@opencode/schema"

import type { CommandRuntime, ReviewerDeclaration, ReviewInvocation } from "../index.ts"
import { coreCommands, readCoreSkills, reviewers } from "../index.ts"

const root = new URL("../", import.meta.url)

const coreSkillIds = [
  "implementation-planning",
  "design-review",
  "plan-review",
  "implementation",
  "implementation-review",
] as const

type CommandDefinition = ReturnType<typeof coreCommands>[number]
type CommandInvocation = Parameters<CommandDefinition["execute"]>[0]
type PromptInput = Parameters<CommandRuntime["prompt"]>[0]

/** A runtime that records both delivery paths instead of performing them. */
function recordRuntime(): {
  prompts: PromptInput[]
  reviews: Array<{ reviewer: ReviewerDeclaration; invocation: ReviewInvocation }>
  runtime: CommandRuntime
} {
  const prompts: PromptInput[] = []
  const reviews: Array<{ reviewer: ReviewerDeclaration; invocation: ReviewInvocation }> = []
  return {
    prompts,
    reviews,
    runtime: {
      prompt: async (input) => {
        prompts.push(input)
      },
      review: async (reviewer, invocation) => {
        reviews.push({ reviewer, invocation })
      },
    },
  }
}

/** A runtime that swallows both delivery paths, for registration tests. */
function stubRuntime(): CommandRuntime {
  return { prompt: async () => {}, review: async () => {} }
}

test("Core skills are registered from their packaged files without frontmatter", () => {
  const skills = readCoreSkills()

  assert.deepEqual(
    skills.map((skill) => skill.id).sort(),
    [...coreSkillIds].sort(),
  )

  for (const id of coreSkillIds) {
    const skill = skills.find((candidate) => candidate.id === id)
    assert.ok(skill, `${id} is registered`)

    const path = fileURLToPath(new URL(`skills/${id}/SKILL.md`, root))
    const raw = readFileSync(path, "utf8")

    assert.equal(skill.path, path)
    assert.equal(skill.name, id)
    assert.ok(!skill.content.startsWith("---"), `${id} content drops frontmatter`)
    assert.ok(skill.content.includes("# "), `${id} content keeps the Markdown body`)
    assert.ok(
      skill.description && raw.includes(`description: ${skill.description}`),
      `${id} description comes from the skill file`,
    )
  }
})

test("each Core workflow is exposed as a command named after its skill", () => {
  const commands = coreCommands(readCoreSkills(), stubRuntime())

  assert.deepEqual(
    commands.map((command) => command.name).sort(),
    [...coreSkillIds].sort(),
  )
})

test("command descriptions come from the skill frontmatter, not the plugin", () => {
  const skills = readCoreSkills()
  const commands = coreCommands(skills, stubRuntime())

  for (const command of commands) {
    const skill = skills.find((candidate) => candidate.id === command.name)
    assert.ok(skill, `${command.name} has a matching skill`)
    assert.ok(command.description, `${command.name} has a description`)
    assert.equal(command.description, skill.description)
  }
})

test("a non-review command preserves the request and selects its skill", async () => {
  const { prompts, reviews, runtime } = recordRuntime()
  const command = coreCommands(readCoreSkills(), runtime).find(
    (candidate) => candidate.name === "implementation-planning",
  )
  assert.ok(command)

  const files = [{ uri: "file:///notes.md" }]
  const invocation: CommandInvocation = {
    sessionID: Session.ID.make("ses_test"),
    prompt: { text: "KAZ-196", files, skills: [{ id: Skill.ID.make("design-review") }] },
    delivery: "queue",
  }

  await command.execute(invocation)

  assert.equal(prompts.length, 1)
  assert.equal(reviews.length, 0)
  assert.equal(prompts[0].text, "KAZ-196")
  assert.deepEqual(prompts[0].files, files)
  assert.equal(prompts[0].sessionID, "ses_test")
  assert.equal(prompts[0].delivery, "queue")
  assert.deepEqual(prompts[0].skills, [
    { id: "design-review" },
    { id: "implementation-planning" },
  ])
})

test("a non-review command does not select its skill twice", async () => {
  const { prompts, runtime } = recordRuntime()
  const command = coreCommands(readCoreSkills(), runtime).find(
    (candidate) => candidate.name === "implementation",
  )
  assert.ok(command)

  await command.execute({
    sessionID: Session.ID.make("ses_test"),
    prompt: { text: "", skills: [{ id: Skill.ID.make("implementation") }] },
    delivery: "steer",
  })

  assert.deepEqual(prompts[0].skills, [{ id: "implementation" }])
})

test("each review command runs through its dedicated reviewer, not the authoring session", async () => {
  for (const workflow of ["design-review", "plan-review", "implementation-review"] as const) {
    const { prompts, reviews, runtime } = recordRuntime()
    const command = coreCommands(readCoreSkills(), runtime).find(
      (candidate) => candidate.name === workflow,
    )
    assert.ok(command, `${workflow} command exists`)

    const invocation: CommandInvocation = {
      sessionID: Session.ID.make("ses_author"),
      prompt: {
        text: "KAZ-197",
        files: [{ uri: "file:///contract.md" }],
        skills: [{ id: Skill.ID.make("implementation-planning") }],
      },
      delivery: "steer",
    }

    await command.execute(invocation)

    assert.equal(prompts.length, 0, `${workflow} does not prompt the authoring session`)
    assert.equal(reviews.length, 1, `${workflow} starts one reviewer context`)
    assert.equal(reviews[0].reviewer.workflow, workflow)
    assert.equal(reviews[0].reviewer.agentID, reviewers.find((r) => r.workflow === workflow)?.agentID)
    assert.equal(reviews[0].invocation.sessionID, "ses_author")
    assert.deepEqual(reviews[0].invocation.prompt, invocation.prompt)
  }
})

test("plugin commands do not collide with repository command wrappers", () => {
  const wrappers = readdirSync(new URL("commands/", root))
    .filter((file) => file.endsWith(".md"))
    .map((file) => file.slice(0, -".md".length))

  for (const command of coreCommands(readCoreSkills(), stubRuntime())) {
    assert.ok(
      !wrappers.includes(command.name),
      `${command.name} does not shadow the ${command.name}.md wrapper`,
    )
  }
})
