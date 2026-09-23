# Repository agent rules

## Source and checks

- Treat `src/index.ts` as the Pi extension entry point; keep coordination state and
  model, prompt, binding, and tool boundaries in their existing source modules.
- Keep Pi runtime packages as peers. Before a release, run `npm ci`, `npm test`,
  `npm run build`, `npm run verify-pack`, and
  `npm pack --dry-run --json --ignore-scripts`.
- Keep package-facing documentation and the `files` allowlist in sync.

## Delivery boundaries

- Work through a pull request into protected `main`; do not bypass required checks
  or rewrite shared history. Local identity and repository access do not authorize
  upstream mutation, publication, tags, releases, or workflow dispatch.
- Use the permanent `.github/workflows/publish.yml` route for releases. It is
  manually dispatched from protected `main`, requires an annotated version tag,
  targets the GitHub Actions `npm` environment so releases appear as deployments,
  and publishes publicly with npm OIDC/provenance and no token.
- Never publish to npm locally. Do not put npm credentials, tokens, token-bearing
  configuration, or secrets in repository files. Trusted publishing is configured
  externally for the permanent GitHub Actions workflow.
