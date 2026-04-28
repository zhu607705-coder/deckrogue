/**
 * @file uiModelConverter.ts
 * @description 将规则层 RuleSnapshot 转换为 UI 层 UIModel 的转换器
 *
 * 主要职责:
 * - 将 RuleSnapshot 映射为 UIModel 各子模型（玩家、地图、房间、战斗等）
 * - 处理卡牌、遗物、药水等实体的 UI 展示转换
 * - 推导地图可用节点与推荐路线
 */
import type { RuleSnapshot } from './contracts';
import type { UIModel, UICard, UIPlayerModel, UIMapModel, UIRoomModel, UICombatModel, UIRewardModel, UIEventModel, UINotification, UIRoomChoice } from './uiModel';
import { getContentService } from './content/contentService';
import { localCardArt } from '@/content/assets/standeeArt';
import { getStoryEventDef } from '@/content/narrative/numericSystem';

const DEFAULT_MAX_ENERGY = 3;
const DEFAULT_CARD_REMOVAL_COST = 75;
const REST_HEAL_RATIO = 0.3;

interface ConvertCardData {
  id: string;
  name?: string;
  cost?: number;
  rarity?: string;
  type?: string;
  text?: string;
  art_prompt?: string;
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

export class UIModelConverter {
  convert(snapshot: RuleSnapshot): UIModel {
    return {
      screen: snapshot.lifecycle.screen,
      player: this.convertPlayer(snapshot),
      map: this.convertMap(snapshot),
      room: this.convertRoom(snapshot),
      combat: snapshot.combat ? this.convertCombat(snapshot) : null,
      reward: snapshot.reward ? this.convertReward(snapshot) : null,
      activeEvent: snapshot.activeEvent ? this.convertEvent(snapshot) : null,
      notifications: [],
    };
  }

  private convertPlayer(snapshot: RuleSnapshot): UIPlayerModel {
    return {
      characterId: snapshot.player.characterId,
      hp: snapshot.player.hp,
      maxHp: snapshot.player.maxHp,
      gold: snapshot.player.gold,
      intel: snapshot.player.intel,
      devotion: snapshot.player.devotion,
      corruption: snapshot.player.corruption,
      deckCount: snapshot.player.deck.length,
      relicCount: snapshot.player.relicIds.length,
      potionCount: snapshot.player.potionIds.length,
      healthRatio: snapshot.player.maxHp > 0 ? snapshot.player.hp / snapshot.player.maxHp : 0,
      statusEffects: [],
    };
  }

  private convertMap(snapshot: RuleSnapshot): UIMapModel {
    const currentNode = snapshot.map.currentNodeId
      ? snapshot.map.nodes.find((node) => node.id === snapshot.map.currentNodeId) ?? null
      : null;

    return {
      currentNodeId: snapshot.map.currentNodeId,
      nodes: snapshot.map.nodes.map(node => ({
        id: node.id,
        type: node.type,
        x: node.x,
        y: node.y,
        revealed: node.revealed,
        next: node.next,
      })),
      currentFloor: currentNode ? currentNode.y + 1 : null,
      revealedNodeIds: snapshot.map.nodes.filter((node) => node.revealed).map((node) => node.id),
      availableNodeIds: deriveAvailableNodeIds(snapshot),
      pathProgress: currentNode ? currentNode.y : 0,
    };
  }

  private convertRewardRoom(snapshot: RuleSnapshot): UIRoomModel {
    return {
      kind: 'reward',
      title: '奖励',
      body: `选择一张卡牌加入牌库（${snapshot.reward!.cardIds.length} 张可选）`,
      choices: [],
      metadata: { source: snapshot.reward!.source },
    };
  }

  private convertShopRoom(): UIRoomModel {
    return {
      kind: 'shop',
      title: '黑市据点',
      body: '购买卡牌、遗物或药水，或支付金币移除牌库中的卡牌。',
      choices: [],
      metadata: { canRemove: true, cardRemovalCost: DEFAULT_CARD_REMOVAL_COST },
    };
  }

  private convertRestRoom(snapshot: RuleSnapshot): UIRoomModel {
    const healAmount = Math.floor(snapshot.player.maxHp * REST_HEAL_RATIO);
    const canHeal = snapshot.player.hp < snapshot.player.maxHp;
    const canRemove = snapshot.player.gold >= DEFAULT_CARD_REMOVAL_COST;
    return {
      kind: 'rest',
      title: '休整据点',
      body: '选择一项行动，恢复状态或整编你的牌库。',
      choices: [
        { id: 'rest', label: '休息', description: `回复 ${healAmount} 点生命值`, disabled: !canHeal },
        { id: 'upgrade', label: '强化', description: '选择一张卡牌进行强化' },
        { id: 'remove', label: '移除', description: `支付 ${DEFAULT_CARD_REMOVAL_COST} 金币移除一张卡牌`, disabled: !canRemove },
      ],
      metadata: { healAmount, canHeal, canRemove, cardRemovalCost: DEFAULT_CARD_REMOVAL_COST },
    };
  }

  private convertEventRoom(snapshot: RuleSnapshot): UIRoomModel {
    const event = snapshot.activeEvent;
    if (!event) {
      return {
        kind: 'event',
        title: '未知事件',
        body: '一场未记录的遭遇挡住了你的去路。',
        choices: [{ id: 'continue', label: '继续', disabled: false }],
        metadata: {},
      };
    }

    const eventDef = getStoryEventDef(event.id);
    if (eventDef) {
      const choices: UIRoomChoice[] = eventDef.options.map((opt) => ({
        id: opt.id,
        label: opt.text,
        description: opt.description,
        disabled: false,
      }));
      const body = eventDef.loreText.join('\n\n');
      return {
        kind: 'event',
        title: eventDef.title,
        body,
        choices,
        metadata: { eventId: event.id },
      };
    }

    return {
      kind: 'event',
      title: event.id,
      body: `事件：${event.id}${event.stage ? `（阶段：${event.stage}）` : ''}`,
      choices: [{ id: 'continue', label: '继续', disabled: false }],
      metadata: { eventId: event.id },
    };
  }

  private convertCombatRoom(): UIRoomModel {
    return {
      kind: 'combat',
      title: '战斗',
      body: '击败所有敌人。',
      choices: [],
      metadata: {},
    };
  }

  private convertCharacterSelectRoom(): UIRoomModel {
    const contentService = getContentService();
    return {
      kind: 'character_select',
      title: '选择执行体',
      body: '选择一名执行体，开始本次战区远征。',
      choices: contentService.getAllCharacters().map(c => ({
        id: c.id,
        label: c.name,
        description: c.description || '',
        disabled: false,
      })),
      metadata: {},
    };
  }

  private convertUpgradeRoom(): UIRoomModel {
    return {
      kind: 'upgrade',
      title: '牌库强化',
      body: '运行时 V2 已接入强化界面，可直接触发升级动作。',
      choices: [{ id: 'upgrade', label: '强化', disabled: false }],
      metadata: {},
    };
  }

  private convertRemoveCardRoom(snapshot: RuleSnapshot): UIRoomModel {
    const freeRemoval = !!snapshot.surfaceContext?.isEventFreeCardRemovalMode;
    return {
      kind: 'remove_card',
      title: freeRemoval ? '事件献祭' : '移除卡牌',
      body: freeRemoval ? '当前移除来自事件效果，不会消耗金币。' : '运行时 V2 已接入移除动作，可直接处理一张牌。',
      choices: [{ id: 'remove', label: '移除', disabled: snapshot.player.deck.length === 0 }],
      metadata: {
        freeRemoval,
        cardRemovalCost: freeRemoval ? 0 : DEFAULT_CARD_REMOVAL_COST,
      },
    };
  }

  private convertEnchantRoom(snapshot: RuleSnapshot): UIRoomModel {
    return {
      kind: 'enchant',
      title: snapshot.surfaceContext?.enchantContext?.title ?? '附魔',
      body: snapshot.surfaceContext?.enchantContext?.description ?? '当前运行时已接入附魔界面展示。',
      choices: [],
      metadata: {},
    };
  }

  private convertRelicUpgradeRoom(): UIRoomModel {
    return {
      kind: 'relic_upgrade',
      title: '遗物升级',
      body: '当前运行时已接入遗物升级界面展示。',
      choices: [],
      metadata: {},
    };
  }

  private convertTerminalRoom(screen: RuleSnapshot['lifecycle']['screen']): UIRoomModel {
    return {
      kind: screen === 'Victory' ? 'victory' : 'game_over',
      title: screen === 'Victory' ? '胜利' : '远征失败',
      body: screen === 'Victory' ? '本次远征已经完成，可以从这里开始新的运行。' : '当前运行已结束，可以重开或切回其他入口。',
      choices: [],
      metadata: {},
    };
  }

  private convertRoom(snapshot: RuleSnapshot): UIRoomModel | null {
    const screen = snapshot.lifecycle.screen;

    if (snapshot.reward) {
      return this.convertRewardRoom(snapshot);
    }

    if (screen === 'Shop') {
      return this.convertShopRoom();
    }

    if (screen === 'Rest') {
      return this.convertRestRoom(snapshot);
    }

    if (screen === 'Event') {
      return this.convertEventRoom(snapshot);
    }

    if (screen === 'Combat') {
      return this.convertCombatRoom();
    }

    if (screen === 'CharacterSelect') {
      return this.convertCharacterSelectRoom();
    }

    if (screen === 'Upgrade') {
      return this.convertUpgradeRoom();
    }

    if (screen === 'RemoveCard') {
      return this.convertRemoveCardRoom(snapshot);
    }

    if (screen === 'Enchant') {
      return this.convertEnchantRoom(snapshot);
    }

    if (screen === 'RelicUpgrade') {
      return this.convertRelicUpgradeRoom();
    }

    if (screen === 'Victory' || screen === 'GameOver') {
      return this.convertTerminalRoom(screen);
    }

    return null;
  }

  private convertCombat(snapshot: RuleSnapshot): UICombatModel | null {
    if (!snapshot.combat) return null;

    const contentService = getContentService();
    const hand: UICard[] = snapshot.combat.hand.map(cardId => {
      const cardData = contentService.getCard(cardId);
      return this.convertCard(cardId, cardData);
    });

    const enemies = snapshot.combat.enemies.map(enemy => {
      const enemyData = contentService.getEnemy(enemy.defId);
      return {
        id: enemy.id,
        defId: enemy.defId,
        name: enemyData?.name || enemy.defId,
        hp: enemy.hp,
        maxHp: enemy.maxHp,
        block: enemy.block,
        nextIntent: enemy.nextIntent,
      };
    });

    return {
      turn: snapshot.combat.turn,
      isPlayerTurn: snapshot.combat.isPlayerTurn,
      player: {
        hp: snapshot.player.hp,
        maxHp: snapshot.player.maxHp,
        block: snapshot.combat.playerBlock,
        energy: snapshot.combat.playerEnergy,
        maxEnergy: DEFAULT_MAX_ENERGY,
      },
      enemies,
      hand,
      drawPileCount: snapshot.combat.drawPileCount,
      discardPileCount: snapshot.combat.discardPileCount,
    };
  }

  private convertReward(snapshot: RuleSnapshot): UIRewardModel | null {
    if (!snapshot.reward) return null;

    const contentService = getContentService();
    const cards: UICard[] = snapshot.reward.cardIds.map(cardId => {
      const cardData = contentService.getCard(cardId);
      return this.convertCard(cardId, cardData);
    });

    return {
      cards,
      gold: 0,
      relics: [],
      potions: [],
      source: snapshot.reward.source,
    };
  }

  private convertEvent(snapshot: RuleSnapshot): UIEventModel | null {
    if (!snapshot.activeEvent) return null;

    return {
      id: snapshot.activeEvent.id,
      stage: snapshot.activeEvent.stage,
      data: snapshot.activeEvent.data,
    };
  }

  private convertCard(cardId: string, cardData: ConvertCardData | undefined): UICard {
    return {
      id: cardId,
      name: cardData?.name || cardId.replace(/_/g, ' '),
      cost: cardData?.cost ?? 1,
      rarity: cardData?.rarity || 'Common',
      type: cardData?.type || 'Attack',
      description: cardData?.text || `Card: ${cardId}`,
      imageUrl: cardData?.art_prompt ? localCardArt(cardId) : undefined,
      isUpgraded: false,
    };
  }
}

let globalConverter: UIModelConverter | null = null;

export function getUIModelConverter(): UIModelConverter {
  if (!globalConverter) {
    globalConverter = new UIModelConverter();
  }
  return globalConverter;
}

export function convertToUIModel(snapshot: RuleSnapshot): UIModel {
  return getUIModelConverter().convert(snapshot);
}
