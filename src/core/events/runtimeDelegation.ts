import { runGenerator } from '@/core/events/runGenerator';
import { screenToRunPhase } from '@/core/events/runStateMachine';
import type { RuleSnapshot } from '@/runtimeV2/contracts';
import { buildRuntimeV2ContentBundle } from '@/runtimeV2/content/buildContentBundle';
import { safeArrayAccess } from '@/core/utils/safeArray';

export type GameEngineDelegatedSlice = 'boot_and_map';

export interface GameEngineRuntimeDelegate {
  start(seed: number): void;
  selectCharacter(characterId: string): RuleSnapshot;
  enterNode(nodeId: string): RuleSnapshot;
  completeCombat(): RuleSnapshot;
  takeReward(cardId?: string): RuleSnapshot;
  skipReward(): RuleSnapshot;
  chooseEventOption(choiceId: string): RuleSnapshot;
  rest(): RuleSnapshot;
  upgradeCard(cardInstanceId?: string): RuleSnapshot;
  removeCard(cardInstanceId?: string): RuleSnapshot;
  leaveRoom(): RuleSnapshot;
  loadSnapshot(snapshot: RuleSnapshot): void;
  getSnapshot(): RuleSnapshot | null;
  dispose(): void;
}

export interface GameEngineRuntimeDelegateOptions {
  enableRuntimeDelegation?: boolean;
  delegatedSlices?: GameEngineDelegatedSlice[];
  runtimeDelegate?: GameEngineRuntimeDelegate | null;
}

export interface GameEngineRuntimeDelegateDiagnostics {
  enabled: boolean;
  delegatedSlices: GameEngineDelegatedSlice[];
  source: string | null;
  lastDelegatedCommand:
    | 'select_character'
    | 'enter_node'
    | 'complete_combat'
    | 'take_reward'
    | 'skip_reward'
    | 'choose_event_option'
    | 'rest'
    | 'upgrade_card'
    | 'remove_card'
    | 'leave_room'
    | 'load_snapshot'
    | null;
  fallbackCount: number;
  lastFallbackReason: string | null;
}

function createInitialSnapshot(seed: number): RuleSnapshot {
  return {
    schemaVersion: 2,
    engineVersion: 'runtime-v2-sync',
    seed,
    lifecycle: {
      screen: 'CharacterSelect',
      phase: 'character_select',
      pendingNodeResolution: false,
    },
    player: {
      characterId: null,
      hp: 0,
      maxHp: 0,
      gold: 0,
      intel: 0,
      devotion: 0,
      corruption: 0,
      deck: [],
      relicIds: [],
      potionIds: [],
    },
    map: {
      currentNodeId: null,
      nodes: [],
    },
    combat: null,
    reward: null,
    activeEvent: null,
    meta: {
      runId: `run_${seed}`,
      replayLength: 0,
      generatedAt: new Date().toISOString(),
      adapter: 'python-wasm',
    },
  };
}

export class SyncBootAndMapRuntimeDelegate implements GameEngineRuntimeDelegate {
  private snapshot: RuleSnapshot | null = null;
  private seed = 0;
  private runtimeRngState = 0;
  private readonly contentBundle = buildRuntimeV2ContentBundle();

  start(seed: number): void {
    this.seed = seed;
    this.runtimeRngState = 0;
    this.snapshot = createInitialSnapshot(seed);
  }

  selectCharacter(characterId: string): RuleSnapshot {
    const character = this.contentBundle.characters.find((entry) => entry.id === characterId);
    if (!character) {
      throw new Error(`Unknown delegated character: ${characterId}`);
    }
    this.snapshot = {
      schemaVersion: 2,
      engineVersion: 'runtime-v2-sync',
      seed: this.seed,
      lifecycle: {
        screen: 'Map',
        phase: 'map',
        pendingNodeResolution: false,
      },
      player: {
        characterId,
        hp: character.max_hp,
        maxHp: character.max_hp,
        gold: character.starting_gold,
        intel: 0,
        devotion: 0,
        corruption: 0,
        deck: [...character.starting_deck],
        relicIds: [],
        potionIds: [],
      },
      map: {
        currentNodeId: null,
        nodes: runGenerator.generateMap(this.seed, this.contentBundle.map.floors).map((node) => ({
          id: node.id,
          type: node.type,
          x: node.x,
          y: node.y,
          revealed: !!node.revealed,
          next: [...node.next],
        })),
      },
      combat: null,
      reward: null,
      activeEvent: null,
      meta: {
        runId: `run_${this.seed}`,
        replayLength: 1,
        generatedAt: new Date().toISOString(),
        adapter: 'python-wasm',
      },
    };
    return structuredClone(this.snapshot);
  }

  enterNode(nodeId: string): RuleSnapshot {
    if (!this.snapshot) {
      throw new Error('Delegated runtime has not been started');
    }
    if (this.snapshot.lifecycle.phase !== 'map') {
      throw new Error('Delegated enterNode is only valid during map phase');
    }

    const nodes = this.snapshot.map.nodes.map((node) => ({ ...node, next: [...node.next] }));
    const node = nodes.find((entry) => entry.id === nodeId);
    if (!node) {
      throw new Error(`Unknown delegated node: ${nodeId}`);
    }

    const currentNodeId = this.snapshot.map.currentNodeId;
    if (currentNodeId == null && node.y !== 0) {
      throw new Error(`Cannot enter non-starting delegated node: ${nodeId}`);
    }
    if (currentNodeId != null) {
      const currentNode = nodes.find((entry) => entry.id === currentNodeId);
      if (!currentNode || !currentNode.next.includes(nodeId)) {
        throw new Error(`Delegated node is not reachable: ${nodeId}`);
      }
    }

    node.revealed = true;
    for (const nextNodeId of node.next) {
      const nextNode = nodes.find((entry) => entry.id === nextNodeId);
      if (nextNode) nextNode.revealed = true;
    }

    let targetScreen: 'Combat' | 'Event' | 'Shop' | 'Rest';
    switch (node.type) {
      case 'Combat':
      case 'Elite':
      case 'Boss':
        targetScreen = 'Combat';
        break;
      case 'Event':
        targetScreen = 'Event';
        break;
      case 'Shop':
        targetScreen = 'Shop';
        break;
      case 'Rest':
        targetScreen = 'Rest';
        break;
      default:
        throw new Error(`Unsupported delegated node type: ${node.type}`);
    }

    this.snapshot = {
      ...this.snapshot,
      lifecycle: {
        screen: targetScreen,
        phase: screenToRunPhase(targetScreen),
        pendingNodeResolution: true,
      },
      map: {
        currentNodeId: nodeId,
        nodes,
      },
      meta: {
        ...this.snapshot.meta,
        replayLength: this.snapshot.meta.replayLength + 1,
        generatedAt: new Date().toISOString(),
      },
    };
    return structuredClone(this.snapshot);
  }

  completeCombat(): RuleSnapshot {
    if (!this.snapshot) {
      throw new Error('Delegated runtime has not been started');
    }
    if (this.snapshot.lifecycle.phase !== 'combat') {
      throw new Error(`Delegated completeCombat is not supported from phase: ${this.snapshot.lifecycle.phase}`);
    }

    const currentNode = this.snapshot.map.nodes.find((node) => node.id === this.snapshot!.map.currentNodeId);
    const floor = currentNode ? currentNode.y + 1 : 1;
    const nodeType = currentNode?.type ?? 'Combat';

    this.snapshot = {
      ...this.snapshot,
      player: {
        ...this.snapshot.player,
        gold: this.snapshot.player.gold + this.calculateGoldReward(floor, nodeType),
      },
      combat: null,
      reward: {
        cardIds: this.generateRewardCards(),
        source: 'combat',
      },
      lifecycle: {
        screen: 'Reward',
        phase: 'reward',
        pendingNodeResolution: true,
      },
      meta: {
        ...this.snapshot.meta,
        replayLength: this.snapshot.meta.replayLength + 1,
        generatedAt: new Date().toISOString(),
      },
    };
    return structuredClone(this.snapshot);
  }

  takeReward(cardId?: string): RuleSnapshot {
    if (!this.snapshot) {
      throw new Error('Delegated runtime has not been started');
    }
    if (this.snapshot.lifecycle.phase !== 'reward') {
      throw new Error(`Delegated takeReward is not supported from phase: ${this.snapshot.lifecycle.phase}`);
    }

    const reward = this.snapshot.reward;
    if (!reward) {
      throw new Error('No delegated reward is available');
    }

    const selectedCardId = cardId ?? safeArrayAccess(reward.cardIds, 0);
    if (selectedCardId && !reward.cardIds.includes(selectedCardId)) {
      throw new Error(`Delegated reward card is not offered: ${selectedCardId}`);
    }

    this.snapshot = {
      ...this.snapshot,
      player: {
        ...this.snapshot.player,
        deck: selectedCardId ? [...this.snapshot.player.deck, selectedCardId] : [...this.snapshot.player.deck],
      },
      reward: null,
      lifecycle: {
        screen: 'Map',
        phase: 'map',
        pendingNodeResolution: false,
      },
      meta: {
        ...this.snapshot.meta,
        replayLength: this.snapshot.meta.replayLength + 1,
        generatedAt: new Date().toISOString(),
      },
    };
    return structuredClone(this.snapshot);
  }

  skipReward(): RuleSnapshot {
    if (!this.snapshot) {
      throw new Error('Delegated runtime has not been started');
    }
    if (this.snapshot.lifecycle.phase !== 'reward') {
      throw new Error(`Delegated skipReward is not supported from phase: ${this.snapshot.lifecycle.phase}`);
    }

    this.snapshot = {
      ...this.snapshot,
      reward: null,
      lifecycle: {
        screen: 'Map',
        phase: 'map',
        pendingNodeResolution: false,
      },
      meta: {
        ...this.snapshot.meta,
        replayLength: this.snapshot.meta.replayLength + 1,
        generatedAt: new Date().toISOString(),
      },
    };
    return structuredClone(this.snapshot);
  }

  chooseEventOption(choiceId: string): RuleSnapshot {
    if (!this.snapshot) {
      throw new Error('Delegated runtime has not been started');
    }
    if (this.snapshot.lifecycle.phase !== 'event') {
      throw new Error(`Delegated chooseEventOption is not supported from phase: ${this.snapshot.lifecycle.phase}`);
    }

    this.snapshot = {
      ...this.snapshot,
      activeEvent: this.snapshot.activeEvent
        ? {
            ...this.snapshot.activeEvent,
            data: {
              ...(this.snapshot.activeEvent.data || {}),
              lastChoiceId: choiceId,
            },
          }
        : null,
      meta: {
        ...this.snapshot.meta,
        replayLength: this.snapshot.meta.replayLength + 1,
        generatedAt: new Date().toISOString(),
      },
    };
    return structuredClone(this.snapshot);
  }

  rest(): RuleSnapshot {
    if (!this.snapshot) {
      throw new Error('Delegated runtime has not been started');
    }
    if (this.snapshot.lifecycle.phase !== 'rest') {
      throw new Error(`Delegated rest is not supported from phase: ${this.snapshot.lifecycle.phase}`);
    }

    const healAmount = Math.floor(this.snapshot.player.maxHp * 0.3);
    this.snapshot = {
      ...this.snapshot,
      player: {
        ...this.snapshot.player,
        hp: Math.min(this.snapshot.player.maxHp, this.snapshot.player.hp + healAmount),
      },
      meta: {
        ...this.snapshot.meta,
        replayLength: this.snapshot.meta.replayLength + 1,
        generatedAt: new Date().toISOString(),
      },
    };
    return structuredClone(this.snapshot);
  }

  upgradeCard(_cardInstanceId?: string): RuleSnapshot {
    if (!this.snapshot) {
      throw new Error('Delegated runtime has not been started');
    }
    this.snapshot = {
      ...this.snapshot,
      meta: {
        ...this.snapshot.meta,
        replayLength: this.snapshot.meta.replayLength + 1,
        generatedAt: new Date().toISOString(),
      },
    };
    return structuredClone(this.snapshot);
  }

  removeCard(_cardInstanceId?: string): RuleSnapshot {
    if (!this.snapshot) {
      throw new Error('Delegated runtime has not been started');
    }
    const nextDeck = [...this.snapshot.player.deck];
    if (nextDeck.length > 0) {
      nextDeck.shift();
    }
    this.snapshot = {
      ...this.snapshot,
      player: {
        ...this.snapshot.player,
        deck: nextDeck,
      },
      meta: {
        ...this.snapshot.meta,
        replayLength: this.snapshot.meta.replayLength + 1,
        generatedAt: new Date().toISOString(),
      },
    };
    return structuredClone(this.snapshot);
  }

  leaveRoom(): RuleSnapshot {
    if (!this.snapshot) {
      throw new Error('Delegated runtime has not been started');
    }
    if (!['event', 'shop', 'rest'].includes(this.snapshot.lifecycle.phase)) {
      throw new Error(`Delegated leaveRoom is not supported from phase: ${this.snapshot.lifecycle.phase}`);
    }

    this.snapshot = {
      ...this.snapshot,
      lifecycle: {
        screen: 'Map',
        phase: 'map',
        pendingNodeResolution: false,
      },
      activeEvent: null,
      meta: {
        ...this.snapshot.meta,
        replayLength: this.snapshot.meta.replayLength + 1,
        generatedAt: new Date().toISOString(),
      },
    };
    return structuredClone(this.snapshot);
  }

  loadSnapshot(snapshot: RuleSnapshot): void {
    this.seed = snapshot.seed;
    this.runtimeRngState = 0;
    this.snapshot = structuredClone(snapshot);
  }

  getSnapshot(): RuleSnapshot | null {
    return this.snapshot ? structuredClone(this.snapshot) : null;
  }

  dispose(): void {
    this.runtimeRngState = 0;
    this.snapshot = null;
  }

  private generateRewardCards(): string[] {
    if (!this.snapshot) return [];
    const characterId = this.snapshot.player.characterId;
    const character = this.contentBundle.characters.find((entry) => entry.id === characterId);
    const extendedPool = new Set(character?.extended_pool ?? []);
    const rewards: string[] = [];

    for (let index = 0; index < 3; index += 1) {
      const rarityRoll = this.nextRuntimeRandom();
      let rarity = 'Common';
      if (rarityRoll > 0.85) rarity = 'Rare';
      else if (rarityRoll > 0.55) rarity = 'Uncommon';

      let validCards = this.contentBundle.cards.filter((entry) =>
        entry.rarity === rarity && (entry.character === 'All' || entry.character === characterId),
      );
      const extendedCards = this.contentBundle.cards.filter((entry) => extendedPool.has(entry.id) && entry.rarity === rarity);
      if (extendedCards.length > 0 && this.nextRuntimeRandom() < 0.35) {
        validCards = [...validCards, ...extendedCards];
      }

      const fallbackCards = this.contentBundle.cards.filter((entry) => entry.rarity === rarity && entry.character === 'All');
      const pool = validCards.length > 0 ? validCards : fallbackCards;
      if (pool.length === 0) continue;
      const chosenCard = safeArrayAccess(pool, Math.floor(this.nextRuntimeRandom() * pool.length));
      if (chosenCard) {
        rewards.push(chosenCard.id);
      }
      this.consumeRuntimeId();
    }

    return rewards;
  }

  private calculateGoldReward(floor: number, nodeType: string): number {
    const baseGold = 16 + Math.max(0, floor - 1) * 3;
    if (nodeType === 'Boss') return baseGold * 3;
    if (nodeType === 'Elite') return baseGold * 2;
    return baseGold;
  }

  private nextRuntimeRandom(): number {
    let state = this.runtimeRngState | 0;
    state = (state + 0x6d2b79f5) | 0;
    this.runtimeRngState = state;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + (Math.imul(t ^ (t >>> 7), 61 | t) ^ t)) | 0;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  private consumeRuntimeId(): string {
    return `runtime_${Math.floor(this.nextRuntimeRandom() * 1_000_000_000)}`;
  }
}

export function createDefaultGameEngineRuntimeDelegate(): GameEngineRuntimeDelegate {
  return new SyncBootAndMapRuntimeDelegate();
}
