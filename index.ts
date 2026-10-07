import { Plugin } from "@opencode/plugin"

/**
 * OpenCode plugin entrypoint for Agent Skills Core.
 *
 * This file establishes the package and runtime boundary only. The reusable
 * workflow contracts stay in `skills/<name>/SKILL.md` and are not reimplemented
 * here. Exposing those workflows through OpenCode commands and reviewer agents
 * is tracked separately (KAZ-196 / KAZ-197).
 */
export default Plugin.define({
  id: "kazforge.agent-skills",
  setup() {
    // Intentionally empty: no commands, agents, tools or hooks yet.
  },
})
