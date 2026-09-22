---
name: create-release
description: "Trigger: release preparation, npm release, first publish, trusted publishing. Prepare and validate a guarded package release without unsafe delivery."
license: Apache-2.0
metadata:
  author: "gentleman-programming"
  version: "1.0"
---

## Activation Contract

Load for release preparation, trusted-publishing verification, or permanent release execution.

## Hard Rules

- Read `../../../AGENTS.md` and `../../../docs/release-version-preparation.md` first.
- Never publish locally, expose credentials, edit secrets, or mutate upstream state without immutable authorization.
- Keep `.github/workflows/publish.yml` tokenless and use npm GitHub OIDC with provenance.

## Decision Gates

| State | Route |
| --- | --- |
| Package exists and trusted publisher is configured | Use the permanent OIDC/provenance workflow. |
| Either prerequisite is uncertain | Stop and report the missing external evidence. |

`pi-session-orchestrator@0.2.0 is published`. Future releases use only the permanent
GitHub Actions workflow, its `npm` environment (which records releases as GitHub
deployments), and its externally configured npm trusted publisher.

## Execution Steps

1. Confirm package name/version, protected `main`, current remote `main`, and an annotated exact version tag.
2. Run `npm ci`, `npm test`, `npm run build`, `npm run verify-pack`, and `npm pack --dry-run --json --ignore-scripts`.
3. Confirm the workflow checks tag identity and package version before publishing to the public npm registry.
4. Preview every upstream operation and obtain immutable authorization immediately before executing it; never dispatch, tag, push, or publish implicitly.
5. After publication, verify the public npm package/version and provenance.

## Output Contract

Return changed paths, exact validation evidence, pending external operations, and explicit confirmation that no credential was exposed or delivery action was performed.

## References

- `../../../AGENTS.md`
- `../../../docs/release-version-preparation.md`
