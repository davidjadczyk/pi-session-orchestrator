import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import type { ExtensionAPI, ExtensionContext, ToolDefinition } from "@earendil-works/pi-coding-agent";

import { activeCanonicalBinding } from "../src/binding";
import { LocalStateStore } from "../src/state";
import { registerOrchestratorTools } from "../src/tools";

function fixture(): { store: LocalStateStore; path: string; dispose(): void } {
  const directory = mkdtempSync(join(tmpdir(), "pi-session-orchestrator-tools-"));
  const path = join(directory, "state.json");
  return {
    store: new LocalStateStore(path),
    path,
    dispose: () => rmSync(directory, { recursive: true, force: true }),
  };
}

function context(sessionId: string): ExtensionContext {
  return {
    cwd: process.cwd(),
    sessionManager: { getSessionId: () => sessionId },
    ui: { setStatus: () => undefined },
  } as unknown as ExtensionContext;
}

async function call(tool: ToolDefinition, params: object, ctx: ExtensionContext) {
  return tool.execute("tool-call", params as never, undefined, undefined, ctx);
}

function resultText(result: Awaited<ReturnType<typeof call>>): string {
  const content = result.content[0];
  return content?.type === "text" ? content.text : "";
}

test("orchestrator updates present exactly the requested fresh-state event", async () => {
  const setup = fixture();
  try {
    const tools = new Map<string, ToolDefinition>();
    const indicators: string[][] = [];
    const pi = { registerTool: (tool: ToolDefinition) => tools.set(tool.name, tool) } as unknown as ExtensionAPI;
    registerOrchestratorTools(pi, setup.store, (ctx) => {
      indicators.push(setup.store.consumeRelevantEvents(ctx.sessionManager.getSessionId()).map((event) => event.action ?? event.type));
    });

    await call(tools.get("orchestrator_update")!, { operation: "register-root" }, context("root-1"));

    assert.deepEqual(indicators, [["coordinator_registered"]]);
    assert.deepEqual(setup.store.read().events.map((event) => event.action), ["coordinator_registered"]);
    assert.equal(setup.store.presenceFor("root-1")?.status, "live");
  } finally {
    setup.dispose();
  }
});

test("agent tools register roots, adopt existing sessions, and require target attachment", async () => {
  const setup = fixture();
  try {
    const tools = new Map<string, ToolDefinition>();
    const pi = { registerTool: (tool: ToolDefinition) => tools.set(tool.name, tool) } as unknown as ExtensionAPI;
    registerOrchestratorTools(pi, setup.store);

    const status = tools.get("orchestrator_status");
    const update = tools.get("orchestrator_update");
    const ledger = tools.get("orchestrator_ledger");
    assert.ok(status);
    assert.ok(update);
    assert.ok(ledger);

    const root = context("root-1");
    const registered = await call(update, { operation: "register-root" }, root);
    assert.match(resultText(registered), /root coordinator/);

    const adopted = await call(update, {
      operation: "assign-existing",
      assignments: [{
        sessionId: "11111111-1111-4111-8111-111111111111",
        role: "focused-session",
        objective: "Implement bounded change",
        allowedScope: "src/**",
        worktree: process.cwd(),
      }],
    }, root);
    assert.match(resultText(adopted), /pending assignment/);
    const assignment = setup.store.read().assignments[0];
    assert.equal(assignment?.status, "created");

    const focused = context("11111111-1111-4111-8111-111111111111");
    const pending = await call(status, {}, focused);
    assert.match(resultText(pending), /pendingAttachments/);

    await call(update, { operation: "attach", assignmentId: assignment?.id }, focused);
    await call(update, { operation: "start" }, focused);
    const active = await call(status, {}, focused);
    assert.match(resultText(active), /focused-session/);
    assert.match(resultText(active), /Focused session/);
    assert.match(resultText(active), /presence/);
    const rootLedger = await call(ledger, { limit: 1 }, root);
    assert.match(resultText(rootLedger), /root-1/);
    assert.match(resultText(rootLedger), /assignments/);
  } finally {
    setup.dispose();
  }
});

test("agent adoption rejects abbreviated session IDs without persisting an assignment", async () => {
  const setup = fixture();
  try {
    const tools = new Map<string, ToolDefinition>();
    const pi = { registerTool: (tool: ToolDefinition) => tools.set(tool.name, tool) } as unknown as ExtensionAPI;
    registerOrchestratorTools(pi, setup.store);
    const root = context("root-1");
    await call(tools.get("orchestrator_update")!, { operation: "register-root" }, root);

    const result = await call(tools.get("orchestrator_update")!, {
      operation: "assign-existing",
      assignments: [{
        sessionId: "01a0bc35-ff07-71e1",
        role: "focused-session",
        objective: "Bounded work",
        allowedScope: "src/**",
        worktree: process.cwd(),
      }],
    }, root);

    assert.match(resultText(result), /full canonical Pi session IDs/);
    assert.equal(setup.store.read().assignments.length, 0);
  } finally {
    setup.dispose();
  }
});

test("scope-change tool operations expose revisions and reconciliation state", async () => {
  const setup = fixture();
  try {
    const tools = new Map<string, ToolDefinition>();
    const pi = { registerTool: (tool: ToolDefinition) => tools.set(tool.name, tool) } as unknown as ExtensionAPI;
    registerOrchestratorTools(pi, setup.store);
    const root = context("root-1");
    await call(tools.get("orchestrator_update")!, { operation: "register-root" }, root);
    const assignment = setup.store.createAssignment({
      coordinatorSessionId: "root-1", focusedSessionId: "11111111-1111-4111-8111-111111111111",
      binding: activeCanonicalBinding(process.cwd()), objective: "Bounded work", allowedScope: "src/**",
    });
    const focused = context("11111111-1111-4111-8111-111111111111");
    await call(tools.get("orchestrator_update")!, { operation: "attach", assignmentId: assignment.id }, focused);
    const proposed = await call(tools.get("orchestrator_update")!, {
      operation: "propose-scope-change", scopeRevision: 1, requestedScope: "src/feature/**", reason: "Narrow dependency", evidence: ["dependency map"],
    }, focused);
    assert.match(resultText(proposed), /scope-change proposal/);
    const proposal = setup.store.read().scopeChanges!.proposals[0]!;
    const approved = await call(tools.get("orchestrator_update")!, {
      operation: "approve-scope-change-human", proposalId: proposal.id, scopeRevision: 1,
    }, focused);
    assert.match(resultText(approved), /reconciliation/);
    const status = await call(tools.get("orchestrator_status")!, {}, root);
    assert.match(resultText(status), /"scopeRevision":2/);
    assert.match(resultText(status), /"status":"pending"/);
    const reconciliation = setup.store.read().scopeChanges!.reconciliations[0]!;
    await call(tools.get("orchestrator_update")!, {
      operation: "reconcile-scope-change", reconciliationId: reconciliation.id, scopeRevision: 2,
    }, root);
    assert.equal(setup.store.read().scopeChanges!.reconciliations[0]!.status, "reconciled");
  } finally {
    setup.dispose();
  }
});

test("status reports a child's derived stale presence", async () => {
  const setup = fixture();
  try {
    const tools = new Map<string, ToolDefinition>();
    const pi = { registerTool: (tool: ToolDefinition) => tools.set(tool.name, tool) } as unknown as ExtensionAPI;
    registerOrchestratorTools(pi, setup.store);
    setup.store.registerCoordinator("root-1");
    setup.store.createAssignment({
      coordinatorSessionId: "root-1",
      focusedSessionId: "11111111-1111-4111-8111-111111111111",
      binding: { repository: "/repo/.git", worktree: "/repo" },
      objective: "Bounded work",
      allowedScope: "src/**",
    });
    const persisted = setup.store.read();
    persisted.presence = [{
      sessionId: "11111111-1111-4111-8111-111111111111",
      status: "suspended",
      lastSeenAt: new Date(Date.now() - 31 * 60 * 1000).toISOString(),
      lastShutdownReason: "quit",
    }];
    writeFileSync(setup.path, `${JSON.stringify(persisted)}\n`);

    const status = await call(tools.get("orchestrator_status")!, {}, context("root-1"));
    assert.match(resultText(status), /"status":"stale"/);
  } finally {
    setup.dispose();
  }
});

test("ledger is read-only and bounds every returned collection", async () => {
  const setup = fixture();
  try {
    const tools = new Map<string, ToolDefinition>();
    const pi = { registerTool: (tool: ToolDefinition) => tools.set(tool.name, tool) } as unknown as ExtensionAPI;
    registerOrchestratorTools(pi, setup.store);
    setup.store.registerCoordinator("root-1");
    for (let index = 0; index < 3; index += 1) {
      const sessionId = `11111111-1111-4111-8111-${String(index).padStart(12, "0")}`;
      setup.store.createAssignment({
        coordinatorSessionId: "root-1",
        focusedSessionId: sessionId,
        binding: { repository: "/repo/.git", worktree: "/repo" },
        objective: `Bounded work ${index}`,
        allowedScope: "src/**",
      });
      setup.store.attach(setup.store.read().assignments.at(-1)!.id, sessionId, { repository: "/repo/.git", worktree: "/repo" });
      setup.store.activate(sessionId);
      setup.store.submitHandoff(sessionId, {
        outcome: `Completed ${index}`,
        changedSurfaces: [],
        checks: [],
        risks: [],
      });
      setup.store.observePresence(sessionId, "suspended");
    }
    const before = JSON.stringify(setup.store.read());
    const ledger = await call(tools.get("orchestrator_ledger")!, { limit: 1 }, context("root-1"));
    const payload = JSON.parse(resultText(ledger)) as {
      assignments: { total: number; returned: number; truncated: boolean; items: unknown[] };
      events: { total: number; returned: number; truncated: boolean; items: unknown[] };
      handoffs: { total: number; returned: number; truncated: boolean; items: unknown[] };
      presence: { total: number; returned: number; truncated: boolean; items: unknown[] };
    };
    assert.equal(JSON.stringify(setup.store.read()), before);
    assert.equal(payload.assignments.total, 3);
    assert.equal(payload.assignments.returned, 1);
    assert.equal(payload.assignments.truncated, true);
    assert.equal(payload.assignments.items.length, 1);
    assert.ok(payload.events.total > 1);
    assert.equal(payload.events.returned, 1);
    assert.equal(payload.events.truncated, true);
    assert.equal(payload.events.items.length, 1);
    assert.equal(payload.handoffs.total, 3);
    assert.equal(payload.handoffs.returned, 1);
    assert.equal(payload.handoffs.truncated, true);
    assert.equal(payload.handoffs.items.length, 1);
    assert.equal(payload.presence.total, 3);
    assert.equal(payload.presence.returned, 1);
    assert.equal(payload.presence.truncated, true);
  } finally {
    setup.dispose();
  }
});

test("batch adoption validates all targets before persisting", () => {
  const setup = fixture();
  try {
    setup.store.registerCoordinator("root-1");
    assert.throws(() => setup.store.createAssignments([
      {
        coordinatorSessionId: "root-1",
        focusedSessionId: "focused-1",
        binding: { repository: "/repo/.git", worktree: "/repo" },
        objective: "First",
        allowedScope: "src/**",
      },
      {
        coordinatorSessionId: "root-1",
        focusedSessionId: "focused-1",
        binding: { repository: "/repo/.git", worktree: "/repo" },
        objective: "Duplicate",
        allowedScope: "src/**",
      },
    ]), /pending assignment/);
    assert.equal(setup.store.read().assignments.length, 0);
  } finally {
    setup.dispose();
  }
});
