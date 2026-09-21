# Prompt injection contract

When `pi-session-orchestrator` is active, it injects a concise universal coordination baseline before each model run. When a session has explicit durable managed state, it also injects a concise role-specific section. Neither section is a second workflow policy or a source of authority.

## What users should configure

Users do **not** need to copy role or session context into `APPEND_SYSTEM.md`, `AGENTS.md`, or a custom system prompt when the extension is active. Keep durable, always-applicable policy in those normal locations. The extension supplies the changing root-coordinator, domain-coordinator, or focused-session facts from its managed assignment state.

## Prompt composition and precedence

A prompt has four complementary inputs:

1. **Always-on baseline policy** supplies stable safety, authority, and general operating rules.
2. **Extension-injected universal baseline** advertises explicit managed coordination and its narrow control-plane tools.
3. **Extension-injected role context** supplies current managed role and assignment facts only after an explicit durable transition.
4. **Repository/project instructions** supply repository-local conventions, commands, and delivery constraints.

The extension sections are factual and additive. They cannot override higher-authority system policy or repository/project instructions. An assignment may narrow the work a focused session performs, but it does not authorize actions that the governing policy or project instructions prohibit. If instructions conflict, follow the normal instruction hierarchy and the more restrictive applicable constraint.

Prompt composition is additive: this extension injects only its own named structured section and never replaces the whole system prompt. Later sections and sections owned by other extensions must remain intact.

## Universal coordination baseline

Every active extension session receives a named baseline that says small, known work may remain inline; managed multi-session coordination is available only through an explicit durable assignment; and roles are never inferred from conversation, repository, or session creation. `orchestrator_status` reads state and `orchestrator_update` records explicit state transitions. When work outgrows its bounded scope, record an assignment and use fast focused delegation rather than widening a session's context. Keep overarching coordination topics with coordinators and implementation detail with focused sessions; do not dump either across that boundary. Session creation and `pi-intercom` messaging remain separate concerns, and the extension transfers neither authority nor delivery authority.

This resolves the bootstrap problem: an unmanaged session knows how to enter explicit coordination without being falsely treated as a coordinator or focused session.

## Role-specific facts

For a root coordinator, the extension injects its canonical session identity, direct active assignments and lifecycle states, and its cross-boundary coordination and handoff obligations.

For a domain coordinator, it injects the same concise local coordination facts for its delegated boundary. It may coordinate focused sessions only.

For a focused session, it injects the parent/coordinator session ID, objective, allowed scope, canonical repository/worktree binding, escalation rules, and compact handoff format. It cannot create managed children. It retains implementation detail locally and escalates oversized work rather than absorbing broader coordination concerns.

The extension injects only the facts needed for that role and turn. A root footer may aggregate active focused descendants for display, but coordinator prompt context remains limited to direct assignments. The extension does not inject a full orchestration philosophy, unrelated assignment details, repository instructions, conversation history, secrets, or unsupported workflow state. Unknown or unavailable assignment data is omitted rather than invented.

## Pending assignments and operational recovery

A created assignment does not confer a managed role. When a target session ID has a pending assignment, the extension may inject a concise named attachment notice and show a pending footer so the target can validate its own binding and attach explicitly. Coordinators see operational child buckets: working, ready, pending, and attention. Session presence is recorded separately from assignment role; it becomes `stale` only after 30 minutes without an observation, and shutdown or stale presence never auto-detaches, promotes, or deletes a session. Recovery guidance is contextual: `pi --session <id>` restores a known session, while `/resume` or `pi -r` opens the picker.

`orchestrator_ledger` exposes a bounded read-only view derived from typed orchestration state. Its assignments, events, handoffs, and presence collections are each capped by the requested limit and report `total`, `returned`, and `truncated` metadata. It retains structured goals, decisions, handoffs, timestamps, and optional transport references, but never copies Pi or `pi-intercom` transcripts into the ledger or prompt.

## Unmanaged fallback

A session is unmanaged unless it explicitly attaches to a matching managed assignment. While the extension is active, an unmanaged session receives the universal baseline but no role/session section and no footer. If the extension is inactive or unavailable, it injects nothing. The extension makes no role inference from conversation text, working directory, or a session tree; the session otherwise continues with its normal Pi, project, and user-provided prompt configuration.

## Tool-driven bootstrap and adoption

`orchestrator_status` returns the current role, footer, pending attachment, direct assignments, and next prompt-context state. `orchestrator_update` records explicit `register-root`, `assign-existing`, `attach`, lifecycle, handoff, settlement, and terminal transitions.

A root may atomically adopt existing known sessions in an `assign-existing` batch. Both `orchestrator_update({ operation: "assign-existing" })` and `/orchestrator assign` require full canonical Pi session UUIDs; abbreviated display IDs are rejected. Assignment creation never creates a session or worktree. Each target remains unmanaged until it explicitly attaches from its own matching canonical Git worktree. A successful transition reports the new state immediately; role-specific injection begins on the next model run.
