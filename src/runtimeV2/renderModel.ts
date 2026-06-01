/**
 * @file renderModel.ts
 * @description 从 RuleSnapshot 构建 RenderModel，为渲染层提供决策引导和房间数据
 *
 * 主要职责:
 * - 将规则层快照转换为渲染模型（玩家、地图、房间、战斗等）
 * - 推导地图可用节点与推荐路线
 * - 集成叙事内容服务获取事件描述与选择引导
 */
import type {
  RenderModel,
  RenderModelDecisionGuidance,
  RuleSnapshot,
  RenderModelRoom,
  RenderModelRewardCard,
} from '@/runtimeV2/contracts';
import {
  getCardEnchantmentDefById,
  getEventChoiceCommitTags,
  getEventChoiceRouteRole,
  getRouteTaxonomy,
  getStoryEventDef,
  relicsData,
} from '@/content/narrative/numericSystem';
import { calculateRestHealAmount } from '@/core/events/restHealing';
import { RELIC_UPGRADE_CONFIGS } from '@/core/relic/RelicUpgrade';
import { getContentService } from '@/runtimeV2/content/contentService';

function normalizeCardContentId(cardId: string): string {
  return cardId.replace(/[+*]+$/g, '');
}

function formatCardDisplayName(cardId: string, baseName: string): string {
  const normalizedId = normalizeCardContentId(cardId);
  const suffix = cardId.slice(normalizedId.length);
  const upgraded = suffix.includes('+') ? ' +' : '';
  const enchanted = suffix.includes('*') ? ' *' : '';
  return `${baseName}${upgraded}${enchanted}`;
}

function deriveAvailableNodeIds(snapshot: RuleSnapshot): string[] {
  if (!snapshot.map.currentNodeId) {
    return snapshot.map.nodes.filter((node) => node.revealed && node.y === 0).map((node) => node.id);
  }

  const currentNode = snapshot.map.nodes.find((node) => node.id === snapshot.map.currentNodeId);
  if (!currentNode) {
    return [];
  }

  const revealedNodeIds = new Set(snapshot.map.nodes.filter((node) => node.revealed).map((node) => node.id));
  const revealedSuccessors = currentNode.next.filter((nodeId) => revealedNodeIds.has(nodeId));
  return revealedSuccessors.length > 0 ? revealedSuccessors : currentNode.next;
}

function deriveRoom(snapshot: RuleSnapshot): RenderModelRoom | null {
  const screen = snapshot.lifecycle.screen;
  const contentService = getContentService();
  const makeRouteGuidance = (
    headline: string,
    reason: string,
    recommendedActionId?: string | null,
    recommendedTargetId?: string | null,
  ): RenderModelDecisionGuidance | null => {
    const routeTag = snapshot.routeState?.primaryTag ?? null;
    const routeLabel = routeTag ? getRouteTaxonomy(routeTag)?.label ?? routeTag : null;
    if (!routeTag && !reason) return null;
    return {
      routeTag,
      routeLabel,
      headline,
      reason,
      recommendedActionId,
      recommendedTargetId,
    };
  };
  const toCamelRelicKey = (relicId: string) => relicId.replace(/_([a-z])/g, (_, chr: string) => chr.toUpperCase());
  const getRelicState = (relicId: string) => snapshot.player.relicStates?.[relicId] ?? snapshot.player.relicStates?.[toCamelRelicKey(relicId)];
  const isUpgradeableRelic = (relicId: string) => {
    const config = RELIC_UPGRADE_CONFIGS.find((entry) => entry.relicId === relicId);
    if (!config) return false;
    const currentLevel = getRelicState(relicId)?.level ?? 1;
    return config.levels.some((level) => level.level === currentLevel + 1);
  };
  const deriveDeckSurfaceChoices = (
    includeCard?: (entry: { cardId: string; normalizedCardId: string; cardData: ReturnType<typeof contentService.getCard> }) => boolean,
  ) => snapshot.player.deck.flatMap((cardId, index) => {
    const normalizedCardId = normalizeCardContentId(cardId);
    const cardData = contentService.getCard(normalizedCardId);
    if (includeCard && !includeCard({ cardId, normalizedCardId, cardData })) {
      return [];
    }
    return [{
      id: `${index}:${cardId}`,
      label: cardData?.name ? formatCardDisplayName(cardId, cardData.name) : cardId.replace(/_/g, ' '),
      description: cardData?.text,
      disabled: false,
    }];
  });
  const isUpgradeTarget = ({ cardId, cardData }: { cardId: string; cardData: ReturnType<typeof contentService.getCard> }) =>
    !!cardData?.upgrade && !cardId.includes('+');
  const isEnchantTarget = ({ cardId, cardData }: { cardId: string; cardData: ReturnType<typeof contentService.getCard> }) => {
    if (!cardData || cardId.includes('*')) return false;
    if (cardData.type !== 'Attack' && cardData.type !== 'Skill') return false;
    const enchantment = snapshot.surfaceContext?.enchantContext?.enchantmentId
      ? getCardEnchantmentDefById(snapshot.surfaceContext.enchantContext.enchantmentId) as { applicableTo?: Array<'Attack' | 'Skill'> } | undefined
      : undefined;
    const applicableTo = enchantment?.applicableTo;
    return !applicableTo?.length || applicableTo.includes(cardData.type);
  };

  if (snapshot.reward) {
    return {
      kind: 'reward',
      offerCount: snapshot.reward.cardIds.length,
    };
  }

  if (screen === 'Shop') {
    const canUpgrade = snapshot.player.gold >= 50 && deriveDeckSurfaceChoices(isUpgradeTarget).length > 0;
    const canEnchant = deriveDeckSurfaceChoices(isEnchantTarget).length > 0;
    const shopCards = (snapshot.shop?.cards ?? []).map((offer) => {
      const cardData = contentService.getCard(offer.id);
      return {
        id: offer.id,
        name: cardData?.name || offer.id.replace(/_/g, ' '),
        price: offer.price,
        rarity: cardData?.rarity,
        type: cardData?.type,
        description: cardData?.text,
      };
    });
    const shopRelics = (snapshot.shop?.relics ?? []).map((offer) => {
      const relicData = contentService.getRelic(offer.id);
      return {
        id: offer.id,
        name: relicData?.name || offer.id.replace(/_/g, ' '),
        price: offer.price,
        rarity: relicData?.rarity,
        type: 'Relic',
        description: relicData?.description,
      };
    });
    const shopPotions = (snapshot.shop?.potions ?? []).map((offer) => {
      const potionData = contentService.getPotion(offer.id);
      return {
        id: offer.id,
        name: potionData?.name || offer.id.replace(/_/g, ' '),
        price: offer.price,
        rarity: potionData?.rarity,
        type: 'Potion',
        description: potionData?.description,
      };
    });
    return {
      kind: 'shop',
      title: '黑市据点',
      body: '浏览补给、移除卡牌，或整理这轮路线资源。',
      guidance: makeRouteGuidance(
        snapshot.routeState?.primaryTag ? '按当前路线优先买关键补强' : '先寻找能定义路线的补强',
        snapshot.routeState?.primaryTag
          ? '优先选择能强化当前路线的卡牌、遗物或服务；预算不足时保留金币给后续关键节点。'
          : '路线尚未稳定，优先选择泛用强牌或能打开新路线的低风险补给。',
      ),
      cardCount: snapshot.shop?.cards.length ?? 0,
      relicCount: snapshot.shop?.relics.length ?? 0,
      potionStockCount: snapshot.shop?.potions.length ?? 0,
      canUpgrade,
      canRemove: snapshot.player.gold >= (snapshot.shop?.cardRemovalCost ?? 75) && snapshot.player.deck.length > 0,
      canEnchant,
      cardRemovalCost: snapshot.shop?.cardRemovalCost ?? 75,
      cards: shopCards,
      relics: shopRelics,
      potions: shopPotions,
    };
  }

  if (screen === 'Rest') {
    const healAmount = calculateRestHealAmount(snapshot.player.maxHp);
    const canUpgrade = deriveDeckSurfaceChoices(isUpgradeTarget).length > 0;
    const canEnchant = deriveDeckSurfaceChoices(isEnchantTarget).length > 0;
    const restPotions = snapshot.player.potionIds.map((potionId) => {
      const potionData = contentService.getPotion(potionId);
      return {
        id: potionId,
        name: potionData?.name || potionId.replace(/_/g, ' '),
        price: potionData?.price ?? 0,
        rarity: potionData?.rarity,
        type: 'Potion',
        description: potionData?.description,
      };
    });
    return {
      kind: 'rest',
      title: '休整据点',
      body: '选择一项行动，恢复状态或整编你的牌库。',
      guidance: makeRouteGuidance(
        snapshot.player.hp / Math.max(1, snapshot.player.maxHp) < 0.45 ? '生命偏低，优先保住推进节奏' : '用休整点强化路线核心',
        '如果已有路线核心牌，优先强化或附魔；生命低于安全线时先恢复。',
      ),
      canHeal: snapshot.player.hp < snapshot.player.maxHp,
      healAmount,
      canUpgrade,
      canRemove: snapshot.player.gold >= 75 && snapshot.player.deck.length > 0,
      canEnchant,
      canRelicUpgrade: snapshot.player.relicIds.some((relicId) => isUpgradeableRelic(relicId)),
      canMix: snapshot.player.potionIds.length >= 2,
      cardRemovalCost: 75,
      potions: restPotions,
    };
  }

  if (screen === 'Event') {
    const event = snapshot.activeEvent;
    if (event) {
      const eventDef = getStoryEventDef(event.id);
      if (eventDef) {
        const offeredRelicIds = event.stage === 'generic_relic_choice' && Array.isArray(event.data?.offeredRelicIds)
          ? event.data.offeredRelicIds.map(String)
          : [];
        const choices = offeredRelicIds.length > 0
          ? offeredRelicIds.map((relicId) => {
              const relic = relicsData.find((entry) => entry.id === relicId);
              return {
                id: `generic_relic:${relicId}`,
                label: `[选择] ${relic?.name ?? relicId}`,
                description: relic?.description ?? relicId,
                disabled: false,
              };
            })
          : eventDef.options.map((opt) => {
          const routeRole = getEventChoiceRouteRole(event.id, opt.id) ?? undefined;
          const routeTags = getEventChoiceCommitTags(event.id, opt.id);
          const routeLabel = routeTags[0] ? getRouteTaxonomy(routeTags[0])?.label ?? routeTags[0] : undefined;
          return {
            id: opt.id,
            label: opt.text,
            description: opt.description,
            disabled: false,
            routeRole,
            routeLabel,
            routeReason: routeRole && routeLabel ? `${routeLabel} · ${routeRole}` : undefined,
          };
        });
        const body = eventDef.loreText.join('\n\n');
        return {
          kind: 'event',
          title: eventDef.title,
          body,
          guidance: makeRouteGuidance(
            '按事件收益与当前路线匹配度选择',
            '事件选项会改变资源、路线承诺或后续风险；优先看路线标签与成本。',
          ),
          choices,
        };
      }
      return {
        kind: 'event',
        title: event.id,
        body: `事件：${event.id}${event.stage ? `（阶段：${event.stage}）` : ''}`,
        choices: [{ id: 'continue', label: '继续', disabled: false }],
      };
    }
    return {
      kind: 'event',
      title: '未知事件',
      body: '一场未记录的遭遇挡住了你的去路。',
      guidance: makeRouteGuidance('事件信息不足，选择低风险推进', '缺少事件定义时不要把它当作路线承诺点。'),
      choices: [
        { id: 'continue', label: '继续', disabled: false },
      ],
    };
  }

  if (screen === 'Combat') {
    return {
      kind: 'combat',
    };
  }

  if (screen === 'CharacterSelect') {
    return {
      kind: 'character_select',
      title: '选择执行体',
      body: '选择一名执行体，开始本次战区远征。',
    };
  }

  if (screen === 'Upgrade') {
    return {
      kind: 'upgrade',
      title: '牌库强化',
      body: '选择一张牌完成强化，或取消返回上一层。',
      choices: deriveDeckSurfaceChoices(isUpgradeTarget),
    };
  }

  if (screen === 'RemoveCard') {
    const cardRemovalCost = snapshot.surfaceContext?.isEventFreeCardRemovalMode ? 0 : snapshot.shop?.cardRemovalCost ?? 75;
    return {
      kind: 'remove_card',
      title: snapshot.surfaceContext?.isEventFreeCardRemovalMode ? '事件献祭' : '移除卡牌',
      body: snapshot.surfaceContext?.isEventFreeCardRemovalMode
        ? '当前移除来自事件效果，不会消耗金币。'
        : '选择一张牌移除，或取消返回上一层。',
      cardRemovalCost,
      choices: deriveDeckSurfaceChoices(),
    };
  }

  if (screen === 'Enchant') {
    return {
      kind: 'enchant',
      title: snapshot.surfaceContext?.enchantContext?.title ?? '附魔',
      body: snapshot.surfaceContext?.enchantContext?.description ?? '选择一张牌施加永久附魔。',
      choices: deriveDeckSurfaceChoices(isEnchantTarget),
    };
  }

  if (screen === 'RelicUpgrade') {
    const relicChoices = snapshot.player.relicIds
      .filter((relicId) => isUpgradeableRelic(relicId))
      .map((relicId) => {
        const relicData = contentService.getRelic(relicId);
        const relicLevel = getRelicState(relicId)?.level ?? 1;
        return {
          id: relicId,
          label: relicData?.name ? `${relicData.name} Lv.${relicLevel}` : relicId,
          description: relicData?.description,
          disabled: false,
        };
      });
    return {
      kind: 'relic_upgrade',
      title: '遗物升级',
      body: '选择一件受污染遗物进行净化强化。',
      choices: relicChoices,
    };
  }

  if (screen === 'Victory') {
    return {
      kind: 'victory',
      title: '胜利',
      body: '本次远征已经完成，可以从这里开始新的运行。',
    };
  }

  if (screen === 'GameOver') {
    return {
      kind: 'game_over',
      title: '远征失败',
      body: '当前运行已结束，可以重开或切回其他入口。',
    };
  }

  return null;
}

function deriveRewardCards(snapshot: RuleSnapshot): RenderModelRewardCard[] {
  if (!snapshot.reward) return [];
  const contentService = getContentService();

  return snapshot.reward.cardIds.map((cardId) => {
    const normalizedCardId = normalizeCardContentId(cardId);
    const cardData = contentService.getCard(normalizedCardId);
    return {
      id: cardId,
      name: cardData?.name ? formatCardDisplayName(cardId, cardData.name) : cardId.replace(/_/g, ' '),
      cost: cardData?.cost ?? 1,
      rarity: cardData?.rarity || 'Common',
      type: cardData?.type || 'Attack',
      description: cardData?.text || `Card: ${cardId}`,
    };
  });
}

function derivePlayerEnergy(snapshot: RuleSnapshot): { energy: number; maxEnergy: number } {
  const contentService = getContentService();
  const characterMaxEnergy = snapshot.player.characterId
    ? contentService.getCharacter(snapshot.player.characterId)?.maxEnergy
    : undefined;
  const maxEnergy = Math.max(0, Math.floor(Number(characterMaxEnergy ?? snapshot.combat?.playerEnergy ?? 0)));
  const energy = snapshot.combat
    ? Math.max(0, Math.floor(Number(snapshot.combat.playerEnergy) || 0))
    : maxEnergy;

  return {
    energy,
    maxEnergy,
  };
}

export function createRenderModel(snapshot: RuleSnapshot): RenderModel {
  const currentNode = snapshot.map.currentNodeId
    ? snapshot.map.nodes.find((node) => node.id === snapshot.map.currentNodeId) ?? null
    : null;

  const room = deriveRoom(snapshot);
  const rewardCards = deriveRewardCards(snapshot);
  const playerEnergy = derivePlayerEnergy(snapshot);

  return {
    screen: snapshot.lifecycle.screen,
    lifecycle: snapshot.lifecycle,
    player: {
      characterId: snapshot.player.characterId,
      hp: snapshot.player.hp,
      maxHp: snapshot.player.maxHp,
      gold: snapshot.player.gold,
      intel: snapshot.player.intel,
      devotion: snapshot.player.devotion,
      corruption: snapshot.player.corruption,
      energy: playerEnergy.energy,
      maxEnergy: playerEnergy.maxEnergy,
      secondaryResources: snapshot.player.secondaryResources,
      timeLayer: snapshot.player.timeLayer,
      thread: snapshot.player.thread,
      concoction: snapshot.player.concoction,
      deck: snapshot.player.deck,
      potionIds: snapshot.player.potionIds,
      deckCount: snapshot.player.deck.length,
      relicCount: snapshot.player.relicIds.length,
      potionCount: snapshot.player.potionIds.length,
      healthRatio: snapshot.player.maxHp > 0 ? snapshot.player.hp / snapshot.player.maxHp : 0,
    },
    map: {
      currentNodeId: snapshot.map.currentNodeId,
      nodes: snapshot.map.nodes,
      currentFloor: currentNode ? currentNode.y + 1 : null,
      revealedNodeIds: snapshot.map.nodes.filter((node) => node.revealed).map((node) => node.id),
      availableNodeIds: deriveAvailableNodeIds(snapshot),
    },
    combat: snapshot.combat
      ? {
          ...snapshot.combat,
          enemyCount: snapshot.combat.enemies.length,
        }
      : null,
    reward: snapshot.reward
      ? {
          ...snapshot.reward,
          offerCount: snapshot.reward.cardIds.length,
          cards: rewardCards,
        }
      : null,
    shop: snapshot.shop ?? null,
    activeEvent: snapshot.activeEvent,
    routeState: snapshot.routeState ?? null,
    room,
  };
}
