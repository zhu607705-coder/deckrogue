/**
 * @file balanceSystem.ts
 * @description 平衡系统核心 - 管理游戏数值平衡的核心逻辑
 *
 * 主要职责:
 * - 定义 CardEvaluation 和 RelicEvaluation 接口，描述卡牌和遗物的数值评估结果
 * - 提供资源价值换算 (energy, damage, block, draw, gold, hp, status 的 EVU 换算)
 * - 管理平衡常量和调整系数
 * - 支持数值诊断报告的生成
 */
import { BALANCE_CONSTANTS } from '@/core/balance/numericConstants';
import {
  calculateEnemyRuntimeScaling,
  quoteCardPrice,
  quotePotionPrice,
  quoteRelicPrice,
  quoteRemovalPrice
} from '@/core/balance/numericsRuntime';
import { classifyVarianceFromTags, multiHitAdjustedDamage, statusToEVU } from '@/core/balance/numericsFormulas';
import {
  createValuationContext,
  evaluateCardEVU,
  evaluateCardEfficiency as evaluateCardEfficiencyFromInput,
  evaluateRelicEVU
} from '@/core/balance/numericsValuation';

export interface ResourceValue {
  energy: number;
  damage: number;
  block: number;
  draw: number;
  gold: number;
  hp: number;
  status: number;
}

export interface CardEvaluation {
  id: string;
  name: string;
  cost: number;
  value: number;
  efficiency: number;
  rating: 'excellent' | 'good' | 'average' | 'poor' | 'terrible';
  synergies: string[];
  antiSynergies: string[];
}

export interface RelicEvaluation {
  id: string;
  name: string;
  price: number;
  valuePerCombat: number;
  valuePerTurn: number;
  overallValue: number;
  rating: 'excellent' | 'good' | 'average' | 'poor' | 'terrible';
  synergies: string[];
  antiSynergies: string[];
}

export class BalanceSystem {
  private context = createValuationContext();
  private baseValues: ResourceValue = {
    ...BALANCE_CONSTANTS.resourceValues
  };

  private scalingFactors: Record<string, number> = {
    ...BALANCE_CONSTANTS.scalingFactors
  };

  constructor() {
    // Initialize balance system
  }

  getCardPrice(rarity: string): number {
    if (rarity === 'Rare') return BALANCE_CONSTANTS.prices.cardRare;
    if (rarity === 'Uncommon') return BALANCE_CONSTANTS.prices.cardUncommon;
    return BALANCE_CONSTANTS.prices.cardCommon;
  }

  /**
   * Convert energy cost to equivalent damage
   */
  energyToDamage(energy: number): number {
    return energy / this.baseValues.damage;
  }

  /**
   * Convert damage to equivalent energy
   */
  damageToEnergy(damage: number): number {
    return damage * this.baseValues.damage;
  }

  /**
   * Convert energy cost to equivalent block
   */
  energyToBlock(energy: number): number {
    return energy / this.baseValues.block;
  }

  /**
   * Convert block to equivalent energy
   */
  blockToEnergy(block: number): number {
    return block * this.baseValues.block;
  }

  /**
   * Convert energy cost to equivalent card draw
   */
  energyToDraw(energy: number): number {
    return energy / this.baseValues.draw;
  }

  /**
   * Convert card draw to equivalent energy
   */
  drawToEnergy(draw: number): number {
    return draw * this.baseValues.draw;
  }

  /**
   * Calculate total card value based on its effects
   */
  calculateCardValue(
    cost: number,
    damage: number = 0,
    block: number = 0,
    draw: number = 0,
    statusEffects: Record<string, number> = {},
    type: string = 'attack',
    rarity: string = 'common'
  ): number {
    return evaluateCardEVU(this.context, {
      cost,
      damage,
      block,
      draw,
      statuses: Object.entries(statusEffects).map(([status, stacks]) => ({
        status,
        stacks: Number(stacks) || 0
      })),
      type,
      rarity,
      variance: classifyVarianceFromTags([type])
    });
  }

  /**
   * Evaluate card efficiency
   */
  evaluateCardEfficiency(value: number, cost: number): number {
    if (cost <= 0) return value * BALANCE_CONSTANTS.freeCardValueMultiplier; // Free cards are extra valuable
    return value / Math.max(0.25, cost * this.baseValues.energy);
  }

  evaluateCardEfficiencyFromInput(input: {
    cost: number;
    damage?: number;
    block?: number;
    draw?: number;
    armor?: number;
    heal?: number;
    statuses?: Record<string, number>;
    type?: string;
    rarity?: string;
    tags?: string[];
  }): number {
    return evaluateCardEfficiencyFromInput(this.context, {
      cost: input.cost,
      damage: input.damage,
      block: input.block,
      draw: input.draw,
      armor: input.armor,
      heal: input.heal,
      statuses: Object.entries(input.statuses || {}).map(([status, stacks]) => ({ status, stacks })),
      type: input.type,
      rarity: input.rarity,
      variance: classifyVarianceFromTags(input.tags || [])
    });
  }

  /**
   * Calculate relic value per combat
   */
  calculateRelicValuePerCombat(
    effectValue: number,
    triggerRate: number = BALANCE_CONSTANTS.expectations.relicTriggerRate,
    duration: number = BALANCE_CONSTANTS.expectations.relicDuration
  ): number {
    return evaluateRelicEVU(this.context, {
      effectEVU: effectValue,
      triggerRate,
      durationTurns: duration
    });
  }

  /**
   * Calculate relic value per turn
   */
  calculateRelicValuePerTurn(
    effectValue: number,
    triggerRate: number = BALANCE_CONSTANTS.expectations.relicTriggerRate
  ): number {
    return effectValue * triggerRate;
  }

  /**
   * Calculate overall relic value
   */
  calculateRelicOverallValue(
    valuePerCombat: number,
    valuePerTurn: number,
    expectedCombats: number = BALANCE_CONSTANTS.expectations.expectedCombats,
    expectedTurnsPerCombat: number = BALANCE_CONSTANTS.expectations.expectedTurnsPerCombat
  ): number {
    return (
      valuePerCombat * expectedCombats +
      valuePerTurn * expectedCombats * expectedTurnsPerCombat
    );
  }

  /**
   * Rate card based on efficiency
   */
  rateCard(efficiency: number): 'excellent' | 'good' | 'average' | 'poor' | 'terrible' {
    if (efficiency >= BALANCE_CONSTANTS.ratingThresholds.card.excellent) return 'excellent';
    if (efficiency >= BALANCE_CONSTANTS.ratingThresholds.card.good) return 'good';
    if (efficiency >= BALANCE_CONSTANTS.ratingThresholds.card.average) return 'average';
    if (efficiency >= BALANCE_CONSTANTS.ratingThresholds.card.poor) return 'poor';
    return 'terrible';
  }

  /**
   * Rate relic based on overall value
   */
  rateRelic(value: number, price: number): 'excellent' | 'good' | 'average' | 'poor' | 'terrible' {
    const efficiency = value / price;
    if (efficiency >= BALANCE_CONSTANTS.ratingThresholds.relic.excellent) return 'excellent';
    if (efficiency >= BALANCE_CONSTANTS.ratingThresholds.relic.good) return 'good';
    if (efficiency >= BALANCE_CONSTANTS.ratingThresholds.relic.average) return 'average';
    if (efficiency >= BALANCE_CONSTANTS.ratingThresholds.relic.poor) return 'poor';
    return 'terrible';
  }

  /**
   * Calculate scaling damage for multi-hit attacks
   */
  calculateMultiHitDamage(baseDamage: number, hits: number): number {
    return multiHitAdjustedDamage(
      baseDamage,
      hits,
      BALANCE_CONSTANTS.multiHit.perAdditionalHitPenalty,
      BALANCE_CONSTANTS.multiHit.minScalingFactor
    );
  }

  /**
   * Calculate gold cost for card removal
   */
  calculateCardRemovalCost(removedCards: number): number {
    return quoteRemovalPrice(removedCards);
  }

  /**
   * Calculate expected gold gain per combat
   */
  calculateExpectedGoldGain(floor: number, isElite: boolean = false, isBoss: boolean = false): number {
    let baseGold = BALANCE_CONSTANTS.rewardScaling.baseGoldReward + floor * BALANCE_CONSTANTS.rewardScaling.goldPerFloor;
    
    if (isBoss) {
      baseGold *= BALANCE_CONSTANTS.rewardScaling.bossGoldMultiplier;
    } else if (isElite) {
      baseGold *= BALANCE_CONSTANTS.rewardScaling.eliteGoldMultiplier;
    }
    
    return baseGold;
  }

  /**
   * Calculate expected card rewards per combat
   */
  calculateExpectedCardRewards(floor: number, isElite: boolean = false, isBoss: boolean = false): number {
    if (isBoss) return BALANCE_CONSTANTS.rewardScaling.bossCardRewards;
    if (isElite) return BALANCE_CONSTANTS.rewardScaling.eliteCardRewards;
    return BALANCE_CONSTANTS.rewardScaling.baseCardRewards + floor * BALANCE_CONSTANTS.rewardScaling.cardsPerFloor;
  }

  /**
   * Calculate enemy hp scaling per floor
   */
  calculateEnemyHpScaling(baseHp: number, floor: number): number {
    return Math.floor(baseHp * calculateEnemyRuntimeScaling(floor).hpMultiplier);
  }

  /**
   * Calculate enemy damage scaling per floor
   */
  calculateEnemyDamageScaling(baseDamage: number, floor: number): number {
    return Math.floor(baseDamage * calculateEnemyRuntimeScaling(floor).damageMultiplier);
  }

  /**
   * Calculate soft cap for status effects
   */
  calculateStatusSoftCap(baseValue: number, stacks: number): number {
    const factor = baseValue / Math.max(0.0001, this.baseValues.status);
    return statusToEVU(stacks, factor) / Math.max(0.0001, this.baseValues.status);
  }

  /**
   * Calculate relic price based on value
   */
  calculateRelicPrice(value: number): number {
    return quoteRelicPrice(value).gold;
  }

  /**
   * Calculate potion price based on value
   */
  calculatePotionPrice(value: number): number {
    return quotePotionPrice(value).gold;
  }

  quoteCardShopPrice(value: number, rarity: string = 'common'): number {
    const rarityFactor = this.scalingFactors[rarity] || BALANCE_CONSTANTS.defaultFactor;
    return quoteCardPrice(value, rarityFactor).gold;
  }
}

export const balanceSystem = new BalanceSystem();
