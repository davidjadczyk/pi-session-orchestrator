# Repository CI Specification

## Purpose

Specify locally validated CI configuration for existing behavior and the future package artifact boundary without secrets, publication permissions, remote-state mutation, or an assertion that remote CI has executed.

## Requirements

### Requirement: Push and pull-request validation workflow configuration

The repository MUST provide GitHub CI workflow configuration that declares repository push and pull-request events and, for each configured run, installs dependencies and executes `npm test`, `npm run build`, and the deterministic packed-artifact verification command. The workflow MUST set top-level `permissions: contents: read` and configure checkout with `persist-credentials: false`. The workflow SHALL use the Node compatibility decision documented for the package.

#### Scenario: Workflow configuration declares required events and checks

- GIVEN the workflow configuration is inspected locally
- WHEN its triggers and steps are read
- THEN it declares push and pull-request events and includes dependency installation, `npm test`, `npm run build`, and packed-artifact verification

#### Scenario: Existing validation failure is represented

- GIVEN a configured `npm test`, `npm run build`, or packed-artifact verification step fails
- WHEN the workflow executes in a CI environment
- THEN the workflow configuration does not suppress that failing step

### Requirement: Local-only CI configuration validation

This change MUST validate CI workflow configuration locally using repository-local validation or inspection evidence. It MUST NOT require, trigger, observe, or claim an actual GitHub Actions execution from a push or pull request. Observing remote workflow execution MUST remain deferred to separately authorized remote delivery validation.

#### Scenario: Local validation is sufficient for this change

- GIVEN the CI workflow configuration has been added or changed
- WHEN this change is validated
- THEN validation evidence is produced locally without a push, pull-request creation, or GitHub Actions run

#### Scenario: Remote execution is not represented as completed

- GIVEN no separately authorized remote delivery validation has occurred
- WHEN the change validation result is recorded
- THEN it does not claim that GitHub Actions ran for a push or pull request

### Requirement: Non-publishing CI boundary

The CI workflow and its invoked commands MUST validate only repository contents. They MUST NOT publish packages, query registry ownership or availability, create releases, mutate remote GitHub configuration or content, require secrets, or use npm or GitHub credentials.

#### Scenario: CI runs without privileged publication inputs

- GIVEN the CI workflow runs in an environment without npm or GitHub publication credentials
- WHEN it performs validation
- THEN all required checks can execute without credentials and no publication or remote mutation is attempted

### Requirement: Preservation of existing runtime validation contract

The CI workflow MUST use the existing `npm test` and `npm run build` commands as the behavior and type-validation contract. Adding CI MUST NOT change extension source behavior, public runtime APIs, test behavior expectations, session behavior, or worktree behavior.

#### Scenario: CI wraps rather than replaces local validation

- GIVEN the CI workflow configuration is inspected
- WHEN its validation steps are compared with the documented local workflow
- THEN it invokes the existing `npm test` and `npm run build` commands without substituting a different runtime behavior contract
