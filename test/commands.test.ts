import assert from "node:assert/strict"
import { readdirSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import test from "node:test"

import plugin from "../index.ts"

const root = new URL("../", import.meta.url)

const coreSkillIds = [
  "implementation-planning",
  "design-review",
  "plan-review",
  "implementation",
  "implementation-review",
] as const

interface PromptInput {
  text: string
  files?: readonly unknown[]
  agents?: readonly unknown[]
  skills?: readonly { id: string }[]
  metadata?: Record<string, unknown>
  delivery?: "steer" | "queue"
}

interface CommandInvocation {
  sessionID: string
  prompt: PromptInput
  delivery: "steer" | "queue"
}

interface RegisteredCommand {
  name: string
  description?: string
  execute(input: CommandInvocation): Promise<void>
}

interface RegisteredSkill {
  id: string
  name: string
  description?: string
  path: string
  content: string
  autoinvoke?: boolean
}

interface SkillEditor {
  list(): readonly RegisteredSkill[]
  get(id: string): RegisteredSkill | undefined
  add(skill: RegisteredSkill): void
  update(id: string, update: (skill: RegisteredSkill) => void): void
  remove(id: string): void
}

interface CommandEditor {
  add(definition: RegisteredCommand): void
}

interface Stub {
  commands: RegisteredCommand[]
  skills: RegisteredSkill[]
  prompts: unknown[]
}

/** Run the plugin against a recording context and return what it registered. */
async function setup(seedSkills: RegisteredSkill[] = []): Promise<Stub> {
  const commands: RegisteredCommand[] = []
  const skills: RegisteredSkill[] = [...seedSkills]
  const prompts: unknown[] = []

  const context = {
    command: {
      transform: async (callback: (editor: CommandEditor) => void) => {
        callback({ add: (definition) => commands.push(definition) })
        return { dispose: async () => {} }
      },
    },
    skill: {
      transform: async (callback: (editor: SkillEditor) => void) => {
        callback({
          list: () => skills,
          get: (id) => skills.find((skill) => skill.id === id),
          add: (skill) => skills.push(skill),
          update: (id, update) => {
            const skill = skills.find((candidate) => candidate.id === id)
            if (skill) update(skill)
          },
          remove: (id) => {
            const index = skills.findIndex((skill) => skill.id === id)
            if (index >= 0) skills.splice(index, 1)
          },
        })
        return { dispose: async () => {} }
      },
    },
    session: {
      prompt: async (input: unknown) => {
        prompts.push(input)
        return input
      },
    },
  }

  await plugin.setup(context as never)
  return { commands, skills, prompts }
}

test("each Core workflow is exposed as a command named after its skill", async () => {
  const { commands } = await setup()

  assert.deepEqual(
    commands.map((command) => command.name).sort(),
    [...coreSkillIds].sort(),
  )
  for (const command of commands) {
    assert.ok(command.description, `${command.name} has a description`)
  }
})

test("a command passes the request through and selects its skill", async () => {
  const { commands, prompts } = await setup()
  const command = commands.find((candidate) => candidate.name === "implementation-planning")
  assert.ok(command)

  const files = [{ uri: "file:///notes.md" }]
  await command.execute({
    sessionID: "ses_test",
    prompt: { text: "KAZ-196", files, skills: [{ id: "design-review" }] },
    delivery: "queue",
  })

  assert.deepEqual(prompts, [
    {
      text: "KAZ-196",
      files,
      skills: [{ id: "design-review" }, { id: "implementation-planning" }],
      sessionID: "ses_test",
      delivery: "queue",
    },
  ])
})

test("a command does not select its skill twice", async () => {
  const { commands, prompts } = await setup()
  const command = commands.find((candidate) => candidate.name === "implementation")
  assert.ok(command)

  await command.execute({
    sessionID: "ses_test",
    prompt: { text: "", skills: [{ id: "implementation" }] },
    delivery: "steer",
  })

  assert.deepEqual(prompts, [
    {
      text: "",
      skills: [{ id: "implementation" }],
      sessionID: "ses_test",
      delivery: "steer",
    },
  ])
})

test("Core skills are registered from their packaged files without frontmatter", async () => {
  const { skills } = await setup()

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

test("an already registered skill is refreshed in place, not duplicated", async () => {
  const { skills } = await setup([
    {
      id: "implementation-planning",
      name: "stale",
      description: "stale",
      path: "/stale/SKILL.md",
      content: "stale",
    },
  ])

  const refreshed = skills.filter((skill) => skill.id === "implementation-planning")
  assert.equal(refreshed.length, 1)
  assert.notEqual(refreshed[0].content, "stale")
})

test("plugin commands do not collide with repository command wrappers", async () => {
  const { commands } = await setup()
  const wrappers = readdirSync(new URL("commands/", root))
    .filter((file) => file.endsWith(".md"))
    .map((file) => file.slice(0, -".md".length))

  for (const command of commands) {
    assert.ok(
      !wrappers.includes(command.name),
      `${command.name} does not shadow the ${command.name}.md wrapper`,
    )
  }
})
