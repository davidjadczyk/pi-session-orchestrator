# First npm release bootstrap

## Context

`pi-session-orchestrator@0.2.0` was published through the completed first-release process. npm trusted publishing is configured for `davidjadczyk/pi-session-orchestrator` and the permanent tokenless OIDC/provenance workflow. The permanent publish job targets the GitHub Actions `npm` environment, so releases appear as deployments for auditability. Do not publish locally.

## Constraints

- Use GitHub Actions only; never run `npm publish` from a local machine.
- Keep the permanent `publish.yml` tokenless and OIDC/provenance-based.
- The permanent publish job must target the GitHub Actions `npm` environment so releases appear as deployments.
- The permanent workflow may publish only the exact annotated tag matching `package.json` on current protected `main`.
- Keep repository agent guidance and the ignored project-local release skill aligned with the permanent release path.

## Tasks

- [x] ODD-1: Add the guarded one-time bootstrap workflow, release guidance, and regression coverage. Route: dedicated writer. Checks: focused tests, full tests, build, package verification, workflow readback.
- [x] ODD-2: Commit and deliver the release preparation through protected `main`. Route: coordinator. Checks: CI and merge evidence.
- [x] ODD-3: Create/push annotated `v0.2.0` and publish the package through GitHub Actions under separate immutable authorization. Route: coordinator. Checks: GitHub run and public npm verification.
- [x] ODD-4: Configure npm trusted publishing, remove the bootstrap workflow source path, and confirm the permanent tokenless release route. Route: coordinator. Checks: package settings and workflow validation.
- [x] ODD-5: Add the permanent `npm` environment and deployment audit evidence. Route: dedicated writer. Checks: focused readiness tests, full tests, build, package verification, dry-run pack, and workflow readback.

## Evidence

- Published package: `pi-session-orchestrator@0.2.0`.
- Release tag: annotated `v0.2.0`, matching package version and protected `main`.
- Trusted publishing: configured for GitHub repository `davidjadczyk/pi-session-orchestrator` and permanent workflow `.github/workflows/publish.yml`, using tokenless npm OIDC with provenance.
- Deployment audit: the permanent publish job targets the GitHub Actions `npm` environment, so future releases appear as GitHub deployments.
- Source cleanup: `.github/workflows/publish-bootstrap.yml` is removed; readiness coverage now requires its absence and protects the permanent workflow's tokenless/tag-safe invariants.
- Guidance cleanup: `AGENTS.md` and `.pi/skills/create-release/SKILL.md` describe only the permanent release path, its `npm` environment, and deployment visibility while treating `0.2.0` as published.
- Bootstrap credential state was not changed by this source-only cleanup task, per delivery boundary.
- Existing ODD-1 validation evidence remains: focused package-readiness tests passed 11/11; `npm test` passed 49/49; `npm run build` passed; `npm run verify-pack` passed; `npm pack --dry-run --json --ignore-scripts` produced the expected 18-file `pi-session-orchestrator@0.2.0` package; Ruby YAML readback passed for all three workflows.
- ODD-5 validation evidence: focused package-readiness tests passed 11/11; `npm test` passed 49/49; `npm run build` passed; `npm run verify-pack` passed; `npm pack --dry-run --json --ignore-scripts` produced the expected 18-file `pi-session-orchestrator@0.2.0` package; Ruby syntax/readback passed for `publish.yml`, `ci.yml`, and both issue templates.
- No local publish, tag, release, dispatch, remote-setting change, push, PR, stage, or commit was performed for this cleanup task.
