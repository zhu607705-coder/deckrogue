/**
 * @file useCombatTelemetry.ts
 * @description 战斗遥测 Hook - 从战斗引擎提取结构化的敌人/构造体状态数据
 *
 * 主要职责:
 * - 提取敌人状态和意图数据
 * - 计算意图威胁等级和色调
 * - 处理构造体状态和数值修正
 */

import { useMemo, useCallback } from 'react';
import type { GameEngine } from '@/core';
import { enemiesData } from '@/content/narrative/numericSystem';

type RuntimeCombatState = NonNullable<GameEngine['state']['combat']>;
type RuntimeEnemy = RuntimeCombatState['enemies'][number];
type RuntimeConstruct = RuntimeCombatState['player']['constructs'][number];
type IntentTone = 'attack' | 'block' | 'status' | 'hybrid' | 'neutral' | 'unknown';

interface TelemetryResult {
  frontlineTauntConstruct: RuntimeConstruct | null;
  frontlineCoverConstruct: RuntimeConstruct | null;
  intentTelemetry: IntentTelemetryEntry[];
}

interface IntentBreakdown {
  totalDamage: number;
  hits: number[];
  block: number;
  statuses: Array<{ status: string; amount: number; target: 'self' | 'player' }>;
  extras: string[];
}

interface IntentDisplayShape {
  icon: string;
  text: string;
  tone: IntentTone;
  breakdown: IntentBreakdown;
  isWarpMasquerade?: boolean;
}

interface IntentTelemetryEntry {
  enemyId: string;
  enemyX: number;
  laneY: number;
  incoming: number;
  frontlineAbsorb: number;
  frontlineOverflow: number;
  playerDamage: number;
  frontlineLabel: string;
  mode: 'taunt' | 'cover' | 'direct';
}

type NumericEnemyDef = (typeof enemiesData)[number];
type EnemyMoveAction = NumericEnemyDef['moves'][string][number];
type EnemyMove = EnemyMoveAction[];

export function useCombatTelemetry(engine: GameEngine, hoveredEnemyId: string | null): TelemetryResult {
  const state = engine.state.combat!;
  const player = state.player;
  const hasIntelRead = (engine.state.player.intel || 0) > 0;

  const frontlineTauntConstruct = useMemo((): RuntimeConstruct | null => {
    return (player.constructs || []).find((c) => c.taunt && c.hp > 0) || null;
  }, [player.constructs]);

  const frontlineCoverConstruct = useMemo((): RuntimeConstruct | null => {
    if (frontlineTauntConstruct) return null;
    return (player.constructs || []).find((c) => (c.damageSharePct || 0) > 0 && c.hp > 0) || null;
  }, [player.constructs, frontlineTauntConstruct]);

  const intentTelemetry = useMemo((): IntentTelemetryEntry[] => {
    return state.enemies.map((enemy, idx: number): IntentTelemetryEntry | null => {
      if (!enemy || enemy.hp <= 0) return null;
      
      const rawIntent = getIntentDisplay(enemy, state, engine);
      const incoming = Math.max(0, Math.floor(rawIntent?.breakdown?.totalDamage || 0));
      if (incoming <= 0) return null;

      let frontlineAbsorb = 0;
      let frontlineOverflow = 0;
      let playerDamage = incoming;
      let frontlineLabel = '';
      let mode: 'taunt' | 'cover' | 'direct' = 'direct';

      if (frontlineTauntConstruct) {
        mode = 'taunt';
        frontlineAbsorb = Math.min(incoming, Math.max(0, frontlineTauntConstruct.hp || 0));
        frontlineOverflow = Math.max(
          0,
          (frontlineTauntConstruct as RuntimeConstruct & { overflowDamageToPlayer?: boolean }).overflowDamageToPlayer ? incoming - frontlineAbsorb : 0
        );
        playerDamage = frontlineOverflow;
        frontlineLabel = hasIntelRead ? `${frontlineAbsorb} 拦截` : '拦截路径';
      } else if (frontlineCoverConstruct) {
        mode = 'cover';
        const pct = Math.max(0, Math.min(0.95, Number(frontlineCoverConstruct.damageSharePct || 0)));
        const nominalShared = Math.floor(incoming * pct);
        frontlineAbsorb = Math.min(nominalShared, Math.max(0, frontlineCoverConstruct.hp || 0));
        frontlineOverflow = Math.max(0, nominalShared - frontlineAbsorb);
        playerDamage = Math.max(0, incoming - nominalShared + frontlineOverflow);
        frontlineLabel = hasIntelRead ? `${frontlineAbsorb} 分担` : '分担路径';
      }

      const enemyCount = Math.max(1, state.enemies.length);
      const enemyX = enemyCount === 1 ? 86 : 72 + (idx * (18 / Math.max(1, enemyCount - 1)));
      const laneY = 50 + ((idx % 2 === 0 ? -1 : 1) * (enemyCount > 1 ? 5 : 0));

      return {
        enemyId: enemy.id,
        enemyX,
        laneY,
        incoming,
        frontlineAbsorb,
        frontlineOverflow,
        playerDamage,
        frontlineLabel,
        mode
      };
    }).filter((item): item is IntentTelemetryEntry => item !== null);
  }, [state.enemies, frontlineTauntConstruct, frontlineCoverConstruct, hasIntelRead, state, engine]);

  return { frontlineTauntConstruct, frontlineCoverConstruct, intentTelemetry };
}

function getIntentDisplay(enemy: RuntimeEnemy, state: { 
  player: { statuses: Record<string, number> }; 
  warpTide: number; 
  warpPerilK?: number;
  warpRiftTurns?: number;
  warpRiftPerilFloor?: number;
}, engine: GameEngine): IntentDisplayShape {
  if (enemy.autonomyState === 'ChaosEgg') {
    return {
      icon: '🧬',
      text: 'Flesh Change',
      tone: 'status',
      breakdown: {
        totalDamage: 8,
        hits: [8],
        block: 10,
        statuses: [{ status: 'FleshChange', amount: enemy.statuses?.FleshChange || 1, target: 'self' }],
        extras: ['Random violent behavior', 'Mutated autonomy']
      }
    };
  }
  if (enemy.autonomyState === 'Martyr') {
    const damage = engine.calculateDamage(14, enemy.statuses || {}, state.player.statuses || {}, 'enemy');
    return {
      icon: '✝',
      text: 'Martyr Rush',
      tone: 'attack',
      breakdown: {
        totalDamage: damage,
        hits: [damage],
        block: 0,
        statuses: [{ status: 'MartyrsVigor', amount: enemy.statuses?.MartyrsVigor || 1, target: 'self' }],
        extras: ['Suicidal charge', `${enemy.autonomyTurns || 0} turns left`]
      }
    };
  }
  
  const def = enemiesData.find((e) => e.id === enemy.defId) as NumericEnemyDef | undefined;
  const move = enemy.nextIntent ? def?.moves?.[enemy.nextIntent] : undefined;
  
  if (!move) {
    return {
      icon: '…',
      text: enemy.nextIntent || 'Intent',
      tone: 'neutral',
      breakdown: { totalDamage: 0, hits: [], block: 0, statuses: [], extras: [] }
    };
  }

  const breakdown: IntentBreakdown = {
    totalDamage: 0,
    hits: [],
    block: 0,
    statuses: [],
    extras: []
  };
  
  const attackSuppressedByStealth = Boolean(state.player.statuses['Stealth']) && move.some((a: EnemyMoveAction) => a.type === 'DealDamage' || a.type === 'DealWarpDamage');
  const basePeril = engine.getWarpPerilChance(state.warpTide, state.warpPerilK);
  const effectivePeril = Math.max(basePeril, (state.warpRiftTurns || 0) > 0 ? (state.warpRiftPerilFloor || 0) : 0);
  const warpPerilPct = Math.round(effectivePeril * 100);

  move.forEach((action: EnemyMoveAction) => {
    if (action.type === 'DealDamage' || action.type === 'DealWarpDamage') {
      let amount = action.amount || 0;
      if (action.type === 'DealWarpDamage') {
        const alpha = engine.getWarpEffectiveAlpha(typeof action.alpha === 'number' ? action.alpha : undefined);
        amount = Math.max(0, Math.floor(amount * engine.getWarpPowerMultiplier(state.warpTide, alpha)));
        breakdown.extras.push(`Warp x${engine.getWarpPowerMultiplier(state.warpTide, alpha).toFixed(2)}`);
      }
      const adjusted = attackSuppressedByStealth ? 0 : engine.calculateDamage(amount, enemy.statuses, state.player.statuses, 'enemy');
      breakdown.hits.push(adjusted);
      breakdown.totalDamage += adjusted;
    } else if (action.type === 'GainBlock') {
      breakdown.block += action.amount || 0;
    } else if (action.type === 'ModifyWarpTide') {
      breakdown.extras.push(`Warp Tide ${action.amount && action.amount > 0 ? '+' : ''}${action.amount || 0}`);
    } else if (action.type === 'CheckWarpPeril') {
      breakdown.extras.push(`Peril ${warpPerilPct}%`);
    } else if (action.type === 'ApplyStatus' && action.status) {
      const target =
        action.target === 'Self' ? 'self' :
        action.target === 'AllEnemies' ? 'player' :
        action.target === 'RandomEnemy' ? 'player' :
        'player';
      breakdown.statuses.push({ status: action.status, amount: action.amount || 0, target });
    } else if (action.type === 'HealSelf') {
      breakdown.extras.push(`Heal ${action.amount || 0}`);
    } else if (action.type === 'SummonEnemy') {
      breakdown.extras.push(`Summon ${action.unit || 'Minion'}`);
    } else if (action.type === 'BuffAllEnemies') {
      breakdown.extras.push(`Allies +${action.amount || 0} STR`);
    } else if (action.type === 'PredictorAction') {
      breakdown.extras.push('Adaptive: 8 DMG or +10 Block');
    }
  });

  if (attackSuppressedByStealth) {
    breakdown.extras.unshift('Misses into Stealth');
  }

  const hasIntelRead = (engine.state.player.intel || 0) > 0;
  const primaryStatus = breakdown.statuses[0]?.status;
  
  if (!hasIntelRead) {
    if (attackSuppressedByStealth && breakdown.block > 0) {
      return { icon: '◌', text: 'Miss + Guard', tone: 'hybrid', breakdown };
    }
    if (attackSuppressedByStealth) {
      return { icon: '◌', text: 'Miss', tone: 'neutral', breakdown };
    }
    if (breakdown.totalDamage > 0 && breakdown.block > 0) {
      return { icon: '⚔️', text: 'Attack + Guard', tone: 'hybrid', breakdown };
    }
    if (breakdown.totalDamage > 0) {
      return { icon: '⚔️', text: 'Attack', tone: 'attack', breakdown };
    }
    if (breakdown.block > 0) {
      return { icon: '🛡️', text: 'Guard', tone: 'block', breakdown };
    }
    if (primaryStatus) {
      return { icon: '✦', text: 'Buff / Debuff', tone: 'status', breakdown };
    }
    if (breakdown.extras.length > 0) {
      return { icon: '✦', text: 'Special', tone: 'status', breakdown };
    }
  }
  
  if (attackSuppressedByStealth && breakdown.block > 0) {
    return { icon: '◌', text: `Miss +${breakdown.block}🛡`, tone: 'hybrid', breakdown };
  }
  if (attackSuppressedByStealth) {
    return { icon: '◌', text: 'Miss', tone: 'neutral', breakdown };
  }
  if (breakdown.totalDamage > 0 && breakdown.block > 0) {
    return { icon: '⚔️', text: `${breakdown.totalDamage} +${breakdown.block}🛡`, tone: 'hybrid', breakdown };
  }
  if (breakdown.totalDamage > 0) {
    return { icon: '⚔️', text: String(breakdown.totalDamage), tone: 'attack', breakdown };
  }
  if (breakdown.block > 0) {
    return { icon: '🛡️', text: String(breakdown.block), tone: 'block', breakdown };
  }
  if (primaryStatus) {
    return { icon: '✦', text: primaryStatus, tone: 'status', breakdown };
  }
  if (breakdown.extras.length > 0) {
    return { icon: '✦', text: breakdown.extras[0], tone: 'status', breakdown };
  }
  return { icon: '…', text: enemy.nextIntent || 'Intent', tone: 'neutral', breakdown };
}
