# Proposal: Prepare npm Publication

## Intent

Prepare `pi-session-orchestrator` for external contributors and a later public Pi/npm distribution without publishing, creating a release, pushing, or changing GitHub settings. The change makes the future package boundary and canonical public repository identity inspectable, and makes existing interactive orchestration actions individually discoverable while preserving their compatibility route.

## Background and current-state gap

The package is an npm-managed TypeScript ESM Pi extension with the intended unscoped identity `pi-session-orchestrator`, but `package.json` is private and has no explicit distributable-file boundary, contributor policy, automated repository validation, or progressive reference-document structure. The canonical public repository identity is now evidenced as [https://github.com/davidjadczyk/pi-session-orchestrator](https://github.com/davidjadczyk/pi-session-orchestrator); the local `origin` is configured, but this change must not push or otherwise mutate the remote.

Interactive command discovery is also incomplete: typing `/` exposes only `/orchestrator`, leaving its supported actions hidden behind an argument-based command. Human users need individually registered Gentle Pi-style namespaced commands such as `/orchestrator:status`, without changing the existing command semantics or displacing agent-callable tools.

## Product decisions already confirmed

- License: MIT.
- Future npm identity: unscoped `pi-session-orchestrator`.
- Canonical public repository identity: `https://github.com/davidjadczyk/pi-session-orchestrator`.
- OpenSpec initialization: tailored to this repository and its npm/TypeScript validation commands.
- Individually discoverable interactive commands use the `/orchestrator:<action>` convention and delegate to the existing `/orchestrator <action>` implementation.
- `orchestrator_*` tools remain the normal automated control plane; the interactive commands serve human bootstrap, recovery, and direct operation.
- This is a preparation change only; it does not authorize registry, publication, push, release, or remote GitHub action.

## Scope

### In scope

1. Add a root MIT `LICENSE` bearing the confirmed notice exactly: `Copyright (c) 2026 David Jadczyk`.
2. Add concise contributor and community guidance:
   - `CONTRIBUTING.md` for local setup, validation, scope boundaries, and contribution expectations.
   - `CODE_OF_CONDUCT.md` with a standard community conduct and reporting route that does not require repository secrets.
3. Prepare publication metadata in `package.json`:
   - remove the private-only publication block for future distribution;
   - retain the confirmed unscoped package name;
   - add accurate license, repository, issue-tracker, homepage, discovery, and runtime compatibility metadata based on the canonical public identity `https://github.com/davidjadczyk/pi-session-orchestrator`;
   - define a minimal `files` allowlist that includes only package runtime source and user-facing distribution material needed by consumers (for example `src/`, `README.md`, `LICENSE`, and explicitly intended reference docs), while excluding tests, repository automation, OpenSpec working artifacts, and local configuration by default.
4. Add a deterministic local packed-artifact verification command. It will inspect `npm pack --dry-run --json` output and fail when required package files are absent or excluded material is present. The verification must not publish or contact a registry.
5. Add GitHub CI workflow configuration for dependency installation, the existing test command, existing type validation, and packed-artifact verification on repository push and pull-request events. This change must validate that workflow configuration locally; observing an actual GitHub Actions push or pull-request execution is explicitly deferred to a separately authorized remote delivery validation.
6. Add progressive reference documentation:
   - a stable reference index that distinguishes documented behavior from future exploration;
   - initial reference pages for the coordination model and operational boundaries, derived from existing behavior;
   - an explicitly exploratory `fast-decision-model` brief that records intent, candidate decision flow, open questions, and non-commitment status.
7. Limit README edits to links that point readers to the new contribution/community and reference documents; preserve its current behavioral narrative.
8. Register individually discoverable namespaced interactive commands for every currently supported `/orchestrator <action>` action: `/orchestrator:coordinator`, `/orchestrator:assign`, `/orchestrator:attach`, `/orchestrator:start`, `/orchestrator:handoff`, `/orchestrator:accept`, `/orchestrator:return`, `/orchestrator:decision`, `/orchestrator:block`, `/orchestrator:abandon`, and `/orchestrator:status`.
   - Each namespaced command MUST forward its arguments to the existing command implementation rather than duplicate parsing, validation, state transitions, or error behavior.
   - `/orchestrator <action>` MUST remain a supported compatibility route with unchanged action semantics.
   - Add command-registration and invocation tests that prove the namespaced routes are registered and delegate to the same behavior as their compatibility equivalents, including argument-bearing and no-argument actions.

### Explicit non-goals

- Publishing to npm, querying npm ownership or package-name availability, or using registry authentication for `pi-session-orchestrator`.
- Creating a release, tag, changelog release entry, or release automation.
- Creating or changing remote GitHub state, including repositories, settings, branch protection, actions secrets, labels, issues, pull requests, releases, or the canonical remote; local `origin` evidence does not authorize a push.
- Changing extension lifecycle rules, persisted state contracts, public `orchestrator_*` tool contracts, automated-control-plane behavior, session behavior, or worktree behavior.
- Replacing `/orchestrator <action>` or introducing an independent implementation for any namespaced alias.
- Spawning sessions or worktrees.
- Adding, requesting, storing, or rotating secrets, tokens, npm credentials, or GitHub credentials.

## Affected areas

| Area | Proposed effect |
| --- | --- |
| Root legal/community files | Add MIT, contribution, and conduct documentation. |
| `package.json` | Make future publication metadata, including canonical public repository links, and explicit package contents reviewable without publishing. |
| Verification tooling and tests | Add a local test-first packed-artifact contract and command. |
| `.github/workflows/` | Add CI configuration for existing tests, type checking, and package-content verification; validate its configuration locally only. |
| `docs/reference/` | Add a progressive reference index, stable reference pages, and an exploratory fast-decision-model brief. |
| `README.md` | Add navigation links only. |
| `src/index.ts` | Register namespaced interactive command aliases that delegate to the existing `/orchestrator <action>` implementation. |
| Command registration/invocation tests | Cover command discovery, alias registration, delegation, argument forwarding, and compatibility-route preservation. |

## Proposed artifact layout

This proposal amendment is the only artifact created in this phase. Before implementation, the active change should contain or update the following OpenSpec artifacts:

```text
openspec/changes/prepare-npm-publication/
├── proposal.md                                      # amended scope and acceptance contract
├── design.md                                        # metadata, package boundary, CI, docs, and alias-delegation design
├── specs/
│   ├── package-readiness/spec.md                     # canonical metadata, allowlist, and pack verification
│   ├── contributor-experience/spec.md                # legal, community, README-link, and reference requirements
│   ├── repository-ci/spec.md                         # CI triggers and required checks
│   └── interactive-command-discoverability/spec.md   # alias registration, delegation, compatibility, and tests
└── tasks.md                                          # test-first, ordered implementation work
```

The implementation, outside this proposal phase, may add only the approved repository files under the affected areas above. The design must record exact package metadata values, the allowlist, alias-to-action mapping, shared delegation point, and test matrix. The packed-artifact contract must validate the package boundary rather than assume it.

## Acceptance criteria

- [ ] A root MIT license file contains exactly `Copyright (c) 2026 David Jadczyk`, and `package.json` declares the same MIT license.
- [ ] Contributors can find concise setup, validation, conduct, and contribution guidance without needing unpublished credentials or private operational knowledge.
- [ ] `package.json` retains the exact unscoped name `pi-session-orchestrator`, no longer prevents future publication solely through `private`, and contains accurate public metadata tied to `https://github.com/davidjadczyk/pi-session-orchestrator`.
- [ ] The package has a documented, minimal allowlist and a local command that checks `npm pack --dry-run --json` output against required and prohibited content.
- [ ] Pack verification demonstrates that runtime source and required consumer documentation are included, while tests, OpenSpec change artifacts, CI configuration, and repository-local files are excluded unless explicitly justified.
- [ ] GitHub CI workflow configuration specifies `npm test`, `npm run build`, and packed-artifact verification for push and pull-request events without requiring secrets, publication permissions, or remote-state mutation.
- [ ] This change performs local validation of the workflow/configuration and records that evidence; observing GitHub Actions execution from an actual push or pull request is deferred to a separately authorized remote delivery validation.
- [ ] Reference documentation has a clear index, separates stable behavior from exploration, and includes a marked exploratory fast-decision-model brief with open questions and no implied runtime commitment.
- [ ] README changes are limited to links to the new documentation and do not alter source behavior claims.
- [ ] Every supported `/orchestrator <action>` has a separately registered, discoverable `/orchestrator:<action>` command, including `/orchestrator:status`.
- [ ] Every namespaced command delegates to the existing command implementation, preserves the equivalent action's argument handling and observable success/error behavior, and does not duplicate lifecycle or validation logic.
- [ ] Registration and invocation tests cover the complete namespaced command set, at least one argument-bearing route, a no-argument route, and continued support for `/orchestrator <action>`.
- [ ] `orchestrator_*` tools remain the documented normal automated control plane; no public tool contract or automated-control behavior changes.
- [ ] Existing behavior validation continues to pass; no extension lifecycle, persisted-state, tool-contract, session, or worktree behavior changes occur apart from the deliberate human command discoverability surface.
- [ ] No npm publish, registry query, release, remote GitHub mutation (including push, pull-request creation, release creation, or GitHub settings changes), secret handling, session/worktree creation, staging, committing, or pushing occurs as part of this change.

## Compatibility

- Runtime extension lifecycle behavior, persisted state, public tool contracts, and session/worktree boundaries remain unchanged.
- `/orchestrator <action>` remains available with the same action syntax and semantics.
- Namespaced commands are additive compatibility aliases, not a new command-processing implementation or automated API.
- Existing local development continues to use `npm test` and `npm run build`.
- The eventual package consumer contract remains source-based unless a separately approved future change alters the package entry strategy.
- The new `files` allowlist is intentionally a distribution boundary; any later consumer-required file must be explicitly added and covered by pack verification.

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| The allowlist omits a file required by Pi consumers. | Define required package contents in a test-first contract and inspect `npm pack --dry-run --json` before publication is considered. |
| Public metadata links are malformed or diverge from the canonical repository. | Use the confirmed canonical identity exactly as the metadata source; test or review repository, issue-tracker, and homepage values before completion. |
| Local origin evidence is mistaken for permission to alter the remote. | Treat the URL only as metadata evidence; prohibit push, GitHub settings changes, and all remote mutation in this change. |
| CI differs from local Node/npm support, or its event execution is assumed without remote evidence. | Pin the supported Node setup in CI from the package compatibility decision and locally validate the workflow configuration and commands; defer observing a push/PR GitHub Actions run to separately authorized remote delivery validation. |
| Namespaced aliases drift from the compatibility command or duplicate stateful logic. | Route aliases through the existing command implementation and add registration/invocation tests for the complete action set and argument forwarding. |
| New aliases unexpectedly shadow or conflict with Pi command registration rules. | Validate registration in the extension test harness and keep the existing umbrella command unchanged as the recovery path. |
| Contributor or exploratory documentation is mistaken for a release promise or runtime contract. | Clearly mark the fast-decision-model brief as exploratory and keep README edits navigational only. |
| Removing `private` creates accidental-publication risk. | Do not add publish automation or credentials; preserve publication as a separate human-authorized action and use dry-run-only verification. |
| Documentation drifts from behavior. | Keep initial stable pages constrained to existing, evidenced behavior and require later behavior changes to update the relevant reference page. |

## Rollback

Because this change performs no registry, release, push, pull-request, remote GitHub, or lifecycle-state mutation, rollback is repository-local: revert the readiness commit(s), restoring the prior private package setting, package metadata, file allowlist, CI workflow configuration, documentation, and namespaced command registrations together. Reverting the alias registration restores the pre-change discoverability behavior while `/orchestrator <action>` remains the compatibility route. No unpublish, remote cleanup, credential rotation, migration, or state repair is needed. If the locally validated CI workflow configuration proves unsuitable, disable or revert it while retaining local `npm test`, `npm run build`, and pack-verification evidence until a corrected workflow is approved; any observation of a GitHub Actions push/PR run remains separately authorized remote delivery work.

## Success criteria

The repository has an inspectable MIT and contributor baseline with the exact notice `Copyright (c) 2026 David Jadczyk`, an explicit future npm package boundary verified locally, locally validated CI workflow configuration, public metadata tied to its canonical GitHub repository, and progressively structured reference material. Human users can discover every supported interactive orchestration action directly through `/orchestrator:<action>` while compatibility actions delegate through the existing implementation and `orchestrator_*` tools remain the normal automated control plane. Actual GitHub Actions execution on a push or pull request is not a success condition for this change and requires separately authorized remote delivery validation. A future publication decision can be reviewed from the packed artifact and metadata without relying on registry access, remote mutation, secrets, or changes to extension lifecycle behavior.
