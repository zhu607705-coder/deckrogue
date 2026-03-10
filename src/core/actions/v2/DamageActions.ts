import { GameState, ActionSpec } from '@/core/types';
import { IAction, IActionContext, ActionQueue } from '@/core/actions/actionQueue';
import { TargetingService, CardTarget } from '@/core/combat/targetingService';
import { combatSystem, DamageContext } from '@/core/combat/combatSystem';
import { enemiesData } from '@/content/narrative/numericSystem';
import { stateRandomId, stateRandomInt, stateShuffle } from '@/infrastructure/rng/stateRandom';

export abstract class BaseAction implements IAction {
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
  
  protected resolveTargets(state: GameState, targetType: CardTarget) {
    return TargetingService.resolveTargets(state, this.context, targetType);
  }

  protected getContextFromQueue(queue: ActionQueue): IActionContext {
    return (queue as any)._currentContext || { source: 'player' };
  }
}

export class DealDamageAction extends BaseAction {
  private targetType: CardTarget;
  private amount: number;
  private scaling?: { type: 'DelayedCards' | 'Constructs' | 'Corruption'; multiplier?: number };
  
  constructor(spec: ActionSpec) {
    super(spec);
    this.targetType = (spec.target as CardTarget) || 'Enemy';
    this.amount = spec.amount || 0;
    this.scaling = spec.scaling;
  }
  
  execute(state: GameState, queue: ActionQueue): void {
    const combat = state.combat;
    if (!combat) return;

    this.context = this.getContextFromQueue(queue);
    const targets = this.resolveTargets(state, this.targetType);
    const sourceEntity = TargetingService.getSourceEntity(state, this.context.source);
    const sourceStatuses = sourceEntity?.statuses || {};

    targets.forEach(targetInfo => {
      let baseDamage = this.amount;

      if (this.context.cardId === 'body_slam' && this.context.source === 'player') {
        baseDamage = combat.player.block;
      }

      if (this.scaling) {
        if (this.scaling.type === 'DelayedCards') {
          baseDamage += combat.player.delayedCards.length * (this.scaling.multiplier || 1);
        } else if (this.scaling.type === 'Constructs') {
          baseDamage += combat.player.constructs.length * (this.scaling.multiplier || 1);
        } else if (this.scaling.type === 'Corruption') {
          baseDamage += Math.floor((state.player.corruption || 0) * (this.scaling.multiplier || 1));
        }
      }

      const damageContext: DamageContext = {
        amount: baseDamage,
        sourceType: this.context.source === 'player' ? 'player' : 'enemy',
        sourceId: this.context.source,
        targetType: targetInfo.type,
        targetId: targetInfo.id,
        modifiers: this.buildModifiers(sourceStatuses, targetInfo.entity.statuses),
        isTrueDamage: !!this.context.isTrueDamage,
        ignoreBlock: false
      };

      if (this.context.doubleDamage) {
        damageContext.amount *= 2;
      }

      this.handleTauntAndSoulLink(state, damageContext, targetInfo);

      const actualDamage = combatSystem.applyDamage(state, damageContext);

      if (actualDamage > 0 && targetInfo.type === 'enemy') {
        this.checkEnemyDeath(state, targetInfo.entity, queue);
      }
    });
  }

  private buildModifiers(sourceStatuses: Record<string, number>, targetStatuses: Record<string, number>): any[] {
    const modifiers: any[] = [];

    if (sourceStatuses['Strength']) {
      modifiers.push({ type: 'additive', value: sourceStatuses['Strength'], source: 'strength', priority: 10 });
    }
    if (sourceStatuses['Weak']) {
      modifiers.push({ type: 'multiplicative', value: 0.75, source: 'weak', priority: 20 });
    }
    if (sourceStatuses['Fear']) {
      modifiers.push({ type: 'multiplicative', value: 0.85, source: 'fear', priority: 20 });
    }
    if (targetStatuses['Vulnerable']) {
      modifiers.push({ type: 'multiplicative', value: 1.5, source: 'vulnerable', priority: 30 });
    }
    if (sourceStatuses['MartyrsVigor']) {
      modifiers.push({ type: 'multiplicative', value: 2, source: 'martyrs_vigor', priority: 40 });
    }

    return modifiers;
  }

  private handleTauntAndSoulLink(state: GameState, damageContext: DamageContext, targetInfo: any): void {
    const combat = state.combat;
    if (!combat || targetInfo.type !== 'player') return;

    const tauntIndex = combat.player.constructs.findIndex(c => c.taunt);
    if (tauntIndex !== -1) {
      const construct = combat.player.constructs[tauntIndex];
      const incoming = Math.max(0, Math.floor(damageContext.amount || 0));
      construct.hp -= incoming;
      let overflowToPlayer = 0;
      if (construct.hp <= 0) {
        if (construct.overflowDamageToPlayer) {
          overflowToPlayer = Math.max(0, -construct.hp);
        }
        combat.player.constructs.splice(tauntIndex, 1);
      }
      damageContext.amount = overflowToPlayer;
      return;
    }

    const trenchIndex = combat.player.constructs.findIndex(c => (c.damageSharePct || 0) > 0 && c.hp > 0);
    if (trenchIndex !== -1 && damageContext.amount > 0) {
      const construct = combat.player.constructs[trenchIndex];
      const pct = Math.max(0, Math.min(0.95, Number(construct.damageSharePct || 0)));
      const incoming = Math.max(0, Math.floor(damageContext.amount || 0));
      const redirected = Math.min(incoming, Math.floor(incoming * pct));
      if (redirected > 0) {
        damageContext.amount = Math.max(0, incoming - redirected);
        construct.hp -= redirected;
        if (construct.hp <= 0) {
          const overflow = Math.max(0, -construct.hp);
          construct.hp = 0;
          combat.player.constructs.splice(trenchIndex, 1);
          // Damage conservation: redirected damage that exceeded construct HP returns to the player.
          damageContext.amount += overflow;
        }
      }
    }

    if (combat.player.statuses['SoulLink'] && combat.player.constructs.length > 0) {
      const redirect = Math.floor(damageContext.amount * 0.5);
      damageContext.amount -= redirect;
      const construct = combat.player.constructs[0];
      construct.hp -= redirect;
      if (construct.hp <= 0) {
        combat.player.constructs.shift();
      }
    }
  }

  private checkEnemyDeath(state: GameState, enemy: any, queue: ActionQueue): void {
    const combat = state.combat;
    if (!combat || enemy.hp > 0) return;

    const def = enemiesData.find(e => e.id === enemy.defId);

    if (def?.keywords?.includes('symbiote')) {
      combat.enemies.forEach(other => {
        if (other.id !== enemy.id && other.hp > 0) {
          const otherDef = enemiesData.find(e => e.id === other.defId);
          if (otherDef?.keywords?.includes('symbiote')) {
            other.hp = Math.max(0, other.hp - 10);
          }
        }
      });
    }

    if (def?.keywords?.includes('splits') && combat.enemies.length < 5) {
      const smallDef = enemiesData.find(e => e.id === 'fission_small');
      if (smallDef) {
        for (let i = 0; i < 2; i++) {
          const hp = smallDef.hp_range[0] + stateRandomInt(state, Math.max(1, smallDef.hp_range[1] - smallDef.hp_range[0]));
          combat.enemies.push({
            id: stateRandomId(state, 'enemy'),
            defId: smallDef.id,
            name: smallDef.name,
            hp,
            maxHp: hp,
            block: 0,
            statuses: {},
            nextIntent: 'Attack',
            summoned: true,
            deathProcessed: false,
            devotion: 0,
            corruptionAxis: 0,
            axisDisposition: 'corruption',
            autonomyState: 'Normal',
            autonomyTurns: 0
          } as any);
        }
      }
    }
  }
}

export class ApplyStatusAction extends BaseAction {
  private target: CardTarget;
  private status: string;
  private amount: number;
  
  constructor(spec: ActionSpec) {
    super(spec);
    this.target = (spec.target as CardTarget) || 'Enemy';
    this.status = spec.status || '';
    this.amount = spec.amount || 0;
  }
  
  execute(state: GameState, queue: ActionQueue): void {
    if (!this.status || this.amount === 0) return;

    this.context = this.getContextFromQueue(queue);
    const targets = this.resolveTargets(state, this.target);

    targets.forEach(targetInfo => {
      if (targetInfo.entity.hp <= 0) return;

      combatSystem.applyStatus(
        state,
        targetInfo.type,
        targetInfo.id,
        this.status,
        this.amount
      );
    });
  }
}

export class DrawCardsAction extends BaseAction {
  private amount: number;
  
  constructor(spec: ActionSpec) {
    super(spec);
    this.amount = spec.amount || 1;
  }
  
  execute(state: GameState, queue: ActionQueue): void {
    const combat = state.combat;
    if (!combat) return;

    for (let i = 0; i < this.amount; i++) {
      if (combat.drawPile.length === 0) {
        if (combat.discardPile.length === 0) break;
        combat.drawPile = stateShuffle(state, combat.discardPile);
        combat.discardPile = [];
      }
      const card = combat.drawPile.pop();
      if (card) {
        combat.hand.push(card);
      }
    }
  }
}

export class DiscardCardsAction extends BaseAction {
  private amount: number;
  
  constructor(spec: ActionSpec) {
    super(spec);
    this.amount = spec.amount || 1;
  }
  
  execute(state: GameState, queue: ActionQueue): void {
    const combat = state.combat;
    if (!combat) return;

    for (let i = 0; i < this.amount; i++) {
      if (combat.hand.length > 0) {
        const idx = stateRandomInt(state, combat.hand.length);
        const card = combat.hand.splice(idx, 1)[0];
        combat.discardPile.push(card);
      }
    }
  }
}

export class GainBlockAction extends BaseAction {
  private amount: number;
  
  constructor(spec: ActionSpec) {
    super(spec);
    this.amount = spec.amount || 0;
  }
  
  execute(state: GameState, queue: ActionQueue): void {
    const combat = state.combat;
    if (!combat) return;

    this.context = this.getContextFromQueue(queue);

    if (this.context.source === 'player') {
      combatSystem.gainBlock(state, 'player', 'player', this.amount);
    } else {
      const enemy = combat.enemies.find(e => e.id === this.context.source);
      if (enemy && !enemy.statuses['BlockBlocked']) {
        combatSystem.gainBlock(state, 'enemy', enemy.id, this.amount);
      }
    }
  }
}

export class GainEnergyAction extends BaseAction {
  private amount: number;
  
  constructor(spec: ActionSpec) {
    super(spec);
    this.amount = spec.amount || 0;
  }
  
  execute(state: GameState, queue: ActionQueue): void {
    if (state.combat) {
      state.combat.player.energy += this.amount;
    }
  }
}

export class HealAction extends BaseAction {
  private amount: number;
  private target: CardTarget;
  private scaling?: { type: 'DelayedCards' | 'Constructs' | 'Corruption'; multiplier?: number };
  
  constructor(spec: ActionSpec) {
    super(spec);
    this.amount = spec.amount || 0;
    this.target = (spec.target as CardTarget) || 'Self';
    this.scaling = spec.scaling;
  }
  
  execute(state: GameState, queue: ActionQueue): void {
    const combat = state.combat;
    if (!combat) return;

    this.context = this.getContextFromQueue(queue);
    const targets = this.resolveTargets(state, this.target);
    let healAmount = this.amount;

    if (this.scaling?.type === 'Corruption') {
      healAmount += Math.floor((state.player.corruption || 0) * (this.scaling.multiplier || 1));
    }

    targets.forEach(targetInfo => {
      targetInfo.entity.hp = Math.min(targetInfo.entity.maxHp, targetInfo.entity.hp + healAmount);
      if (targetInfo.type === 'player') {
        state.player.hp = targetInfo.entity.hp;
      }
    });
  }
}

export class ModifyEnergyAction extends BaseAction {
  private amount: number;
  
  constructor(spec: ActionSpec) {
    super(spec);
    this.amount = spec.amount || 0;
  }
  
  execute(state: GameState, queue: ActionQueue): void {
    if (state.combat) {
      state.combat.player.energy = Math.max(0, state.combat.player.energy + this.amount);
    }
  }
}
