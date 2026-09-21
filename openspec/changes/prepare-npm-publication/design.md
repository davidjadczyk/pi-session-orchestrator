# Design: Prepare npm Publication

## Summary

This change creates an inspectable future-publication boundary without publishing or changing runtime orchestration behavior. It adds legal and contributor material, manifest metadata, a dry-run pack boundary verifier, a validation-only CI workflow, progressive reference documentation, and additive interactive command aliases. The existing `/orchestrator <action>` parser (`runCommand`) remains the single command implementation and `orchestrator_*` tools remain the automated control plane.

## Decisions and constraints

- The root `LICENSE` uses the MIT text and includes this notice exactly: `Copyright (c) 2026 David Jadczyk`.
- The canonical public identity is exactly `https://github.com/davidjadczyk/pi-session-orchestrator`; no remote inspection or mutation is part of implementation or validation.
- Publication remains a separately authorized future action. No package publish, registry query, release, tag, push, PR, credential, secret, or GitHub configuration action is permitted.
- Runtime source behavior, state contracts, tools, session/worktree behavior, and `/orchestrator <action>` semantics do not change. Only namespaced human-command registration is added.
- CI is validated from repository contents locally. A GitHub-hosted workflow run is not claimed or required.

## Package boundary and metadata

`package.json` will retain `name: "pi-session-orchestrator"`, remove `private`, and set these values:

```json
{
  "description": "Explicit, durable coordinator and focused-session state for Pi",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/davidjadczyk/pi-session-orchestrator.git"
  },
  "bugs": {
    "url": "https://github.com/davidjadczyk/pi-session-orchestrator/issues"
  },
  "homepage": "https://github.com/davidjadczyk/pi-session-orchestrator",
  "keywords": [
    "pi",
    "pi-extension",
    "orchestration",
    "session-coordination"
  ],
  "engines": {
    "node": ">=22.19.0"
  },
  "files": [
    "src/",
    "README.md",
    "LICENSE",
    "assets/pi-session-orchestrator-thumbnail-pi-sessions.png",
    "docs/reference/"
  ]
}
```

The existing Pi extension declaration and peer dependency range remain unchanged. `engines.node` matches the currently pinned Pi coding-agent runtime requirement. The explicit allowlist intentionally ships the TypeScript source entry and its local module graph, README, legal notice, and consumer reference documents only. It intentionally does not ship `test/`, `.github/`, `openspec/`, development scripts, lockfiles, TypeScript configuration, or other repository-local files. `package.json` remains in npm's mandatory pack set.

## Packed-artifact verification

A repository-only `scripts/verify-pack.mjs` will be exposed as `npm run verify-pack`. It will execute `npm pack --dry-run --json --ignore-scripts`, parse the sole JSON pack result, normalize returned file paths, and exit nonzero with a specific list of violations.

The verifier's required set is `package.json`, `README.md`, `LICENSE`, the README thumbnail asset `assets/pi-session-orchestrator-thumbnail-pi-sessions.png`, and every current `src/*.ts` runtime module (`src/index.ts`, `src/binding.ts`, `src/model.ts`, `src/prompt.ts`, `src/state.ts`, and `src/tools.ts`). Its prohibited path classes are `test/`, `.github/`, `openspec/`, `scripts/`, and repository-local root files other than the mandatory consumer files (including `package-lock.json` and `tsconfig.json`). The explicit asset is the only permitted `assets/` path. The check must also reject any file outside the declared consumer boundary. This makes an allowlist regression or a newly introduced unreviewed packaged file fail locally before publication is considered.

Tests will cover verifier parsing and both failure classes using fixture JSON: a complete permitted list passes; a missing required file reports that path; and each prohibited category reports the included path. The implementation must not create a tarball, invoke lifecycle scripts, authenticate, query a registry, or publish.

## Local-only CI validation

`.github/workflows/ci.yml` will declare `push` and `pull_request` triggers and one validation job on Node `22.19.0`. The job checks out code, installs locked dependencies with `npm ci`, and runs, in order:

1. `npm test`
2. `npm run build`
3. `npm run verify-pack`

It has no permissions elevation, secrets, npm authentication, publishing, release, registry-query, or GitHub-mutating step. A local workflow-configuration test will read the committed workflow and assert both required event keys, Node version, install command, the three exact validation commands, and the absence of prohibited publication/credential tokens. That test is run by existing `npm test`; `npm run build` verifies implementation typing; `npm run verify-pack` verifies actual local package contents. This validates configuration only and explicitly does not observe a remote Actions run.

## Documentation structure

The implementation adds:

```text
LICENSE
CONTRIBUTING.md
CODE_OF_CONDUCT.md
docs/reference/
  README.md
  coordination-model.md
  operational-boundaries.md
  fast-decision-model.md
```

- `CONTRIBUTING.md` provides `npm install`, `npm test`, `npm run build`, and `npm run verify-pack`, contribution expectations, and the no-publish/no-credentials/no-remote-mutation boundary.
- `CODE_OF_CONDUCT.md` provides standard expected-conduct language and a public reporting route that needs no secret or private operational access.
- `docs/reference/README.md` labels `coordination-model.md` and `operational-boundaries.md` as current, evidenced behavior and labels `fast-decision-model.md` as exploratory.
- The stable pages summarize already evidenced coordination roles, explicit state, handoffs, tool/command boundaries, and operational authority limits; they introduce no runtime contract.
- The exploratory brief contains intent, a candidate decision flow, open questions, and an explicit statement that it is neither a delivery promise nor a runtime commitment.
- README receives navigation links only, pointing to contribution, conduct, and reference material; its behavioral narrative is otherwise unchanged.

## Interactive command alias design

`src/index.ts` retains `runCommand(store, args, ctx)` as the only parser, validator, lifecycle dispatcher, error handler, and status-refresh path. A small registration helper receives a fixed supported action and registers `/orchestrator:<action>` with a handler that prepends that fixed action to the alias arguments and calls `runCommand`. It does not inspect, parse, validate, or transform the forwarded arguments beyond adding the action separator required by the existing parser.

| Alias | Compatibility invocation | Fixed action |
| --- | --- | --- |
| `/orchestrator:coordinator` | `/orchestrator coordinator` | `coordinator` |
| `/orchestrator:assign` | `/orchestrator assign <json>` | `assign` |
| `/orchestrator:attach` | `/orchestrator attach <assignment-id>` | `attach` |
| `/orchestrator:start` | `/orchestrator start` | `start` |
| `/orchestrator:handoff` | `/orchestrator handoff <json>` | `handoff` |
| `/orchestrator:accept` | `/orchestrator accept <assignment-id> [reason]` | `accept` |
| `/orchestrator:return` | `/orchestrator return <assignment-id> <reason>` | `return` |
| `/orchestrator:decision` | `/orchestrator decision <json>` | `decision` |
| `/orchestrator:block` | `/orchestrator block <reason>` | `block` |
| `/orchestrator:abandon` | `/orchestrator abandon <reason>` | `abandon` |
| `/orchestrator:status` | `/orchestrator status` | `status` |

The original `orchestrator` registration is unchanged and remains the recovery/compatibility route. No alias is registered for an unsupported action, and no `orchestrator_*` tool registration or contract changes.

## Test matrix

| Area | Coverage |
| --- | --- |
| Manifest and license | Assert exact package name, MIT license, canonical URL-derived metadata, absence of `private`, exact `files` allowlist, and exact LICENSE notice. |
| Pack verifier | Fixture-based valid, missing-required, and prohibited-content cases; command-level dry-run check validates the real package boundary. |
| CI workflow | Local static workflow test verifies triggers, Node version, install and validation commands, and no prohibited privileged/publishing constructs. |
| Documentation | Assert reference index links/status labels, exploratory brief required sections, and README additions are navigation links. |
| Alias registration | Mock `ExtensionAPI.registerCommand` and assert the eleven exact `/orchestrator:<action>` names plus the unchanged umbrella command. |
| Alias invocation | Compare alias and umbrella-command notifications/state for an argument-bearing action (`assign`) and a no-argument action (`status`), including an invalid argument error to prove shared validation. |
| Regression | Run existing `npm test` and `npm run build` unchanged. |

## Implementation order and rollout

1. Add tests first for manifest/license, pack verifier, local workflow shape, documentation structure, and alias registration/delegation.
2. Add legal/community/reference material and README links.
3. Add manifest metadata, allowlist, verifier implementation, and workflow.
4. Register aliases through `runCommand` and complete invocation tests.
5. Run `npm test`, `npm run build`, and `npm run verify-pack`; inspect the dry-run file list and workflow test output locally.

The rollout is repository-local only. A later, separately authorized delivery may assess a packed artifact, push, open a PR, observe CI, or publish; none is performed here. Rollback is a repository-local revert of this cohesive change, which restores `private`, removes publication metadata/allowlist/verifier/CI/docs/aliases, and leaves no external state to clean up.

## File changes

| Path | Change |
| --- | --- |
| `LICENSE` | Add MIT text with exact confirmed notice. |
| `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md` | Add concise contributor and conduct guidance. |
| `package.json` | Add exact metadata, engine, scripts, and allowlist; remove `private`. |
| `scripts/verify-pack.mjs` | Add local deterministic dry-run pack verifier. |
| `.github/workflows/ci.yml` | Add validation-only push/PR workflow. |
| `docs/reference/*` | Add index, two stable pages, and one exploratory brief. |
| `README.md` | Add documentation navigation links only. |
| `src/index.ts` | Register aliases that delegate to `runCommand`. |
| `test/*.test.ts` | Add focused readiness, workflow, documentation, and command alias coverage. |

No implementation file is changed by this design phase; this design artifact is the only OpenSpec edit.

## 0.2.0 local documentation slice addendum

The later local `0.2.0` slice deliberately changes the additive universal prompt baseline: small, known work may remain inline; orchestration and delegation require an explicit durable assignment; and work that outgrows its bounded scope should use fast focused delegation. It preserves no inferred roles, no automatic session creation, and no authority or delivery transfer.

The package now ships a canonical `docs/README.md` index plus prompt, optional `pi-intercom`, and release/version preparation pages. `pi-intercom` remains an optional companion transport and is not a package dependency. The pack verifier requires each README-linked document, and documentation/version synchronization tests verify valid SemVer plus root manifest/lock agreement.

`0.2.0` is an additive pre-1.0 minor release: it adds user-visible guidance and packaged documentation without dependency changes. The proposed PR 4 is a future delivery plan only; it has not been created, pushed, or independently verified remotely. Commit, push, tag, GitHub release, remote Actions observation, and npm publishing remain separately authorized actions.
