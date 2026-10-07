import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import { Plugin, Skill } from "@opencode/plugin"

/**
 * OpenCode plugin entrypoint for Agent Skills Core.
 *
 * This file owns OpenCode mechanics only: it registers the Core workflow
 * contracts from `skills/<name>/SKILL.md` as plugin-provided skills and exposes
 * each one as an OpenCode-native command that selects that skill. The workflow
 * semantics stay in the skill files and are not reimplemented here. Reviewer
 * agents and per-reviewer model routing are tracked separately (KAZ-197 and
 * KAZ-198).
 */

interface CoreWorkflow {
  readonly id: string
  readonly description: string
}

/**
 * Command names deliberately match the skill IDs. OpenCode keeps one command
 * registry shared by config files and plugins, where a later definition
 * replaces an earlier same-named command, so the collection avoids generic
 * names such as `plan` or `review` that other sources are likely to define.
 */
const coreWorkflows: readonly CoreWorkflow[] = [
  {
    id: "implementation-planning",
    description: "Plan a requested outcome as one coherent increment.",
  },
  {
    id: "design-review",
    description: "Challenge a proposed design before planning or implementation.",
  },
  {
    id: "plan-review",
    description: "Check whether an implementation approach is executable.",
  },
  {
    id: "implementation",
    description: "Implement a requested outcome as the smallest coherent change.",
  },
  {
    id: "implementation-review",
    description: "Review a completed change-set against the requested outcome.",
  },
]

const skillsRoot = new URL("skills/", import.meta.url)

export default Plugin.define({
  id: "kazforge.agent-skills",
  async setup(ctx) {
    const skills = coreWorkflows.map((workflow) => readSkill(workflow.id))

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
      for (const workflow of coreWorkflows) {
        editor.add({
          name: workflow.id,
          description: workflow.description,
          execute: async ({ sessionID, prompt, delivery }) => {
            const selected = prompt.skills ?? []
            await ctx.session.prompt({
              ...prompt,
              sessionID,
              skills: selected.some((skill) => skill.id === workflow.id)
                ? selected
                : [...selected, { id: workflow.id }],
              delivery,
            })
          },
        })
      }
    })
  },
})

/** Read a packaged skill contract, keeping its Markdown body as the content. */
function readSkill(id: string): Skill.Info {
  const path = fileURLToPath(new URL(`${id}/SKILL.md`, skillsRoot))
  const { meta, content } = parseFrontmatter(readFileSync(path, "utf8"))
  return {
    id,
    name: meta.name ?? id,
    description: meta.description,
    path,
    content,
  } as Skill.Info
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
