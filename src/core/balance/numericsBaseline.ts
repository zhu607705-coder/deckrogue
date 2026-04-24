/**
 * @file numericsBaseline.ts
 * @description 数值基准配置 - 定义游戏数值平衡的基准常数
 *
 * 主要职责:
 * - 定义 EVU (Effective Value Unit) 基准值 (energy, damage, block, draw, gold, heal, status)
 * - 定义折价系数 (discounting: 延迟生效、触发概率、遗物触发率等)
 * - 定义风险系数 (risk: 安全阈值、危机系数、扭曲Alpha)
 * - 定义软上限配置 (caps: 伤害软上限、护甲软上限、状态叠加上限等)
 */
import type { NumericsBaseline } from '@/core/balance/numericsTypes';

export const NUMERICS_BASELINE: NumericsBaseline = {
  evu: {
    energy: 1,
    damage: 0.14,
    block: 0.16,
    armor: 0.22,
    draw: 0.34,
    gold: 0.02,
    heal: 0.1,
    status: 0.18
  },
  discounting: {
    delayedGamma: 0.82,
    conditionalTriggerRate: 0.7,
    relicTriggerRate: 1,
    expectedTurnsPerCombat: 5,
    expectedCombatsPerRun: 15
  },
  risk: {
    safeFloor: 0.92,
    perilK: 0.05,
    warpAlpha: 2
  },
  caps: {
    damageSoftCap: 200,
    damageSoftCapExcessRetention: 0.5,
    armorSoftCap: 30,
    statusSoftCapStacks: 10,
    statusSoftCapExcessRetention: 0.5
  },
  pricing: {
    cardCommon: 50,
    cardUncommon: 75,
    cardRare: 150,
    relicBase: 150,
    potionBase: 75,
    removalBase: 75,
    removalStep: 25
  }
} as const;
