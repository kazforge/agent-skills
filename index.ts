import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import { Plugin, Skill } from "@opencode/plugin"
import { AbsolutePath } from "@opencode/schema"

/**
 * OpenCode plugin entrypoint for Agent Skills Core.
 *
 * This file owns OpenCode mechanics only: it registers the Core workflow
 * contracts from `skills/<name>/SKILL.md` as plugin-provided skills and exposes
 * each one as an OpenCode-native command that selects that skill. The workflow
 * semantics stay in the skill files and are not reimplemented here; command
 * descriptions are read from the skill frontmatter rather than stored again.
 * Reviewer agents and per-reviewer model routing are tracked separately
 * (KAZ-197 and KAZ-198).
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
type PromptInput = Parameters<Plugin.Context["session"]["prompt"]>[0]
type SendPrompt = (input: PromptInput) => Promise<unknown>

export default Plugin.define({
  id: "kazforge.agent-skills",
  async setup(ctx) {
    const skills = readCoreSkills()

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

    await ctx.command.transform((editor) => {
      for (const command of coreCommands(skills, (input) => ctx.session.prompt(input))) {
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
 * Thin OpenCode command adapters. Each command selects its skill and passes the
 * requester's own request through unchanged, so planning and implementation
 * authorization boundaries stay with the skill contract.
 */
export function coreCommands(skills: readonly Skill.Info[], send: SendPrompt): CommandDefinition[] {
  return coreWorkflowIds.map((id) => {
    const skill = skills.find((candidate) => candidate.id === id)
    return {
      name: id,
      description: skill?.description,
      execute: async ({ sessionID, prompt, delivery }) => {
        const selected = prompt.skills ?? []
        await send({
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
