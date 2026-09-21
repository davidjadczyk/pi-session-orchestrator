# Coordination model

**Status: Current behavior.**

The extension records explicit coordinator and focused-session roles, assignments, canonical repository/worktree bindings, lifecycle transitions, handoffs, and typed decisions. Relationships are not inferred from conversation, session topology, repository location, or worktree location.

Managed depth is limited to root coordinator → domain coordinator → focused session. Unmanaged sessions retain normal Pi behavior. Agent-callable `orchestrator_*` tools are the normal automated control plane; human `/orchestrator` commands provide direct operation and recovery.

Each assignment carries a durable scope revision (legacy state hydrates revision `1`). A focused session can use `propose-scope-change` with its current revision, a narrow requested scope, a reason, and evidence. Only the explicitly assigned coordinator can approve that current proposal; approval updates the assignment and increments the revision. A focused session may also record `approve-scope-change-human`, which updates the scope and revision immediately and creates a pending coordinator reconciliation obligation. Reconciliation acknowledges the change and does not approve it a second time. Stale proposals or revisions fail closed before state is written. These controls do not grant filesystem, worktree, session-management, delivery, or Git authority.
