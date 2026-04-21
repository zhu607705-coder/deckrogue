import { GameState, CardDef, RunCardInstance } from '@/core/types';
import { combatSystem, DamageContext } from '@/core/combat/combatSystem';
import {
  applyCombatAfflictionToInstance,
  normalizeRunCardInstance,
} from '@/core/combat/runCardInstance';
import { economySystem } from '@/features/progression/economySystem';
import { relicSystem } from '@/features/relics/relicSystem';
import { globalEventBus } from '@/core/events/eventBus';
import { metricsTracker } from '@/core/events/metricsTracker';
import { getBossPhaseEncounter, getBossPhaseForHpPct } from '@/core/events/bossPhaseSystem';
import {
  enemiesData,
  getSingleSlimeRoomBoostConfig,
  getCardEnchantmentDefById,
  applyEnemyHpTuningByNumericRules,
  isEnemyEligibleForFloorByNumericRules,
  rollEnemyBaseHp,
} from '@/content/narrative/numericSystem';
import { unlockCodexEntry } from '@/core/persistence/codexStore';
import { safeArrayAccess } from '@/core/utils/safeArray';
import { COMBAT_NUMBERS } from '@/core/balance/numericConstants';
import type { IActionContext } from '@/core/actions/actionQueue';
import type { ActionManager } from '@/core/actions/actionManager';

export interface CombatManagerDeps {
  getState: () => GameState;
  rng: () => number;
  generateId: () => string;
  createRuntimeCard: (card: CardDef, instanceId?: string) => RunCardInstance;
  shuffleDeck: <T extends CardDef>(deck: T[]) => T[];
  syncRngState: () => void;
  appendVoxLog: (message: string) => void;
  notify: () => void;
  getCurrentFloorNumber: () => number;
  applyRunTransition: (action: { type: string; phase?: string }) => void;
  syncPlayerStateFromCombat: () => void;
  clearCombatAfflictionsForRunCards: () => void;
  generateCardRewards: (count: number) => RunCardInstance[];
  tryDelegatedCompleteCombat: () => boolean;
  ensureRunEffects: () => Record<string, unknown>;
}

export class CombatManager {
  private combatVictoryInProgress = false;
  private playerDeathInProgress = false;
  private readonly disposables: Array<() => void> = [];

  constructor(private deps: CombatManagerDeps, private actionManager: ActionManager) {
    this.disposables.push(
      globalEventBus.subscribe('EnemyDeath', (event: any) => {
        if (!event?.enemyId) return;
        this.handleEnemyDefeated(event.enemyId);
      }),
    );
  }

  dispose(): void {
    this.disposables.splice(0).forEach((dispose) => {
      try {
        dispose();
      } catch (error) {
        console.error('[CombatManager] Failed to dispose subscription:', error);
      }
    });
  }

  startCombat(nodeType: 'Combat' | 'Elite' | 'Boss'): void {
    const state = this.deps.getState();
    const nodeId = state.currentNodeId || '';
    this.deps.syncRngState();
    const stateSnapshot = this.cloneGameStateSnapshot({
      ...state,
      combat: null,
      combatRestartCheckpoint: undefined,
    });

    state.combatRestartCheckpoint = {
      nodeId,
      nodeType,
      stateSnapshot,
      rngState: state.rngState,
      pendingNodeResolution: state.pendingNodeResolution
    };

    const floor = this.deps.getCurrentFloorNumber();
    const hpMultiplier = economySystem.calculateHpMultiplier(floor) * Math.max(1, Number(state.metaRuntime?.ascensionEnemyHpMultiplier || 1));

    const enemyCount = nodeType === 'Boss' ? 1 : nodeType === 'Elite' ? 2 : 1 + Math.floor(this.deps.rng() * 2);
    const enemies = this.generateEnemies(enemyCount, nodeType, floor, hpMultiplier);

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
      drawPile: this.deps.shuffleDeck([...state.player.deck]),
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
    this.initializeBossPhaseRuntime();
    this.applyRunEffectCombatModifiers();

    state.screen = 'Combat';
    metricsTracker.recordCombatStart?.();
    globalEventBus.publish({ type: 'CombatStart' } as any);
    relicSystem.trigger('CombatStart', state, (actionOrSpec: any, ctx: IActionContext) => {
      if (actionOrSpec && typeof actionOrSpec.execute === 'function') {
        this.actionManager.enqueueUrgentAction(actionOrSpec, ctx, 'relic');
      } else {
        this.actionManager.enqueueUrgent(actionOrSpec, ctx, 'relic');
      }
    });
    if ((state.player.corruption || 0) > 0) {
      state.combat.warpPulse = {
        text: `Corruption stirs the warp: Tide ${state.combat.warpTide} · DMG x${this.getCorruptionDamageBonusMultiplier().toFixed(2)}`,
        tone: (state.combat.warpTide || 0) >= 50 ? 'danger' : 'warp'
      };
    }
    this.startPlayerTurn();
  }

  private cloneGameStateSnapshot<T>(snapshot: T): T {
    try {
      return JSON.parse(JSON.stringify(snapshot)) as T;
    } catch (error) {
      console.error('Failed to clone game state snapshot:', error);
      return snapshot;
    }
  }

  private applyRunEffectCombatModifiers(): void {
    const state = this.deps.getState();
    const combat = state.combat;
    if (!combat) return;
    const runEffects = this.deps.ensureRunEffects() as Record<string, number>;

    const enemyHuntBonusPct = Math.max(0, Number(runEffects.enemyHuntBonusPct || 0));
    if (enemyHuntBonusPct > 0) {
      const bonusStrength = Math.max(1, Math.round(enemyHuntBonusPct * 10));
      for (const enemy of combat.enemies) {
        const hpBonus = Math.max(1, Math.floor(enemy.maxHp * enemyHuntBonusPct));
        enemy.maxHp += hpBonus;
        enemy.hp += hpBonus;
        enemy.statuses['Strength'] = (enemy.statuses['Strength'] || 0) + bonusStrength;
      }
      combat.warpPulse = {
        text: `Inquisitorial pursuit empowers the enemy (+${Math.round(enemyHuntBonusPct * 100)}%)`,
        tone: 'danger'
      };
    }

    const pendingWarpTideBonus = Number(runEffects.pendingWarpTideBonus || 0);
    if (pendingWarpTideBonus > 0) {
      runEffects.pendingWarpTideBonus = 0;
    }

    const warpDebuffCombatsRemaining = Number(runEffects.warpDebuffCombatsRemaining || 0);
    if (warpDebuffCombatsRemaining > 0) {
      combat.player.statuses['Fear'] = Math.max(combat.player.statuses['Fear'] || 0, 2);
      combat.player.statuses['Vulnerable'] = Math.max(combat.player.statuses['Vulnerable'] || 0, 2);
      runEffects.warpDebuffCombatsRemaining = Math.max(0, warpDebuffCombatsRemaining - 1);
      combat.warpPulse = {
        text: `Warp aftershocks: Fear + Vulnerable (${runEffects.warpDebuffCombatsRemaining} fights remain)`,
        tone: 'danger'
      };
    }
  }

  private getCorruptionDamageBonusMultiplier(): number {
    const state = this.deps.getState();
    const corruption = Math.max(
      COMBAT_NUMBERS.corruption.min,
      Math.min(COMBAT_NUMBERS.corruption.max, state.player.corruption || 0)
    );
    return 1 + Math.min(COMBAT_NUMBERS.corruption.damageBonusCap, corruption * COMBAT_NUMBERS.corruption.bonusPerPoint);
  }

  private initializeBossPhaseRuntime(): void {
    const state = this.deps.getState();
    const combat = state.combat;
    if (!combat) return;
    const bossEnemy = combat.enemies.find((e) => {
      const def = enemiesData.find((d) => d.id === e.defId);
      return !!def?.keywords?.includes('boss');
    });
    if (!bossEnemy) return;
    const encounter = getBossPhaseEncounter(bossEnemy.defId);
    if (!encounter) return;
    const initial = getBossPhaseForHpPct(bossEnemy.defId, bossEnemy.maxHp > 0 ? bossEnemy.hp / bossEnemy.maxHp : 1);
    if (!initial) return;
    combat.bossPhase = {
      enemyId: bossEnemy.id,
      bossDefId: bossEnemy.defId,
      phaseIndex: initial.phaseIndex,
      phaseId: initial.phase.id,
      phaseName: initial.phase.name,
      phaseHint: initial.phase.hint,
      enteredTurn: combat.turn || 1,
      currentPlayerTurnCards: [],
      previousPlayerTurnCards: [],
      flags: {}
    };
    if (initial.phase.onEnter?.warpPulse) {
      combat.warpPulse = { text: initial.phase.onEnter.warpPulse, tone: 'warp' };
    }
  }

  private generateEnemies(
    count: number,
    nodeType: 'Combat' | 'Elite' | 'Boss',
    floor: number,
    hpMultiplier: number
  ): any[] {
    const validEnemies = enemiesData.filter(e => {
      if (nodeType === 'Boss') return e.keywords?.includes('boss');
      if (nodeType === 'Elite') return e.keywords?.includes('elite');
      return !e.keywords?.includes('boss') && !e.keywords?.includes('elite');
    });
    const stagedEnemies = validEnemies.filter(e => isEnemyEligibleForFloorByNumericRules(e as any, floor, nodeType));
    const enemyPool = stagedEnemies.length > 0 ? stagedEnemies : validEnemies;

    return Array.from({ length: count }, (_, i) => {
      const def = safeArrayAccess(enemyPool, Math.floor(this.deps.rng() * enemyPool.length));
      if (!def) {
        return null;
      }
      if (def?.id) {
        const eliteLike = !!def.keywords?.includes('elite') || !!def.keywords?.includes('boss');
        unlockCodexEntry(eliteLike ? 'elites' : 'enemies', def.id);
      }
      const baseHp = rollEnemyBaseHp(def, this.deps.rng);
      const scaledHp = applyEnemyHpTuningByNumericRules(baseHp, floor, nodeType, hpMultiplier);

      return {
        id: `enemy_${i}_${this.deps.generateId()}`,
        defId: def.id,
        name: def.name,
        hp: scaledHp,
        maxHp: scaledHp,
        block: 0,
        statuses: {},
        nextIntent: this.selectIntent(def),
        devotion: 0,
        corruptionAxis: 0,
        axisDisposition: 'balanced'
      };
    }).filter((enemy): enemy is NonNullable<typeof enemy> => enemy !== null).map((enemy) => {
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
    const state = this.deps.getState();
    const baseWeights = Array.isArray(enemyDef.intent_policy)
      ? enemyDef.intent_policy.map((p: any) => Math.max(0, Number(p.weight) || 0))
      : [];
    const totalWeight = baseWeights.reduce((sum, w) => sum + w, 0);
    if (totalWeight <= 0) {
      return enemyDef.intent_policy?.[0]?.intent || 'Attack';
    }

    const aggroBias = Math.max(0, Number(state.metaRuntime?.ascensionIntentAggroBias || 0));
    let weights = [...baseWeights];
    if (aggroBias > 0 && Array.isArray(enemyDef.intent_policy)) {
      for (let i = 0; i < enemyDef.intent_policy.length; i++) {
        const intent = enemyDef.intent_policy[i]?.intent || '';
        const isAggressive = /attack|strike|damage|slam|punch|kick|gore|claw|bite|curse|doom/.test(intent.toLowerCase());
        if (isAggressive) {
          weights[i] = weights[i] * (1 + aggroBias);
        }
      }
    }

    const totalAdjustedWeight = weights.reduce((sum, w) => sum + w, 0);
    const roll = this.deps.rng() * totalAdjustedWeight;
    let cumulative = 0;
    for (let i = 0; i < weights.length; i++) {
      cumulative += weights[i];
      if (roll <= cumulative) return enemyDef.intent_policy[i]?.intent || 'Attack';
    }
    return enemyDef.intent_policy[0]?.intent || 'Attack';
  }

  startPlayerTurn(): void {
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

    this.actionManager.updateState(state);
    this.actionManager.executeAll().then(() => this.deps.notify());
  }

  private executeConstructAttacks(): void {
    const state = this.deps.getState();
    const combat = state.combat;
    if (!combat) return;

    const constructs = combat.player.constructs || [];
    if (constructs.length === 0) return;

    for (const construct of constructs) {
      if (construct.hp <= 0) continue;

      const atk = Math.max(0, construct.atk || 0);
      if (atk <= 0) continue;

      const aliveEnemies = combat.enemies.filter(e => e.hp > 0);
      if (aliveEnemies.length === 0) return;

      const target = safeArrayAccess(aliveEnemies, Math.floor(this.deps.rng() * aliveEnemies.length));
      if (!target) continue;

      const damage = combatSystem.applyDamage(state, {
        amount: atk,
        sourceType: 'player',
        sourceId: construct.id,
        targetType: 'enemy',
        targetId: target.id,
        modifiers: [],
        isTrueDamage: false,
        ignoreBlock: false,
      });

      combat.warpPulse = {
        text: `${construct.name} 对 ${target.name} 造成 ${damage} 点伤害`,
        tone: 'faith'
      };
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

  drawCards(amount: number): void {
    const state = this.deps.getState();
    const combat = state.combat;
    if (!combat) return;

    for (let i = 0; i < amount; i++) {
      if (combat.drawPile.length === 0) {
        if (combat.discardPile.length === 0) break;
        combat.drawPile = this.deps.shuffleDeck(combat.discardPile);
        combat.discardPile = [];

        globalEventBus.publish({ type: 'DeckShuffled' } as any);
      }

      if (combat.drawPile.length > 0) {
        const card = combat.drawPile.pop()!;
        combat.hand.push(card);
      }
    }
  }

  async playCard(cardInstanceId: string, targetId?: string): Promise<void> {
    console.log('[CombatManager.playCard] START', { cardInstanceId, targetId });
    
    const state = this.deps.getState();
    const combat = state.combat;
    
    console.log('[CombatManager.playCard] State check:', {
      hasCombat: !!combat,
      isPlayerTurn: combat?.isPlayerTurn,
      playerEnergy: combat?.player?.energy,
      enemyCount: combat?.enemies?.length,
      enemyIds: combat?.enemies?.map(e => ({ id: e.id, hp: e.hp, block: e.block }))
    });
    
    if (!combat || !combat.isPlayerTurn) {
      console.warn('[CombatManager.playCard] Early return: no combat or not player turn');
      return;
    }

    const cardIndex = combat.hand.findIndex(c => c.instanceId === cardInstanceId);
    console.log('[CombatManager.playCard] Card search:', { cardInstanceId, found: cardIndex !== -1 });
    
    if (cardIndex === -1) {
      console.warn('[CombatManager.playCard] Card not found in hand:', cardInstanceId);
      return;
    }

    const card = combat.hand[cardIndex];
    console.log('[CombatManager.playCard] Card found:', {
      id: card.id,
      name: card.name,
      cost: card.cost,
      targeting: card.targeting,
      actions: card.actions
    });
    
    unlockCodexEntry('cards', card.id);

    if (combat.player.energy < card.cost) {
      console.warn('[CombatManager.playCard] Not enough energy:', {
        current: combat.player.energy,
        required: card.cost
      });
      return;
    }

    combat.player.energy -= card.cost;
    combat.hand.splice(cardIndex, 1);
    combat.discardPile.push(card);
    combat.player.cardsPlayedThisTurn++;
    combat.player.lastPlayedCard = card;
    
    console.log('[CombatManager.playCard] Energy spent, remaining:', combat.player.energy);

    if (combat.bossPhase) {
      combat.bossPhase.currentPlayerTurnCards.push(card);
      if (combat.bossPhase.currentPlayerTurnCards.length > 12) {
        combat.bossPhase.currentPlayerTurnCards = combat.bossPhase.currentPlayerTurnCards.slice(-12);
      }
    }

    const context = {
      source: 'player' as const,
      sourceId: 'player',
      targetId,
      cardId: card.id,
      cardInstanceId: card.instanceId,
      card
    };
    
    console.log('[CombatManager.playCard] Executing actions with context:', context);

    this.actionManager.enqueueAll(card.actions, context, 0, 'card');
    const execResult = await this.actionManager.executeAll();
    
    console.log('[CombatManager.playCard] Actions executed, result:', execResult);
    console.log('[CombatManager.playCard] Enemy HP after actions:', 
      combat.enemies.map(e => ({ id: e.id, hp: e.hp, block: e.block })));

    globalEventBus.publish({
      type: 'CardPlayed',
      cardId: card.id,
      cardType: card.type,
      cardInstanceId: card.instanceId,
      targetId
    } as any);

    this.deps.notify();
    console.log('[CombatManager.playCard] END');
  }

  async endTurn(): Promise<void> {
    const state = this.deps.getState();
    const combat = state.combat;
    if (!combat || !combat.isPlayerTurn) return;

    combat.isPlayerTurn = false;
    this.deps.appendVoxLog('玩家结束阶段。敌方即将行动。');

    if (combat.bossPhase) {
      combat.bossPhase.previousPlayerTurnCards = [...(combat.bossPhase.currentPlayerTurnCards || [])];
      combat.bossPhase.currentPlayerTurnCards = [];
    }

    combat.discardPile.push(...combat.hand);
    combat.hand = [];

    await this.executeEnemyTurn();

    combat.turn++;
    this.startPlayerTurn();
  }

  discardHand(): void {
    const state = this.deps.getState();
    const combat = state.combat;
    if (!combat) return;

    combat.discardPile.push(...combat.hand);
    combat.hand = [];
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
        continue;
      }
      this.processStatusDecay(enemy.statuses);
      const platedArmor = Math.max(0, Math.floor(enemy.statuses['PlatedArmor'] || 0));
      if (platedArmor > 0) {
        enemy.block = Math.max(0, (enemy.block || 0) + platedArmor);
      }

      const enemyDef = enemiesData.find(e => e.id === enemy.defId);
      if (!enemyDef) continue;

      const intent = enemy.nextIntent || 'Attack';
      const move = enemyDef.moves?.[intent];

      if (move && Array.isArray(move)) {
        for (const actionSpec of move) {
          if (actionSpec.type === 'DealDamage' && actionSpec.amount) {
            const actualDamage = combatSystem.calculateEffectiveDamage(state, actionSpec.amount, enemy.statuses || {}, combat.player.statuses, 'enemy');
            combat.player.hp = Math.max(0, combat.player.hp - actualDamage);
            this.deps.appendVoxLog(`${enemy.name} 对玩家造成 ${actualDamage} 点伤害。`);

            if (combat.player.hp <= 0) {
              this.handleCombatDefeat();
              return;
            }
          }
        }
      }

      enemy.lastUsedIntent = intent;
      enemy.block = 0;
      enemy.nextIntent = this.selectIntent(enemyDef);
    }

    relicSystem.trigger('EndTurn', state, (actionOrSpec: any, ctx: IActionContext) => {
      if (actionOrSpec && typeof actionOrSpec.execute === 'function') {
        this.actionManager.enqueueUrgentAction(actionOrSpec, ctx, 'relic');
      } else {
        this.actionManager.enqueueUrgent(actionOrSpec, ctx, 'relic');
      }
    });

    await this.actionManager.executeAll();
  }

  handleEnemyDefeated(enemyId: string): void {
    const state = this.deps.getState();
    const combat = state.combat;
    if (!combat) return;

    const enemy = combat.enemies.find(e => e.id === enemyId);
    if (!enemy) return;

    metricsTracker.recordEnemyDefeated(enemy.defId);

    const allEnemiesDefeated = combat.enemies.every(e => e.hp <= 0);
    if (allEnemiesDefeated && state.screen !== 'GameOver') {
      globalEventBus.publish({ type: 'CombatVictory' } as any);
    }
  }

  handleCombatVictory(): void {
    if (this.combatVictoryInProgress) return;
    const state = this.deps.getState();
    if (!state.combat) return;

    this.combatVictoryInProgress = true;
    try {
      this.deps.syncPlayerStateFromCombat();

      const floor = this.deps.getCurrentFloorNumber();
      const rewards = (economySystem as any).calculateCombatRewards?.(floor, state.player.relics, 'Combat') ??
        { gold: economySystem.calculateGoldReward(floor, false, false), cardCount: 1 };

      metricsTracker.recordCombatVictory(floor);
      this.deps.clearCombatAfflictionsForRunCards();

      if (this.deps.tryDelegatedCompleteCombat()) {
        this.deps.notify();
        return;
      }

      state.player.gold += rewards.gold;
      state.rewardCards = this.deps.generateCardRewards(3);
      state.combat = null;
      state.combatRestartCheckpoint = undefined;
      this.deps.applyRunTransition({ type: 'COMBAT_WON' });
      this.deps.notify();
    } finally {
      this.combatVictoryInProgress = false;
    }
  }

  handleCombatDefeat(): void {
    if (this.playerDeathInProgress) return;
    const state = this.deps.getState();
    if (state.screen === 'GameOver') return;

    this.playerDeathInProgress = true;
    try {
      this.deps.clearCombatAfflictionsForRunCards();
      state.combatRestartCheckpoint = undefined;
      metricsTracker.recordRunEnd(false, this.deps.getCurrentFloorNumber());
      this.deps.applyRunTransition({ type: 'PLAYER_DIED' });
      globalEventBus.publish({
        type: 'PlayerDefeated',
        timestamp: Date.now()
      });
      this.deps.notify();
    } finally {
      this.playerDeathInProgress = false;
    }
  }

  processTurnStartDots(targetType: 'player' | 'enemy', targetId: string): boolean {
    const state = this.deps.getState();
    const combat = state.combat;
    if (!combat) return false;
    const target = targetType === 'player'
      ? combat.player
      : combat.enemies.find(e => e.id === targetId);
    if (!target || target.hp <= 0) return false;

    const poison = Math.max(0, Math.floor(target.statuses['Poison'] || 0));
    if (poison <= 0) return false;

    const damageContext: DamageContext = {
      amount: poison,
      sourceType: 'system',
      sourceId: 'poison',
      targetType,
      targetId,
      modifiers: [],
      isTrueDamage: true,
      ignoreBlock: true
    };
    combatSystem.applyDamage(state, damageContext);

    const nextPoison = Math.max(0, poison - 1);
    if (nextPoison > 0) {
      target.statuses['Poison'] = nextPoison;
    } else {
      delete target.statuses['Poison'];
    }

    return !state.combat || target.hp <= 0;
  }

  tickDelayedCards(): void {
    const state = this.deps.getState();
    const combat = state.combat;
    if (!combat || combat.player.delayedCards.length === 0) return;

    const ready: typeof combat.player.delayedCards = [];
    const pending: typeof combat.player.delayedCards = [];
    for (const delayed of combat.player.delayedCards) {
      const nextTurns = (delayed.turns ?? 0) - 1;
      if (nextTurns <= 0) ready.push({ ...delayed, turns: 0 });
      else pending.push({ ...delayed, turns: nextTurns });
    }
    combat.player.delayedCards = pending;

    for (const delayed of ready) {
      const delayAction = delayed.card?.actions?.find((a: any) => a.type === 'Delay');
      if (!delayAction?.actions?.length) continue;

      let targetId = delayed.targetId;
      if (targetId) {
        const target = combat.enemies.find(e => e.id === targetId && e.hp > 0);
        if (!target) {
          const aliveEnemies = combat.enemies.filter(e => e.hp > 0);
          const randomEnemy = safeArrayAccess(aliveEnemies, Math.floor(this.deps.rng() * aliveEnemies.length));
          if (randomEnemy) {
            targetId = randomEnemy.id;
          } else {
            targetId = undefined;
          }
        }
      }

      for (const spec of delayAction.actions) {
        this.actionManager.enqueueUrgent(
          spec,
          {
            source: 'player',
            sourceId: 'player',
            targetId: targetId,
            card: delayed.card,
            cardId: delayed.card?.id,
            cardInstanceId: delayed.card?.instanceId
          },
          'system'
        );
      }
    }

    if (ready.length > 0) {
      combat.warpPulse = {
        text: `${ready.length > 1 ? `${ready.length} delayed effects` : (ready[0]?.card?.name || 'Delayed effect')} triggers`,
        tone: 'warp'
      };
    }
  }
}
