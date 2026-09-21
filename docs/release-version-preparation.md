# Release and version preparation

Use this guide to prepare a local candidate. It does not authorize delivery or run npm publishing locally.

## Choose the version

Follow SemVer:

- **Major:** incompatible public API, documented behavior, or packaging-contract change.
- **Minor:** backward-compatible user-visible capability or additive documented contract.
- **Patch:** backward-compatible bug fix or documentation correction with no new capability.
- **Before 1.0:** treat incompatible public-contract changes as minor; use patch for compatible fixes. State the compatibility impact explicitly.

Version `0.2.0` is a minor release because it adds user-visible explicit delegation guidance and packaged documentation while preserving existing APIs and dependencies.

## Pi installation and discovery

- Keep `pi-package` in `package.json` keywords so the package gallery can discover the package.
- Keep `pi.extensions` as the resource manifest for the extension entry point.
- Keep the gallery image on the public `main` URL so the registry metadata remains stable:
  `https://raw.githubusercontent.com/davidjadczyk/pi-session-orchestrator/main/assets/pi-session-orchestrator-thumbnail-pi-sessions.png`.
- After publication, users install the package with `pi install npm:pi-session-orchestrator`.

## Prepare locally

1. Update `package.json` and the root `package-lock.json` to the same valid SemVer version.
2. Keep Pi runtime packages, including `typebox`, in `peerDependencies` with `"*"`; retain development pins only for local type-checking and tests.
3. Update package-facing documentation and its distribution allowlist.
4. Run:

   ```sh
   npm test
   npm run build
   npm run verify-pack
   npm pack --dry-run --json --ignore-scripts
   ruby -e 'require "yaml"; ARGV.each { |path| YAML.safe_load_file(path) }' .github/workflows/ci.yml .github/ISSUE_TEMPLATE/bug_report.yml .github/ISSUE_TEMPLATE/feature_request.yml
   git diff --check
   git diff --cached --name-only
   ```

4. Inspect the dry-run package list and verify every README-linked package document is included.

## Protected-branch release procedure

1. Configure the repository externally with protected `main` as the default branch. Require pull requests and the repository's normal required checks before merging.
2. Configure npm trusted publishing externally for `davidjadczyk/pi-session-orchestrator` using GitHub Actions, workflow file `.github/workflows/publish.yml`, and the public npm registry. The npm package settings, not this repository, store that trusted-publisher relationship.
3. Merge the reviewed release to protected `main`, create an exact annotated tag such as `v0.2.0`, and push the tag through the normal authorized repository process.
4. Manually dispatch **Publish package** from `main` with the exact tag. The workflow rejects non-`vSemVer` input, lightweight tags, tag/main divergence, version mismatches, and any run that is not based on remote `main`.
5. The workflow runs `npm ci`, tests, build, package verification, and `npm pack --dry-run` before `npm publish --provenance` with GitHub OIDC. No npm token is stored in the repository or used for this release path.

The external prerequisites are: protected `main` and its required checks, the annotated-tag push permission, and npm trusted-publisher configuration for this exact repository/workflow. Verify them in their respective systems before attempting a dispatch.

## Delivery boundary

Commits, pushes, tags, GitHub releases, remote Actions observation, and npm publishing each require separate authorization. Local preparation must never publish to npm, create a tag or release, dispatch the workflow, or change GitHub settings.
