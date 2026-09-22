# First npm release bootstrap

## Context

`pi-session-orchestrator@0.2.0` is ready on protected `main`, but npm trusted publishing cannot be configured before the package exists. Prepare one temporary GitHub Actions bootstrap path using a narrowly scoped npm publish token, then configure tokenless OIDC trusted publishing for all later releases. Do not publish locally.

## Constraints

- Use GitHub Actions only; never run `npm publish` from a local machine.
- The bootstrap workflow may publish only the exact annotated tag matching `package.json` on current protected `main`.
- Use a repository secret only in the bootstrap workflow; do not print, commit, or expose it.
- Remove the bootstrap credential/workflow after npm trusted publishing is configured.
- Keep the permanent `publish.yml` tokenless and OIDC/provenance-based.
- Add repository agent guidance and an ignored project-local release skill.

## Tasks

- [x] ODD-1: Add the guarded one-time bootstrap workflow, release guidance, and regression coverage. Route: dedicated writer. Checks: focused tests, full tests, build, package verification, workflow readback.
- [ ] ODD-2: Commit and deliver the bootstrap preparation through protected `main`. Route: coordinator. Checks: CI and merge evidence.
- [ ] ODD-3: Create/push annotated `v0.2.0`, set the bootstrap secret, and dispatch the bootstrap workflow under separate immutable authorization. Route: coordinator. Checks: GitHub run and public npm verification.
- [ ] ODD-4: Configure npm trusted publishing, remove bootstrap credentials/workflow, and confirm the permanent tokenless release route. Route: coordinator. Checks: package settings and workflow validation.

## Evidence

- Protected `main` is at `51835fedb6d30bca98a133a33aaa17868a8db9b7` and declares version `0.2.0`.
- No tag or public npm package exists yet.
- `npm trust github` returns public-registry E404 because trusted-publisher settings are package-scoped and this first package has not been created.
- The user explicitly authorized the first release and requested future agent release guidance.
- ODD-1 implementation evidence: `.github/workflows/publish-bootstrap.yml` is manual-dispatch only, main-bound, exact `v0.2.0` annotated-tag and remote-main safe, public-registry-only, and uses the bootstrap secret only at publish runtime; `publish.yml` remains tokenless. `AGENTS.md` and `.pi/skills/create-release/SKILL.md` define source, validation, protected-branch, bootstrap, trusted-publishing, and delivery boundaries. `test/package-readiness.test.ts` statically protects those invariants.
- ODD-1 validation evidence: focused package-readiness tests passed 11/11; `npm test` passed 49/49; `npm run build` passed; `npm run verify-pack` passed; `npm pack --dry-run --json --ignore-scripts` produced the expected 18-file `pi-session-orchestrator@0.2.0` package; Ruby YAML readback passed for all three workflows.
- ODD-1 delivery boundary: no secret was read or exposed; no local publish, tag, release, dispatch, remote-setting change, push, PR, stage, or commit was performed. ODD-2 through ODD-4 remain pending external operations.
- PR #2 CI remediation: GitHub Actions failed because the readiness test reads `.pi/skills/create-release/SKILL.md`, while the broad `.pi/` ignore rule excluded that file from the candidate and the checkout returned `ENOENT`.
- PR #2 correction: `.gitignore` now continues to ignore Pi runtime/local state and all other `.pi/` content while allowing only the release skill path; package-readiness coverage explicitly validates the skill metadata and delivery guard. The skill is now visible as a candidate file without staging or committing it.
