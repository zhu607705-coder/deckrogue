/**
 * @file numericsTypes.ts
 * @description 数值类型定义 - 定义数值平衡系统的核心类型和接口
 *
 * 主要职责:
 * - 定义 VarianceClass (方差分类: stable/conditional/risky/chaotic)
 * - 定义 NumericsBaseline 接口，描述数值基准配置 (evu, discounting, risk, caps, pricing)
 * - 定义 NumericsConfig 接口，描述完整的数值配置文件
 * - 为其他数值模块提供类型约束
 */
export type VarianceClass = 'stable' | 'conditional' | 'risky' | 'chaotic';

export interface NumericsBaseline {
  evu: {
    energy: number;
    damage: number;
    block: number;
    armor: number;
    draw: number;
    gold: number;
    heal: number;
    status: number;
  };
  discounting: {
    delayedGamma: number;
    conditionalTriggerRate: number;
    relicTriggerRate: number;
    expectedTurnsPerCombat: number;
    expectedCombatsPerRun: number;
  };
  risk: {
    safeFloor: number;
    perilK: number;
    warpAlpha: number;
  };
  caps: {
    damageSoftCap: number;
    damageSoftCapExcessRetention: number;
    armorSoftCap: number;
    statusSoftCapStacks: number;
    statusSoftCapExcessRetention: number;
  };
  pricing: {
    cardCommon: number;
    cardUncommon: number;
    cardRare: number;
    relicBase: number;
    potionBase: number;
    removalBase: number;
    removalStep: number;
  };
}

export interface ValuationModifiers {
  timingTurns?: number;
  triggerRate?: number;
  variance?: VarianceClass | number;
  riskScore?: number;
  targetFactor?: number;
}

export interface StatusValuationInput extends ValuationModifiers {
  status: string;
  stacks: number;
  duration?: number;
}

export interface CardValuationInput extends ValuationModifiers {
  cost: number;
  damage?: number;
  block?: number;
  armor?: number;
  draw?: number;
  heal?: number;
  statuses?: StatusValuationInput[];
  type?: string;
  rarity?: string;
}

export interface RelicValuationInput extends ValuationModifiers {
  effectEVU: number;
  triggerRate?: number;
  durationTurns?: number;
}

export interface PriceQuote {
  evu: number;
  gold: number;
}

export interface RewardQuote {
  gold: number;
  cardChoices: number;
  relicChance: number;
  potionChance: number;
}

export interface ValuationContext {
  baseline: NumericsBaseline;
  varianceWeights: Record<VarianceClass, number>;
  rarityFactors: Record<string, number>;
  typeFactors: Record<string, number>;
  statusFactors: Record<string, number>;
}
