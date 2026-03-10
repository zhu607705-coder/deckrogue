import { GameState, globalEventBus } from '@/core';

export interface MultiplierZone {
  id: string;
  type: 'additive' | 'multiplicative' | 'independent';
  baseValue: number;
  currentValue: number;
  softCap: number;
  diminishingReturn: number;
  priority: number;
}

export interface SynergyTrigger {
  id: string;
  condition: (state: GameState) => boolean;
  effect: (state: GameState) => void;
  cooldown: number;
  lastTriggered: number;
  priority: number;
}

export interface ComboChain {
  id: string;
  name: string;
  triggers: string[];
  effects: Array<(state: GameState) => void>;
  bonusMultiplier: number;
  maxChainLength: number;
}

export class SynergySystem {
  private multiplierZones: Map<string, MultiplierZone> = new Map();
  private synergyTriggers: Map<string, SynergyTrigger> = new Map();
  private comboChains: Map<string, ComboChain> = new Map();
  private comboState: Record<string, number> = {};

  constructor() {
    this.initializeMultiplierZones();
    this.initializeSynergyTriggers();
    this.initializeComboChains();
    this.setupEventListeners();
  }

  private initializeMultiplierZones() {
    // Additive zones (summed before multiplication)
    this.multiplierZones.set('strength', {
      id: 'strength',
      type: 'additive',
      baseValue: 0,
      currentValue: 0,
      softCap: 20,
      diminishingReturn: 0.5,
      priority: 10
    });

    this.multiplierZones.set('weak', {
      id: 'weak',
      type: 'additive',
      baseValue: 0,
      currentValue: 0,
      softCap: 5,
      diminishingReturn: 0.3,
      priority: 10
    });

    // Multiplicative zones (multiplied together)
    this.multiplierZones.set('vulnerable', {
      id: 'vulnerable',
      type: 'multiplicative',
      baseValue: 1,
      currentValue: 1,
      softCap: 3,
      diminishingReturn: 0.4,
      priority: 20
    });

    this.multiplierZones.set('martyrs_vigor', {
      id: 'martyrs_vigor',
      type: 'multiplicative',
      baseValue: 1,
      currentValue: 1,
      softCap: 4,
      diminishingReturn: 0.3,
      priority: 20
    });

    // Independent multiplicative zones (applied separately)
    this.multiplierZones.set('critical_hit', {
      id: 'critical_hit',
      type: 'independent',
      baseValue: 1,
      currentValue: 1,
      softCap: 5,
      diminishingReturn: 0.2,
      priority: 30
    });

    this.multiplierZones.set('warp_power', {
      id: 'warp_power',
      type: 'independent',
      baseValue: 1,
      currentValue: 1,
      softCap: 10,
      diminishingReturn: 0.1,
      priority: 30
    });
  }

  private initializeSynergyTriggers() {
    // Construct synergies
    this.synergyTriggers.set('construct_bonus', {
      id: 'construct_bonus',
      condition: (state) => {
        return state.combat && state.combat.player.constructs.length > 0;
      },
      effect: (state) => {
        if (!state.combat) return;
        const constructCount = state.combat.player.constructs.length;
        const bonus = Math.min(0.5, constructCount * 0.1); // 10% bonus per construct, max 50%
        this.adjustMultiplierZone('strength', bonus);
      },
      cooldown: 1,
      lastTriggered: 0,
      priority: 10
    });

    // Element synergies
    this.synergyTriggers.set('element_combo', {
      id: 'element_combo',
      condition: (state) => {
        return state.combat && state.combat.player.elements.length >= 2;
      },
      effect: (state) => {
        if (!state.combat) return;
        const uniqueElements = new Set(state.combat.player.elements);
        const bonus = Math.min(0.8, uniqueElements.size * 0.2); // 20% bonus per unique element, max 80%
        this.adjustMultiplierZone('vulnerable', 1 + bonus);
      },
      cooldown: 1,
      lastTriggered: 0,
      priority: 15
    });

    // Warp synergies
    this.synergyTriggers.set('warp_surge', {
      id: 'warp_surge',
      condition: (state) => {
        return state.combat && state.combat.warpTide > 50;
      },
      effect: (state) => {
        if (!state.combat) return;
        const warpBonus = Math.min(2, (state.combat.warpTide / 100) * 2); // Up to 2x bonus
        this.adjustMultiplierZone('warp_power', warpBonus);
      },
      cooldown: 1,
      lastTriggered: 0,
      priority: 20
    });

    // Delay synergies
    this.synergyTriggers.set('delay_chain', {
      id: 'delay_chain',
      condition: (state) => {
        return state.combat && state.combat.player.delayedCards.length >= 2;
      },
      effect: (state) => {
        if (!state.combat) return;
        const delayBonus = Math.min(1, state.combat.player.delayedCards.length * 0.25); // 25% bonus per delayed card, max 100%
        this.adjustMultiplierZone('critical_hit', 1 + delayBonus);
      },
      cooldown: 1,
      lastTriggered: 0,
      priority: 15
    });
  }

  private initializeComboChains() {
    // Construct Combo Chain
    this.comboChains.set('construct_army', {
      id: 'construct_army',
      name: 'Construct Army',
      triggers: ['Summon', 'BuffConstructs', 'ConstructOverdrive'],
      effects: [
        (state) => {
          if (!state.combat) return;
          // 10% bonus damage per construct
          const bonus = state.combat.player.constructs.length * 0.1;
          this.adjustMultiplierZone('strength', bonus);
        },
        (state) => {
          if (!state.combat) return;
          // 5% bonus block per construct
          const bonus = state.combat.player.constructs.length * 0.05;
          // Apply block bonus
        },
        (state) => {
          if (!state.combat) return;
          // Construct overdrive bonus
          const bonus = 0.5;
          this.adjustMultiplierZone('critical_hit', 1 + bonus);
        }
      ],
      bonusMultiplier: 1.5,
      maxChainLength: 3
    });

    // Element Combo Chain
    this.comboChains.set('elemental_chaos', {
      id: 'elemental_chaos',
      name: 'Elemental Chaos',
      triggers: ['AddElement', 'AddRandomElement', 'TriggerReactions'],
      effects: [
        (state) => {
          if (!state.combat) return;
          // Elemental damage bonus
          const bonus = state.combat.player.elements.length * 0.1;
          this.adjustMultiplierZone('vulnerable', 1 + bonus);
        },
        (state) => {
          if (!state.combat) return;
          // Elemental combo bonus
          const bonus = 0.3;
          this.adjustMultiplierZone('strength', bonus);
        },
        (state) => {
          if (!state.combat) return;
          // Elemental reaction bonus
          const bonus = 0.8;
          this.adjustMultiplierZone('warp_power', 1 + bonus);
        }
      ],
      bonusMultiplier: 2.0,
      maxChainLength: 3
    });

    // Warp Combo Chain
    this.comboChains.set('warp_rift', {
      id: 'warp_rift',
      name: 'Warp Rift',
      triggers: ['ModifyWarpTide', 'DealWarpDamage', 'CreateWarpRift'],
      effects: [
        (state) => {
          if (!state.combat) return;
          // Warp tide bonus
          const bonus = state.combat.warpTide * 0.01;
          this.adjustMultiplierZone('warp_power', 1 + bonus);
        },
        (state) => {
          if (!state.combat) return;
          // Warp damage bonus
          const bonus = 0.5;
          this.adjustMultiplierZone('critical_hit', 1 + bonus);
        },
        (state) => {
          if (!state.combat) return;
          // Warp rift bonus
          const bonus = 1.0;
          this.adjustMultiplierZone('martyrs_vigor', 1 + bonus);
        }
      ],
      bonusMultiplier: 2.5,
      maxChainLength: 3
    });
  }

  private setupEventListeners() {
    // Listen for combat events
    globalEventBus.subscribe('CombatStart', () => {
      this.resetComboState();
      this.resetMultiplierZones();
    });

    globalEventBus.subscribe('TurnStart', (event) => {
      if ((event as any).playerTurn) {
        this.processSynergyTriggers();
      }
    });

    globalEventBus.subscribe('CardPlayed', (event) => {
      this.processCardPlayed((event as any).cardId, (event as any).cardType);
    });

    globalEventBus.subscribe('CombatEnd', () => {
      this.resetComboState();
      this.resetMultiplierZones();
    });
  }

  private resetComboState() {
    this.comboState = {};
  }

  private resetMultiplierZones() {
    for (const [id, zone] of this.multiplierZones) {
      zone.currentValue = zone.baseValue;
    }
  }

  private processSynergyTriggers() {
    const triggers = Array.from(this.synergyTriggers.values())
      .sort((a, b) => a.priority - b.priority);

    for (const trigger of triggers) {
      if (trigger.condition(this.getCurrentState())) {
        const now = Date.now();
        if (now - trigger.lastTriggered >= trigger.cooldown * 1000) {
          trigger.effect(this.getCurrentState());
          trigger.lastTriggered = now;
        }
      }
    }
  }

  private processCardPlayed(cardId: string, cardType: string) {
    // Process combo chains
    for (const [id, chain] of this.comboChains) {
      if (chain.triggers.includes(cardType)) {
        this.comboState[id] = (this.comboState[id] || 0) + 1;
        const chainLength = Math.min(this.comboState[id], chain.maxChainLength);
        
        if (chainLength > 0) {
          const effectIndex = chainLength - 1;
          if (chain.effects[effectIndex]) {
            chain.effects[effectIndex](this.getCurrentState());
          }
          
          // Apply chain bonus
          if (chainLength === chain.maxChainLength) {
            const bonus = chain.bonusMultiplier - 1;
            this.adjustMultiplierZone('independent', 1 + bonus);
          }
        }
      }
    }
  }

  private adjustMultiplierZone(zoneId: string, value: number) {
    const zone = this.multiplierZones.get(zoneId);
    if (!zone) return;

    switch (zone.type) {
      case 'additive':
        zone.currentValue += value;
        // Apply soft cap and diminishing returns
        if (zone.currentValue > zone.softCap) {
          const excess = zone.currentValue - zone.softCap;
          zone.currentValue = zone.softCap + excess * zone.diminishingReturn;
        }
        break;
      
      case 'multiplicative':
        zone.currentValue *= value;
        // Apply soft cap and diminishing returns
        if (zone.currentValue > zone.softCap) {
          const excess = zone.currentValue - zone.softCap;
          zone.currentValue = zone.softCap + excess * zone.diminishingReturn;
        }
        break;
      
      case 'independent':
        zone.currentValue = Math.max(zone.currentValue, value);
        // Apply soft cap and diminishing returns
        if (zone.currentValue > zone.softCap) {
          const excess = zone.currentValue - zone.softCap;
          zone.currentValue = zone.softCap + excess * zone.diminishingReturn;
        }
        break;
    }
  }

  /**
   * Calculate total damage multiplier from all zones
   */
  public calculateTotalMultiplier(): number {
    let additiveTotal = 0;
    let multiplicativeTotal = 1;
    let independentTotal = 1;

    // Process zones by priority
    const zones = Array.from(this.multiplierZones.values())
      .sort((a, b) => a.priority - b.priority);

    for (const zone of zones) {
      switch (zone.type) {
        case 'additive':
          additiveTotal += zone.currentValue;
          break;
        case 'multiplicative':
          multiplicativeTotal *= zone.currentValue;
          break;
        case 'independent':
          independentTotal *= zone.currentValue;
          break;
      }
    }

    // Calculate final multiplier
    const baseMultiplier = 1 + additiveTotal;
    const finalMultiplier = baseMultiplier * multiplicativeTotal * independentTotal;

    // Apply global soft cap
    const globalSoftCap = 10;
    return Math.min(finalMultiplier, globalSoftCap);
  }

  /**
   * Get current game state (placeholder)
   */
  private getCurrentState(): GameState {
    // This should be replaced with actual state access
    return {} as GameState;
  }

  /**
   * Add a custom multiplier zone
   */
  public addMultiplierZone(zone: MultiplierZone) {
    this.multiplierZones.set(zone.id, zone);
  }

  /**
   * Add a custom synergy trigger
   */
  public addSynergyTrigger(trigger: SynergyTrigger) {
    this.synergyTriggers.set(trigger.id, trigger);
  }

  /**
   * Add a custom combo chain
   */
  public addComboChain(chain: ComboChain) {
    this.comboChains.set(chain.id, chain);
  }

  /**
   * Get current combo state
   */
  public getComboState(): Record<string, number> {
    return { ...this.comboState };
  }

  /**
   * Get current multiplier zones
   */
  public getMultiplierZones(): Map<string, MultiplierZone> {
    return this.multiplierZones;
  }

  /**
   * Get active combo chains
   */
  public getActiveComboChains(): string[] {
    return Object.entries(this.comboState)
      .filter(([_, length]) => length > 0)
      .map(([id, _]) => id);
  }

  /**
   * Calculate damage with all multipliers applied
   */
  public calculateFinalDamage(baseDamage: number): number {
    const multiplier = this.calculateTotalMultiplier();
    return Math.floor(baseDamage * multiplier);
  }

  /**
   * Reset all synergies and multipliers
   */
  public resetAll() {
    this.resetComboState();
    this.resetMultiplierZones();
    for (const trigger of this.synergyTriggers.values()) {
      trigger.lastTriggered = 0;
    }
  }
}

export const synergySystem = new SynergySystem();
