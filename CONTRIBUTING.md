# Contributing

## Local validation

Use Node 22.19.0 or newer, then run:

```sh
npm install
npm test
npm run build
npm run verify-pack
```

Keep changes focused, add regression coverage, and describe material behavior changes. Start with the [documentation index](docs/README.md); stable reference pages describe current behavior, while exploratory pages do not create runtime commitments. Use the [release/version preparation guide](docs/release-version-preparation.md) for local version changes.

## Scope and safety

This repository-local preparation does not authorize publishing, releases, remote GitHub mutation, credential handling, or registry access. Do not add secrets or publication automation. Validate workflows locally; do not represent remote Actions as observed.

## Contributions

Open a focused change with tests and concise evidence. Report non-credential issues through the repository's normal public issue channel. Maintainers review scope, compatibility, and documentation before accepting changes.
