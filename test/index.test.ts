import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";

import sessionOrchestratorExtension, { runCommand } from "../src/index";
import { LocalStateStore } from "../src/state";

function fixture(): { store: LocalStateStore; dispose(): void } {
  const directory = mkdtempSync(join(tmpdir(), "pi-session-orchestrator-index-"));
  return {
    store: new LocalStateStore(join(directory, "state.json")),
    dispose: () => rmSync(directory, { recursive: true, force: true }),
  };
}

test("registers the compatibility command and every discoverable alias", () => {
  const registrations: string[] = [];
  const api = {
    registerCommand: (name: string) => registrations.push(name),
    registerTool: () => undefined,
    on: () => undefined,
  };
  sessionOrchestratorExtension(api as never);
  assert.equal(registrations.filter((name) => name === "orchestrator").length, 1);
  for (const action of ["coordinator", "assign", "attach", "start", "handoff", "accept", "return", "decision", "block", "abandon", "status"]) {
    assert.equal(registrations.filter((name) => name === `orchestrator:${action}`).length, 1);
  }
});

test("coordinator mutations coalesce into one custom entry and unchanged aliases do not duplicate it", async () => {
  const setup = fixture();
  const commands = new Map<string, { handler: (value: string, context: ExtensionCommandContext) => unknown }>();
  const entries: Array<{ type: string; data: unknown }> = [];
  let rendererRegistered = false;
  const notifications: string[] = [];
  try {
    sessionOrchestratorExtension({
      registerCommand: (name: string, command: { handler: (value: string, context: ExtensionCommandContext) => unknown }) => commands.set(name, command),
      registerTool: () => undefined,
      registerEntryRenderer: () => { rendererRegistered = true; },
      appendEntry: (type: string, data: unknown) => entries.push({ type, data }),
      on: () => undefined,
    } as never, setup.store);
    const context = {
      cwd: process.cwd(), mode: "tui", hasUI: true,
      sessionManager: { getSessionId: () => "root-1" },
      ui: { notify: (message: string) => notifications.push(message), setStatus: () => undefined, setWidget: () => undefined },
    } as unknown as ExtensionCommandContext;

    await commands.get("orchestrator")!.handler("coordinator", context);
    await commands.get("orchestrator:coordinator")!.handler("", context);
    assert.equal(rendererRegistered, true);
    assert.equal(entries.length, 1);
    assert.equal((entries[0]?.data as { events: Array<{ action?: string }> }).events[0]?.action, "coordinator_registered");
    assert.equal(notifications.length, 2);
    assert.equal(setup.store.read().events.length, 1);
  } finally {
    setup.dispose();
  }
});

test("renderer absence falls back to a widget and concise notification without a session entry", async () => {
  const setup = fixture();
  let command: ((value: string, context: ExtensionCommandContext) => unknown) | undefined;
  let widgetLines: string[] | undefined;
  const notifications: string[] = [];
  try {
    sessionOrchestratorExtension({
      registerCommand: (name: string, registered: { handler: (value: string, context: ExtensionCommandContext) => unknown }) => {
        if (name === "orchestrator") command = registered.handler;
      },
      registerTool: () => undefined,
      on: () => undefined,
    } as never, setup.store);
    const context = {
      cwd: process.cwd(), mode: "tui", hasUI: true,
      sessionManager: { getSessionId: () => "root-1" },
      ui: {
        notify: (message: string) => notifications.push(message),
        setStatus: () => undefined,
        setWidget: (_key: string, lines: string[]) => { widgetLines = lines; },
      },
    } as unknown as ExtensionCommandContext;
    await command!("coordinator", context);
    assert.deepEqual(widgetLines, ["↳ orchestration · coordinator registered: Coordinator role recorded"]);
    assert.deepEqual(notifications, ["Coordinator role recorded locally.", "Orchestration: 1 new update."]);
  } finally {
    setup.dispose();
  }
});

test("every alias forwards its fixed action and arguments through compatibility behavior", async () => {
  const normalize = (state: ReturnType<LocalStateStore["read"]>) => ({
    ...state,
    events: state.events.map(({ id: _id, createdAt: _createdAt, ...event }) => event),
  });
  const cases = [
    ["coordinator", ""], ["assign", "not-json"], ["attach", ""], ["start", ""],
    ["handoff", "not-json"], ["accept", ""], ["return", ""], ["decision", "not-json"],
    ["block", ""], ["abandon", ""], ["status", ""],
  ] as const;

  for (const [action, args] of cases) {
    const aliasSetup = fixture();
    const compatibilitySetup = fixture();
    const aliasHandlers = new Map<string, (value: string, context: ExtensionCommandContext) => unknown>();
    const aliasNotifications: Array<{ message: string; level: string }> = [];
    const compatibilityNotifications: Array<{ message: string; level: string }> = [];
    const contextFor = (notifications: Array<{ message: string; level: string }>) => ({
      cwd: process.cwd(),
      sessionManager: { getSessionId: () => `alias-${action}` },
      ui: { notify: (message: string, level: string) => notifications.push({ message, level }), setStatus: () => undefined },
    } as unknown as ExtensionCommandContext);
    try {
      sessionOrchestratorExtension({
        registerCommand: (name: string, command: { handler: (value: string, context: ExtensionCommandContext) => unknown }) => {
          if (name.startsWith("orchestrator:")) aliasHandlers.set(name, command.handler);
        },
        registerTool: () => undefined,
        on: () => undefined,
      } as never, aliasSetup.store);
      await aliasHandlers.get(`orchestrator:${action}`)!(args, contextFor(aliasNotifications));
      await runCommand(compatibilitySetup.store, `${action} ${args}`.trim(), contextFor(compatibilityNotifications));
      assert.deepEqual(aliasNotifications, compatibilityNotifications, action);
      assert.deepEqual(normalize(aliasSetup.store.read()), normalize(compatibilitySetup.store.read()), action);
    } finally {
      aliasSetup.dispose();
      compatibilitySetup.dispose();
    }
  }
});

test("every rejecting alias preserves compatibility error behavior", async () => {
  const cases = [
    ["assign", "not-json"], ["attach", ""], ["start", ""], ["handoff", "not-json"],
    ["accept", ""], ["return", ""], ["decision", "not-json"], ["block", ""], ["abandon", ""],
  ] as const;

  for (const [action, args] of cases) {
    const aliasSetup = fixture();
    const compatibilitySetup = fixture();
    const handlers = new Map<string, (value: string, context: ExtensionCommandContext) => unknown>();
    const aliasNotifications: Array<{ message: string; level: string }> = [];
    const compatibilityNotifications: Array<{ message: string; level: string }> = [];
    const contextFor = (notifications: Array<{ message: string; level: string }>) => ({
      cwd: process.cwd(), sessionManager: { getSessionId: () => `invalid-${action}` },
      ui: { notify: (message: string, level: string) => notifications.push({ message, level }), setStatus: () => undefined },
    } as unknown as ExtensionCommandContext);
    try {
      sessionOrchestratorExtension({ registerCommand: (name: string, command: { handler: (value: string, context: ExtensionCommandContext) => unknown }) => {
        if (name === `orchestrator:${action}`) handlers.set(name, command.handler);
      }, registerTool: () => undefined, on: () => undefined } as never, aliasSetup.store);
      await handlers.get(`orchestrator:${action}`)!(args, contextFor(aliasNotifications));
      await runCommand(compatibilitySetup.store, `${action} ${args}`.trim(), contextFor(compatibilityNotifications));
      assert.deepEqual(aliasNotifications, compatibilityNotifications, action);
      assert.deepEqual(aliasSetup.store.read(), compatibilitySetup.store.read(), action);
    } finally {
      aliasSetup.dispose();
      compatibilitySetup.dispose();
    }
  }
});

test("alias and compatibility assign reject the same invalid session ID", async () => {
  const setup = fixture();
  const handlers = new Map<string, (value: string, context: ExtensionCommandContext) => unknown>();
  const aliasNotifications: Array<{ message: string; level: string }> = [];
  const compatibilityNotifications: Array<{ message: string; level: string }> = [];
  const input = '{"focusedSessionId":"short","objective":"Bounded work","allowedScope":"src/**"}';
  const contextFor = (notifications: Array<{ message: string; level: string }>) => ({
    cwd: process.cwd(), sessionManager: { getSessionId: () => "root-1" },
    ui: { notify: (message: string, level: string) => notifications.push({ message, level }), setStatus: () => undefined },
  } as unknown as ExtensionCommandContext);
  try {
    sessionOrchestratorExtension({ registerCommand: (name: string, command: { handler: (value: string, context: ExtensionCommandContext) => unknown }) => {
      if (name === "orchestrator:assign") handlers.set(name, command.handler);
    }, registerTool: () => undefined, on: () => undefined } as never);
    await handlers.get("orchestrator:assign")!(input, contextFor(aliasNotifications));
    setup.store.registerCoordinator("root-1");
    await runCommand(setup.store, `assign ${input}`, contextFor(compatibilityNotifications));
    assert.deepEqual(aliasNotifications, compatibilityNotifications);
  } finally { setup.dispose(); }
});

test("human assign command rejects abbreviated Pi session IDs", async () => {
  const setup = fixture();
  const notifications: Array<{ message: string; level: string }> = [];
  try {
    setup.store.registerCoordinator("root-1");
    const context = {
      cwd: process.cwd(),
      sessionManager: { getSessionId: () => "root-1" },
      ui: {
        notify: (message: string, level: string) => notifications.push({ message, level }),
        setStatus: () => undefined,
      },
    } as unknown as ExtensionCommandContext;

    await runCommand(setup.store, 'assign {"focusedSessionId":"11111111-1111-4111","objective":"Bounded work","allowedScope":"src/**"}', context);

    assert.equal(setup.store.read().assignments.length, 0);
    assert.deepEqual(notifications, [{ message: "assign requires a full canonical Pi session ID", level: "error" }]);
  } finally {
    setup.dispose();
  }
});
