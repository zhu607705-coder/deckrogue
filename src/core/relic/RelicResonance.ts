/**
 * @file RelicResonance.ts
 * @description 遗物共鸣系统 - 管理遗物套装共鸣效果
 *
 * 主要职责:
 * - 定义 ResonanceSet 接口，描述共鸣套装 (遗物组合 + 套装奖励)
 * - 定义 ResonanceBonus 接口，描述共鸣奖励 (passive/triggered/enhanced)
 * - 定义 RESONANCE_SETS 常量，列举所有共鸣套装配置
 * - 提供共鸣激活和效果计算的接口
 */
import type { CombatState } from '@/core/types/combat';

export type ResonanceBonusType = 'passive' | 'triggered' | 'enhanced';

export interface CombatModifier {
  turnReduction?: number;
  extraAction?: boolean;
}

export interface ResonanceEffect {
  combatModifier?: CombatModifier;
  statBoost?: { energy?: number; draw?: number };
  enhancedAbility?: string;
}

export interface ResonanceBonus {
  type: ResonanceBonusType;
  effect: ResonanceEffect;
  stackable: boolean;
}

export interface ResonanceSet {
  id: string;
  relics: string[];
  bonus: ResonanceBonus;
  description: string;
}

export const RESONANCE_SETS: ResonanceSet[] = [
  {
    id: 'time_master',
    relics: ['warp_distorter', 'corrupted_tome', 'mechanicus_coolant'],
    bonus: {
      type: 'enhanced',
      effect: {
        combatModifier: {
          turnReduction: 1,
          extraAction: true
        }
      },
      stackable: false
    },
    description: 'Temporal Mastery: Extra action each turn'
  },
  {
    id: 'berserker_frenzy',
    relics: ['martyrs_censer', 'seal_of_martyrdom', 'corrupted_relic'],
    bonus: {
      type: 'triggered',
      effect: {
        enhancedAbility: 'damage_boost_low_hp'
      },
      stackable: true
    },
    description: 'Death Seeking: Massive damage boost when low HP'
  },
  {
    id: 'tech_superiority',
    relics: ['lantern', 'ruined_reactor', 'anchor'],
    bonus: {
      type: 'passive',
      effect: {
        statBoost: { energy: 1, draw: 1 }
      },
      stackable: true
    },
    description: 'Mechanical Advantage: Extra energy and card draw'
  },
  {
    id: 'faith_shield',
    relics: ['burning_blood', 'bag_of_prep', 'corrupted_tome'],
    bonus: {
      type: 'triggered',
      effect: {
        enhancedAbility: 'healing_on_damage'
      },
      stackable: true
    },
    description: 'Blessed Resilience: Heal when dealing damage'
  }
];

export function detectActiveResonances(playerRelics: string[]): ResonanceSet[] {
  return RESONANCE_SETS.filter(set =>
    set.relics.every(relic => playerRelics.includes(relic))
  );
}

export function applyResonanceBonuses(
  combatState: CombatState,
  resonances: ResonanceSet[]
): CombatState {
  const updatedState = { ...combatState };

  if (!updatedState.player) {
    return combatState;
  }

  for (const resonance of resonances) {
    if (resonance.bonus.type === 'passive' && resonance.bonus.effect.statBoost) {
      const statBoost = resonance.bonus.effect.statBoost;
      if (statBoost.energy) {
        updatedState.player.energy += statBoost.energy;
      }
    }

    if (resonance.bonus.type === 'enhanced' && resonance.bonus.effect.combatModifier) {
      const modifier = resonance.bonus.effect.combatModifier;
      if (modifier.turnReduction) {
        updatedState.turn = Math.max(1, updatedState.turn - modifier.turnReduction);
      }
    }
  }

  return updatedState;
}

export function getResonanceDescription(setId: string): string {
  const set = RESONANCE_SETS.find(s => s.id === setId);
  return set?.description || '';
}

export function getResonanceSetById(setId: string): ResonanceSet | undefined {
  return RESONANCE_SETS.find(s => s.id === setId);
}

export function getAllResonanceSets(): ResonanceSet[] {
  return [...RESONANCE_SETS];
}
