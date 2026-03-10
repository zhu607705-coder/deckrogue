import bossPhasesData from '@/content/data/bossPhases.json';

export interface BossPhaseSummonDef {
  unitId: string;
  count?: number;
  nameOverride?: string;
  hpScale?: number;
}

export interface BossPhasePeriodicSummonDef extends BossPhaseSummonDef {
  everyEnemyTurns: number;
  maxActive?: number;
}

export interface BossPhaseEchoDef {
  damageScale: number;
  minDamage?: number;
  maxDamage?: number;
}

export interface BossPhaseBuffSummonedAlliesDef {
  everyEnemyTurns: number;
  strength?: number;
  block?: number;
  maxTargets?: number;
}

export interface BossPhaseHandHijackDef {
  everyEnemyTurns: number;
  discardCount?: number;
  fallbackStatuses?: Record<string, number>;
}

export interface BossPhasePlayerPulseDef {
  everyEnemyTurns: number;
  damage?: number;
  trueDamage?: boolean;
  statuses?: Record<string, number>;
  text?: string;
}

export interface BossPhaseDef {
  id: string;
  name: string;
  triggerHpPctLte: number;
  hint?: string;
  onEnter?: {
    gainBlock?: number;
    gainStatuses?: Record<string, number>;
    summons?: BossPhaseSummonDef[];
    warpPulse?: string;
  };
  mechanics?: {
    periodicSummon?: BossPhasePeriodicSummonDef;
    echoLastPlayerAttack?: BossPhaseEchoDef;
    buffSummonedAllies?: BossPhaseBuffSummonedAlliesDef;
    hijackHand?: BossPhaseHandHijackDef;
    playerPulse?: BossPhasePlayerPulseDef;
  };
}

export interface BossPhaseEncounterDef {
  bossId: string;
  phases: BossPhaseDef[];
}

const encounters = bossPhasesData as Record<string, BossPhaseEncounterDef>;

export function getBossPhaseEncounter(bossId: string): BossPhaseEncounterDef | null {
  const def = encounters[bossId];
  if (!def || !Array.isArray(def.phases) || def.phases.length === 0) return null;
  return def;
}

export function getBossPhaseForHpPct(bossId: string, hpPct: number): { phase: BossPhaseDef; phaseIndex: number } | null {
  const encounter = getBossPhaseEncounter(bossId);
  if (!encounter) return null;
  const pct = Math.max(0, Math.min(1, Number.isFinite(hpPct) ? hpPct : 1));
  let selectedIndex = 0;
  for (let i = 0; i < encounter.phases.length; i++) {
    const phase = encounter.phases[i];
    const threshold = Math.max(0, Math.min(1, Number(phase.triggerHpPctLte) || 0));
    if (pct <= threshold) {
      selectedIndex = i;
    }
  }
  return { phase: encounter.phases[selectedIndex], phaseIndex: selectedIndex };
}
