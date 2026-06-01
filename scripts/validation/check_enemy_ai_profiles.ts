#!/usr/bin/env node

/**
 * @file check_enemy_ai_profiles.ts
 * @description 检查敌人 AI 配置文件的完整性和正确性。
 *
 * 主要职责:
 * - 验证 enemies.json 中每个敌人是否配置了 ai_profile
 * - 检查 intent_policy 的完整性
 * - 报告缺失或无效的 AI 配置
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

type EnemyRecord = {
  id: string;
  keywords?: string[];
  intent_policy?: Array<{ intent: string; weight?: unknown }>;
  intentPolicy?: Array<{ intent: string; weight?: unknown }>;
  moves?: Record<string, unknown>;
  ai_profile?: {
    perceptionAccuracy?: number;
    personality?: Record<string, number>;
    intentBiases?: Array<{
      intent: string;
      multiplier?: number;
      attackIntentBand?: string;
      defenseIntentBand?: string;
      comboThreatBand?: string;
      playerHpBand?: string;
      enemyHpBand?: string;
      playerBlockBand?: string;
    }>;
    antiStall?: {
      maxNonAttackTurns?: number;
      forcedAttackMultiplier?: number;
      suppressedIntents?: string[];
    };
  };
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

const BIAS_BAND_VALUES = {
  attackIntentBand: ['low', 'medium', 'high'],
  defenseIntentBand: ['low', 'medium', 'high'],
  comboThreatBand: ['none', 'suspected', 'high'],
  playerHpBand: ['safe', 'pressured', 'kill_range'],
  enemyHpBand: ['safe', 'pressured', 'kill_range'],
  playerBlockBand: ['none', 'light', 'heavy'],
} as const;

function validateBiasBand(
  violations: string[],
  enemyId: string,
  intent: string,
  key: keyof typeof BIAS_BAND_VALUES,
  value: unknown,
): void {
  if (value === undefined) return;
  const allowed = BIAS_BAND_VALUES[key];
  if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) {
    violations.push(`${enemyId}: intentBiases.${intent}.${key} must be one of ${allowed.join(', ')}`);
  }
}

function main(): void {
  const path = resolve('src/content/data/enemies.json');
  if (!existsSync(path)) {
    console.error('[check_enemy_ai_profiles] enemies.json missing');
    process.exit(1);
  }

  const enemies = JSON.parse(readFileSync(path, 'utf8')) as EnemyRecord[];
  const violations: string[] = [];

  for (const enemy of enemies) {
    const policies = enemy.intent_policy || enemy.intentPolicy || [];
    if (policies.length === 0) continue;
    const moves = enemy.moves && typeof enemy.moves === 'object' && !Array.isArray(enemy.moves)
      ? enemy.moves
      : {};
    const knownMoveIntents = new Set(Object.keys(moves));

    for (const policy of policies) {
      if (!policy.intent || !knownMoveIntents.has(policy.intent)) {
        violations.push(`${enemy.id}: intent_policy references missing move ${policy.intent || 'unknown'}`);
      }
      if (policy.weight !== undefined && !isFiniteNumber(policy.weight)) {
        violations.push(`${enemy.id}: intent_policy.${policy.intent || 'unknown'}.weight must be a finite number`);
      }
    }

    const profile = enemy.ai_profile;
    if (!profile) {
      violations.push(`${enemy.id}: missing ai_profile`);
      continue;
    }

    const accuracy = profile.perceptionAccuracy;
    if (!isFiniteNumber(accuracy)) {
      violations.push(`${enemy.id}: perceptionAccuracy must be a finite number`);
    } else if (accuracy < 0.1 || accuracy > 0.95) {
      violations.push(`${enemy.id}: perceptionAccuracy must be between 0.1 and 0.95`);
    }

    const personality = profile.personality || {};
    for (const key of ['aggression', 'defensiveness', 'unpredictability', 'revengefulness']) {
      const value = personality[key];
      if (!isFiniteNumber(value)) {
        violations.push(`${enemy.id}: personality.${key} must be a finite number`);
      } else if (value < 0 || value > 1) {
        violations.push(`${enemy.id}: personality.${key} must be between 0 and 1`);
      }
    }

    const knownIntents = new Set(policies.map((policy) => policy.intent));
    for (const rule of profile.intentBiases || []) {
      if (!knownIntents.has(rule.intent)) {
        violations.push(`${enemy.id}: intentBiases references unknown intent ${rule.intent}`);
      } else if (!knownMoveIntents.has(rule.intent)) {
        violations.push(`${enemy.id}: intentBiases references intent without move ${rule.intent}`);
      }
      const multiplier = rule.multiplier;
      if (!isFiniteNumber(multiplier)) {
        violations.push(`${enemy.id}: intentBiases.${rule.intent}.multiplier must be a finite number`);
      } else if (multiplier < 0) {
        violations.push(`${enemy.id}: intentBiases.${rule.intent}.multiplier must be non-negative`);
      }
      for (const key of Object.keys(BIAS_BAND_VALUES) as Array<keyof typeof BIAS_BAND_VALUES>) {
        validateBiasBand(violations, enemy.id, rule.intent, key, rule[key]);
      }
    }

    const antiStall = profile.antiStall;
    if (!antiStall || !isFiniteNumber(antiStall.maxNonAttackTurns)) {
      violations.push(`${enemy.id}: antiStall.maxNonAttackTurns missing`);
    } else {
      if (!isFiniteNumber(antiStall.forcedAttackMultiplier)) {
        violations.push(`${enemy.id}: antiStall.forcedAttackMultiplier must be a finite number`);
      } else if (antiStall.forcedAttackMultiplier < 0) {
        violations.push(`${enemy.id}: antiStall.forcedAttackMultiplier must be non-negative`);
      }
      for (const intent of antiStall.suppressedIntents || []) {
        if (!knownIntents.has(intent)) {
          violations.push(`${enemy.id}: antiStall references unknown intent ${intent}`);
        } else if (!knownMoveIntents.has(intent)) {
          violations.push(`${enemy.id}: antiStall references intent without move ${intent}`);
        }
      }
    }
  }

  if (violations.length > 0) {
    console.error(`\n[check_enemy_ai_profiles] Found ${violations.length} violation(s):`);
    for (const violation of violations) {
      console.error(`- ${violation}`);
    }
    process.exit(1);
  }

  console.log('[check_enemy_ai_profiles] OK');
}

main();
