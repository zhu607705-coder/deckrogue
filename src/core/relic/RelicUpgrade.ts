/**
 * @file RelicUpgrade.ts
 * @description 遗物升级系统 - 定义遗物升级配置和效果
 *
 * 主要职责:
 * - 定义 RelicUpgradeEffect 接口，描述遗物升级效果 (属性提升/触发增强/新能力)
 * - 定义 RelicUpgradeConfig 接口，描述遗物的多个升级等级
 * - 定义 RELIC_UPGRADE_CONFIGS 常量，列举所有可升级遗物的配置
 * - 提供遗物升级的查询和应用接口
 */
import type { GameState } from '@/core/types';

export interface RelicUpgradeEffect {
  statBoost?: Record<string, number>;
  triggerBoost?: number;
  newAbility?: string;
}

export interface RelicUpgradeLevel {
  level: number;
  cost: number;
  effect: RelicUpgradeEffect;
}

export interface RelicUpgradeConfig {
  relicId: string;
  levels: RelicUpgradeLevel[];
  maxLevel: number;
}

export const RELIC_UPGRADE_CONFIGS: RelicUpgradeConfig[] = [
  {
    relicId: 'burning_blood',
    maxLevel: 3,
    levels: [
      { level: 1, cost: 80, effect: { statBoost: { healPerCombat: 3 } } },
      { level: 2, cost: 120, effect: { statBoost: { healPerCombat: 4 } } },
      { level: 3, cost: 180, effect: { statBoost: { healPerCombat: 5 } } }
    ]
  },
  {
    relicId: 'bag_of_prep',
    maxLevel: 3,
    levels: [
      { level: 1, cost: 100, effect: { statBoost: { drawOnCombatStart: 1 } } },
      { level: 2, cost: 150, effect: { statBoost: { drawOnCombatStart: 1 } } },
      { level: 3, cost: 220, effect: { statBoost: { drawOnCombatStart: 1 } } }
    ]
  },
  {
    relicId: 'vajra',
    maxLevel: 3,
    levels: [
      { level: 1, cost: 90, effect: { statBoost: { strengthOnCombatStart: 1 } } },
      { level: 2, cost: 140, effect: { statBoost: { strengthOnCombatStart: 1 } } },
      { level: 3, cost: 200, effect: { statBoost: { strengthOnCombatStart: 1 } } }
    ]
  },
  {
    relicId: 'anchor',
    maxLevel: 3,
    levels: [
      { level: 1, cost: 85, effect: { statBoost: { blockOnCombatStart: 5 } } },
      { level: 2, cost: 130, effect: { statBoost: { blockOnCombatStart: 5 } } },
      { level: 3, cost: 190, effect: { statBoost: { blockOnCombatStart: 6 } } }
    ]
  },
  {
    relicId: 'lantern',
    maxLevel: 3,
    levels: [
      { level: 1, cost: 95, effect: { statBoost: { energyOnCombatStart: 1 } } },
      { level: 2, cost: 145, effect: { statBoost: { energyOnCombatStart: 1 } } },
      { level: 3, cost: 210, effect: { statBoost: { energyOnCombatStart: 1 } } }
    ]
  },
  {
    relicId: 'ruined_reactor',
    maxLevel: 3,
    levels: [
      { level: 1, cost: 130, effect: { statBoost: { energyPerTurn: 1, selfDamageReduction: 2 } } },
      { level: 2, cost: 180, effect: { statBoost: { energyPerTurn: 1, selfDamageReduction: 2 } } },
      { level: 3, cost: 250, effect: { statBoost: { energyPerTurn: 1, selfDamageReduction: 3 } } }
    ]
  },
  {
    relicId: 'martyrs_censer',
    maxLevel: 3,
    levels: [
      { level: 1, cost: 100, effect: { statBoost: { devotionOnLowHp: 4 } } },
      { level: 2, cost: 150, effect: { statBoost: { devotionOnLowHp: 4, removeExtraFear: 1 } } },
      { level: 3, cost: 220, effect: { statBoost: { devotionOnLowHp: 6, removeExtraFear: 1 } } }
    ]
  },
  {
    relicId: 'thorns_armor',
    maxLevel: 3,
    levels: [
      { level: 1, cost: 85, effect: { statBoost: { thornsDamage: 2 } } },
      { level: 2, cost: 130, effect: { statBoost: { thornsDamage: 2 } } },
      { level: 3, cost: 190, effect: { statBoost: { thornsDamage: 3 } } }
    ]
  },
  {
    relicId: 'chaos_sanctum_relic',
    maxLevel: 3,
    levels: [
      { level: 1, cost: 150, effect: { triggerBoost: 1 } },
      { level: 2, cost: 200, effect: { triggerBoost: 2 } },
      { level: 3, cost: 280, effect: { triggerBoost: 3 } }
    ]
  }
];

export class RelicUpgrade {
  private upgradeConfigs: Map<string, RelicUpgradeConfig>;

  constructor() {
    this.upgradeConfigs = new Map();
    for (const config of RELIC_UPGRADE_CONFIGS) {
      this.upgradeConfigs.set(config.relicId, config);
    }
  }

  public registerUpgradeConfig(config: RelicUpgradeConfig): void {
    this.upgradeConfigs.set(config.relicId, config);
  }

  public getUpgradeConfig(relicId: string): RelicUpgradeConfig | undefined {
    return this.upgradeConfigs.get(relicId);
  }

  public getMaxLevel(relicId: string): number {
    const config = this.upgradeConfigs.get(relicId);
    return config?.maxLevel || 0;
  }

  public isMaxLevel(relicId: string, currentLevel: number): boolean {
    const maxLevel = this.getMaxLevel(relicId);
    return currentLevel >= maxLevel;
  }

  public getUpgradeCost(relicId: string, targetLevel: number): number {
    const config = this.upgradeConfigs.get(relicId);
    if (!config) return 0;

    const levelConfig = config.levels.find(l => l.level === targetLevel);
    return levelConfig?.cost || 0;
  }

  public getNextUpgrade(relicId: string): RelicUpgradeLevel | null {
    const config = this.upgradeConfigs.get(relicId);
    if (!config) return null;

    const nextLevel = 1;
    return config.levels.find(l => l.level === nextLevel) || null;
  }

  public getUpgradeForLevel(relicId: string, level: number): RelicUpgradeLevel | null {
    const config = this.upgradeConfigs.get(relicId);
    if (!config) return null;

    return config.levels.find(l => l.level === level) || null;
  }

  public getAllUpgradesForRelic(relicId: string): RelicUpgradeLevel[] {
    const config = this.upgradeConfigs.get(relicId);
    return config?.levels || [];
  }

  public canUpgrade(relicId: string, currentLevel: number): boolean {
    if (!this.upgradeConfigs.has(relicId)) return false;
    return !this.isMaxLevel(relicId, currentLevel);
  }

  public upgradeRelic(
    relicId: string,
    currentLevel: number
  ): { newLevel: number; effect: RelicUpgradeEffect } | null {
    if (!this.canUpgrade(relicId, currentLevel)) {
      return null;
    }

    const config = this.upgradeConfigs.get(relicId);
    if (!config) return null;

    const nextLevel = currentLevel + 1;
    const upgradeLevel = config.levels.find(l => l.level === nextLevel);

    if (!upgradeLevel) return null;

    return {
      newLevel: nextLevel,
      effect: upgradeLevel.effect
    };
  }

  public getTotalUpgradeCost(relicId: string, fromLevel: number, toLevel: number): number {
    const config = this.upgradeConfigs.get(relicId);
    if (!config) return 0;

    let totalCost = 0;
    for (let i = fromLevel + 1; i <= toLevel; i++) {
      const levelConfig = config.levels.find(l => l.level === i);
      if (levelConfig) {
        totalCost += levelConfig.cost;
      }
    }
    return totalCost;
  }

  public getCumulativeEffect(relicId: string, upToLevel: number): RelicUpgradeEffect {
    const config = this.upgradeConfigs.get(relicId);
    if (!config) return {};

    const cumulativeEffect: RelicUpgradeEffect = {};

    for (const levelConfig of config.levels) {
      if (levelConfig.level > upToLevel) break;

      if (levelConfig.effect.statBoost) {
        cumulativeEffect.statBoost ||= {};
        for (const [stat, value] of Object.entries(levelConfig.effect.statBoost)) {
          cumulativeEffect.statBoost[stat] = (cumulativeEffect.statBoost[stat] || 0) + value;
        }
      }

      if (levelConfig.effect.triggerBoost) {
        cumulativeEffect.triggerBoost = (cumulativeEffect.triggerBoost || 0) + levelConfig.effect.triggerBoost;
      }

      if (levelConfig.effect.newAbility) {
        cumulativeEffect.newAbility = levelConfig.effect.newAbility;
      }
    }

    return cumulativeEffect;
  }

  public applyUpgradeToState(state: GameState, relicId: string): boolean {
    if (!state.player) return false;
    if (!state.player.relicStates) return false;

    const relicState = state.player.relicStates[relicId];
    if (!relicState) return false;

    const upgradeResult = this.upgradeRelic(relicId, relicState.level);
    if (!upgradeResult) return false;

    relicState.level = upgradeResult.newLevel;
    return true;
  }

  public canAffordUpgrade(
    state: GameState,
    relicId: string,
    currentLevel: number,
    gold: number
  ): boolean {
    if (!this.canUpgrade(relicId, currentLevel)) return false;

    const cost = this.getUpgradeCost(relicId, currentLevel + 1);
    return gold >= cost;
  }

  public getUpgradeDescription(relicId: string, level: number): string {
    const upgrade = this.getUpgradeForLevel(relicId, level);
    if (!upgrade) return '';

    const parts: string[] = [];

    if (upgrade.effect.statBoost) {
      for (const [stat, value] of Object.entries(upgrade.effect.statBoost)) {
        parts.push(`${stat}: +${value}`);
      }
    }

    if (upgrade.effect.triggerBoost) {
      parts.push(`触发效果: +${upgrade.effect.triggerBoost}`);
    }

    if (upgrade.effect.newAbility) {
      parts.push(`新能力: ${upgrade.effect.newAbility}`);
    }

    return parts.join(', ') || '无效果';
  }
}

let globalRelicUpgrade: RelicUpgrade | null = null;

export const createRelicUpgrade = (): RelicUpgrade => {
  globalRelicUpgrade = new RelicUpgrade();
  return globalRelicUpgrade;
};

export const getRelicUpgrade = (): RelicUpgrade | null => {
  return globalRelicUpgrade;
};
