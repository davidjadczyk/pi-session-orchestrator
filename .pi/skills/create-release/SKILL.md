---
name: create-release
description: "Trigger: release preparation, npm release, first publish, trusted publishing. Prepare and validate a guarded package release without unsafe delivery."
license: Apache-2.0
metadata:
  author: "gentleman-programming"
  version: "1.0"
---

## Activation Contract

Load for package release preparation, first-publication bootstrap, trusted-publishing setup, or release verification.

## Hard Rules

- Read `../../../AGENTS.md` and `../../../docs/release-version-preparation.md` first.
- Never publish locally, expose credentials, edit secrets, or mutate upstream state without immutable authorization.
- Keep `.github/workflows/publish.yml` tokenless; the temporary bootstrap route is disposable.

## Decision Gates

| State | Route |
| --- | --- |
| Package is not registered | Validate the one-time bootstrap workflow and use its protected secret only in CI. |
| Package exists and trusted publisher is configured | Use the permanent OIDC/provenance workflow. |
| Either prerequisite is uncertain | Stop and report the missing external evidence. |

## Execution Steps

1. Confirm package name/version, protected `main`, current remote `main`, and an annotated exact version tag.
2. Run `npm ci`, `npm test`, `npm run build`, `npm run verify-pack`, and `npm pack --dry-run --json --ignore-scripts`.
3. Confirm the workflow checks tag identity and package version before publishing to the public npm registry.
4. Preview every upstream operation and obtain immutable authorization immediately before executing it; never dispatch, tag, push, or publish implicitly.
5. After publication, verify the public npm package/version and provenance, then remove the bootstrap workflow and credential once trusted publishing is confirmed.

## Output Contract

Return changed paths, exact validation evidence, pending external operations, and explicit confirmation that no credential was exposed or delivery action was performed.

## References

- `../../../AGENTS.md`
- `../../../docs/release-version-preparation.md`
