export type EventType =
  | 'combat.start'
  | 'combat.end'
  | 'combat.turn.start'
  | 'combat.turn.end'
  | 'combat.damage.dealt'
  | 'combat.damage.received'
  | 'combat.enemy.death'
  | 'combat.player.death'
  | 'reward.offered'
  | 'reward.taken'
  | 'reward.skipped'
  | 'map.node.entered'
  | 'map.node.revealed'
  | 'player.stat.changed'
  | 'player.deck.changed'
  | 'player.relic.acquired'
  | 'player.potion.acquired'
  | 'ui.model.changed'
  | 'error'
  | 'warning';

export interface UIEvent {
  type: EventType;
  timestamp: number;
  payload: unknown;
  metadata?: Record<string, unknown>;
}

export interface CombatDamageEvent {
  source: 'player' | 'enemy';
  target: 'player' | 'enemy';
  sourceId?: string;
  targetId?: string;
  amount: number;
  block: number;
  finalDamage: number;
  type: 'physical' | 'magical' | 'true';
}

export interface RewardOfferedEvent {
  cards: string[];
  gold: number;
  relics: string[];
  potions: string[];
  source: string;
}

export interface PlayerStatChangedEvent {
  stat: 'hp' | 'gold' | 'intel' | 'devotion' | 'corruption';
  oldValue: number;
  newValue: number;
}

type EventListener = (event: UIEvent) => void;

export class EventBus {
  private listeners: Map<EventType | '*', EventListener[]>;
  private eventHistory: UIEvent[];
  private maxHistorySize: number;

  constructor(maxHistorySize = 100) {
    this.listeners = new Map();
    this.eventHistory = [];
    this.maxHistorySize = maxHistorySize;
  }

  subscribe(type: EventType | '*', listener: EventListener): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type)!.push(listener);

    return () => {
      const typeListeners = this.listeners.get(type);
      if (typeListeners) {
        this.listeners.set(type, typeListeners.filter(l => l !== listener));
      }
    };
  }

  publish(type: EventType, payload: unknown, metadata?: Record<string, unknown>): void {
    const event: UIEvent = {
      type,
      timestamp: Date.now(),
      payload,
      metadata,
    };

    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }

    const typeListeners = this.listeners.get(type);
    if (typeListeners) {
      typeListeners.forEach(listener => {
        try {
          listener(event);
        } catch (error) {
          console.error(`[EventBus] Listener error for ${type}:`, error);
        }
      });
    }

    const allListeners = this.listeners.get('*');
    if (allListeners) {
      allListeners.forEach(listener => {
        try {
          listener(event);
        } catch (error) {
          console.error(`[EventBus] Global listener error for ${type}:`, error);
        }
      });
    }
  }

  getHistory(): UIEvent[] {
    return [...this.eventHistory];
  }

  getHistoryByType(type: EventType): UIEvent[] {
    return this.eventHistory.filter(e => e.type === type);
  }

  clearHistory(): void {
    this.eventHistory = [];
  }

  clearAllListeners(): void {
    this.listeners.clear();
  }
}

let globalEventBus: EventBus | null = null;

export function getEventBus(): EventBus {
  if (!globalEventBus) {
    globalEventBus = new EventBus();
  }
  return globalEventBus;
}

export function resetEventBus(): void {
  if (globalEventBus) {
    globalEventBus.clearAllListeners();
    globalEventBus.clearHistory();
  }
  globalEventBus = null;
}
