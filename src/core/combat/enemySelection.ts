import { isEnemyEligibleForFloorByNumericRules } from '@/content/narrative/numericSystem';

export type EncounterNodeType = 'Combat' | 'Elite' | 'Boss';

export interface EnemySelectionDef {
  id: string;
  name?: string;
  hp_range?: [number, number];
  minHp?: number;
  maxHp?: number;
  keywords?: string[];
}

function hasKeyword(enemy: EnemySelectionDef, keyword: string): boolean {
  return Array.isArray(enemy.keywords) && enemy.keywords.includes(keyword);
}

export function getNodeTypeEligibleEnemies(
  enemies: EnemySelectionDef[],
  nodeType: EncounterNodeType
): EnemySelectionDef[] {
  return enemies.filter((enemy) => {
    if (nodeType === 'Boss') return hasKeyword(enemy, 'boss');
    if (nodeType === 'Elite') return hasKeyword(enemy, 'elite');
    return !hasKeyword(enemy, 'boss') && !hasKeyword(enemy, 'elite');
  });
}

export function getFloorEligibleEnemyPool(
  enemies: EnemySelectionDef[],
  floor: number,
  nodeType: EncounterNodeType
): EnemySelectionDef[] {
  const nodeTypeEligible = getNodeTypeEligibleEnemies(enemies, nodeType);
  const staged = nodeTypeEligible.filter((enemy) => isEnemyEligibleForFloorByNumericRules(enemy, floor, nodeType));
  return staged.length > 0 ? staged : nodeTypeEligible;
}

export function prioritizeEnemyPoolForEncounter(
  enemies: EnemySelectionDef[],
  floor: number,
  nodeType: EncounterNodeType
): EnemySelectionDef[] {
  const basePool = getFloorEligibleEnemyPool(enemies, floor, nodeType);
  if (nodeType !== 'Combat' || floor > 3) return basePool;

  const exactShowcase = basePool.filter((enemy) => hasKeyword(enemy, `showcase_floor_${floor}`));
  if (exactShowcase.length > 0) return exactShowcase;

  const earlyVariants = basePool.filter((enemy) => hasKeyword(enemy, 'variant') && hasKeyword(enemy, 'early_variant'));
  if (earlyVariants.length > 0) return earlyVariants;

  return basePool;
}
