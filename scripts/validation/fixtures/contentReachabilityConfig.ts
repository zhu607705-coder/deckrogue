export interface ReachabilityConfig {
  branchCardIds: string[];
  mirrorSharedCardIds: string[];
  mirrorRelicIds: string[];
  mirrorHighValueRelicIds: string[];
  mirrorEnemyIds: string[];
  mirrorBossIds: string[];
  mirrorExitEventIds: string[];
}

export const REACHABILITY_CONFIG: ReachabilityConfig = {
  branchCardIds: [
    'planted_witness',
    'terminal_verdict',
    'glass_marionette',
    'grand_doctrine',
    'perfect_solvent',
  ],
  mirrorSharedCardIds: [
    'mirror_probe',
    'silver_guard',
    'fracture_strike',
    'borrowed_pattern',
    'refraction_dart',
    'hush_field',
    'echo_step',
    'glass_molt',
    'mirror_tax',
    'soft_reset',
    'palace_signal',
    'shard_harvest',
  ],
  mirrorRelicIds: [
    'mirror shard',
    'silver locket',
    'fractured hourglass',
  ],
  mirrorHighValueRelicIds: [
    'mirror shard',
    'silver locket',
    'fractured hourglass',
  ],
  mirrorEnemyIds: [
    'mirror scout',
    'silver guardian',
    'fracture construct',
  ],
  mirrorBossIds: [
    'mirror sentinel',
  ],
  mirrorExitEventIds: [
    'mirror_exit',
    'mirror_departure',
  ],
};

export function isBranchCard(cardId: string): boolean {
  return REACHABILITY_CONFIG.branchCardIds.includes(cardId);
}

export function isMirrorSharedCard(cardId: string): boolean {
  return REACHABILITY_CONFIG.mirrorSharedCardIds.includes(cardId);
}

export function isMirrorRelic(relicId: string): boolean {
  return REACHABILITY_CONFIG.mirrorRelicIds.includes(relicId);
}

export function isMirrorHighValueRelic(relicId: string): boolean {
  return REACHABILITY_CONFIG.mirrorHighValueRelicIds.includes(relicId);
}

export function isMirrorEnemy(enemyId: string): boolean {
  return REACHABILITY_CONFIG.mirrorEnemyIds.includes(enemyId);
}

export function isMirrorBoss(enemyId: string): boolean {
  return REACHABILITY_CONFIG.mirrorBossIds.includes(enemyId);
}
