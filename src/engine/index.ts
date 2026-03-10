/**
 * @deprecated Compatibility facade.
 * Use canonical modules under:
 * - @/core/*
 * - @/features/*
 * - @/content/*
 * - @/infrastructure/*
 * - @/ui/*
 */

/** @deprecated use '@/core/events/gameEngine' */
export { GameEngine } from '@/core/events/gameEngine';

/** @deprecated use '@/core/persistence/setup' */
export { gameSetup, createGameSetup, getGameSetup, resetGameSetup } from '@/core/persistence/setup';

/** @deprecated use '@/core/combat/combatSystem' */
export { combatSystem, CombatSystem } from '@/core/combat/combatSystem';

/** @deprecated use '@/core/events/eventBus' */
export { globalEventBus, EventBus } from '@/core/events/eventBus';

/** @deprecated use '@/features/relics/relicSystem' */
export { relicSystem, RelicSystem } from '@/features/relics/relicSystem';

/** @deprecated use '@/features/synergies/synergySystem' */
export { synergySystem, SynergySystem } from '@/features/synergies/synergySystem';

/** @deprecated use '@/features/progression/economySystem' */
export { economySystem, EconomySystem } from '@/features/progression/economySystem';

/** @deprecated use '@/core/events/runGenerator' */
export { runGenerator, RunGenerator } from '@/core/events/runGenerator';

/** @deprecated use '@/core/events/runSummarySystem' */
export { computeRunSummary } from '@/core/events/runSummarySystem';

/** @deprecated use '@/core/persistence/saveManager' */
export { saveManager, SaveManager } from '@/core/persistence/saveManager';

/** @deprecated use '@/core/persistence/metaProfileStore' */
export {
  loadMetaProfile,
  saveMetaProfile,
  createDefaultMetaProfile,
  applyRunSummaryToMetaProfile
} from '@/core/persistence/metaProfileStore';

/** @deprecated use '@/core/persistence/metaInjection' */
export { applyMetaProfileToNewRunState } from '@/core/persistence/metaInjection';

/** @deprecated use '@/core/balance/balanceSystem' */
export { balanceSystem, BalanceSystem } from '@/core/balance/balanceSystem';

/** @deprecated use '@/core/balance/evaluationSystem' */
export { evaluationSystem, EvaluationSystem } from '@/core/balance/evaluationSystem';

/** @deprecated use '@/core/balance/metaBalance' */
export { metaBalance } from '@/core/balance/metaBalance';

/** @deprecated use '@/core/balance/numericConstants' */
export { NUMERIC_PRECISION, COMBAT_NUMBERS, ECONOMY_DEFAULTS, BALANCE_CONSTANTS } from '@/core/balance/numericConstants';

/** @deprecated use '@/core/balance/numericMath' */
export {
  clampNumber,
  quantizeFloat,
  floorInt,
  normalizeDamageBase,
  applyDamageMultiplierStep,
  finalizeDamage
} from '@/core/balance/numericMath';

/** @deprecated use '@/infrastructure/rng/rng' */
export { createRNG } from '@/infrastructure/rng/rng';

/** @deprecated use '@/infrastructure/rng/stateRandom' */
export {
  bindStateRng,
  stateRandom,
  stateRandomChoice,
  stateRandomId,
  stateRandomInt,
  stateShuffle
} from '@/infrastructure/rng/stateRandom';

/** @deprecated use '@/core/events/metricsTracker' */
export { metricsTracker, MetricsTracker } from '@/core/events/metricsTracker';

/** @deprecated use '@/features/achievements/achievementSystem' */
export {
  getAchievementDefs,
  getAchievementDefById,
  evaluateRunAchievements,
  getAchievementTotalCount,
  getAchievementUnlockedCount,
  getAchievementsLinkedToEntity
} from '@/features/achievements/achievementSystem';

/** @deprecated use '@/core/persistence/codexStore' */
export {
  loadCodexProfile,
  saveCodexProfile,
  getCodexEntryKey,
  isCodexEntryUnlocked,
  unlockCodexEntry,
  unlockManyCodexEntries,
  toggleCodexFavorite,
  exportCodexProfileJson,
  importCodexProfileJson,
  getCodexUnlockedCount
} from '@/core/persistence/codexStore';

/** @deprecated use '@/core/actions/actionManager' */
export { ActionManager, createActionManager, getActionManager } from '@/core/actions/actionManager';

/** @deprecated use '@/core/actions/actionQueue' */
export { ActionQueue, globalActionQueue } from '@/core/actions/actionQueue';

/** @deprecated use '@/core/actions/v2/ActionFactory' */
export { ActionFactoryV2, actionFactoryV2, setupActionManager } from '@/core/actions/v2/ActionFactory';

/** @deprecated use '@/core/combat/targetingService' */
export { TargetingService, targetingService } from '@/core/combat/targetingService';

/** @deprecated use '@/core/events/bossPhaseSystem' */
export { getBossPhaseEncounter, getBossPhaseForHpPct } from '@/core/events/bossPhaseSystem';

/** @deprecated use '@/core/types' */
export type {
  ActionSpec,
  ActiveEventState,
  CardDef,
  CardTarget,
  CharacterDef,
  CombatState,
  EventListener,
  GameState,
  MapNode,
  MetaAchievementsState,
  MetaCurrencies,
  MetaProfile,
  MetaProgressionState,
  MetaPreferences,
  MetaUnlocks,
  RunSummary,
  StoryEventDef
} from '@/core/types';

/** @deprecated use '@/core/events/eventBus' */
export type { GameEvent } from '@/core/events/eventBus';

/** @deprecated use '@/core/combat/combatSystem' */
export type { DamageContext, DamageModifier } from '@/core/combat/combatSystem';

/** @deprecated use '@/core/persistence/saveManager' */
export type { SaveData, SaveSlot } from '@/core/persistence/saveManager';

/** @deprecated use '@/core/persistence/setup' */
export type { GameSetupConfig, GameState as SetupState } from '@/core/persistence/setup';
