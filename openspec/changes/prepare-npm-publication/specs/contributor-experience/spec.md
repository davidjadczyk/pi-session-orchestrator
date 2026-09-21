# Contributor Experience Specification

## Purpose

Provide an inspectable legal, community, contribution, and reference-document baseline for external contributors without changing the extension's behavior or making release commitments.

## Requirements

### Requirement: Exact MIT legal baseline

The repository MUST contain a root `LICENSE` expressing the MIT license and containing the notice exactly `Copyright (c) 2026 David Jadczyk`. The package manifest MUST declare the same `MIT` license.

#### Scenario: License is discoverable and exact

- GIVEN a contributor inspects the repository root and package manifest
- WHEN they locate license information
- THEN a root `LICENSE` is present, its notice is exactly `Copyright (c) 2026 David Jadczyk`, and the manifest license is exactly `MIT`

### Requirement: Contributor and community guidance

The repository MUST provide concise `CONTRIBUTING.md` guidance for local setup, existing validation commands, scope boundaries, and contribution expectations. It MUST provide `CODE_OF_CONDUCT.md` guidance with a standard conduct policy and a reporting route that does not require repository secrets, unpublished credentials, or private operational knowledge.

#### Scenario: Contributor can validate a local change

- GIVEN a new contributor has a local checkout
- WHEN they read `CONTRIBUTING.md`
- THEN they can find setup guidance and the `npm test` and `npm run build` validation commands

#### Scenario: Contributor can find conduct reporting guidance

- GIVEN a community participant needs conduct guidance
- WHEN they read `CODE_OF_CONDUCT.md`
- THEN they can find expected conduct and a reporting route without needing a repository secret or credential

#### Scenario: Guidance preserves preparation scope

- GIVEN a contributor reads the contribution guidance
- WHEN they review its scope boundaries
- THEN it does not imply authorization to publish, release, mutate remote GitHub state, or handle credentials

### Requirement: Progressive reference documentation

The repository MUST provide a stable reference index that distinguishes documented current behavior from exploratory material. It MUST include initial stable reference pages for the coordination model and operational boundaries, derived from existing evidenced behavior. It MUST include a `fast-decision-model` brief explicitly marked exploratory that states its intent, candidate decision flow, open questions, and non-commitment status.

#### Scenario: Reader can distinguish stable and exploratory content

- GIVEN a reader opens the reference index
- WHEN they select a reference document
- THEN the index identifies whether it documents current behavior or exploratory work

#### Scenario: Stable pages do not invent behavior

- GIVEN a reader reviews the coordination-model and operational-boundaries pages
- WHEN they compare their claims with existing repository behavior
- THEN the pages describe only evidenced current behavior and do not establish a new runtime contract

#### Scenario: Fast-decision model does not promise delivery

- GIVEN a reader opens the fast-decision-model brief
- WHEN they read its status and content
- THEN it identifies itself as exploratory and includes intent, a candidate decision flow, open questions, and an explicit statement that it is not a runtime commitment

### Requirement: README navigation-only updates

Any README update in this change MUST be limited to links to the new contribution, community, and reference documents. It MUST preserve the README's existing behavioral narrative and MUST NOT add or change runtime behavior claims.

#### Scenario: README change is limited to navigation

- GIVEN the README diff for this change is reviewed
- WHEN its non-link content is compared with the prior README
- THEN the existing behavioral narrative is unchanged and added content only links to the approved documentation
