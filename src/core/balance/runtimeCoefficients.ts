/**
 * @file runtimeCoefficients.ts
 * @description 运行时系数 - 定义战斗中的状态效果修正系数
 *
 * 主要职责:
 * - 定义 RuntimeCoefficients 接口，描述伤害、护盾、状态、资源等的运行时系数
 * - 提供弱化 (weak)、易伤 (vulnerable)、恐惧 (fear) 等状态的乘数
 * - 提供力量 (strength)、敏捷 (dexterity)、腐蚀 (corruption) 等属性的增量系数
 * - 实现 calculateDamage 等核心运行时计算函数
 */
export interface RuntimeCoefficients {
  damage: {
    weakMultiplier: number;
    vulnerableMultiplier: number;
    fearMultiplier: number;
    strengthPerStack: number;
    dexterityPerStack: number;
    corruptionBonusCap: number;
    corruptionBonusPerStack: number;
  };
  block: {
    dexterityPerStack: number;
    frailMultiplier: number;
    barricadeRetain: boolean;
  };
  status: {
    poisonTickRate: number;
    burnTickRate: number;
    regenerationTickRate: number;
    ritualStrengthGain: number;
    thornsDamagePerStack: number;
    platedArmorDecay: number;
  };
  resource: {
    intelPerStack: number;
    devotionPerStack: number;
    corruptionPerStack: number;
    threadPerStack: number;
    timeLayerPerStack: number;
    concoctionPerStack: number;
    verdictPerStack: number;
    sealPerStack: number;
  };
  softCaps: {
    damageSoftCap: number;
    damageSoftCapRetention: number;
    blockSoftCap: number;
    statusStackSoftCap: number;
    statusStackSoftCapRetention: number;
  };
  order: {
    damageCalculation: DamageCalculationStep[];
  };
}

export type DamageCalculationStep =
  | 'base'
  | 'additive'
  | 'multiplicative'
  | 'targetLayer'
  | 'independent'
  | 'softCap'
  | 'block'
  | 'hp';

export const DEFAULT_RUNTIME_COEFFICIENTS: RuntimeCoefficients = {
  damage: {
    weakMultiplier: 0.75,
    vulnerableMultiplier: 1.5,
    fearMultiplier: 0.85,
    strengthPerStack: 1,
    dexterityPerStack: 1,
    corruptionBonusCap: 0.35,
    corruptionBonusPerStack: 0.0025,
  },
  block: {
    dexterityPerStack: 1,
    frailMultiplier: 0.75,
    barricadeRetain: true,
  },
  status: {
    poisonTickRate: 1,
    burnTickRate: 1,
    regenerationTickRate: 1,
    ritualStrengthGain: 1,
    thornsDamagePerStack: 1,
    platedArmorDecay: 1,
  },
  resource: {
    intelPerStack: 1,
    devotionPerStack: 1,
    corruptionPerStack: 1,
    threadPerStack: 1,
    timeLayerPerStack: 1,
    concoctionPerStack: 1,
    verdictPerStack: 1,
    sealPerStack: 1,
  },
  softCaps: {
    damageSoftCap: 100,
    damageSoftCapRetention: 0.5,
    blockSoftCap: 50,
    statusStackSoftCap: 10,
    statusStackSoftCapRetention: 0.5,
  },
  order: {
    damageCalculation: [
      'base',
      'additive',
      'multiplicative',
      'targetLayer',
      'independent',
      'softCap',
      'block',
      'hp',
    ],
  },
};

export interface DamageCalculationContext {
  baseDamage: number;
  strength?: number;
  dexterity?: number;
  weak?: boolean;
  vulnerable?: boolean;
  fear?: boolean;
  corruption?: number;
  targetBlock?: number;
  targetArmor?: number;
  trueDamage?: number;
  ignoreBlock?: boolean;
}

export interface DamageCalculationResult {
  finalDamage: number;
  blockedDamage: number;
  hpDamage: number;
  steps: Record<DamageCalculationStep, number>;
}

export function calculateDamage(
  context: DamageCalculationContext,
  coefficients: RuntimeCoefficients = DEFAULT_RUNTIME_COEFFICIENTS
): DamageCalculationResult {
  const steps: Record<DamageCalculationStep, number> = {
    base: context.baseDamage,
    additive: 0,
    multiplicative: 0,
    targetLayer: 0,
    independent: 0,
    softCap: 0,
    block: 0,
    hp: 0,
  };

  let current = context.baseDamage;

  const additiveBonus = (context.strength ?? 0) * coefficients.damage.strengthPerStack;
  current += additiveBonus;
  steps.additive = additiveBonus;

  let multiplier = 1.0;
  if (context.weak) {
    multiplier *= coefficients.damage.weakMultiplier;
  }
  if (context.vulnerable) {
    multiplier *= coefficients.damage.vulnerableMultiplier;
  }
  if (context.fear) {
    multiplier *= coefficients.damage.fearMultiplier;
  }
  if (context.corruption && context.corruption > 0) {
    const corruptionBonus = Math.min(
      coefficients.damage.corruptionBonusCap,
      context.corruption * coefficients.damage.corruptionBonusPerStack
    );
    multiplier *= 1 + corruptionBonus;
  }
  current = Math.floor(current * multiplier);
  steps.multiplicative = current - steps.base - steps.additive;

  const targetReduction = context.targetArmor ?? 0;
  current = Math.max(0, current - targetReduction);
  steps.targetLayer = targetReduction;

  const trueDmg = context.trueDamage ?? 0;
  current += trueDmg;
  steps.independent = trueDmg;

  const softCap = coefficients.softCaps.damageSoftCap;
  if (current > softCap) {
    const excess = current - softCap;
    const retained = Math.floor(excess * coefficients.softCaps.damageSoftCapRetention);
    current = softCap + retained;
  }
  steps.softCap = current;

  const block = context.targetBlock ?? 0;
  let blocked = 0;
  if (!context.ignoreBlock && block > 0) {
    blocked = Math.min(current, block);
    current -= blocked;
  }
  steps.block = blocked;

  steps.hp = current;

  return {
    finalDamage: current,
    blockedDamage: blocked,
    hpDamage: current,
    steps,
  };
}

export interface BlockCalculationContext {
  baseBlock: number;
  dexterity?: number;
  frail?: boolean;
  barricade?: boolean;
}

export interface BlockCalculationResult {
  finalBlock: number;
  steps: {
    base: number;
    dexterity: number;
    frail: number;
    softCap: number;
  };
}

export function calculateBlock(
  context: BlockCalculationContext,
  coefficients: RuntimeCoefficients = DEFAULT_RUNTIME_COEFFICIENTS
): BlockCalculationResult {
  const steps = {
    base: context.baseBlock,
    dexterity: 0,
    frail: 0,
    softCap: 0,
  };

  let current = context.baseBlock;

  const dexterityBonus = (context.dexterity ?? 0) * coefficients.block.dexterityPerStack;
  current += dexterityBonus;
  steps.dexterity = dexterityBonus;

  if (context.frail) {
    current = Math.floor(current * coefficients.block.frailMultiplier);
    steps.frail = current - steps.base - steps.dexterity;
  }

  const softCap = coefficients.softCaps.blockSoftCap;
  if (current > softCap) {
    current = softCap;
  }
  steps.softCap = current;

  return {
    finalBlock: current,
    steps,
  };
}

export interface StatusTickContext {
  status: 'poison' | 'burn' | 'regeneration' | 'ritual' | 'thorns' | 'platedArmor';
  stacks: number;
}

export interface StatusTickResult {
  damage?: number;
  heal?: number;
  strengthGain?: number;
  newStacks: number;
}

export function calculateStatusTick(
  context: StatusTickContext,
  coefficients: RuntimeCoefficients = DEFAULT_RUNTIME_COEFFICIENTS
): StatusTickResult {
  const { status, stacks } = context;

  switch (status) {
    case 'poison': {
      const damage = stacks * coefficients.status.poisonTickRate;
      return { damage, newStacks: Math.max(0, stacks - 1) };
    }
    case 'burn': {
      const damage = stacks * coefficients.status.burnTickRate;
      return { damage, newStacks: Math.max(0, stacks - 1) };
    }
    case 'regeneration': {
      const heal = stacks * coefficients.status.regenerationTickRate;
      return { heal, newStacks: Math.max(0, stacks - 1) };
    }
    case 'ritual': {
      const strengthGain = coefficients.status.ritualStrengthGain;
      return { strengthGain, newStacks: stacks };
    }
    case 'thorns': {
      return { damage: stacks * coefficients.status.thornsDamagePerStack, newStacks: stacks };
    }
    case 'platedArmor': {
      return { newStacks: Math.max(0, stacks - coefficients.status.platedArmorDecay) };
    }
    default:
      return { newStacks: stacks };
  }
}

export interface ResourceGainContext {
  resource: 'intel' | 'devotion' | 'corruption' | 'thread' | 'timeLayer' | 'concoction' | 'verdict' | 'seal';
  baseAmount: number;
  multipliers?: number[];
}

export function calculateResourceGain(
  context: ResourceGainContext,
  coefficients: RuntimeCoefficients = DEFAULT_RUNTIME_COEFFICIENTS
): number {
  const { resource, baseAmount, multipliers = [] } = context;

  const perStackKey = `${resource}PerStack` as keyof typeof coefficients.resource;
  const perStack = coefficients.resource[perStackKey] ?? 1;

  let result = baseAmount * perStack;

  for (const mult of multipliers) {
    result = Math.floor(result * mult);
  }

  return result;
}

export const runtimeCoefficients = {
  default: DEFAULT_RUNTIME_COEFFICIENTS,
  calculateDamage,
  calculateBlock,
  calculateStatusTick,
  calculateResourceGain,
};

export default runtimeCoefficients;
