import { GameState } from '@/core/types';

export interface RunMetrics {
  runId: string;
  seed: number;
  startTime: number;
  endTime?: number;
  victory: boolean;
  floorsCompleted: number;
  character?: string;
  finalStats: PlayerStats;
  combatMetrics: CombatMetrics;
  economyMetrics: EconomyMetrics;
}

export interface PlayerStats {
  hp: number;
  maxHp: number;
  energy: number;
  gold: number;
  intel: number;
  corruption: number;
  deckSize: number;
  relicCount: number;
  potionCount: number;
}

export interface CombatMetrics {
  totalDamageDealt: number;
  totalDamageReceived: number;
  totalHealing: number;
  totalBlockGained: number;
  cardsPlayed: number;
  energySpent: number;
  turnsInCombat: number;
  enemiesKilled: {
    normal: number;
    elite: number;
    boss: number;
  };
  turnsTakenPerCombat: number[];
}

export interface EconomyMetrics {
  goldEarned: number;
  goldSpent: number;
  cardsAcquired: number;
  cardsRemoved: number;
  relicsAcquired: number;
  potionsUsed: number;
  upgradesPurchased: number;
  cardRemovalCost: number;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  unlocked: boolean;
  unlockedAt?: number;
}

export class MetricsTracker {
  private currentRun: RunMetrics | null = null;
  private combatStartTime: number = 0;
  private achievements: Achievement[] = [];

  constructor() {
    this.initializeAchievements();
  }

  private initializeAchievements(): void {
    this.achievements = [
      { id: 'first_victory', name: 'First Victory', description: 'Complete your first run', unlocked: false },
      { id: 'no_damage_boss', name: 'Perfect Boss', description: 'Defeat a boss without taking damage', unlocked: false },
      { id: 'full_gold_run', name: 'Greedy', description: 'End a run with 999+ gold', unlocked: false },
      { id: 'ten_combos', name: 'Combo Master', description: 'Trigger 10+ synergies in a single combat', unlocked: false },
      { id: 'corruption_survivor', name: 'Chaos Walker', description: 'Win with 50+ corruption', unlocked: false },
      { id: 'speedrunner', name: 'Speed Runner', description: 'Complete a run in under 30 minutes', unlocked: false },
      { id: 'minimal_deck', name: 'Minimalist', description: 'Win with 5 or fewer cards in deck', unlocked: false },
      { id: 'infinite_combo', name: 'Infinite Power', description: 'Deal over 1000 damage in one turn', unlocked: false },
    ];
  }

  startRun(seed: number, character?: string): void {
    this.currentRun = {
      runId: `run_${Date.now()}`,
      seed,
      startTime: Date.now(),
      victory: false,
      floorsCompleted: 0,
      character,
      finalStats: {
        hp: 0,
        maxHp: 0,
        energy: 0,
        gold: 0,
        intel: 0,
        corruption: 0,
        deckSize: 0,
        relicCount: 0,
        potionCount: 0
      },
      combatMetrics: {
        totalDamageDealt: 0,
        totalDamageReceived: 0,
        totalHealing: 0,
        totalBlockGained: 0,
        cardsPlayed: 0,
        energySpent: 0,
        turnsInCombat: 0,
        enemiesKilled: { normal: 0, elite: 0, boss: 0 },
        turnsTakenPerCombat: []
      },
      economyMetrics: {
        goldEarned: 0,
        goldSpent: 0,
        cardsAcquired: 0,
        cardsRemoved: 0,
        relicsAcquired: 0,
        potionsUsed: 0,
        upgradesPurchased: 0,
        cardRemovalCost: 0
      }
    };
  }

  endRun(victory: boolean, state: GameState): void {
    if (!this.currentRun) return;

    this.currentRun.victory = victory;
    this.currentRun.endTime = Date.now();
    this.currentRun.floorsCompleted = state.map.length;
    this.currentRun.finalStats = {
      hp: state.player.hp,
      maxHp: state.player.maxHp,
      energy: state.player.maxEnergy,
      gold: state.player.gold,
      intel: state.player.intel,
      corruption: state.player.corruption,
      deckSize: state.player.deck.length,
      relicCount: state.player.relics.length,
      potionCount: state.player.potions.length
    };

    this.checkAchievements(state);
  }

  recordCombatStart(): void {
    this.combatStartTime = Date.now();
  }

  recordCombatEnd(enemyType: 'normal' | 'elite' | 'boss', turns: number): void {
    if (!this.currentRun) return;

    this.currentRun.combatMetrics.turnsInCombat += turns;
    this.currentRun.combatMetrics.turnsTakenPerCombat.push(turns);
    this.currentRun.combatMetrics.enemiesKilled[enemyType]++;
  }

  recordDamageDealt(amount: number): void {
    if (!this.currentRun) return;
    this.currentRun.combatMetrics.totalDamageDealt += amount;
  }

  recordDamageReceived(amount: number): void {
    if (!this.currentRun) return;
    this.currentRun.combatMetrics.totalDamageReceived += amount;
  }

  recordHealing(amount: number): void {
    if (!this.currentRun) return;
    this.currentRun.combatMetrics.totalHealing += amount;
  }

  recordBlockGained(amount: number): void {
    if (!this.currentRun) return;
    this.currentRun.combatMetrics.totalBlockGained += amount;
  }

  recordCardPlayed(): void {
    if (!this.currentRun) return;
    this.currentRun.combatMetrics.cardsPlayed++;
  }

  recordEnergySpent(amount: number): void {
    if (!this.currentRun) return;
    this.currentRun.combatMetrics.energySpent += amount;
  }

  recordGoldEarned(amount: number): void {
    if (!this.currentRun) return;
    this.currentRun.economyMetrics.goldEarned += amount;
  }

  recordGoldSpent(amount: number): void {
    if (!this.currentRun) return;
    this.currentRun.economyMetrics.goldSpent += amount;
  }

  recordCardAcquired(): void {
    if (!this.currentRun) return;
    this.currentRun.economyMetrics.cardsAcquired++;
  }

  recordCardRemoved(): void {
    if (!this.currentRun) return;
    this.currentRun.economyMetrics.cardsRemoved++;
  }

  recordRelicAcquired(): void {
    if (!this.currentRun) return;
    this.currentRun.economyMetrics.relicsAcquired++;
  }

  recordPotionUsed(): void {
    if (!this.currentRun) return;
    this.currentRun.economyMetrics.potionsUsed++;
  }

  recordUpgradePurchased(): void {
    if (!this.currentRun) return;
    this.currentRun.economyMetrics.upgradesPurchased++;
  }

  // Compatibility aliases for older engine code
  recordEnemyDefeated(_enemyDefId: string): void {
    if (!this.currentRun) return;
    this.currentRun.combatMetrics.enemiesKilled.normal++;
  }

  recordCombatVictory(floor: number): void {
    if (!this.currentRun) return;
    this.currentRun.floorsCompleted = Math.max(this.currentRun.floorsCompleted, floor);
  }

  recordRunEnd(victory: boolean, _floor: number): void {
    if (!this.currentRun) return;
    this.currentRun.victory = victory;
    this.currentRun.endTime = Date.now();
  }

  getCurrentRunStats(): RunMetrics | null {
    return this.getCurrentRunMetrics();
  }

  getCurrentRunMetrics(): RunMetrics | null {
    return this.currentRun;
  }

  getRunDuration(): number {
    if (!this.currentRun || !this.currentRun.endTime) return 0;
    return this.currentRun.endTime - this.currentRun.startTime;
  }

  getAverageTurnsPerCombat(): number {
    if (!this.currentRun) return 0;
    const turns = this.currentRun.combatMetrics.turnsTakenPerCombat;
    if (turns.length === 0) return 0;
    return turns.reduce((a, b) => a + b, 0) / turns.length;
  }

  getAchievements(): Achievement[] {
    return [...this.achievements];
  }

  private checkAchievements(state: GameState): void {
    if (!this.currentRun) return;

    const run = this.currentRun;

    if (run.victory) {
      this.unlockAchievement('first_victory');
    }

    if (run.finalStats.gold >= 999) {
      this.unlockAchievement('full_gold_run');
    }

    if (run.finalStats.corruption >= 50) {
      this.unlockAchievement('corruption_survivor');
    }

    if (run.finalStats.deckSize <= 5) {
      this.unlockAchievement('minimal_deck');
    }

    const durationMinutes = (run.endTime! - run.startTime) / 60000;
    if (durationMinutes < 30) {
      this.unlockAchievement('speedrunner');
    }

    const maxDamageInOneTurn = this.calculateMaxDamageInOneTurn();
    if (maxDamageInOneTurn >= 1000) {
      this.unlockAchievement('infinite_combo');
    }

    const avgDamage = run.combatMetrics.totalDamageDealt / Math.max(1, run.combatMetrics.turnsInCombat);
    const synergiesTriggered = avgDamage / 10;
    if (synergiesTriggered >= 10) {
      this.unlockAchievement('ten_combos');
    }
  }

  private unlockAchievement(id: string): void {
    const achievement = this.achievements.find(a => a.id === id);
    if (achievement && !achievement.unlocked) {
      achievement.unlocked = true;
      achievement.unlockedAt = Date.now();
    }
  }

  private calculateMaxDamageInOneTurn(): number {
    return 0;
  }

  getStatisticsSummary(): string {
    if (!this.currentRun) return 'No run data';

    const run = this.currentRun;
    const duration = run.endTime ? (run.endTime - run.startTime) / 60000 : 0;

    return `
=== Run Statistics ===
Victory: ${run.victory ? 'Yes' : 'No'}
Floors: ${run.floorsCompleted}/10
Duration: ${duration.toFixed(1)} minutes

=== Combat ===
Total Damage Dealt: ${run.combatMetrics.totalDamageDealt}
Total Damage Received: ${run.combatMetrics.totalDamageReceived}
Cards Played: ${run.combatMetrics.cardsPlayed}
Avg Turns/Combat: ${this.getAverageTurnsPerCombat().toFixed(1)}

=== Economy ===
Gold Earned: ${run.economyMetrics.goldEarned}
Gold Spent: ${run.economyMetrics.goldSpent}
Cards Added: ${run.economyMetrics.cardsAcquired}
Cards Removed: ${run.economyMetrics.cardsRemoved}

=== Achievements ===
Unlocked: ${this.achievements.filter(a => a.unlocked).length}/${this.achievements.length}
    `.trim();
  }

  reset(): void {
    this.currentRun = null;
    this.achievements.forEach(a => {
      a.unlocked = false;
      a.unlockedAt = undefined;
    });
  }
}

export const metricsTracker = new MetricsTracker();
