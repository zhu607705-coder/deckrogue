/**
 * Global Event Bus
 * @deprecated This bus is now for OBSERVATION/ANIMATION/TRIGGERS ONLY.
 * Do NOT use for rule progression - use ResolutionPipeline instead.
 * Rule progression should go through: ResolutionIntent -> ResolutionPipeline -> ResolutionResult
 */
export type GameEvent =
  | { type: 'GameShutdown'; timestamp: number }
  | { type: 'RunStarted'; seed: number; timestamp: number }
  | { type: 'RunLoaded'; slotId: string; seed: number; timestamp: number }
  | { type: 'GamePaused'; timestamp: number }
  | { type: 'GameResumed'; timestamp: number }
  | { type: 'TurnStart'; playerTurn: boolean }
  | { type: 'TurnEnd'; playerTurn: boolean }
  | { type: 'ActionStart'; actionId: string; sequence: number; actionType: string; source: string; sourceId?: string; targetId?: string; cardId?: string; cardInstanceId?: string }
  | { type: 'ActionEnd'; actionId: string; sequence: number; actionType: string; source: string; sourceId?: string; targetId?: string; cardId?: string; cardInstanceId?: string }
  | { type: 'CombatStart' }
  | { type: 'CombatVictory' }
  | { type: 'CombatEnd'; victory: boolean }
  | { type: 'NodeCompleted'; nodeId?: string | null; screen: string; timestamp: number }
  | { type: 'CardPlayed'; cardId: string; cardType: string }
  | { type: 'CardDrawn'; cardId: string }
  | { type: 'DamageDealt'; amount: number; targetType: 'player' | 'enemy'; targetId: string }
  | { type: 'DamageReceived'; amount: number; sourceType: 'enemy' | 'self' }
  | { type: 'BlockGained'; amount: number }
  | { type: 'StatusApplied'; status: string; amount: number; targetType: 'player' | 'enemy'; targetId: string }
  | { type: 'EnergyChanged'; amount: number; current: number }
  | { type: 'GoldChanged'; amount: number; current: number }
  | { type: 'RelicAcquired'; relicId: string }
  | { type: 'PotionUsed'; potionId: string }
  | { type: 'WarpTideChanged'; amount: number; current: number }
  | { type: 'AxisChanged'; axis: 'devotion' | 'corruption'; amount: number; targetType: 'player' | 'enemy'; targetId: string }
  | { type: 'ConstructCreated'; constructId: string; name: string }
  | { type: 'ConstructDestroyed'; constructId: string }
  | { type: 'EnemyDefeated'; enemyId: string }
  | { type: 'PlayerDeath' }
  | { type: 'PlayerDefeated'; timestamp: number }
  | { type: 'EnemyDeath'; enemyId: string }
  | { type: 'RunVictory'; timestamp?: number }
  | { type: 'GameSaved'; slotId: string; timestamp: number }
  | { type: 'GameLoaded'; slotId: string; timestamp: number }
  | { type: 'SaveFailed'; error: string }
  | { type: 'LoadFailed'; error: string }
  | { type: 'AutoSaveTriggered' }
  | { type: 'MetaProfileUpdated'; summary: any; newAchievementIds: string[] }
  | { type: string; [key: string]: any };

export type EventListener = (event: GameEvent) => void;

export class EventBus {
  private listeners: Map<string, EventListener[]> = new Map();

  subscribe(eventType: string, listener: EventListener): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType)?.push(listener);

    return () => {
      const listeners = this.listeners.get(eventType);
      if (listeners) {
        this.listeners.set(eventType, listeners.filter(l => l !== listener));
      }
    };
  }

  publish(event: GameEvent): void {
    const eventType = event.type;
    const eventListeners = this.listeners.get(eventType) || [];
    eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error(`Error in event listener for ${eventType}:`, error);
      }
    });
  }

  clear(): void {
    this.listeners.clear();
  }
}

export const globalEventBus = new EventBus();
