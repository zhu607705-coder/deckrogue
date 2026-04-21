# ADR 0002: Python-WASM Authoritative Core

- Status: Accepted
- Date: 2026-03-11

## Context
- The refactor plan requires Python to become the long-term rules authority across Web, desktop, and mobile.
- Full WASM integration is not yet wired in this batch, but the contract shape must already align to that target.

## Decision
- Define the Python surface now as:
  - `boot(content_bundle, seed=0) -> RuleRuntime`
  - `RuleRuntime.dispatch(command)`
  - `RuleRuntime.snapshot()`
  - `RuleRuntime.load(snapshot)`
- Keep `PythonWasmAdapter` as an explicit scaffold that fails loudly until the actual WASM runtime is wired.

## Consequences
- Future integration work targets a fixed API.
- Existing TypeScript code can depend on the adapter abstraction without pretending WASM exists today.
- Verification remains possible through the legacy oracle adapter.
