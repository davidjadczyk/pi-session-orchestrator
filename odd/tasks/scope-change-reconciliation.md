# Scope-change reconciliation

## Context

Focused sessions must not continue on a stale or incompatible edit boundary. They need a durable way to propose a replacement scope to the coordinator, while direct human intervention in a focused session remains valid and is reconciled back to the coordinator. This increment adds versioned scope state and coordination records; it does not grant delivery, repository, worktree, or file-write authority.

## Constraints

- Preserve all current uncommitted repository work.
- Use explicit managed assignments only; infer no role or authority from repository topology.
- A coordinator may approve a scope reissue only within authority already represented by the managed assignment. Otherwise it must escalate to a human decision.
- A human-approved change in a focused session is authoritative for that scope, but must create a durable coordinator notification/reconciliation obligation.
- Every reissue increments a scope revision. A proposal or action based on an older revision must be rejected.
- Keep the feature bounded to the extension control plane. Do not implement direct filesystem-write interception, worktree lifecycle, delivery authority, or automatic session spawning.
- Do not commit, push, or create a pull request without a separate explicit user instruction.

## Acceptance criteria

- A focused assignment stores a current allowed scope and revision in durable state without breaking existing persisted state.
- A focused session can submit a reasoned scope-change proposal against its current revision.
- The assignment coordinator can approve a current proposal and reissue the assignment with an incremented revision; unauthorized approvals fail closed.
- A direct human approval recorded by a focused session is visible to and reconcilable by the coordinator without being re-approved by that coordinator.
- Stale proposal or action revisions fail before changing durable coordination state.
- Focused and coordinator prompt context expose the current revision and pending scope/reconciliation obligations clearly.
- Tool and command surfaces follow existing extension conventions and are covered by focused tests.

## Tasks

- [x] ODD-1: Map existing durable assignment, event, tool, prompt, command, and test seams. Route: delegated read-only explorer. Evidence: implementation surface identified in `src/model.ts`, `src/state.ts`, `src/tools.ts`, `src/index.ts`, `src/prompt.ts`, and matching tests.
- [x] ODD-2: Add versioned scope-change models, durable-state transitions, coordinator authorization, direct-human reconciliation, and stale-revision rejection. Route: dedicated scoped writer. Checks: focused state/tool tests and TypeScript build. Evidence: revisioned proposals, fail-closed authorization/stale checks, direct-human reconciliation records, and 19 focused state/tool tests passed.
- [x] ODD-3: Surface revision and pending obligations in prompt/command interfaces, document the coordination rule, and cover compatibility behavior. Route: same dedicated scoped writer. Checks: focused command/prompt tests and TypeScript build. Evidence: scope-aware tool snapshots, commands, role prompts, reference documentation, legacy hydration test, and 14 focused command/prompt tests passed.
- [x] ODD-4: Independently verify the changed behavior, inspect the native review authority for the final candidate when applicable, and report all evidence or blockers. Route: dedicated verifier. Checks: 35 focused tests, `npm test` (45 tests), and `npm run build` passed. Remediation evidence: scope changes are now limited to attached, active, and handoff-submitted assignments; terminal proposal and coordinator/direct-human approval regressions pass with no state or event mutation. Native review inspection is blocked because the repository has no commits and the candidate is wholly untracked (`committed-only-invalid`).
- [ ] ODD-5: Create one local Conventional Commit only after an explicit user instruction. Route: coordinator. Checks: final worktree and commit inspection.

## Evidence

- Initial state: the repository has no commits on `main`; all repository files are pre-existing untracked work and must be preserved.
- The read-only implementation map found no existing scope revision or scope-change proposal contract. Existing durable events and assignment lifecycle provide the intended extension seams.
- The user explicitly selected a dedicated implementation session and clarified both required paths: executor-requested coordinator review and direct-human approval followed by coordinator reconciliation.
- Remediation outcome: `proposeScopeChange` and all scope-change approvals fail closed for accepted, returned, blocked, and abandoned assignments before durable state or event changes; the valid active path and existing coordinator/direct-human reconciliation behavior remain covered.
- Independent verification: 35 focused tests, `npm test` (45 tests), and `npm run build` passed. Diff-based candidate verification is unavailable because every repository path is untracked. Native review inspection returned `committed-only-invalid`; no review lineage or repository mutation was created.
