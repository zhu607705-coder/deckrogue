/**
 * @file AdaptiveBossAI.ts
 * @description 自适应 Boss AI - 根据玩家行为模式动态调整战斗策略
 *
 * 主要职责:
 * - 实现 AdaptationProfile，跟踪和学习玩家行为模式
 * - 分析 aggressivePlays、defensivePlays、cardUsage 等玩家特征
 * - 定义 LearnedBehavior，记录玩家触发条件和响应模式
 * - 实现 counterStrategy，根据玩家类型选择克制策略
 */
import type { DetailedPlayerPatternAnalysis } from './combatMemory';

export type PlayerType = 'aggressive' | 'defensive' | 'balanced' | 'opportunistic' | 'unknown';

export interface AdaptationProfile {
  enemyId: string;
  playerType: PlayerType;
  counterStrategy: CounterStrategy;
  learnedBehaviors: LearnedBehavior[];
  successRate: number;
  totalInteractions: number;
  adaptationLevel: number;
  lastUpdateTurn: number;
  patternSnapshot: {
    aggressivePlays: number;
    defensivePlays: number;
    avgDamage: number;
    avgBlock: number;
    cardUsage: Record<string, number>;
  };
}

export interface LearnedBehavior {
  triggerCondition: string;
  playerResponse: string;
  effectiveness: number;
  timesObserved: number;
  lastObservedTurn: number;
}

export interface CounterStrategy {
  type: 'burst' | 'sustained' | 'status' | 'defense_pressure' | 'predictable';
  parameters: {
    burstTurns?: number;
    sustainedDamage?: number;
    statusEffects?: string[];
    defenseThreshold?: number;
  };
  effectiveness: number;
}

export const ADAPTATION_THRESHOLDS = {
  EFFECTIVENESS_HIGH: 0.7,
  EFFECTIVENESS_MEDIUM: 0.4,
  BURST_THRESHOLD: 0.3,
  DEFENSIVE_RATIO: 0.6,
  AGGRESSIVE_RATIO: 0.6,
  MIN_INTERACTIONS_FOR_ADAPTATION: 3,
  ADAPTATION_COOLDOWN_TURNS: 2,
  LEARNING_RATE: 0.15
};

export class AdaptiveBossAI {
  private profiles: Map<string, AdaptationProfile> = new Map();

  constructor() {
    this.profiles = new Map();
  }

  public getOrCreateProfile(enemyId: string): AdaptationProfile {
    if (!this.profiles.has(enemyId)) {
      this.profiles.set(enemyId, this.createInitialProfile(enemyId));
    }
    return this.profiles.get(enemyId)!;
  }

  private createInitialProfile(enemyId: string): AdaptationProfile {
    return {
      enemyId,
      playerType: 'unknown',
      counterStrategy: {
        type: 'sustained',
        parameters: { sustainedDamage: 10 },
        effectiveness: 0.5
      },
      learnedBehaviors: [],
      successRate: 0.5,
      totalInteractions: 0,
      adaptationLevel: 0,
      lastUpdateTurn: 0,
      patternSnapshot: {
        aggressivePlays: 0,
        defensivePlays: 0,
        avgDamage: 0,
        avgBlock: 0,
        cardUsage: {}
      }
    };
  }

  public identifyPlayerType(patterns: DetailedPlayerPatternAnalysis): PlayerType {
    const aggressiveRatio = patterns.aggressivePlaysInLastTurns /
      Math.max(1, patterns.aggressivePlaysInLastTurns + patterns.defensivePlaysInLastTurns);

    if (aggressiveRatio > ADAPTATION_THRESHOLDS.AGGRESSIVE_RATIO) {
      return 'aggressive';
    }

    if (aggressiveRatio < (1 - ADAPTATION_THRESHOLDS.AGGRESSIVE_RATIO)) {
      if (patterns.blockTimingPreference === 'early') {
        return 'defensive';
      }
      return 'opportunistic';
    }

    if (patterns.prefersAggression && patterns.damageFocus === 'single') {
      return 'aggressive';
    }

    if (patterns.prefersAggression && patterns.damageFocus === 'multi') {
      return 'balanced';
    }

    if (!patterns.prefersAggression && patterns.blockTimingPreference !== 'opportunistic') {
      return 'defensive';
    }

    return 'balanced';
  }

  public generateCounterStrategy(playerType: PlayerType, patterns: DetailedPlayerPatternAnalysis): CounterStrategy {
    switch (playerType) {
      case 'aggressive':
        return {
          type: 'burst',
          parameters: {
            burstTurns: 2,
            statusEffects: ['Vulnerable', 'Weak']
          },
          effectiveness: 0.6
        };

      case 'defensive':
        return {
          type: 'status',
          parameters: {
            statusEffects: ['Frail', 'Vulnerable']
          },
          effectiveness: 0.5
        };

      case 'opportunistic':
        return {
          type: 'predictable',
          parameters: {
            defenseThreshold: 15
          },
          effectiveness: 0.4
        };

      case 'balanced':
        return {
          type: 'sustained',
          parameters: {
            sustainedDamage: Math.max(8, patterns.averageBlockGainedPerTurn + 5)
          },
          effectiveness: 0.5
        };

      default:
        return {
          type: 'sustained',
          parameters: { sustainedDamage: 10 },
          effectiveness: 0.5
        };
    }
  }

  public updateProfile(
    profile: AdaptationProfile,
    patterns: DetailedPlayerPatternAnalysis,
    intentExecuted: string,
    damageDealt: number,
    playerReacted: boolean,
    turnNumber: number
  ): AdaptationProfile {
    if (turnNumber - profile.lastUpdateTurn < ADAPTATION_THRESHOLDS.ADAPTATION_COOLDOWN_TURNS) {
      return profile;
    }

    const newPlayerType = this.identifyPlayerType(patterns);
    const effectiveness = this.calculateEffectiveness(damageDealt, playerReacted, patterns);

    const learnedBehavior = this.extractLearnedBehavior(intentExecuted, playerReacted, patterns, turnNumber);

    profile.learnedBehaviors = this.updateLearnedBehaviors(profile.learnedBehaviors, learnedBehavior);

    profile.counterStrategy = this.adaptStrategy(
      profile.counterStrategy,
      newPlayerType,
      effectiveness
    );

    profile.patternSnapshot = {
      aggressivePlays: patterns.aggressivePlaysInLastTurns,
      defensivePlays: patterns.defensivePlaysInLastTurns,
      avgDamage: patterns.averageDamageDealtPerTurn,
      avgBlock: patterns.averageBlockGainedPerTurn,
      cardUsage: { ...patterns.cardUsageFrequency }
    };

    profile.playerType = newPlayerType;
    profile.totalInteractions++;
    profile.lastUpdateTurn = turnNumber;
    profile.adaptationLevel = Math.min(1, profile.totalInteractions / 10);

    profile.successRate = profile.successRate * (1 - ADAPTATION_THRESHOLDS.LEARNING_RATE) +
      effectiveness * ADAPTATION_THRESHOLDS.LEARNING_RATE;

    return profile;
  }

  private calculateEffectiveness(
    damageDealt: number,
    playerReacted: boolean,
    patterns: DetailedPlayerPatternAnalysis
  ): number {
    let effectiveness = 0;

    if (damageDealt > patterns.averageBlockGainedPerTurn) {
      effectiveness += 0.3;
    } else if (damageDealt > 0) {
      effectiveness += 0.1;
    }

    if (playerReacted && damageDealt === 0) {
      effectiveness -= 0.2;
    }

    if (patterns.prefersAggression && damageDealt > 0) {
      effectiveness += 0.2;
    }

    if (damageDealt >= 20) {
      effectiveness += 0.15;
    }

    if (patterns.vulnerableToBurst && damageDealt >= 15) {
      effectiveness += 0.25;
    }

    return Math.max(0, Math.min(1, effectiveness));
  }

  private extractLearnedBehavior(
    intent: string,
    playerReacted: boolean,
    patterns: DetailedPlayerPatternAnalysis,
    turnNumber: number
  ): LearnedBehavior {
    let triggerCondition = 'default';
    let playerResponse = 'unknown';

    if (playerReacted) {
      if (patterns.blockTimingPreference === 'early') {
        triggerCondition = 'boss_aggro_early';
        playerResponse = 'early_block';
      } else {
        triggerCondition = 'boss_aggro_late';
        playerResponse = 'late_block';
      }
    } else {
      if (patterns.prefersAggression) {
        triggerCondition = 'boss_damage_aggro';
        playerResponse = 'ignore_damage_press';
      } else {
        triggerCondition = 'boss_damage_def';
        playerResponse = 'take_damage';
      }
    }

    return {
      triggerCondition,
      playerResponse,
      effectiveness: 0.5,
      timesObserved: 1,
      lastObservedTurn: turnNumber
    };
  }

  private updateLearnedBehaviors(
    existing: LearnedBehavior[],
    newBehavior: LearnedBehavior
  ): LearnedBehavior[] {
    const existingIndex = existing.findIndex(b => b.triggerCondition === newBehavior.triggerCondition);

    if (existingIndex >= 0) {
      const existingBehavior = existing[existingIndex];
      existingBehavior.timesObserved++;
      existingBehavior.lastObservedTurn = newBehavior.lastObservedTurn;
      existingBehavior.effectiveness = existingBehavior.effectiveness * 0.8 + newBehavior.effectiveness * 0.2;
      return [...existing];
    }

    if (existing.length >= 5) {
      const oldest = existing.sort((a, b) => a.lastObservedTurn - b.lastObservedTurn)[0];
      if (newBehavior.lastObservedTurn - oldest.lastObservedTurn > 10) {
        return [...existing.filter(b => b !== oldest), newBehavior];
      }
    }

    return [...existing, newBehavior];
  }

  private adaptStrategy(
    current: CounterStrategy,
    playerType: PlayerType,
    effectiveness: number
  ): CounterStrategy {
    if (effectiveness < ADAPTATION_THRESHOLDS.EFFECTIVENESS_MEDIUM) {
      const newStrategy = this.generateCounterStrategy(playerType, {
        aggressivePlaysInLastTurns: 0,
        defensivePlaysInLastTurns: 0,
        averageCardsPerTurn: 3,
        averageDamageDealtPerTurn: 0,
        averageBlockGainedPerTurn: 0,
        prefersAggression: false,
        vulnerableToBurst: false,
        cardUsageFrequency: {},
        blockTimingPreference: 'opportunistic' as const,
        damageFocus: 'balanced' as const,
        statusEffectAwareness: 'medium' as const
      });

      return {
        ...newStrategy,
        effectiveness: effectiveness
      };
    }

    return current;
  }

  public shouldAdapt(profile: AdaptationProfile, turnNumber: number): boolean {
    if (profile.totalInteractions < ADAPTATION_THRESHOLDS.MIN_INTERACTIONS_FOR_ADAPTATION) {
      return false;
    }

    if (turnNumber - profile.lastUpdateTurn < ADAPTATION_THRESHOLDS.ADAPTATION_COOLDOWN_TURNS) {
      return false;
    }

    return true;
  }

  public getAdaptedIntentBonus(strategy: CounterStrategy): Record<string, number> {
    switch (strategy.type) {
      case 'burst':
        return { bursty: 0.4, aggressive: 0.2 };
      case 'sustained':
        return { aggressive: 0.2, controlling: 0.1 };
      case 'status':
        return { controlling: 0.3, aggressive: 0.1 };
      case 'defense_pressure':
        return { aggressive: 0.3, defensive: -0.2 };
      case 'predictable':
        return { setup: 0.2, unpredictable: 0.3 };
      default:
        return {};
    }
  }

  public saveProfile(profile: AdaptationProfile): void {
    this.profiles.set(profile.enemyId, profile);
  }

  public getProfile(enemyId: string): AdaptationProfile | undefined {
    return this.profiles.get(enemyId);
  }

  public clearProfile(enemyId: string): void {
    this.profiles.delete(enemyId);
  }
}
