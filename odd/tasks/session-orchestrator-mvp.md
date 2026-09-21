# pi-session-orchestrator MVP

## Objective
Build a minimal runnable Pi extension with explicit coordinator/focused attachments, durable local state, additive role prompt context, unmanaged fallback, and display-only status indicators.

## Constraints
- Preserve existing prompts; inject only a named structured section.
- Use pi-intercom only as transport; do not recreate messaging.
- No automatic spawning, worktree lifecycle, commits, or delivery automation.
- Managed hierarchy is explicitly bounded: root coordinator → domain coordinator → focused session; focused sessions cannot create managed children.
- Roles do not flow to subagents; RDD lineages never transfer and handoffs never authorize delivery.

## Delivery strategy
ask-on-risk. Forecast: under 400 authored changed lines excluding generated files.

## Tasks
- [x] ODD-1: Scaffold the package and define validated durable assignment state. Route: delegated writer (multi-file write). Checks: TypeScript build and focused state tests.
- [x] ODD-2: Implement explicit coordinator/focused commands, named additive prompt injection, and display-only footer. Route: delegated writer (multi-file write). Checks: TypeScript build and focused extension tests.
- [x] ODD-3: Cover compatibility and unmanaged fallback scenarios. Route: delegated writer (multi-file write). Checks: focused test suite and build.
- [x] ODD-4: Add explicit root/domain/focused role hierarchy with a hard depth-2 limit and preserve direct root-to-focused assignments. Route: inline (operator requested implementation; subagent delegation was not requested). Checks: state tests and build passed.
- [x] ODD-5: Aggregate active focused descendants in the root footer without adding complex breakdowns. Route: inline (operator requested implementation; subagent delegation was not requested). Checks: prompt tests and build passed.
- [x] ODD-6: Document hierarchy and footer semantics, then run full verification. Route: inline (operator requested implementation; subagent delegation was not requested). Checks: test suite, build, and whitespace check passed.
- [x] ODD-7: Restructure the README around the explicit hierarchy, additive prompt context, lifecycle, and display-only footer. Route: inline (single documentation file). Checks: Markdown readback and whitespace check passed.
- [x] ODD-8: Embed the provided Pi sessions thumbnail in the README header. Route: inline (single documentation file). Checks: Markdown readback and whitespace check passed.
- [x] ODD-9: Add a concise unmanaged-session baseline that advertises explicit managed coordination without inferring roles. Route: inline (operator requested implementation; subagent delegation was not requested). Checks: prompt tests and build passed.
- [x] ODD-10: Register `orchestrator_status` and typed `orchestrator_update` tools for agent-driven durable state transitions. Route: inline (operator requested implementation; subagent delegation was not requested). Checks: focused tool/state tests and build passed.
- [x] ODD-11: Document tool-driven bootstrap/adoption and run full verification. Route: inline (operator requested implementation; subagent delegation was not requested). Checks: test suite, build, and whitespace check passed.
- [x] ODD-12: Add operational child footer counts and target-side pending-assignment notices without auto-attaching or promoting sessions. Route: delegated writer (multi-file state, prompt, tool, and test change). Checks: focused tests and build passed.
- [x] ODD-13: Add presence observations that distinguish live, reloading, suspended, and stale sessions without changing durable role assignment. Route: delegated writer (multi-file lifecycle change). Checks: focused tests and build passed.
- [x] ODD-14: Expose a compact read-only per-root workflow ledger derived from typed durable events and handoffs, without copying transcripts. Route: delegated writer (state/tool/test/documentation change). Checks: test suite, build, and whitespace check passed.
- [x] ODD-15: Apply the user-authorized local hygiene and UX slice: retain and normalize the package thumbnail, ignore runtime-local `.pi/` state, clarify additive delegation boundaries, and add public issue forms. Route: inline; child delegation is unavailable in this execution context. Checks: `npm test`, build, pack verification, image dimensions, Ruby YAML parse, whitespace check, and staged-file check passed.

## Acceptance criteria
- Explicit matching attach persists and restores coordinator/focused assignments.
- Mismatched bindings reject attachment; focused sessions cannot create managed children.
- Root coordinators can own direct focused sessions or delegated domain coordinators; domain coordinators can own focused sessions only.
- Root and domain coordinators are registered explicitly. Their footers distinguish current children from working, ready, pending, and attention-needed focused descendants and direct assignments.
- A target session with a created assignment receives only a pending invitation notice/footer until it explicitly attaches and validates its binding.
- Presence is observed separately from roles; shutdown or stale presence never automatically detaches, promotes, or reassigns a session.
- A bounded read-only per-root ledger derives typed assignments, events, handoffs, and presence without copying Pi/intercom transcripts.
- Every session receives a concise named coordination baseline; only explicitly managed sessions receive role-specific additive context.
- Footer is role-derived display only.
- Handoff state is explicit; acceptance/return is persisted and never delivery authority.

## Evidence
- Initial `gentle-ai-worker` launch blocked before execution because a foreground child cannot load its required `mem_save` extension tool; no source files changed.
- Coordinator authorized a same-scope retry with the builtin foreground `worker` agent; run `a2ccc9b9-c228-4575-8fc5-6f8b5f136a42` implemented the MVP.
- Independent verification run `67907198-abdc-4195-b7d0-b13a2b94a397`: `npm run build` and `git diff --check` passed; `npm test` failed before executing because `tsx` was unavailable. Review also found prohibited `execFileSync("git", ...)` process creation in `src/binding.ts`.
- Remediation run `f24d0542-f490-4426-8d3b-b679ac7305ed` replaced Git process discovery with filesystem metadata reads and added binding coverage. It reported `npm test` (7 tests), `npm run build`, and `git diff --check` passing.
- Independent remediation review run `67a25889-d571-4250-8ce8-4242fc1d7644` found no blockers; its acceptance wrapper failed only because staged-file evidence was absent. Parent spot verification then observed `npm test` exit 0, `npm run build` exit 0, `git diff --check` exit 0, and zero staged files. The working tree remains untracked, so `git diff --check` does not cover all changed files.

## Evidence
- Hierarchy increment: `npm test` passed (9 tests); `npm run build`, `git diff --check`, and explicit whitespace checks over tracked and untracked project files passed. LSP reported no diagnostics for changed source and test paths, though four checks were inconclusive because the TypeScript server is push-only on clean re-checks.
- No files were staged or committed; integration, delivery, and cleanup remain outside this increment.

## Evidence
- Tool control-plane increment: `npm test` passed (12 tests); `npm run build`, `git diff --check`, and explicit whitespace checks over project files passed. The agent-facing `orchestrator_status` and `orchestrator_update` tools remain state-only and do not create sessions, worktrees, branches, messages, or delivery actions.
- No files were staged or committed; integration, delivery, and cleanup remain outside this increment.
- Operational visibility and ledger increment: `npm test` passed (18 tests); `npm run build`, `git diff --check`, and explicit untracked-file whitespace checks passed. It adds read-time 30-minute stale presence, pending invitation visibility, operational footer buckets, and a bounded derived ledger without transcript duplication or automatic role changes. Follow-up verification made ledger reads non-mutating, enforced canonical full session IDs for both agent tool and slash-command adoption, and bounded every ledger collection with total/returned/truncated metadata.
- Remediation coverage: `npm test` passed (19 tests), `npm run build`, `git diff --check`, and explicit untracked-file whitespace checks passed. Added direct abbreviated-ID rejection coverage for `orchestrator_update(assign-existing)` and direct bounded metadata coverage for ledger events and handoffs; README and prompt contract now document canonical-ID requirements for both agent and slash-command adoption.
- Local hygiene and UX slice: retained `assets/pi-session-orchestrator-thumbnail-pi-sessions.png` as a center-cropped 1280×720 asset and deleted both unreferenced variants. Added a broad `.pi/` ignore entry while confirming `openspec/` remains unignored. Added baseline and role-context guidance plus focused assertions, and concise public-safe bug/feature issue forms. `npm test` passed (30 tests), `npm run build`, `npm run verify-pack`, image dimension check, Ruby YAML parsing of CI and both forms, and `git diff --check` passed; staged-file output was empty. No commit was made because the user prohibited it.

## Next step
Coordinator review and integration routing; no commit or delivery action is authorized.
