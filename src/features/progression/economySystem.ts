/**
 * @file economySystem.ts
 * @description 经济系统 - 管理游戏经济数值、奖励计算和随机化
 *
 * 主要职责:
 * - 计算楼层奖励（金币、卡牌、遗物、药水）
 * - 管理敌人缩放比例和商店价格
 * - 提供经济随机化和稀有度权重系统
 */
import {
  ECONOMY_DEFAULTS,
  GameState,
  calculateEnemyRuntimeScaling,
  calculateRewardRuntime,
  clampNumber,
  quoteRelicPrice,
  quoteRemovalPrice
} from '@/core';
import { createRNG, RNG } from '@/infrastructure/rng/rng';

export interface EconomyConfig {
  baseGoldReward: number;
  goldPerFloor: number;
  baseCardReward: number;
  cardsPerFloor: number;
  relicRewardChance: number;
  potionRewardChance: number;
}

export interface DropRates {
  cardRarity: {
    common: number;
    uncommon: number;
    rare: number;
  };
  relicTier: {
    starter: number;
    normal: number;
    boss: number;
  };
}

type CardRarity = 'common' | 'uncommon' | 'rare';

export interface EconomyRandomizationConfig {
  rng?: RNG;
  seed?: number;
  initialState?: number;
  rollRange?: {
    min?: number;
    max?: number;
  };
  curvePower?: number;
  chanceMultipliers?: Partial<Record<'relicReward' | 'potionReward', number>>;
  rarityWeightMultipliers?: Partial<Record<CardRarity, number>>;
}

export class EconomySystem {
  private config: EconomyConfig;
  private floorMultipliers: Map<number, number> = new Map();
  private rng: RNG = Math.random;
  private randomConfig: Required<Pick<EconomyRandomizationConfig, 'curvePower'>> & {
    rollRange: { min: number; max: number };
    chanceMultipliers: Record<'relicReward' | 'potionReward', number>;
    rarityWeightMultipliers: Record<CardRarity, number>;
  } = {
    rollRange: {
      min: ECONOMY_DEFAULTS.random.rollMin,
      max: ECONOMY_DEFAULTS.random.rollMax
    },
    curvePower: ECONOMY_DEFAULTS.random.curvePower,
    chanceMultipliers: {
      relicReward: 1,
      potionReward: 1
    },
    rarityWeightMultipliers: {
      common: 1,
      uncommon: 1,
      rare: 1
    }
  };

  constructor(config?: Partial<EconomyConfig>, randomConfig?: EconomyRandomizationConfig) {
    this.config = {
      ...ECONOMY_DEFAULTS.config,
      ...config
    };

    this.initializeMultipliers();
    if (randomConfig) {
      this.configureRandomization(randomConfig);
    }
  }

  private initializeMultipliers(): void {
    for (let floor = 1; floor <= ECONOMY_DEFAULTS.floors.precomputeMaxFloor; floor++) {
      this.floorMultipliers.set(floor, this.calculateFloorMultiplier(floor));
    }
  }

  private calculateFloorMultiplier(floor: number): number {
    const logarithmicDampening = Math.log10(1 + floor / ECONOMY_DEFAULTS.scaling.hpFloorLogDivisor);
    return floor * ECONOMY_DEFAULTS.scaling.hpFloorFactor * logarithmicDampening;
  }

  calculateHpMultiplier(floor: number): number {
    return calculateEnemyRuntimeScaling(floor).hpMultiplier;
  }

  calculateDamageMultiplier(floor: number): number {
    return calculateEnemyRuntimeScaling(floor).damageMultiplier;
  }

  calculateGoldReward(floor: number, isElite: boolean = false, isBoss: boolean = false): number {
    return calculateRewardRuntime(floor, { isElite, isBoss }).gold;
  }

  calculateExpectedGoldGain(floor: number): number {
    const combatsPerFloor = ECONOMY_DEFAULTS.rewards.combatsPerFloor;
    const avgGoldPerCombat = this.calculateGoldReward(floor);
    const eliteChance = ECONOMY_DEFAULTS.rewards.eliteChanceBase + floor * ECONOMY_DEFAULTS.rewards.eliteChancePerFloor;
    const bossChance = floor === ECONOMY_DEFAULTS.floors.bossFloor ? 1 : 0;

    return Math.floor(
      combatsPerFloor * avgGoldPerCombat * (
        1 +
        eliteChance * ECONOMY_DEFAULTS.rewards.eliteExpectedGoldBonusFactor +
        bossChance * ECONOMY_DEFAULTS.rewards.bossExpectedGoldBonusFactor
      )
    );
  }

  calculateCardReward(floor: number, isElite: boolean = false, isBoss: boolean = false): number {
    return calculateRewardRuntime(floor, { isElite, isBoss }).cardChoices;
  }

  calculateCombatRewards(
    floor: number,
    relicIds: string[] = [],
    nodeType: 'Combat' | 'Elite' | 'Boss' = 'Combat'
  ): { gold: number; cardCount: number; potionChance: number; relicChance: number } {
    const isElite = nodeType === 'Elite';
    const isBoss = nodeType === 'Boss';
    let cardChoiceBonus = 0;

    if (relicIds.includes('bag_of_prep')) {
      cardChoiceBonus = ECONOMY_DEFAULTS.rewards.bagOfPrepBonusChoices;
    }

    const reward = calculateRewardRuntime(floor, { isElite, isBoss, cardChoiceBonus });
    const gold = reward.gold;
    const cardCount = Math.min(
      Math.max(ECONOMY_DEFAULTS.rewards.minCardChoices, reward.cardChoices),
      ECONOMY_DEFAULTS.rewards.maxCardChoicesWithBagOfPrep
    );

    return {
      gold,
      cardCount,
      potionChance: this.applyChancePolicy(reward.potionChance, 'potionReward'),
      relicChance: this.applyChancePolicy(reward.relicChance, 'relicReward')
    };
  }

  calculateShopPrices(floor: number): {
    cardCost: number;
    relicCost: number;
    potionCost: number;
    removalCost: number;
  } {
    const cardMultiplier = Math.pow(ECONOMY_DEFAULTS.shop.cardGrowth, floor - 1);
    const relicMultiplier = Math.pow(ECONOMY_DEFAULTS.shop.relicGrowth, floor - 1);
    return {
      cardCost: Math.floor(ECONOMY_DEFAULTS.shop.cardBaseCost * cardMultiplier),
      relicCost: quoteRelicPrice(3, relicMultiplier).gold,
      potionCost: Math.floor(ECONOMY_DEFAULTS.shop.potionBaseCost * cardMultiplier),
      removalCost: quoteRemovalPrice(floor - 1)
    };
  }

  calculateEnemyScaling(floor: number): {
    hpMultiplier: number;
    damageMultiplier: number;
  } {
    return {
      hpMultiplier: this.calculateHpMultiplier(floor),
      damageMultiplier: this.calculateDamageMultiplier(floor)
    };
  }

  calculateRelicDropChance(floor: number, isElite: boolean = false, isBoss: boolean = false): number {
    return calculateRewardRuntime(floor, { isElite, isBoss }).relicChance;
  }

  calculatePotionDropChance(floor: number): number {
    return calculateRewardRuntime(floor).potionChance;
  }

  calculateCardRemovalCost(floor: number, previousRemovals: number = 0): number {
    return quoteRemovalPrice(previousRemovals);
  }

  calculateUpgradeCost(currentLevel: number): number {
    return Math.floor(ECONOMY_DEFAULTS.shop.upgradeBaseCost * Math.pow(ECONOMY_DEFAULTS.shop.upgradeGrowth, currentLevel));
  }

  getRarityRoll(floor: number): CardRarity {
    const roll = this.nextRandom();
    const rarityWeights = this.getRarityWeights(floor);
    
    let cumulative = 0;
    for (const [rarity, weight] of Object.entries(rarityWeights)) {
      cumulative += weight;
      if (roll < cumulative) {
        return rarity as CardRarity;
      }
    }
    return 'common';
  }

  private getRarityWeights(floor: number): Record<CardRarity, number> {
    const floorBonus = Math.min(ECONOMY_DEFAULTS.rarity.floorBonusCap, floor * ECONOMY_DEFAULTS.rarity.floorBonusPerFloor);
    const weights: Record<CardRarity, number> = {
      common: ECONOMY_DEFAULTS.rarity.commonBase - floorBonus,
      uncommon: ECONOMY_DEFAULTS.rarity.uncommonBase + floorBonus * ECONOMY_DEFAULTS.rarity.uncommonBonusShare,
      rare: ECONOMY_DEFAULTS.rarity.rareBase + floorBonus * ECONOMY_DEFAULTS.rarity.rareBonusShare
    };
    return this.applyRarityWeightPolicy(weights);
  }

  getDifficultyRating(floor: number, playerPower: number): number {
    const enemyScaling = this.calculateEnemyScaling(floor);
    const difficulty = enemyScaling.hpMultiplier * ECONOMY_DEFAULTS.difficulty.baseDifficultyScale;
    const powerDiff = difficulty - playerPower;
    
    return Math.max(
      ECONOMY_DEFAULTS.difficulty.difficultyClampMin,
      Math.min(
        ECONOMY_DEFAULTS.difficulty.difficultyClampMax,
        powerDiff / ECONOMY_DEFAULTS.difficulty.powerDiffDivisor + ECONOMY_DEFAULTS.difficulty.powerDiffOffset
      )
    );
  }

  shouldOfferRelicReward(floor: number): boolean {
    return this.nextRandom() < this.applyChancePolicy(this.calculateRelicDropChance(floor), 'relicReward');
  }

  shouldOfferPotionReward(): boolean {
    return this.nextRandom() < this.applyChancePolicy(this.config.potionRewardChance, 'potionReward');
  }

  getGoldEfficiencySuggestion(currentGold: number, floor: number): 'save' | 'shop' | 'remove' {
    const shopPrices = this.calculateShopPrices(floor);
    const expectedFutureGold = this.calculateExpectedGoldGain(floor);
    
    if (currentGold >= shopPrices.relicCost * ECONOMY_DEFAULTS.strategy.relicSavingsMultiple) return 'shop';
    if (currentGold >= shopPrices.removalCost && floor > ECONOMY_DEFAULTS.strategy.removalSuggestionMinFloorExclusive) return 'remove';
    if (currentGold + expectedFutureGold < shopPrices.cardCost) return 'save';
    
    return 'shop';
  }

  getScalingFormula(floor: number): string {
    const hp = this.calculateHpMultiplier(floor);
    const damage = this.calculateDamageMultiplier(floor);
    
    return `Floor ${floor}: HP x${hp.toFixed(2)}, Damage x${damage.toFixed(2)}`;
  }

  setRandomGenerator(rng: RNG): void {
    this.rng = rng;
  }

  setRandomSeed(seed: number, initialState?: number): void {
    this.rng = createRNG(seed, initialState);
  }

  configureRandomization(config: EconomyRandomizationConfig): void {
    if (config.rng) {
      this.rng = config.rng;
    } else if (typeof config.seed === 'number') {
      this.rng = createRNG(config.seed, config.initialState);
    }

    if (config.rollRange) {
      const nextMin = clampNumber(config.rollRange.min ?? this.randomConfig.rollRange.min, 0, 1);
      const nextMax = clampNumber(config.rollRange.max ?? this.randomConfig.rollRange.max, 0, 1);
      this.randomConfig.rollRange = nextMax >= nextMin ? { min: nextMin, max: nextMax } : { min: nextMin, max: nextMin };
    }

    if (typeof config.curvePower === 'number' && Number.isFinite(config.curvePower)) {
      this.randomConfig.curvePower = Math.max(0.01, config.curvePower);
    }

    if (config.chanceMultipliers) {
      for (const key of Object.keys(config.chanceMultipliers) as Array<'relicReward' | 'potionReward'>) {
        const value = config.chanceMultipliers[key];
        if (typeof value === 'number' && Number.isFinite(value)) {
          this.randomConfig.chanceMultipliers[key] = Math.max(0, value);
        }
      }
    }

    if (config.rarityWeightMultipliers) {
      for (const key of Object.keys(config.rarityWeightMultipliers) as CardRarity[]) {
        const value = config.rarityWeightMultipliers[key];
        if (typeof value === 'number' && Number.isFinite(value)) {
          this.randomConfig.rarityWeightMultipliers[key] = Math.max(0, value);
        }
      }
    }
  }

  getRandomizationConfig(): Readonly<typeof this.randomConfig> {
    return {
      rollRange: { ...this.randomConfig.rollRange },
      curvePower: this.randomConfig.curvePower,
      chanceMultipliers: { ...this.randomConfig.chanceMultipliers },
      rarityWeightMultipliers: { ...this.randomConfig.rarityWeightMultipliers }
    };
  }

  private nextRandom(): number {
    const raw = clampNumber(this.rng(), 0, 1);
    const curved = Math.pow(raw, this.randomConfig.curvePower);
    const min = this.randomConfig.rollRange.min;
    const max = this.randomConfig.rollRange.max;
    const span = Math.max(0, max - min);
    if (span === 0) return min;
    const epsilon = Number.EPSILON;
    const safeSpan = Math.max(0, span - epsilon);
    return min + Math.min(safeSpan, curved * span);
  }

  private applyChancePolicy(baseChance: number, key: 'relicReward' | 'potionReward'): number {
    const scaled = baseChance * this.randomConfig.chanceMultipliers[key];
    return clampNumber(scaled, 0, 1);
  }

  private applyRarityWeightPolicy(baseWeights: Record<CardRarity, number>): Record<CardRarity, number> {
    const weighted: Record<CardRarity, number> = {
      common: Math.max(0, baseWeights.common * this.randomConfig.rarityWeightMultipliers.common),
      uncommon: Math.max(0, baseWeights.uncommon * this.randomConfig.rarityWeightMultipliers.uncommon),
      rare: Math.max(0, baseWeights.rare * this.randomConfig.rarityWeightMultipliers.rare)
    };
    const total = weighted.common + weighted.uncommon + weighted.rare;
    if (total <= 0) {
      return {
        common: 1,
        uncommon: 0,
        rare: 0
      };
    }
    return {
      common: weighted.common / total,
      uncommon: weighted.uncommon / total,
      rare: weighted.rare / total
    };
  }
}

export const economySystem = new EconomySystem();
