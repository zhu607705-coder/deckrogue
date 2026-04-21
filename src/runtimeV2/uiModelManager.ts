import type { UIModel } from './uiModel';
import { getEventBus } from './eventBus';
import { deepEqual, generateHash } from './utils';

export interface Change {
  type: 'screen' | 'player' | 'map' | 'room' | 'combat' | 'reward' | 'activeEvent' | 'notifications';
  path: string;
  oldValue: unknown;
  newValue: unknown;
}

export interface ChangeEvent {
  change: Change;
  timestamp: number;
  model: UIModel;
}

export class UIModelManager {
  private currentModel: UIModel | null;
  private cache: Map<string, UIModel>;
  private maxCacheSize: number;

  constructor(maxCacheSize = 100) {
    this.currentModel = null;
    this.cache = new Map();
    this.maxCacheSize = maxCacheSize;
  }

  update(newModel: UIModel): UIModel {
    const changes = this.detectChanges(this.currentModel, newModel);

    if (changes.length > 0) {
      this.currentModel = newModel;
      this.publishChangeEvents(changes, newModel);
      this.cacheModel(newModel);
    }

    return this.currentModel || newModel;
  }

  private detectChanges(oldModel: UIModel | null, newModel: UIModel): Change[] {
    const changes: Change[] = [];

    if (!oldModel) {
      return [
        { type: 'screen', path: 'screen', oldValue: null, newValue: newModel.screen },
        { type: 'player', path: 'player', oldValue: null, newValue: newModel.player },
        { type: 'map', path: 'map', oldValue: null, newValue: newModel.map },
        { type: 'room', path: 'room', oldValue: null, newValue: newModel.room },
        { type: 'combat', path: 'combat', oldValue: null, newValue: newModel.combat },
        { type: 'reward', path: 'reward', oldValue: null, newValue: newModel.reward },
        { type: 'activeEvent', path: 'activeEvent', oldValue: null, newValue: newModel.activeEvent },
        { type: 'notifications', path: 'notifications', oldValue: null, newValue: newModel.notifications },
      ];
    }

    if (oldModel.screen !== newModel.screen) {
      changes.push({ type: 'screen', path: 'screen', oldValue: oldModel.screen, newValue: newModel.screen });
    }

    if (!deepEqual(oldModel.player, newModel.player)) {
      changes.push({ type: 'player', path: 'player', oldValue: oldModel.player, newValue: newModel.player });
    }

    if (!deepEqual(oldModel.map, newModel.map)) {
      changes.push({ type: 'map', path: 'map', oldValue: oldModel.map, newValue: newModel.map });
    }

    if (!deepEqual(oldModel.room, newModel.room)) {
      changes.push({ type: 'room', path: 'room', oldValue: oldModel.room, newValue: newModel.room });
    }

    if (!deepEqual(oldModel.combat, newModel.combat)) {
      changes.push({ type: 'combat', path: 'combat', oldValue: oldModel.combat, newValue: newModel.combat });
    }

    if (!deepEqual(oldModel.reward, newModel.reward)) {
      changes.push({ type: 'reward', path: 'reward', oldValue: oldModel.reward, newValue: newModel.reward });
    }

    if (!deepEqual(oldModel.activeEvent, newModel.activeEvent)) {
      changes.push({ type: 'activeEvent', path: 'activeEvent', oldValue: oldModel.activeEvent, newValue: newModel.activeEvent });
    }

    if (!deepEqual(oldModel.notifications, newModel.notifications)) {
      changes.push({ type: 'notifications', path: 'notifications', oldValue: oldModel.notifications, newValue: newModel.notifications });
    }

    return changes;
  }

  private publishChangeEvents(changes: Change[], model: UIModel): void {
    const eventBus = getEventBus();

    changes.forEach(change => {
      eventBus.publish('ui.model.changed', {
        change,
        timestamp: Date.now(),
        model,
      });
    });
  }

  private cacheModel(model: UIModel): void {
    const cacheKey = this.generateCacheKey(model);

    if (this.cache.size >= this.maxCacheSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(cacheKey, model);
  }

  private generateCacheKey(model: UIModel): string {
    return generateHash({
      screen: model.screen,
      player: {
        characterId: model.player.characterId,
        hp: model.player.hp,
        gold: model.player.gold,
      },
      map: model.map.currentNodeId,
      combat: model.combat?.turn,
      reward: model.reward?.cards.map(c => c.id),
    });
  }

  getCurrentModel(): UIModel | null {
    return this.currentModel;
  }

  clearCache(): void {
    this.cache.clear();
  }

  getCacheSize(): number {
    return this.cache.size;
  }
}

let globalModelManager: UIModelManager | null = null;

export function getUIModelManager(): UIModelManager {
  if (!globalModelManager) {
    globalModelManager = new UIModelManager();
  }
  return globalModelManager;
}

export function resetUIModelManager(): void {
  globalModelManager = null;
}
