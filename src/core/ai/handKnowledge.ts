/**
 * @file handKnowledge.ts
 * @description 手牌认知系统 - 模拟敌人对玩家手牌的认知和预测
 *
 * 主要职责:
 * - 定义 HandKnowledge 接口，记录已知卡牌和未知索引
 * - 实现 peekPlayerHand，根据情报等级查看玩家手牌
 * - 定义 HandKnowledgeSystem 接口，提供手牌预测功能
 * - 为 AI 系统提供手牌信息支持
 */
export interface HandKnowledge {
  knownCards: string[];
  unknownIndices: number[];
  confidence: number;
}

export interface HandKnowledgeSystem {
  currentKnowledge: HandKnowledge;
  updateFromIntel(intelLevel: number, hand: any[]): void;
  predictPlayerActions(): string[];
  getBestCounterIntent(): string;
  getDangerousCardCount(): number;
  resetKnowledge(): void;
}

export function peekPlayerHand(
  hand: any[],
  source: string,
  intelLevel: number = 1
): HandKnowledge {
  const visibleCount = Math.min(hand.length, Math.ceil(hand.length * intelLevel));
  const visibleCards = hand.slice(0, visibleCount).map(c => c.id);

  return {
    knownCards: visibleCards,
    unknownIndices: hand.slice(visibleCount).map((_, i) => i + visibleCount),
    confidence: intelLevel
  };
}

const DANGEROUS_KEYWORDS = [
  'attack',
  'strike',
  'damage',
  'slash',
  'hit',
  'punch',
  'smash',
  'cleave',
  'burn',
  'pierce'
];

export class HandKnowledgeSystemImpl implements HandKnowledgeSystem {
  public currentKnowledge: HandKnowledge;

  constructor() {
    this.currentKnowledge = {
      knownCards: [],
      unknownIndices: [],
      confidence: 0
    };
  }

  public updateFromIntel(intelLevel: number, hand: any[]): void {
    const peekResult = peekPlayerHand(hand, 'enemy_intel', intelLevel);
    this.currentKnowledge = peekResult;
  }

  public predictPlayerActions(): string[] {
    return this.currentKnowledge.knownCards.filter(cardId =>
      this.isCardDangerous(cardId)
    );
  }

  public getBestCounterIntent(): string {
    const dangerousCount = this.getDangerousCardCount();

    if (dangerousCount > 0) {
      const intents = ['Defend', 'Block', 'Vulnerable', 'Counter'];
      const index = Math.floor(Math.random() * intents.length);
      return intents[index];
    }

    return 'Attack';
  }

  public getDangerousCardCount(): number {
    return this.predictPlayerActions().length;
  }

  public resetKnowledge(): void {
    this.currentKnowledge = {
      knownCards: [],
      unknownIndices: [],
      confidence: 0
    };
  }

  public getKnowledge(): HandKnowledge {
    return { ...this.currentKnowledge };
  }

  public isCardDangerous(cardId: string): boolean {
    const lowerCardId = cardId.toLowerCase();
    return DANGEROUS_KEYWORDS.some(keyword => lowerCardId.includes(keyword));
  }
}

export const handKnowledgeSystem = new HandKnowledgeSystemImpl();
