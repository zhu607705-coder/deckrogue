import { baseCardMap } from '@/content/narrative/cardsDataEntry';
import type { CardDef, EarlyGameRole, RunCardInstance } from '@/core/types';

export interface CardRouteSignalDef {
  routeTags: string[];
  routeSignalStrength: number;
  earlyGameRole: EarlyGameRole;
}

export interface EventRouteSignalDef {
  routeTags: string[];
  reinforcement: 'confirm' | 'payoff' | 'support';
  preferredChoiceIds?: string[];
  preferredChoiceRoles?: Partial<Record<string, EventChoiceRouteRole>>;
  preferredChoiceCommitTags?: Partial<Record<string, string[]>>;
}

export interface RouteTaxonomyEntry {
  routeTag: string;
  characterId: string;
  label: string;
  supportRelicIds: string[];
}

export interface CardRouteAffinityDef {
  routeTags: string[];
  affinityStrength: number;
  source: 'signal' | 'override' | 'tag-rule';
}

export type EventChoiceRouteRole = 'confirm' | 'payoff' | 'pivot' | 'support';

const CARD_ROUTE_SIGNALS_BY_ID: Record<string, CardRouteSignalDef> = {
  // Informant
  gather_intel: { routeTags: ['informant:intel'], routeSignalStrength: 3, earlyGameRole: 'route_confirm' },
  intel_network: { routeTags: ['informant:intel'], routeSignalStrength: 3, earlyGameRole: 'route_confirm' },
  surveillance: { routeTags: ['informant:intel'], routeSignalStrength: 2, earlyGameRole: 'generic_power' },
  precision_strike: { routeTags: ['informant:intel'], routeSignalStrength: 4, earlyGameRole: 'route_payoff' },
  calculated_strike: { routeTags: ['informant:intel'], routeSignalStrength: 3, earlyGameRole: 'route_payoff' },
  shadow_step: { routeTags: ['informant:stealth'], routeSignalStrength: 3, earlyGameRole: 'route_confirm' },
  vanishing_strike: { routeTags: ['informant:stealth'], routeSignalStrength: 4, earlyGameRole: 'route_payoff' },
  planted_witness: { routeTags: ['informant:evidence'], routeSignalStrength: 3, earlyGameRole: 'route_confirm' },
  false_identity: { routeTags: ['informant:evidence'], routeSignalStrength: 2, earlyGameRole: 'generic_power' },
  cross_examiner: { routeTags: ['informant:evidence'], routeSignalStrength: 4, earlyGameRole: 'route_payoff' },

  // Brute
  flex: { routeTags: ['brute:strength'], routeSignalStrength: 3, earlyGameRole: 'route_confirm' },
  blood_fury: { routeTags: ['brute:strength'], routeSignalStrength: 4, earlyGameRole: 'route_payoff' },
  limit_break: { routeTags: ['brute:strength'], routeSignalStrength: 4, earlyGameRole: 'route_payoff' },
  shrug_it_off: { routeTags: ['brute:block'], routeSignalStrength: 3, earlyGameRole: 'route_confirm' },
  iron_wall: { routeTags: ['brute:block'], routeSignalStrength: 4, earlyGameRole: 'route_payoff' },
  body_slam: { routeTags: ['brute:block'], routeSignalStrength: 3, earlyGameRole: 'route_payoff' },
  bloody_grin: { routeTags: ['brute:rage'], routeSignalStrength: 3, earlyGameRole: 'route_confirm' },
  rage_slam: { routeTags: ['brute:rage'], routeSignalStrength: 3, earlyGameRole: 'route_payoff' },
  skull_crack: { routeTags: ['brute:rage'], routeSignalStrength: 4, earlyGameRole: 'route_payoff' },

  // Tactician
  deadly_poison: { routeTags: ['tactician:poison'], routeSignalStrength: 3, earlyGameRole: 'route_confirm' },
  poison_dart: { routeTags: ['tactician:poison'], routeSignalStrength: 3, earlyGameRole: 'route_confirm' },
  catalyst: { routeTags: ['tactician:poison'], routeSignalStrength: 4, earlyGameRole: 'route_payoff' },
  briefing_order: { routeTags: ['tactician:command'], routeSignalStrength: 3, earlyGameRole: 'route_confirm' },
  precise_rotation: { routeTags: ['tactician:command'], routeSignalStrength: 2, earlyGameRole: 'generic_power' },
  formation_break: { routeTags: ['tactician:command'], routeSignalStrength: 4, earlyGameRole: 'route_payoff' },
  shield_signal: { routeTags: ['tactician:formation'], routeSignalStrength: 3, earlyGameRole: 'route_confirm' },
  reserve_line: { routeTags: ['tactician:formation'], routeSignalStrength: 3, earlyGameRole: 'route_confirm' },
  grand_doctrine: { routeTags: ['tactician:formation'], routeSignalStrength: 4, earlyGameRole: 'route_payoff' },

  // Puppeteer
  thread_weave: { routeTags: ['puppeteer:threads'], routeSignalStrength: 3, earlyGameRole: 'route_confirm' },
  thread_mastery: { routeTags: ['puppeteer:threads'], routeSignalStrength: 4, earlyGameRole: 'route_payoff' },
  reinforced_golem: { routeTags: ['puppeteer:summon'], routeSignalStrength: 3, earlyGameRole: 'route_confirm' },
  construct_army: { routeTags: ['puppeteer:summon'], routeSignalStrength: 4, earlyGameRole: 'route_payoff' },
  sacrifice_construct: { routeTags: ['puppeteer:sacrifice'], routeSignalStrength: 3, earlyGameRole: 'route_confirm' },
  detonate_construct: { routeTags: ['puppeteer:sacrifice'], routeSignalStrength: 4, earlyGameRole: 'route_payoff' },

  // Chronomancer
  time_layer: { routeTags: ['chronomancer:time_layer'], routeSignalStrength: 3, earlyGameRole: 'route_confirm' },
  future_sight: { routeTags: ['chronomancer:time_layer'], routeSignalStrength: 3, earlyGameRole: 'generic_power' },
  layer_strike: { routeTags: ['chronomancer:time_layer'], routeSignalStrength: 4, earlyGameRole: 'route_payoff' },
  time_bomb: { routeTags: ['chronomancer:delay'], routeSignalStrength: 3, earlyGameRole: 'route_confirm' },
  delayed_blast: { routeTags: ['chronomancer:delay'], routeSignalStrength: 4, earlyGameRole: 'route_payoff' },
  warp_surge: { routeTags: ['chronomancer:warp'], routeSignalStrength: 3, earlyGameRole: 'route_confirm' },
  temporal_mastery: { routeTags: ['chronomancer:warp'], routeSignalStrength: 4, earlyGameRole: 'route_payoff' },

  // Alchemist
  fire_arrow: { routeTags: ['alchemist:fire'], routeSignalStrength: 3, earlyGameRole: 'route_confirm' },
  fire_bomb: { routeTags: ['alchemist:fire'], routeSignalStrength: 4, earlyGameRole: 'route_payoff' },
  acid_flask: { routeTags: ['alchemist:acid'], routeSignalStrength: 3, earlyGameRole: 'route_confirm' },
  universal_solvent: { routeTags: ['alchemist:acid'], routeSignalStrength: 4, earlyGameRole: 'route_payoff' },
  concoct: { routeTags: ['alchemist:concoction'], routeSignalStrength: 3, earlyGameRole: 'route_confirm' },
  elemental_burst: { routeTags: ['alchemist:concoction'], routeSignalStrength: 4, earlyGameRole: 'route_payoff' },
};

const EVENT_ROUTE_SIGNALS_BY_ID: Record<string, EventRouteSignalDef> = {
  rusting_medicae: {
    routeTags: [
      'informant:intel',
      'informant:stealth',
      'brute:strength',
      'brute:block',
      'tactician:poison',
      'tactician:command',
      'puppeteer:summon',
      'puppeteer:sacrifice',
      'chronomancer:warp',
      'chronomancer:delay',
      'alchemist:concoction',
      'alchemist:fire',
    ],
    reinforcement: 'payoff',
    preferredChoiceIds: ['medicae_implant', 'medicae_extract', 'medicae_salvage'],
    preferredChoiceRoles: {
      medicae_implant: 'payoff',
      medicae_extract: 'support',
      medicae_salvage: 'pivot',
    },
  },
  nameless_martyr_shrine: {
    routeTags: [
      'informant:evidence',
      'brute:rage',
      'tactician:formation',
      'puppeteer:threads',
      'chronomancer:time_layer',
      'alchemist:acid',
    ],
    reinforcement: 'confirm',
    preferredChoiceIds: ['martyr_offer_blood', 'martyr_offer_wealth', 'martyr_inscribe_oath'],
    preferredChoiceRoles: {
      martyr_offer_blood: 'payoff',
      martyr_offer_wealth: 'confirm',
      martyr_desecrate: 'pivot',
      martyr_inscribe_oath: 'support',
    },
    preferredChoiceCommitTags: {
      martyr_desecrate: ['brute:rage'],
      martyr_inscribe_oath: ['informant:evidence'],
    },
  },
  warp_tear_whispers: {
    routeTags: ['chronomancer:warp', 'chronomancer:time_layer'],
    reinforcement: 'support',
    preferredChoiceRoles: {
      tear_embrace: 'payoff',
      tear_bargain: 'support',
      tear_seal: 'pivot',
    },
    preferredChoiceCommitTags: {
      tear_embrace: ['chronomancer:warp'],
      tear_bargain: ['chronomancer:warp'],
      tear_seal: ['chronomancer:time_layer'],
    },
  },
  inquisitor_legacy: {
    routeTags: ['informant:intel', 'informant:evidence'],
    reinforcement: 'confirm',
    preferredChoiceIds: ['legacy_read_codex', 'legacy_take_rosary'],
    preferredChoiceRoles: {
      legacy_open_casket: 'pivot',
      legacy_read_codex: 'confirm',
      legacy_take_rosary: 'support',
      legacy_inscribe_sigil: 'payoff',
    },
    preferredChoiceCommitTags: {
      legacy_read_codex: ['informant:intel'],
      legacy_take_rosary: ['informant:evidence'],
      legacy_inscribe_sigil: ['informant:evidence'],
    },
  },
  machine_psalm_archive: {
    routeTags: ['informant:intel', 'tactician:command'],
    reinforcement: 'confirm',
    preferredChoiceIds: ['machine_psalm_copy', 'machine_psalm_alter'],
    preferredChoiceRoles: {
      machine_psalm_copy: 'confirm',
      machine_psalm_alter: 'payoff',
    },
  },
  logic_tribunal: { routeTags: ['tactician:command', 'tactician:formation'], reinforcement: 'support' },
  sacred_overclock: { routeTags: ['brute:strength', 'alchemist:concoction'], reinforcement: 'support' },
  blood_mill: { routeTags: ['brute:rage'], reinforcement: 'support' },
  servo_reliquary: { routeTags: ['puppeteer:summon', 'puppeteer:threads'], reinforcement: 'support' },
  terminal_silence: { routeTags: ['chronomancer:warp', 'chronomancer:time_layer'], reinforcement: 'support' },
  oracle_shrine: { routeTags: ['informant:intel', 'chronomancer:warp', 'tactician:command'], reinforcement: 'support' },
  coolant_crypt: { routeTags: ['alchemist:acid'], reinforcement: 'support' },
  reactor_chapel: { routeTags: ['alchemist:fire'], reinforcement: 'support' },
};

const GENERIC_POWER_BY_CHARACTER: Record<string, string[]> = {
  informant: ['warp_tap', 'mirror_tail', 'sudden_confession'],
  brute: ['bash', 'cleave', 'intimidating_roar'],
  tactician: ['quick_slash', 'acrobatics', 'quick_cycle'],
  puppeteer: ['wire_guard', 'wire_acrobatics', 'reposition'],
  chronomancer: ['afterimage_tick', 'borrow_tomorrow', 'fractured_hour'],
  alchemist: ['frost_armor', 'transmute_life', 'elemental_shield'],
};

const ROUTE_TAXONOMY_BY_TAG: Record<string, RouteTaxonomyEntry> = {
  'informant:intel': {
    routeTag: 'informant:intel',
    characterId: 'informant',
    label: '情报链',
    supportRelicIds: ['wiretap_rosary', 'black_ledger', 'evidence_furnace', 'codex_chip'],
  },
  'informant:stealth': {
    routeTag: 'informant:stealth',
    characterId: 'informant',
    label: '潜行链',
    supportRelicIds: ['surgical_lens', 'silent_beads', 'mirror_ink', 'grave_oil'],
  },
  'informant:evidence': {
    routeTag: 'informant:evidence',
    characterId: 'informant',
    label: '证据链',
    supportRelicIds: ['ledger_mask', 'fatal_index', 'mirror shard', 'silver locket'],
  },
  'brute:strength': {
    routeTag: 'brute:strength',
    characterId: 'brute',
    label: '力量链',
    supportRelicIds: ['vajra', 'ember_pin', 'reactive_incense', 'sacred_reactor_shard'],
  },
  'brute:block': {
    routeTag: 'brute:block',
    characterId: 'brute',
    label: '护甲链',
    supportRelicIds: ['anchor', 'seal_of_defiance', 'coolant_spine', 'penitent_cooling_mask'],
  },
  'brute:rage': {
    routeTag: 'brute:rage',
    characterId: 'brute',
    label: '怒意链',
    supportRelicIds: ['blood_ram', 'burning_blood', 'martyrs_censer', 'reactive_incense'],
  },
  'tactician:poison': {
    routeTag: 'tactician:poison',
    characterId: 'tactician',
    label: '毒性链',
    supportRelicIds: ['venom_alembic', 'attrition_engine', 'fatal_index', 'fracture_lens'],
  },
  'tactician:command': {
    routeTag: 'tactician:command',
    characterId: 'tactician',
    label: '号令链',
    supportRelicIds: ['command_pin', 'palace_abacus', 'court_tax', 'regent_seal'],
  },
  'tactician:formation': {
    routeTag: 'tactician:formation',
    characterId: 'tactician',
    label: '阵列链',
    supportRelicIds: ['bag_of_prep', 'servo_abacus', 'verdict_cog', 'abbot_sealant'],
  },
  'puppeteer:threads': {
    routeTag: 'puppeteer:threads',
    characterId: 'puppeteer',
    label: '丝线链',
    supportRelicIds: ['silver_threads', 'servo_abacus', 'dream_sheath', 'codex_chip'],
  },
  'puppeteer:summon': {
    routeTag: 'puppeteer:summon',
    characterId: 'puppeteer',
    label: '召构链',
    supportRelicIds: ['silver_threads', 'shard_lantern', 'dream_sheath', 'funeral_dynamo'],
  },
  'puppeteer:sacrifice': {
    routeTag: 'puppeteer:sacrifice',
    characterId: 'puppeteer',
    label: '献祭链',
    supportRelicIds: ['seal_of_martyrdom', 'martyr_coin', 'purge_hook', 'funeral_dynamo'],
  },
  'chronomancer:time_layer': {
    routeTag: 'chronomancer:time_layer',
    characterId: 'chronomancer',
    label: '时间层链',
    supportRelicIds: ['fractured hourglass', 'echo_buckle', 'dream_sheath', 'prophetic_eye'],
  },
  'chronomancer:delay': {
    routeTag: 'chronomancer:delay',
    characterId: 'chronomancer',
    label: '延时链',
    supportRelicIds: ['cracked_hourglass', 'echo_buckle', 'shortcut_compass', 'prophetic_eye'],
  },
  'chronomancer:warp': {
    routeTag: 'chronomancer:warp',
    characterId: 'chronomancer',
    label: '跃迁链',
    supportRelicIds: ['lantern', 'ruined_reactor', 'warp_distorter', 'chaos_sanctum_relic'],
  },
  'alchemist:fire': {
    routeTag: 'alchemist:fire',
    characterId: 'alchemist',
    label: '火相链',
    supportRelicIds: ['ember_pin', 'sacred_reactor_shard', 'reactive_incense', 'prism_crucible'],
  },
  'alchemist:acid': {
    routeTag: 'alchemist:acid',
    characterId: 'alchemist',
    label: '酸蚀链',
    supportRelicIds: ['venom_alembic', 'attrition_engine', 'dissolution_crucible', 'cooling_retort'],
  },
  'alchemist:concoction': {
    routeTag: 'alchemist:concoction',
    characterId: 'alchemist',
    label: '配方链',
    supportRelicIds: ['dissolution_crucible', 'prism_crucible', 'cooling_retort', 'evidence_furnace'],
  },
};

const CARD_ROUTE_AFFINITY_OVERRIDES_BY_ID: Record<string, string[]> = {
  expose_weakness: ['informant:intel'],
  intel_dump: ['informant:intel'],
  toxic_cloud: ['tactician:poison'],
  venom_strike: ['tactician:poison'],
  acid_spray: ['alchemist:acid'],
  acid_bath: ['alchemist:acid'],
  time_warp: ['chronomancer:warp'],
  deja_vu: ['chronomancer:warp'],
  glass_marionette: ['puppeteer:summon'],
  sealed_testimony: ['informant:evidence'],
  evidence_laundering: ['informant:evidence'],
  line_adjustment: ['tactician:command'],
  coordinated_breach: ['tactician:formation'],
};

const TAG_ROUTE_RULES_BY_CHARACTER: Record<string, Array<{ routeTag: string; keywords: string[] }>> = {
  informant: [
    { routeTag: 'informant:intel', keywords: ['intel'] },
    { routeTag: 'informant:stealth', keywords: ['stealth'] },
    { routeTag: 'informant:evidence', keywords: ['evidence', 'witness'] },
  ],
  brute: [
    { routeTag: 'brute:strength', keywords: ['strength'] },
    { routeTag: 'brute:block', keywords: ['block', 'shield', 'armor'] },
    { routeTag: 'brute:rage', keywords: ['rage', 'wrath'] },
  ],
  tactician: [
    { routeTag: 'tactician:poison', keywords: ['poison'] },
    { routeTag: 'tactician:command', keywords: ['command'] },
    { routeTag: 'tactician:formation', keywords: ['formation'] },
  ],
  puppeteer: [
    { routeTag: 'puppeteer:threads', keywords: ['thread', 'threads'] },
    { routeTag: 'puppeteer:summon', keywords: ['summon', 'construct'] },
    { routeTag: 'puppeteer:sacrifice', keywords: ['sacrifice', 'detonate'] },
  ],
  chronomancer: [
    { routeTag: 'chronomancer:time_layer', keywords: ['layer', 'echo'] },
    { routeTag: 'chronomancer:delay', keywords: ['delay'] },
    { routeTag: 'chronomancer:warp', keywords: ['warp'] },
  ],
  alchemist: [
    { routeTag: 'alchemist:fire', keywords: ['fire'] },
    { routeTag: 'alchemist:acid', keywords: ['acid'] },
    { routeTag: 'alchemist:concoction', keywords: ['concoction', 'element', 'brew'] },
  ],
};

const EARLY_ROLE_WEIGHT: Record<EarlyGameRole, number> = {
  route_confirm: 3,
  route_payoff: 4,
  generic_power: 2,
  generic_fallback: 1,
};

function getCardRouteAffinityScore(card: Pick<CardDef, 'id'>, preferredRouteTag: string | null): number {
  if (!preferredRouteTag) return 0;
  const affinity = getCardRouteAffinity(card);
  if (!affinity || !affinity.routeTags.includes(preferredRouteTag)) return 0;
  return affinity.affinityStrength * 10 + (affinity.source === 'signal' ? 4 : affinity.source === 'override' ? 2 : 1);
}

function getRelicRouteAffinityScore(relicId: string, preferredRouteTag: string | null): number {
  if (!preferredRouteTag) return 0;
  return getRelicRouteTags(relicId).includes(preferredRouteTag) ? 1 : 0;
}

export function getCardRouteSignal(card: Pick<CardDef, 'id'>): CardRouteSignalDef | null {
  return CARD_ROUTE_SIGNALS_BY_ID[card.id] ?? null;
}

function inferCardRouteTagsFromTags(card: CardDef): string[] {
  const rules = TAG_ROUTE_RULES_BY_CHARACTER[card.character ?? ''] ?? [];
  if (rules.length === 0) return [];
  const haystack = new Set<string>([...(card.tags ?? []), ...card.id.split(/[_-]/g)].map((entry) => entry.toLowerCase()));
  const tags: string[] = [];
  for (const rule of rules) {
    if (rule.keywords.some((keyword) => haystack.has(keyword))) {
      tags.push(rule.routeTag);
    }
  }
  return tags;
}

export function getCardRouteAffinity(card: Pick<CardDef, 'id'>): CardRouteAffinityDef | null {
  const signal = getCardRouteSignal(card);
  if (signal) {
    return {
      routeTags: [...signal.routeTags],
      affinityStrength: signal.routeSignalStrength,
      source: 'signal',
    };
  }

  const overrideTags = CARD_ROUTE_AFFINITY_OVERRIDES_BY_ID[card.id];
  if (overrideTags?.length) {
    return {
      routeTags: [...overrideTags],
      affinityStrength: 2,
      source: 'override',
    };
  }

  const rawCard = baseCardMap.get(card.id);
  if (!rawCard) return null;
  const routeTags = inferCardRouteTagsFromTags(rawCard);
  if (routeTags.length === 0) return null;
  return {
    routeTags,
    affinityStrength: 1,
    source: 'tag-rule',
  };
}

export function getCardRouteAffinityTags(card: Pick<CardDef, 'id'>): string[] {
  return getCardRouteAffinity(card)?.routeTags ?? [];
}

export function getEventRouteSignal(eventId: string): EventRouteSignalDef | null {
  return EVENT_ROUTE_SIGNALS_BY_ID[eventId] ?? null;
}

function getDefaultEventChoiceRouteRole(signal: EventRouteSignalDef, choiceId: string): EventChoiceRouteRole | null {
  if (!signal.preferredChoiceIds?.includes(choiceId)) {
    return null;
  }
  if (signal.reinforcement === 'payoff') {
    return 'payoff';
  }
  if (signal.reinforcement === 'confirm') {
    return 'confirm';
  }
  return 'support';
}

export function getEventChoiceRouteRole(eventId: string, choiceId: string): EventChoiceRouteRole | null {
  const signal = getEventRouteSignal(eventId);
  if (!signal) {
    return null;
  }
  return signal.preferredChoiceRoles?.[choiceId] ?? getDefaultEventChoiceRouteRole(signal, choiceId);
}

export function getEventChoiceRouteCommitWeight(eventId: string, choiceId: string): number | null {
  const role = getEventChoiceRouteRole(eventId, choiceId);
  if (!role) {
    return null;
  }
  if (role === 'payoff') {
    return 40;
  }
  if (role === 'confirm') {
    return 32;
  }
  if (role === 'pivot') {
    return 28;
  }
  return 20;
}

export function getEventChoiceCommitTags(eventId: string, choiceId: string): string[] {
  const signal = getEventRouteSignal(eventId);
  if (!signal) {
    return [];
  }
  return [...(signal.preferredChoiceCommitTags?.[choiceId] ?? signal.routeTags)];
}

export function enrichCardRouteSignals<T extends CardDef>(cards: T[]): T[] {
  return cards.map((card) => {
    const signal = getCardRouteSignal(card);
    if (!signal) return card;
    return {
      ...card,
      routeTags: [...signal.routeTags],
      routeSignalStrength: signal.routeSignalStrength,
      earlyGameRole: signal.earlyGameRole,
    };
  });
}

export function analyzeRouteSignals(cards: Array<Pick<CardDef, 'id'> | Pick<RunCardInstance, 'id'>>): {
  scoreByTag: Record<string, number>;
  dominantTag: string | null;
  activeTags: string[];
} {
  const scoreByTag: Record<string, number> = {};
  for (const card of cards) {
    const signal = getCardRouteSignal(card);
    if (!signal) continue;
    for (const tag of signal.routeTags) {
      scoreByTag[tag] = (scoreByTag[tag] || 0) + signal.routeSignalStrength;
    }
  }
  const entries = Object.entries(scoreByTag).sort((a, b) => b[1] - a[1]);
  return {
    scoreByTag,
    dominantTag: entries[0]?.[0] ?? null,
    activeTags: entries.map(([tag]) => tag),
  };
}

export function getKnownRouteTagsForCharacter(characterId: string): string[] {
  return Object.values(ROUTE_TAXONOMY_BY_TAG)
    .filter((entry) => entry.characterId === characterId)
    .map((entry) => entry.routeTag);
}

export function getGenericPowerIdsForCharacter(characterId: string): string[] {
  return GENERIC_POWER_BY_CHARACTER[characterId] ?? [];
}

export function getRouteTaxonomy(routeTag: string): RouteTaxonomyEntry | null {
  return ROUTE_TAXONOMY_BY_TAG[routeTag] ?? null;
}

export function getRouteTaxonomyForCharacter(characterId: string): RouteTaxonomyEntry[] {
  return Object.values(ROUTE_TAXONOMY_BY_TAG).filter((entry) => entry.characterId === characterId);
}

export function getRouteSupportRelicIds(routeTag: string): string[] {
  return [...(ROUTE_TAXONOMY_BY_TAG[routeTag]?.supportRelicIds ?? [])];
}

export function getRelicRouteTags(relicId: string): string[] {
  return Object.values(ROUTE_TAXONOMY_BY_TAG)
    .filter((entry) => entry.supportRelicIds.includes(relicId))
    .map((entry) => entry.routeTag);
}

export function resolvePreferredRouteTag(
  deck: Array<Pick<CardDef, 'id'>>,
  knownRouteTags: string[],
  maxRecentCards = 3,
): string | null {
  const recentCards = deck.slice(-maxRecentCards).reverse();
  for (const card of recentCards) {
    const signal = getCardRouteSignal(card);
    const matchedTag = signal?.routeTags.find((tag) => knownRouteTags.includes(tag)) ?? null;
    if (matchedTag) {
      return matchedTag;
    }
  }

  const routeProfile = analyzeRouteSignals(deck);
  if (routeProfile.dominantTag && knownRouteTags.includes(routeProfile.dominantTag)) {
    return routeProfile.dominantTag;
  }

  return null;
}

export function sortCardsByRouteAffinity<T extends Pick<CardDef, 'id'>>(cards: T[], preferredRouteTag: string | null): T[] {
  return [...cards].sort((a, b) => {
    const scoreDelta = getCardRouteAffinityScore(b, preferredRouteTag) - getCardRouteAffinityScore(a, preferredRouteTag);
    if (scoreDelta !== 0) return scoreDelta;
    return a.id.localeCompare(b.id);
  });
}

export function sortRelicIdsByRouteAffinity<T extends string>(relicIds: T[], preferredRouteTag: string | null): T[] {
  return [...relicIds].sort((a, b) => {
    const scoreDelta = getRelicRouteAffinityScore(b, preferredRouteTag) - getRelicRouteAffinityScore(a, preferredRouteTag);
    if (scoreDelta !== 0) return scoreDelta;
    return a.localeCompare(b);
  });
}
