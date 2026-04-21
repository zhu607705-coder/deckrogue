export interface CombatActionRecord {
  turn: number;
  actor: 'player' | 'enemy';
  enemyId?: string;
  intent?: string;
  cardPlayed?: string;
  damageDealt?: number;
  damageTaken?: number;
  blockGained?: number;
  statusesApplied?: Record<string, number>;
  playerHpBefore: number;
  playerHpAfter: number;
  enemyHpBefore?: number;
  enemyHpAfter?: number;
}

export interface EnhancedCombatActionRecord extends CombatActionRecord {
  handCards?: string[];
  deckSize?: number;
  discardSize?: number;
  energySpent?: number;
  energyRemaining?: number;
  blockStrategy?: 'early' | 'late' | 'none';
  damageStrategy?: 'focus' | 'spread' | 'balanced';
  relicTriggers?: string[];
  statusEffectTiming?: Record<string, number>;
}

export interface PlayerPatternAnalysis {
  aggressivePlaysInLastTurns: number;
  defensivePlaysInLastTurns: number;
  averageCardsPerTurn: number;
  averageDamageDealtPerTurn: number;
  averageBlockGainedPerTurn: number;
  prefersAggression: boolean;
  vulnerableToBurst: boolean;
}

export interface DetailedPlayerPatternAnalysis extends PlayerPatternAnalysis {
  cardUsageFrequency: Record<string, number>;
  blockTimingPreference: 'early' | 'late' | 'opportunistic';
  damageFocus: 'single' | 'multi' | 'balanced';
  statusEffectAwareness: 'low' | 'medium' | 'high';
  predictedNextPlay?: string;
}

export class CombatMemory {
  private records: CombatActionRecord[] = [];
  private maxMemorySize = 50;
  private enemyStates: Map<string, { lastHp: number; lastBlock: number }> = new Map();
  private handStates: Array<{ turn: number; handCards: string[]; energySpent: number; energyRemaining: number }> = [];

  public recordAction(record: CombatActionRecord): void {
    this.records.push(record);

    if (this.records.length > this.maxMemorySize) {
      this.records.shift();
    }

    if (record.actor === 'enemy' && record.enemyId) {
      this.enemyStates.set(record.enemyId, {
        lastHp: record.enemyHpAfter || record.enemyHpBefore || 0,
        lastBlock: 0
      });
    }
  }

  public recordHandState(handCards: string[], energySpent: number, energyRemaining: number): void {
    const currentTurn = this.records.length > 0 ? this.records[this.records.length - 1].turn : 0;
    this.handStates.push({ turn: currentTurn, handCards, energySpent, energyRemaining });

    if (this.handStates.length > this.maxMemorySize) {
      this.handStates.shift();
    }
  }

  public getRecentRecords(turnCount: number = 5): CombatActionRecord[] {
    const currentTurn = this.records.length > 0 ? this.records[this.records.length - 1].turn : 0;
    return this.records.filter(r => r.turn > currentTurn - turnCount);
  }

  public analyzeCardUsageFrequency(): Record<string, number> {
    const playerActions = this.records.filter(r => r.actor === 'player' && r.cardPlayed);
    const frequency: Record<string, number> = {};

    for (const action of playerActions) {
      if (action.cardPlayed) {
        frequency[action.cardPlayed] = (frequency[action.cardPlayed] || 0) + 1;
      }
    }

    return frequency;
  }

  public getMostUsedCards(count: number = 5): string[] {
    const frequency = this.analyzeCardUsageFrequency();
    return Object.entries(frequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, count)
      .map(([card]) => card);
  }

  public analyzeBlockTiming(): 'early' | 'late' | 'opportunistic' {
    const playerActions = this.records.filter(r => r.actor === 'player' && r.blockGained);

    if (playerActions.length < 2) {
      return 'opportunistic';
    }

    let earlyBlocks = 0;
    let lateBlocks = 0;
    let opportunisticBlocks = 0;

    for (const action of playerActions) {
      const damageTaken = action.damageTaken || 0;
      const blockGained = action.blockGained || 0;

      if (damageTaken > 0 && blockGained >= damageTaken) {
        lateBlocks++;
      } else if (blockGained > 15) {
        earlyBlocks++;
      } else {
        opportunisticBlocks++;
      }
    }

    if (earlyBlocks > lateBlocks && earlyBlocks > opportunisticBlocks) {
      return 'early';
    } else if (lateBlocks > earlyBlocks && lateBlocks > opportunisticBlocks) {
      return 'late';
    }
    return 'opportunistic';
  }

  public predictNextPlayerIntent(): string | null {
    const recentCards = this.getMostUsedCards(3);
    if (recentCards.length === 0) {
      return null;
    }

    const recentRecords = this.getRecentRecords(3);
    const playerActions = recentRecords.filter(r => r.actor === 'player');

    if (playerActions.length === 0) {
      return recentCards[0];
    }

    const lastAction = playerActions[playerActions.length - 1];
    const patterns = this.analyzePlayerPatterns();

    if (patterns.vulnerableToBurst || lastAction.playerHpAfter < 30) {
      return 'block';
    }

    if (patterns.prefersAggression) {
      return recentCards[0];
    }

    return recentCards[0] || null;
  }

  public getDetailedPlayerPatterns(): DetailedPlayerPatternAnalysis {
    const basicPatterns = this.analyzePlayerPatterns();
    const frequency = this.analyzeCardUsageFrequency();
    const blockTiming = this.analyzeBlockTiming();
    const predicted = this.predictNextPlayerIntent();

    const playerActions = this.records.filter(r => r.actor === 'player');
    let singleTargetDamage = 0;
    let multiTargetDamage = 0;
    let statusEffectsUsed = 0;

    for (const action of playerActions) {
      if (action.damageDealt && action.damageDealt > 0) {
        if (action.damageDealt >= 15) {
          singleTargetDamage++;
        } else {
          multiTargetDamage++;
        }
      }
      if (action.statusesApplied && Object.keys(action.statusesApplied).length > 0) {
        statusEffectsUsed++;
      }
    }

    let damageFocus: 'single' | 'multi' | 'balanced' = 'balanced';
    if (singleTargetDamage > multiTargetDamage * 2) {
      damageFocus = 'single';
    } else if (multiTargetDamage > singleTargetDamage * 2) {
      damageFocus = 'multi';
    }

    let statusEffectAwareness: 'low' | 'medium' | 'high' = 'medium';
    if (playerActions.length > 0) {
      const statusRatio = statusEffectsUsed / playerActions.length;
      if (statusRatio > 0.3) {
        statusEffectAwareness = 'high';
      } else if (statusRatio < 0.1) {
        statusEffectAwareness = 'low';
      }
    }

    return {
      ...basicPatterns,
      cardUsageFrequency: frequency,
      blockTimingPreference: blockTiming,
      damageFocus,
      statusEffectAwareness,
      predictedNextPlay: predicted || undefined
    };
  }

  public analyzePlayerPatterns(): PlayerPatternAnalysis {
    const last5Turns = this.getRecentRecords(5);
    const playerActions = last5Turns.filter(r => r.actor === 'player');

    let aggressivePlays = 0;
    let defensivePlays = 0;
    let totalDamageDealt = 0;
    let totalBlockGained = 0;
    let cardCount = 0;

    const turnsWithActions = new Set<number>();

    for (const action of playerActions) {
      turnsWithActions.add(action.turn);

      if (action.damageDealt && action.damageDealt > 0) {
        aggressivePlays++;
        totalDamageDealt += action.damageDealt;
      }

      if (action.blockGained && action.blockGained > 0) {
        defensivePlays++;
        totalBlockGained += action.blockGained;
      }

      if (action.cardPlayed) {
        cardCount++;
      }
    }

    const numTurns = Math.max(1, turnsWithActions.size);

    return {
      aggressivePlaysInLastTurns: aggressivePlays,
      defensivePlaysInLastTurns: defensivePlays,
      averageCardsPerTurn: cardCount / numTurns,
      averageDamageDealtPerTurn: totalDamageDealt / numTurns,
      averageBlockGainedPerTurn: totalBlockGained / numTurns,
      prefersAggression: aggressivePlays > defensivePlays,
      vulnerableToBurst: defensivePlays === 0 && aggressivePlays > 2
    };
  }

  public getTotalDamageTakenByPlayer(): number {
    return this.records
      .filter(r => r.actor === 'enemy' && r.damageDealt)
      .reduce((sum, r) => sum + (r.damageDealt || 0), 0);
  }

  public getPlayerHpTrend(): 'increasing' | 'decreasing' | 'stable' {
    if (this.records.length < 3) return 'stable';

    const recentPlayerActions = this.records
      .filter(r => r.actor === 'player')
      .slice(-5);

    if (recentPlayerActions.length < 2) return 'stable';

    const firstHp = recentPlayerActions[0].playerHpBefore;
    const lastHp = recentPlayerActions[recentPlayerActions.length - 1].playerHpAfter;
    const diff = lastHp - firstHp;

    if (diff > 5) return 'increasing';
    if (diff < -5) return 'decreasing';
    return 'stable';
  }

  public hasPlayerUsedCardRecently(cardName: string, turnCount: number = 3): boolean {
    const recent = this.getRecentRecords(turnCount);
    return recent.some(r => r.cardPlayed === cardName);
  }

  public clear(): void {
    this.records = [];
    this.enemyStates.clear();
    this.handStates = [];
  }
}

export const combatMemory = new CombatMemory();
