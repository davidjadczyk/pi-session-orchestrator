import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

import { activeCanonicalBinding } from "./binding";
import type { AssignmentRole, DurableState } from "./model";
import { footerStatus, roleForState } from "./prompt";
import { LocalStateStore } from "./state";

const assignmentParameters = Type.Object({
  sessionId: Type.String({ minLength: 1 }),
  role: Type.Union([Type.Literal("domain-coordinator"), Type.Literal("focused-session")]),
  objective: Type.String({ minLength: 1 }),
  allowedScope: Type.String({ minLength: 1 }),
  worktree: Type.Optional(Type.String({ minLength: 1 })),
});

const updateParameters = Type.Object({
  operation: Type.Union([
    Type.Literal("register-root"),
    Type.Literal("assign-existing"),
    Type.Literal("attach"),
    Type.Literal("start"),
    Type.Literal("request-decision"),
    Type.Literal("propose-scope-change"),
    Type.Literal("approve-scope-change"),
    Type.Literal("approve-scope-change-human"),
    Type.Literal("reconcile-scope-change"),
    Type.Literal("submit-handoff"),
    Type.Literal("settle"),
    Type.Literal("terminal"),
  ]),
  assignments: Type.Optional(Type.Array(assignmentParameters, { minItems: 1 })),
  assignmentId: Type.Optional(Type.String({ minLength: 1 })),
  proposalId: Type.Optional(Type.String({ minLength: 1 })),
  reconciliationId: Type.Optional(Type.String({ minLength: 1 })),
  scopeRevision: Type.Optional(Type.Integer({ minimum: 1 })),
  requestedScope: Type.Optional(Type.String({ minLength: 1 })),
  evidence: Type.Optional(Type.Array(Type.String())),
  summary: Type.Optional(Type.String({ minLength: 1 })),
  details: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
  outcome: Type.Optional(Type.Union([
    Type.Literal("accepted"),
    Type.Literal("returned"),
    Type.Literal("blocked"),
    Type.Literal("abandoned"),
  ])),
  reason: Type.Optional(Type.String({ minLength: 1 })),
  artifactIdentity: Type.Optional(Type.String()),
  changedSurfaces: Type.Optional(Type.Array(Type.String())),
  checks: Type.Optional(Type.Array(Type.String())),
  risks: Type.Optional(Type.Array(Type.String())),
});

type ToolContext = Pick<ExtensionContext, "cwd" | "sessionManager" | "ui" | "mode" | "hasUI">;
export type OrchestrationEventPresenter = (ctx: ToolContext) => void;
type AssignmentInput = {
  sessionId: string;
  role: AssignmentRole;
  objective: string;
  allowedScope: string;
  worktree?: string;
};

type UpdateInput = {
  operation: "register-root" | "assign-existing" | "attach" | "start" | "request-decision" | "propose-scope-change" | "approve-scope-change" | "approve-scope-change-human" | "reconcile-scope-change" | "submit-handoff" | "settle" | "terminal";
  assignments?: AssignmentInput[];
  assignmentId?: string;
  proposalId?: string;
  reconciliationId?: string;
  scopeRevision?: number;
  requestedScope?: string;
  evidence?: string[];
  summary?: string;
  details?: Record<string, unknown>;
  outcome?: "accepted" | "returned" | "blocked" | "abandoned";
  reason?: string;
  artifactIdentity?: string;
  changedSurfaces?: string[];
  checks?: string[];
  risks?: string[];
};

const SESSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isCanonicalSessionId(value: string): boolean {
  return SESSION_ID.test(value);
}

function requireValue<T>(value: T | undefined, field: string): T {
  if (value === undefined || value === "") throw new Error(`${field} is required for this operation`);
  return value;
}

function compactAssignment(assignment: DurableState["assignments"][number]) {
  return {
    id: assignment.id,
    sessionId: assignment.focusedSessionId,
    role: assignment.targetRole ?? "focused-session",
    objective: assignment.objective,
    allowedScope: assignment.allowedScope,
    scopeRevision: assignment.scopeRevision ?? 1,
    status: assignment.status,
  };
}

function snapshot(store: LocalStateStore, sessionId: string) {
  const state = store.read();
  const role = roleForState(state, sessionId);
  const pendingAttachments = state.assignments
    .filter((assignment) => assignment.focusedSessionId === sessionId && assignment.status === "created")
    .map(compactAssignment);
  const directAssignments = state.assignments
    .filter((assignment) => assignment.coordinatorSessionId === sessionId && assignment.status !== "accepted" && assignment.status !== "returned")
    .slice(0, 12)
    .map((assignment) => ({ ...compactAssignment(assignment), presence: store.presenceFor(assignment.focusedSessionId) }));
  const assignmentIds = new Set(state.assignments
    .filter((assignment) => assignment.coordinatorSessionId === sessionId || assignment.focusedSessionId === sessionId)
    .map((assignment) => assignment.id));
  const scopeChanges = state.scopeChanges ?? { version: 1 as const, proposals: [], reconciliations: [] };

  return {
    sessionId,
    role: role.kind,
    presence: store.presenceFor(sessionId),
    footer: footerStatus(state, sessionId),
    pendingAttachments,
    directAssignments,
    scope: {
      assignments: state.assignments.filter((assignment) => assignmentIds.has(assignment.id)).map(compactAssignment),
      proposals: scopeChanges.proposals.filter((proposal) => assignmentIds.has(proposal.assignmentId)),
      reconciliations: scopeChanges.reconciliations.filter((reconciliation) => assignmentIds.has(reconciliation.assignmentId)),
    },
    nextPromptContext: "Applies on the next model run after a successful state transition.",
  };
}

function response(store: LocalStateStore, sessionId: string, message: string) {
  const state = snapshot(store, sessionId);
  return {
    content: [{ type: "text" as const, text: `${message}\n${JSON.stringify(state)}` }],
    details: state,
  };
}

function refreshFooter(store: LocalStateStore, ctx: ToolContext): void {
  ctx.ui.setStatus("pi-session-orchestrator", footerStatus(store.read(), ctx.sessionManager.getSessionId()));
}

function update(store: LocalStateStore, params: UpdateInput, ctx: ToolContext): string {
  const sessionId = ctx.sessionManager.getSessionId();

  switch (params.operation) {
    case "register-root":
      store.registerCoordinator(sessionId);
      return "Registered the current session as a root coordinator.";
    case "assign-existing": {
      const assignments = requireValue(params.assignments, "assignments");
      if (assignments.some((assignment) => !isCanonicalSessionId(assignment.sessionId))) throw new Error("assign-existing requires full canonical Pi session IDs");
      const created = store.createAssignments(assignments.map((assignment) => ({
        coordinatorSessionId: sessionId,
        focusedSessionId: assignment.sessionId,
        targetRole: assignment.role,
        binding: activeCanonicalBinding(assignment.worktree ?? ctx.cwd),
        objective: assignment.objective,
        allowedScope: assignment.allowedScope,
      })));
      return `Created ${created.length} pending assignment${created.length === 1 ? "" : "s"}; each target must attach explicitly.`;
    }
    case "attach":
      store.attach(requireValue(params.assignmentId, "assignmentId"), sessionId, activeCanonicalBinding(ctx.cwd));
      return "Attached the current session to its validated assignment.";
    case "start":
      store.activate(sessionId);
      return "Marked the current assignment active.";
    case "request-decision":
      store.decide(sessionId, requireValue(params.summary, "summary"), params.details ?? {});
      return "Recorded a coordinator decision request.";
    case "propose-scope-change":
      store.proposeScopeChange(sessionId, {
        baseScopeRevision: requireValue(params.scopeRevision, "scopeRevision"),
        requestedScope: requireValue(params.requestedScope, "requestedScope"),
        reason: requireValue(params.reason, "reason"),
        evidence: params.evidence ?? [],
      });
      return "Recorded a scope-change proposal against the current assignment revision.";
    case "approve-scope-change":
      store.approveScopeChange(sessionId, requireValue(params.assignmentId, "assignmentId"), requireValue(params.proposalId, "proposalId"), requireValue(params.scopeRevision, "scopeRevision"));
      return "Approved the scope change and reissued the assignment at the next scope revision.";
    case "approve-scope-change-human":
      store.approveScopeChangeAsHuman(sessionId, requireValue(params.proposalId, "proposalId"), requireValue(params.scopeRevision, "scopeRevision"));
      return "Recorded direct human scope approval; coordinator reconciliation is now required.";
    case "reconcile-scope-change":
      store.reconcileScopeChange(sessionId, requireValue(params.reconciliationId, "reconciliationId"), requireValue(params.scopeRevision, "scopeRevision"));
      return "Reconciled the direct-human scope change without a second approval.";
    case "submit-handoff":
      store.submitHandoff(sessionId, {
        outcome: requireValue(params.summary, "summary"),
        artifactIdentity: params.artifactIdentity,
        changedSurfaces: params.changedSurfaces ?? [],
        checks: params.checks ?? [],
        risks: params.risks ?? [],
      });
      return "Recorded a handoff; it requires explicit coordinator settlement and does not authorize delivery.";
    case "settle": {
      const outcome = requireValue(params.outcome, "outcome");
      if (outcome !== "accepted" && outcome !== "returned") throw new Error("settle requires outcome accepted or returned");
      store.acceptOrReturn(sessionId, requireValue(params.assignmentId, "assignmentId"), outcome, params.reason);
      return `Marked the handoff ${outcome}.`;
    }
    case "terminal": {
      const outcome = requireValue(params.outcome, "outcome");
      if (outcome !== "blocked" && outcome !== "abandoned") throw new Error("terminal requires outcome blocked or abandoned");
      store.markTerminal(sessionId, outcome, requireValue(params.reason, "reason"));
      return `Marked the current assignment ${outcome}.`;
    }
  }
}

/** Registers the narrow agent-facing control plane; session creation remains external. */
export function registerOrchestratorTools(pi: ExtensionAPI, store: LocalStateStore,
  present?: OrchestrationEventPresenter): void {
  pi.registerTool({
    name: "orchestrator_status",
    label: "Orchestrator Status",
    description: "Read the current session's durable orchestration role, pending attachment, direct assignments, footer, and next prompt-context state.",
    promptSnippet: "Inspect explicit managed-session coordination state.",
    promptGuidelines: ["Use orchestrator_status before creating or changing managed session coordination state."],
    parameters: Type.Object({}),
    executionMode: "sequential",
    async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
      store.observePresence(ctx.sessionManager.getSessionId(), "live");
      present?.(ctx);
      return response(store, ctx.sessionManager.getSessionId(), "Read current orchestration state.");
    },
  });

  pi.registerTool({
    name: "orchestrator_update",
    label: "Orchestrator Update",
    description: "Explicitly register, assign, attach, transition, hand off, settle, or end durable managed-session coordination state. It never creates sessions, worktrees, branches, or delivery actions.",
    promptSnippet: "Explicitly update managed-session coordination state.",
    promptGuidelines: ["Use orchestrator_update only for explicit coordination transitions; never infer a role from conversation, repository topology, or session creation."],
    parameters: updateParameters,
    executionMode: "sequential",
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      try {
        store.observePresence(ctx.sessionManager.getSessionId(), "live", undefined, false);
        const message = update(store, params as UpdateInput, ctx);
        present?.(ctx);
        refreshFooter(store, ctx);
        return response(store, ctx.sessionManager.getSessionId(), message);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Orchestration update failed";
        return {
          content: [{ type: "text" as const, text: message }],
          details: snapshot(store, ctx.sessionManager.getSessionId()),
        };
      }
    },
  });

  pi.registerTool({
    name: "orchestrator_ledger",
    label: "Orchestrator Ledger",
    description: "Read a bounded per-root workflow ledger derived from typed assignments, events, handoffs, and presence. It never copies Pi or intercom transcripts.",
    promptSnippet: "Inspect a compact derived workflow ledger.",
    promptGuidelines: ["Use orchestrator_ledger for explicit read-only coordination analysis, not for ordinary status checks."],
    parameters: Type.Object({ limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 50 })) }),
    executionMode: "sequential",
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const ledger = store.workflowLedger(ctx.sessionManager.getSessionId(), params.limit ?? 20);
      return { content: [{ type: "text" as const, text: JSON.stringify(ledger) }], details: ledger };
    },
  });
}
