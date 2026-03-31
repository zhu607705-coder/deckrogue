import type { GameState, RunCardInstance, CardDef } from '@/core/types';
import type { ActionManager } from '@/core/actions/actionManager';
import type { IActionContext } from '@/core/actions/actionQueue';
import { globalEventBus } from '@/core/events/eventBus';
import { relicSystem } from '@/features/relics/relicSystem';
import { economySystem } from '@/features/progression/economySystem';
import { metricsTracker } from '@/core/events/metricsTracker';
import {
  enemiesData,
  rollEnemyBaseHp,
  getSingleSlimeRoomBoostConfig
} from '@/content/narrative/numericSystem';
import { unlockCodexEntry } from '@/core/persistence/codexStore';

export interface CombatManagerDeps {
  getState: () => GameState;
  setState: (updater: (state: GameState) => void) => void;
  actionManager: ActionManager;
  rng: () => number;
  appendVoxLog: (message: string) => void;
  notify: () => void;
  generateId: () => string;
  shuffleDeck: <T extends CardDef>(deck: T[]) => T[];
  getCurrentFloorNumber: () => number;
  getCurrentNode: () => { y: number } | undefined;
  calculateDamage: (base: number, attackerStatuses: Record<string, number>, defenderStatuses: Record<string, number>, source: 'player' | 'enemy') => number;
  isEnemyEligibleForFloor: (enemy: any, floor: number, nodeType: string) => boolean;
  applyEnemyHpTuning: (baseHp: number, floor: number, nodeType: string) => number;
}

export class CombatManager {
  constructor(private deps: CombatManagerDeps) {}

  startCombat(nodeType: 'Combat' | 'Elite' | 'Boss'): void {
    const state = this.deps.getState();
    const floor = this.deps.getCurrentFloorNumber();
    const hpMultiplier = economySystem.calculateHpMultiplier(floor) * Math.max(1, Number(state.metaRuntime?.ascensionEnemyHpMultiplier || 1));
    const damageMultiplier = economySystem.calculateDamageMultiplier(floor) * Math.max(1, Number(state.metaRuntime?.ascensionEnemyDamageMultiplier || 1));

    const enemyCount = nodeType === 'Boss' ? 1 : nodeType === 'Elite' ? 2 : 1 + Math.floor(this.deps.rng() * 2);
    const enemies = this.generateEnemies(enemyCount, nodeType, floor, hpMultiplier, damageMultiplier);

    state.combat = {
      player: {
        hp: state.player.hp,
        maxHp: state.player.maxHp,
        block: 0,
        energy: state.player.maxEnergy,
        statuses: {},
        delayedCards: [],
        constructs: [],
        elements: [],
        potionToxicity: 0,
        potionsUsedThisTurn: 0,
        cardsPlayedThisTurn: 0,
        damageTakenThisTurn: 0,
        damageTakenLastTurn: 0,
        intel: state.player.intel,
        devotion: state.player.devotion || 0,
        corruptionAxis: Math.min(100, Math.max(0, state.player.corruption || 0)),
        axisDisposition: (state.player.corruption || 0) > 0 ? 'corruption' : 'balanced',
        timeLayer: state.character?.specialResource === 'timeLayer' ? 1 : undefined,
        thread: state.character?.specialResource === 'thread' ? 2 : undefined,
        concoction: state.character?.specialResource === 'concoction' ? 1 : undefined
      },
      enemies,
      drawPile: this.deps.shuffleDeck([...state.player.deck]) as RunCardInstance[],
      hand: [],
      discardPile: [],
      exhaustPile: [],
      turn: 1,
      isPlayerTurn: true,
      warpTide: Math.min(
        100,
        Math.floor((state.player.corruption || 0) * 0.6) + Math.max(0, state.player.runEffects?.pendingWarpTideBonus || 0)
      ),
      warpAlpha: 0.5 + Math.min(0.25, (state.player.corruption || 0) * 0.0025),
      warpPerilK: 0.05
    };

    state.screen = 'Combat';
    metricsTracker.recordCombatStart?.();
    globalEventBus.publish({ type: 'CombatStart' } as any);
    relicSystem.trigger('CombatStart', state, (actionOrSpec: any, ctx: IActionContext) => {
      if (actionOrSpec && typeof actionOrSpec.execute === 'function') {
        this.deps.actionManager.enqueueUrgentAction(actionOrSpec, ctx, 'relic');
      } else {
        this.deps.actionManager.enqueueUrgent(actionOrSpec, ctx, 'relic');
      }
    });

    if ((state.player.corruption || 0) > 0) {
      state.combat.warpPulse = {
        text: `Corruption stirs the warp: Tide ${state.combat.warpTide} · DMG x${this.getCorruptionDamageBonusMultiplier(state).toFixed(2)}`,
        tone: (state.combat.warpTide || 0) >= 50 ? 'danger' : 'warp'
      };
    }

    this.startTurn();
  }

  private getCorruptionDamageBonusMultiplier(state: GameState): number {
    const corruption = state.player.corruption || 0;
    if (corruption <= 0) return 1;
    return 1 + corruption * 0.01;
  }

  private generateEnemies(
    count: number,
    nodeType: 'Combat' | 'Elite' | 'Boss',
    floor: number,
    hpMultiplier: number,
    damageMultiplier: number
  ): any[] {
    const validEnemies = enemiesData.filter((e: any) => {
      if (nodeType === 'Boss') return e.keywords?.includes('boss');
      if (nodeType === 'Elite') return e.keywords?.includes('elite');
      return !e.keywords?.includes('boss') && !e.keywords?.includes('elite');
    });
    const stagedEnemies = validEnemies.filter((e: any) => this.deps.isEnemyEligibleForFloor(e, floor, nodeType));
    const enemyPool = stagedEnemies.length > 0 ? stagedEnemies : validEnemies;

    return Array.from({ length: count }, (_, i) => {
      const def = enemyPool[Math.floor(this.deps.rng() * enemyPool.length)];
      if (def?.id) {
        const eliteLike = !!(def as any).keywords?.includes('elite') || !!(def as any).keywords?.includes('boss');
        unlockCodexEntry(eliteLike ? 'elites' : 'enemies', def.id);
      }
      const baseHp = rollEnemyBaseHp(def as any, this.deps.rng);
      const scaledHp = this.deps.applyEnemyHpTuning(baseHp, floor, nodeType);

      return {
        id: `enemy_${i}_${this.deps.generateId()}`,
        defId: def.id,
        name: def.name,
        hp: scaledHp,
        maxHp: scaledHp,
        block: 0,
        statuses: {},
        nextIntent: this.selectIntent(def as any),
        devotion: 0,
        corruptionAxis: 0,
        axisDisposition: 'balanced' as const
      };
    }).map((enemy: any) => {
      const slimeBoost = getSingleSlimeRoomBoostConfig();
      if (
        slimeBoost.enabled &&
        nodeType === 'Combat' &&
        count === 1 &&
        floor <= slimeBoost.maxFloor &&
        enemy.defId === 'slime_small'
      ) {
        const hpBonus = Math.max(slimeBoost.minHpBonus, Math.floor(enemy.maxHp * slimeBoost.hpBonusRatio));
        enemy.maxHp += hpBonus;
        enemy.hp += hpBonus;
        if (slimeBoost.strengthBonus > 0) {
          enemy.statuses['Strength'] = (enemy.statuses['Strength'] || 0) + slimeBoost.strengthBonus;
        }
        if (slimeBoost.innateStatus && typeof slimeBoost.innateStatus === 'object') {
          for (const [status, amount] of Object.entries(slimeBoost.innateStatus)) {
            const stacks = Math.max(0, Math.floor(Number(amount) || 0));
            if (stacks <= 0) continue;
            enemy.statuses[status] = Math.max(enemy.statuses[status] || 0, stacks);
          }
        }
      }
      return enemy;
    });
  }

  private selectIntent(enemyDef: any): string {
    const baseWeights = Array.isArray(enemyDef.intent_policy)
      ? enemyDef.intent_policy.map((p: any) => Math.max(0, Number(p.weight) || 0))
      : [];
    const totalWeight = baseWeights.reduce((sum: number, w: number) => sum + w, 0);
    if (totalWeight <= 0) {
      return enemyDef.intent_policy?.[0]?.intent || 'Attack';
    }

    const aggroBias = Math.max(0, Number(this.deps.getState().metaRuntime?.ascensionIntentAggroBias || 0));
    let weights = [...baseWeights];
    if (aggroBias > 0 && Array.isArray(enemyDef.intent_policy)) {
      for (let i = 0; i < enemyDef.intent_policy.length; i++) {
        const intent = enemyDef.intent_policy[i]?.intent || '';
        const isAggressive = /attack|strike|damage|slam|burn|punch|kick|gore|claw|bite|curse|doom/.test(intent.toLowerCase());
        if (isAggressive) {
          weights[i] = weights[i] * (1 + aggroBias);
        }
      }
    }

    const totalAdjustedWeight = weights.reduce((sum: number, w: number) => sum + w, 0);
    const roll = this.deps.rng() * totalAdjustedWeight;
    let cumulative = 0;
    for (let i = 0; i < weights.length; i++) {
      cumulative += weights[i];
      if (roll <= cumulative) return enemyDef.intent_policy[i]?.intent || 'Attack';
    }
    return enemyDef.intent_policy[0]?.intent || 'Attack';
  }

  startTurn(): void {
    const state = this.deps.getState();
    const combat = state.combat;
    if (!combat) return;

    combat.isPlayerTurn = true;
    this.deps.appendVoxLog(`玩家阶段开始。能量回填至 ${state.player.maxEnergy}。`);
    combat.player.damageTakenLastTurn = Math.max(0, Math.floor(combat.player.damageTakenThisTurn || 0));
    combat.player.damageTakenThisTurn = 0;
    combat.player.energy = state.player.maxEnergy;
    if (combat.turn > 1) {
      combat.player.block = 0;
    }
    combat.player.cardsPlayedThisTurn = 0;
    combat.player.potionsUsedThisTurn = 0;

    if (this.processTurnStartDots('player', 'player')) {
      this.deps.notify();
      return;
    }

    this.executeConstructAttacks();

    let skipDrawThisTurn = false;
    if ((combat.player.statuses['SkipDraw'] || 0) > 0) {
      skipDrawThisTurn = true;
      combat.player.statuses['SkipDraw'] = Math.max(0, (combat.player.statuses['SkipDraw'] || 0) - 1);
      if (combat.player.statuses['SkipDraw'] <= 0) delete combat.player.statuses['SkipDraw'];
      combat.warpPulse = { text: '时序债务生效：本回合跳过抽牌阶段', tone: 'warp' };
    }
    this.processStatusDecay(combat.player.statuses);
    this.tickDelayedCards();
    if (!skipDrawThisTurn) {
      this.drawCards(5);
    }

    this.deps.actionManager.updateState(state);

    relicSystem.trigger('StartTurn', state, (actionOrSpec: any, ctx: IActionContext) => {
      if (actionOrSpec && typeof actionOrSpec.execute === 'function') {
        this.deps.actionManager.enqueueUrgentAction(actionOrSpec, ctx, 'relic');
      } else {
        this.deps.actionManager.enqueueUrgent(actionOrSpec, ctx, 'relic');
      }
    });

    this.deps.actionManager.executeAll().then(() => this.deps.notify());
  }

  private executeConstructAttacks(): void {
    const state = this.deps.getState();
    const combat = state.combat;
    if (!combat) return;

    const constructs = combat.player.constructs || [];
    if (constructs.length === 0) return;

    const aliveEnemies = combat.enemies.filter(e => e.hp > 0);
    if (aliveEnemies.length === 0) return;

    for (const construct of constructs) {
      if (construct.hp <= 0) continue;

      const atk = Math.max(0, construct.atk || 0);
      if (atk <= 0) continue;

      const target = aliveEnemies[Math.floor(this.deps.rng() * aliveEnemies.length)];
      if (!target) continue;

      const damage = this.deps.calculateDamage(atk, {}, target.statuses || {}, 'player');
      target.hp = Math.max(0, target.hp - damage);

      combat.warpPulse = {
        text: `${construct.name} 对 ${target.name} 造成 ${damage} 点伤害`,
        tone: 'faith'
      };

      if (target.hp <= 0) {
        this.handleEnemyDefeated(target.id);
      }
    }
  }

  private processStatusDecay(statuses: Record<string, number>): void {
    const decayStatuses = ['Vulnerable', 'Weak', 'Frail', 'Fear', 'Stealth', 'Regen', 'Energized', 'Berserk', 'Intangible', 'BlockBlocked'];
    decayStatuses.forEach(status => {
      if (statuses[status] !== undefined && statuses[status] > 0) {
        statuses[status]--;
        if (statuses[status] <= 0) {
          delete statuses[status];
        }
      }
    });
  }

  private drawCards(amount: number): void {
    const state = this.deps.getState();
    const combat = state.combat;
    if (!combat) return;

    for (let i = 0; i < amount; i++) {
      if (combat.drawPile.length === 0) {
        if (combat.discardPile.length === 0) break;
        combat.drawPile = this.deps.shuffleDeck(combat.discardPile as CardDef[]) as RunCardInstance[];
        combat.discardPile = [];

        globalEventBus.publish({ type: 'DeckShuffled' } as any);
      }

      if (combat.drawPile.length > 0) {
        const card = combat.drawPile.pop()!;
        combat.hand.push(card);
      }
    }
  }

  private tickDelayedCards(): void {
    const state = this.deps.getState();
    const combat = state.combat;
    if (!combat) return;

    const delayedCards = combat.player.delayedCards || [];
    if (delayedCards.length === 0) return;

    const stillDelayed: any[] = [];

    for (const delayed of delayedCards) {
      (delayed as any).turns--;
      if ((delayed as any).turns <= 0) {
        combat.hand.push(delayed.card);
      } else {
        stillDelayed.push(delayed);
      }
    }

    combat.player.delayedCards = stillDelayed;
  }

  private processTurnStartDots(targetType: 'player' | 'enemy', targetId: string): boolean {
    const state = this.deps.getState();
    const combat = state.combat;
    if (!combat) return false;

    if (targetType === 'player') {
      const poison = combat.player.statuses['Poison'] || 0;
      if (poison > 0) {
        combat.player.hp = Math.max(0, combat.player.hp - poison);
        combat.player.statuses['Poison'] = Math.max(0, poison - 1);
        if (combat.player.statuses['Poison'] <= 0) delete combat.player.statuses['Poison'];

        if (combat.player.hp <= 0) {
          this.handlePlayerDefeated();
          return true;
        }
      }
    } else {
      const enemy = combat.enemies.find(e => e.id === targetId);
      if (!enemy) return false;

      const poison = enemy.statuses['Poison'] || 0;
      if (poison > 0) {
        enemy.hp = Math.max(0, enemy.hp - poison);
        enemy.statuses['Poison'] = Math.max(0, poison - 1);
        if (enemy.statuses['Poison'] <= 0) delete enemy.statuses['Poison'];

        if (enemy.hp <= 0) {
          this.handleEnemyDefeated(targetId);
          return true;
        }
      }
    }

    return false;
  }

  private handleEnemyDefeated(enemyId: string): void {
    const state = this.deps.getState();
    const combat = state.combat;
    if (!combat) return;

    const enemyIndex = combat.enemies.findIndex(e => e.id === enemyId);
    if (enemyIndex === -1) return;

    const enemy = combat.enemies[enemyIndex];
    combat.enemies.splice(enemyIndex, 1);

    this.deps.appendVoxLog(`${enemy.name} 被击败！`);

    if (combat.enemies.length === 0) {
      this.handleCombatVictory();
    }
  }

  private handleCombatVictory(): void {
    const state = this.deps.getState();
    if (!state.combat) return;

    this.deps.appendVoxLog(`战斗胜利！`);

    globalEventBus.publish({ type: 'CombatVictory' } as any);
  }

  private handlePlayerDefeated(): void {
    const state = this.deps.getState();
    if (!state.combat) return;

    this.deps.appendVoxLog(`战斗失败...`);

    globalEventBus.publish({ type: 'PlayerDeath' } as any);
  }

  discardHand(): void {
    const state = this.deps.getState();
    const combat = state.combat;
    if (!combat) return;

    combat.discardPile.push(...combat.hand);
    combat.hand = [];
  }

  async endTurn(): Promise<void> {
    const state = this.deps.getState();
    const combat = state.combat;
    if (!combat || !combat.isPlayerTurn) return;

    combat.isPlayerTurn = false;
    this.deps.appendVoxLog('玩家结束阶段。敌方即将行动。');

    this.discardHand();

    await this.executeEnemyTurn();

    combat.turn++;
    this.startTurn();
  }

  private async executeEnemyTurn(): Promise<void> {
    const state = this.deps.getState();
    const combat = state.combat;
    if (!combat) return;

    const aliveEnemies = combat.enemies.filter(e => e.hp > 0);

    for (const enemy of aliveEnemies) {
      if (enemy.hp <= 0) continue;
      if (this.processTurnStartDots('enemy', enemy.id)) {
        if (!state.combat || state.screen !== 'Combat') return;
      }

      enemy.block = 0;

      const intent = enemy.nextIntent || 'Attack';
      const def = enemiesData.find((e: any) => e.id === enemy.defId) as any;
      const move = def?.moves?.[intent];
      
      if (move && Array.isArray(move)) {
        for (const actionSpec of move) {
          if (actionSpec.type === 'DealDamage' && actionSpec.amount) {
            const actualDamage = this.deps.calculateDamage(actionSpec.amount, enemy.statuses || {}, combat.player.statuses, 'enemy');
            combat.player.hp = Math.max(0, combat.player.hp - actualDamage);
            this.deps.appendVoxLog(`${enemy.name} 对玩家造成 ${actualDamage} 点伤害。`);

            if (combat.player.hp <= 0) {
              this.handlePlayerDefeated();
              return;
            }
          }
        }
      }

      enemy.nextIntent = this.selectIntent(def);
    }
  }
}
