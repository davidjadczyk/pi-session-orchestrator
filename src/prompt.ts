import type { Assignment, DurableState, SessionRole } from "./model";

export const BASELINE_CONTEXT_MARKER = "## pi-session-orchestrator baseline";
export const ROLE_CONTEXT_MARKER = "## pi-session-orchestrator role context";
export const PENDING_CONTEXT_MARKER = "## pi-session-orchestrator pending assignment";

export function baselineContext(): string {
  return `${BASELINE_CONTEXT_MARKER}
This extension supports explicit, durable coordination among existing Pi sessions. Small, known work may remain inline. Use orchestrator_status to inspect state and orchestrator_update to record transitions. Do not infer roles from conversation, repository topology, or session creation: orchestration or delegation requires an explicit durable assignment. When work becomes larger than its bounded scope, use fast focused delegation after recording that assignment. Keep coordinator topics with coordinators and focused implementation detail with focused sessions; do not dump either across that boundary. Session creation and pi-intercom messaging remain separate concerns; this extension neither creates sessions nor transfers authority or delivery authority.`;
}

export function appendBaselineContext(systemPrompt: string): string {
  if (systemPrompt.includes(BASELINE_CONTEXT_MARKER)) return systemPrompt;
  return `${systemPrompt}\n\n${baselineContext()}`;
}

function activeAssignments(state: DurableState, coordinatorSessionId: string): Assignment[] {
  return state.assignments.filter((assignment) => assignment.coordinatorSessionId === coordinatorSessionId
    && ["created", "attached", "active", "handoff-submitted"].includes(assignment.status));
}

function scopeRevision(assignment: Assignment): number {
  return assignment.scopeRevision ?? 1;
}

function scopeObligations(state: DurableState, assignmentIds: Set<string>): string {
  const scopeChanges = state.scopeChanges ?? { version: 1 as const, proposals: [], reconciliations: [] };
  const proposals = scopeChanges.proposals.filter((proposal) => assignmentIds.has(proposal.assignmentId) && proposal.status === "pending");
  const reconciliations = scopeChanges.reconciliations.filter((reconciliation) => assignmentIds.has(reconciliation.assignmentId) && reconciliation.status === "pending");
  const parts: string[] = [];
  if (proposals.length) parts.push(`pending proposals: ${proposals.map((proposal) => `${proposal.id} (revision ${proposal.baseScopeRevision})`).join(", ")}`);
  if (reconciliations.length) parts.push(`reconciliation required: ${reconciliations.map((item) => `${item.id} (revision ${item.scopeRevision})`).join(", ")}`);
  return parts.join("; ") || "none";
}

export function roleForState(state: DurableState, sessionId: string): SessionRole {
  const assignment = [...state.assignments].reverse().find((item) => item.focusedSessionId === sessionId
    && item.status !== "created");
  if (assignment?.targetRole === "domain-coordinator") return { kind: "domain-coordinator", assignment };
  if (assignment) return { kind: "focused-session", assignment };
  return state.coordinators.includes(sessionId) ? { kind: "root-coordinator" } : { kind: "unmanaged" };
}

function childBuckets(state: DurableState, coordinatorSessionId: string): Record<string, number> {
  const buckets: Record<string, number> = { children: 0, working: 0, ready: 0, pending: 0, attention: 0 };
  for (const assignment of state.assignments.filter((item) => item.coordinatorSessionId === coordinatorSessionId)) {
    if (assignment.targetRole === "domain-coordinator") {
      const nested = childBuckets(state, assignment.focusedSessionId);
      for (const [key, value] of Object.entries(nested)) buckets[key] += value;
      continue;
    }
    if (["accepted", "returned", "abandoned"].includes(assignment.status)) continue;
    buckets.children += 1;
    if (assignment.status === "active") buckets.working += 1;
    else if (assignment.status === "attached") buckets.ready += 1;
    else if (assignment.status === "created") buckets.pending += 1;
    else buckets.attention += 1;
  }
  return buckets;
}

export function pendingAssignmentContext(state: DurableState, sessionId: string): string | undefined {
  const assignment = state.assignments.find((item) => item.focusedSessionId === sessionId && item.status === "created");
  return assignment ? `${PENDING_CONTEXT_MARKER}
A pending ${assignment.targetRole ?? "focused-session"} assignment awaits your explicit attachment. Coordinator ID: ${assignment.coordinatorSessionId}. Objective: ${assignment.objective}. Validate your binding, then use orchestrator_update with operation attach and assignmentId ${assignment.id}.` : undefined;
}

export function appendPendingContext(systemPrompt: string, section: string | undefined): string {
  if (!section || systemPrompt.includes(PENDING_CONTEXT_MARKER)) return systemPrompt;
  return `${systemPrompt}\n\n${section}`;
}

export function roleContext(state: DurableState, sessionId: string): string | undefined {
  const role = roleForState(state, sessionId);
  if (role.kind === "unmanaged") return undefined;

  if (role.kind === "root-coordinator" || role.kind === "domain-coordinator") {
    const assignments = activeAssignments(state, sessionId)
      .map((assignment) => `- ${assignment.id}: ${assignment.targetRole ?? "focused-session"} ${assignment.focusedSessionId}; ${assignment.status}; revision ${scopeRevision(assignment)}; ${assignment.objective}`)
      .join("\n") || "- none";
    const assignmentIds = new Set(activeAssignments(state, sessionId).map((assignment) => assignment.id));
    const obligations = scopeObligations(state, assignmentIds);
    const roleName = role.kind === "root-coordinator" ? "root coordinator" : "domain coordinator";
    return `${ROLE_CONTEXT_MARKER}
Role: ${roleName}. Session ID: ${sessionId}.
Active assignment summaries:
${assignments}
Route cross-session decisions, preserve ownership boundaries, and explicitly accept or return handoffs. Scope-change obligations: ${obligations}. Approve only current proposals within the assigned boundary; reconcile direct-human changes without a second approval.
Keep overarching coordination topics here; do not push them into focused-session context or pull focused implementation detail into this context. This does not replace the governing orchestration framework or transfer authority.`;
  }

  const { assignment } = role;
  const obligations = scopeObligations(state, new Set([assignment.id]));
  return `${ROLE_CONTEXT_MARKER}
Role: focused session. Coordinator ID: ${assignment.coordinatorSessionId}. Assignment: ${assignment.id} (${assignment.status}).
Objective: ${assignment.objective}
Allowed scope: ${assignment.allowedScope}
Scope revision: ${scopeRevision(assignment)}
Scope-change obligations: ${obligations}
Binding: repository ${assignment.binding.repository}; worktree ${assignment.binding.worktree}.
Stay within scope; independently report blockers, dependencies, scope changes, and decisions. If the issue grows beyond this bounded scope, promptly ask the coordinator for explicit re-scoping or delegation; use orchestrator_update operation propose-scope-change with the current scopeRevision, a narrow requestedScope, reason, and evidence; do not absorb the change silently. Keep focused implementation detail here; do not take on overarching coordinator topics. Handoff format: outcome, artifact identity, changed surfaces, checks, risks. A handoff never authorizes delivery.`;
}

export function appendRoleContext(systemPrompt: string, section: string | undefined): string {
  if (!section || systemPrompt.includes(ROLE_CONTEXT_MARKER)) return systemPrompt;
  return `${systemPrompt}\n\n${section}`;
}

export function footerStatus(state: DurableState, sessionId: string): string | undefined {
  const role = roleForState(state, sessionId);
  if (role.kind === "unmanaged") return pendingAssignmentContext(state, sessionId) ? "⏳ Pending focused assignment" : undefined;
  if (role.kind === "focused-session") return "🎯 Focused session";
  const buckets = childBuckets(state, sessionId);
  const label = role.kind === "root-coordinator" ? "Root" : "Domain";
  const parts = [`🧭 ${label} · ${buckets.children} children`];
  for (const key of ["working", "ready", "pending", "attention"] as const) if (buckets[key]) parts.push(`${buckets[key]} ${key}`);
  return parts.join(" · ");
}
