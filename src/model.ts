export const ASSIGNMENT_STATUSES = [
  "created",
  "attached",
  "active",
  "handoff-submitted",
  "accepted",
  "returned",
  "blocked",
  "abandoned",
] as const;

export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];
export type EventType = "progress" | "blocker" | "decision_request" | "handoff" | "review_result";
export type OrchestrationEventAction =
  | "coordinator_registered"
  | "assignment_created"
  | "assignment_attached"
  | "assignment_started"
  | "handoff_submitted"
  | "handoff_accepted"
  | "handoff_returned"
  | "assignment_blocked"
  | "assignment_abandoned"
  | "decision_requested"
  | "scope_change_proposed"
  | "scope_change_approved"
  | "scope_change_human_approved"
  | "scope_change_reconciled"
  | "presence_changed";
export type AssignmentRole = "domain-coordinator" | "focused-session";

export interface CanonicalBinding {
  repository: string;
  worktree: string;
}

export interface Assignment {
  id: string;
  coordinatorSessionId: string;
  focusedSessionId: string;
  binding: CanonicalBinding;
  objective: string;
  allowedScope: string;
  /** Revision of the durable allowed scope; legacy assignments hydrate as revision 1. */
  scopeRevision?: number;
  targetRole?: AssignmentRole;
  status: AssignmentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface HandoffRecord {
  id: string;
  assignmentId: string;
  submittedAt: string;
  outcome: string;
  artifactIdentity?: string;
  changedSurfaces: string[];
  checks: string[];
  risks: string[];
}

export interface OrchestrationEvent {
  id: string;
  /** Empty for coordinator registration or an unassigned presence observation. */
  assignmentId: string;
  /** Set for session-scoped events such as registration and presence. */
  sessionId?: string;
  type: EventType;
  /** Explicit mutation represented by this event; absent on legacy state entries. */
  action?: OrchestrationEventAction;
  /** Monotonic local ordering; absent on legacy state entries. */
  sequence?: number;
  createdAt: string;
  summary: string;
  nextAction?: string;
  details?: Record<string, unknown>;
}

export interface EventCursor {
  lastSequence: number;
  eventIds: string[];
}

export type ScopeChangeProposalStatus = "pending" | "approved";
export type ScopeChangeApprovalKind = "coordinator" | "direct-human";

export interface ScopeChangeProposal {
  id: string;
  assignmentId: string;
  requesterSessionId: string;
  baseScopeRevision: number;
  requestedScope: string;
  reason: string;
  evidence: string[];
  status: ScopeChangeProposalStatus;
  createdAt: string;
  updatedAt: string;
  approvalKind?: ScopeChangeApprovalKind;
  approvedBy?: string;
}

export interface ScopeReconciliation {
  id: string;
  assignmentId: string;
  scopeRevision: number;
  requestedScope: string;
  reason: string;
  evidence: string[];
  status: "pending" | "reconciled";
  createdAt: string;
  updatedAt: string;
}

/** Versioned extension state; the containing field remains optional for legacy files. */
export interface ScopeChangeState {
  version: 1;
  proposals: ScopeChangeProposal[];
  reconciliations: ScopeReconciliation[];
}

export type PresenceStatus = "live" | "reloading" | "suspended";

export interface SessionPresence {
  sessionId: string;
  status: PresenceStatus;
  lastSeenAt: string;
  lastShutdownReason?: string;
}

export interface DurableState {
  version: 1;
  coordinators: string[];
  assignments: Assignment[];
  handoffs: HandoffRecord[];
  events: OrchestrationEvent[];
  presence?: SessionPresence[];
  /** Optional fields keep state files written before event indicators readable. */
  nextEventSequence?: number;
  eventCursors?: Record<string, EventCursor>;
  /** Hydrated on read for legacy state files and written after scope changes are used. */
  scopeChanges?: ScopeChangeState;
}

export type SessionRole =
  | { kind: "root-coordinator" }
  | { kind: "domain-coordinator"; assignment: Assignment }
  | { kind: "focused-session"; assignment: Assignment }
  | { kind: "unmanaged" };

export const EMPTY_STATE: DurableState = {
  version: 1,
  coordinators: [],
  assignments: [],
  handoffs: [],
  events: [],
  presence: [],
  eventCursors: {},
  scopeChanges: { version: 1, proposals: [], reconciliations: [] },
};

export function isTerminal(status: AssignmentStatus): boolean {
  return ["accepted", "returned", "blocked", "abandoned"].includes(status);
}
