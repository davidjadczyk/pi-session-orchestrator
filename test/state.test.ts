import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import type { Assignment, CanonicalBinding } from "../src/model";
import { LocalStateStore } from "../src/state";

const binding: CanonicalBinding = { repository: "/repos/example/.git", worktree: "/repos/example" };

function temporaryStore(): { store: LocalStateStore; path: string; dispose(): void } {
  const directory = mkdtempSync(join(tmpdir(), "pi-session-orchestrator-"));
  const path = join(directory, "state.json");
  return { store: new LocalStateStore(path), path, dispose: () => rmSync(directory, { recursive: true, force: true }) };
}

type TerminalStatus = "accepted" | "returned" | "blocked" | "abandoned";

function terminalize(fixture: { store: LocalStateStore }, assignment: Assignment, status: TerminalStatus): void {
  if (status === "accepted" || status === "returned") {
    fixture.store.activate(assignment.focusedSessionId);
    fixture.store.submitHandoff(assignment.focusedSessionId, {
      outcome: "Implemented",
      changedSurfaces: ["src/state.ts"],
      checks: [],
      risks: [],
    });
    fixture.store.acceptOrReturn("root-1", assignment.id, status);
    return;
  }
  fixture.store.activate(assignment.focusedSessionId);
  fixture.store.markTerminal(assignment.focusedSessionId, status, "Terminal test state");
}

test("an assignment attaches only to its focused session and matching binding, then persists its handoff lifecycle", () => {
  const fixture = temporaryStore();
  try {
    fixture.store.registerCoordinator("coordinator-1");
    const assignment = fixture.store.createAssignment({
      coordinatorSessionId: "coordinator-1",
      focusedSessionId: "focused-1",
      binding,
      objective: "Implement the bounded change",
      allowedScope: "src/**",
    });

    assert.throws(() => fixture.store.attach(assignment.id, "focused-1", { ...binding, worktree: "/repos/other" }), /binding does not match/);
    assert.equal(fixture.store.getRole("focused-1").kind, "unmanaged");

    fixture.store.attach(assignment.id, "focused-1", binding);
    fixture.store.activate("focused-1");
    const handoff = fixture.store.submitHandoff("focused-1", {
      outcome: "Implemented",
      artifactIdentity: "none",
      changedSurfaces: ["src/state.ts"],
      checks: ["npm test"],
      risks: [],
    });
    assert.equal(fixture.store.read().handoffs[0]?.id, handoff.id);
    assert.equal(fixture.store.read().assignments[0]?.status, "handoff-submitted");

    fixture.store.acceptOrReturn("coordinator-1", assignment.id, "accepted");
    const restored = new LocalStateStore(fixture.path).read();
    assert.equal(restored.assignments[0]?.status, "accepted");
    assert.equal(restored.handoffs[0]?.outcome, "Implemented");
    assert.deepEqual(restored.events.map((event) => event.action), [
      "coordinator_registered", "assignment_created", "assignment_attached", "assignment_started",
      "handoff_submitted", "handoff_accepted",
    ]);
    assert.equal(new LocalStateStore(fixture.path).getRole("focused-1").kind, "focused-session");
  } finally {
    fixture.dispose();
  }
});

test("focused sessions cannot create children but can persist a decision request", () => {
  const fixture = temporaryStore();
  try {
    fixture.store.registerCoordinator("coordinator-1");
    const assignment = fixture.store.createAssignment({
      coordinatorSessionId: "coordinator-1",
      focusedSessionId: "focused-1",
      binding,
      objective: "Focused objective",
      allowedScope: "src/**",
    });
    fixture.store.attach(assignment.id, "focused-1", binding);

    assert.throws(() => fixture.store.createAssignment({
      coordinatorSessionId: "focused-1",
      focusedSessionId: "focused-child",
      binding,
      objective: "Nested objective",
      allowedScope: "src/**",
    }), /Only an explicitly registered coordinator/);

    const decision = fixture.store.decide("focused-1", "Choose sibling scope", {
      options: ["Create sibling", "Keep current scope"],
      recommendation: "Create sibling",
    });
    assert.equal(decision.type, "decision_request");
    assert.equal(fixture.store.read().events[0]?.type, "progress");
    assert.equal(fixture.store.read().events.at(-1)?.type, "decision_request");
  } finally {
    fixture.dispose();
  }
});

test("root coordinators can manage direct focused sessions and one domain coordinator level", () => {
  const fixture = temporaryStore();
  try {
    fixture.store.registerCoordinator("root-1");
    const domain = fixture.store.createAssignment({
      coordinatorSessionId: "root-1",
      focusedSessionId: "domain-1",
      targetRole: "domain-coordinator",
      binding,
      objective: "Coordinate Core work",
      allowedScope: "core/**",
    });
    fixture.store.attach(domain.id, "domain-1", binding);
    fixture.store.registerCoordinator("domain-1");
    assert.equal(fixture.store.getRole("domain-1").kind, "domain-coordinator");

    const focused = fixture.store.createAssignment({
      coordinatorSessionId: "domain-1",
      focusedSessionId: "focused-child-1",
      binding,
      objective: "Implement Core change",
      allowedScope: "core/src/**",
    });
    assert.equal(focused.targetRole, "focused-session");

    assert.throws(() => fixture.store.createAssignment({
      coordinatorSessionId: "domain-1",
      focusedSessionId: "nested-domain-1",
      targetRole: "domain-coordinator",
      binding,
      objective: "Attempt third level",
      allowedScope: "core/**",
    }), /Only a root coordinator/);
  } finally {
    fixture.dispose();
  }
});

test("presence observations derive stale state without changing assignment roles", () => {
  const fixture = temporaryStore();
  try {
    fixture.store.registerCoordinator("root-1");
    const assignment = fixture.store.createAssignment({
      coordinatorSessionId: "root-1",
      focusedSessionId: "focused-1",
      binding,
      objective: "Bounded work",
      allowedScope: "src/**",
    });
    fixture.store.attach(assignment.id, "focused-1", binding);
    fixture.store.observePresence("focused-1", "suspended", "quit");
    const observed = fixture.store.presenceFor("focused-1");
    assert.equal(observed?.status, "suspended");
    const stale = fixture.store.presenceFor("focused-1", Date.parse(observed!.lastSeenAt) + 30 * 60 * 1000 + 1);
    assert.equal(stale?.status, "stale");
    assert.equal(fixture.store.getRole("focused-1").kind, "focused-session");
  } finally {
    fixture.dispose();
  }
});

test("explicit event projection is ordered, relevant, deduplicated, and durable per consumer", () => {
  const fixture = temporaryStore();
  try {
    fixture.store.registerCoordinator("root-1");
    const registration = fixture.store.consumeRelevantEvents("root-1");
    assert.equal(registration.length, 1);
    assert.equal(registration[0]?.action, "coordinator_registered");
    assert.deepEqual(fixture.store.consumeRelevantEvents("root-1"), []);

    const assignment = fixture.store.createAssignment({
      coordinatorSessionId: "root-1", focusedSessionId: "focused-1", binding,
      objective: "Bounded work", allowedScope: "src/**",
    });
    const rootEvents = fixture.store.consumeRelevantEvents("root-1");
    assert.equal(rootEvents.length, 1);
    assert.equal(rootEvents[0]?.action, "assignment_created");
    assert.equal(fixture.store.consumeRelevantEvents("focused-1")[0]?.action, "assignment_created");
    assert.deepEqual(new LocalStateStore(fixture.path).consumeRelevantEvents("root-1"), []);

    fixture.store.attach(assignment.id, "focused-1", binding);
    fixture.store.observePresence("focused-1", "live");
    fixture.store.observePresence("focused-1", "live");
    const focusedEvents = fixture.store.consumeRelevantEvents("focused-1");
    assert.deepEqual(focusedEvents.map((event) => event.action), ["assignment_attached", "presence_changed"]);
    assert.deepEqual(fixture.store.consumeRelevantEvents("focused-1"), []);

    const restored = new LocalStateStore(fixture.path);
    assert.deepEqual(restored.consumeRelevantEvents("focused-1"), []);
    assert.equal(restored.read().eventCursors?.["focused-1"]?.eventIds.length, 3);
  } finally {
    fixture.dispose();
  }
});

test("legacy event arrays receive ordered sequences and append after a tail cursor", () => {
  const fixture = temporaryStore();
  try {
    writeFileSync(fixture.path, `${JSON.stringify({
      version: 1,
      coordinators: [],
      assignments: [],
      handoffs: [],
      events: [
        { id: "legacy-1", assignmentId: "", sessionId: "consumer", type: "progress", createdAt: "2025-01-01T00:00:00.000Z", summary: "Legacy first" },
        { id: "legacy-2", assignmentId: "", sessionId: "consumer", type: "progress", createdAt: "2025-01-01T00:00:01.000Z", summary: "Legacy second" },
      ],
      presence: [],
      eventCursors: { consumer: { lastSequence: 2, eventIds: ["legacy-1", "legacy-2"] } },
    })}\n`);

    assert.deepEqual(fixture.store.read().events.map((event) => event.sequence), [1, 2]);
    assert.equal(fixture.store.read().nextEventSequence, 3);

    fixture.store.registerCoordinator("consumer");

    const restored = fixture.store.read();
    assert.equal(restored.events.at(-1)?.sequence, 3);
    assert.equal(restored.nextEventSequence, 4);
    assert.deepEqual(fixture.store.consumeRelevantEvents("consumer").map((event) => event.id), [restored.events.at(-1)?.id]);
  } finally {
    fixture.dispose();
  }
});

test("a cursor before a legacy event tail consumes the normalized ordered events", () => {
  const fixture = temporaryStore();
  try {
    writeFileSync(fixture.path, `${JSON.stringify({
      version: 1,
      coordinators: [],
      assignments: [],
      handoffs: [],
      events: [
        { id: "legacy-1", assignmentId: "", sessionId: "consumer", type: "progress", createdAt: "2025-01-01T00:00:00.000Z", summary: "Legacy first" },
        { id: "legacy-2", assignmentId: "", sessionId: "consumer", type: "progress", createdAt: "2025-01-01T00:00:01.000Z", summary: "Legacy second" },
      ],
      presence: [],
      eventCursors: { consumer: { lastSequence: 0, eventIds: [] } },
    })}\n`);

    assert.deepEqual(fixture.store.consumeRelevantEvents("consumer").map((event) => event.id), ["legacy-1", "legacy-2"]);
  } finally {
    fixture.dispose();
  }
});

test("event ledger pruning is bounded without changing assignment-derived footer counts", () => {
  const fixture = temporaryStore();
  try {
    fixture.store.registerCoordinator("root-1");
    for (let index = 0; index < 510; index += 1) {
      fixture.store.observePresence("root-1", index % 2 === 0 ? "live" : "suspended");
    }
    const state = fixture.store.read();
    assert.equal(state.events.length, 500);
    assert.equal(fixture.store.getRole("root-1").kind, "root-coordinator");
  } finally {
    fixture.dispose();
  }
});

test("scope changes are revisioned, coordinator-authorized, and stale actions fail closed", () => {
  const fixture = temporaryStore();
  try {
    fixture.store.registerCoordinator("root-1");
    fixture.store.registerCoordinator("root-2");
    const assignment = fixture.store.createAssignment({
      coordinatorSessionId: "root-1", focusedSessionId: "focused-1", binding,
      objective: "Bounded work", allowedScope: "src/**",
    });
    fixture.store.attach(assignment.id, "focused-1", binding);
    fixture.store.activate("focused-1");
    const proposal = fixture.store.proposeScopeChange("focused-1", {
      baseScopeRevision: 1, requestedScope: "src/feature/**", reason: "The implementation needs one narrow sibling path", evidence: ["dependency map"],
    });
    const beforeUnauthorized = JSON.stringify(fixture.store.read());
    assert.throws(() => fixture.store.approveScopeChange("root-2", assignment.id, proposal.id, 1), /Only the assignment coordinator/);
    assert.equal(JSON.stringify(fixture.store.read()), beforeUnauthorized);

    const approved = fixture.store.approveScopeChange("root-1", assignment.id, proposal.id, 1);
    assert.equal(approved.allowedScope, "src/feature/**");
    assert.equal(approved.scopeRevision, 2);
    assert.equal(fixture.store.read().scopeChanges?.proposals[0]?.approvalKind, "coordinator");
    const afterApproval = JSON.stringify(fixture.store.read());
    assert.throws(() => fixture.store.approveScopeChange("root-1", assignment.id, proposal.id, 1), /no longer pending/);
    assert.equal(JSON.stringify(fixture.store.read()), afterApproval);
    assert.throws(() => fixture.store.proposeScopeChange("focused-1", {
      baseScopeRevision: 1, requestedScope: "src/other/**", reason: "stale", evidence: [],
    }), /stale scope revision/);
  } finally {
    fixture.dispose();
  }
});

test("terminal assignments reject scope proposals before durable mutation", () => {
  const terminalStatuses: TerminalStatus[] = ["accepted", "returned", "blocked", "abandoned"];
  for (const status of terminalStatuses) {
    const fixture = temporaryStore();
    try {
      fixture.store.registerCoordinator("root-1");
      const assignment = fixture.store.createAssignment({
        coordinatorSessionId: "root-1", focusedSessionId: "focused-1", binding,
        objective: "Bounded work", allowedScope: "src/**",
      });
      fixture.store.attach(assignment.id, "focused-1", binding);
      terminalize(fixture, assignment, status);
      const before = JSON.stringify(fixture.store.read());

      assert.throws(() => fixture.store.proposeScopeChange("focused-1", {
        baseScopeRevision: 1, requestedScope: "src/terminal/**", reason: "Must be rejected", evidence: [],
      }), /Scope changes require an attached, active, or handoff-submitted assignment/);
      assert.equal(JSON.stringify(fixture.store.read()), before);
    } finally {
      fixture.dispose();
    }
  }
});

test("terminal assignments reject coordinator and direct-human approvals before durable mutation", () => {
  const terminalStatuses: TerminalStatus[] = ["accepted", "returned", "blocked", "abandoned"];
  for (const status of terminalStatuses) {
    const fixture = temporaryStore();
    try {
      fixture.store.registerCoordinator("root-1");
      const assignment = fixture.store.createAssignment({
        coordinatorSessionId: "root-1", focusedSessionId: "focused-1", binding,
        objective: "Bounded work", allowedScope: "src/**",
      });
      fixture.store.attach(assignment.id, "focused-1", binding);
      const proposal = fixture.store.proposeScopeChange("focused-1", {
        baseScopeRevision: 1, requestedScope: "src/terminal/**", reason: "Must be rejected", evidence: [],
      });
      terminalize(fixture, assignment, status);
      const before = JSON.stringify(fixture.store.read());

      assert.throws(() => fixture.store.approveScopeChange("root-1", assignment.id, proposal.id, 1),
        /Scope changes require an attached, active, or handoff-submitted assignment/);
      assert.equal(JSON.stringify(fixture.store.read()), before);
      assert.throws(() => fixture.store.approveScopeChangeAsHuman("focused-1", proposal.id, 1),
        /Scope changes require an attached, active, or handoff-submitted assignment/);
      assert.equal(JSON.stringify(fixture.store.read()), before);
    } finally {
      fixture.dispose();
    }
  }
});

test("direct human scope approval increments the revision and leaves one reconciliation obligation", () => {
  const fixture = temporaryStore();
  try {
    fixture.store.registerCoordinator("root-1");
    const assignment = fixture.store.createAssignment({
      coordinatorSessionId: "root-1", focusedSessionId: "focused-1", binding,
      objective: "Bounded work", allowedScope: "src/**",
    });
    fixture.store.attach(assignment.id, "focused-1", binding);
    const proposal = fixture.store.proposeScopeChange("focused-1", {
      baseScopeRevision: 1, requestedScope: "src/approved/**", reason: "Human approved the narrow expansion", evidence: ["human decision"],
    });
    const approved = fixture.store.approveScopeChangeAsHuman("focused-1", proposal.id, 1);
    assert.equal(approved.scopeRevision, 2);
    const reconciliation = fixture.store.read().scopeChanges?.reconciliations[0];
    assert.equal(reconciliation?.status, "pending");
    assert.equal(reconciliation?.scopeRevision, 2);
    assert.equal(fixture.store.read().scopeChanges?.proposals[0]?.approvalKind, "direct-human");
    const reconciled = fixture.store.reconcileScopeChange("root-1", reconciliation!.id, 2);
    assert.equal(reconciled.status, "reconciled");
    assert.throws(() => fixture.store.reconcileScopeChange("root-1", reconciliation!.id, 2), /no longer pending/);
  } finally {
    fixture.dispose();
  }
});

test("legacy assignments hydrate scope revision and versioned scope-change state", () => {
  const fixture = temporaryStore();
  try {
    writeFileSync(fixture.path, `${JSON.stringify({
      version: 1, coordinators: ["root-1"], assignments: [{
        id: "assignment-1", coordinatorSessionId: "root-1", focusedSessionId: "focused-1", binding,
        objective: "Legacy work", allowedScope: "src/**", status: "attached",
        createdAt: "2025-01-01T00:00:00.000Z", updatedAt: "2025-01-01T00:00:00.000Z",
      }], handoffs: [], events: [],
    })}\n`);
    const state = fixture.store.read();
    assert.equal(state.assignments[0]?.scopeRevision, 1);
    assert.deepEqual(state.scopeChanges, { version: 1, proposals: [], reconciliations: [] });
  } finally {
    fixture.dispose();
  }
});

test("workflow ledger includes a domain, focused descendant, handoff, and derived presence", () => {
  const fixture = temporaryStore();
  try {
    fixture.store.registerCoordinator("root-1");
    const domain = fixture.store.createAssignment({
      coordinatorSessionId: "root-1",
      focusedSessionId: "domain-1",
      targetRole: "domain-coordinator",
      binding,
      objective: "Coordinate subsystem",
      allowedScope: "core/**",
    });
    fixture.store.attach(domain.id, "domain-1", binding);
    fixture.store.registerCoordinator("domain-1");
    const focused = fixture.store.createAssignment({
      coordinatorSessionId: "domain-1",
      focusedSessionId: "focused-1",
      binding,
      objective: "Implement subsystem change",
      allowedScope: "core/src/**",
    });
    fixture.store.attach(focused.id, "focused-1", binding);
    fixture.store.activate("focused-1");
    fixture.store.submitHandoff("focused-1", {
      outcome: "Implemented",
      changedSurfaces: ["core/src/change.ts"],
      checks: ["npm test"],
      risks: [],
    });
    fixture.store.observePresence("focused-1", "suspended", "quit");

    const ledger = fixture.store.workflowLedger("domain-1") as {
      rootSessionId: string;
      assignments: { total: number; returned: number; truncated: boolean; items: Array<{ sessionId: string }> };
      handoffs: { items: Array<{ outcome: string }> };
      presence: { items: Array<{ sessionId: string; status: string }> };
    };
    assert.equal(ledger.rootSessionId, "root-1");
    assert.equal(ledger.assignments.total, 2);
    assert.equal(ledger.assignments.returned, 2);
    assert.equal(ledger.assignments.truncated, false);
    assert.deepEqual(ledger.assignments.items.map((assignment) => assignment.sessionId), ["domain-1", "focused-1"]);
    assert.equal(ledger.handoffs.items[0]?.outcome, "Implemented");
    assert.equal(ledger.presence.items[0]?.sessionId, "focused-1");
    assert.equal(ledger.presence.items[0]?.status, "suspended");
  } finally {
    fixture.dispose();
  }
});
