import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdtempSync, mkdirSync, rmSync, symlinkSync } from "node:fs"
import test from "node:test"
import { fileURLToPath } from "node:url"

test("the packed artifact registers every packaged workflow without checkout asset links", () => {
  const scratch = mkdtempSync("/tmp/kaz-199-package-")
  const root = fileURLToPath(new URL("../", import.meta.url))
  try {
    const packed = JSON.parse(execFileSync("npm", [
      "pack", "--ignore-scripts", "--json", "--pack-destination", scratch,
    ], { cwd: root, encoding: "utf8" }))
    // npm releases emit either an array or a package-name-keyed object.
    const output = Object.values(packed)[0] as {
      filename: string
      files: Array<{ path: string }>
    }
    const files = output.files.map((file: { path: string }) => file.path)
    assert.ok(!files.includes("setup.sh"))
    assert.equal(files.filter((path: string) => path.endsWith("/SKILL.md")).length, 9)
    assert.equal(files.filter((path: string) => path.startsWith("commands/")).length, 4)
    assert.equal(files.filter((path: string) => path.startsWith("agents/")).length, 3)

    execFileSync("tar", ["-xzf", `${scratch}/${output.filename}`, "-C", scratch])
    // Dependency resolution only: declarative assets must come from the artifact.
    symlinkSync(`${root}/node_modules`, `${scratch}/package/node_modules`, "junction")
    mkdirSync(`${scratch}/home`)
    const result = JSON.parse(execFileSync(process.execPath, ["--input-type=module", "-e", `
      const { default: plugin } = await import(${JSON.stringify(`file://${scratch}/package/index.ts`)})
      const skills = new Map(), agents = new Map(), commands = new Map()
      await plugin.setup({
        agent: { transform: async f => f({ update: (id, f) => {
          const agent = { permissions: [], model: { providerID: "test", model: "override" } }
          f(agent); agents.set(id, agent)
        } }) },
        permission: { hook: async () => {} },
        skill: { transform: async f => f({ get: id => skills.get(id), add: s => skills.set(s.id, s) }) },
        command: { transform: async f => f({ add: c => commands.set(c.name, c) }) },
        session: {},
      })
      console.log(JSON.stringify({
        skills: [...skills.values()].map(s => ({ id: s.id, path: s.path })),
        commands: [...commands.keys()], agents: [...agents.values()],
      }))
    `], {
      cwd: `${scratch}/home`, encoding: "utf8",
      env: { ...process.env, HOME: `${scratch}/home`, XDG_CONFIG_HOME: `${scratch}/home/config` },
    }))
    assert.equal(result.skills.length, 9)
    assert.equal(result.commands.length, 9)
    assert.equal(result.agents.length, 3)
    for (const skill of result.skills) assert.ok(skill.path.startsWith(`${scratch}/package/skills/`))
    for (const agent of result.agents) assert.deepEqual(agent.model, { providerID: "test", model: "override" })
  } finally {
    rmSync(scratch, { recursive: true, force: true })
  }
})
