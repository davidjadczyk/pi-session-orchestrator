# Package Readiness Specification

## Purpose

Define an inspectable future npm package boundary for `pi-session-orchestrator` without publication, registry access, release activity, or runtime behavior changes.

## Requirements

### Requirement: Future package identity and canonical public metadata

The package manifest MUST retain the exact unscoped name `pi-session-orchestrator`, MUST declare the `MIT` license, and MUST NOT prevent future publication solely through a `private` setting. The manifest MUST identify `https://github.com/davidjadczyk/pi-session-orchestrator` as its canonical public repository URL, MUST identify `https://github.com/davidjadczyk/pi-session-orchestrator/issues` as its issue-tracker URL, and MUST identify `https://github.com/davidjadczyk/pi-session-orchestrator` as its homepage URL. Repository, issue-tracker, homepage, discovery, and runtime-compatibility metadata MUST be internally consistent with that canonical repository identity. The change MUST NOT publish a package, query a registry, create a release, or add credentials or publication automation.

#### Scenario: Manifest expresses the confirmed future identity

- GIVEN the package manifest is inspected after the change
- WHEN its name, license, repository, issue-tracker, and homepage metadata are read
- THEN the name is exactly `pi-session-orchestrator`, the license is exactly `MIT`, the repository and homepage URLs are exactly `https://github.com/davidjadczyk/pi-session-orchestrator`, and the issue-tracker URL is exactly `https://github.com/davidjadczyk/pi-session-orchestrator/issues`

#### Scenario: Metadata remains canonical and internally consistent

- GIVEN package metadata values for repository discovery or runtime compatibility are inspected
- WHEN their public URLs or repository references are compared with the canonical identity
- THEN they do not identify another repository or organization

#### Scenario: Preparation remains registry-independent

- GIVEN readiness validation is run locally or in CI
- WHEN the package boundary is inspected
- THEN no publish, registry-ownership check, registry-authentication action, release action, or credential use occurs

### Requirement: Minimal distributable artifact boundary

The package manifest MUST define an explicit minimal `files` allowlist. The allowlist MUST include runtime source and consumer-facing material required by the documented package contract, including `README.md`, `LICENSE`, and the README thumbnail asset `assets/pi-session-orchestrator-thumbnail-pi-sessions.png`, and MAY include explicitly intended reference documentation. It MUST exclude tests, repository automation, OpenSpec working artifacts, and repository-local configuration unless a consumer requirement is explicitly documented and verified. The change MUST NOT alter source modules, runtime APIs, extension behavior, session behavior, or worktree behavior.

#### Scenario: Required consumer material is included

- GIVEN `npm pack --dry-run --json` evaluates the manifest allowlist
- WHEN the package file list is inspected
- THEN runtime source, `README.md`, `LICENSE`, and `assets/pi-session-orchestrator-thumbnail-pi-sessions.png` are present

#### Scenario: Repository-only material is excluded

- GIVEN `npm pack --dry-run --json` evaluates the manifest allowlist
- WHEN the package file list is inspected
- THEN test files, CI configuration, OpenSpec change artifacts, and repository-local configuration are absent unless an explicit consumer justification and verification exist

#### Scenario: Runtime behavior remains unchanged

- GIVEN the readiness change is reviewed
- WHEN changed repository paths are inspected
- THEN no extension source module or runtime API behavior change is included

### Requirement: Deterministic packed-artifact verification

The repository MUST provide a deterministic local command that evaluates `npm pack --dry-run --json` output and fails when required package files are absent or prohibited files are present. The command MUST be usable without secrets, npm credentials, publication permission, or registry access.

#### Scenario: Valid packed artifact passes verification

- GIVEN dry-run pack output contains every required file and no prohibited file
- WHEN the packed-artifact verification command runs
- THEN the command exits successfully without publishing

#### Scenario: Missing required file fails verification

- GIVEN dry-run pack output omits a required runtime or consumer-facing file
- WHEN the packed-artifact verification command runs
- THEN the command fails and identifies the missing required file

#### Scenario: Prohibited file fails verification

- GIVEN dry-run pack output contains a test, CI, OpenSpec change artifact, or repository-local file without an explicit justification
- WHEN the packed-artifact verification command runs
- THEN the command fails and identifies the prohibited file

### Requirement: Documentation and version synchronization for the local 0.2.0 slice

The packed package MUST include every documentation page linked by its README: the documentation index, prompt injection contract, optional `pi-intercom` companion boundary, release/version preparation guide, and stable/exploratory reference pages. The manifest version and root lockfile version MUST match and MUST be valid SemVer. Version `0.2.0` is an additive minor release under the documented pre-1.0 compatibility policy. This requirement does not authorize commits, pushes, tags, GitHub releases, remote Actions observation, registry access, or npm publishing.

#### Scenario: README-linked documentation is packed

- GIVEN `npm pack --dry-run --json` evaluates the manifest allowlist
- WHEN the package file list is verified
- THEN every README-linked documentation page is present and no prohibited repository-only path is accepted

#### Scenario: Manifest and lock version agree

- GIVEN local readiness tests inspect `package.json` and `package-lock.json`
- WHEN their root package versions are read
- THEN both equal `0.2.0` and the value is valid SemVer
