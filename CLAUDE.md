# Deckrogue Project Rules

## Scope

- This is the full Deckrogue repository.
- Preserve public imports from `@/core` and existing runtime entrypoints unless a task explicitly migrates callers.
- Do not revert unrelated local changes; this repo is often worked on through parallel worktrees and generated files.

## Runtime Card Boundary

- `CardDef` is immutable card definition data.
- `RunCardInstance` is the only valid type for deck, hand, draw pile, discard pile, exhaust pile, rewards, and shop cards.
- Convert definition cards through `createRunCardInstance` or `normalizeRunCardInstance` before storing them in game state.
- Avoid `as RunCardInstance` casts at runtime boundaries. Prefer explicit factories and type guards.

## Verification

- Before claiming a runtime/card-boundary fix works, run:
  - `npm run lint`
  - a focused unit test covering the touched runtime path
  - `npm run build`
  - `npm run test:ui-smoke`
