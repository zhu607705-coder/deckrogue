import { RELIC_UPGRADE_CONFIGS } from '@/core/relic/RelicUpgrade';
import type { RouteState, RunCardInstance } from '@/core/types';
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

export type RestActionId = 'heal' | 'upgrade' | 'enchant' | 'disperse' | 'relic_upgrade';

export interface RestRouteActionHint {
  action: RestActionId;
  emphasis: 'route' | 'stability';
  reason: string;
  routeTag: string | null;
  routeLabel: string | null;
  score: number;
}

export interface RestRouteAdvice {
  preferredRouteTag: string | null;
  preferredRouteLabel: string | null;
  primaryAction: RestActionId | null;
  orderedActions: RestActionId[];
  actionHints: Partial<Record<RestActionId, RestRouteActionHint>>;
}

export interface RestRouteAdvisorInput {
  characterId?: string | null;
  deck: RunCardInstance[];
  routeState?: RouteState | null;
  relicIds: string[];
  currentHp: number;
  maxHp: number;
  canHeal: boolean;
  canUpgrade: boolean;
  canEnchant: boolean;
  canUpgradeRelic: boolean;
}

const CARD_ROLE_WEIGHT: Record<string, number> = {
  route_payoff: 4,
  route_confirm: 3,
  generic_power: 1,
  generic_fallback: 0,
};

function cardMatchesPreferredRoute(card: RunCardInstance, preferredRouteTag: string): boolean {
  return !!getCardRouteAffinity(card)?.routeTags.includes(preferredRouteTag);
}

function makeRouteHint(
  action: RestActionId,
  routeTag: string,
  score: number,
  reason: string,
): RestRouteActionHint {
  return {
    action,
    emphasis: 'route',
    reason,
    routeTag,
    routeLabel: getRouteTaxonomy(routeTag)?.label ?? routeTag,
    score,
  };
}

export function buildRestRouteAdvice(input: RestRouteAdvisorInput): RestRouteAdvice {
  const routeTagsForCharacter = input.characterId ? getKnownRouteTagsForCharacter(input.characterId) : [];
  const preferredRouteTag = getPreferredRouteTagFromState(
    input.deck,
    routeTagsForCharacter,
    input.routeState ?? null,
  );
  const preferredRouteLabel = preferredRouteTag ? getRouteTaxonomy(preferredRouteTag)?.label ?? preferredRouteTag : null;
  const actionHints: Partial<Record<RestActionId, RestRouteActionHint>> = {};

  if (preferredRouteTag && input.canUpgrade) {
    const upgradableCards = sortCardsByRouteAffinity(
      input.deck.filter((card) => !card.isUpgraded && card.upgrade),
      preferredRouteTag,
    );
    const topUpgradeCard = upgradableCards[0];
    const topUpgradeSignal = topUpgradeCard ? getCardRouteSignal(topUpgradeCard) : null;
    if ((topUpgradeSignal?.routeTags.includes(preferredRouteTag)) || (topUpgradeCard && cardMatchesPreferredRoute(topUpgradeCard, preferredRouteTag))) {
      const roleWeight = CARD_ROLE_WEIGHT[topUpgradeSignal?.earlyGameRole ?? 'generic_fallback'] ?? 0;
      actionHints.upgrade = makeRouteHint('upgrade', preferredRouteTag, 40 + roleWeight, '优先强化当前路线的关键牌');
    }
  }

  if (preferredRouteTag && input.canEnchant) {
    const enchantableCards = sortCardsByRouteAffinity(
      input.deck.filter((card) => {
        const hasNoEnchantment =
          (card.type === 'Attack' || card.type === 'Skill') &&
          (!(card as RunCardInstance).persistentEnchantments || (card as RunCardInstance).persistentEnchantments.length === 0);
        return hasNoEnchantment;
      }),
      preferredRouteTag,
    );
    const topEnchantCard = enchantableCards[0];
    const topEnchantSignal = topEnchantCard ? getCardRouteSignal(topEnchantCard) : null;
    if ((topEnchantSignal?.routeTags.includes(preferredRouteTag)) || (topEnchantCard && cardMatchesPreferredRoute(topEnchantCard, preferredRouteTag))) {
      const roleWeight = CARD_ROLE_WEIGHT[topEnchantSignal?.earlyGameRole ?? 'generic_fallback'] ?? 0;
      actionHints.enchant = makeRouteHint('enchant', preferredRouteTag, 30 + roleWeight, '优先给当前路线牌追加局内强化');
    }
  }

  if (preferredRouteTag && input.canUpgradeRelic) {
    const upgradableRelics = sortRelicIdsByRouteAffinity(
      RELIC_UPGRADE_CONFIGS
        .filter((config) => input.relicIds.includes(config.relicId))
        .map((config) => config.relicId),
      preferredRouteTag,
    );
    const topRelicId = upgradableRelics[0];
    if (topRelicId && getRelicRouteTags(topRelicId).includes(preferredRouteTag)) {
      actionHints.relic_upgrade = makeRouteHint('relic_upgrade', preferredRouteTag, 24, '优先强化支撑当前路线的遗物');
    }
  }

  const hpRatio = input.maxHp > 0 ? input.currentHp / input.maxHp : 1;
  if (input.canHeal && hpRatio < 0.45) {
    actionHints.heal = {
      action: 'heal',
      emphasis: 'stability',
      reason: '当前生命偏低，先保住推进节奏',
      routeTag: null,
      routeLabel: null,
      score: 12,
    };
  }

  const orderedHints = Object.values(actionHints).sort((a, b) => b.score - a.score || a.action.localeCompare(b.action));
  return {
    preferredRouteTag,
    preferredRouteLabel,
    primaryAction: orderedHints[0]?.action ?? null,
    orderedActions: orderedHints.map((hint) => hint.action),
    actionHints,
  };
}
