/**
 * @file numericSystem.ts
 * @description 数值系统数据聚合 - 统一导出所有游戏数值定义和配置
 *
 * 主要职责:
 * - 加载并导出敌人、药水、遗物、卡牌、事件等数据
 * - 提供数值配置和路线系统相关数据的统一访问入口
 */
import rawEnemiesData from '@/content/data/enemies.json';
import rawCharactersData from '@/content/data/characters.json';
import rawPotionsData from '@/content/data/potions.json';
import rawRelicsData from '@/content/data/relics.json';
import rawNumericConfig from '@/content/data/numericConfig.json';
import rawCardEnchantmentsData from '@/content/data/cardEnchantments.json';
import { baseCardsData } from '@/content/narrative/cardsDataEntry';
import {
  createEntityMap,
  validateCardModifiersData,
  validateCardsData,
  validateCharactersData,
  validateEnemiesData,
  validateNumericConfig,
  validatePotionsData,
  validateRelicsData,
  validateStoryEventDefs,
  validateStoryEventsData,
  type NumericConfig,
} from '@/content/narrative/contentSchema';
import { STORY_EVENTS as RAW_STORY_EVENTS } from '@/content/narrative/storyEvents';
import {
  analyzeRouteSignals as analyzeRouteSignalsFromCards,
  getCardRouteAffinity,
  getCardRouteAffinityTags,
  enrichCardRouteSignals,
  getCardRouteSignal,
  getExplicitEventChoiceCommitTags,
  getEventChoiceCommitTags,
  getEventChoiceRouteRole,
  getEventRouteSignal,
  getGenericPowerIdsForCharacter,
  getKnownRouteTagsForCharacter,
  getRelicRouteTags,
  getRouteSupportRelicIds,
  getRouteTaxonomy,
  getRouteTaxonomyForCharacter,
  resolvePreferredRouteTag,
  sortCardsByRouteAffinity,
  sortRelicIdsByRouteAffinity,
} from '@/content/narrative/routeSignals';
import {
  createEmptyRouteState,
  deriveRouteStateFromDeck,
  getPreferredRouteTagFromState,
  recordRouteCommit,
  maybeRecordRouteCommit,
  syncRouteStateFromLegacyState,
} from '@/content/narrative/routeState';
import type { CardDef, CardAfflictionDef, CardEnchantmentDef, CharacterDef, EnemyDef, GameState, PotionDef, RelicDef, StoryEventDef } from '@/core/types';

export type { NumericConfig } from '@/content/narrative/contentSchema';

export interface MapRuntimeConfig {
  floorTypeCaps: Record<'Event' | 'Shop' | 'Rest' | 'Elite', number>;
  openingRouteExpectation: {
    maxSpread: number;
    traversalDepth: number;
    weights: Record<'Combat' | 'Elite' | 'Boss' | 'Event' | 'Shop' | 'Rest', number>;
    maxBranchesPerFloor: Record<'floor_1' | 'floor_2', number>;
  };
  openingRouteContrast: {
    maxFloor: number;
    requireThirdFlavorOnFloor1: boolean;
    utilityTypes: string[];
  };
}

const numericConfig = validateNumericConfig(rawNumericConfig);
type EntityPatch = Record<string, unknown> & { $set?: Record<string, unknown> };
type EntityKind = 'cards' | 'enemies' | 'potions' | 'relics';
type EntityListValidator<T extends { id: string }> = (value: unknown, context?: string) => T[];

const ENTITY_PATCH_KEYS: Record<EntityKind, Set<string>> = {
  cards: new Set([
    'achievementUnlockId',
    'actions',
    'art_prompt',
    'artUrl',
    'background',
    'character',
    'cost',
    'difficultyRequired',
    'earlyGameRole',
    'id',
    'instanceId',
    'isUpgraded',
    'lastWords',
    'loreText',
    'name',
    'rarity',
    'routeSignalStrength',
    'routeTags',
    'sealSlots',
    'tags',
    'targeting',
    'text',
    'type',
    'upgrade',
  ]),
  enemies: new Set([
    'ai_profile',
    'art',
    'art_prompt',
    'can_manipulate_cards',
    'chapterUnlock',
    'damage',
    'description',
    'hp_range',
    'id',
    'intel_level',
    'intentPolicy',
    'intent_policy',
    'isBoss',
    'isElite',
    'keywords',
    'keywords_note',
    'maxHp',
    'minHp',
    'moves',
    'name',
    'tier',
    'type',
    'variant_of',
  ]),
  potions: new Set(['description', 'effect', 'id', 'name', 'price', 'tags', 'toxicity']),
  relics: new Set([
    'background',
    'condition',
    'corrupted',
    'description',
    'effect',
    'effects',
    'flavorText',
    'id',
    'inscription',
    'isStartingRelic',
    'loreText',
    'name',
    'passiveEffect',
    'pool',
    'price',
    'priority',
    'rarity',
    'resonanceGroup',
    'tags',
    'trigger',
  ]),
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function deepClone<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => deepClone(item)) as T;
  }
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = deepClone(v);
    return out as T;
  }
  return value;
}

function parsePath(path: string): Array<string | number> {
  const tokens: Array<string | number> = [];
  const re = /([^[.\]]+)|\[(\d+)\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(path))) {
    if (m[1] !== undefined) tokens.push(m[1]);
    else if (m[2] !== undefined) tokens.push(Number(m[2]));
  }
  return tokens;
}

function isUnsafePatchPathToken(token: string): boolean {
  return token === '__proto__' || token === 'constructor' || token === 'prototype';
}

function isValidPatchPath(path: string, tokens: Array<string | number>): boolean {
  if (!path.trim() || tokens.length === 0) return false;
  return tokens.every((token) =>
    typeof token === 'number'
      ? Number.isSafeInteger(token) && token >= 0
      : token.length > 0 && !isUnsafePatchPathToken(token)
  );
}

function assertKnownEntityPatchKey(kind: EntityKind, itemId: string, key: string): void {
  if (key === '$set') return;
  if (!ENTITY_PATCH_KEYS[kind].has(key)) {
    throw new Error(`[numericSystem] ${kind}.${itemId}: unknown patch field '${key}'`);
  }
}

function assertKnownEntityPatchPath(kind: EntityKind, itemId: string, path: string): void {
  const tokens = parsePath(path);
  if (!isValidPatchPath(path, tokens)) {
    throw new Error(`[numericSystem] ${kind}.${itemId}: invalid patch path '${path}'`);
  }
  const first = tokens[0];
  if (typeof first !== 'string' || !ENTITY_PATCH_KEYS[kind].has(first)) {
    throw new Error(`[numericSystem] ${kind}.${itemId}: unknown patch path '${path}'`);
  }
}

function validateEntityPatch(kind: EntityKind, itemId: string, patch: Record<string, unknown>): void {
  const setPatch = patch.$set;
  for (const key of Object.keys(patch)) {
    assertKnownEntityPatchKey(kind, itemId, key);
  }
  if (setPatch !== undefined) {
    if (!isPlainObject(setPatch)) {
      throw new Error(`[numericSystem] ${kind}.${itemId}: $set patch must be an object`);
    }
    for (const path of Object.keys(setPatch)) {
      assertKnownEntityPatchPath(kind, itemId, path);
    }
  }
}

function setByPathMutable(target: unknown, path: string, value: unknown): void {
  const tokens = parsePath(path);
  if (!isPlainObject(target) && !Array.isArray(target)) return;
  if (!isValidPatchPath(path, tokens)) {
    console.warn(`[numericSystem] Ignoring invalid numeric patch path: ${path}`);
    return;
  }
  let cursor: Record<string, unknown> | unknown[] = target as Record<string, unknown> | unknown[];
  for (let i = 0; i < tokens.length - 1; i += 1) {
    const key = tokens[i];
    const nextKey = tokens[i + 1];
    const current = cursor[key as keyof typeof cursor];
    if (current == null || (typeof current !== 'object' && !Array.isArray(current))) {
      (cursor as Record<string, unknown>)[String(key)] = typeof nextKey === 'number' ? [] : {};
    }
    const next = cursor[key as keyof typeof cursor];
    if (!isPlainObject(next) && !Array.isArray(next)) return;
    cursor = next as Record<string, unknown> | unknown[];
  }
  (cursor as Record<string, unknown>)[String(tokens[tokens.length - 1])] = value;
}

function applyPathOverrides<T>(target: T, pathOverrides?: Record<string, unknown>): T {
  if (!isPlainObject(pathOverrides)) return target;
  for (const [path, value] of Object.entries(pathOverrides)) {
    setByPathMutable(target as any, path, deepClone(value));
  }
  return target;
}

export const __numericSystemTesting = {
  applyPathOverrides,
  applyEntityOverrides,
  applyStoryEventOverrides,
  createEntityMap,
  isValidPatchPath,
  parsePath,
  validateCardsData,
  validateCardModifiersData,
  validateCharactersData,
  validateEnemiesData,
  validateNumericConfig,
  validatePotionsData,
  validateRelicsData,
  validateStoryEventDefs,
};

function deepMergePatch<T>(base: T, patch: unknown): T {
  if (patch === undefined) return base;
  if (Array.isArray(patch)) return deepClone(patch) as T;
  if (!isPlainObject(base) || !isPlainObject(patch)) return patch as T;

  const result: Record<string, unknown> = { ...(base as any) };
  for (const [key, patchValue] of Object.entries(patch)) {
    const current = result[key];
    if (Array.isArray(patchValue)) {
      result[key] = deepClone(patchValue);
      continue;
    }
    if (isPlainObject(current) && isPlainObject(patchValue)) {
      result[key] = deepMergePatch(current, patchValue);
      continue;
    }
    result[key] = patchValue as unknown;
  }
  return result as T;
}

function applyEntityOverrides<T extends { id: string }>(
  source: T[],
  byId: Record<string, Record<string, unknown>> | undefined,
  kind: EntityKind,
  validateEntities: EntityListValidator<T>
): T[] {
  const patches = byId || {};
  return source.map((item) => {
    const base = deepClone(item);
    const rawPatch = patches[item.id] as EntityPatch | undefined;
    if (!rawPatch || !isPlainObject(rawPatch)) return base;
    const patchObj = rawPatch as Record<string, unknown>;
    validateEntityPatch(kind, item.id, patchObj);
    const { $set, ...mergePatch } = patchObj;
    const merged = deepMergePatch(base, mergePatch);
    const patched = applyPathOverrides(merged, isPlainObject($set) ? ($set as Record<string, unknown>) : undefined);
    return validateEntities([patched], `${kind}.${item.id}`)[0];
  });
}

function applyStoryEventOverrides(
  source: StoryEventDef[],
  defs: Record<string, unknown> | undefined = numericConfig.events?.defs
): StoryEventDef[] {
  const validatedDefs = validateStoryEventDefs(defs);
  return source.map((event) => {
    const patch = validatedDefs[event.id];
    if (!patch) return deepClone(event);
    return validateStoryEventsData(
      [deepMergePatch(deepClone(event), patch)],
      `storyEvents.${event.id}`
    )[0];
  });
}

export const cardsData: CardDef[] = enrichCardRouteSignals(applyEntityOverrides(baseCardsData, numericConfig.cards?.byId, 'cards', validateCardsData));
export const charactersData: CharacterDef[] = validateCharactersData(rawCharactersData, 'characters.json');
export const enemiesData: EnemyDef[] = applyEntityOverrides(validateEnemiesData(rawEnemiesData, 'enemies.json'), numericConfig.enemies?.byId, 'enemies', validateEnemiesData);
export const potionsData: PotionDef[] = applyEntityOverrides(validatePotionsData(rawPotionsData, 'potions.json'), numericConfig.potions?.byId, 'potions', validatePotionsData);
export const relicsData: RelicDef[] = applyEntityOverrides(validateRelicsData(rawRelicsData, 'relics.json'), numericConfig.relics?.byId, 'relics', validateRelicsData);
export const STORY_EVENTS: StoryEventDef[] = applyStoryEventOverrides(validateStoryEventsData(RAW_STORY_EVENTS, 'storyEvents.ts'));
export const cardEnchantmentsData: Array<CardEnchantmentDef | CardAfflictionDef> = validateCardModifiersData(deepClone(rawCardEnchantmentsData), 'cardEnchantments.json');

const cardMap = createEntityMap('cards', cardsData);
const enemyMap = createEntityMap('enemies', enemiesData);
const potionMap = createEntityMap('potions', potionsData);
const relicMap = createEntityMap('relics', relicsData);
const storyEventMap = createEntityMap('storyEvents', STORY_EVENTS);
const cardEnchantmentMap = createEntityMap('cardEnchantments', cardEnchantmentsData);

export type ShopOfferKind = 'card' | 'relic' | 'potion';

export const SHOP_OFFER_PRICE_FALLBACKS: Record<ShopOfferKind, number> = {
  card: 50,
  relic: 150,
  potion: 65,
};

export function resolveShopOfferPrice(kind: ShopOfferKind, rawPrice: unknown): number {
  const fallback = SHOP_OFFER_PRICE_FALLBACKS[kind];
  const numeric = typeof rawPrice === 'number' && Number.isFinite(rawPrice)
    ? rawPrice
    : fallback;
  return Math.max(1, Math.round(numeric));
}

export function getNumericConfig(): NumericConfig {
  return numericConfig;
}

export function getCardDefById(id: string): CardDef | undefined {
  return cardMap.get(id);
}

export {
  analyzeRouteSignalsFromCards as analyzeRouteSignals,
  getCardRouteAffinity,
  getCardRouteAffinityTags,
  getCardRouteSignal,
  getEventChoiceCommitTags,
  getEventChoiceRouteRole,
  getEventRouteSignal,
  getGenericPowerIdsForCharacter,
  getKnownRouteTagsForCharacter,
  getRelicRouteTags,
  getRouteSupportRelicIds,
  getRouteTaxonomy,
  getRouteTaxonomyForCharacter,
  createEmptyRouteState,
  deriveRouteStateFromDeck,
  getPreferredRouteTagFromState,
  recordRouteCommit,
  maybeRecordRouteCommit,
  syncRouteStateFromLegacyState,
  resolvePreferredRouteTag,
  sortCardsByRouteAffinity,
  sortRelicIdsByRouteAffinity,
};

export function getEnemyDefById(id: string): EnemyDef | undefined {
  return enemyMap.get(id);
}

export function getPotionDefById(id: string): PotionDef | undefined {
  return potionMap.get(id);
}

export function getRelicDefById(id: string): RelicDef | undefined {
  return relicMap.get(id);
}

export function getStoryEventDef(id: string): StoryEventDef | undefined {
  return storyEventMap.get(id);
}

export function getStoryEventSelectionWeight(eventId: string): number {
  const minWeight = Math.max(0, Number(numericConfig.events?.runtime?.minSelectableWeight ?? 0.01));
  const eventDef = storyEventMap.get(eventId);
  return Math.max(minWeight, Number(eventDef?.weight ?? 1));
}

export function getStoryEventOutcomeConfig<T = any>(eventId: string): T | undefined {
  return numericConfig.events?.outcomes?.[eventId] as T | undefined;
}

export function getPotionRuntimeConfig(): Required<NonNullable<NumericConfig['potions']['runtime']>> {
  return {
    slotLimit: Math.max(1, Math.floor(Number(numericConfig.potions?.runtime?.slotLimit ?? 3))),
    toxicityOverloadThreshold: Math.max(0, Math.floor(Number(numericConfig.potions?.runtime?.toxicityOverloadThreshold ?? 3)))
  };
}

let cachedMapRuntimeConfig: MapRuntimeConfig | null = null;

export function getMapRuntimeConfig(): MapRuntimeConfig {
  if (cachedMapRuntimeConfig) return cachedMapRuntimeConfig;

  const runtime = numericConfig.map?.runtime;
  const floorTypeCaps = runtime?.floorTypeCaps || {};
  const openingRouteExpectation = runtime?.openingRouteExpectation;
  const openingRouteContrast = runtime?.openingRouteContrast;

  cachedMapRuntimeConfig = {
    floorTypeCaps: {
      Event: Math.max(0, Math.min(4, Math.floor(Number(floorTypeCaps.Event ?? 1)))),
      Shop: Math.max(0, Math.min(4, Math.floor(Number(floorTypeCaps.Shop ?? 1)))),
      Rest: Math.max(0, Math.min(4, Math.floor(Number(floorTypeCaps.Rest ?? 1)))),
      Elite: Math.max(0, Math.min(4, Math.floor(Number(floorTypeCaps.Elite ?? 1)))),
    },
    openingRouteExpectation: {
      maxSpread: Math.max(0, Math.min(50, Math.floor(Number(openingRouteExpectation?.maxSpread ?? 15)))),
      traversalDepth: Math.max(1, Math.min(6, Math.floor(Number(openingRouteExpectation?.traversalDepth ?? 3)))),
      weights: {
        Combat: Number(openingRouteExpectation?.weights?.Combat ?? 2),
        Elite: Number(openingRouteExpectation?.weights?.Elite ?? 5),
        Boss: Number(openingRouteExpectation?.weights?.Boss ?? 0),
        Event: Number(openingRouteExpectation?.weights?.Event ?? 2),
        Shop: Number(openingRouteExpectation?.weights?.Shop ?? 1),
        Rest: Number(openingRouteExpectation?.weights?.Rest ?? 1),
      },
      maxBranchesPerFloor: {
        floor_1: Math.max(1, Math.min(4, Math.floor(Number(openingRouteExpectation?.maxBranchesPerFloor?.floor_1 ?? 2)))),
        floor_2: Math.max(1, Math.min(4, Math.floor(Number(openingRouteExpectation?.maxBranchesPerFloor?.floor_2 ?? 2)))),
      },
    },
    openingRouteContrast: {
      maxFloor: Math.max(1, Math.min(6, Math.floor(Number(openingRouteContrast?.maxFloor ?? 3)))),
      requireThirdFlavorOnFloor1: openingRouteContrast?.requireThirdFlavorOnFloor1 !== false,
      utilityTypes: Array.isArray(openingRouteContrast?.utilityTypes) && openingRouteContrast.utilityTypes.length > 0
        ? openingRouteContrast.utilityTypes.map((entry) => String(entry))
        : ['Event', 'Shop', 'Rest'],
    },
  };
  return cachedMapRuntimeConfig;
}

function clampInt(value: number, min = 0, max = Number.POSITIVE_INFINITY): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function clampRatio(value: number, fallback: number): number {
  const v = Number(value);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(0, Math.min(1, v));
}

export function calculateStoryEventNumbers(eventId: string, state: GameState) {
  const cfg = getStoryEventOutcomeConfig<any>(eventId) || {};
  const hp = Math.max(0, state.player.hp || 0);
  const maxHp = Math.max(1, state.player.maxHp || 1);

  if (eventId === 'rusting_medicae') {
    return {
      salvageFleeTrueDamage: clampInt(Number(cfg.salvageFleeTrueDamage ?? 15), 0),
      implantCurrentHpLoss: Math.max(1, Math.floor(hp * clampRatio(Number(cfg.implant?.currentHpLossRatio ?? 0.25), 0.25))),
      implantMaxHpGain: clampInt(Number(cfg.implant?.maxHpGain ?? 10), 0),
      extractMaxHpLoss: clampInt(Number(cfg.extract?.maxHpLoss ?? 5), 0),
      extractHealMaxHpRatio: clampRatio(Number(cfg.extract?.healMaxHpRatio ?? 0.3), 0.3),
      extractCorruptionGain: clampInt(Number(cfg.extract?.corruptionGain ?? 20), 0, 100),
      extractPotionCount: clampInt(Number(cfg.extract?.potionCount ?? 2), 0),
      extractStrongPotionsOnly: !!cfg.extract?.strongPotionsOnly,
      salvageGoldGain: clampInt(Number(cfg.salvage?.goldGain ?? 100), 0),
      salvageNormalRelicOnly: cfg.salvage?.normalRelicOnly !== false
    };
  }

  if (eventId === 'nameless_martyr_shrine') {
    return {
      offerBloodMaxHpLoss: Math.max(1, Math.floor(maxHp * clampRatio(Number(cfg.offerBlood?.maxHpLossRatio ?? 0.33), 0.33))),
      offerWealthCurseGoldThreshold: clampInt(Number(cfg.offerWealth?.curseGoldThreshold ?? 50), 0),
      offerWealthFreeRemovals: Math.max(1, clampInt(Number(cfg.offerWealth?.freeRemovals ?? 2), 1)),
      desecrateWarpTideBonus: clampInt(Number(cfg.desecrate?.warpTideBonus ?? 30), 0),
      desecrateDevotionSetTo: clampInt(Number(cfg.desecrate?.devotionSetTo ?? 0), 0, 100)
    };
  }

  if (eventId === 'warp_tear_whispers') {
    return {
      embraceCorruptionSetTo: clampInt(Number(cfg.embrace?.corruptionSetTo ?? 100), 0, 100),
      embraceWarpDebuffCombats: clampInt(Number(cfg.embrace?.warpDebuffCombats ?? 3), 0),
      sealDevotionGain: clampInt(Number(cfg.seal?.devotionGain ?? 50), 0),
      sealClearPendingWarpTideBonus: cfg.seal?.clearPendingWarpTideBonus !== false
    };
  }

  if (eventId === 'inquisitor_legacy') {
    return {
      openCasketCurrentHpLoss: Math.max(1, Math.floor(hp * clampRatio(Number(cfg.openCasket?.currentHpLossRatio ?? 0.5), 0.5))),
      openCasketEnemyHuntBonusPct: Math.max(0, Number(cfg.openCasket?.enemyHuntBonusPct ?? 0.1)),
      readCodexIntelGain: clampInt(Number(cfg.readCodex?.intelGain ?? 30), 0),
      readCodexMaxHpLoss: clampInt(Number(cfg.readCodex?.maxHpLoss ?? 10), 0),
      readCodexRevealAllMapNodes: cfg.readCodex?.revealAllMapNodes !== false,
      takeRosarySelfDamage: clampInt(Number(cfg.takeRosary?.selfDamage ?? 10), 0)
    };
  }

  return {};
}

function formatPct(ratio: number): string {
  const pct = Math.round(Math.max(0, ratio) * 100);
  return `${pct}%`;
}

export type EventPresentationTagTone = 'commit' | 'pivot' | 'payoff' | 'burden' | 'debt' | 'recovery';

export interface EventPresentationTag {
  id: string;
  label: string;
  tone: EventPresentationTagTone;
}

export interface StoryEventOptionPresentation {
  gains?: string[];
  costs?: string[];
  tags?: EventPresentationTag[];
}

function pushUniquePresentationTag(tags: EventPresentationTag[], tag: EventPresentationTag): void {
  if (!tags.some((entry) => entry.id === tag.id)) {
    tags.push(tag);
  }
}

function buildStoryEventOptionTags(
  eventId: string,
  optionId: string,
  presentation: Pick<StoryEventOptionPresentation, 'gains' | 'costs'>,
): EventPresentationTag[] {
  const tags: EventPresentationTag[] = [];
  const role = getEventChoiceRouteRole(eventId, optionId);
  const explicitCommitTags = getExplicitEventChoiceCommitTags(eventId, optionId);

  if (role === 'payoff') {
    pushUniquePresentationTag(tags, { id: 'payoff', label: '高回报', tone: 'payoff' });
  } else if (role === 'pivot') {
    pushUniquePresentationTag(tags, { id: 'pivot', label: '路线转向', tone: 'pivot' });
  } else if (role || explicitCommitTags.length > 0) {
    pushUniquePresentationTag(tags, { id: 'commit', label: role === 'support' ? '路线支撑' : '路线提交', tone: 'commit' });
  }

  const gainText = (presentation.gains ?? []).join(' ');
  const costText = (presentation.costs ?? []).join(' ');
  if (/恢复|清除|移除|净化|治疗|保留/.test(gainText)) {
    pushUniquePresentationTag(tags, { id: 'recovery', label: '恢复窗口', tone: 'recovery' });
  }
  if (/随后|后续|接下来|下场|追杀|债|必须选择/.test(costText)) {
    pushUniquePresentationTag(tags, { id: 'debt', label: '延后代价', tone: 'debt' });
  }
  if (/最大生命值|失去|受到|腐化|诅咒|摧毁|不可减免|放弃/.test(costText)) {
    pushUniquePresentationTag(tags, { id: 'burden', label: '沉重代价', tone: 'burden' });
  }

  return tags;
}

function decorateStoryEventOptionPresentation(
  eventId: string,
  optionId: string,
  presentation: Pick<StoryEventOptionPresentation, 'gains' | 'costs'>,
): StoryEventOptionPresentation {
  const tags = buildStoryEventOptionTags(eventId, optionId, presentation);
  return tags.length > 0 ? { ...presentation, tags } : presentation;
}

export function getStoryEventOptionPresentation(
  eventId: string,
  optionId: string,
  state: GameState,
  runtime?: { freeRemovalsRemaining?: number }
): StoryEventOptionPresentation | undefined {
  const n = calculateStoryEventNumbers(eventId, state) as any;
  const outcomesCfg = getStoryEventOutcomeConfig<any>(eventId) || {};

  if (eventId === 'rusting_medicae') {
    const implantRatio = Number(outcomesCfg.implant?.currentHpLossRatio ?? 0.25);
    const extractHealRatio = Number(outcomesCfg.extract?.healMaxHpRatio ?? 0.3);
    switch (optionId) {
      case 'medicae_implant':
        return decorateStoryEventOptionPresentation(eventId, optionId, {
          gains: [
            `最大生命值 +${n.implantMaxHpGain ?? 10}`,
            '获得奇物《锈蚀植入体》（每场战斗开始时 +1 力量）'
          ],
          costs: [
            `失去 ${formatPct(implantRatio)} 当前生命值（当前约 ${n.implantCurrentHpLoss ?? 0}）`,
            '牌库加入诅咒《排异反应》'
          ]
        });
      case 'medicae_extract':
        return decorateStoryEventOptionPresentation(eventId, optionId, {
          gains: [
            `获得 ${n.extractPotionCount ?? 2} 瓶随机${n.extractStrongPotionsOnly ? '强力' : ''}药水`,
            `恢复 ${formatPct(extractHealRatio)} 最大生命值`
          ],
          costs: [
            `最大生命值 -${n.extractMaxHpLoss ?? 5}`,
            `腐化值 +${n.extractCorruptionGain ?? 20}`
          ]
        });
      case 'medicae_salvage':
        return decorateStoryEventOptionPresentation(eventId, optionId, {
          gains: [
            `获得 ${n.salvageGoldGain ?? 100} 信用筹码`,
            `获得 1 件随机${n.salvageNormalRelicOnly === false ? '' : '普通'}奇物`
          ],
          costs: [`随后必须选择：迎战精英 或 承受 ${n.salvageFleeTrueDamage ?? 15} 点不可减免伤害撤离`]
        });
      case 'medicae_salvage_flee':
        return decorateStoryEventOptionPresentation(eventId, optionId, {
          gains: [`保留 ${n.salvageGoldGain ?? 100} 信用筹码与奇物`],
          costs: [`受到 ${n.salvageFleeTrueDamage ?? 15} 点不可减免伤害`]
        });
      case 'medicae_salvage_fight':
        return decorateStoryEventOptionPresentation(eventId, optionId, {
          gains: ['若战胜：保留刚刚搜刮的战利品，并获得精英战战利品'],
          costs: ['高风险精英战斗']
        });
    }
  }

  if (eventId === 'nameless_martyr_shrine') {
    const bloodRatio = Number(outcomesCfg.offerBlood?.maxHpLossRatio ?? 0.33);
    switch (optionId) {
      case 'martyr_offer_blood':
        return decorateStoryEventOptionPresentation(eventId, optionId, {
          gains: ['获得稀有奇物《殉道者之印》（生命越低伤害越高）'],
          costs: [`永久失去 ${formatPct(bloodRatio)} 最大生命值（当前约 ${n.offerBloodMaxHpLoss ?? 0}）`]
        });
      case 'martyr_offer_wealth':
        return decorateStoryEventOptionPresentation(eventId, optionId, {
          gains: [`移除 ${n.offerWealthFreeRemovals ?? 2} 张牌（事件免费移除）`],
          costs: [`失去所有信用筹码；若少于 ${n.offerWealthCurseGoldThreshold ?? 50}，额外加入诅咒《贪婪之罪》`]
        });
      case 'martyr_desecrate':
        return decorateStoryEventOptionPresentation(eventId, optionId, {
          gains: ['获得升级攻击牌《处决斩击》'],
          costs: [`虔诚值设为 ${n.desecrateDevotionSetTo ?? 0}`, `下场战斗亚空间潮汐 +${n.desecrateWarpTideBonus ?? 30}`]
        });
      case 'martyr_inscribe_oath':
        return decorateStoryEventOptionPresentation(eventId, optionId, {
          gains: ['选择 1 张攻击或技能牌，获得附魔《血色铭文》'],
          costs: [`失去 ${Math.max(1, Number((runtime as any)?.inscribeHpLoss ?? 6))} 点生命值`]
        });
      case 'martyr_continue_remove':
        return decorateStoryEventOptionPresentation(eventId, optionId, {
          gains: [`还能移除 ${Math.max(0, Number(runtime?.freeRemovalsRemaining ?? 0))} 张牌`],
          costs: ['无法改选其他供奉方式']
        });
    }
  }

  if (eventId === 'warp_tear_whispers') {
    switch (optionId) {
      case 'tear_embrace':
        return decorateStoryEventOptionPresentation(eventId, optionId, {
          gains: ['牌库中所有基础牌（打击/防御）转化为随机非基础牌（非普通）'],
          costs: [`腐化值立刻达到 ${n.embraceCorruptionSetTo ?? 100}`, `接下来 ${n.embraceWarpDebuffCombats ?? 3} 场战斗开局获得恐惧与脆弱`]
        });
      case 'tear_bargain':
        return decorateStoryEventOptionPresentation(eventId, optionId, {
          gains: ['获得 1 件强大的亚空间/熵变奇物'],
          costs: ['随机永久摧毁 1 张非基础牌']
        });
      case 'tear_seal':
        return decorateStoryEventOptionPresentation(eventId, optionId, {
          gains: [`虔诚值 +${n.sealDevotionGain ?? 50}`, '清除待结算的亚空间潮汐增幅'],
          costs: ['牌库加入诅咒《灵能反噬》']
        });
    }
  }

  if (eventId === 'inquisitor_legacy') {
    const hpLossRatio = Number(outcomesCfg.openCasket?.currentHpLossRatio ?? 0.5);
    switch (optionId) {
      case 'legacy_open_casket':
        return decorateStoryEventOptionPresentation(eventId, optionId, {
          gains: ['获得奇物《熵变圣物》（每打出一张牌随机伤害敌人）'],
          costs: [`立刻失去 ${formatPct(hpLossRatio)} 当前生命值（当前约 ${n.openCasketCurrentHpLoss ?? 0}）`, `后续遭遇敌人获得追杀增幅（生命/伤害 +${Math.round((n.openCasketEnemyHuntBonusPct ?? 0.1) * 100)}%）`]
        });
      case 'legacy_read_codex':
        return decorateStoryEventOptionPresentation(eventId, optionId, {
          gains: [`Intel +${n.readCodexIntelGain ?? 30}`, '揭示地图全部未知节点'],
          costs: [`最大生命值 -${n.readCodexMaxHpLoss ?? 10}`, '牌库加入诅咒《妄想狂》（移除费用翻倍）']
        });
      case 'legacy_take_rosary':
        return decorateStoryEventOptionPresentation(eventId, optionId, {
          gains: ['获得奇物《审判官玫瑰》（战斗开始获得护盾）'],
          costs: [`受到 ${n.takeRosarySelfDamage ?? 10} 点伤害`]
        });
      case 'legacy_inscribe_sigil':
        return decorateStoryEventOptionPresentation(eventId, optionId, {
          gains: ['选择 1 张攻击或技能牌，获得附魔《迅捷刻印》'],
          costs: ['放弃其他遗物分支']
        });
    }
  }

  return undefined;
}

export function rollEnemyBaseHp(enemyDef: { hp_range?: [number, number]; minHp?: number; maxHp?: number }, rng: () => number): number {
  let min: number, max: number;
  if (Array.isArray(enemyDef.hp_range)) {
    min = Math.max(1, Math.floor(Number(enemyDef.hp_range[0] ?? 1)));
    max = Math.max(min, Math.floor(Number(enemyDef.hp_range[1] ?? min)));
  } else {
    min = Math.max(1, Math.floor(Number(enemyDef.minHp ?? 1)));
    max = Math.max(min, Math.floor(Number(enemyDef.maxHp ?? min)));
  }
  return min + Math.floor(rng() * (max - min + 1));
}

export function isEnemyEligibleForFloorByNumericRules(
  enemyDef: { id: string; hp_range?: [number, number]; minHp?: number; maxHp?: number; keywords?: string[]; chapterUnlock?: number },
  floor: number,
  nodeType: 'Combat' | 'Elite' | 'Boss'
): boolean {
  const rules = numericConfig.enemies?.runtime?.floorEligibility || {};
  const eliteRules = rules.elite || {};
  const combatRules = rules.combat || {};
  const maxHp = enemyDef.hp_range?.[1] ?? enemyDef.maxHp ?? 0;
  const keywords = enemyDef.keywords || [];

  if (nodeType === 'Boss') {
    if (floor <= 10) return ['slime_boss', 'hexaghost'].includes(enemyDef.id);
    if (floor <= 18) return Number(enemyDef.chapterUnlock ?? 1) <= 2 && !keywords.includes('phase_boss');
    return true;
  }

  if (nodeType === 'Elite') {
    const floor3Max = Number(eliteRules.floor_3_maxHp ?? 95);
    const floor6Max = Number(eliteRules.floor_6_maxHp ?? 115);
    if (floor <= 3) return maxHp <= floor3Max;
    if (floor <= 6) return maxHp <= floor6Max;
    return true;
  }

  const excludeFissionSmallBeforeFloor = Number(combatRules.excludeFissionSmallBeforeFloor ?? 5);
  const excludeSymbioteBeforeFloor = Number(combatRules.excludeSymbioteBeforeFloor ?? 7);
  const excludeSplitBeforeFloor = Number(combatRules.excludeSplitBeforeFloor ?? 3);

  if (enemyDef.id === 'fission_small' && floor < excludeFissionSmallBeforeFloor) return false;
  if (keywords.includes('symbiote') && floor < excludeSymbioteBeforeFloor) return false;

  const floor2Max = Number(combatRules.floor_2_maxHp ?? 32);
  const floor4Max = Number(combatRules.floor_4_maxHp ?? 42);
  const floor6Max = Number(combatRules.floor_6_maxHp ?? 50);

  if (floor <= 2) return maxHp <= floor2Max && !(keywords.includes('splits') && floor < excludeSplitBeforeFloor);
  if (floor <= 4) return maxHp <= floor4Max;
  if (floor <= 6) return maxHp <= floor6Max;
  return true;
}

export function applyEnemyHpTuningByNumericRules(
  baseHp: number,
  floor: number,
  nodeType: 'Combat' | 'Elite' | 'Boss',
  hpMultiplier: number
): number {
  const raw = Math.max(1, Math.floor(baseHp * hpMultiplier));
  if (nodeType === 'Boss') {
    const bossCaps = numericConfig.enemies?.runtime?.bossHpSoftCaps || {};
    const bossFloor10 = Number(bossCaps.floor_10 ?? 175);
    const bossFloor16 = Number(bossCaps.floor_16 ?? 300);
    const softCap = floor <= 10 ? bossFloor10 : floor <= 16 ? bossFloor16 : Infinity;
    return Math.max(1, Math.min(raw, softCap));
  }

  const combatCaps = numericConfig.enemies?.runtime?.earlyCombatHpSoftCaps || {};
  const eliteCaps = numericConfig.enemies?.runtime?.earlyEliteHpSoftCaps || {};

  const combatFloor2 = Number(combatCaps.floor_2 ?? 30);
  const combatFloor4 = Number(combatCaps.floor_4 ?? 40);
  const combatFloor6 = Number(combatCaps.floor_6 ?? 52);
  const eliteFloor3 = Number(eliteCaps.floor_3 ?? 88);
  const eliteFloor6 = Number(eliteCaps.floor_6 ?? 112);

  const softCap = nodeType === 'Elite'
    ? (floor <= 3 ? eliteFloor3 : floor <= 6 ? eliteFloor6 : Infinity)
    : (floor <= 2 ? combatFloor2 : floor <= 4 ? combatFloor4 : floor <= 6 ? combatFloor6 : Infinity);
  return Math.max(1, Math.min(raw, softCap));
}

export function getSingleSlimeRoomBoostConfig() {
  const cfg = numericConfig.enemies?.runtime?.singleSlimeRoomBoost || {};
  const innateStatus = isPlainObject(cfg.innateStatus)
    ? Object.fromEntries(
        Object.entries(cfg.innateStatus).map(([k, v]) => [k, clampInt(Number(v), 0)])
      )
    : {};
  return {
    enabled: cfg.enabled !== false,
    maxFloor: clampInt(Number(cfg.maxFloor ?? 4), 0),
    hpBonusRatio: Math.max(0, Number(cfg.hpBonusRatio ?? 0.60)),
    minHpBonus: clampInt(Number(cfg.minHpBonus ?? 3), 0),
    strengthBonus: clampInt(Number(cfg.strengthBonus ?? 1), 0),
    innateStatus
  };
}

export { numericConfig };

export function getCardEnchantmentDefById(id: string): CardEnchantmentDef | CardAfflictionDef | undefined {
  return cardEnchantmentMap.get(id);
}
