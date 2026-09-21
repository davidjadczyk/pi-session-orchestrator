# Interactive Command Discoverability Specification

## Purpose

Make every supported interactive orchestration action individually discoverable while preserving the existing compatibility command and leaving agent-callable tools unchanged.

## Requirements

### Requirement: Complete discoverable namespaced alias set

The interactive command registry MUST separately register these discoverable command names: `/orchestrator:coordinator`, `/orchestrator:assign`, `/orchestrator:attach`, `/orchestrator:start`, `/orchestrator:handoff`, `/orchestrator:accept`, `/orchestrator:return`, `/orchestrator:decision`, `/orchestrator:block`, `/orchestrator:abandon`, and `/orchestrator:status`. Each alias MUST correspond to the action with the same suffix in the existing `/orchestrator <action>` command surface.

#### Scenario: Every supported action is discoverable

- GIVEN the extension registers its interactive commands
- WHEN the registered command names are enumerated
- THEN each required `/orchestrator:<action>` alias is present exactly once for coordinator, assign, attach, start, handoff, accept, return, decision, block, abandon, and status

### Requirement: Alias delegation and argument forwarding

Each namespaced alias MUST delegate to the existing `/orchestrator <action>` command implementation. An alias MUST forward all user-supplied arguments for its mapped action without changing their ordering or values. Aliases MUST NOT duplicate command parsing, validation, lifecycle transitions, state mutation, success behavior, or error behavior.

#### Scenario: Argument-bearing alias forwards unchanged arguments

- GIVEN a user invokes a namespaced alias for an action that accepts arguments
- WHEN the alias is dispatched with one or more arguments
- THEN the existing compatibility-command implementation receives the mapped action and the same arguments in the same order

#### Scenario: No-argument alias delegates to the same implementation

- GIVEN a user invokes `/orchestrator:status` without arguments
- WHEN the alias is dispatched
- THEN the existing compatibility-command implementation receives the `status` action and produces its established observable behavior

#### Scenario: Alias preserves validation and errors

- GIVEN arguments that the existing compatibility command rejects for a mapped action
- WHEN the equivalent namespaced alias is invoked with those arguments
- THEN it produces the same observable rejection behavior as `/orchestrator <action>`

### Requirement: Compatibility route preservation

The existing `/orchestrator <action>` command MUST remain registered and supported with unchanged action syntax, argument handling, observable success and error behavior, lifecycle semantics, and state-transition behavior. Namespaced commands MUST be additive aliases rather than an independent command-processing implementation.

#### Scenario: Compatibility route remains available

- GIVEN the namespaced aliases are registered
- WHEN a user invokes a supported `/orchestrator <action>` route
- THEN it remains registered and performs the action with its pre-existing semantics

### Requirement: Registration and invocation coverage

Command registration and invocation tests MUST cover the complete required namespaced alias set, continued registration of `/orchestrator`, at least one argument-bearing alias invocation, at least one no-argument alias invocation, delegation to the compatibility implementation, and compatibility-route behavior.

#### Scenario: Tests prove registration and behavior preservation

- GIVEN the command test suite runs
- WHEN it evaluates command registration and invocation
- THEN it verifies every required alias, argument forwarding, no-argument delegation, and continued compatibility-command support

### Requirement: Automated control-plane preservation

The `orchestrator_*` tools MUST remain the documented normal automated control plane. This change MUST NOT alter any public `orchestrator_*` tool contract, automated-control behavior, extension lifecycle rule, persisted-state contract, session behavior, or worktree behavior.

#### Scenario: Tools remain unchanged

- GIVEN the namespaced command change is reviewed
- WHEN public agent-callable tool registrations and contracts are compared with their pre-change state
- THEN every `orchestrator_*` tool remains available with unchanged contract and automated-control behavior
