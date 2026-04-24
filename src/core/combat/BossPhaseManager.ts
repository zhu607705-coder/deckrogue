/**
 * @file BossPhaseManager.ts
 * @description Boss 阶段管理器 - 管理 Boss 战斗的多阶段机制
 *
 * 主要职责:
 * - 初始化 Boss 阶段的运行时状态
 * - 根据 Boss 血量百分比切换阶段
 * - 处理阶段转换时的效果 (召唤、清状态、Buff 等)
 * - 与 AdaptiveBossAI 协作实现动态难度调整
 */
import type { GameState, RunCardInstance, CombatState } from '@/core/types';
import { globalEventBus } from '@/core/events/eventBus';
import { getBossPhaseEncounter, getBossPhaseForHpPct, type BossPhaseDef } from '@/core/events/bossPhaseSystem';
import { AdaptiveBossAI, combatMemory, type AdaptationProfile, type DetailedPlayerPatternAnalysis } from '@/core/ai';
import { combatSystem } from '@/core/combat/combatSystem';

export interface BossPhaseManagerDeps {
  getState: () => GameState;
  rng: () => number;
  generateId: () => string;
  appendVoxLog: (message: string) => void;
  notify: () => void;
  applyEnemyHpTuning: (baseHp: number, floor: number, nodeType: string) => number;
  getCurrentFloorNumber: () => number;
}

type LiveCombatState = CombatState;
type BossPhaseState = NonNullable<LiveCombatState['bossPhase']>;
type CombatEnemyState = LiveCombatState['enemies'][number];

function getBossPhase(combat: LiveCombatState | null | undefined): BossPhaseState | undefined {
  return combat?.bossPhase;
}

export class BossPhaseManager {
  private bossAI = new AdaptiveBossAI();

  constructor(private deps: BossPhaseManagerDeps) {}

  initializeBossPhaseRuntime(): void {
    const state = this.deps.getState();
    const combat = state.combat;
    if (!combat) return;

    const bossEnemy = combat.enemies.find((enemy) => !!getBossPhaseEncounter(enemy.defId));
    if (!bossEnemy) return;

    const encounter = getBossPhaseEncounter(bossEnemy.defId);
    if (!encounter) return;

    const initial = getBossPhaseForHpPct(bossEnemy.defId, bossEnemy.maxHp > 0 ? bossEnemy.hp / bossEnemy.maxHp : 1);

    const adaptationProfile = this.bossAI.getOrCreateProfile(bossEnemy.id);

    combat.bossPhase = {
      phaseIndex: initial?.phaseIndex ?? 0,
      bossDefId: bossEnemy.defId,
      phaseId: initial?.phase?.id,
      phaseName: initial?.phase?.name,
      phaseHint: initial?.phase?.hint,
      enteredTurn: combat.turn || 1,
      enemyId: bossEnemy.id,
      currentPlayerTurnCards: [],
      previousPlayerTurnCards: [],
      flags: {},
      adaptationProfile,
      adaptationEnabled: true
    };
  }

  refreshBossPhaseState(): void {
    const state = this.deps.getState();
    const combat = state.combat;
    if (!combat) return;

    const bossPhase = getBossPhase(combat);
    if (!bossPhase) return;

    const boss = combat.enemies.find(e => e.id === bossPhase.enemyId);
    if (!boss) return;

    const next = getBossPhaseForHpPct(boss.defId, boss.maxHp > 0 ? boss.hp / boss.maxHp : 0);
    if (!next) return;

    if (next.phaseIndex <= bossPhase.phaseIndex) return;

    this.enterBossPhase(next.phaseIndex, next.phase);
  }

  private enterBossPhase(phaseIndex: number, phase: BossPhaseDef): void {
    const state = this.deps.getState();
    const combat = state.combat;
    const bossPhase = getBossPhase(combat);
    if (!bossPhase) return;

    const boss = combat.enemies.find(e => e.id === bossPhase.enemyId);
    if (!boss) return;

    const existingProfile = bossPhase.adaptationProfile;
    const existingEnabled = bossPhase.adaptationEnabled;

    bossPhase.phaseIndex = phaseIndex;
    bossPhase.phaseId = phase.id;
    bossPhase.phaseName = phase.name;
    bossPhase.phaseHint = phase.hint;
    bossPhase.enteredTurn = combat.turn || 1;
    bossPhase.flags = {};
    bossPhase.adaptationProfile = existingProfile;
    bossPhase.adaptationEnabled = existingEnabled;

    this.deps.appendVoxLog(`Boss 进入阶段: ${phase.name}`);
    this.deps.notify();
  }

  snapshotPlayerTurnForBossPhase(): void {
    const state = this.deps.getState();
    const combat = state.combat;
    const bossPhase = getBossPhase(combat);
    if (!bossPhase) return;

    bossPhase.previousPlayerTurnCards = [...(bossPhase.currentPlayerTurnCards || [])];
    bossPhase.currentPlayerTurnCards = [];
  }

  recordBossPhasePlayedCard(card: RunCardInstance): void {
    const state = this.deps.getState();
    const combat = state.combat;
    const bossPhase = getBossPhase(combat);
    if (!bossPhase || !card) return;

    bossPhase.currentPlayerTurnCards.push(card);
    if (bossPhase.currentPlayerTurnCards.length > 12) {
      bossPhase.currentPlayerTurnCards = bossPhase.currentPlayerTurnCards.slice(-12);
    }
  }

  async applyBossPhaseEnemyPrelude(enemy: CombatEnemyState): Promise<void> {
    const state = this.deps.getState();
    const combat = state.combat;
    const bossPhase = getBossPhase(combat);
    if (!bossPhase) return;
    if (enemy.id !== bossPhase.enemyId) return;

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
        const summonedUnitId = summonDef.unitId;
        const existingCount = combat.enemies.filter(e => e.defId === summonedUnitId).length;
        const MAX_TOTAL_SUMMONS = 4;
        const maxNewSummons = Math.max(0, Math.min(count, MAX_TOTAL_SUMMONS - existingCount));
        for (let i = 0; i < maxNewSummons; i++) {
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
            lastUsedIntent: null,
            intentCooldowns: {},
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
          combatSystem.applyDamage(state, {
            amount: pulseDef.damage,
            sourceType: 'enemy',
            sourceId: enemy.id,
            targetType: 'player',
            targetId: 'player',
            modifiers: [],
            isTrueDamage: !!pulseDef.trueDamage,
            ignoreBlock: !!pulseDef.trueDamage,
          });
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
          const rawEchoDamage = Math.floor(
            previous.reduce((sum: number, card: any) => sum + (card.damage || 0), 0) * mechanics.echoLastPlayerAttack.damageScale
          );
          const minDamage = Math.max(0, Number(mechanics.echoLastPlayerAttack.minDamage || 0));
          const maxDamage = Math.max(minDamage, Number(mechanics.echoLastPlayerAttack.maxDamage || rawEchoDamage));
          const echoDamage = Math.max(minDamage, Math.min(maxDamage, rawEchoDamage));
          if (echoDamage > 0) {
            const actualDamage = combatSystem.applyDamage(state, {
              amount: echoDamage,
              sourceType: 'enemy',
              sourceId: enemy.id,
              targetType: 'player',
              targetId: 'player',
              modifiers: [],
              isTrueDamage: false,
              ignoreBlock: false,
            });
            this.deps.appendVoxLog(`Boss 回响造成 ${actualDamage} 点伤害！`);
          }
          bossPhase.flags['echoLastTurnAppliedAt'] = combat.turn;
        }
      }
    }

    this.deps.notify();
  }

  private updateBossAdaptation(
    enemyId: string,
    intentExecuted: string,
    damageDealt: number,
    playerReacted: boolean,
    turnNumber: number
  ): void {
    const state = this.deps.getState();
    const combat = state.combat;
    const bossPhase = getBossPhase(combat);
    if (!bossPhase || !bossPhase.adaptationEnabled) return;

    const profile = bossPhase.adaptationProfile || this.bossAI.getOrCreateProfile(enemyId);

    const detailedPatterns = combatMemory.getDetailedPlayerPatterns();

    const updatedProfile = this.bossAI.updateProfile(
      profile,
      detailedPatterns,
      intentExecuted,
      damageDealt,
      playerReacted,
      turnNumber
    );

    this.bossAI.saveProfile(updatedProfile);

    bossPhase.adaptationProfile = updatedProfile;
  }

  public getBossAdaptationProfile(enemyId: string): AdaptationProfile | undefined {
    return this.bossAI.getProfile(enemyId);
  }

  public isBossAdaptationEnabled(): boolean {
    const state = this.deps.getState();
    const combat = state.combat;
    const bossPhase = getBossPhase(combat);
    if (!bossPhase) return false;
    return bossPhase.adaptationEnabled ?? false;
  }

  public setBossAdaptationEnabled(enabled: boolean): void {
    const state = this.deps.getState();
    const combat = state.combat;
    const bossPhase = getBossPhase(combat);
    if (!bossPhase) return;
    bossPhase.adaptationEnabled = enabled;
  }

  public getAdaptedIntentBonus(enemyId: string): Record<string, number> {
    const profile = this.bossAI.getProfile(enemyId);
    if (!profile) return {};
    return this.bossAI.getAdaptedIntentBonus(profile.counterStrategy);
  }
}
