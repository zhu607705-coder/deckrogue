# ADR 0003: Render Shell Contract First

- Status: Accepted
- Date: 2026-03-11

## Context
- The long-term plan calls for a Pixi-based render shell, but current UI is still DOM/React driven.
- Rendering cannot safely migrate while gameplay state is still coupled to raw legacy internals.

## Decision
- Defer Pixi integration until the runtime contract and oracle path are in place.
- Introduce `RenderModel` in the v2 contracts now, even if it is not yet consumed by a Pixi renderer.

## Consequences
- UI migration can proceed against a stable boundary later.
- Current batch avoids adding heavy renderer dependencies before the state boundary is validated.
- Existing DOM views continue to function without being treated as the long-term architecture.
