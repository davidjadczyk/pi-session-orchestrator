# pi-session-orchestrator Project Context

## Repository

- Package: `pi-session-orchestrator`
- Runtime shape: npm-managed TypeScript ESM Pi extension
- Entry point: `src/index.ts`
- Core modules: binding, state, prompt, and tools
- Package manager: npm
- Current package state: private; future public npm publication is planned under the same name
- Future license: MIT

## Validation

- Tests: `npm test` (Node's built-in `node:test` runner with `tsx`)
- Type validation: `npm run build` (`tsc --noEmit`)
- TypeScript uses strict checking, ES2022 target, ESNext modules, and bundler resolution.

## SDD Rules

- Artifact store: OpenSpec repository artifacts
- Strict TDD: enabled
- Initialization is limited to repository context and validation configuration.
- Later phases must preserve the requested scope and avoid publication, CI, licensing,
  README, contributor-documentation, and release-configuration changes unless explicitly
  approved.
