import assert from "node:assert/strict";
import test from "node:test";

import type { DurableState } from "../src/model";
import { appendBaselineContext, appendPendingContext, appendRoleContext, BASELINE_CONTEXT_MARKER, footerStatus, pendingAssignmentContext, ROLE_CONTEXT_MARKER, roleContext } from "../src/prompt";

const state: DurableState = {
  version: 1,
  coordinators: ["coordinator-1"],
  assignments: [
    {
      id: "assignment-active", coordinatorSessionId: "coordinator-1", focusedSessionId: "focused-1",
      binding: { repository: "/repos/example/.git", worktree: "/repos/example" }, objective: "Own change A", allowedScope: "src/a.ts",
      status: "active", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "assignment-accepted", coordinatorSessionId: "coordinator-1", focusedSessionId: "focused-old",
      binding: { repository: "/repos/example/.git", worktree: "/repos/example" }, objective: "Old work", allowedScope: "src/old.ts",
      status: "accepted", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
    },
  ],
  handoffs: [],
  events: [],
};

test("managed prompts are concise, role-specific additions and unmanaged prompts are unchanged", () => {
  const coordinator = roleContext(state, "coordinator-1");
  assert.match(coordinator ?? "", new RegExp(ROLE_CONTEXT_MARKER));
  assert.match(coordinator ?? "", /assignment-active/);
  assert.doesNotMatch(coordinator ?? "", /assignment-accepted/);

  const focused = roleContext(state, "focused-1");
  assert.match(focused ?? "", /Coordinator ID: coordinator-1/);
  assert.match(focused ?? "", /Own change A/);
  assert.doesNotMatch(focused ?? "", /focused-old/);
  assert.match(focused ?? "", /promptly ask the coordinator for explicit re-scoping or delegation/);
  assert.match(focused ?? "", /do not take on overarching coordinator topics/);
  assert.equal(roleContext(state, "unmanaged-1"), undefined);

  const appended = appendRoleContext("Existing system prompt.", focused);
  assert.equal(appended, `Existing system prompt.\n\n${focused}`);
  assert.equal(appendRoleContext(appended, focused), appended);
  assert.equal(appendRoleContext("Existing system prompt.", undefined), "Existing system prompt.");
  assert.match(coordinator ?? "", /do not push them into focused-session context or pull focused implementation detail into this context/);
});

test("role prompts expose scope revisions and pending scope obligations", () => {
  const scoped: DurableState = {
    ...state,
    assignments: [{ ...state.assignments[0]!, scopeRevision: 3 }],
    scopeChanges: {
      version: 1,
      proposals: [{
        id: "proposal-1", assignmentId: "assignment-active", requesterSessionId: "focused-1", baseScopeRevision: 3,
        requestedScope: "src/feature/**", reason: "Narrow dependency", evidence: ["map"], status: "pending",
        createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
      }],
      reconciliations: [],
    },
  };
  assert.match(roleContext(scoped, "focused-1") ?? "", /Scope revision: 3/);
  assert.match(roleContext(scoped, "focused-1") ?? "", /proposal-1/);
  assert.match(roleContext(scoped, "coordinator-1") ?? "", /pending proposals: proposal-1/);
});

test("unmanaged sessions receive only the universal coordination baseline", () => {
  const appended = appendBaselineContext("Existing system prompt.");
  assert.match(appended, new RegExp(BASELINE_CONTEXT_MARKER));
  assert.match(appended, /orchestrator_status/);
  assert.match(appended, /Small, known work may remain inline/);
  assert.match(appended, /orchestration or delegation requires an explicit durable assignment/);
  assert.match(appended, /use fast focused delegation after recording that assignment/);
  assert.match(appended, /do not dump either across that boundary/);
  assert.match(appended, /neither creates sessions nor transfers authority or delivery authority/);
  assert.equal(appendBaselineContext(appended), appended);
});

test("pending assignments show a target notice before they attach", () => {
  const pending: DurableState = { ...state, assignments: [{
    id: "pending", coordinatorSessionId: "coordinator-1", focusedSessionId: "pending-1",
    binding: { repository: "/repos/example/.git", worktree: "/repos/example" }, objective: "Accept work", allowedScope: "src/**",
    status: "created", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
  }], handoffs: [], events: [] };
  assert.equal(footerStatus(pending, "pending-1"), "⏳ Pending focused assignment");
  assert.match(pendingAssignmentContext(pending, "pending-1") ?? "", /Accept work/);
  assert.match(appendPendingContext("Prompt", pendingAssignmentContext(pending, "pending-1")), /pending assignment/);
});

test("footer status is derived from persisted state without exposing unrelated assignments", () => {
  assert.equal(footerStatus({ ...state, assignments: [], events: [] }, "coordinator-1"), "🧭 Root · 0 children");
  assert.equal(footerStatus(state, "coordinator-1"), "🧭 Root · 1 children · 1 working");
  assert.equal(footerStatus(state, "focused-1"), "🎯 Focused session");
  assert.equal(footerStatus(state, "unmanaged-1"), undefined);
});

test("event summaries never enter additive model prompt context", () => {
  const eventText = "secret orchestration event text must stay out of the model prompt";
  const withEvent = { ...state, events: [{
    id: "event-1", assignmentId: "assignment-active", type: "progress" as const,
    action: "assignment_started" as const, createdAt: "2026-01-01T00:00:00.000Z", summary: eventText,
  }] };
  const systemPrompt = appendRoleContext(appendBaselineContext("Existing system prompt."), roleContext(withEvent, "coordinator-1"));
  assert.doesNotMatch(systemPrompt, new RegExp(eventText));
});

test("root footer aggregates direct and domain focused assignments", () => {
  const hierarchy: DurableState = {
    version: 1,
    coordinators: ["root-1", "domain-1"],
    assignments: [
      {
        id: "root-direct", coordinatorSessionId: "root-1", focusedSessionId: "focused-direct",
        binding: { repository: "/repos/root/.git", worktree: "/repos/root" }, objective: "Direct work", allowedScope: "src/**",
        status: "active", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "domain", coordinatorSessionId: "root-1", focusedSessionId: "domain-1", targetRole: "domain-coordinator",
        binding: { repository: "/repos/core/.git", worktree: "/repos/core" }, objective: "Coordinate Core", allowedScope: "**",
        status: "active", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "domain-focused", coordinatorSessionId: "domain-1", focusedSessionId: "focused-core",
        binding: { repository: "/repos/core/.git", worktree: "/repos/core" }, objective: "Core work", allowedScope: "src/**",
        status: "active", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    handoffs: [],
    events: [],
  };

  assert.equal(footerStatus(hierarchy, "root-1"), "🧭 Root · 2 children · 2 working");
  assert.equal(footerStatus(hierarchy, "domain-1"), "🧭 Domain · 1 children · 1 working");
});
