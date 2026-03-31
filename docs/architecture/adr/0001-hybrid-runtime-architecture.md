# ADR 0001: Hybrid Runtime Architecture

- Status: Accepted
- Date: 2026-03-11

## Context
- The current codebase centralizes gameplay ownership in TypeScript `GameEngine`.
- The target architecture requires a future Python-WASM rules-core without blocking current feature verification.

## Decision
- Adopt a hybrid runtime:
  - Python defines the authoritative v2 rules-core contract.
  - TypeScript hosts the runtime bridge and current compatibility oracle.
  - Legacy `GameEngine` remains the migration oracle until parity milestones are met.

## Consequences
- Contracts can stabilize before WASM integration lands.
- The migration path remains testable inside the existing repo.
- There is temporary duplication between legacy state and v2 snapshot shapes.
