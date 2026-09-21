# Initial release readiness

## Context

The repository is public but has no commits, no default branch, and every project file is untracked. Prepare a reviewable bootstrap history and release-ready package path so the extension can be published safely through GitHub Actions and discovered as a Pi package. Do not publish to npm in this increment.

## Constraints

- Preserve every existing untracked file and current scope-change implementation.
- Separate the initial product baseline from release automation/configuration into reviewable work units where the untracked baseline permits it.
- Do not publish to npm locally. Publication must use a protected-default-branch GitHub Actions workflow with provenance/OIDC when the repository policy and npm configuration permit it.
- Do not push, change repository visibility, configure GitHub branch protection/rulesets, create tags/releases, or dispatch a publish workflow without an immutable upstream-mutation authorization immediately before the exact operation.
- Treat branch protection settings and npm package ownership/registry authentication as external configuration requiring observed evidence and, where policy choices remain, an explicit user decision.
- Retain release preparation only; no npm publication, GitHub release, or tag is authorized by this feature.

## Acceptance criteria

- The package has a verified, explicit Pi-extension discovery/installation contract based on current Pi package documentation.
- Package metadata, package file allowlist, and release workflow are validated locally with repository-supported checks and `npm pack --dry-run`.
- The repository has a coherent local commit sequence for the initial implementation and release preparation, with tests/docs included.
- A concrete, reviewable GitHub repository bootstrap plan identifies the exact public-visibility, branch-protection/ruleset, default-branch, and workflow requirements.
- Npm name availability/ownership and trusted publishing prerequisites are checked without exposing credentials.
- All external shared-state operations remain pending immutable authorization.

## Tasks

- [x] ODD-1: Map current package/discovery requirements, GitHub repository state, npm name/ownership, CI/release assets, and the initial untracked baseline. Route: delegated read-only release scout. Checks: package metadata, remote state, and dry-run evidence.
- [x] ODD-2: Implement only the necessary package-discovery and release-preparation files. Route: dedicated scoped writer. Checks: focused tests, build, package verification, and `npm pack --dry-run`.
- [ ] ODD-3: Review the initial work-unit history, commit the approved local units, and inspect the native review candidate. Route: coordinator plus verifier. Checks: test/build/pack evidence and commit inspection.
- [ ] ODD-4: Present immutable external-operation previews for the first push, public-repository/default-branch bootstrap if needed, and branch protection/ruleset configuration. Route: coordinator. Checks: remote state re-read after each approved operation.

## Evidence

- Current Git state: `main` has no commits and the complete repository is untracked.
- GitHub repository: `davidjadczyk/pi-session-orchestrator` is already public; it has no default branch; the current viewer has admin permission.
- Package metadata declares `pi-session-orchestrator` at version `0.2.0`, with `pi-package` discovery metadata, a public gallery image URL, explicit public npm registry intent, `verify-pack`, source/docs/assets allowlist, MIT license, and GitHub repository metadata.
- Pi runtime packages are peers at `"*"`; development pins remain in `devDependencies` and the lockfile remains consistent.
- The publish workflow is manually dispatched from protected `main`, requires an exact annotated `vSemVer` tag matching remote `main` and the package version, and uses npm OIDC/provenance without a token.
- The user requested initial commits, branch protection, public visibility, and npm release readiness; they did not request npm publication itself.
- ODD-2 implementation evidence: package-gallery metadata includes `pi-package`, a public `main` gallery image, and explicit npm registry intent; Pi runtime packages are wildcard peers; `publish.yml` is main-bound, annotated-tag-only, tokenless, and uses OIDC provenance.
- ODD-2 validation evidence: `node --test --import tsx test/package-readiness.test.ts` passed 9/9; `npm test` passed 47/47; `npm run build` passed; `npm run verify-pack` passed; `npm pack --dry-run --json --ignore-scripts` produced the expected 18-file package with no bundled dependencies.
- Remaining external prerequisites: protect `main` and make it the default branch, configure npm trusted publishing for this repository and `.github/workflows/publish.yml`, merge the reviewed release, create/push an annotated matching version tag, and authorize the eventual workflow dispatch/publish operation.
