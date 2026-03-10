import { GameState, ActionSpec } from '@/core/types';
import { IAction, IActionContext, ActionQueue } from '@/core/actions/actionQueue';
import { combatSystem, DamageContext } from '@/core/combat/combatSystem';
import { globalEventBus } from '@/core/events/eventBus';
import { getActionManager } from '@/core/actions/actionManager';
import { TargetingService } from '@/core/combat/targetingService';
import { ActionFactoryV2 } from '@/core/actions/v2/ActionFactory';
import { enemiesData } from '@/content/narrative/numericSystem';
import { stateRandom } from '@/infrastructure/rng/stateRandom';

export abstract class BaseWarpAction implements IAction {
  protected spec: ActionSpec;
  protected context: IActionContext = { source: 'player' };

  constructor(spec: ActionSpec) {
    this.spec = spec;
  }

  get type(): string {
    return this.spec.type;
  }

  setContext(context: IActionContext): void {
    this.context = context;
  }

  abstract execute(state: GameState, queue: ActionQueue): void;

  protected getContextFromQueue(queue: ActionQueue): IActionContext {
    return (queue as any)._currentContext || { source: 'player' };
  }
}

export class DealWarpDamageAction extends BaseWarpAction {
  private amount: number;
  private alpha?: number;

  constructor(spec: ActionSpec) {
    super(spec);
    this.amount = spec.amount || 0;
    this.alpha = spec.alpha;
  }

  execute(state: GameState, queue: ActionQueue): void {
    const combat = state.combat;
    if (!combat) return;

    this.context = this.getContextFromQueue(queue);

    const targets = TargetingService.resolveTargets(state, this.context, 'Enemy');
    if (targets.length === 0) return;

    const alpha = this.alpha || combat.warpAlpha;
    const warpMultiplier = 1 + alpha * Math.pow(combat.warpTide / 100, 2);
    const scaled = Math.max(0, Math.floor(this.amount * warpMultiplier));

    targets.forEach(target => {
      combatSystem.applyDamage(state, {
        amount: scaled,
        sourceType: this.context.source === 'player' ? 'player' : 'enemy',
        sourceId: this.context.sourceId || this.context.source,
        targetType: target.type,
        targetId: target.id,
        modifiers: [],
        isTrueDamage: false,
        ignoreBlock: false
      });
    });
  }
}

export class ModifyWarpTideAction extends BaseWarpAction {
  private amount: number;

  constructor(spec: ActionSpec) {
    super(spec);
    this.amount = spec.amount || 0;
  }

  execute(state: GameState, queue: ActionQueue): void {
    const combat = state.combat;
    if (!combat) return;

    const before = combat.warpTide;
    combat.warpTide = Math.max(0, Math.min(100, combat.warpTide + this.amount));
    const actualDelta = combat.warpTide - before;

    if (actualDelta !== 0) {
      const noun = actualDelta > 0 ? 'rises' : 'subsides';
      combat.warpPulse = {
        text: `Warp Tide ${noun} ${actualDelta > 0 ? '+' : ''}${actualDelta} (${combat.warpTide})`,
        tone: actualDelta > 0 ? 'warp' : 'faith'
      };

      globalEventBus.publish({
        type: 'WarpTideChanged',
        amount: actualDelta,
        current: combat.warpTide
      });
    }
  }
}

export class CheckWarpPerilAction extends BaseWarpAction {
  private sensitivity?: number;

  constructor(spec: ActionSpec) {
    super(spec);
    this.sensitivity = spec.sensitivity;
  }

  execute(state: GameState, queue: ActionQueue): void {
    const combat = state.combat;
    if (!combat) return;

    this.context = this.getContextFromQueue(queue);

    const sourceEntity = this.context.source === 'player'
      ? combat.player
      : combat.enemies.find(e => e.id === this.context.source);

    if (!sourceEntity || sourceEntity.hp <= 0) return;

    const k = this.sensitivity || combat.warpPerilK;
    const W = Math.max(0, Math.min(100, combat.warpTide));
    if (W <= 0) return;

    const numerator = Math.exp(k * W) - 1;
    const denominator = Math.exp(100 * k) - 1;
    let chance = denominator <= 0 ? 0 : Math.max(0, Math.min(1, numerator / denominator));

    if (sourceEntity.statuses?.HexWard) {
      chance -= 0.2;
    }
    chance = Math.max(0, Math.min(0.95, chance));

    if (combat.warpRiftTurns && combat.warpRiftTurns > 0) {
      chance = Math.max(chance, combat.warpRiftPerilFloor || 0);
    }

    if (stateRandom(state) >= chance) return;

    const perilRoll = stateRandom(state);

    if (perilRoll < 0.45) {
      this.triggerMindBurn(state, sourceEntity, chance);
    } else if (perilRoll < 0.8) {
      this.spawnDaemonicIncursion(state, queue);
      combat.warpPulse = { text: 'Perils of the Warp: Daemonic Incursion!', tone: 'danger' };
    } else {
      sourceEntity.corruptionAxis = 100;
      const entityName = this.context.source === 'player' ? 'Player' : (('name' in sourceEntity ? sourceEntity.name : undefined) || 'Unit');
      combat.warpPulse = { text: `${entityName} mutates into a Chaos Egg!`, tone: 'danger' };
    }

    combat.warpTide = Math.max(0, combat.warpTide - 20);
  }

  private triggerMindBurn(state: GameState, sourceEntity: any, chance: number): void {
    const combat = state.combat;
    if (!combat) return;

    const selfDamage = Math.max(1, Math.floor(sourceEntity.hp * 0.8));

    const sourceType = this.context.source === 'player' ? 'player' : 'enemy';
    const sourceId = this.context.sourceId || this.context.source;

    combatSystem.applyDamage(state, {
      amount: selfDamage,
      sourceType: 'system',
      sourceId: 'warp_peril',
      targetType: sourceType,
      targetId: sourceId,
      modifiers: [],
      isTrueDamage: true,
      ignoreBlock: true
    });

    if (this.context.source === 'player') {
      combatSystem.applyStatus(state, 'player', 'player', 'Fear', 2);
      combatSystem.applyStatus(state, 'player', 'player', 'Weak', 1);
    } else {
      const aliveEnemies = combat.enemies.filter(e => e.id !== this.context.source && e.hp > 0);
      aliveEnemies.forEach(enemy => {
        combatSystem.applyStatus(state, 'enemy', enemy.id, 'Fear', 1);
      });
    }

    combat.warpPulse = { text: `Perils of the Warp: Mind Burn (${Math.round(chance * 100)}%)`, tone: 'danger' };
  }

  private spawnDaemonicIncursion(state: GameState, queue: ActionQueue): void {
    const combat = state.combat;
    if (!combat || combat.enemies.length >= 5) return;

    const def = enemiesData.find(e => e.id === 'cultist') || enemiesData.find(e => e.id === 'goblin');
    if (!def) return;

    const manager = getActionManager();
    if (!manager) return;

    const summonAction = ActionFactoryV2.createAction({
      type: 'Summon',
      unit: 'daemonic_incursion',
      amount: 1
    });

    const context = {
      source: 'system' as const,
      sourceId: 'warp_peril',
      targetId: undefined
    };

    manager.enqueueUrgentAction(summonAction, context, 'system');
  }
}

export class CreateWarpRiftAction extends BaseWarpAction {
  private turns?: number;
  private amount?: number;
  private alpha?: number;
  private bonus?: number;

  constructor(spec: ActionSpec) {
    super(spec);
    this.turns = spec.turns;
    this.amount = spec.amount;
    this.alpha = spec.alpha;
    this.bonus = spec.bonus;
  }

  execute(state: GameState, queue: ActionQueue): void {
    const combat = state.combat;
    if (!combat) return;

    combat.warpRiftTurns = Math.max(combat.warpRiftTurns || 0, this.turns || 3);
    combat.warpRiftCorruption = Math.max(1, this.amount || 5);
    combat.warpRiftAlphaMultiplier = Math.max(1, this.alpha || 2);
    combat.warpRiftPerilFloor = Math.max(
      combat.warpRiftPerilFloor || 0,
      typeof this.bonus === 'number' ? this.bonus / 100 : 0.2
    );

    combat.warpPulse = {
      text: `Warp Rift tears open (${combat.warpRiftTurns} turns).`,
      tone: 'warp'
    };
  }
}
