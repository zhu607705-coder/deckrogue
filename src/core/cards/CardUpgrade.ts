import type { ActionSpec, CardDef } from '@/core/types/actions';

export interface CardUpgradeConfig {
  cardId: string;
  upgrades: {
    damage?: number;
    cost?: number;
    block?: number;
    addKeyword?: string[];
    addEffect?: CardEffect;
    upgradeDescription?: string;
  };
}

export interface CardEffect {
  type: string;
  amount?: number;
  target?: string;
  status?: string;
  condition?: string;
  trueActions?: ActionSpec[];
  falseActions?: ActionSpec[];
  [key: string]: unknown;
}

export interface UpgradedCard {
  originalCard: CardDef;
  upgradedCard: CardDef;
  upgrade: CardUpgradeConfig;
  isUpgraded: boolean;
}

interface UpgradeRegistry {
  [cardId: string]: CardUpgradeConfig;
}

const upgradeRegistry: UpgradeRegistry = {};

export function registerUpgrade(upgrade: CardUpgradeConfig): void {
  upgradeRegistry[upgrade.cardId] = upgrade;
}

export function unregisterUpgrade(cardId: string): void {
  delete upgradeRegistry[cardId];
}

export function getUpgradeRegistry(): UpgradeRegistry {
  return { ...upgradeRegistry };
}

export function clearUpgradeRegistry(): void {
  Object.keys(upgradeRegistry).forEach((key) => {
    delete upgradeRegistry[key];
  });
}

export function upgradeCard(card: CardDef): UpgradedCard {
  const upgrade = getUpgradeEffect(card.id);
  if (!upgrade) {
    return {
      originalCard: card,
      upgradedCard: card,
      upgrade: { cardId: card.id, upgrades: {} },
      isUpgraded: false,
    };
  }

  const upgradedCard = applyUpgradeToCard(card, upgrade);
  return {
    originalCard: card,
    upgradedCard,
    upgrade,
    isUpgraded: true,
  };
}

export function getUpgradeEffect(cardId: string): CardUpgradeConfig | null {
  return upgradeRegistry[cardId] || null;
}

export function canUpgrade(card: CardDef): boolean {
  if (card.isUpgraded) {
    return false;
  }
  const upgrade = getUpgradeEffect(card.id);
  return upgrade !== null;
}

export function getUpgradeDescription(cardId: string): string {
  const upgrade = getUpgradeEffect(cardId);
  if (!upgrade) {
    return '';
  }

  const { upgrades } = upgrade;
  const parts: string[] = [];

  if (upgrades.damage !== undefined) {
    const sign = upgrades.damage > 0 ? '+' : '';
    parts.push(`${sign}${upgrades.damage} 伤害`);
  }

  if (upgrades.cost !== undefined) {
    const sign = upgrades.cost > 0 ? '+' : '';
    parts.push(`${sign}${upgrades.cost} 费用`);
  }

  if (upgrades.block !== undefined) {
    const sign = upgrades.block > 0 ? '+' : '';
    parts.push(`${sign}${upgrades.block} 护盾`);
  }

  if (upgrades.addKeyword && upgrades.addKeyword.length > 0) {
    parts.push(`获得: ${upgrades.addKeyword.join(', ')}`);
  }

  if (upgrades.upgradeDescription) {
    parts.push(upgrades.upgradeDescription);
  }

  return parts.join(' | ');
}

function updateDamageInActions(actions: ActionSpec[], newDamage: number): ActionSpec[] {
  return actions.map((action) => {
    if (action.type === 'DealDamage' && action.amount !== undefined) {
      return { ...action, amount: newDamage };
    }

    const updatedAction = { ...action };
    if (updatedAction.trueActions) {
      updatedAction.trueActions = updateDamageInActions(updatedAction.trueActions, newDamage);
    }
    if (updatedAction.falseActions) {
      updatedAction.falseActions = updateDamageInActions(updatedAction.falseActions, newDamage);
    }

    return updatedAction;
  });
}

function updateBlockInActions(actions: ActionSpec[], newBlock: number): ActionSpec[] {
  return actions.map((action) => {
    if (action.type === 'GainBlock' && action.amount !== undefined) {
      return { ...action, amount: newBlock };
    }

    const updatedAction = { ...action };
    if (updatedAction.trueActions) {
      updatedAction.trueActions = updateBlockInActions(updatedAction.trueActions, newBlock);
    }
    if (updatedAction.falseActions) {
      updatedAction.falseActions = updateBlockInActions(updatedAction.falseActions, newBlock);
    }

    return updatedAction;
  });
}

export function applyUpgradeToCard(card: CardDef, upgrade: CardUpgradeConfig): CardDef {
  const { upgrades } = upgrade;

  const upgradedCard: CardDef = { ...card };

  if (upgrades.damage !== undefined) {
    upgradedCard.actions = updateDamageInActions(upgradedCard.actions, upgrades.damage);
  }

  if (upgrades.block !== undefined) {
    upgradedCard.actions = updateBlockInActions(upgradedCard.actions, upgrades.block);
  }

  if (upgrades.cost !== undefined) {
    upgradedCard.cost = upgrades.cost;
  }

  if (upgrades.addKeyword && upgrades.addKeyword.length > 0) {
    upgradedCard.tags = [...new Set([...upgradedCard.tags, ...upgrades.addKeyword])];
  }

  if (upgrades.addEffect) {
    const effectAction = mapEffectToAction(upgrades.addEffect);
    if (effectAction) {
      upgradedCard.actions = [...upgradedCard.actions, effectAction];
    }
  }

  if (upgrades.upgradeDescription) {
    upgradedCard.text = `${upgradedCard.text} (升级: ${upgrades.upgradeDescription})`;
  }

  upgradedCard.isUpgraded = true;

  return upgradedCard;
}

function mapEffectToAction(effect: CardEffect): ActionSpec | null {
  switch (effect.type) {
    case 'DealDamage':
      return {
        type: 'DealDamage',
        amount: effect.amount,
        target: effect.target as any,
      };
    case 'GainBlock':
      return {
        type: 'GainBlock',
        amount: effect.amount,
        target: effect.target as any,
      };
    case 'ApplyStatus':
      return {
        type: 'ApplyStatus',
        status: effect.status,
        amount: effect.amount,
        target: effect.target as any,
      };
    case 'Draw':
      return {
        type: 'Draw',
        amount: effect.amount,
        target: effect.target as any,
      };
    default:
      return null;
  }
}

export function loadUpgradesFromCardsJson(cards: CardDef[]): void {
  cards.forEach((card) => {
    if (card.upgrade && !card.isUpgraded) {
      const config = convertCardUpgradeToConfig(card);
      if (config) {
        registerUpgrade(config);
      }
    }
  });
}

function convertCardUpgradeToConfig(card: CardDef): CardUpgradeConfig | null {
  if (!card.upgrade) {
    return null;
  }

  const upgrade: CardUpgradeConfig = {
    cardId: card.id,
    upgrades: {},
  };

  if (card.upgrade.cost !== undefined) {
    upgrade.upgrades.cost = card.upgrade.cost;
  }

  if (card.upgrade.name !== undefined && card.upgrade.name !== card.name) {
    upgrade.upgrades.upgradeDescription = card.upgrade.name.replace(card.name, '').trim();
  }

  if (card.upgrade.tags) {
    const newTags = card.upgrade.tags.filter((tag) => !card.tags.includes(tag));
    if (newTags.length > 0) {
      upgrade.upgrades.addKeyword = newTags;
    }
  }

  return upgrade;
}

export function getAllUpgradableCards(cards: CardDef[]): CardDef[] {
  return cards.filter((card) => canUpgrade(card));
}

export function getUpgradeStats(): {
  totalUpgrades: number;
  upgradesByType: Record<string, number>;
} {
  const upgradesByType: Record<string, number> = {
    damage: 0,
    block: 0,
    cost: 0,
    keyword: 0,
    effect: 0,
  };

  Object.values(upgradeRegistry).forEach((upgrade) => {
    const { upgrades } = upgrade;
    if (upgrades.damage !== undefined) upgradesByType.damage++;
    if (upgrades.block !== undefined) upgradesByType.block++;
    if (upgrades.cost !== undefined) upgradesByType.cost++;
    if (upgrades.addKeyword && upgrades.addKeyword.length > 0) upgradesByType.keyword++;
    if (upgrades.addEffect) upgradesByType.effect++;
  });

  return {
    totalUpgrades: Object.keys(upgradeRegistry).length,
    upgradesByType,
  };
}
