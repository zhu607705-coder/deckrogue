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
  intent_policy?: Array<{ intent: string }>;
  intentPolicy?: Array<{ intent: string }>;
  moves?: Record<string, unknown>;
  ai_profile?: {
    perceptionAccuracy?: number;
    personality?: Record<string, number>;
    intentBiases?: Array<{ intent: string; multiplier?: number }>;
    antiStall?: {
      maxNonAttackTurns?: number;
      forcedAttackMultiplier?: number;
      suppressedIntents?: string[];
    };
  };
};

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
    }

    const profile = enemy.ai_profile;
    if (!profile) {
      violations.push(`${enemy.id}: missing ai_profile`);
      continue;
    }

    const accuracy = Number(profile.perceptionAccuracy);
    if (!Number.isFinite(accuracy) || accuracy < 0.1 || accuracy > 0.95) {
      violations.push(`${enemy.id}: perceptionAccuracy must be between 0.1 and 0.95`);
    }

    const personality = profile.personality || {};
    for (const key of ['aggression', 'defensiveness', 'unpredictability', 'revengefulness']) {
      const value = Number(personality[key]);
      if (!Number.isFinite(value) || value < 0 || value > 1) {
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
      const multiplier = Number(rule.multiplier);
      if (!Number.isFinite(multiplier) || multiplier < 0) {
        violations.push(`${enemy.id}: intentBiases.${rule.intent}.multiplier must be non-negative`);
      }
    }

    const antiStall = profile.antiStall;
    if (!antiStall || !Number.isFinite(Number(antiStall.maxNonAttackTurns))) {
      violations.push(`${enemy.id}: antiStall.maxNonAttackTurns missing`);
    } else {
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
