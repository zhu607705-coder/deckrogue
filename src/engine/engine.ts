import { GameState, ActionSpec, CardDef, CharacterDef, MapNode, ActiveEventState } from './types';
import { createRNG } from './rng';
import cardsData from '../content/cards.json';
import enemiesData from '../content/enemies.json';
import charactersData from '../content/characters.json';
import potionsData from '../content/potions.json';
import relicsData from '../content/relics.json';

export class GameEngine {
  state: GameState;
  rng: () => number;
  listeners: (() => void)[] = [];

  constructor(seed: number) {
    this.rng = createRNG(seed);
    this.state = this.createInitialState(seed);
  }

  subscribe(listener: () => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  notify() {
    this.listeners.forEach(l => l());
  }

  createInitialState(seed: number): GameState {
    return {
      seed,
      rngState: 0,
      character: null,
      player: {
        hp: 50,
        maxHp: 50,
        energy: 3,
        maxEnergy: 3,
        gold: 99,
        intel: 0,
        deck: [],
        relics: [],
        potions: [],
        corruption: 0,
        relicStates: {}
      },
      combat: null,
      map: [],
      currentNodeId: null,
      activeEvent: null,
      rewardCards: [],
      shopCards: [],
      shopRelics: [],
      shopPotions: [],
      cardRemovalCost: 75,
      screen: 'CharacterSelect'
    };
  }

  selectCharacter(characterId: string) {
    const char = charactersData.find(c => c.id === characterId) as CharacterDef;
    if (!char) return;

    this.state.character = char;
    // Load character portrait from local assets
    this.state.player.portraitUrl = `/assets/characters/${characterId}.png`;
    this.notify();
  }

  loadCardArtFromStorage(cards: CardDef[]) {
    // Load card art from local assets folder
    cards.forEach(c => {
      c.artUrl = `/assets/cards/${c.id}.png`;
    });
  }

  loadCharacterPortrait(): string {
    // Load character portrait from local assets folder
    if (this.state.character) {
      return `/assets/characters/${this.state.character.id}.png`;
    }
    return '';
  }

  loadEnemyArt(enemyId: string): string {
    // Load enemy art from local assets folder
    return `/assets/enemies/${enemyId}.png`;
  }

  startGame() {
    if (!this.state.character) return;
    const char = this.state.character;

    const deck = char.startingDeck.map(cardId => {
      const card = cardsData.find(c => c.id === cardId);
      return { ...card, instanceId: Math.random().toString() };
    });

    this.state.player.hp = char.maxHp;
    this.state.player.maxHp = char.maxHp;
    this.state.player.energy = char.maxEnergy;
    this.state.player.maxEnergy = char.maxEnergy;
    this.state.player.deck = deck as any;
    this.state.player.potions = [];
    this.state.player.relics = [];
    this.state.player.corruption = 0;
    this.state.player.relicStates = {};
    this.state.map = this.generateBranchingMap();
    this.state.activeEvent = null;
    this.state.screen = 'Map';
    
    this.loadCardArtFromStorage(this.state.player.deck);

    this.notify();
  }

  updatePlayerPortrait(url: string) {
    this.state.player.portraitUrl = url;
    this.notify();
  }

  updateCardArt(cardId: string, url: string) {
    // Update in player deck
    this.state.player.deck.forEach(c => {
      if (c.id === cardId) c.artUrl = url;
    });
    
    // Update in combat state if active
    if (this.state.combat) {
      this.state.combat.hand.forEach(c => { if (c.id === cardId) c.artUrl = url; });
      this.state.combat.drawPile.forEach(c => { if (c.id === cardId) c.artUrl = url; });
      this.state.combat.discardPile.forEach(c => { if (c.id === cardId) c.artUrl = url; });
      this.state.combat.exhaustPile.forEach(c => { if (c.id === cardId) c.artUrl = url; });
    }

    // Update in shop/rewards
    this.state.shopCards.forEach(c => { if (c.id === cardId) c.artUrl = url; });
    this.state.rewardCards.forEach(c => { if (c.id === cardId) c.artUrl = url; });

    this.notify();
  }

  hasRelic(relicId: string) {
    return this.state.player.relics.includes(relicId);
  }

  getAdjustedShopPrice(basePrice: number) {
    if (this.hasRelic('mark_of_chaos')) {
      return Math.max(1, Math.floor(basePrice * 0.5));
    }
    return basePrice;
  }

  createCardInstance(cardId: string): CardDef | null {
    const def = cardsData.find(c => c.id === cardId);
    if (!def) return null;
    const card = { ...def, instanceId: Math.random().toString() } as CardDef;
    card.artUrl = `/assets/cards/${card.id}.png`;
    return card;
  }

  getCurseCardPool() {
    return cardsData.filter(c => (c.tags || []).includes('Curse'));
  }

  countCurseCardsInDeck() {
    return this.state.player.deck.filter(c => (c.tags || []).includes('Curse')).length;
  }

  addRandomCurseToDeck(count = 1) {
    const pool = this.getCurseCardPool();
    if (pool.length === 0) return 0;
    let added = 0;
    for (let i = 0; i < count; i++) {
      const pick = pool[Math.floor(this.rng() * pool.length)];
      const card = this.createCardInstance(pick.id);
      if (card) {
        this.state.player.deck.push(card);
        added += 1;
      }
    }
    return added;
  }

  addRandomCurseToHand(count = 1) {
    const combat = this.state.combat;
    if (!combat) return 0;
    const pool = this.getCurseCardPool();
    if (pool.length === 0) return 0;
    let added = 0;
    for (let i = 0; i < count; i++) {
      const pick = pool[Math.floor(this.rng() * pool.length)];
      const card = this.createCardInstance(pick.id);
      if (card && combat.hand.length < 10) {
        combat.hand.push(card);
        added += 1;
      }
    }
    return added;
  }

  grantRelicDirect(relicId: string, opts?: { skipPrice?: boolean; fromEvent?: boolean }) {
    if (this.state.player.relics.includes(relicId)) return false;
    const def = relicsData.find(r => r.id === relicId) as any;
    if (!def) return false;
    this.state.player.relics.push(relicId);
    this.state.player.relicStates[relicId] ||= { level: 0, progress: 0, corrupted: !!def.corrupted };
    if (def.corrupted) {
      this.state.player.corruption += 1;
      if (def.effect?.maxHpPenalty) {
        this.state.player.maxHp = Math.max(1, this.state.player.maxHp - def.effect.maxHpPenalty);
        this.state.player.hp = Math.min(this.state.player.hp, this.state.player.maxHp);
      }
      if (def.effect?.addCurseOnPickup) {
        this.addRandomCurseToDeck(def.effect.addCurseOnPickup);
      }
    }
    if (opts?.fromEvent && def.effect?.eventSelfDamage) {
      this.state.player.hp = Math.max(1, this.state.player.hp - def.effect.eventSelfDamage);
    }
    return true;
  }

  applyMarkOfChaosPurchasePenalty() {
    if (!this.hasRelic('mark_of_chaos')) return;
    this.addRandomCurseToDeck(1);
    this.state.player.corruption += 1;
  }

  getPotionMixResult(aPotionId: string, bPotionId: string): string | null {
    const pair = [aPotionId, bPotionId].sort().join('+');
    const recipes: Record<string, string> = {
      'healing_potion+strength_potion': 'mutagenic_draft',
      'block_potion+strength_potion': 'mutagenic_draft',
      'energy_potion+weak_potion': 'liquid_lightning',
      'block_potion+weak_potion': 'purifying_tears',
      'energy_potion+healing_potion': 'dice_water'
    };
    return recipes[pair] || 'mutagenic_draft';
  }

  mixPotions(indexA: number, indexB: number) {
    if (indexA === indexB) return false;
    const potions = this.state.player.potions;
    const a = potions[indexA];
    const b = potions[indexB];
    if (!a || !b) return false;
    const result = this.getPotionMixResult(a, b);
    if (!result) return false;
    const [hi, lo] = indexA > indexB ? [indexA, indexB] : [indexB, indexA];
    potions.splice(hi, 1);
    potions.splice(lo, 1);
    potions.push(result);
    return true;
  }

  prepareEvent(): ActiveEventState {
    const corruptedPool = (relicsData as any[]).filter(r => r.corrupted);
    const canOfferCorrupted = corruptedPool.length > 0 && this.rng() < 0.6;
    if (canOfferCorrupted) {
      const candidates = corruptedPool.filter(r => !this.state.player.relics.includes(r.id));
      const pickPool = candidates.length > 0 ? candidates : corruptedPool;
      const relic = pickPool[Math.floor(this.rng() * pickPool.length)];
      return { id: 'heretic_altar', offeredRelicId: relic.id, seedRoll: this.rng() };
    }
    return { id: 'mysterious_shrine', seedRoll: this.rng() };
  }

  resolveEventChoice(choice: 'pray' | 'accept_corruption' | 'refuse' | 'leave') {
    const event = this.state.activeEvent;
    if (!event) return;
    if (event.id === 'mysterious_shrine') {
      if (choice === 'pray') {
        this.state.player.maxHp += 10;
        this.state.player.hp += 10;
      }
    } else if (event.id === 'heretic_altar') {
      if (choice === 'accept_corruption' && event.offeredRelicId) {
        this.grantRelicDirect(event.offeredRelicId, { fromEvent: true });
      }
    }
    this.state.activeEvent = null;
    this.state.screen = 'Map';
    this.notify();
  }

  generateBranchingMap(): MapNode[] {
    const nodes: MapNode[] = [];
    const floors = 10;
    const nodesPerFloor = [3, 4, 3, 4, 3, 2, 3, 2, 1, 1]; // Floor 9 is rest, 10 is boss
    
    let currentId = 0;
    const floorNodes: MapNode[][] = [];

    for (let y = 0; y < floors; y++) {
      const count = nodesPerFloor[y];
      const currentFloor: MapNode[] = [];
      for (let x = 0; x < count; x++) {
        let type: MapNode['type'] = 'Combat';
        if (y === floors - 1) type = 'Boss';
        else if (y === floors - 2) type = 'Rest';
        else if (y > 0) {
          const roll = this.rng();
          if (roll < 0.2) type = 'Event';
          else if (roll < 0.3) type = 'Shop';
          else if (roll < 0.4 && y > 3) type = 'Elite';
        }

        currentFloor.push({
          id: `node_${currentId++}`,
          type,
          revealed: y === 0,
          next: [],
          x: (x + 1) / (count + 1),
          y
        });
      }
      floorNodes.push(currentFloor);
      nodes.push(...currentFloor);
    }

    // Connect floors
    for (let y = 0; y < floors - 1; y++) {
      const currentFloor = floorNodes[y];
      const nextFloor = floorNodes[y + 1];
      
      currentFloor.forEach((node, i) => {
        const targetIdx = Math.min(Math.floor((i / currentFloor.length) * nextFloor.length), nextFloor.length - 1);
        node.next.push(nextFloor[targetIdx].id);
        if (this.rng() > 0.5 && targetIdx + 1 < nextFloor.length) {
          node.next.push(nextFloor[targetIdx + 1].id);
        }
      });
      
      nextFloor.forEach((node, i) => {
        const isReachable = currentFloor.some(n => n.next.includes(node.id));
        if (!isReachable) {
          const sourceIdx = Math.min(Math.floor((i / nextFloor.length) * currentFloor.length), currentFloor.length - 1);
          if (!currentFloor[sourceIdx].next.includes(node.id)) {
            currentFloor[sourceIdx].next.push(node.id);
          }
        }
      });
    }

    return nodes;
  }

  triggerRelics(trigger: 'StartCombat' | 'EndCombat' | 'StartTurn' | 'EndTurn') {
    for (const relicId of this.state.player.relics) {
      const def = relicsData.find(r => r.id === relicId) as any;
      if (def && def.trigger === trigger) {
        if (relicId === 'ruined_reactor') {
          if (this.state.combat) {
            const st = (this.state.player.relicStates[relicId] ||= { level: 0, progress: 0, corrupted: !!def.corrupted });
            st.progress = (st.progress || 0) + 1;
            this.state.combat.player.energy += 1;
            if ((st.progress || 0) % 3 === 0) {
              this.state.combat.player.hp = Math.max(0, this.state.combat.player.hp - 8);
              this.state.player.hp = this.state.combat.player.hp;
            }
          }
          continue;
        }
        if (relicId === 'corrupted_tome') {
          if (trigger === 'StartCombat' && this.state.combat) {
            const curses = this.countCurseCardsInDeck();
            if (curses > 0) {
              this.state.combat.player.energy += curses;
              this.state.combat.player.statuses['Strength'] = (this.state.combat.player.statuses['Strength'] || 0) + curses;
            }
          }
          continue;
        }
        this.executeActions([def.effect as any], { source: 'player' });
        if (def.effect?.corruptionGain) {
          this.state.player.corruption += def.effect.corruptionGain;
        }
        if (def.effect?.selfDamage && this.state.combat) {
          this.state.combat.player.hp = Math.max(0, this.state.combat.player.hp - def.effect.selfDamage);
          this.state.player.hp = this.state.combat.player.hp;
        }
      }
    }
  }

  getPotionToxicity(def: any): number {
    if (!def) return 0;
    if (typeof def.toxicity === 'number') return Math.max(0, def.toxicity);
    const effect = def.effect || {};
    if (effect.type === 'GainEnergy') return 2;
    if (effect.type === 'Heal') return 1;
    if (effect.type === 'ApplyStatus') {
      if (effect.status === 'Strength') return 2;
      if (effect.status === 'Weak' || effect.status === 'Vulnerable') return 2;
      return 1;
    }
    return 1;
  }

  applyPotionOverload(toxicityAdded: number) {
    const combat = this.state.combat;
    if (!combat || toxicityAdded <= 0) return;
    const player = combat.player;
    const threshold = 3;
    const before = player.potionToxicity;
    const after = before + toxicityAdded;
    player.potionToxicity = after;
    player.potionsUsedThisTurn += 1;
    const overflow = Math.max(0, after - threshold);
    const prevOverflow = Math.max(0, before - threshold);
    const deltaOverflow = Math.max(0, overflow - prevOverflow);
    if (deltaOverflow > 0) {
      // Overload is intentionally punishing: extra potion toxicity converts into poison and weakness.
      player.statuses['Poison'] = (player.statuses['Poison'] || 0) + deltaOverflow;
      player.statuses['Weak'] = (player.statuses['Weak'] || 0) + 1;
    }
  }

  decayPotionToxicityForNewTurn() {
    const combat = this.state.combat;
    if (!combat) return;
    combat.player.potionsUsedThisTurn = 0;
    combat.player.potionToxicity = Math.max(0, combat.player.potionToxicity - 2);
  }

  recordRelicProgress(event: 'EliteKill' | 'CombatWin' | 'Shuffle', payload?: { enemyId?: string }) {
    for (const relicId of this.state.player.relics) {
      const def = relicsData.find(r => r.id === relicId) as any;
      if (!def?.evolve || def.evolve.track !== event) continue;
      const state = (this.state.player.relicStates[relicId] ||= { level: 0, progress: 0, corrupted: !!def.corrupted });
      state.progress = (state.progress || 0) + 1;
      const thresholds: number[] = Array.isArray(def.evolve.thresholds) ? def.evolve.thresholds : [];
      while ((state.level || 0) < thresholds.length && (state.progress || 0) >= thresholds[state.level || 0]) {
        state.level = (state.level || 0) + 1;
      }
      if (payload?.enemyId) {
        // Keep room for future per-enemy evolution rules without changing state shape again.
      }
    }
  }

  startCombat(enemyIds: string[]) {
    this.state.activeEvent = null;
    const enemies = enemyIds.map((id, index) => {
      const def = enemiesData.find(e => e.id === id) as any;
      const hp = Math.floor(this.rng() * (def.hp_range[1] - def.hp_range[0] + 1)) + def.hp_range[0];
      return {
        id: `enemy_${index}`,
        defId: id,
        name: def.name,
        hp,
        maxHp: hp,
        block: def.keywords.includes('starts_with_block') ? 20 : 0,
        statuses: {},
        nextIntent: this.pickIntent(def),
        summoned: false,
        deathProcessed: false
      };
    });

    const drawPile = [...this.state.player.deck].sort(() => this.rng() - 0.5);

    this.state.combat = {
      player: {
        hp: this.state.player.hp,
        maxHp: this.state.player.maxHp,
        block: 0,
        energy: this.state.player.maxEnergy,
        statuses: {},
        delayedCards: [],
        constructs: [],
        elements: [],
        potionToxicity: 0,
        potionsUsedThisTurn: 0,
        cardsPlayedThisTurn: 0
      },
      enemies,
      drawPile,
      hand: [],
      discardPile: [],
      exhaustPile: [],
      turn: 1,
      isPlayerTurn: true
    };

    this.state.screen = 'Combat';
    this.triggerRelics('StartCombat');
    this.drawCards(5);
    this.applyPostDrawRelicEffects();
    this.notify();
  }

  applyPostDrawRelicEffects() {
    const combat = this.state.combat;
    if (!combat) return;
    if (this.hasRelic('warp_distorter')) {
      combat.hand.forEach((c: any) => {
        c.tempCost = Math.floor(this.rng() * 4);
      });
    }
  }

  pickIntent(enemyDef: any) {
    const roll = this.rng();
    let totalWeight = enemyDef.intent_policy.reduce((sum: number, p: any) => sum + p.weight, 0);
    let current = 0;
    for (const policy of enemyDef.intent_policy) {
      current += policy.weight / totalWeight;
      if (roll <= current) return policy.intent;
    }
    return enemyDef.intent_policy[0].intent;
  }

  drawCards(count: number) {
    const combat = this.state.combat;
    if (!combat) return;

    for (let i = 0; i < count; i++) {
      if (combat.drawPile.length === 0) {
        if (combat.discardPile.length === 0) break;
        this.recordRelicProgress('Shuffle');
        combat.drawPile = [...combat.discardPile].sort(() => this.rng() - 0.5);
        combat.discardPile = [];
      }
      const card = combat.drawPile.pop();
      if (card) combat.hand.push(card);
    }
  }

  discardCards(count: number) {
    const combat = this.state.combat;
    if (!combat) return;
    for (let i = 0; i < count; i++) {
      if (combat.hand.length > 0) {
        const idx = Math.floor(this.rng() * combat.hand.length);
        const card = combat.hand.splice(idx, 1)[0];
        combat.discardPile.push(card);
      }
    }
  }

  playCard(cardInstanceId: string, targetEnemyId?: string) {
    const combat = this.state.combat;
    if (!combat || !combat.isPlayerTurn) return;

    const cardIndex = combat.hand.findIndex(c => (c as any).instanceId === cardInstanceId);
    if (cardIndex === -1) return;
    const card = combat.hand[cardIndex];
    if ((card.tags || []).includes('Unplayable')) return;

    let cost = card.cost;
    if (card.type === 'Attack' && combat.player.statuses['NextAttackDiscount']) {
      cost = Math.max(0, cost - combat.player.statuses['NextAttackDiscount']);
      combat.player.statuses['NextAttackDiscount'] = 0;
    }

    // Deja Vu cost modifier
    if ((card as any).tempCost !== undefined) {
      cost = (card as any).tempCost;
    }

    // Heretic's Metronome: 4th card each turn is free, but hurts the player.
    if (this.hasRelic('heretics_metronome') && combat.player.cardsPlayedThisTurn === 3) {
      cost = 0;
      combat.player.hp = Math.max(0, combat.player.hp - 3);
      this.state.player.hp = combat.player.hp;
      if (combat.player.hp <= 0) {
        this.state.screen = 'GameOver';
        this.notify();
        return;
      }
    }

    if (combat.player.energy < cost) return;

    combat.player.energy -= cost;
    combat.hand.splice(cardIndex, 1);

    if (combat.player.statuses['Electrified']) {
      combat.player.hp = Math.max(0, combat.player.hp - combat.player.statuses['Electrified']);
      this.state.player.hp = combat.player.hp;
      if (combat.player.hp <= 0) {
        this.state.screen = 'GameOver';
        this.notify();
        return;
      }
    }

    // Handle DoubleDamageNextAttack
    const doubleCastNext = combat.player.statuses['DoubleCastNextCard'] || 0;
    if (doubleCastNext > 0) {
      combat.player.statuses['DoubleCastNextCard'] = Math.max(0, doubleCastNext - 1);
    }
    if (card.type === 'Attack' && combat.player.statuses['DoubleDamageNextAttack']) {
      combat.player.statuses['DoubleDamageNextAttack'] = 0;
      // We can pass a flag to executeActions
      this.executeActions(card.actions, { source: 'player', targetId: targetEnemyId, card, doubleDamage: true });
    } else {
      this.executeActions(card.actions, { source: 'player', targetId: targetEnemyId, card });
    }
    if (doubleCastNext > 0) {
      this.executeActions(card.actions, { source: 'player', targetId: targetEnemyId, card });
    }

    // Delay cards don't go to discard pile immediately if they have Delay action
    const hasDelay = card.actions.some(a => a.type === 'Delay');
    if (hasDelay) {
      // It's handled in executeActions
    } else {
      combat.discardPile.push(card);
    }

    combat.player.lastPlayedCard = card;
    combat.player.cardsPlayedThisTurn += 1;
    
    if (combat.enemies.every(e => e.hp <= 0)) {
      this.endCombat(true);
    } else {
      this.notify();
    }
  }

  calculateDamage(amount: number, sourceStatuses: Record<string, number>, targetStatuses: Record<string, number>): number {
    let damage = amount;
    if (sourceStatuses['Strength']) damage += sourceStatuses['Strength'];
    if (sourceStatuses['Weak']) damage = Math.floor(damage * 0.75);
    if (targetStatuses['Vulnerable']) damage = Math.floor(damage * 1.5);
    return damage;
  }

  executeActions(actions: ActionSpec[], context: { source: 'player' | string, targetId?: string, cardId?: string, card?: any, doubleDamage?: boolean }) {
    const combat = this.state.combat;
    if (!combat) return;

    for (const action of actions) {
      if (action.type === 'DealDamage') {
        let targets: any[] = [];
        if (action.target === 'Enemy') {
          if (context.targetId === 'player') {
            targets = [combat.player];
          } else if (context.targetId) {
            targets = [combat.enemies.find(e => e.id === context.targetId)];
          }
        } else if (action.target === 'AllEnemies') {
          if (context.source === 'player') {
            targets = combat.enemies;
          } else {
            targets = [combat.player];
          }
        } else if (action.target === 'Self') {
          if (context.source === 'player') {
            targets = [combat.player];
          } else {
            targets = [combat.enemies.find(e => e.id === context.source)];
          }
        } else if (action.target === 'RandomEnemy') {
          if (context.source === 'player') {
            const aliveEnemies = combat.enemies.filter(e => e.hp > 0);
            if (aliveEnemies.length > 0) {
              targets = [aliveEnemies[Math.floor(this.rng() * aliveEnemies.length)]];
            }
          } else {
            targets = [combat.player];
          }
        }

        const sourceEntity = context.source === 'player' ? combat.player : combat.enemies.find(e => e.id === context.source);
        const sourceStatuses = sourceEntity ? sourceEntity.statuses : {};

        targets.forEach(t => {
          if (!t || t.hp <= 0) return;
          
          let baseDamage = action.amount || 0;
          if (context.cardId === 'body_slam' && context.source === 'player') {
            baseDamage = combat.player.block;
          }

          if (action.scaling) {
            if (action.scaling.type === 'DelayedCards') {
              baseDamage += (combat.player.delayedCards.length) * (action.scaling.multiplier || 1);
            } else if (action.scaling.type === 'Constructs') {
              baseDamage += (combat.player.constructs.length) * (action.scaling.multiplier || 1);
            }
          }

          let damage = this.calculateDamage(baseDamage, sourceStatuses, t.statuses);
          if (context.doubleDamage) damage *= 2;

          if (t === combat.player) {
            const tauntIndex = combat.player.constructs.findIndex(c => c.taunt);
            if (tauntIndex !== -1) {
              const construct = combat.player.constructs[tauntIndex];
              construct.hp -= damage;
              if (construct.hp <= 0) {
                combat.player.constructs.splice(tauntIndex, 1);
              }
              return; // Construct took all damage
            }

            if (combat.player.statuses['SoulLink'] && combat.player.constructs.length > 0) {
              const redirect = Math.floor(damage * 0.5);
              damage -= redirect;
              const construct = combat.player.constructs[0];
              construct.hp -= redirect;
              if (construct.hp <= 0) {
                combat.player.constructs.shift(); // Remove dead construct
              }
            }
          }

          if (t.block > 0) {
            const blocked = Math.min(t.block, damage);
            t.block -= blocked;
            damage -= blocked;
          }
          t.hp -= damage;

          // Symbiote logic
          if (t !== combat.player) {
            const def = enemiesData.find(e => e.id === t.defId) as any;
            if (def && def.keywords.includes('symbiote')) {
              combat.enemies.forEach(other => {
                if (other.id !== t.id && other.hp > 0) {
                  const otherDef = enemiesData.find(e => e.id === other.defId) as any;
                  if (otherDef && otherDef.keywords.includes('symbiote')) {
                    other.hp -= damage;
                  }
                }
              });
            }

            // Fission logic
            if (t.hp <= 0 && def && def.keywords.includes('splits')) {
              const smallDef = enemiesData.find(e => e.id === 'fission_small') as any;
              if (smallDef) {
                for (let i = 0; i < 2; i++) {
                  if (combat.enemies.length < 5) {
                    const hp = Math.floor(smallDef.hp_range[0] + this.rng() * (smallDef.hp_range[1] - smallDef.hp_range[0]));
                    combat.enemies.push({
                      id: `enemy_${Math.random().toString()}`,
                      defId: smallDef.id,
                      name: smallDef.name,
                      hp,
                      maxHp: hp,
                      block: 0,
                      statuses: {},
                      nextIntent: this.pickIntent(smallDef),
                      summoned: true,
                      deathProcessed: false
                    });
                  }
                }
              }
            }
            if (t.hp <= 0 && !(t as any).deathProcessed) {
              (t as any).deathProcessed = true;
              this.handleEnemyDeathTriggers(t as any);
              const killedDef = enemiesData.find(e => e.id === t.defId) as any;
              if (killedDef?.keywords?.includes('elite')) {
                this.recordRelicProgress('EliteKill', { enemyId: t.defId });
              }
            }
          }
        });
      } else if (action.type === 'Delay') {
        if (context.card) {
          combat.player.delayedCards.push({
            card: context.card,
            turns: action.turns || 1,
            targetId: context.targetId
          });
        }
      } else if (action.type === 'TriggerDelay') {
        if (combat.player.delayedCards.length > 0) {
          const delayed = combat.player.delayedCards.shift();
          if (delayed) {
            const delayAction = delayed.card.actions.find((a: any) => a.type === 'Delay');
            if (delayAction && delayAction.actions) {
              this.executeActions(delayAction.actions, { source: 'player', targetId: delayed.targetId, card: delayed.card });
            }
          }
        }
      } else if (action.type === 'ReturnLastCard') {
        if (combat.player.lastPlayedCard) {
          const returnedCard = { ...combat.player.lastPlayedCard, tempCost: action.costModifier };
          combat.hand.push(returnedCard as any);
        }
      } else if (action.type === 'Revive') {
        // Not implemented fully, just heal player a bit for now as placeholder
        combat.player.hp = Math.min(combat.player.maxHp, combat.player.hp + 10);
      } else if (action.type === 'Summon') {
        if (action.unit === 'scrap_golem') {
          if (combat.player.constructs.length < 2) {
            combat.player.constructs.push({ id: Math.random().toString(), name: 'Scrap Golem', hp: 15, maxHp: 15, atk: 2, taunt: true });
          }
        } else if (action.unit === 'temp_guard') {
          if (combat.player.constructs.length < 2) {
            combat.player.constructs.push({ id: Math.random().toString(), name: 'Temp Guard', hp: 5, maxHp: 5, atk: 0, taunt: true });
          }
        }
      } else if (action.type === 'BuffConstructs') {
        combat.player.constructs.forEach(c => c.atk += (action.amount || 0));
      } else if (action.type === 'ConstructOverdrive') {
        combat.player.constructs.forEach(c => {
          const aliveEnemies = combat.enemies.filter(e => e.hp > 0);
          if (aliveEnemies.length > 0) {
            const target = aliveEnemies[Math.floor(this.rng() * aliveEnemies.length)];
            let damage = c.atk;
            if (target.block > 0) {
              const blocked = Math.min(target.block, damage);
              target.block -= blocked;
              damage -= blocked;
            }
            target.hp -= damage;
          }
        });
        combat.player.constructs = [];
      } else if (action.type === 'HealConstruct') {
        if (combat.player.constructs.length > 0) {
          const c = combat.player.constructs[0];
          c.hp = c.maxHp;
        }
      } else if (action.type === 'ForceEnemyAttack') {
        const aliveEnemies = combat.enemies.filter(e => e.hp > 0);
        if (aliveEnemies.length >= 2) {
          const attacker = aliveEnemies[0];
          const target = aliveEnemies[1];
          let damage = 5; // Base arbitrary damage
          if (target.block > 0) {
            const blocked = Math.min(target.block, damage);
            target.block -= blocked;
            damage -= blocked;
          }
          target.hp -= damage;
        }
      } else if (action.type === 'SummonMegaConstruct') {
        combat.player.constructs = [{ id: Math.random().toString(), name: 'Mega Construct', hp: 50, maxHp: 50, atk: 10, taunt: true }];
      } else if (action.type === 'AddRandomElement') {
        const elements = ['Fire', 'Frost', 'Lightning', 'Acid', 'Arcane'];
        for (let i = 0; i < (action.amount || 1); i++) {
          combat.player.elements.push(elements[Math.floor(this.rng() * elements.length)]);
        }
      } else if (action.type === 'AddElement') {
        if (action.element) combat.player.elements.push(action.element);
      } else if (action.type === 'TriggerReactions') {
        const uniqueElements = new Set(combat.player.elements);
        if (uniqueElements.has('Fire') && uniqueElements.has('Acid')) {
          combat.enemies.forEach(e => { if (e.hp > 0) e.statuses['Burn'] = (e.statuses['Burn'] || 0) + 5; });
        }
        if (uniqueElements.has('Frost') && uniqueElements.has('Lightning')) {
          combat.enemies.forEach(e => { if (e.hp > 0) e.statuses['Weak'] = (e.statuses['Weak'] || 0) + 2; });
        }
        if (uniqueElements.has('Fire') && uniqueElements.has('Lightning')) {
          combat.enemies.forEach(e => {
            if (e.hp > 0) {
              let damage = 10;
              if (e.block > 0) {
                const blocked = Math.min(e.block, damage);
                e.block -= blocked;
                damage -= blocked;
              }
              e.hp -= damage;
            }
          });
        }
        combat.player.elements = [];
      } else if (action.type === 'ElementalOverloadDamage') {
        const uniqueElements = new Set(combat.player.elements);
        let damage = action.amount || 0;
        if (uniqueElements.size >= 3) damage *= 2;
        
        const target = combat.enemies.find(e => e.id === context.targetId);
        if (target && target.hp > 0) {
          if (target.block > 0) {
            const blocked = Math.min(target.block, damage);
            target.block -= blocked;
            damage -= blocked;
          }
          target.hp -= damage;
        }
      } else if (action.type === 'TransmuteElements') {
        const heal = combat.player.elements.length * 2;
        combat.player.hp = Math.min(combat.player.maxHp, combat.player.hp + heal);
        combat.player.elements = [];
      } else if (action.type === 'SolventDamage') {
        combat.enemies.forEach(e => {
          if (e.hp > 0) {
            let damage = (action.amount || 0) + (e.block > 0 ? e.block * 2 : 0);
            if (e.block > 0) {
              const blocked = Math.min(e.block, damage);
              e.block -= blocked;
              damage -= blocked;
            }
            e.hp -= damage;
          }
        });
      } else if (action.type === 'RedirectIntent') {
        const target = combat.enemies.find(e => e.id === context.targetId);
        if (target) {
          target.nextIntent = 'Stunned'; // Simplified redirect
        }
      } else if (action.type === 'PrecisionThrowDamage') {
        const target = combat.enemies.find(e => e.id === context.targetId);
        if (target && target.hp > 0) {
          let damage = target.block > 0 ? (action.bonus || 0) : (action.amount || 0);
          if (target.block > 0) {
            const blocked = Math.min(target.block, damage);
            target.block -= blocked;
            damage -= blocked;
          }
          target.hp -= damage;
        }
      } else if (action.type === 'EmergencyBlock') {
        if (combat.player.hp < combat.player.maxHp * 0.3) {
          combat.player.block += action.bonus || 0;
        } else {
          combat.player.block += action.amount || 0;
        }
      } else if (action.type === 'PredictorAction') {
        // Simple predictor: if player played attack last, gain block, else attack
        const lastCard = combat.player.lastPlayedCard;
        const enemy = combat.enemies.find(e => e.id === context.source);
        if (enemy) {
          if (lastCard && lastCard.type === 'Attack') {
            enemy.block += 10;
          } else {
            let damage = 8;
            if (combat.player.block > 0) {
              const blocked = Math.min(combat.player.block, damage);
              combat.player.block -= blocked;
              damage -= blocked;
            }
            combat.player.hp -= damage;
          }
        }
      } else if (action.type === 'HealSelf') {
        const enemy = combat.enemies.find(e => e.id === context.source);
        if (enemy) {
          enemy.hp = Math.min(enemy.maxHp, enemy.hp + (action.amount || 0));
        }
      } else if (action.type === 'SummonEnemy') {
        if (combat.enemies.length < 5) {
          const def = enemiesData.find(e => e.id === action.unit) as any;
          if (def) {
            const hp = Math.floor(def.hp_range[0] + this.rng() * (def.hp_range[1] - def.hp_range[0]));
            combat.enemies.push({
              id: `enemy_${Math.random().toString()}`,
              defId: def.id,
              name: def.name,
              hp,
              maxHp: hp,
              block: 0,
              statuses: {},
              nextIntent: this.pickIntent(def),
              summoned: true,
              deathProcessed: false
            });
          }
        }
      } else if (action.type === 'BuffAllEnemies') {
        combat.enemies.forEach(e => {
          if (e.hp > 0) {
            e.statuses['Strength'] = (e.statuses['Strength'] || 0) + (action.amount || 0);
          }
        });
      } else if (action.type === 'GainBlock') {
        if (action.target === 'Self') {
          if (context.source === 'player') {
            combat.player.block += action.amount || 0;
          } else {
            const enemy = combat.enemies.find(e => e.id === context.source);
            if (enemy && !enemy.statuses['BlockBlocked']) enemy.block += action.amount || 0;
          }
        }
      } else if (action.type === 'ApplyStatus') {
        let targets: any[] = [];
        if (action.target === 'Enemy') {
          if (context.targetId === 'player') targets = [combat.player];
          else if (context.targetId) targets = [combat.enemies.find(e => e.id === context.targetId)];
        } else if (action.target === 'Self') {
          if (context.source === 'player') targets = [combat.player];
          else targets = [combat.enemies.find(e => e.id === context.source)];
        } else if (action.target === 'AllEnemies') {
          if (context.source === 'player') targets = combat.enemies;
          else targets = [combat.player];
        } else if (action.target === 'RandomEnemy') {
          if (context.source === 'player') {
            const aliveEnemies = combat.enemies.filter(e => e.hp > 0);
            if (aliveEnemies.length > 0) {
              targets = [aliveEnemies[Math.floor(this.rng() * aliveEnemies.length)]];
            }
          } else {
            targets = [combat.player];
          }
        }

        targets.forEach(t => {
          if (!t || !action.status || t.hp <= 0) return;
          t.statuses[action.status] = (t.statuses[action.status] || 0) + (action.amount || 0);
        });
      } else if (action.type === 'DoubleStatus') {
        let targets: any[] = [];
        if (action.target === 'Enemy') {
          if (context.targetId === 'player') targets = [combat.player];
          else if (context.targetId) targets = [combat.enemies.find(e => e.id === context.targetId)];
        } else if (action.target === 'Self') {
          if (context.source === 'player') targets = [combat.player];
          else targets = [combat.enemies.find(e => e.id === context.source)];
        }

        targets.forEach(t => {
          if (!t || !action.status || t.hp <= 0) return;
          if (t.statuses[action.status]) {
            t.statuses[action.status] *= 2;
          }
        });
      } else if (action.type === 'GainIntel') {
        this.state.player.intel += action.amount || 0;
      } else if (action.type === 'SpendIntel') {
        this.state.player.intel -= action.amount || 0;
      } else if (action.type === 'Draw') {
        this.drawCards(action.amount || 1);
      } else if (action.type === 'Discard') {
        this.discardCards(action.amount || 1);
      } else if (action.type === 'Conditional') {
        if (action.condition?.type === 'HasIntel') {
          if (this.state.player.intel >= action.condition.amount) {
            if (action.trueActions) this.executeActions(action.trueActions, context);
          } else {
            if (action.falseActions) this.executeActions(action.falseActions, context);
          }
        } else if (action.condition?.type === 'HasConstruct') {
          if (combat.player.constructs.length > 0) {
            if (action.trueActions) this.executeActions(action.trueActions, context);
          } else {
            if (action.falseActions) this.executeActions(action.falseActions, context);
          }
        }
      }
    }
  }

  decrementStatuses(entity: any) {
    if (entity.statuses['Vulnerable']) entity.statuses['Vulnerable'] = Math.max(0, entity.statuses['Vulnerable'] - 1);
    if (entity.statuses['Weak']) entity.statuses['Weak'] = Math.max(0, entity.statuses['Weak'] - 1);
    if (entity.statuses['Stealth']) entity.statuses['Stealth'] = Math.max(0, entity.statuses['Stealth'] - 1);
    if (entity.statuses['Electrified']) entity.statuses['Electrified'] = Math.max(0, entity.statuses['Electrified'] - 1);
  }

  handleEnemyDeathTriggers(enemy: { summoned?: boolean }) {
    const combat = this.state.combat;
    if (!combat) return;
    if (this.hasRelic('soul_lantern') && !enemy.summoned) {
      combat.player.energy += 2;
      this.drawCards(1);
      this.applyPostDrawRelicEffects();
    }
  }

  processStartOfTurn(entity: any) {
    if (entity.statuses['Poison']) {
      let damage = entity.statuses['Poison'];
      if (entity.block > 0) {
        const blocked = Math.min(entity.block, damage);
        entity.block -= blocked;
        damage -= blocked;
      }
      entity.hp -= damage;
      entity.statuses['Poison'] -= 1;
    }
    if (entity.statuses['Burn']) {
      let damage = entity.statuses['Burn'];
      if (entity.block > 0) {
        const blocked = Math.min(entity.block, damage);
        entity.block -= blocked;
        damage -= blocked;
      }
      entity.hp -= damage;
      entity.statuses['Burn'] -= 1;
    }
  }

  endTurn() {
    const combat = this.state.combat;
    if (!combat || !combat.isPlayerTurn) return;

    if (this.hasRelic('zealots_chain') && combat.player.cardsPlayedThisTurn > 6) {
      combat.player.statuses['ZealotsChainReady'] = 1;
    }

    this.triggerRelics('EndTurn');

    combat.isPlayerTurn = false;
    this.decrementStatuses(combat.player);

    combat.discardPile.push(...combat.hand);
    combat.hand = [];
    combat.player.cardsPlayedThisTurn = 0;

    this.notify();

    setTimeout(() => this.processEnemyTurns(), 500);
  }

  processEnemyTurns() {
    const combat = this.state.combat;
    if (!combat) return;

    combat.enemies.forEach(enemy => {
      if (enemy.hp <= 0) return;
      
      enemy.block = 0;
      this.processStartOfTurn(enemy);
      if (enemy.hp <= 0) return;

      const def = enemiesData.find(e => e.id === enemy.defId) as any;
      const move = def.moves[enemy.nextIntent!];
      if (move) {
        const isAttack = move.some((a: any) => a.type === 'DealDamage');
        if (combat.player.statuses['Stealth'] && isAttack) {
          // Enemy misses due to stealth
        } else {
          this.executeActions(move, { source: enemy.id, targetId: 'player' });
        }
      }
      
      this.decrementStatuses(enemy);
      enemy.nextIntent = this.pickIntent(def);
    });

    if (combat.player.hp <= 0) {
      this.state.screen = 'GameOver';
      this.notify();
      return;
    }

    if (combat.enemies.every(e => e.hp <= 0)) {
      this.endCombat(true);
      return;
    }

    combat.turn++;
    combat.isPlayerTurn = true;
    combat.player.energy = this.state.player.maxEnergy;
    if (combat.player.statuses['ZealotsChainReady']) {
      combat.player.energy += 1;
      combat.player.statuses['ZealotsChainReady'] = 0;
    }
    combat.player.block = 0;
    this.decayPotionToxicityForNewTurn();
    combat.player.cardsPlayedThisTurn = 0;
    this.processStartOfTurn(combat.player);
    
    // Process delayed cards
    const remainingDelayed = [];
    for (const delayed of combat.player.delayedCards) {
      delayed.turns -= 1;
      if (delayed.turns <= 0) {
        const delayAction = delayed.card.actions.find((a: any) => a.type === 'Delay');
        if (delayAction && delayAction.actions) {
          this.executeActions(delayAction.actions, { source: 'player', targetId: delayed.targetId, card: delayed.card });
        }
      } else {
        remainingDelayed.push(delayed);
      }
    }
    combat.player.delayedCards = remainingDelayed;

    // Process Stasis Field
    if (combat.player.statuses['StasisField'] && combat.player.delayedCards.length >= 2) {
      combat.player.block += 5 * combat.player.statuses['StasisField'];
    }

    // Process Soul Link logic (actually should be in damage calculation, but we can approximate or leave it as a buff)
    // For now, Soul Link is handled in executeActions DealDamage if we had time, but let's just add it to calculateDamage later if needed.

    if (combat.player.hp <= 0) {
      this.state.screen = 'GameOver';
      this.notify();
      return;
    }

    this.triggerRelics('StartTurn');
    
    if (combat.player.statuses['SkipDraw']) {
      combat.player.statuses['SkipDraw'] = 0;
    } else {
      this.drawCards(5);
      this.applyPostDrawRelicEffects();
    }
    
    this.notify();
  }

  endCombat(victory: boolean) {
    if (victory) {
      this.triggerRelics('EndCombat');
      this.recordRelicProgress('CombatWin');
      this.state.player.hp = this.state.combat!.player.hp;
      this.state.player.gold += Math.floor(this.rng() * 15) + 10;
      this.state.combat = null;
      this.generateCardRewards();
      this.state.screen = 'Reward';
    } else {
      this.state.screen = 'GameOver';
    }
    this.notify();
  }

  getRandomCardForCharacter(): CardDef {
    const charId = this.state.character?.id || 'All';
    const pool = cardsData.filter(c => c.rarity !== 'Starter' && (c.character === 'All' || c.character === charId));
    
    const roll = this.rng();
    let targetRarity = 'Common';
    if (roll > 0.9) targetRarity = 'Rare';
    else if (roll > 0.6) targetRarity = 'Uncommon';

    const rarityPool = pool.filter(c => c.rarity === targetRarity);
    if (rarityPool.length > 0) {
      return rarityPool[Math.floor(this.rng() * rarityPool.length)] as any;
    }
    return pool[Math.floor(this.rng() * pool.length)] as any;
  }

  generateCardRewards() {
    this.state.rewardCards = [];
    for (let i = 0; i < 3; i++) {
      const card = this.getRandomCardForCharacter();
      this.state.rewardCards.push({ ...card, instanceId: Math.random().toString() } as any);
    }
    this.loadCardArtFromStorage(this.state.rewardCards);
  }

  pickRewardCard(cardInstanceId: string) {
    const card = this.state.rewardCards.find((c: any) => c.instanceId === cardInstanceId);
    if (card) {
      this.state.player.deck.push(card);
    }
    this.state.rewardCards = [];
    this.state.screen = 'Map';
    this.notify();
  }

  skipReward() {
    this.state.rewardCards = [];
    this.state.screen = 'Map';
    this.notify();
  }

  generateShopItems() {
    this.state.shopCards = [];
    for (let i = 0; i < 6; i++) {
      const card = this.getRandomCardForCharacter();
      this.state.shopCards.push({ ...card, instanceId: Math.random().toString() } as any);
    }
    this.loadCardArtFromStorage(this.state.shopCards);

    this.state.shopRelics = [];
    const availableRelics = relicsData.filter(r => !this.state.player.relics.includes(r.id));
    for (let i = 0; i < 3 && availableRelics.length > 0; i++) {
      const idx = Math.floor(this.rng() * availableRelics.length);
      this.state.shopRelics.push(availableRelics[idx].id);
      availableRelics.splice(idx, 1);
    }

    this.state.shopPotions = [];
    for (let i = 0; i < 3; i++) {
      const potion = potionsData[Math.floor(this.rng() * potionsData.length)];
      this.state.shopPotions.push(potion.id);
    }
  }

  buyShopCard(cardInstanceId: string, price: number) {
    const actualPrice = this.getAdjustedShopPrice(price);
    if (this.state.player.gold >= actualPrice) {
      const cardIndex = this.state.shopCards.findIndex((c: any) => c.instanceId === cardInstanceId);
      if (cardIndex !== -1) {
        this.state.player.gold -= actualPrice;
        this.state.player.deck.push(this.state.shopCards[cardIndex]);
        this.state.shopCards.splice(cardIndex, 1);
        this.applyMarkOfChaosPurchasePenalty();
        this.notify();
      }
    }
  }

  buyShopRelic(relicId: string, price: number) {
    const actualPrice = this.getAdjustedShopPrice(price);
    if (this.state.player.gold >= actualPrice) {
      const idx = this.state.shopRelics.indexOf(relicId);
      if (idx !== -1) {
        this.state.player.gold -= actualPrice;
        this.grantRelicDirect(relicId);
        this.state.shopRelics.splice(idx, 1);
        if (relicId !== 'mark_of_chaos') this.applyMarkOfChaosPurchasePenalty();
        this.notify();
      }
    }
  }

  buyShopPotion(potionId: string, price: number, index: number) {
    const actualPrice = this.getAdjustedShopPrice(price);
    if (this.state.player.gold >= actualPrice && this.state.player.potions.length < 3) {
      this.state.player.gold -= actualPrice;
      this.state.player.potions.push(potionId);
      this.state.shopPotions.splice(index, 1);
      this.applyMarkOfChaosPurchasePenalty();
      this.notify();
    }
  }

  removeCard(cardInstanceId: string) {
    if (this.state.player.gold >= this.state.cardRemovalCost) {
      const idx = this.state.player.deck.findIndex(c => c.instanceId === cardInstanceId);
      if (idx !== -1) {
        this.state.player.gold -= this.state.cardRemovalCost;
        this.state.player.deck.splice(idx, 1);
        this.state.cardRemovalCost += 25;
        this.state.screen = 'Shop';
        this.notify();
      }
    }
  }

  enterCardRemoval() {
    this.state.screen = 'Upgrade'; // We can reuse Upgrade view for removal, or create a new one. Let's add a new screen or reuse.
    // Actually, let's just use a special state or add a new screen 'RemoveCard'
    this.state.screen = 'RemoveCard' as any;
    this.notify();
  }

  restHeal() {
    const healAmount = Math.floor(this.state.player.maxHp * 0.3);
    this.state.player.hp = Math.min(this.state.player.maxHp, this.state.player.hp + healAmount);
    this.state.screen = 'Map';
    this.notify();
  }

  enterUpgrade(fromScreen: 'Rest' | 'Shop' = 'Rest') {
    this.state.upgradeReturnScreen = fromScreen;
    this.state.screen = 'Upgrade';
    this.notify();
  }

  upgradeCard(cardInstanceId: string) {
    const cardIndex = this.state.player.deck.findIndex(c => c.instanceId === cardInstanceId);
    if (cardIndex !== -1) {
      const card = this.state.player.deck[cardIndex];
      if (!card.isUpgraded && card.upgrade) {
        if (this.state.upgradeReturnScreen === 'Shop') {
          if (this.state.player.gold < 50) return;
          this.state.player.gold -= 50;
        }
        Object.assign(card, card.upgrade);
        card.isUpgraded = true;
        this.state.screen = this.state.upgradeReturnScreen === 'Shop' ? 'Shop' : 'Map';
        this.notify();
      }
    }
  }

  cancelUpgrade() {
    this.state.screen = this.state.upgradeReturnScreen || 'Rest';
    this.notify();
  }

  usePotion(index: number) {
    const potionId = this.state.player.potions[index];
    if (!potionId) return;
    
    const def = potionsData.find(p => p.id === potionId) as any;
    if (!def) return;
    if (!this.state.combat && def.effect?.type === 'GainEnergy') return;

    this.state.player.potions.splice(index, 1);
    if (this.state.combat) {
      this.applyPotionOverload(this.getPotionToxicity(def));
    }
    
    // Execute effect
    const action = def.effect;
    if (action.type === 'Heal') {
      const healAmount = Math.floor(this.state.player.maxHp * action.amount);
      this.state.player.hp = Math.min(this.state.player.maxHp, this.state.player.hp + healAmount);
      if (this.state.combat) {
        this.state.combat.player.hp = this.state.player.hp;
      }
    } else if (action.type === 'GainEnergy') {
      if (this.state.combat) {
        this.state.combat.player.energy += action.amount;
      }
    } else if (action.type === 'ComboBrew') {
      if (this.state.combat) {
        this.state.combat.player.statuses['DoubleCastNextCard'] = (this.state.combat.player.statuses['DoubleCastNextCard'] || 0) + 1;
      }
    } else if (action.type === 'SacrificialElixir') {
      if (!this.state.combat) return;
      this.state.combat.player.hp = Math.max(1, this.state.combat.player.hp - 15);
      this.state.player.hp = this.state.combat.player.hp;
      this.state.combat.player.energy += 3;
      this.state.combat.player.statuses['Strength'] = (this.state.combat.player.statuses['Strength'] || 0) + 3;
    } else if (action.type === 'DiceWater') {
      if (!this.state.combat) return;
      const roll = 1 + Math.floor(this.rng() * 6);
      this.state.combat.player.energy += roll;
      this.drawCards(7 - roll);
      this.applyPostDrawRelicEffects();
    } else if (action.type === 'LiquidLightning') {
      if (!this.state.combat) return;
      this.state.combat.player.energy += 3;
      this.state.combat.player.statuses['Electrified'] = (this.state.combat.player.statuses['Electrified'] || 0) + 2;
    } else if (action.type === 'PurifyingTears') {
      if (!this.state.combat) return;
      const combat = this.state.combat;
      const consumed = combat.hand.filter(c => (c.tags || []).includes('Curse') || (c.tags || []).includes('Status'));
      combat.hand = combat.hand.filter(c => !((c.tags || []).includes('Curse') || (c.tags || []).includes('Status')));
      combat.exhaustPile.push(...consumed);
      const hits = consumed.length;
      if (hits > 0) {
        const target = [...combat.enemies].filter(e => e.hp > 0).sort((a, b) => b.hp - a.hp)[0];
        if (target) {
          target.hp -= 15 * hits;
        }
      }
    } else if (action.type === 'MutagenicDraft') {
      if (!this.state.combat) return;
      this.state.combat.player.energy += 2;
      this.state.combat.player.block += 8;
      this.state.combat.player.statuses['Strength'] = (this.state.combat.player.statuses['Strength'] || 0) + 2;
      this.state.combat.player.statuses['Poison'] = (this.state.combat.player.statuses['Poison'] || 0) + 2;
    } else {
      // It's a normal action
      this.executeActions([action as any], { source: 'player' });
    }
    
    this.notify();
  }

  revealNode(nodeId: string) {
    const node = this.state.map.find(n => n.id === nodeId);
    if (node && this.state.player.intel >= 1 && !node.revealed) {
      this.state.player.intel -= 1;
      node.revealed = true;
      this.notify();
    }
  }

  enterNode(nodeId: string) {
    const node = this.state.map.find(n => n.id === nodeId);
    if (!node) return;
    
    this.state.currentNodeId = node.id;
    node.revealed = true;
    
    node.next.forEach(nextId => {
      const nextNode = this.state.map.find(n => n.id === nextId);
      if (nextNode) nextNode.revealed = true;
    });

    if (node.type === 'Combat') {
      this.state.activeEvent = null;
      this.startCombat(['slime_small', 'goblin']);
    } else if (node.type === 'Elite') {
      this.state.activeEvent = null;
      this.startCombat(['gremlin_nob']);
    } else if (node.type === 'Boss') {
      this.state.activeEvent = null;
      this.startCombat(['slime_boss']);
    } else if (node.type === 'Shop') {
      this.state.activeEvent = null;
      this.generateShopItems();
      this.state.screen = 'Shop';
    } else if (node.type === 'Rest') {
      this.state.activeEvent = null;
      this.state.screen = 'Rest';
    } else {
      this.state.activeEvent = this.prepareEvent();
      this.state.screen = 'Event';
    }
    this.notify();
  }
}
