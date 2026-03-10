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
