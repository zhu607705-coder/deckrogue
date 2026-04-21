import type { RenderModel, RuleSnapshot, RenderModelRoom, RenderModelRewardCard } from './contracts';
import { getStoryEventDef } from '@/content/narrative/numericSystem';

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

  if (snapshot.reward) {
    return {
      kind: 'reward',
      offerCount: snapshot.reward.cardIds.length,
    };
  }

  if (screen === 'Shop') {
    return {
      kind: 'shop',
    };
  }

  if (screen === 'Rest') {
    const healAmount = Math.floor(snapshot.player.maxHp * 0.3);
    return {
      kind: 'rest',
      title: '休整据点',
      body: '选择一项行动，恢复状态或整编你的牌库。',
      canHeal: snapshot.player.hp < snapshot.player.maxHp,
      healAmount,
      canUpgrade: true,
      canRemove: snapshot.player.gold >= 75,
      cardRemovalCost: 75,
    };
  }

  if (screen === 'Event') {
    const event = snapshot.activeEvent;
    if (event) {
      const eventDef = getStoryEventDef(event.id);
      if (eventDef) {
        const choices = eventDef.options.map((opt) => ({
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

  return null;
}

function deriveRewardCards(snapshot: RuleSnapshot): RenderModelRewardCard[] {
  if (!snapshot.reward) return [];

  return snapshot.reward.cardIds.map((cardId) => ({
    id: cardId,
    name: cardId.replace(/_/g, ' '),
    cost: 1,
    rarity: 'Common',
    type: 'Attack',
    description: `Card: ${cardId}`,
  }));
}

export function createRenderModel(snapshot: RuleSnapshot): RenderModel {
  const currentNode = snapshot.map.currentNodeId
    ? snapshot.map.nodes.find((node) => node.id === snapshot.map.currentNodeId) ?? null
    : null;

  const room = deriveRoom(snapshot);
  const rewardCards = deriveRewardCards(snapshot);

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
      deck: snapshot.player.deck,
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
    activeEvent: snapshot.activeEvent,
    room,
  };
}
