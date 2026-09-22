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
- `pi-session-orchestrator@0.2.0` is published. The permanent release route is
  `.github/workflows/publish.yml`: it is manually dispatched from protected `main`,
  uses an annotated version tag, and publishes publicly with npm OIDC/provenance
  and no token.
- Never publish to npm locally. Do not put npm credentials, tokens, token-bearing
  configuration, or secrets in repository files. Trusted publishing is configured
  externally for the permanent GitHub Actions workflow.

## Project skill

- `.pi/skills/create-release/SKILL.md` is intentionally ignored local guidance for
  release agents; follow it without adding the skill to the package or repository.
