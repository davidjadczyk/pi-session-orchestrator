# Tasks: Prepare npm Publication

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 750–1,050 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (legal/community/reference docs and README navigation, with only their content tests) → PR 2 (manifest, README thumbnail distribution, pack verifier, and hardened local CI with their readiness tests) → PR 3 (discoverable command aliases and regression coverage) |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

Implementation is expected to cross the 400-line review budget because it adds documentation, a verifier and its fixtures, CI configuration, manifest changes, and command-registration coverage. Obtain later delivery authorization before applying the proposed chained delivery; do not push, create a PR, observe remote workflows, release, or publish as part of this change.

## 1. PR 1 — contributor baseline and reference navigation

Each chained slice must pass the full local CI command set from its own tip. PR 1 contains only contributor/reference tests; PR 2 adds the manifest/pack/workflow tests and is based on PR 1; PR 3 adds alias tests and is based on PR 2. This avoids a slice introducing assertions for artifacts delivered only by a later slice.

- [x] 1. **RED** — Add focused contributor-content tests (new `test/contributor-experience.test.ts`) that fail against the current tree and assert: the exact MIT notice `Copyright (c) 2026 David Jadczyk`; required reference-index links/status labels; exploratory brief intent, candidate flow, open questions, and non-commitment; and README additions are navigation links only. Run `npm test` and retain the expected failures.
- [x] 2. **GREEN** — Add `LICENSE`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `docs/reference/README.md`, `docs/reference/coordination-model.md`, `docs/reference/operational-boundaries.md`, and `docs/reference/fast-decision-model.md`; update `README.md` only with links to contribution, conduct, and reference material. Use the exact MIT notice and constrain stable reference claims to current evidenced behavior. Run the targeted content tests until green.
- [x] 3. **TRIANGULATE** — Extend the content tests with negative/edge assertions that reject changed MIT notice text, missing non-credential reporting guidance, undocumented stable/exploratory status, an exploratory page that implies a runtime commitment, and non-navigation README prose changes. Run `npm test` and confirm the tests distinguish the valid documents from the failure cases.
- [x] 4. **REFACTOR** — Consolidate repeated file-reading/assertion helpers in the new content test module(s) without weakening exact-text or navigation-only assertions; review `README.md` diff to confirm its existing behavioral narrative is untouched. Run `npm test` and `npm run build`.

## 2. PR 2 — inspectable package boundary, README thumbnail distribution, and hardened local-only CI

- [x] 5. **RED** — In `test/package-readiness.test.ts`, add failing manifest assertions for the exact canonical identity `https://github.com/davidjadczyk/pi-session-orchestrator`, the exact design metadata (`repository.url`, issues URL, homepage, keywords, `engines.node`, and `files` allowlist), retained unscoped name, `MIT`, and absent `private`. Add fixture-driven tests for a planned exported/helper-level pack-list validator: complete permitted list passes, each missing required `src/{index,binding,model,prompt,state,tools}.ts` or consumer file reports its path, and each prohibited category (`test/`, `.github/`, `openspec/`, `scripts/`, `assets/`, lock/config/root-local files) reports the included path. Run `npm test` and retain expected failures.
- [x] 6. **GREEN** — Update `package.json` with the exact metadata and `verify-pack` script; add `scripts/verify-pack.mjs` to run only `npm pack --dry-run --json --ignore-scripts`, parse one result, normalize paths, enforce the required/prohibited boundary, and emit specific violations. Ensure no tarball, lifecycle script, registry query, credentials, publish, or network-dependent publication action is introduced. Run the focused pack tests and `npm run verify-pack` locally.
- [x] 7. **TRIANGULATE** — Add `.github/workflows/ci.yml` and failing-then-passing local workflow-shape coverage in `test/package-readiness.test.ts` (or a new `test/repository-ci.test.ts`) for `push` and `pull_request`, Node `22.19.0`, `npm ci`, and ordered `npm test`, `npm run build`, and `npm run verify-pack`. Add negative assertions excluding secrets, credential/auth, publishing, release, registry-query, permissions elevation, and failure suppression. Run `npm test`; do not trigger or claim a remote Actions run.
- [x] 8. **REFACTOR** — Keep pack verifier policy data and parsing/validation functions separately testable, remove duplicated test fixture setup, and review the manifest allowlist against actual consumer content. Run `npm test`, `npm run build`, and `npm run verify-pack`; inspect the dry-run JSON file list locally and confirm required files are present and prohibited paths absent.

## 3. PR 3 — discoverable interactive aliases without behavior drift

- [x] 9. **RED** — Extend `test/index.test.ts` with a mocked `ExtensionAPI.registerCommand` harness that fails until it observes the unchanged `orchestrator` command and exactly one registration for each alias: `orchestrator:coordinator`, `orchestrator:assign`, `orchestrator:attach`, `orchestrator:start`, `orchestrator:handoff`, `orchestrator:accept`, `orchestrator:return`, `orchestrator:decision`, `orchestrator:block`, `orchestrator:abandon`, and `orchestrator:status`. Add invocation comparisons proving `orchestrator:assign` forwards JSON arguments unchanged, `orchestrator:status` delegates with no extra arguments, and an invalid alias invocation emits the same observable error as its `/orchestrator <action>` equivalent. Run `npm test` and retain expected failures.
- [x] 10. **GREEN** — In `src/index.ts`, add a small fixed-action registration helper that prefixes the mapped action and calls the existing `runCommand(store, args, ctx)`; register all eleven aliases through it while leaving the `orchestrator` registration and `orchestrator_*` tool registrations unchanged. Run the focused command tests until green.
- [x] 11. **TRIANGULATE** — Expand `test/index.test.ts` to cover every alias mapping, at least one multi-argument forwarding case, compatibility-command success behavior, and equivalent validation/error behavior. Assert aliases neither register unsupported actions nor require changes to `src/tools.ts`, state contracts, lifecycle behavior, session behavior, or worktree behavior. Run `npm test`.
- [x] 12. **REFACTOR** — Extract test helpers for registered-command lookup and alias/compatibility invocation comparison, preserving assertions that aliases perform no independent parsing or argument transformation. Keep `runCommand` as the sole parser, validator, lifecycle dispatcher, error handler, and status-refresh path. Run `npm test` and `npm run build`.

## 4. Local completion evidence and delivery boundary

- [x] 13. Run the complete local evidence set in order: `npm test`, `npm run build`, and `npm run verify-pack`; record command output and the inspected dry-run package file list. Confirm changed paths are limited to the approved implementation surfaces and OpenSpec artifacts, with no source behavior change beyond alias registration.
- [x] 14. Perform a final local review of the workflow configuration and documentation/manifest diffs: record that validation is configuration-only, no GitHub-hosted workflow was observed, and no registry access, credentials, publishing, releases, remote GitHub mutation, staging, commit, or push occurred. **Later delivery authorization required:** select a chain strategy and explicitly authorize any future push/PR creation or remote workflow observation; publication requires separate explicit authorization.

## 5. PR 4 — 0.2.0 local release/documentation slice (future delivery plan)

This is a delivery plan for a local, uncommitted slice. It is **not** a historical PR and has not independently verified any remote delivery.

- [ ] 15. Deliver the local 0.2.0 documentation and explicit opt-in delegation prompt update as PR 4 only after separate authorization for commit, push, and PR creation. Keep the runtime change limited to the additive universal baseline; keep `pi-intercom` optional and dependency-free.
- [ ] 16. Before any authorized delivery, rerun the complete local evidence set, inspect the packed README-linked documentation, and obtain separate authorization for remote Actions observation, tagging, GitHub release creation, or npm publishing.
