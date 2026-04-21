import { GameState } from '@/core/types';
import { globalEventBus } from '@/core/events/eventBus';
import { cloneJsonValue } from '@/core/utils/safeJson';

export interface SaveSlot {
  stateSnapshot: GameState;
  timestamp: number;
  screen: string;
  seed: number;
  rngState: number;
}

export class SaveManager {
  private slotCount = 5;

  getSlotKey(index: number): string {
    return `deckrogue_save_${index}`;
  }

  saveToSlot(index: number, state: GameState): boolean {
    try {
      const payload: SaveSlot = {
        stateSnapshot: cloneJsonValue(state, {} as GameState),
        timestamp: Date.now(),
        screen: state.screen,
        seed: state.seed,
        rngState: state.rngState,
      };
      localStorage.setItem(this.getSlotKey(index), JSON.stringify(payload));
      return true;
    } catch {
      return false;
    }
  }

  loadFromSlot(index: number): SaveSlot | null {
    try {
      const raw = localStorage.getItem(this.getSlotKey(index));
      if (!raw) return null;
      return JSON.parse(raw) as SaveSlot;
    } catch {
      return null;
    }
  }

  deleteSlot(index: number): boolean {
    try {
      localStorage.removeItem(this.getSlotKey(index));
      return true;
    } catch {
      return false;
    }
  }

  listSlots(): Array<{ index: number; screen: string; timestamp: number } | null> {
    const result: Array<{ index: number; screen: string; timestamp: number } | null> = [];
    for (let i = 0; i < this.slotCount; i++) {
      const slot = this.loadFromSlot(i);
      result.push(
        slot
          ? { index: i, screen: slot.screen, timestamp: slot.timestamp }
          : null
      );
    }
    return result;
  }

  autoSave(state: GameState): void {
    this.saveToSlot(0, state);
    globalEventBus.publish({ type: 'AutoSaveCompleted', timestamp: Date.now() });
  }
}
