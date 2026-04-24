#!/usr/bin/env node

/**
 * @file check_enemy_visual_identity.ts
 * @description 检查敌人变体的视觉标识是否正确配置。
 *
 * 主要职责:
 * - 验证变体是否配置了 variant_of
 * - 检查变体是否有独立的视觉资源
 * - 报告视觉标识缺失或冲突
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { enemiesData } from '@/content/narrative/numericSystem';
import { ASSET_PLACEHOLDERS, localEnemyArt } from '@/ui/components/assetHelpers';

type EnemyRecord = {
  id: string;
  name?: string;
  variant_of?: string;
  keywords?: string[];
};

function main(): void {
  const path = resolve('src/content/data/enemies.json');
  if (!existsSync(path)) {
    console.error('[check_enemy_visual_identity] enemies.json missing');
    process.exit(1);
  }
  const enemies = enemiesData as unknown as EnemyRecord[];
  const variants = enemies.filter((enemy) => enemy.keywords?.includes('variant'));
  const byId = new Map(enemies.map((enemy) => [enemy.id, enemy]));
  const violations: string[] = [];

  if (variants.length < 6) {
    violations.push(`expected at least 6 variants, found ${variants.length}`);
  }

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
    if (!variant.name || variant.name === base.name) {
      violations.push(`${variant.id}: variant name must differ from base enemy`);
    }

    const artPath = localEnemyArt(variant.id);
    const baseArtPath = localEnemyArt(baseId);
    if (artPath === ASSET_PLACEHOLDERS.enemy) {
      violations.push(`${variant.id}: localEnemyArt fell back to placeholder`);
      continue;
    }
    if (artPath === baseArtPath) {
      violations.push(`${variant.id}: art path must differ from base enemy`);
    }
    const absPath = resolve(`public${artPath}`);
    if (!existsSync(absPath)) {
      violations.push(`${variant.id}: missing art file ${artPath}`);
    }
  }

  if (violations.length > 0) {
    console.error(`\n[check_enemy_visual_identity] Found ${violations.length} violation(s):`);
    for (const violation of violations) console.error(`- ${violation}`);
    process.exit(1);
  }

  console.log(`[check_enemy_visual_identity] OK (${variants.length} variants)`);
}

main();
