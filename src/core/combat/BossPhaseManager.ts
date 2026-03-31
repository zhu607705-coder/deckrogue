import type { GameState, RunCardInstance } from '@/core/types';
import { globalEventBus } from '@/core/events/eventBus';
import { getBossPhaseEncounter, getBossPhaseForHpPct, type BossPhaseDef } from '@/core/events/bossPhaseSystem';

export interface BossPhaseManagerDeps {
  getState: () => GameState;
  rng: () => number;
  generateId: () => string;
  appendVoxLog: (message: string) => void;
  notify: () => void;
  applyEnemyHpTuning: (baseHp: number, floor: number, nodeType: string) => number;
  getCurrentFloorNumber: () => number;
}

export class BossPhaseManager {
  constructor(private deps: BossPhaseManagerDeps) {}

  initializeBossPhaseRuntime(): void {
    const state = this.deps.getState();
    const combat = state.combat;
    if (!combat) return;

    const bossEnemy = combat.enemies.find(e => {
      const def = e as any;
      return def.keywords?.includes('boss') || def.defId?.includes('boss');
    });
    if (!bossEnemy) return;

    const encounter = getBossPhaseEncounter(bossEnemy.defId);
    if (!encounter) return;

    const initial = getBossPhaseForHpPct(bossEnemy.defId, bossEnemy.maxHp > 0 ? bossEnemy.hp / bossEnemy.maxHp : 1);

    (combat as any).bossPhase = {
      phaseIndex: initial?.phaseIndex ?? 0,
      phaseId: initial?.phase?.id,
      phaseName: initial?.phase?.name,
      phaseHint: initial?.phase?.hint,
      enteredTurn: combat.turn || 1,
      enemyId: bossEnemy.id,
      currentPlayerTurnCards: [],
      previousPlayerTurnCards: [],
      flags: {}
    };
  }

  refreshBossPhaseState(): void {
    const state = this.deps.getState();
    const combat = state.combat;
    if (!combat || !(combat as any).bossPhase) return;

    const boss = combat.enemies.find(e => e.id === (combat as any).bossPhase.enemyId);
    if (!boss) return;

    const next = getBossPhaseForHpPct(boss.defId, boss.maxHp > 0 ? boss.hp / boss.maxHp : 0);
    if (!next) return;

    if (next.phaseIndex <= (combat as any).bossPhase.phaseIndex) return;

    this.enterBossPhase(next.phaseIndex, next.phase);
  }

  private enterBossPhase(phaseIndex: number, phase: BossPhaseDef): void {
    const state = this.deps.getState();
    const combat = state.combat;
    if (!combat || !(combat as any).bossPhase) return;

    const boss = combat.enemies.find(e => e.id === (combat as any).bossPhase.enemyId);
    if (!boss) return;

    (combat as any).bossPhase.phaseIndex = phaseIndex;
    (combat as any).bossPhase.phaseId = phase.id;
    (combat as any).bossPhase.phaseName = phase.name;
    (combat as any).bossPhase.phaseHint = phase.hint;
    (combat as any).bossPhase.enteredTurn = combat.turn || 1;
    (combat as any).bossPhase.flags = {};

    this.deps.appendVoxLog(`Boss 进入阶段: ${phase.name}`);
    this.deps.notify();
  }

  snapshotPlayerTurnForBossPhase(): void {
    const state = this.deps.getState();
    const combat = state.combat;
    if (!combat || !(combat as any).bossPhase) return;

    (combat as any).bossPhase.previousPlayerTurnCards = [...((combat as any).bossPhase.currentPlayerTurnCards || [])];
    (combat as any).bossPhase.currentPlayerTurnCards = [];
  }

  recordBossPhasePlayedCard(card: RunCardInstance): void {
    const state = this.deps.getState();
    const combat = state.combat;
    if (!combat || !(combat as any).bossPhase || !card) return;

    (combat as any).bossPhase.currentPlayerTurnCards.push(card);
    if ((combat as any).bossPhase.currentPlayerTurnCards.length > 12) {
      (combat as any).bossPhase.currentPlayerTurnCards = (combat as any).bossPhase.currentPlayerTurnCards.slice(-12);
    }
  }

  async applyBossPhaseEnemyPrelude(enemy: any): Promise<void> {
    const state = this.deps.getState();
    const combat = state.combat;
    if (!combat || !(combat as any).bossPhase) return;
    if (enemy.id !== (combat as any).bossPhase.enemyId) return;

    const bossPhase = (combat as any).bossPhase;
    const active = getBossPhaseForHpPct(enemy.defId, enemy.maxHp > 0 ? enemy.hp / enemy.maxHp : 0);
    if (!active?.phase) return;

    bossPhase.flags = bossPhase.flags || {};

    const phase = active.phase;
    const mechanics = phase.mechanics;

    if (!mechanics) return;

    if (mechanics.periodicSummon) {
      const lastTurn = Number(bossPhase.flags['periodicSummonLastTurn'] || 0);
      const interval = mechanics.periodicSummon.everyEnemyTurns || 1;
      if (combat.turn - lastTurn >= interval) {
        const summonDef = mechanics.periodicSummon;
        const count = summonDef.count || 1;
        for (let i = 0; i < count; i++) {
          const baseHp = summonDef.hpScale || 10;
          const hp = this.deps.applyEnemyHpTuning(baseHp, this.deps.getCurrentFloorNumber(), 'Boss');
          combat.enemies.push({
            id: this.deps.generateId(),
            defId: summonDef.unitId,
            name: summonDef.nameOverride || summonDef.unitId,
            hp,
            maxHp: hp,
            block: 0,
            statuses: {},
            nextIntent: 'Attack',
            devotion: 0,
            corruptionAxis: 0,
            axisDisposition: 'balanced' as const
          });
        }
        bossPhase.flags['periodicSummonLastTurn'] = combat.turn;
        this.deps.appendVoxLog(`Boss 召唤了 ${count} 个 ${mechanics.periodicSummon.nameOverride || mechanics.periodicSummon.unitId}！`);
      }
    }

    if (mechanics.buffSummonedAllies) {
      const lastTurn = Number(bossPhase.flags['buffSummonedAlliesLastTurn'] || 0);
      const interval = mechanics.buffSummonedAllies.everyEnemyTurns || 1;
      if (combat.turn - lastTurn >= interval) {
        const buffDef = mechanics.buffSummonedAllies;
        const targets = combat.enemies.filter(e => e.id !== enemy.id);
        const maxTargets = buffDef.maxTargets || targets.length;
        for (const target of targets.slice(0, maxTargets)) {
          if (buffDef.strength) {
            target.statuses['Strength'] = (target.statuses['Strength'] || 0) + buffDef.strength;
          }
          if (buffDef.block) {
            target.block = (target.block || 0) + buffDef.block;
          }
        }
        bossPhase.flags['buffSummonedAlliesLastTurn'] = combat.turn;
      }
    }

    if (mechanics.playerPulse) {
      const lastTurn = Number(bossPhase.flags['playerPulseLastTurn'] || 0);
      const interval = mechanics.playerPulse.everyEnemyTurns || 1;
      if (combat.turn - lastTurn >= interval) {
        const pulseDef = mechanics.playerPulse;
        if (pulseDef.damage) {
          combat.player.hp = Math.max(0, combat.player.hp - pulseDef.damage);
        }
        if (pulseDef.statuses) {
          for (const [status, amount] of Object.entries(pulseDef.statuses)) {
            combat.player.statuses[status] = (combat.player.statuses[status] || 0) + (amount as number);
          }
        }
        bossPhase.flags['playerPulseLastTurn'] = combat.turn;
        if (pulseDef.text) {
          this.deps.appendVoxLog(pulseDef.text);
        }
      }
    }

    if (mechanics.echoLastPlayerAttack && mechanics.echoLastPlayerAttack.damageScale) {
      const previous = bossPhase.previousPlayerTurnCards || [];
      if (previous.length > 0) {
        const echoedThisTurn = Number(bossPhase.flags['echoLastTurnAppliedAt'] || 0);
        if (echoedThisTurn !== combat.turn) {
          const echoDamage = Math.floor(
            previous.reduce((sum: number, card: any) => sum + (card.damage || 0), 0) * mechanics.echoLastPlayerAttack.damageScale
          );
          if (echoDamage > 0) {
            combat.player.hp = Math.max(0, combat.player.hp - echoDamage);
            this.deps.appendVoxLog(`Boss 回响造成 ${echoDamage} 点伤害！`);
          }
          bossPhase.flags['echoLastTurnAppliedAt'] = combat.turn;
        }
      }
    }

    this.deps.notify();
  }
}
