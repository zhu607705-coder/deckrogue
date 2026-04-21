import type { RenderModel } from './contracts';

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
    drawPileCount: number;
    discardPileCount: number;
  };
  room: {
    title?: string;
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
    }>;
    source: string;
  };
  room: {
    title?: string;
    body?: string;
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
    canHeal: boolean;
    healAmount: number;
    canUpgrade: boolean;
    canRemove: boolean;
    cardRemovalCost: number;
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
    }>;
  };
}

export interface ShopSceneProps {
  player: {
    gold: number;
  };
  room: {
    title?: string;
    body?: string;
    cardCount?: number;
    relicCount?: number;
    potionStockCount?: number;
    canRemove?: boolean;
    cardRemovalCost?: number;
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

export function deriveMapSceneProps(model: RenderModel): MapSceneProps | null {
  if (model.screen !== 'Map') {
    return null;
  }

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
    },
  };
}

export function deriveCombatSceneProps(model: RenderModel): CombatSceneProps | null {
  if (model.screen !== 'Combat' || !model.combat) {
    return null;
  }

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
      drawPileCount: model.combat.drawPileCount,
      discardPileCount: model.combat.discardPileCount,
    },
    room: {
      title: model.room?.title,
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

  return {
    player: {
      hp: model.player.hp,
      maxHp: model.player.maxHp,
      gold: model.player.gold,
    },
    reward: {
      cards,
      source: model.reward.source,
    },
    room: {
      title: model.room?.title,
      body: model.room?.body,
    },
  };
}

export function deriveRestSceneProps(model: RenderModel): RestSceneProps | null {
  if (model.screen !== 'Rest' || !model.room) {
    return null;
  }

  return {
    player: {
      hp: model.player.hp,
      maxHp: model.player.maxHp,
      gold: model.player.gold,
    },
    room: {
      title: model.room.title,
      body: model.room.body,
      canHeal: model.room.canHeal ?? false,
      healAmount: model.room.healAmount ?? Math.floor(model.player.maxHp * 0.3),
      canUpgrade: model.room.canUpgrade ?? false,
      canRemove: model.room.canRemove ?? false,
      cardRemovalCost: model.room.cardRemovalCost ?? 75,
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
      choices: model.room.choices ?? [],
    },
  };
}

export function deriveShopSceneProps(model: RenderModel): ShopSceneProps | null {
  if (model.screen !== 'Shop' || !model.room) {
    return null;
  }

  return {
    player: {
      gold: model.player.gold,
    },
    room: {
      title: model.room.title,
      body: model.room.body,
      cardCount: model.room.cardCount,
      relicCount: model.room.relicCount,
      potionStockCount: model.room.potionStockCount,
      canRemove: model.room.canRemove,
      cardRemovalCost: model.room.cardRemovalCost,
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
