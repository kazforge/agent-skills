import assert from "node:assert/strict"
import { readdirSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import test from "node:test"

import { Skill } from "@opencode/plugin"
import { Session } from "@opencode/schema"

import { coreCommands, readCoreSkills } from "../index.ts"

const root = new URL("../", import.meta.url)

const coreSkillIds = [
  "implementation-planning",
  "design-review",
  "plan-review",
  "implementation",
  "implementation-review",
] as const

type SendPrompt = Parameters<typeof coreCommands>[1]
type CommandDefinition = ReturnType<typeof coreCommands>[number]
type CommandInvocation = Parameters<CommandDefinition["execute"]>[0]
type PromptInput = Parameters<SendPrompt>[0]

/** Record prompts sent by command adapters. */
function recordPrompts(): { prompts: PromptInput[]; send: SendPrompt } {
  const prompts: PromptInput[] = []
  return { prompts, send: async (input) => void prompts.push(input) }
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
  const commands = coreCommands(readCoreSkills(), async () => {})

  assert.deepEqual(
    commands.map((command) => command.name).sort(),
    [...coreSkillIds].sort(),
  )
})

test("command descriptions come from the skill frontmatter, not the plugin", () => {
  const skills = readCoreSkills()
  const commands = coreCommands(skills, async () => {})

  for (const command of commands) {
    const skill = skills.find((candidate) => candidate.id === command.name)
    assert.ok(skill, `${command.name} has a matching skill`)
    assert.ok(command.description, `${command.name} has a description`)
    assert.equal(command.description, skill.description)
  }
})

test("a command preserves the request and selects its skill", async () => {
  const { prompts, send } = recordPrompts()
  const command = coreCommands(readCoreSkills(), send).find(
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
  assert.equal(prompts[0].text, "KAZ-196")
  assert.deepEqual(prompts[0].files, files)
  assert.equal(prompts[0].sessionID, "ses_test")
  assert.equal(prompts[0].delivery, "queue")
  assert.deepEqual(prompts[0].skills, [
    { id: "design-review" },
    { id: "implementation-planning" },
  ])
})

test("a command does not select its skill twice", async () => {
  const { prompts, send } = recordPrompts()
  const command = coreCommands(readCoreSkills(), send).find(
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

test("plugin commands do not collide with repository command wrappers", () => {
  const wrappers = readdirSync(new URL("commands/", root))
    .filter((file) => file.endsWith(".md"))
    .map((file) => file.slice(0, -".md".length))

  for (const command of coreCommands(readCoreSkills(), async () => {})) {
    assert.ok(
      !wrappers.includes(command.name),
      `${command.name} does not shadow the ${command.name}.md wrapper`,
    )
  }
})
