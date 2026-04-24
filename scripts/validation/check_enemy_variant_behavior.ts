#!/usr/bin/env node

/**
 * @file check_enemy_variant_behavior.ts
 * @description 检查敌人变体的行为配置是否与其基础敌人一致。
 *
 * 主要职责:
 * - 识别所有敌人变体
 * - 验证变体的动作类型在支持列表中
 * - 报告变体与基础敌人的行为差异问题
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { enemiesData } from '@/content/narrative/numericSystem';

type EnemyRecord = {
  id: string;
  name?: string;
  variant_of?: string;
  keywords?: string[];
  intent_policy?: Array<{ intent: string; weight?: number }>;
  intentPolicy?: Array<{ intent: string; weight?: number }>;
  moves?: Record<string, unknown[]>;
  ai_profile?: unknown;
};

const SUPPORTED_VARIANT_ACTION_TYPES = new Set([
  'DealDamage',
  'ConditionalDamage',
  'GainBlock',
  'ApplyStatus',
  'ConditionalApply',
  'BuffAllEnemies',
]);

function stableJson(value: unknown): string {
  return JSON.stringify(value);
}

function main(): void {
  const path = resolve('src/content/data/enemies.json');
  if (!existsSync(path)) {
    console.error('[check_enemy_variant_behavior] enemies.json missing');
    process.exit(1);
  }

  const enemies = enemiesData as unknown as EnemyRecord[];
  const variants = enemies.filter((enemy) => enemy.keywords?.includes('variant'));
  const byId = new Map(enemies.map((enemy) => [enemy.id, enemy]));
  const violations: string[] = [];

  for (const variant of variants) {
    const baseId = variant.variant_of;
    if (!baseId) {
      violations.push(`${variant.id}: missing variant_of`);
      continue;
    }
    const base = byId.get(baseId);
    if (!base) {
      violations.push(`${variant.id}: base enemy ${baseId} missing`);
      continue;
    }

    const variantPolicy = variant.intent_policy || variant.intentPolicy || [];
    const basePolicy = base.intent_policy || base.intentPolicy || [];
    const variantMoves = variant.moves || {};
    const baseMoves = base.moves || {};

    if (variantPolicy.length === 0) {
      violations.push(`${variant.id}: missing intent_policy`);
    }
    if (Object.keys(variantMoves).length === 0) {
      violations.push(`${variant.id}: missing moves`);
    }
    if (!variant.ai_profile) {
      violations.push(`${variant.id}: missing ai_profile`);
    }

    const unsupportedActionTypes = Object.values(variantMoves)
      .flat()
      .map((entry: any) => String(entry?.type || ''))
      .filter((type) => type && !SUPPORTED_VARIANT_ACTION_TYPES.has(type));
    if (unsupportedActionTypes.length > 0) {
      violations.push(`${variant.id}: unsupported action types for active enemy turn: ${unsupportedActionTypes.join(', ')}`);
    }

    const samePolicy = stableJson(variantPolicy) === stableJson(basePolicy);
    const sameMoves = stableJson(variantMoves) === stableJson(baseMoves);
    const sameProfile = stableJson(variant.ai_profile) === stableJson(base.ai_profile);

    if (samePolicy && sameMoves && sameProfile) {
      violations.push(`${variant.id}: no meaningful behavior difference from ${baseId}`);
    }
  }

  if (violations.length > 0) {
    console.error(`\n[check_enemy_variant_behavior] Found ${violations.length} violation(s):`);
    for (const violation of violations) console.error(`- ${violation}`);
    process.exit(1);
  }

  console.log(`[check_enemy_variant_behavior] OK (${variants.length} variants checked)`);
}

main();
