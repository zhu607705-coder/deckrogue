#!/usr/bin/env node

/**
 * @file test_destructive.ts
 * @description 运行破坏性测试验证系统在极端条件下的健壮性。
 *
 * 主要职责:
 * - 执行极端伤害、抽牌、中毒等边界测试
 * - 验证负值块、能量增益、状态减少等情况
 * - 报告破坏性测试通过情况
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync } from 'fs';

import type { GameState, RunCardInstance } from '@/core/types';
import { ActionQueue } from '@/core/actions/actionQueue';
import { ActionFactoryV2 } from '@/core/actions/v2/ActionFactory';
import { combatSystem } from '@/core/combat/combatSystem';

const REPORT_DIR = 'reports/system';
const REPORT_PATH = `${REPORT_DIR}/destructive-suite.json`;
const LOG_STAMP = Date.now();

interface DestructiveCase {
  id: string;
  category: 'resource_extreme' | 'numeric_extreme' | 'status_extreme';
  status: 'pass' | 'fail';
  classification: 'allow_and_controlled' | 'acceptable_extreme' | 'must_fix';
  evidence: Record<string, unknown>;
}

interface DestructiveReport {
  timestamp: string;
  unitTestCommand: string;
  unitTests: {
    passed: boolean;
    logPath?: string;
  };
  cases: DestructiveCase[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    overallStatus: 'pass' | 'fail';
  };
}

function ensureDir(dir: string) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function makeCard(id: string, instanceId: string): RunCardInstance {
  return {
    id,
    instanceId,
    baseCardId: id,
    name: id,
    rarity: 'Common',
    cost: 0,
    type: 'Skill',
    targeting: 'None',
    tags: [],
    text: id,
    actions: [],
    runtimeBase: {
      id,
      name: id,
      rarity: 'Common',
      cost: 0,
      type: 'Skill',
      targeting: 'None',
      tags: [],
      text: id,
      actions: []
    },
    persistentEnchantments: [],
    combatAfflictions: []
  };
}

function makeState(): GameState {
  return {
    seed: 77,
    rngState: 0,
    runId: 'destructive_suite',
    runStartedAt: Date.now(),
    character: null,
    player: {
      hp: 100,
      maxHp: 100,
      energy: 3,
      maxEnergy: 3,
      gold: 0,
      intel: 0,
      deck: [],
      relics: [],
      potions: [],
      corruption: 0,
      devotion: 0,
      relicStates: {},
      runEffects: {}
    },
    combat: {
      player: {
        hp: 100,
        maxHp: 100,
        block: 0,
        energy: 3,
        statuses: {},
        delayedCards: [],
        constructs: [],
        elements: [],
        potionToxicity: 0,
        potionsUsedThisTurn: 0,
        cardsPlayedThisTurn: 0,
        damageTakenThisTurn: 0,
        damageTakenLastTurn: 0,
        intel: 0,
        devotion: 0,
        corruptionAxis: 0,
        axisDisposition: 'balanced'
      },
      enemies: [{
        id: 'target',
        defId: 'boss_test',
        name: 'Target',
        hp: 5000,
        maxHp: 5000,
        block: 0,
        statuses: {} as Record<string, number>,
        nextIntent: 'Attack',
        lastUsedIntent: '',
        intentCooldowns: {} as Record<string, number>,
        devotion: 0,
        corruptionAxis: 0,
        axisDisposition: 'balanced'
      }],
      drawPile: [],
      hand: [],
      discardPile: [],
      exhaustPile: [],
      turn: 1,
      isPlayerTurn: true,
      warpTide: 0,
      warpAlpha: 0.5,
      warpPerilK: 0.05
    },
    map: [],
    currentNodeId: null,
    rewardCards: [],
    shopCards: [],
    shopRelics: [],
    shopPotions: [],
    cardRemovalCost: 75,
    screen: 'Combat',
    pendingNodeResolution: false,
    campfireChoiceLocked: false,
    combatVoxLog: [],
    lastCombatVoxLog: [],
    lastDeathVoxLog: []
  };
}

function runUnitTests(): { passed: boolean; logPath: string } {
  ensureDir(REPORT_DIR);
  const logPath = `${REPORT_DIR}/destructive-tests-${LOG_STAMP}.log`;
  try {
    const output = execSync('npx tsx --test tests/unit/destructiveRegression.test.ts', {
      encoding: 'utf-8',
      maxBuffer: 50 * 1024 * 1024
    });
    writeFileSync(logPath, output);
    return { passed: true, logPath };
  } catch (error: any) {
    const output = `${error.stdout || ''}\n${error.stderr || ''}`;
    writeFileSync(logPath, output);
    return { passed: false, logPath };
  }
}

function extremeDamageCase(): DestructiveCase {
  const state = makeState();
  const damage = combatSystem.applyDamage(state, {
    amount: 9999,
    sourceType: 'player',
    sourceId: 'player',
    targetType: 'enemy',
    targetId: 'target',
    modifiers: [],
    isTrueDamage: true,
    ignoreBlock: true
  });

  const ok = damage === 5000 && state.combat!.enemies[0].hp === 0;
  return {
    id: 'extreme_damage_9999',
    category: 'numeric_extreme',
    status: ok ? 'pass' : 'fail',
    classification: ok ? 'acceptable_extreme' : 'must_fix',
    evidence: {
      actualDamage: damage,
      targetHp: state.combat!.enemies[0].hp
    }
  };
}

function extremeDrawCase(): DestructiveCase {
  const state = makeState();
  state.combat!.discardPile = [makeCard('c1', 'c1'), makeCard('c2', 'c2'), makeCard('c3', 'c3')];
  const action = ActionFactoryV2.createAction({ type: 'Draw', amount: 999 });
  action.execute(state, new ActionQueue());

  const ok = state.combat!.hand.length === 3 && state.combat!.drawPile.length === 0 && state.combat!.discardPile.length === 0;
  return {
    id: 'extreme_draw_999',
    category: 'resource_extreme',
    status: ok ? 'pass' : 'fail',
    classification: ok ? 'allow_and_controlled' : 'must_fix',
    evidence: {
      handSize: state.combat!.hand.length,
      drawPileSize: state.combat!.drawPile.length,
      discardPileSize: state.combat!.discardPile.length
    }
  };
}

function extremePoisonCase(): DestructiveCase {
  const state = makeState();
  combatSystem.applyStatus(state, 'enemy', 'target', 'Poison', 1_000_000);
  const poison = state.combat!.enemies[0].statuses.Poison;
  const ok = poison === 1_000_000 && Number.isFinite(poison);
  return {
    id: 'extreme_poison_stack',
    category: 'status_extreme',
    status: ok ? 'pass' : 'fail',
    classification: ok ? 'acceptable_extreme' : 'must_fix',
    evidence: { poison }
  };
}

function negativeBlockCase(): DestructiveCase {
  const state = makeState();
  state.combat!.player.block = 2;
  combatSystem.gainBlock(state, 'player', 'player', -10);
  const block = state.combat!.player.block;
  const ok = block === 0;
  return {
    id: 'negative_block_underflow_guard',
    category: 'numeric_extreme',
    status: ok ? 'pass' : 'fail',
    classification: ok ? 'allow_and_controlled' : 'must_fix',
    evidence: { block }
  };
}

function extremeEnergyGainCase(): DestructiveCase {
  const state = makeState();
  const action = ActionFactoryV2.createAction({ type: 'ModifyEnergy', amount: 999 });
  action.execute(state, new ActionQueue());
  const energy = state.combat!.player.energy;
  const ok = Number.isFinite(energy) && energy === 1002;
  return {
    id: 'extreme_energy_gain_999',
    category: 'resource_extreme',
    status: ok ? 'pass' : 'fail',
    classification: ok ? 'acceptable_extreme' : 'must_fix',
    evidence: { energy }
  };
}

function extremeStatusReductionCase(): DestructiveCase {
  const state = makeState();
  combatSystem.applyStatus(state, 'enemy', 'target', 'Vulnerable', 2000);
  combatSystem.applyStatus(state, 'enemy', 'target', 'Vulnerable', -5000);
  const vulnerable = state.combat!.enemies[0].statuses.Vulnerable;
  const ok = vulnerable === 0;
  return {
    id: 'extreme_status_reduction_clamp',
    category: 'status_extreme',
    status: ok ? 'pass' : 'fail',
    classification: ok ? 'allow_and_controlled' : 'must_fix',
    evidence: { vulnerable }
  };
}

async function main(): Promise<void> {
  ensureDir(REPORT_DIR);
  const unitTests = runUnitTests();
  const cases = [
    extremeDamageCase(),
    extremeDrawCase(),
    extremePoisonCase(),
    negativeBlockCase(),
    extremeEnergyGainCase(),
    extremeStatusReductionCase()
  ];
  const passed = cases.filter((item) => item.status === 'pass').length + (unitTests.passed ? 1 : 0);
  const total = cases.length + 1;
  const report: DestructiveReport = {
    timestamp: new Date().toISOString(),
    unitTestCommand: 'npx tsx --test tests/unit/destructiveRegression.test.ts',
    unitTests,
    cases,
    summary: {
      total,
      passed,
      failed: total - passed,
      overallStatus: unitTests.passed && cases.every((item) => item.status === 'pass') ? 'pass' : 'fail'
    }
  };

  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

  console.log(`[destructive] report: ${REPORT_PATH}`);
  console.log(`[destructive] cases: ${cases.filter((item) => item.status === 'pass').length}/${cases.length}`);

  process.exit(report.summary.overallStatus === 'pass' ? 0 : 1);
}

main().catch((error) => {
  console.error('[destructive] crashed:', error);
  process.exit(1);
});
