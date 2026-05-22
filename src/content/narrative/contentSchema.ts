/**
 * @file contentSchema.ts
 * @description Runtime schema guardrails for authored gameplay content.
 */
import type {
  CardAfflictionDef,
  CardDef,
  CardEnchantmentDef,
  CharacterDef,
  EnemyDef,
  PotionDef,
  RelicDef,
  StoryEventDef,
} from '@/core/types';

const CARD_MODIFIER_EFFECT_TYPES = new Set(['damage', 'block', 'cost', 'draw', 'professionResource']);
const CARD_MODIFIER_RESOURCE_TYPES = new Set([
  'intel',
  'timeLayer',
  'thread',
  'concoction',
  'evidence',
  'rage',
  'command',
  'verdict',
  'seal',
]);

export interface NumericConfig {
  version: number;
  chapters?: {
    chapter2?: {
      nodeWeights?: {
        floor_11_12?: Record<string, number>;
        floor_13_15?: Record<string, number>;
        floor_16?: Record<string, number>;
      };
      enemyFloorEligibility?: {
        floor_11_12?: { allow?: string[]; exclude?: string[] };
        floor_13_15?: { allow?: string[]; exclude?: string[] };
        floor_16?: { allow?: string[]; exclude?: string[] };
      };
      bossPool?: string[];
    };
    chapter3?: {
      nodeWeights?: {
        floor_19_20?: Record<string, number>;
        floor_21_23?: Record<string, number>;
        floor_24?: Record<string, number>;
      };
      enemyFloorEligibility?: {
        floor_19_20?: { allow?: string[]; exclude?: string[] };
        floor_21_23?: { allow?: string[]; exclude?: string[] };
        floor_24?: { allow?: string[]; exclude?: string[] };
      };
      bossPool?: string[];
    };
  };
  map?: {
    runtime?: {
      floorTypeCaps?: Record<string, number>;
      openingRouteExpectation?: {
        maxSpread?: number;
        traversalDepth?: number;
        weights?: Record<string, number>;
        maxBranchesPerFloor?: Record<string, number>;
      };
      openingRouteContrast?: {
        maxFloor?: number;
        requireThirdFlavorOnFloor1?: boolean;
        utilityTypes?: string[];
      };
    };
  };
  cards: { byId: Record<string, Record<string, unknown>> };
  potions: {
    byId: Record<string, Record<string, unknown>>;
    runtime?: { slotLimit?: number; toxicityOverloadThreshold?: number };
  };
  relics: { byId: Record<string, Record<string, unknown>> };
  enemies: {
    byId: Record<string, Record<string, unknown>>;
    runtime?: {
      earlyCombatHpSoftCaps?: Record<string, number>;
      earlyEliteHpSoftCaps?: Record<string, number>;
      bossHpSoftCaps?: Record<string, number>;
      singleSlimeRoomBoost?: {
        enabled?: boolean;
        maxFloor?: number;
        hpBonusRatio?: number;
        minHpBonus?: number;
        strengthBonus?: number;
        innateStatus?: Record<string, number>;
      };
      floorEligibility?: {
        elite?: Record<string, number>;
        combat?: Record<string, number>;
      };
    };
  };
  events: {
    runtime?: { minSelectableWeight?: number };
    defs?: Record<string, Partial<Pick<StoryEventDef, 'floorMin' | 'floorMax' | 'weight'>>>;
    outcomes?: Record<string, any>;
  };
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function fail(path: string, message: string): never {
  throw new Error(`[numericSystem] ${path}: ${message}`);
}

function assertPlainObject(value: unknown, path: string): asserts value is Record<string, unknown> {
  if (!isPlainObject(value)) fail(path, 'expected object');
}

function assertArray(value: unknown, path: string): asserts value is unknown[] {
  if (!Array.isArray(value)) fail(path, 'expected array');
}

function assertString(value: unknown, path: string): void {
  if (typeof value !== 'string' || value.length === 0) fail(path, 'expected non-empty string');
}

function assertOptionalString(value: unknown, path: string): void {
  if (value !== undefined) assertString(value, path);
}

function assertFiniteNumber(value: unknown, path: string): void {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(path, 'expected finite number');
}

function assertOptionalFiniteNumber(value: unknown, path: string): void {
  if (value !== undefined) assertFiniteNumber(value, path);
}

function assertOptionalBoolean(value: unknown, path: string): void {
  if (value !== undefined && typeof value !== 'boolean') fail(path, 'expected boolean');
}

function assertStringArray(value: unknown, path: string): void {
  assertArray(value, path);
  value.forEach((entry, index) => assertString(entry, `${path}[${index}]`));
}

function assertOptionalStringArray(value: unknown, path: string): void {
  if (value !== undefined) assertStringArray(value, path);
}

function assertNumberRecord(value: unknown, path: string): void {
  assertPlainObject(value, path);
  for (const [key, entry] of Object.entries(value)) {
    assertFiniteNumber(entry, `${path}.${key}`);
  }
}

function assertOptionalNumberRecord(value: unknown, path: string): void {
  if (value !== undefined) assertNumberRecord(value, path);
}

function assertFiniteNumberTuple(value: unknown, path: string): void {
  assertArray(value, path);
  if (value.length !== 2) fail(path, 'expected two numeric entries');
  assertFiniteNumber(value[0], `${path}[0]`);
  assertFiniteNumber(value[1], `${path}[1]`);
}

function validateActionSpecArray(value: unknown, path: string): void {
  assertArray(value, path);
  value.forEach((entry, index) => {
    const actionPath = `${path}[${index}]`;
    assertPlainObject(entry, actionPath);
    assertString(entry.type, `${actionPath}.type`);
  });
}

function validateCardModifierEffect(value: unknown, path: string): void {
  assertPlainObject(value, path);
  assertString(value.type, `${path}.type`);
  const effectType = value.type as string;
  if (!CARD_MODIFIER_EFFECT_TYPES.has(effectType)) fail(`${path}.type`, 'unsupported card modifier effect type');
  assertFiniteNumber(value.amount, `${path}.amount`);
  if (effectType === 'professionResource') {
    assertString(value.resource, `${path}.resource`);
    if (!CARD_MODIFIER_RESOURCE_TYPES.has(value.resource as string)) fail(`${path}.resource`, 'unsupported profession resource');
  } else if (value.resource !== undefined) {
    fail(`${path}.resource`, 'resource is only valid for professionResource effects');
  }
}

function validateOptionalPatchTable(value: unknown, path: string): Record<string, Record<string, unknown>> {
  if (value === undefined) return {};
  assertPlainObject(value, path);
  for (const [id, patch] of Object.entries(value)) {
    assertString(id, `${path} key`);
    assertPlainObject(patch, `${path}.${id}`);
  }
  return value as Record<string, Record<string, unknown>>;
}

function validateNumericLeafObject(value: unknown, path: string): void {
  assertPlainObject(value, path);
  for (const [key, entry] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if (isPlainObject(entry)) {
      validateNumericLeafObject(entry, childPath);
    } else if (Array.isArray(entry)) {
      entry.forEach((arrayEntry, index) => {
        if (typeof arrayEntry !== 'string') fail(`${childPath}[${index}]`, 'expected string');
      });
    } else if (typeof entry === 'boolean') {
      continue;
    } else {
      assertFiniteNumber(entry, childPath);
    }
  }
}

function validateChapterConfig(value: unknown, path: string): void {
  if (value === undefined) return;
  assertPlainObject(value, path);
  const nodeWeights = value.nodeWeights;
  if (nodeWeights !== undefined) {
    assertPlainObject(nodeWeights, `${path}.nodeWeights`);
    Object.entries(nodeWeights).forEach(([key, entry]) => assertNumberRecord(entry, `${path}.nodeWeights.${key}`));
  }
  const eligibility = value.enemyFloorEligibility;
  if (eligibility !== undefined) {
    assertPlainObject(eligibility, `${path}.enemyFloorEligibility`);
    Object.entries(eligibility).forEach(([key, entry]) => {
      assertPlainObject(entry, `${path}.enemyFloorEligibility.${key}`);
      assertOptionalStringArray(entry.allow, `${path}.enemyFloorEligibility.${key}.allow`);
      assertOptionalStringArray(entry.exclude, `${path}.enemyFloorEligibility.${key}.exclude`);
    });
  }
  assertOptionalStringArray(value.bossPool, `${path}.bossPool`);
}

function validateMapRuntime(value: unknown, path: string): void {
  if (value === undefined) return;
  assertPlainObject(value, path);
  assertOptionalNumberRecord(value.floorTypeCaps, `${path}.floorTypeCaps`);
  if (value.openingRouteExpectation !== undefined) {
    assertPlainObject(value.openingRouteExpectation, `${path}.openingRouteExpectation`);
    assertOptionalFiniteNumber(value.openingRouteExpectation.maxSpread, `${path}.openingRouteExpectation.maxSpread`);
    assertOptionalFiniteNumber(value.openingRouteExpectation.traversalDepth, `${path}.openingRouteExpectation.traversalDepth`);
    assertOptionalNumberRecord(value.openingRouteExpectation.weights, `${path}.openingRouteExpectation.weights`);
    assertOptionalNumberRecord(value.openingRouteExpectation.maxBranchesPerFloor, `${path}.openingRouteExpectation.maxBranchesPerFloor`);
  }
  if (value.openingRouteContrast !== undefined) {
    assertPlainObject(value.openingRouteContrast, `${path}.openingRouteContrast`);
    assertOptionalFiniteNumber(value.openingRouteContrast.maxFloor, `${path}.openingRouteContrast.maxFloor`);
    assertOptionalBoolean(value.openingRouteContrast.requireThirdFlavorOnFloor1, `${path}.openingRouteContrast.requireThirdFlavorOnFloor1`);
    assertOptionalStringArray(value.openingRouteContrast.utilityTypes, `${path}.openingRouteContrast.utilityTypes`);
  }
}

export function validateStoryEventDefs(value: unknown, path = 'numericConfig.events.defs'): Record<string, Partial<Pick<StoryEventDef, 'floorMin' | 'floorMax' | 'weight'>>> {
  if (value === undefined) return {};
  assertPlainObject(value, path);
  const allowed = new Set(['floorMin', 'floorMax', 'weight']);
  for (const [eventId, def] of Object.entries(value)) {
    assertPlainObject(def, `${path}.${eventId}`);
    for (const [key, entry] of Object.entries(def)) {
      if (!allowed.has(key)) fail(`${path}.${eventId}.${key}`, 'unsupported story event numeric override field');
      assertFiniteNumber(entry, `${path}.${eventId}.${key}`);
    }
  }
  return value as Record<string, Partial<Pick<StoryEventDef, 'floorMin' | 'floorMax' | 'weight'>>>;
}

export function validateNumericConfig(value: unknown, context = 'numericConfig'): NumericConfig {
  assertPlainObject(value, context);
  assertFiniteNumber(value.version, `${context}.version`);

  if (value.chapters !== undefined) {
    assertPlainObject(value.chapters, `${context}.chapters`);
    validateChapterConfig(value.chapters.chapter2, `${context}.chapters.chapter2`);
    validateChapterConfig(value.chapters.chapter3, `${context}.chapters.chapter3`);
  }

  if (value.map !== undefined) {
    assertPlainObject(value.map, `${context}.map`);
    if (value.map.runtime !== undefined) validateMapRuntime(value.map.runtime, `${context}.map.runtime`);
  }

  assertPlainObject(value.cards, `${context}.cards`);
  validateOptionalPatchTable(value.cards.byId, `${context}.cards.byId`);
  assertPlainObject(value.potions, `${context}.potions`);
  validateOptionalPatchTable(value.potions.byId, `${context}.potions.byId`);
  if (value.potions.runtime !== undefined) validateNumericLeafObject(value.potions.runtime, `${context}.potions.runtime`);
  assertPlainObject(value.relics, `${context}.relics`);
  validateOptionalPatchTable(value.relics.byId, `${context}.relics.byId`);
  assertPlainObject(value.enemies, `${context}.enemies`);
  validateOptionalPatchTable(value.enemies.byId, `${context}.enemies.byId`);
  if (value.enemies.runtime !== undefined) validateNumericLeafObject(value.enemies.runtime, `${context}.enemies.runtime`);

  assertPlainObject(value.events, `${context}.events`);
  if (value.events.runtime !== undefined) validateNumericLeafObject(value.events.runtime, `${context}.events.runtime`);
  validateStoryEventDefs(value.events.defs, `${context}.events.defs`);
  if (value.events.outcomes !== undefined) validateNumericLeafObject(value.events.outcomes, `${context}.events.outcomes`);

  return value as unknown as NumericConfig;
}

export function assertUniqueEntityIds<T extends { id: string }>(kind: string, items: T[]): void {
  const seen = new Set<string>();
  items.forEach((item, index) => {
    assertString(item.id, `${kind}[${index}].id`);
    if (seen.has(item.id)) fail(`${kind}[${index}].id`, `Duplicate ${kind} id detected: ${item.id}`);
    seen.add(item.id);
  });
}

export function createEntityMap<T extends { id: string }>(kind: string, items: T[]): Map<string, T> {
  assertUniqueEntityIds(kind, items);
  return new Map(items.map((item) => [item.id, item]));
}

export function validateCardsData(value: unknown, context = 'cardsData'): CardDef[] {
  assertArray(value, context);
  value.forEach((entry, index) => {
    const path = `${context}[${index}]`;
    assertPlainObject(entry, path);
    assertString(entry.id, `${path}.id`);
    assertString(entry.name, `${path}.name`);
    assertString(entry.rarity, `${path}.rarity`);
    assertFiniteNumber(entry.cost, `${path}.cost`);
    assertString(entry.type, `${path}.type`);
    assertString(entry.targeting, `${path}.targeting`);
    assertStringArray(entry.tags, `${path}.tags`);
    assertString(entry.text, `${path}.text`);
    validateActionSpecArray(entry.actions, `${path}.actions`);
    if (entry.upgrade !== undefined) {
      assertPlainObject(entry.upgrade, `${path}.upgrade`);
      assertOptionalFiniteNumber(entry.upgrade.cost, `${path}.upgrade.cost`);
      if (entry.upgrade.actions !== undefined) validateActionSpecArray(entry.upgrade.actions, `${path}.upgrade.actions`);
    }
  });
  assertUniqueEntityIds('cards', value as CardDef[]);
  return value as CardDef[];
}

export function validateEnemiesData(value: unknown, context = 'enemiesData'): EnemyDef[] {
  assertArray(value, context);
  value.forEach((entry, index) => {
    const path = `${context}[${index}]`;
    assertPlainObject(entry, path);
    assertString(entry.id, `${path}.id`);
    assertString(entry.name, `${path}.name`);
    if (entry.hp_range !== undefined) {
      assertFiniteNumberTuple(entry.hp_range, `${path}.hp_range`);
    } else {
      assertOptionalFiniteNumber(entry.minHp, `${path}.minHp`);
      assertOptionalFiniteNumber(entry.maxHp, `${path}.maxHp`);
    }
    const policy = entry.intent_policy ?? entry.intentPolicy;
    assertArray(policy, `${path}.intent_policy`);
    policy.forEach((intentEntry, intentIndex) => {
      const policyPath = `${path}.intent_policy[${intentIndex}]`;
      assertPlainObject(intentEntry, policyPath);
      assertString(intentEntry.intent, `${policyPath}.intent`);
      assertFiniteNumber(intentEntry.weight, `${policyPath}.weight`);
    });
    assertPlainObject(entry.moves, `${path}.moves`);
    Object.entries(entry.moves).forEach(([moveId, moveActions]) => validateActionSpecArray(moveActions, `${path}.moves.${moveId}`));
    assertStringArray(entry.keywords, `${path}.keywords`);
  });
  assertUniqueEntityIds('enemies', value as EnemyDef[]);
  return value as EnemyDef[];
}

export function validateCharactersData(value: unknown, context = 'charactersData'): CharacterDef[] {
  assertArray(value, context);
  value.forEach((entry, index) => {
    const path = `${context}[${index}]`;
    assertPlainObject(entry, path);
    assertString(entry.id, `${path}.id`);
    assertString(entry.name, `${path}.name`);
    assertString(entry.description, `${path}.description`);
    assertFiniteNumber(entry.maxHp, `${path}.maxHp`);
    assertFiniteNumber(entry.maxEnergy, `${path}.maxEnergy`);
    assertStringArray(entry.startingDeck, `${path}.startingDeck`);
    assertString(entry.portraitPrompt, `${path}.portraitPrompt`);
    assertOptionalStringArray(entry.extendedPool, `${path}.extendedPool`);
    assertOptionalString(entry.specialResource, `${path}.specialResource`);
    assertOptionalString(entry.secondaryResource, `${path}.secondaryResource`);
  });
  assertUniqueEntityIds('characters', value as CharacterDef[]);
  return value as CharacterDef[];
}

export function validatePotionsData(value: unknown, context = 'potionsData'): PotionDef[] {
  assertArray(value, context);
  value.forEach((entry, index) => {
    const path = `${context}[${index}]`;
    assertPlainObject(entry, path);
    assertString(entry.id, `${path}.id`);
    assertString(entry.name, `${path}.name`);
    assertString(entry.description, `${path}.description`);
    assertFiniteNumber(entry.price, `${path}.price`);
    assertOptionalFiniteNumber(entry.toxicity, `${path}.toxicity`);
    assertOptionalStringArray(entry.tags, `${path}.tags`);
    if (entry.effect === undefined) fail(`${path}.effect`, 'expected effect definition');
  });
  assertUniqueEntityIds('potions', value as PotionDef[]);
  return value as PotionDef[];
}

export function validateRelicsData(value: unknown, context = 'relicsData'): RelicDef[] {
  assertArray(value, context);
  value.forEach((entry, index) => {
    const path = `${context}[${index}]`;
    assertPlainObject(entry, path);
    assertString(entry.id, `${path}.id`);
    assertString(entry.name, `${path}.name`);
    assertString(entry.description, `${path}.description`);
    assertOptionalFiniteNumber(entry.price, `${path}.price`);
    assertString(entry.trigger, `${path}.trigger`);
    assertOptionalStringArray(entry.tags, `${path}.tags`);
    if (entry.priority !== undefined) assertFiniteNumber(entry.priority, `${path}.priority`);
    if (entry.effect === undefined && entry.effects === undefined && entry.passiveEffect === undefined) {
      fail(`${path}.effect`, 'expected effect, effects, or passiveEffect definition');
    }
  });
  assertUniqueEntityIds('relics', value as RelicDef[]);
  return value as RelicDef[];
}

export function validateCardModifiersData(value: unknown, context = 'cardEnchantmentsData'): Array<CardEnchantmentDef | CardAfflictionDef> {
  assertArray(value, context);
  value.forEach((entry, index) => {
    const path = `${context}[${index}]`;
    assertPlainObject(entry, path);
    assertString(entry.id, `${path}.id`);
    assertString(entry.name, `${path}.name`);
    assertString(entry.scope, `${path}.scope`);
    if (entry.scope !== 'persistent' && entry.scope !== 'combat') fail(`${path}.scope`, 'expected persistent or combat');
    assertString(entry.description, `${path}.description`);
    validateCardModifierEffect(entry.effect, `${path}.effect`);
    assertOptionalStringArray(entry.applicableTo, `${path}.applicableTo`);
  });
  assertUniqueEntityIds('cardEnchantments', value as Array<CardEnchantmentDef | CardAfflictionDef>);
  return value as Array<CardEnchantmentDef | CardAfflictionDef>;
}

export function validateStoryEventsData(value: unknown, context = 'storyEvents'): StoryEventDef[] {
  assertArray(value, context);
  value.forEach((entry, index) => {
    const path = `${context}[${index}]`;
    assertPlainObject(entry, path);
    assertString(entry.id, `${path}.id`);
    assertString(entry.title, `${path}.title`);
    assertStringArray(entry.loreText, `${path}.loreText`);
    assertOptionalString(entry.imagePath, `${path}.imagePath`);
    assertFiniteNumber(entry.floorMin, `${path}.floorMin`);
    assertFiniteNumber(entry.floorMax, `${path}.floorMax`);
    assertOptionalFiniteNumber(entry.weight, `${path}.weight`);
    assertArray(entry.options, `${path}.options`);
    entry.options.forEach((option, optionIndex) => {
      const optionPath = `${path}.options[${optionIndex}]`;
      assertPlainObject(option, optionPath);
      assertString(option.id, `${optionPath}.id`);
      assertString(option.text, `${optionPath}.text`);
      assertString(option.description, `${optionPath}.description`);
      assertOptionalStringArray(option.gains, `${optionPath}.gains`);
      assertOptionalStringArray(option.costs, `${optionPath}.costs`);
    });
  });
  assertUniqueEntityIds('storyEvents', value as StoryEventDef[]);
  return value as StoryEventDef[];
}
