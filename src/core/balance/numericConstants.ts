import { NUMERICS_BASELINE } from '@/core/balance/numericsBaseline';

export const NUMERIC_PRECISION = {
  internalFloatDecimals: 6,
  damageOutputDecimals: 0
} as const;

export const COMBAT_NUMBERS = {
  statusMultipliers: {
    weak: 0.75,
    fear: 0.85,
    vulnerable: 1.5,
    martyrsVigor: 2
  },
  damage: {
    min: 0,
    softCap: 200,
    softCapExcessRetention: 0.5
  },
  corruption: {
    min: 0,
    max: 100,
    bonusPerPoint: 0.0025,
    damageBonusCap: 0.35
  },
  potionToxicityDecayPerTurn: 2
} as const;

export const ECONOMY_DEFAULTS = {
  config: {
    baseGoldReward: 16,
    goldPerFloor: 3,
    baseCardReward: 0.75,
    cardsPerFloor: 0.05,
    relicRewardChance: 0.1,
    potionRewardChance: 0.25
  },
  floors: {
    precomputeMaxFloor: 10,
    bossFloor: 10
  },
  scaling: {
    hpFloorFactor: 0.15,
    hpFloorLogDivisor: 10,
    damagePerFloorGrowth: 0.1,
    damageLogDivisor: 10
  },
  rewards: {
    bossGoldMultiplier: 3,
    eliteGoldMultiplier: 2,
    combatsPerFloor: 3,
    eliteChanceBase: 0.1,
    eliteChancePerFloor: 0.02,
    eliteExpectedGoldBonusFactor: 0.5,
    bossExpectedGoldBonusFactor: 2,
    bossCardRewards: 2,
    eliteCardRewards: 1.5,
    maxRegularCardReward: 2,
    cardRewardPrecisionScale: 100,
    minCardChoices: 1,
    maxCardChoicesWithBagOfPrep: 3,
    bagOfPrepBonusChoices: 1,
    maxPotionDropChance: 0.5,
    potionDropPerFloor: 0.02,
    maxRelicDropChance: 1
  },
  shop: {
    cardBaseCost: 50,
    cardGrowth: 1.05,
    relicBaseCost: 150,
    relicGrowth: 1.08,
    potionBaseCost: 75,
    removalBaseCost: 75,
    removalCostPerFloor: 5,
    removalCostPerRemoval: 25,
    upgradeBaseCost: 100,
    upgradeGrowth: 1.5
  },
  rarity: {
    commonBase: 0.6,
    uncommonBase: 0.3,
    rareBase: 0.1,
    floorBonusPerFloor: 0.02,
    floorBonusCap: 0.2,
    uncommonBonusShare: 0.5,
    rareBonusShare: 0.5
  },
  difficulty: {
    baseDifficultyScale: 100,
    difficultyClampMin: 0,
    difficultyClampMax: 5,
    powerDiffDivisor: 20,
    powerDiffOffset: 2.5
  },
  strategy: {
    relicSavingsMultiple: 2,
    removalSuggestionMinFloorExclusive: 5
  },
  random: {
    rollMin: 0,
    rollMax: 1,
    curvePower: 1
  }
} as const;

export const BALANCE_CONSTANTS = {
  resourceValues: {
    energy: NUMERICS_BASELINE.evu.energy,
    damage: NUMERICS_BASELINE.evu.damage,
    block: NUMERICS_BASELINE.evu.block,
    draw: NUMERICS_BASELINE.evu.draw,
    gold: NUMERICS_BASELINE.evu.gold,
    hp: NUMERICS_BASELINE.evu.heal,
    status: NUMERICS_BASELINE.evu.status
  },
  scalingFactors: {
    common: 1.0,
    uncommon: 1.35,
    rare: 1.85,
    attack: 1.0,
    skill: 1.1,
    power: 1.2,
    strength: 1.2,
    vulnerable: 1.1,
    weak: 1.0,
    fear: 0.9,
    construct: 1.2,
    element: 1.1,
    warp: 1.3,
    delay: 1.1
  },
  prices: {
    cardCommon: NUMERICS_BASELINE.pricing.cardCommon,
    cardUncommon: NUMERICS_BASELINE.pricing.cardUncommon,
    cardRare: NUMERICS_BASELINE.pricing.cardRare,
    cardRemovalBase: NUMERICS_BASELINE.pricing.removalBase,
    cardRemovalStep: NUMERICS_BASELINE.pricing.removalStep,
    relicGoldPerEnergyValue: Math.floor(1 / NUMERICS_BASELINE.evu.gold),
    potionGoldPerEnergyValue: Math.floor(0.75 / NUMERICS_BASELINE.evu.gold)
  },
  expectations: {
    relicTriggerRate: NUMERICS_BASELINE.discounting.relicTriggerRate,
    relicDuration: 1,
    expectedCombats: NUMERICS_BASELINE.discounting.expectedCombatsPerRun,
    expectedTurnsPerCombat: NUMERICS_BASELINE.discounting.expectedTurnsPerCombat
  },
  ratingThresholds: {
    card: {
      excellent: 2.0,
      good: 1.5,
      average: 1.0,
      poor: 0.5
    },
    relic: {
      excellent: 1.5,
      good: 1.0,
      average: 0.7,
      poor: 0.4
    }
  },
  multiHit: {
    perAdditionalHitPenalty: 0.1,
    minScalingFactor: 0.5
  },
  rewardScaling: {
    baseGoldReward: 10,
    goldPerFloor: 3,
    bossGoldMultiplier: 3,
    eliteGoldMultiplier: 2,
    bossCardRewards: 2,
    eliteCardRewards: 1.5,
    baseCardRewards: 0.75,
    cardsPerFloor: 0.05
  },
  enemyScaling: {
    hpPerFloor: 0.15,
    damagePerFloor: 0.1
  },
  statusSoftCap: {
    stacks: NUMERICS_BASELINE.caps.statusSoftCapStacks,
    diminishingReturn: NUMERICS_BASELINE.caps.statusSoftCapExcessRetention
  },
  freeCardValueMultiplier: 2,
  defaultFactor: 1.0
} as const;
