import type { ExtensionAPI, ExtensionCommandContext, ExtensionContext } from "@earendil-works/pi-coding-agent";

import { activeCanonicalBinding } from "./binding";
import type { OrchestrationEvent, PresenceStatus } from "./model";
import { appendBaselineContext, appendPendingContext, appendRoleContext, footerStatus, pendingAssignmentContext, roleContext } from "./prompt";
import { LocalStateStore } from "./state";
import { isCanonicalSessionId, registerOrchestratorTools } from "./tools";

const STATUS_KEY = "pi-session-orchestrator";
const EVENT_ENTRY_TYPE = "pi-session-orchestrator-event";
const EVENT_WIDGET_KEY = "pi-session-orchestrator-events";
const MAX_RENDERED_EVENTS = 8;

export function eventIndicatorLines(events: readonly OrchestrationEvent[]): string[] {
  const lines = events.slice(0, MAX_RENDERED_EVENTS).map((event) => {
    const action = event.action?.replaceAll("_", " ") ?? event.type.replaceAll("_", " ");
    const summary = event.summary.replace(/[\r\n]+/g, " ").trim().slice(0, 120);
    return `↳ orchestration · ${action}: ${summary}`;
  });
  if (events.length > MAX_RENDERED_EVENTS) lines.push(`↳ orchestration · ${events.length - MAX_RENDERED_EVENTS} more updates`);
  return lines;
}

type EventPresentationContext = Pick<ExtensionContext, "ui" | "mode" | "hasUI" | "sessionManager">;
type RenderComponent = { render(width: number): string[]; invalidate(): void };
type EntryRendererRegistrar = (customType: string, renderer: (entry: { data?: unknown }, options: { expanded: boolean }, theme: { fg(color: string, text: string): string }) => RenderComponent | undefined) => void;
type EntryAppender = (customType: string, data?: unknown) => void;

function isEntryRendererRegistrar(value: unknown): value is EntryRendererRegistrar {
  return typeof value === "function";
}

function isEntryAppender(value: unknown): value is EntryAppender {
  return typeof value === "function";
}

function registerEventEntryRenderer(pi: ExtensionAPI): boolean {
  const registrar = pi.registerEntryRenderer;
  if (!isEntryRendererRegistrar(registrar)) return false;
  registrar.call(pi, EVENT_ENTRY_TYPE, (entry, _options, theme) => {
    const data = entry.data as { events?: unknown } | undefined;
    const events = Array.isArray(data?.events) ? data.events.filter((event): event is OrchestrationEvent => (
      typeof event === "object" && event !== null && typeof (event as OrchestrationEvent).summary === "string"
    )) : [];
    const lines = eventIndicatorLines(events);
    return {
      render: (width) => lines.map((line) => theme.fg("dim", line.slice(0, width))),
      invalidate: () => undefined,
    };
  });
  return true;
}

export function presentUnseenEvents(store: LocalStateStore, ctx: EventPresentationContext, pi?: ExtensionAPI): void {
  // Test doubles and legacy callers may not expose Pi's run mode; do not consume a cursor without a render path.
  if (ctx.mode === undefined && !ctx.hasUI) return;
  let events: OrchestrationEvent[];
  try {
    events = store.consumeRelevantEvents(ctx.sessionManager.getSessionId(), MAX_RENDERED_EVENTS);
  } catch {
    return;
  }
  if (!events.length) return;

  const lines = eventIndicatorLines(events);
  const appender = pi?.appendEntry;
  if (ctx.mode === "tui" && isEntryAppender(appender)) {
    try {
      appender.call(pi, EVENT_ENTRY_TYPE, { version: 1, events });
      return;
    } catch {
      // Fall through to the supported widget/notification path.
    }
  }
  if (ctx.mode === "tui") ctx.ui.setWidget(EVENT_WIDGET_KEY, lines, { placement: "aboveEditor" });
  if (ctx.hasUI) ctx.ui.notify(`Orchestration: ${events.length} new update${events.length === 1 ? "" : "s"}.`, "info");
}
const COMMAND_HELP = `Usage:
/orchestrator coordinator
/orchestrator assign {"focusedSessionId":"...","role":"domain-coordinator|focused-session","objective":"...","allowedScope":"...","worktree":"optional target path"}
/orchestrator attach <assignment-id>
/orchestrator start
/orchestrator handoff {"outcome":"...","changedSurfaces":[],"checks":[],"risks":[]}
/orchestrator accept <assignment-id> [reason]
/orchestrator return <assignment-id> <reason>
/orchestrator decision {"summary":"...","options":["..."],"recommendation":"..."}
/orchestrator propose-scope-change {"requestedScope":"...","scopeRevision":1,"reason":"...","evidence":["..."]}
/orchestrator approve-scope-change {"assignmentId":"...","proposalId":"...","scopeRevision":1}
/orchestrator approve-scope-change-human {"proposalId":"...","scopeRevision":1}
/orchestrator reconcile-scope-change {"reconciliationId":"...","scopeRevision":2}
/orchestrator block <reason>
/orchestrator abandon <reason>
/orchestrator status`;

function sessionId(ctx: ExtensionCommandContext): string {
  return ctx.sessionManager.getSessionId();
}

function objectArgument(args: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(args);
  } catch {
    throw new Error("Expected a valid JSON object");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error("Expected a JSON object");
  return parsed as Record<string, unknown>;
}

function text(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} must be a non-empty string`);
  return value.trim();
}

function strings(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) throw new Error(`${field} must be an array of strings`);
  return value;
}

function integer(value: unknown, field: string): number {
  if (!Number.isInteger(value) || (value as number) < 1) throw new Error(`${field} must be a positive integer`);
  return value as number;
}

function assignmentRole(value: unknown): "domain-coordinator" | "focused-session" | undefined {
  if (value === undefined) return undefined;
  if (value === "domain-coordinator" || value === "focused-session") return value;
  throw new Error("role must be domain-coordinator or focused-session");
}

export function presenceForSessionStart(reason: "startup" | "reload" | "new" | "resume" | "fork"): PresenceStatus {
  return reason === "reload" ? "reloading" : "live";
}

export function presenceForSessionShutdown(reason: "quit" | "reload" | "new" | "resume" | "fork"): PresenceStatus {
  return reason === "reload" ? "reloading" : "suspended";
}

function refreshStatus(store: LocalStateStore, ctx: { ui: { setStatus(key: string, text: string | undefined): void }; sessionManager: { getSessionId(): string } }): void {
  try {
    ctx.ui.setStatus(STATUS_KEY, footerStatus(store.read(), ctx.sessionManager.getSessionId()));
  } catch {
    // Corrupt or unavailable local state is deliberately unmanaged, never inferred.
    ctx.ui.setStatus(STATUS_KEY, undefined);
  }
}

export async function runCommand(store: LocalStateStore, args: string, ctx: ExtensionCommandContext,
  present: (ctx: EventPresentationContext) => void = (current) => presentUnseenEvents(store, current)): Promise<void> {
  const [action = "", ...rest] = args.trim().split(/\s+/);
  const remainder = rest.join(" ").trim();
  const currentSessionId = sessionId(ctx);

  try {
    switch (action) {
      case "coordinator":
        store.registerCoordinator(currentSessionId);
        ctx.ui.notify("Coordinator role recorded locally.", "info");
        break;
      case "assign": {
        const input = objectArgument(remainder);
        const focusedSessionId = text(input.focusedSessionId, "focusedSessionId");
        if (!isCanonicalSessionId(focusedSessionId)) throw new Error("assign requires a full canonical Pi session ID");
        const assignment = store.createAssignment({
          coordinatorSessionId: currentSessionId,
          focusedSessionId,
          targetRole: assignmentRole(input.role),
          binding: activeCanonicalBinding(typeof input.worktree === "string" ? text(input.worktree, "worktree") : ctx.cwd),
          objective: text(input.objective, "objective"),
          allowedScope: text(input.allowedScope, "allowedScope"),
        });
        ctx.ui.notify(`Assignment ${assignment.id} created; the ${assignment.targetRole} must attach explicitly.`, "info");
        break;
      }
      case "attach": {
        const assignment = store.attach(text(remainder, "assignment ID"), currentSessionId, activeCanonicalBinding(ctx.cwd));
        ctx.ui.notify(`Attached to assignment ${assignment.id}.`, "info");
        break;
      }
      case "start": {
        const assignment = store.activate(currentSessionId);
        ctx.ui.notify(`Assignment ${assignment.id} is active.`, "info");
        break;
      }
      case "handoff": {
        const input = objectArgument(remainder);
        const handoff = store.submitHandoff(currentSessionId, {
          outcome: text(input.outcome, "outcome"),
          artifactIdentity: typeof input.artifactIdentity === "string" ? input.artifactIdentity : undefined,
          changedSurfaces: strings(input.changedSurfaces, "changedSurfaces"),
          checks: strings(input.checks, "checks"),
          risks: strings(input.risks, "risks"),
        });
        ctx.ui.notify(`Handoff ${handoff.id} recorded locally; it does not authorize delivery.`, "info");
        break;
      }
      case "accept":
      case "return": {
        const [assignmentId = "", ...reasonParts] = remainder.split(/\s+/);
        const reason = reasonParts.join(" ").trim();
        if (action === "return" && !reason) throw new Error("A return reason is required");
        store.acceptOrReturn(currentSessionId, text(assignmentId, "assignment ID"), action === "accept" ? "accepted" : "returned", reason || undefined);
        ctx.ui.notify(`Handoff ${action === "accept" ? "accepted" : "returned"}.`, "info");
        break;
      }
      case "decision": {
        const input = objectArgument(remainder);
        store.decide(currentSessionId, text(input.summary, "summary"), input);
        ctx.ui.notify("Decision request recorded locally; delivery remains a pi-intercom concern.", "info");
        break;
      }
      case "propose-scope-change": {
        const input = objectArgument(remainder);
        const proposal = store.proposeScopeChange(currentSessionId, {
          baseScopeRevision: integer(input.scopeRevision, "scopeRevision"),
          requestedScope: text(input.requestedScope, "requestedScope"),
          reason: text(input.reason, "reason"),
          evidence: strings(input.evidence, "evidence"),
        });
        ctx.ui.notify(`Scope-change proposal ${proposal.id} recorded at revision ${proposal.baseScopeRevision}.`, "info");
        break;
      }
      case "approve-scope-change": {
        const input = objectArgument(remainder);
        const assignment = store.approveScopeChange(currentSessionId, text(input.assignmentId, "assignmentId"), text(input.proposalId, "proposalId"), integer(input.scopeRevision, "scopeRevision"));
        ctx.ui.notify(`Scope change approved; assignment is now at revision ${assignment.scopeRevision ?? 1}.`, "info");
        break;
      }
      case "approve-scope-change-human": {
        const input = objectArgument(remainder);
        const assignment = store.approveScopeChangeAsHuman(currentSessionId, text(input.proposalId, "proposalId"), integer(input.scopeRevision, "scopeRevision"));
        ctx.ui.notify(`Direct human scope approval recorded at revision ${assignment.scopeRevision ?? 1}; coordinator reconciliation is required.`, "info");
        break;
      }
      case "reconcile-scope-change": {
        const input = objectArgument(remainder);
        store.reconcileScopeChange(currentSessionId, text(input.reconciliationId, "reconciliationId"), integer(input.scopeRevision, "scopeRevision"));
        ctx.ui.notify("Direct-human scope change reconciled without a second approval.", "info");
        break;
      }
      case "block":
      case "abandon":
        store.markTerminal(currentSessionId, action === "block" ? "blocked" : "abandoned", text(remainder, "reason"));
        ctx.ui.notify(`Assignment marked ${action === "block" ? "blocked" : "abandoned"}.`, "info");
        break;
      case "status": {
        const role = store.getRole(currentSessionId);
        ctx.ui.notify(role.kind === "unmanaged" ? "Unmanaged session." : `${role.kind} session: ${currentSessionId}`, "info");
        break;
      }
      default:
        ctx.ui.notify(COMMAND_HELP, "info");
        return;
    }
    present(ctx);
    refreshStatus(store, ctx);
  } catch (error: unknown) {
    ctx.ui.notify(error instanceof Error ? error.message : "Orchestration command failed", "error");
    refreshStatus(store, ctx);
  }
}

const DISCOVERABLE_ACTIONS = [
  "coordinator", "assign", "attach", "start", "handoff", "accept", "return", "decision", "propose-scope-change", "approve-scope-change", "approve-scope-change-human", "reconcile-scope-change", "block", "abandon", "status",
] as const;

function registerDiscoverableAliases(pi: ExtensionAPI, store: LocalStateStore,
  present: (ctx: EventPresentationContext) => void): void {
  for (const action of DISCOVERABLE_ACTIONS) {
    pi.registerCommand(`orchestrator:${action}`, {
      description: `Run /orchestrator ${action}`,
      handler: (args, ctx) => runCommand(store, `${action} ${args}`.trim(), ctx, present),
    });
  }
}

export default function sessionOrchestratorExtension(pi: ExtensionAPI, store = new LocalStateStore()): void {
  const entryRendererAvailable = registerEventEntryRenderer(pi);
  const present = (ctx: EventPresentationContext) => presentUnseenEvents(store, ctx, entryRendererAvailable ? pi : undefined);

  pi.registerCommand("orchestrator", {
    description: "Explicit durable coordinator/focused assignment commands",
    handler: (args, ctx) => runCommand(store, args, ctx, present),
  });
  registerDiscoverableAliases(pi, store, present);
  registerOrchestratorTools(pi, store, present);

  pi.on("session_start", (event, ctx) => {
    store.observePresence(ctx.sessionManager.getSessionId(), presenceForSessionStart(event.reason));
    present(ctx);
    refreshStatus(store, ctx);
  });
  pi.on("session_shutdown", (event, ctx) => {
    store.observePresence(ctx.sessionManager.getSessionId(), presenceForSessionShutdown(event.reason), event.reason);
    present(ctx);
  });
  pi.on("before_agent_start", (_event, ctx) => {
    store.observePresence(ctx.sessionManager.getSessionId(), "live");
    present(ctx);
    refreshStatus(store, ctx);
    try {
      const state = store.read();
      const section = roleContext(state, ctx.sessionManager.getSessionId());
      const pending = pendingAssignmentContext(state, ctx.sessionManager.getSessionId());
      const systemPrompt = appendRoleContext(appendPendingContext(appendBaselineContext(ctx.getSystemPrompt()), pending), section);
      return systemPrompt === ctx.getSystemPrompt() ? undefined : { systemPrompt };
    } catch {
      return undefined;
    }
  });
}
