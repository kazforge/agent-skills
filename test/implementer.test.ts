import assert from "node:assert/strict"
import test from "node:test"
import { Agent } from "@opencode/plugin"
import { Session } from "@opencode/schema"
import {
  applyReviewerAgents, applyReviewerPermissionPolicy, coreCommands,
  implementationCoordinatorPrompt, readCoreSkills, readPackagedAgents,
  type AgentEditor, type PermissionRule,
} from "../index.ts"

type Draft = Parameters<Parameters<AgentEditor["update"]>[1]>[0]

test("the implementer loads its Markdown instructions without replacing native model routing", () => {
  const declaration = readPackagedAgents()["kazforge-implementer"]
  const draft = Agent.Info.default(Agent.ID.make("kazforge-implementer")) as Draft
  const model = { providerID: "test", model: "configured" } as unknown as Draft["model"]
  draft.model = model
  const editor = { update: (_id: string, update: (agent: Draft) => void) => update(draft) } as AgentEditor
  applyReviewerAgents(editor, { "kazforge-implementer": declaration }, { "kazforge-implementer": "Worker" })
  assert.equal(draft.mode, "subagent")
  assert.equal(draft.model, model)
  assert.equal(draft.system, declaration.system)
  assert.match(draft.system!, /Load and follow the implementation/)
  assert.match(draft.system!, /return Blocked/)
  assert.match(draft.system!, /initial Git boundary/)
  assert.equal(declaration.system!.includes("model:"), false)
})

function effect(rules: readonly PermissionRule[], action: string, resource: string) {
  const match = (pattern: string, value: string) =>
    new RegExp(`^${pattern.replace(/[|\\{}()[\]^$+?.]/g, "\\$&").replaceAll("*", ".*")}$`).test(value)
  return rules.filter(rule => match(rule.action, action) && match(rule.resource, resource)).at(-1)?.effect
}

test("the worker can edit and verify but cannot delegate or mutate external systems", () => {
  const rules = readPackagedAgents()["kazforge-implementer"].permissions
  assert.equal(effect(rules, "edit", "src/index.ts"), "allow")
  assert.equal(effect(rules, "read", "src/index.ts"), "allow")
  assert.equal(effect(rules, "shell", "npm test"), "ask")
  for (const command of ["git commit -m change", "git push origin main", "git merge main"]) {
    assert.equal(effect(rules, "shell", command), "deny")
  }
  for (const action of ["subagent", "github_create_pull_request", "linear_save_issue"]) {
    assert.equal(effect(rules, action, "*"), "deny")
  }
  assert.equal(effect(rules, "read", "config/.env.local"), "deny")
  assert.equal(effect(rules, "edit", ".env"), "deny")
  assert.equal(effect(rules, "read", ".env.example"), "allow")
  assert.equal(effect(rules, "external_directory", "/outside/*"), "ask")
})

test("saved shell grants do not remove the worker's approval requirement", async () => {
  const evaluation = { sessionID: "ses_worker", action: "shell", effect: "allow" as const }
  await applyReviewerPermissionPolicy(evaluation, async () => "kazforge-implementer")
  assert.equal(evaluation.effect, "ask")
})

test("the implementation command coordinates a complete handoff and preserves attachments and delivery", async () => {
  const sent: unknown[] = []
  const commands = coreCommands(readCoreSkills(), {
    prompt: async input => { sent.push(input) },
    review: async () => { assert.fail("implementation does not start review through command dispatch") },
  })
  const request = "Implement the approved change. Literal $ARGUMENTS and $& stay intact."
  const files = [{ uri: "file:///approved-plan.md" }]
  await commands.find(command => command.name === "implementation")!.execute({
    sessionID: Session.ID.make("ses_parent"), prompt: { text: request, files }, delivery: "queue",
  })
  assert.equal(sent.length, 1)
  const input = sent[0] as { text: string; files: unknown; delivery: string; sessionID: string }
  assert.equal(input.text, implementationCoordinatorPrompt(request))
  assert.ok(input.text.endsWith(request))
  assert.deepEqual(input.files, files)
  assert.equal(input.delivery, "queue")
  assert.equal(input.sessionID, "ses_parent")
  for (const required of ["acceptance intent", "actual supplied plan content", "accepted design decisions",
    "material constraints", "repository evidence", "pre-existing changes", "explicitly authorize",
    "native subagent tool", "kazforge-implementer", "Do not hardcode a model",
    "do not implement here as fallback", "must switch agents", "not the child's reasoning"]) {
    assert.ok(input.text.includes(required), required)
  }
})

test("planning and review completion do not select the implementation worker", async () => {
  const prompts: string[] = []
  const reviews: string[] = []
  const commands = coreCommands(readCoreSkills(), {
    prompt: async input => { prompts.push(input.text ?? "") },
    review: async workflow => { reviews.push(workflow) },
  })
  for (const name of ["implementation-planning", "design-review", "plan-review"]) {
    await commands.find(command => command.name === name)!.execute({
      sessionID: Session.ID.make("ses_parent"), prompt: { text: "approved" }, delivery: "steer",
    })
  }
  assert.deepEqual(prompts, ["approved"])
  assert.deepEqual(reviews, ["design-review", "plan-review"])
})
