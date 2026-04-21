import type { RouteState, RunCardInstance } from '@/core/types';
import rawRelicsData from '@/content/data/relics.json';
import {
  getCardRouteAffinity,
  getCardRouteSignal,
  getKnownRouteTagsForCharacter,
  getPreferredRouteTagFromState,
  getRelicRouteTags,
  getRouteTaxonomy,
  sortCardsByRouteAffinity,
  sortRelicIdsByRouteAffinity,
} from '@/content/narrative/numericSystem';
import type { RelicDef } from '@/core/types';

const relicsData = rawRelicsData as unknown as RelicDef[];
const relicNameById = new Map(relicsData.map((relic) => [relic.id, relic.name]));

export type ShopRouteTargetType = 'card' | 'relic' | 'service';
export type ShopRouteServiceId = 'upgrade' | 'enchant';

export interface ShopCardOffer {
  card: RunCardInstance;
  price: number;
}

export interface ShopRelicOffer {
  relicId: string;
  price: number;
}

export interface ShopRouteHint {
  targetType: ShopRouteTargetType;
  targetId: string;
  routeTag: string;
  routeLabel: string;
  reason: string;
  score: number;
}

export interface ShopRouteAdvice {
  preferredRouteTag: string | null;
  preferredRouteLabel: string | null;
  primaryHint: ShopRouteHint | null;
  cardHints: Record<string, ShopRouteHint>;
  relicHints: Record<string, ShopRouteHint>;
  serviceHints: Partial<Record<ShopRouteServiceId, ShopRouteHint>>;
}

export interface ShopRouteAdvisorInput {
  characterId?: string | null;
  deck: RunCardInstance[];
  routeState?: RouteState | null;
  gold: number;
  cardOffers: ShopCardOffer[];
  relicOffers: ShopRelicOffer[];
  canUpgrade: boolean;
  canEnchant: boolean;
}

const CARD_ROLE_WEIGHT: Record<string, number> = {
  route_payoff: 5,
  route_confirm: 4,
  generic_power: 2,
  generic_fallback: 1,
};

function makeRouteHint(
  targetType: ShopRouteTargetType,
  targetId: string,
  routeTag: string,
  score: number,
  reason: string,
): ShopRouteHint {
  return {
    targetType,
    targetId,
    routeTag,
    routeLabel: getRouteTaxonomy(routeTag)?.label ?? routeTag,
    reason,
    score,
  };
}

function getBaseCardReason(card: RunCardInstance, preferredRouteTag: string): string {
  const signal = getCardRouteSignal(card);
  const affinity = getCardRouteAffinity(card);
  if (!affinity?.routeTags.includes(preferredRouteTag)) {
    return '优先补入对齐当前路线的记忆印痕';
  }
  if (signal?.earlyGameRole === 'route_payoff') {
    return '优先补入当前路线的兑现牌';
  }
  if (signal?.earlyGameRole === 'route_confirm') {
    return '优先补入当前路线的确认牌';
  }
  return '优先补入对齐当前路线的记忆印痕';
}

function cardMatchesPreferredRoute(card: RunCardInstance, preferredRouteTag: string): boolean {
  return !!getCardRouteAffinity(card)?.routeTags.includes(preferredRouteTag);
}

export function buildShopRouteAdvice(input: ShopRouteAdvisorInput): ShopRouteAdvice {
  const routeTagsForCharacter = input.characterId ? getKnownRouteTagsForCharacter(input.characterId) : [];
  const preferredRouteTag = getPreferredRouteTagFromState(
    input.deck,
    routeTagsForCharacter,
    input.routeState ?? null,
  );
  const preferredRouteLabel = preferredRouteTag ? getRouteTaxonomy(preferredRouteTag)?.label ?? preferredRouteTag : null;

  if (!preferredRouteTag) {
    return {
      preferredRouteTag: null,
      preferredRouteLabel: null,
      primaryHint: null,
      cardHints: {},
      relicHints: {},
      serviceHints: {},
    };
  }

  const cardHints: Record<string, ShopRouteHint> = {};
  const relicHints: Record<string, ShopRouteHint> = {};
  const serviceHints: Partial<Record<ShopRouteServiceId, ShopRouteHint>> = {};
  const rankedHints: ShopRouteHint[] = [];

  const affordableAlignedCards = sortCardsByRouteAffinity(
    input.cardOffers
      .filter((offer) => offer.price <= input.gold)
      .map((offer) => offer.card),
    preferredRouteTag,
  ).filter((card) => cardMatchesPreferredRoute(card, preferredRouteTag));

  affordableAlignedCards.forEach((card, index) => {
    const signal = getCardRouteSignal(card);
    const roleWeight = CARD_ROLE_WEIGHT[signal?.earlyGameRole ?? 'generic_fallback'] ?? 0;
    const score = 60 - index * 3 + roleWeight;
    const hint = makeRouteHint('card', card.instanceId, preferredRouteTag, score, getBaseCardReason(card, preferredRouteTag));
    cardHints[card.instanceId] = hint;
    rankedHints.push(hint);
  });

  const affordableAlignedRelics = sortRelicIdsByRouteAffinity(
    input.relicOffers
      .filter((offer) => offer.price <= input.gold)
      .map((offer) => offer.relicId),
    preferredRouteTag,
  ).filter((relicId) => getRelicRouteTags(relicId).includes(preferredRouteTag));

  affordableAlignedRelics.forEach((relicId, index) => {
    const relicName = relicNameById.get(relicId);
    const hint = makeRouteHint(
      'relic',
      relicId,
      preferredRouteTag,
      42 - index * 2,
      relicName ? `优先拿支撑当前路线的遗物：${relicName}` : '优先拿支撑当前路线的遗物',
    );
    relicHints[relicId] = hint;
    rankedHints.push(hint);
  });

  if (input.canUpgrade) {
    const upgradeCandidates = sortCardsByRouteAffinity(
      input.deck.filter((card) => !card.isUpgraded && card.upgrade),
      preferredRouteTag,
    );
    const topUpgradeCard = upgradeCandidates[0];
    if (topUpgradeCard && cardMatchesPreferredRoute(topUpgradeCard, preferredRouteTag)) {
      const hint = makeRouteHint('service', 'upgrade', preferredRouteTag, 30, '当前商店后可继续锻造当前路线的关键牌');
      serviceHints.upgrade = hint;
      rankedHints.push(hint);
    }
  }

  if (input.canEnchant) {
    const enchantCandidates = sortCardsByRouteAffinity(
      input.deck.filter((card) => {
        const hasNoEnchantment =
          (card.type === 'Attack' || card.type === 'Skill') &&
          (!card.persistentEnchantments || card.persistentEnchantments.length === 0);
        return hasNoEnchantment;
      }),
      preferredRouteTag,
    );
    const topEnchantCard = enchantCandidates[0];
    if (topEnchantCard && cardMatchesPreferredRoute(topEnchantCard, preferredRouteTag)) {
      const hint = makeRouteHint('service', 'enchant', preferredRouteTag, 26, '当前商店后可给路线牌追加附魔强化');
      serviceHints.enchant = hint;
      rankedHints.push(hint);
    }
  }

  rankedHints.sort((a, b) => b.score - a.score || a.targetType.localeCompare(b.targetType) || a.targetId.localeCompare(b.targetId));

  return {
    preferredRouteTag,
    preferredRouteLabel,
    primaryHint: rankedHints[0] ?? null,
    cardHints,
    relicHints,
    serviceHints,
  };
}
