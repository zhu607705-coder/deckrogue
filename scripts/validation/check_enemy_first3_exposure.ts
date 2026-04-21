#!/usr/bin/env node

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRNG } from '@/infrastructure/rng/rng';
import { prioritizeEnemyPoolForEncounter } from '@/core/combat/enemySelection';
import { enemiesData } from '@/content/narrative/numericSystem';

type EnemyRecord = {
  id: string;
  name?: string;
  keywords?: string[];
};

function main(): void {
  const path = resolve('src/content/data/enemies.json');
  if (!existsSync(path)) {
    console.error('[check_enemy_first3_exposure] enemies.json missing');
    process.exit(1);
  }

  const enemies = enemiesData as unknown as EnemyRecord[];
  const violations: string[] = [];
  const seenIds = new Set<string>();

  for (const floor of [1, 2, 3]) {
    const pool = prioritizeEnemyPoolForEncounter(enemies as any[], floor, 'Combat');
    if (pool.length === 0) {
      violations.push(`floor ${floor}: empty encounter pool after prioritization`);
      continue;
    }
    if (!pool.every((enemy) => enemy.keywords?.includes(`showcase_floor_${floor}`) || (floor < 3 && enemy.keywords?.includes('early_variant')))) {
      violations.push(`floor ${floor}: prioritized pool does not focus on showcase/early variants`);
    }

    const rng = createRNG(100 + floor);
    const picked = pool[Math.floor(rng() * pool.length)];
    if (!picked?.keywords?.includes('variant')) {
      violations.push(`floor ${floor}: deterministic pick ${picked?.id || 'unknown'} is not a variant`);
      continue;
    }
    seenIds.add(picked.id);
  }

  if (seenIds.size < 3) {
    violations.push(`first 3 floors expose only ${seenIds.size} distinct variant ids`);
  }

  if (violations.length > 0) {
    console.error(`\n[check_enemy_first3_exposure] Found ${violations.length} violation(s):`);
    for (const violation of violations) console.error(`- ${violation}`);
    process.exit(1);
  }

  console.log(`[check_enemy_first3_exposure] OK (${Array.from(seenIds).join(', ')})`);
}

main();
