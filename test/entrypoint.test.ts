import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import test from "node:test"

import plugin, { reviewers } from "../index.ts"

const root = new URL("../", import.meta.url)
const pkg = JSON.parse(readFileSync(new URL("package.json", root), "utf8"))

test("default export defines the plugin entrypoint contract", () => {
  assert.equal(typeof plugin, "object")
  assert.equal(plugin.id, "kazforge.agent-skills")
  assert.equal(typeof plugin.setup, "function")
})

test("package root export points to the existing entrypoint", () => {
  const entry = new URL(pkg.exports["."], root)
  assert.ok(existsSync(entry), "entrypoint file exists")
  assert.equal(fileURLToPath(entry), fileURLToPath(new URL("index.ts", root)))
})

test("reviewer declarations are packaged and each review workflow has its skill", () => {
  assert.ok(pkg.files.includes("agents"), "agents directory is packaged")
  assert.ok(existsSync(new URL("agents/reviewers.json", root)), "reviewer declarations exist")
  for (const reviewer of reviewers) {
    assert.ok(
      existsSync(new URL(`skills/${reviewer.workflow}/SKILL.md`, root)),
      `${reviewer.workflow} SKILL.md`,
    )
  }
})

test("reusable workflow skills stay the semantic source and are packaged", () => {
  assert.ok(pkg.files.includes("skills"), "skills directory is packaged")
  for (const id of [
    "implementation-planning",
    "design-review",
    "plan-review",
    "implementation",
    "implementation-review",
  ]) {
    assert.ok(existsSync(new URL(`skills/${id}/SKILL.md`, root)), `${id} SKILL.md`)
  }
})
