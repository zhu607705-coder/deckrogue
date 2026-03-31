# DeckRogue Working Memory

Last updated: 2026-03-11

## Project State

- Repo root: `/Users/zhuhangcheng/Downloads/好玩/deckrogue`
- Main runtime entry:
  - `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/main.tsx`
  - `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/ui/views/AppShell.tsx`
- Runtime ownership is being gradually moved away from:
  - `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/core/events/gameEngine.ts`
  - `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/core/persistence/setup.ts`

## Hard Rules

- Update these after meaningful implementation work:
  - `/Users/zhuhangcheng/Downloads/好玩/deckrogue/progress.md`
  - `/Users/zhuhangcheng/Downloads/好玩/deckrogue/docs/development-reports/project-development-report.md`
- The project development report is single-file only:
  - always reuse `/Users/zhuhangcheng/Downloads/好玩/deckrogue/docs/development-reports/project-development-report.md`
  - do not create dated per-task development reports for this workspace
  - before planning or continuing work, read this file first to recover prior work context
- All report artifacts are update-in-place only:
  - do not create new timestamped report files under `/Users/zhuhangcheng/Downloads/好玩/deckrogue/reports`
  - do not create parallel copies of the same report type
  - always overwrite or refresh the canonical latest report path for that report type
  - before claiming a report-based gate passed, verify the updated canonical report was regenerated in the current turn
- Prefer `@/core`, `@/features`, `@/content`, `@/ui`, `@/infrastructure` imports.
- `src/engine/*` is compatibility-only. Do not add new business logic there.
- Keep `Esc` reserved for system/menu behavior if keyboard work continues.

## Verified Facts

- Background and card image compression already completed.
- All target images in:
  - `/Users/zhuhangcheng/Downloads/好玩/deckrogue/public/assets/cards`
  - `/Users/zhuhangcheng/Downloads/好玩/deckrogue/public/assets/backgrounds`
  are currently at or below `1,000,000` bytes.
- Compression report:
  - `/Users/zhuhangcheng/Downloads/好玩/deckrogue/output/image_compression_report.md`
  - `/Users/zhuhangcheng/Downloads/好玩/deckrogue/output/image_compression_report.json`

## Current Gameplay Architecture Work

- Unified numerics domain exists under:
  - `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/core/balance`
- Runtime state machine groundwork exists under:
  - `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/core/events/eventContract.ts`
  - `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/core/events/runStateMachine.ts`
- `GameEngine.dispose()` and `GameSetup.disposeCurrentRun()` were introduced to reduce leaked subscriptions.

## Current Card Runtime Model

- Runtime card instances are in:
  - `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/core/combat/runCardInstance.ts`
- Current shape includes:
  - `instanceId`
  - `baseCardId`
  - `runtimeBase`
  - `persistentEnchantments[]`
  - `combatAfflictions[]`
- UI already partially supports this in:
  - `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/ui/views/CardView.tsx`
  - `/Users/zhuhangcheng/Downloads/好玩/deckrogue/src/ui/views/EnchantView.tsx`

## Known Pending Work

- Finish lint-safe migration from raw `CardDef` runtime piles to `RunCardInstance` everywhere.
- Keep enchantment system split into:
  - persistent positive enchantments for the run
  - combat-only negative afflictions from enemies
- Any enchantment or affliction work must also include:
  - UI visibility
  - balance/math regression outputs
  - tests

## Regression Priorities

- Maintain profession strength spread within the current modeled target.
- Standard training loop is documented in:
  - `/Users/zhuhangcheng/Downloads/好玩/deckrogue/docs/guides/train.md`
- Treat any balance/economy training run as failed if logs contain:
  - `Illegal run transition`
  - `Unknown action type`
  even when the process exits with code `0`.
- Re-run and trust:
  - `/Users/zhuhangcheng/Downloads/好玩/deckrogue/scripts/analysis/balance_test.ts`
  - `/Users/zhuhangcheng/Downloads/好玩/deckrogue/scripts/analysis/simulate_early_balance.ts`
  - `/Users/zhuhangcheng/Downloads/好玩/deckrogue/scripts/analysis/numeric_diagnostics.ts`

## UI / QA Priorities

- Use Playwright smoke after meaningful UI changes.
- Watch for:
  - broken images
  - layout drift
  - keyboard/mouse interaction conflicts
  - modal hotkey leakage

## Immediate Reminder

- Before touching code again, read this file and verify whether the work affects:
  - `/Users/zhuhangcheng/Downloads/好玩/deckrogue/docs/development-reports/project-development-report.md`
  - runtime ownership
  - card instance model
  - numerics regression
  - report/progress documentation
