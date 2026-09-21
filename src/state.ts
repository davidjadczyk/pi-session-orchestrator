import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";

import {
  ASSIGNMENT_STATUSES,
  type Assignment,
  type AssignmentRole,
  type AssignmentStatus,
  type CanonicalBinding,
  type DurableState,
  type EventCursor,
  type EventType,
  type OrchestrationEventAction,
  type HandoffRecord,
  type OrchestrationEvent,
  type PresenceStatus,
  type SessionPresence,
  type SessionRole,
  type ScopeChangeApprovalKind,
  type ScopeChangeProposal,
  type ScopeChangeState,
  type ScopeReconciliation,
} from "./model";

const PENDING_STATUSES: AssignmentStatus[] = ["created", "attached", "active", "handoff-submitted"];
const SCOPE_CHANGE_ALLOWED_STATUSES: AssignmentStatus[] = ["attached", "active", "handoff-submitted"];
const MAX_EVENT_LEDGER = 500;
const MAX_CURSOR_EVENT_IDS = 500;
/** Presence is stale after 30 minutes without observation; no timer is started. */
export const PRESENCE_STALE_AFTER_MS = 30 * 60 * 1000;

function now(): string {
  return new Date().toISOString();
}

function copyEmptyState(): DurableState {
  return {
    version: 1, coordinators: [], assignments: [], handoffs: [], events: [], presence: [], eventCursors: {},
    scopeChanges: { version: 1, proposals: [], reconciliations: [] },
  };
}

function requireText(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`Invalid ${field}`);
  return value;
}

function isBinding(value: unknown): value is CanonicalBinding {
  return typeof value === "object" && value !== null
    && typeof (value as CanonicalBinding).repository === "string"
    && typeof (value as CanonicalBinding).worktree === "string";
}

function isStatus(value: unknown): value is AssignmentStatus {
  return typeof value === "string" && (ASSIGNMENT_STATUSES as readonly string[]).includes(value);
}

function normalizeEventSequences(state: DurableState): DurableState {
  let nextSequence = 1;
  for (const event of state.events) {
    if (event.sequence === undefined) event.sequence = nextSequence;
    nextSequence = Math.max(nextSequence, event.sequence + 1);
  }
  const cursorTail = Math.max(0, ...Object.values(state.eventCursors ?? {}).map((cursor) => cursor.lastSequence));
  state.nextEventSequence = Math.max(state.nextEventSequence ?? 1, nextSequence, cursorTail + 1);
  return state;
}

function validateState(value: unknown): DurableState {
  if (typeof value !== "object" || value === null) throw new Error("Invalid orchestration state");
  const state = value as DurableState;
  if (state.version !== 1 || !Array.isArray(state.coordinators) || !Array.isArray(state.assignments)
    || !Array.isArray(state.handoffs) || !Array.isArray(state.events)) {
    throw new Error("Invalid orchestration state");
  }
  if (state.presence === undefined) state.presence = [];
  if (!Array.isArray(state.presence)) throw new Error("Invalid orchestration presence");
  for (const presence of state.presence) {
    requireText(presence.sessionId, "presence session ID");
    requireText(presence.lastSeenAt, "presence timestamp");
    if (!["live", "reloading", "suspended"].includes(presence.status)) throw new Error("Invalid presence status");
  }
  for (const coordinator of state.coordinators) requireText(coordinator, "coordinator session ID");
  for (const assignment of state.assignments) {
    requireText(assignment.id, "assignment ID");
    requireText(assignment.coordinatorSessionId, "coordinator session ID");
    requireText(assignment.focusedSessionId, "focused session ID");
    requireText(assignment.objective, "objective");
    requireText(assignment.allowedScope, "allowed scope");
    requireText(assignment.createdAt, "created timestamp");
    requireText(assignment.updatedAt, "updated timestamp");
    if (!isBinding(assignment.binding) || !isStatus(assignment.status)) throw new Error("Invalid assignment");
    if (assignment.scopeRevision === undefined) assignment.scopeRevision = 1;
    if (!Number.isInteger(assignment.scopeRevision) || assignment.scopeRevision < 1) throw new Error("Invalid assignment scope revision");
  }
  if (state.scopeChanges === undefined) state.scopeChanges = { version: 1, proposals: [], reconciliations: [] };
  if (typeof state.scopeChanges !== "object" || state.scopeChanges === null || state.scopeChanges.version !== 1
    || !Array.isArray(state.scopeChanges.proposals) || !Array.isArray(state.scopeChanges.reconciliations)) {
    throw new Error("Invalid scope-change state");
  }
  for (const proposal of state.scopeChanges.proposals) {
    requireText(proposal.id, "scope-change proposal ID");
    requireText(proposal.assignmentId, "scope-change assignment ID");
    requireText(proposal.requesterSessionId, "scope-change requester session ID");
    requireText(proposal.requestedScope, "requested scope");
    requireText(proposal.reason, "scope-change reason");
    requireText(proposal.createdAt, "scope-change created timestamp");
    requireText(proposal.updatedAt, "scope-change updated timestamp");
    if (!Number.isInteger(proposal.baseScopeRevision) || proposal.baseScopeRevision < 1
      || !Array.isArray(proposal.evidence) || proposal.evidence.some((item) => typeof item !== "string")
      || !["pending", "approved"].includes(proposal.status)) throw new Error("Invalid scope-change proposal");
    if (proposal.approvalKind !== undefined && !["coordinator", "direct-human"].includes(proposal.approvalKind)) {
      throw new Error("Invalid scope-change approval");
    }
    if (proposal.approvedBy !== undefined) requireText(proposal.approvedBy, "scope-change approver");
  }
  for (const reconciliation of state.scopeChanges.reconciliations) {
    requireText(reconciliation.id, "scope reconciliation ID");
    requireText(reconciliation.assignmentId, "scope reconciliation assignment ID");
    requireText(reconciliation.requestedScope, "reconciliation scope");
    requireText(reconciliation.reason, "reconciliation reason");
    requireText(reconciliation.createdAt, "reconciliation created timestamp");
    requireText(reconciliation.updatedAt, "reconciliation updated timestamp");
    if (!Number.isInteger(reconciliation.scopeRevision) || reconciliation.scopeRevision < 1
      || !Array.isArray(reconciliation.evidence) || reconciliation.evidence.some((item) => typeof item !== "string")
      || !["pending", "reconciled"].includes(reconciliation.status)) throw new Error("Invalid scope reconciliation");
  }
  for (const handoff of state.handoffs) {
    requireText(handoff.id, "handoff ID");
    requireText(handoff.assignmentId, "handoff assignment ID");
    requireText(handoff.submittedAt, "handoff timestamp");
    requireText(handoff.outcome, "handoff outcome");
    if (!Array.isArray(handoff.changedSurfaces) || !Array.isArray(handoff.checks) || !Array.isArray(handoff.risks)) {
      throw new Error("Invalid handoff");
    }
  }
  if (state.nextEventSequence !== undefined && (!Number.isInteger(state.nextEventSequence) || state.nextEventSequence < 1)) {
    throw new Error("Invalid orchestration event sequence");
  }
  if (state.eventCursors !== undefined) {
    if (typeof state.eventCursors !== "object" || state.eventCursors === null) throw new Error("Invalid orchestration event cursors");
    for (const cursor of Object.values(state.eventCursors)) {
      if (!cursor || !Number.isInteger(cursor.lastSequence) || cursor.lastSequence < 0 || !Array.isArray(cursor.eventIds)
        || cursor.eventIds.some((id) => typeof id !== "string")) throw new Error("Invalid orchestration event cursor");
    }
  }
  for (const event of state.events) {
    requireText(event.id, "event ID");
    if (typeof event.assignmentId !== "string") throw new Error("Invalid event assignment ID");
    if (event.sessionId !== undefined) requireText(event.sessionId, "event session ID");
    requireText(event.createdAt, "event timestamp");
    requireText(event.summary, "event summary");
    if (!["progress", "blocker", "decision_request", "handoff", "review_result"].includes(event.type)) {
      throw new Error("Invalid event");
    }
    if (event.sequence !== undefined && (!Number.isInteger(event.sequence) || event.sequence < 1)) {
      throw new Error("Invalid event sequence");
    }
  }
  return normalizeEventSequences(state);
}

export function bindingsMatch(left: CanonicalBinding, right: CanonicalBinding): boolean {
  return left.repository === right.repository && left.worktree === right.worktree;
}

function boundedLedgerItems<T>(items: T[], limit: number): { total: number; returned: number; truncated: boolean; items: T[] } {
  const selected = items.slice(-limit);
  return {
    total: items.length,
    returned: selected.length,
    truncated: selected.length < items.length,
    items: selected,
  };
}

export class LocalStateStore {
  constructor(private readonly path = join(homedir(), ".pi", "pi-session-orchestrator", "state.json")) {}

  read(): DurableState {
    try {
      return validateState(JSON.parse(readFileSync(this.path, "utf8")));
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return copyEmptyState();
      throw error;
    }
  }

  registerCoordinator(sessionId: string): void {
    const state = this.read();
    const role = this.roleForState(state, sessionId);
    if (role.kind === "focused-session") {
      throw new Error("A focused session cannot become a coordinator or create managed children");
    }
    if (!state.coordinators.includes(sessionId)) {
      state.coordinators.push(sessionId);
      this.recordEvent(state, "", "progress", "Coordinator role recorded", undefined, { sessionId }, "coordinator_registered", sessionId);
      this.write(state);
    }
  }

  createAssignment(input: Omit<Assignment, "id" | "status" | "createdAt" | "updatedAt" | "targetRole"> & { targetRole?: AssignmentRole }): Assignment {
    return this.createAssignments([input])[0]!;
  }

  createAssignments(inputs: (Omit<Assignment, "id" | "status" | "createdAt" | "updatedAt" | "targetRole"> & { targetRole?: AssignmentRole })[]): Assignment[] {
    if (!inputs.length) throw new Error("At least one assignment is required");
    const state = this.read();
    const assignments: Assignment[] = [];
    const assignedSessionIds = new Set(state.assignments
      .filter((assignment) => PENDING_STATUSES.includes(assignment.status))
      .map((assignment) => assignment.focusedSessionId));

    for (const input of inputs) {
      const coordinatorRole = this.coordinatorRole(state, input.coordinatorSessionId);
      if (!coordinatorRole) throw new Error("Only an explicitly registered coordinator can create assignments");
      const targetRole = input.targetRole ?? "focused-session";
      if (targetRole === "domain-coordinator" && coordinatorRole !== "root-coordinator") {
        throw new Error("Only a root coordinator can create a domain coordinator");
      }
      if (input.coordinatorSessionId === input.focusedSessionId || state.coordinators.includes(input.focusedSessionId)) {
        throw new Error("A coordinator cannot assign itself or another coordinator as a managed child");
      }
      if (assignedSessionIds.has(input.focusedSessionId)) throw new Error("The managed session already has a pending assignment");

      const timestamp = now();
      assignments.push({
        ...input,
        targetRole,
        scopeRevision: 1,
        id: randomUUID(),
        status: "created",
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      assignedSessionIds.add(input.focusedSessionId);
    }

    state.assignments.push(...assignments);
    for (const assignment of assignments) {
      this.recordEvent(state, assignment.id, "progress", "Assignment created", "Target session must attach explicitly", {
        status: assignment.status,
      }, "assignment_created", assignment.focusedSessionId);
    }
    this.write(state);
    return assignments;
  }

  attach(assignmentId: string, focusedSessionId: string, binding: CanonicalBinding): Assignment {
    const state = this.read();
    const assignment = this.assignment(state, assignmentId);
    if (assignment.focusedSessionId !== focusedSessionId) throw new Error("Only the assigned focused session can attach");
    if (assignment.status !== "created") throw new Error(`Cannot attach an assignment in ${assignment.status}`);
    if (!bindingsMatch(assignment.binding, binding)) throw new Error("Assignment repository/worktree binding does not match this focused session");
    this.transition(state, assignment, "attached", "Focused session attached", "Start the assigned objective explicitly", "assignment_attached");
    this.write(state);
    return assignment;
  }

  activate(focusedSessionId: string): Assignment {
    const state = this.read();
    const assignment = this.requiredFocusedAssignment(state, focusedSessionId);
    this.assertStatus(assignment, "attached");
    this.transition(state, assignment, "active", "Focused work is active", undefined, "assignment_started");
    this.write(state);
    return assignment;
  }

  submitHandoff(focusedSessionId: string, input: Omit<HandoffRecord, "id" | "assignmentId" | "submittedAt">): HandoffRecord {
    const state = this.read();
    const assignment = this.requiredFocusedAssignment(state, focusedSessionId);
    this.assertStatus(assignment, "active");
    const handoff: HandoffRecord = { ...input, id: randomUUID(), assignmentId: assignment.id, submittedAt: now() };
    state.handoffs.push(handoff);
    this.transition(state, assignment, "handoff-submitted", "Handoff submitted", "Coordinator must explicitly accept or return it", "handoff_submitted", {
      handoffId: handoff.id,
      outcome: input.outcome,
    }, "handoff");
    this.write(state);
    return handoff;
  }

  decide(focusedSessionId: string, summary: string, details: Record<string, unknown>): OrchestrationEvent {
    const state = this.read();
    const assignment = this.requiredFocusedAssignment(state, focusedSessionId);
    if (!PENDING_STATUSES.includes(assignment.status)) throw new Error("Decision requests require a pending assignment");
    const event = this.recordEvent(state, assignment.id, "decision_request", summary, "Coordinator decision required", details, "decision_requested", focusedSessionId);
    this.write(state);
    return event;
  }

  proposeScopeChange(focusedSessionId: string, input: {
    baseScopeRevision: number;
    requestedScope: string;
    reason: string;
    evidence: string[];
  }): ScopeChangeProposal {
    const state = this.read();
    const assignment = this.requiredFocusedAssignment(state, focusedSessionId);
    this.assertScopeChangeLifecycle(assignment);
    const currentRevision = this.assignmentScopeRevision(assignment);
    if (input.baseScopeRevision !== currentRevision) throw new Error("Scope-change proposal uses a stale scope revision");
    requireText(input.requestedScope, "requested scope");
    requireText(input.reason, "scope-change reason");
    if (!Array.isArray(input.evidence) || input.evidence.some((item) => typeof item !== "string")) {
      throw new Error("Scope-change evidence must be an array of strings");
    }
    const scopeChanges = this.scopeChanges(state);
    if (scopeChanges.proposals.some((proposal) => proposal.assignmentId === assignment.id
      && proposal.status === "pending" && proposal.baseScopeRevision === currentRevision)) {
      throw new Error("A current scope-change proposal already exists");
    }
    const timestamp = now();
    const proposal: ScopeChangeProposal = {
      id: randomUUID(), assignmentId: assignment.id, requesterSessionId: focusedSessionId,
      baseScopeRevision: currentRevision, requestedScope: input.requestedScope.trim(), reason: input.reason.trim(),
      evidence: input.evidence, status: "pending", createdAt: timestamp, updatedAt: timestamp,
    };
    scopeChanges.proposals.push(proposal);
    this.recordEvent(state, assignment.id, "decision_request", "Scope change proposed", "Coordinator must approve or the focused session must obtain direct human approval", {
      proposalId: proposal.id, scopeRevision: currentRevision, requestedScope: proposal.requestedScope, reason: proposal.reason,
    }, "scope_change_proposed", focusedSessionId);
    this.write(state);
    return proposal;
  }

  approveScopeChange(coordinatorSessionId: string, assignmentId: string, proposalId: string, baseScopeRevision: number): Assignment {
    return this.applyScopeChange(coordinatorSessionId, assignmentId, proposalId, baseScopeRevision, "coordinator");
  }

  approveScopeChangeAsHuman(focusedSessionId: string, proposalId: string, baseScopeRevision: number): Assignment {
    return this.applyScopeChange(focusedSessionId, undefined, proposalId, baseScopeRevision, "direct-human");
  }

  reconcileScopeChange(coordinatorSessionId: string, reconciliationId: string, scopeRevision: number): ScopeReconciliation {
    const state = this.read();
    const scopeChanges = this.scopeChanges(state);
    const reconciliation = scopeChanges.reconciliations.find((item) => item.id === reconciliationId);
    if (!reconciliation) throw new Error("Unknown scope reconciliation");
    const assignment = this.assignment(state, reconciliation.assignmentId);
    if (assignment.coordinatorSessionId !== coordinatorSessionId || !state.coordinators.includes(coordinatorSessionId)) {
      throw new Error("Only the assignment coordinator can reconcile a scope change");
    }
    if (reconciliation.status !== "pending") throw new Error("Scope reconciliation is no longer pending");
    if (scopeRevision !== reconciliation.scopeRevision || this.assignmentScopeRevision(assignment) !== scopeRevision) {
      throw new Error("Scope reconciliation uses a stale scope revision");
    }
    reconciliation.status = "reconciled";
    reconciliation.updatedAt = now();
    this.recordEvent(state, assignment.id, "progress", "Direct-human scope change reconciled", undefined, {
      reconciliationId, scopeRevision,
    }, "scope_change_reconciled", coordinatorSessionId);
    this.write(state);
    return reconciliation;
  }

  acceptOrReturn(coordinatorSessionId: string, assignmentId: string, outcome: "accepted" | "returned", reason?: string): Assignment {
    const state = this.read();
    const assignment = this.assignment(state, assignmentId);
    if (assignment.coordinatorSessionId !== coordinatorSessionId || !state.coordinators.includes(coordinatorSessionId)) {
      throw new Error("Only the assignment coordinator can accept or return a handoff");
    }
    this.assertStatus(assignment, "handoff-submitted");
    if (!state.handoffs.some((handoff) => handoff.assignmentId === assignmentId)) throw new Error("No persisted handoff exists for this assignment");
    this.transition(state, assignment, outcome, outcome === "accepted" ? "Handoff accepted" : "Handoff returned", reason,
      outcome === "accepted" ? "handoff_accepted" : "handoff_returned", undefined, "handoff");
    this.write(state);
    return assignment;
  }

  markTerminal(sessionId: string, status: "blocked" | "abandoned", reason: string): Assignment {
    const state = this.read();
    const assignment = this.requiredFocusedAssignment(state, sessionId);
    if (!["active", "handoff-submitted"].includes(assignment.status)) {
      throw new Error(`Cannot mark ${assignment.status} as ${status}`);
    }
    this.transition(state, assignment, status, reason,
      status === "blocked" ? "Coordinator decision or dependency required" : "Explicit follow-up or a new assignment is required",
      status === "blocked" ? "assignment_blocked" : "assignment_abandoned",
      undefined,
      status === "blocked" ? "blocker" : "progress");
    this.write(state);
    return assignment;
  }

  getRole(sessionId: string): SessionRole {
    return this.roleForState(this.read(), sessionId);
  }

  presenceFor(sessionId: string, referenceTime = Date.now()): (Omit<SessionPresence, "status"> & { status: PresenceStatus | "stale" }) | undefined {
    const presence = this.read().presence?.find((item) => item.sessionId === sessionId);
    if (!presence) return undefined;
    return Date.parse(presence.lastSeenAt) + PRESENCE_STALE_AFTER_MS < referenceTime
      ? { ...presence, status: "stale" }
      : presence;
  }

  observePresence(sessionId: string, status: PresenceStatus, lastShutdownReason?: string, emitEvent = true): void {
    const state = this.read();
    const presence = state.presence ?? (state.presence = []);
    const index = presence.findIndex((item) => item.sessionId === sessionId);
    const previous = index === -1 ? undefined : presence[index];
    const next: SessionPresence = { sessionId, status, lastSeenAt: now(), lastShutdownReason };
    const previousEffective = previous ? this.effectivePresence(previous, Date.now()) : undefined;
    if (index === -1) presence.push(next);
    else presence[index] = next;
    if (emitEvent && previousEffective !== status) {
      const assignment = [...state.assignments].reverse().find((item) => item.focusedSessionId === sessionId);
      this.recordEvent(state, assignment?.id ?? "", "progress", `Session presence changed to ${status}`, undefined,
        { status, previousStatus: previousEffective }, "presence_changed", sessionId);
    }
    this.write(state);
  }

  /** Consume only explicit events relevant to this session and persist its cursor. */
  consumeRelevantEvents(sessionId: string, limit = 8): OrchestrationEvent[] {
    const state = this.read();
    const cursors = state.eventCursors ?? (state.eventCursors = {});
    const cursor: EventCursor = cursors[sessionId] ?? { lastSequence: 0, eventIds: [] };
    const ordered = state.events.map((event, index) => ({ event, sequence: event.sequence ?? index + 1 }))
      .sort((left, right) => left.sequence - right.sequence);
    const relevant = ordered.filter(({ event, sequence }) => this.eventRelevant(state, event, sessionId)
      && !cursor.eventIds.includes(event.id) && sequence > cursor.lastSequence);
    const boundedItems = relevant.slice(0, Math.max(1, Math.min(limit, 20)));
    const bounded = boundedItems.map(({ event }) => event);
    cursor.lastSequence = boundedItems.at(-1)?.sequence ?? ordered.at(-1)?.sequence ?? cursor.lastSequence;
    cursor.eventIds = [...new Set([...cursor.eventIds, ...bounded.map((event) => event.id)])].slice(-MAX_CURSOR_EVENT_IDS);
    cursors[sessionId] = cursor;
    this.write(state);
    return bounded;
  }

  workflowLedger(sessionId: string, limit = 20): Record<string, unknown> {
    const state = this.read();
    let rootSessionId = sessionId;
    const visited = new Set<string>();
    while (!visited.has(rootSessionId)) {
      visited.add(rootSessionId);
      const parent = [...state.assignments].reverse().find((assignment) => assignment.focusedSessionId === rootSessionId);
      if (!parent) break;
      rootSessionId = parent.coordinatorSessionId;
    }
    const assignments: Assignment[] = [];
    const coordinators = [rootSessionId];
    while (coordinators.length) {
      const coordinator = coordinators.shift()!;
      for (const assignment of state.assignments.filter((item) => item.coordinatorSessionId === coordinator)) {
        assignments.push(assignment);
        if (assignment.targetRole === "domain-coordinator") coordinators.push(assignment.focusedSessionId);
      }
    }
    const assignmentIds = new Set(assignments.map((assignment) => assignment.id));
    const boundedLimit = Math.max(1, Math.min(limit, 50));
    const assignmentItems = assignments.map((assignment) => ({
      id: assignment.id,
      sessionId: assignment.focusedSessionId,
      role: assignment.targetRole ?? "focused-session",
      objective: assignment.objective,
      allowedScope: assignment.allowedScope,
      scopeRevision: this.assignmentScopeRevision(assignment),
      status: assignment.status,
    }));
    const scopeChanges = this.scopeChanges(state);
    const scopeChangeItems = {
      proposals: scopeChanges.proposals.filter((proposal) => assignmentIds.has(proposal.assignmentId)),
      reconciliations: scopeChanges.reconciliations.filter((reconciliation) => assignmentIds.has(reconciliation.assignmentId)),
    };
    const eventItems = state.events.filter((event) => assignmentIds.has(event.assignmentId));
    const handoffItems = state.handoffs.filter((handoff) => assignmentIds.has(handoff.assignmentId));
    const presenceItems = (state.presence ?? [])
      .filter((presence) => presence.sessionId === rootSessionId || assignments.some((assignment) => assignment.focusedSessionId === presence.sessionId))
      .map((presence) => this.presenceFor(presence.sessionId)!)
      .sort((left, right) => right.lastSeenAt.localeCompare(left.lastSeenAt));
    return {
      rootSessionId,
      limit: boundedLimit,
      lifecycle: assignments.reduce<Record<string, number>>((counts, assignment) => ({ ...counts, [assignment.status]: (counts[assignment.status] ?? 0) + 1 }), {}),
      assignments: boundedLedgerItems(assignmentItems, boundedLimit),
      events: boundedLedgerItems(eventItems, boundedLimit),
      handoffs: boundedLedgerItems(handoffItems, boundedLimit),
      presence: boundedLedgerItems(presenceItems, boundedLimit),
      scopeChanges: {
        proposals: boundedLedgerItems(scopeChangeItems.proposals, boundedLimit),
        reconciliations: boundedLedgerItems(scopeChangeItems.reconciliations, boundedLimit),
      },
    };
  }

  activeAssignments(coordinatorSessionId: string): Assignment[] {
    return this.read().assignments.filter((assignment) => assignment.coordinatorSessionId === coordinatorSessionId
      && PENDING_STATUSES.includes(assignment.status));
  }

  private scopeChanges(state: DurableState): ScopeChangeState {
    return state.scopeChanges ?? (state.scopeChanges = { version: 1, proposals: [], reconciliations: [] });
  }

  private assignmentScopeRevision(assignment: Assignment): number {
    return assignment.scopeRevision ?? 1;
  }

  private applyScopeChange(sessionId: string, assignmentId: string | undefined, proposalId: string, baseScopeRevision: number,
    approvalKind: ScopeChangeApprovalKind): Assignment {
    const state = this.read();
    const scopeChanges = this.scopeChanges(state);
    const proposal = scopeChanges.proposals.find((item) => item.id === proposalId);
    if (!proposal) throw new Error("Unknown scope-change proposal");
    const assignment = this.assignment(state, proposal.assignmentId);
    if (assignmentId !== undefined && assignment.id !== assignmentId) throw new Error("Scope-change proposal assignment does not match");
    if (approvalKind === "coordinator") {
      if (assignment.coordinatorSessionId !== sessionId || !state.coordinators.includes(sessionId)) {
        throw new Error("Only the assignment coordinator can approve a scope change");
      }
    } else if (assignment.focusedSessionId !== sessionId) {
      throw new Error("Only the assigned focused session can record direct human approval");
    }
    this.assertScopeChangeLifecycle(assignment);
    if (proposal.status !== "pending") throw new Error("Scope-change proposal is no longer pending");
    const currentRevision = this.assignmentScopeRevision(assignment);
    if (proposal.baseScopeRevision !== baseScopeRevision || currentRevision !== baseScopeRevision) {
      throw new Error("Scope-change proposal uses a stale scope revision");
    }
    assignment.allowedScope = proposal.requestedScope;
    assignment.scopeRevision = currentRevision + 1;
    assignment.updatedAt = now();
    proposal.status = "approved";
    proposal.updatedAt = assignment.updatedAt;
    proposal.approvalKind = approvalKind;
    proposal.approvedBy = approvalKind === "coordinator" ? sessionId : "human";
    const action = approvalKind === "coordinator" ? "scope_change_approved" : "scope_change_human_approved";
    this.recordEvent(state, assignment.id, "progress", approvalKind === "coordinator" ? "Coordinator approved scope change" : "Direct human approved scope change",
      approvalKind === "coordinator" ? undefined : "Assignment coordinator must reconcile the direct-human scope change", {
        proposalId, scopeRevision: assignment.scopeRevision, requestedScope: assignment.allowedScope,
      }, action, sessionId);
    if (approvalKind === "direct-human") {
      const timestamp = now();
      scopeChanges.reconciliations.push({
        id: randomUUID(), assignmentId: assignment.id, scopeRevision: assignment.scopeRevision,
        requestedScope: proposal.requestedScope, reason: proposal.reason, evidence: proposal.evidence,
        status: "pending", createdAt: timestamp, updatedAt: timestamp,
      });
    }
    this.write(state);
    return assignment;
  }

  private coordinatorRole(state: DurableState, sessionId: string): "root-coordinator" | "domain-coordinator" | undefined {
    if (!state.coordinators.includes(sessionId)) return undefined;
    const role = this.roleForState(state, sessionId);
    return role.kind === "domain-coordinator" ? "domain-coordinator" : "root-coordinator";
  }

  private roleForState(state: DurableState, sessionId: string): SessionRole {
    const assignment = this.focusedAssignment(state, sessionId);
    if (assignment?.targetRole === "domain-coordinator") return { kind: "domain-coordinator", assignment };
    if (assignment) return { kind: "focused-session", assignment };
    return state.coordinators.includes(sessionId) ? { kind: "root-coordinator" } : { kind: "unmanaged" };
  }

  private focusedAssignment(state: DurableState, sessionId: string): Assignment | undefined {
    return [...state.assignments].reverse().find((assignment) => assignment.focusedSessionId === sessionId
      && assignment.status !== "created");
  }

  private requiredFocusedAssignment(state: DurableState, sessionId: string): Assignment {
    const assignment = this.focusedAssignment(state, sessionId);
    if (!assignment) throw new Error("This session has no valid attached focused assignment");
    return assignment;
  }

  private assignment(state: DurableState, assignmentId: string): Assignment {
    const assignment = state.assignments.find((item) => item.id === assignmentId);
    if (!assignment) throw new Error("Unknown assignment");
    return assignment;
  }

  private assertStatus(assignment: Assignment, expected: AssignmentStatus): void {
    if (assignment.status !== expected) throw new Error(`Expected ${expected}, found ${assignment.status}`);
  }

  private assertScopeChangeLifecycle(assignment: Assignment): void {
    if (!SCOPE_CHANGE_ALLOWED_STATUSES.includes(assignment.status)) {
      throw new Error(`Scope changes require an attached, active, or handoff-submitted assignment; found ${assignment.status}`);
    }
  }

  private transition(state: DurableState, assignment: Assignment, status: AssignmentStatus, summary: string, nextAction?: string,
    action: OrchestrationEventAction = "assignment_started", details?: Record<string, unknown>, type: EventType = "progress"): void {
    assignment.status = status;
    assignment.updatedAt = now();
    this.recordEvent(state, assignment.id, type, summary, nextAction, { state: status, ...details }, action, assignment.focusedSessionId);
  }

  private recordEvent(state: DurableState, assignmentId: string, type: EventType, summary: string, nextAction?: string,
    details?: Record<string, unknown>, action?: OrchestrationEventAction, sessionId?: string): OrchestrationEvent {
    const nextSequence = Math.max(state.nextEventSequence ?? 1,
      ...state.events.map((event) => event.sequence ?? 0),
      ...Object.values(state.eventCursors ?? {}).map((cursor) => cursor.lastSequence + 1));
    const event: OrchestrationEvent = {
      id: randomUUID(), assignmentId, type, action, sessionId, sequence: nextSequence, summary, createdAt: now(), nextAction, details,
    };
    state.nextEventSequence = nextSequence + 1;
    state.events.push(event);
    return event;
  }

  private effectivePresence(presence: SessionPresence, referenceTime: number): PresenceStatus | "stale" {
    return Date.parse(presence.lastSeenAt) + PRESENCE_STALE_AFTER_MS < referenceTime ? "stale" : presence.status;
  }

  private eventRelevant(state: DurableState, event: OrchestrationEvent, sessionId: string): boolean {
    if (event.sessionId === sessionId) return true;
    if (!event.assignmentId) return false;
    const assignmentIds = new Set<string>();
    const queue = [sessionId];
    while (queue.length) {
      const owner = queue.shift()!;
      for (const assignment of state.assignments.filter((item) => item.coordinatorSessionId === owner || item.focusedSessionId === owner)) {
        if (assignmentIds.has(assignment.id)) continue;
        assignmentIds.add(assignment.id);
        if (assignment.coordinatorSessionId === owner && assignment.targetRole === "domain-coordinator") queue.push(assignment.focusedSessionId);
      }
    }
    return assignmentIds.has(event.assignmentId);
  }

  private write(state: DurableState): void {
    state.events = state.events.slice(-MAX_EVENT_LEDGER);
    if (state.eventCursors) {
      for (const cursor of Object.values(state.eventCursors)) cursor.eventIds = cursor.eventIds.slice(-MAX_CURSOR_EVENT_IDS);
    }
    mkdirSync(dirname(this.path), { recursive: true, mode: 0o700 });
    const temporary = `${this.path}.${process.pid}.${randomUUID()}.tmp`;
    writeFileSync(temporary, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
    renameSync(temporary, this.path);
  }
}
