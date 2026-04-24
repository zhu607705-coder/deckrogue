/**
 * @file sceneProps.ts
 * @description 场景属性类型定义，为各场景组件提供 props 接口
 *
 * 主要职责:
 * - 定义 MapSceneProps / CombatSceneProps / RewardSceneProps 等场景属性接口
 * - 定义 SceneDecisionGuidance 路线决策引导数据结构
 * - 提供各场景的 props 推导工厂函数
 */
import type { RenderModel } from './contracts';
import type { CardDef, RunCardInstance } from '@/core/types';
import { getCardDefById, getRouteTaxonomy } from '@/content/narrative/numericSystem';
import { buildRouteDossiers, type RouteDossier } from '@/ui/views/mapRouteAdvisor';
import { buildRestRouteAdvice, type RestRouteAdvice } from '@/ui/views/restRouteAdvisor';
import { buildShopRouteAdvice, type ShopRouteAdvice } from '@/ui/views/shopRouteAdvisor';

export interface SceneDecisionGuidance {
  routeTag: string | null;
  routeLabel: string | null;
  headline: string;
  reason: string;
  recommendedActionId?: string | null;
  recommendedTargetId?: string | null;
}

export interface MapSceneProps {
  player: {
    hp: number;
    maxHp: number;
    gold: number;
    deckCount: number;
  };
  map: {
    nodes: Array<{
      id: string;
      type: string;
      x: number;
      y: number;
      revealed: boolean;
      next: string[];
    }>;
    currentNodeId: string | null;
    currentFloor: number | null;
    availableNodeIds: string[];
    routeDossiers: RouteDossier[];
    recommendedNodeId: string | null;
  };
}

export interface CombatSceneProps {
  player: {
    hp: number;
    maxHp: number;
  };
  combat: {
    turn: number;
    isPlayerTurn: boolean;
    playerEnergy: number;
    playerBlock: number;
    enemies: Array<{
      id: string;
      defId: string;
      hp: number;
      maxHp: number;
      block: number;
      nextIntent: string | null;
    }>;
    hand: string[];
    handCards: Array<{
      id: string;
      name: string;
      cost: number;
      type: string;
      description?: string;
      playHint: string;
    }>;
    drawPileCount: number;
    discardPileCount: number;
  };
  room: {
    title?: string;
    guidance?: SceneDecisionGuidance | null;
  };
}

export interface RewardSceneProps {
  player: {
    hp: number;
    maxHp: number;
    gold: number;
  };
  reward: {
    cards: Array<{
      id: string;
      name: string;
      cost: number;
      rarity: string;
      type: string;
      description?: string;
      routeReason?: string;
    }>;
    source: string;
  };
  room: {
    title?: string;
    body?: string;
    guidance?: SceneDecisionGuidance | null;
  };
}

export interface RestSceneProps {
  player: {
    hp: number;
    maxHp: number;
    gold: number;
  };
  room: {
    title?: string;
    body?: string;
    guidance?: SceneDecisionGuidance | null;
    canHeal: boolean;
    healAmount: number;
    canUpgrade: boolean;
    canRemove: boolean;
    canEnchant?: boolean;
    canRelicUpgrade?: boolean;
    cardRemovalCost: number;
    routeAdvice?: RestRouteAdvice;
  };
}

export interface EventSceneProps {
  room: {
    title?: string;
    body?: string;
    choices: Array<{
      id: string;
      label: string;
      disabled?: boolean;
      description?: string;
      routeRole?: string;
      routeLabel?: string;
      routeReason?: string;
    }>;
    guidance?: SceneDecisionGuidance | null;
  };
}

export interface ShopSceneProps {
  player: {
    gold: number;
  };
  room: {
    title?: string;
    body?: string;
    guidance?: SceneDecisionGuidance | null;
    cardCount?: number;
    relicCount?: number;
    potionStockCount?: number;
    canRemove?: boolean;
    canEnchant?: boolean;
    cardRemovalCost?: number;
    cards: Array<{
      id: string;
      name: string;
      price: number;
      rarity?: string;
      type?: string;
      description?: string;
      routeReason?: string;
      routeLabel?: string;
      recommended?: boolean;
    }>;
    relics: Array<{
      id: string;
      name: string;
      price: number;
      rarity?: string;
      type?: string;
      description?: string;
      routeReason?: string;
      routeLabel?: string;
      recommended?: boolean;
    }>;
    potions: Array<{
      id: string;
      name: string;
      price: number;
      rarity?: string;
      type?: string;
      description?: string;
    }>;
    routeAdvice?: ShopRouteAdvice;
  };
}

export interface CharacterSelectSceneProps {
  room: {
    title?: string;
    body?: string;
  };
}

export type SceneProps =
  | { kind: 'map'; props: MapSceneProps }
  | { kind: 'combat'; props: CombatSceneProps }
  | { kind: 'reward'; props: RewardSceneProps }
  | { kind: 'rest'; props: RestSceneProps }
  | { kind: 'event'; props: EventSceneProps }
  | { kind: 'shop'; props: ShopSceneProps }
  | { kind: 'character_select'; props: CharacterSelectSceneProps };

function toBaseCardId(cardId: string): string {
  return cardId.endsWith('+') || cardId.endsWith('*') ? cardId.slice(0, -1) : cardId;
}

function makeRuntimeCard(cardId: string, instanceId: string): RunCardInstance | null {
  const baseCardId = toBaseCardId(cardId);
  const cardDef = getCardDefById(baseCardId);
  if (!cardDef) return null;
  return {
    ...cardDef,
    id: cardDef.id,
    instanceId,
    baseCardId: cardDef.id,
    runtimeBase: cardDef,
    isUpgraded: cardId.endsWith('+') || cardDef.isUpgraded,
    persistentEnchantments: [],
    combatAfflictions: [],
  };
}

function makeRuntimeDeck(cardIds: string[]): RunCardInstance[] {
  return cardIds
    .map((cardId, index) => makeRuntimeCard(cardId, `${index}:${cardId}`))
    .filter((card): card is RunCardInstance => !!card);
}

function scoreRouteDossier(dossier: RouteDossier, healthRatio: number): number {
  const sustainWeight = healthRatio < 0.55 ? 2.2 : 0.8;
  const challengeWeight = healthRatio > 0.7 ? 0.9 : -0.4;
  return dossier.sustain * sustainWeight + dossier.challenge * challengeWeight + dossier.mystery * 0.6;
}

export function deriveMapSceneProps(model: RenderModel): MapSceneProps | null {
  if (model.screen !== 'Map') {
    return null;
  }

  const routeDossiers = buildRouteDossiers(
    model.map.nodes as any,
    model.map.availableNodeIds,
    {
      hp: model.player.hp,
      maxHp: model.player.maxHp,
      intel: model.player.intel,
      relicCount: model.player.relicCount,
      characterId: model.player.characterId,
    },
  );
  const recommendedNodeId =
    [...routeDossiers].sort((left, right) => scoreRouteDossier(right, model.player.healthRatio) - scoreRouteDossier(left, model.player.healthRatio))[0]?.nodeId ?? null;

  return {
    player: {
      hp: model.player.hp,
      maxHp: model.player.maxHp,
      gold: model.player.gold,
      deckCount: model.player.deckCount,
    },
    map: {
      nodes: model.map.nodes,
      currentNodeId: model.map.currentNodeId,
      currentFloor: model.map.currentFloor,
      availableNodeIds: model.map.availableNodeIds,
      routeDossiers,
      recommendedNodeId,
    },
  };
}

export function deriveCombatSceneProps(model: RenderModel): CombatSceneProps | null {
  if (model.screen !== 'Combat' || !model.combat) {
    return null;
  }
  const routeTag = model.routeState?.primaryTag ?? null;
  const routeLabel = routeTag ? getRouteTaxonomy(routeTag)?.label ?? routeTag : null;
  const leadingIntent = model.combat.enemies.find((enemy) => enemy.hp > 0)?.nextIntent ?? null;
  const handCards = model.combat.hand.map((cardId) => {
    const normalizedCardId = cardId.endsWith('+') ? cardId.slice(0, -1) : cardId;
    const card = getCardDefById(normalizedCardId);
    const cost = card?.cost ?? 1;
    const type = card?.type ?? 'Card';
    return {
      id: cardId,
      name: card?.name ? `${card.name}${cardId.endsWith('+') ? ' +' : ''}` : cardId.replace(/_/g, ' '),
      cost,
      type,
      description: card?.text,
      playHint: cost > model.combat!.playerEnergy
        ? `能量不足：需要 ${cost}，当前 ${model.combat!.playerEnergy}`
        : leadingIntent
          ? `可用；先处理敌方意图 ${leadingIntent}`
          : `可用；按当前路线 ${routeLabel ?? '成型方向'} 选择收益最高的牌`,
    };
  });

  return {
    player: {
      hp: model.player.hp,
      maxHp: model.player.maxHp,
    },
    combat: {
      turn: model.combat.turn,
      isPlayerTurn: model.combat.isPlayerTurn,
      playerEnergy: model.combat.playerEnergy,
      playerBlock: model.combat.playerBlock,
      enemies: model.combat.enemies.map((enemy) => ({
        id: enemy.id,
        defId: enemy.defId,
        hp: enemy.hp,
        maxHp: enemy.maxHp,
        block: enemy.block,
        nextIntent: enemy.nextIntent ?? null,
      })),
      hand: model.combat.hand,
      handCards,
      drawPileCount: model.combat.drawPileCount,
      discardPileCount: model.combat.discardPileCount,
    },
    room: {
      title: model.room?.title,
      guidance: {
        routeTag,
        routeLabel,
        headline: leadingIntent ? '先读敌方意图，再决定出牌顺序' : '用当前手牌推进战斗节奏',
        reason: leadingIntent
          ? `当前主要威胁是 ${leadingIntent}；优先用可支付手牌处理伤害、护盾或终结机会。`
          : '没有明确敌方意图时，优先保留资源并推进当前路线核心牌。',
        recommendedActionId: 'complete_combat',
      },
    },
  };
}

export function deriveRewardSceneProps(model: RenderModel): RewardSceneProps | null {
  if (model.screen !== 'Reward' || !model.reward) {
    return null;
  }

  const cards = model.reward.cards ?? model.reward.cardIds.map((id) => ({
    id,
    name: id.replace(/_/g, ' '),
    cost: 1,
    rarity: 'Common',
    type: 'Attack',
    description: undefined,
  }));
  const routeTag = model.routeState?.primaryTag ?? null;
  const routeLabel = routeTag ? getRouteTaxonomy(routeTag)?.label ?? routeTag : null;
  const cardsWithReasons = cards.map((card) => ({
    ...card,
    routeReason: routeLabel
      ? `${routeLabel} 路线：优先判断这张 ${card.type} 是否补强当前战斗节奏。`
      : '路线仍在形成：优先选择低风险、泛用或能打开新路线的奖励。',
  }));

  return {
    player: {
      hp: model.player.hp,
      maxHp: model.player.maxHp,
      gold: model.player.gold,
    },
    reward: {
      cards: cardsWithReasons,
      source: model.reward.source,
    },
    room: {
      title: model.room?.title,
      body: model.room?.body,
      guidance: {
        routeTag,
        routeLabel,
        headline: routeLabel ? '奖励选择要服务当前路线' : '奖励选择可以定义下一步路线',
        reason: routeLabel
          ? `优先选择能强化 ${routeLabel} 的牌；如果奖励不匹配，跳过比污染牌库更安全。`
          : '还没有稳定路线时，选择泛用强牌或能形成明确承诺的牌。',
        recommendedActionId: 'take_reward',
      },
    },
  };
}

export function deriveRestSceneProps(model: RenderModel): RestSceneProps | null {
  if (model.screen !== 'Rest' || !model.room) {
    return null;
  }

  const routeAdvice = buildRestRouteAdvice({
    characterId: model.player.characterId,
    deck: makeRuntimeDeck(model.player.deck),
    routeState: model.routeState ?? null,
    relicIds: [],
    currentHp: model.player.hp,
    maxHp: model.player.maxHp,
    canHeal: model.room.canHeal ?? false,
    canUpgrade: model.room.canUpgrade ?? false,
    canEnchant: model.room.canEnchant ?? false,
    canUpgradeRelic: model.room.canRelicUpgrade ?? false,
  });

  return {
    player: {
      hp: model.player.hp,
      maxHp: model.player.maxHp,
      gold: model.player.gold,
    },
    room: {
      title: model.room.title,
      body: model.room.body,
      guidance: model.room.guidance ?? (routeAdvice.primaryAction ? {
        routeTag: routeAdvice.preferredRouteTag,
        routeLabel: routeAdvice.preferredRouteLabel,
        headline: '优先执行当前路线收益最高的休整行动',
        reason: routeAdvice.actionHints[routeAdvice.primaryAction]?.reason ?? '路线已经形成，休整点应服务于后续关键战斗。',
        recommendedActionId: routeAdvice.primaryAction,
      } : null),
      canHeal: model.room.canHeal ?? false,
      healAmount: model.room.healAmount ?? Math.floor(model.player.maxHp * 0.3),
      canUpgrade: model.room.canUpgrade ?? false,
      canRemove: model.room.canRemove ?? false,
      canEnchant: model.room.canEnchant ?? false,
      canRelicUpgrade: model.room.canRelicUpgrade ?? false,
      cardRemovalCost: model.room.cardRemovalCost ?? 75,
      routeAdvice,
    },
  };
}

export function deriveEventSceneProps(model: RenderModel): EventSceneProps | null {
  if (model.screen !== 'Event' || !model.room) {
    return null;
  }

  return {
    room: {
      title: model.room.title,
      body: model.room.body,
      guidance: model.room.guidance ?? null,
      choices: model.room.choices ?? [],
    },
  };
}

export function deriveShopSceneProps(model: RenderModel): ShopSceneProps | null {
  if (model.screen !== 'Shop' || !model.room) {
    return null;
  }

  const shopCards = model.room.cards ?? [];
  const shopRelics = model.room.relics ?? [];
  const routeAdvice = buildShopRouteAdvice({
    characterId: model.player.characterId,
    deck: makeRuntimeDeck(model.player.deck),
    routeState: model.routeState ?? null,
    gold: model.player.gold,
    cardOffers: shopCards
      .map((offer) => {
        const card = makeRuntimeCard(offer.id, offer.id);
        return card ? { card, price: offer.price } : null;
      })
      .filter((entry): entry is { card: RunCardInstance; price: number } => !!entry),
    relicOffers: shopRelics.map((offer) => ({ relicId: offer.id, price: offer.price })),
    canUpgrade: true,
    canEnchant: model.room.canEnchant ?? false,
  });
  const primaryHint = routeAdvice.primaryHint;

  return {
    player: {
      gold: model.player.gold,
    },
    room: {
      title: model.room.title,
      body: model.room.body,
      guidance: model.room.guidance ?? (primaryHint ? {
        routeTag: primaryHint.routeTag,
        routeLabel: primaryHint.routeLabel,
        headline: '优先购买当前路线的直接补强',
        reason: primaryHint.reason,
        recommendedActionId: primaryHint.targetType,
        recommendedTargetId: primaryHint.targetId,
      } : null),
      cardCount: model.room.cardCount,
      relicCount: model.room.relicCount,
      potionStockCount: model.room.potionStockCount,
      canRemove: model.room.canRemove,
      canEnchant: model.room.canEnchant,
      cardRemovalCost: model.room.cardRemovalCost,
      cards: shopCards.map((card) => ({
        ...card,
        routeReason: routeAdvice.cardHints[card.id]?.reason,
        routeLabel: routeAdvice.cardHints[card.id]?.routeLabel,
        recommended: primaryHint?.targetType === 'card' && primaryHint.targetId === card.id,
      })),
      relics: shopRelics.map((relic) => ({
        ...relic,
        routeReason: routeAdvice.relicHints[relic.id]?.reason,
        routeLabel: routeAdvice.relicHints[relic.id]?.routeLabel,
        recommended: primaryHint?.targetType === 'relic' && primaryHint.targetId === relic.id,
      })),
      potions: model.room.potions ?? [],
      routeAdvice,
    },
  };
}

export function deriveCharacterSelectSceneProps(model: RenderModel): CharacterSelectSceneProps | null {
  if (model.screen !== 'CharacterSelect') {
    return null;
  }

  return {
    room: {
      title: model.room?.title,
      body: model.room?.body,
    },
  };
}

export function deriveSceneProps(model: RenderModel): SceneProps | null {
  const mapScene = deriveMapSceneProps(model);
  if (mapScene) {
    return { kind: 'map', props: mapScene };
  }

  const combatScene = deriveCombatSceneProps(model);
  if (combatScene) {
    return { kind: 'combat', props: combatScene };
  }

  const rewardScene = deriveRewardSceneProps(model);
  if (rewardScene) {
    return { kind: 'reward', props: rewardScene };
  }

  const restScene = deriveRestSceneProps(model);
  if (restScene) {
    return { kind: 'rest', props: restScene };
  }

  const eventScene = deriveEventSceneProps(model);
  if (eventScene) {
    return { kind: 'event', props: eventScene };
  }

  const shopScene = deriveShopSceneProps(model);
  if (shopScene) {
    return { kind: 'shop', props: shopScene };
  }

  const characterSelectScene = deriveCharacterSelectSceneProps(model);
  if (characterSelectScene) {
    return { kind: 'character_select', props: characterSelectScene };
  }

  return null;
}
