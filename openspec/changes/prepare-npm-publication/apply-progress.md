# Apply progress: prepare-npm-publication

## Status consumed

Consumed native `gentle-ai.sdd-status` v2 for `prepare-npm-publication`: apply was `ready`, action context was repo-local with workspace root `/Users/U726249/Dev/pi-extensions/pi-session-orchestrator` and the same allowed edit root. No action-context warning or host colon-command rejection occurred.

## Completed tasks

- [x] PR 1 tasks 1–4: added test-first contributor, legal, reference, and README navigation coverage and documents.
- [x] PR 2 tasks 5–8: added exact package metadata, explicit allowlist, deterministic dry-run pack verifier, fixture policy tests, and local-only CI workflow shape coverage.
- [x] PR 3 tasks 9–12: added registration and invocation coverage and fixed-action aliases delegating through `runCommand`.
- [x] Tasks 13–14: ran complete local evidence and reviewed local-only workflow/publication boundaries.
- [x] Remediation: isolated alias-equivalence state, covered every rejecting alias parity case, hardened CI permissions and checkout credentials, made direct ESM execution URL/path-safe, and shipped the README thumbnail in the verified package boundary.
- [x] Release/docs remediation: replaced README links to repository-only contributor, conduct, and issue-form files with canonical GitHub URLs; retained relative links only for packaged `docs/` content and added coverage that enforces this boundary.

The persisted `tasks.md` checkboxes are marked `[x]` for all 14 implementation/evidence tasks.

## Strict-TDD remediation evidence

- **RED:** Added package-boundary, direct-script, and CI-hardening tests. `npm test` failed with four expected failures: the thumbnail was prohibited/not required, a copied verifier at a path with spaces did not execute, and the workflow lacked `permissions: contents: read` plus `persist-credentials: false`.
- **GREEN:** Added the explicit thumbnail allowlist/requirement, hardened the workflow, and used `fileURLToPath(import.meta.url)` for the direct-entry check. The direct test still failed because macOS exposes the copied `/tmp/...` script as `/private/tmp/...` through `import.meta.url`.
- **REFACTOR:** Compared the main script path through `realpathSync(process.argv[1])`, preserving encoded and space-containing path support across the `/tmp` symlink. Added optional store injection only for extension test isolation; the production default remains `new LocalStateStore()`. Added per-alias state and notification equivalence assertions for all mappings and all rejecting aliases.

## Files changed or added

- `src/index.ts`
- `test/index.test.ts`
- `test/package-readiness.test.ts` (including README link/package-boundary regression coverage)
- `package.json`
- `scripts/verify-pack.mjs`
- `scripts/verify-pack.mjs.d.ts`
- `.github/workflows/ci.yml`
- `LICENSE`
- `CONTRIBUTING.md`
- `CODE_OF_CONDUCT.md`
- `README.md` (navigation links, repository-only canonical URLs, and existing thumbnail reference)
- `docs/reference/README.md`
- `docs/reference/coordination-model.md`
- `docs/reference/operational-boundaries.md`
- `docs/reference/fast-decision-model.md`
- `openspec/changes/prepare-npm-publication/{tasks,apply-progress,design}.md`
- `openspec/changes/prepare-npm-publication/specs/{package-readiness,repository-ci}/spec.md`

## Verification evidence

- `npm test` passed: 30 tests, 0 failures. This includes direct execution of a copied verifier whose script path contains spaces; it runs `npm pack --dry-run --json --ignore-scripts` against the local repository.
- `npm run build` passed (`tsc --noEmit`).
- `npm run verify-pack` passed. Inspected dry-run contents: `LICENSE`, `README.md`, `assets/pi-session-orchestrator-thumbnail-pi-sessions.png`, four `docs/reference/*.md` files, `package.json`, and six runtime `src/*.ts` modules.
- Local YAML parse passed with Ruby `YAML.safe_load`; static test verifies `push`, `pull_request`, Node `22.19.0`, read-only contents permission, credentialless checkout, and ordered local validation commands.
- `git diff --check` passed; no staged files were present.
- No remote Actions run was observed. No credentials, registry query, publish, release, push, PR, staging, or commit was performed.

## Review workload / PR boundary

Corrected future chained slices; each slice must pass the complete local CI command set at its own tip:

1. **PR 1:** legal/community/reference documentation and README navigation, with only contributor-content tests.
2. **PR 2:** manifest metadata, README thumbnail distribution, pack verifier, and hardened local CI, with readiness/workflow tests; based on PR 1.
3. **PR 3:** discoverable aliases and alias regression coverage; based on PR 2.

This prevents an earlier slice from adding tests for a later slice's files. No PRs were created or pushed.

## 0.2.0 local release/documentation slice

- Added explicit opt-in delegation wording to the universal prompt baseline: small known work may remain inline; orchestration/delegation needs an explicit durable assignment; oversized bounded work uses fast focused delegation.
- Added the packaged `docs/README.md` hierarchy, optional `pi-intercom` companion boundary, and local release/version preparation guide. The README now links those documents, aliases, and the existing issue forms.
- Bumped `package.json` and the root `package-lock.json` to `0.2.0`; added SemVer and manifest/lock synchronization coverage.
- Expanded the pack verifier to require every README-linked document and reject unreviewed documentation paths.
- This is local, uncommitted work. PR 4 remains a future delivery plan only, not a historical or independently remotely verified PR.

## Remaining tasks

Fresh local validation passed: 30 tests, TypeScript build, pack verifier, direct pack dry run, Ruby YAML parse, `git diff --check`, and an empty staged-file listing. The release/docs remediation was revalidated with `npm test`, `npm run build`, `npm run verify-pack`, `npm pack --dry-run --json --ignore-scripts`, `git diff --check`, and an empty staged-file check; the tarball contains only the intended consumer files and packaged docs. Future delivery tasks 15–16 in `tasks.md` remain unchecked and separately authorized. Fresh native status should recommend the next lifecycle phase (classically `archive`, with optional `verify` according to provider policy).

## Deviations

The executable verifier retains its companion declaration and narrowly scoped `@ts-expect-error` because TypeScript does not resolve declarations for `.mjs` imports in this repository configuration. Runtime behavior remains unchanged apart from additive aliases, the packaged README thumbnail, and local workflow hardening.

## Subsequent local orchestration-indicator remediation evidence

- Added regression coverage for fresh `orchestrator_update` presentation and legacy event sequence/cursor migration.
- Fixed update-time presence refresh to preserve freshness without emitting a second indicator event.
- Normalized missing event sequences on read and allocate new sequences beyond event and cursor tails.
- Fresh validation passed: `npm test` (38 tests), `npm run build`, `npm run verify-pack`, `git diff --check`, and an empty staged-file check.
- Final LSP diagnostics for changed TypeScript/test paths reported no error-severity diagnostics.
- No staging, commit, push, publish, tag, PR/release, credential access, or GitHub mutation was performed.
