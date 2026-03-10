import { GameState } from '@/core/types';
import { globalEventBus } from '@/core/events/eventBus';

export interface SaveSlot {
  id: string;
  name: string;
  timestamp: number;
  playTime: number;
  floor: number;
  characterId: string;
  checksum: string;
}

export interface SaveData {
  version: string;
  timestamp: number;
  playTime: number;
  state: GameState;
  metadata: {
    floor: number;
    characterId: string;
    seed: number;
    runStartTime: number;
  };
}

export class SaveManager {
  private static readonly SAVE_VERSION = '1.0.0';
  private static readonly SAVE_KEY_PREFIX = 'deckrogue_save_';
  private static readonly SLOTS_KEY = 'deckrogue_save_slots';
  private static readonly SETTINGS_KEY = 'deckrogue_settings';
  private static readonly UNLOCKS_KEY = 'deckrogue_unlocks';
  private static readonly STATS_KEY = 'deckrogue_stats';

  private currentRunStartTime: number = 0;
  private accumulatedPlayTime: number = 0;

  constructor() {
    this.setupAutoSave();
  }

  // ==================== Save Slots Management ====================

  getSaveSlots(): SaveSlot[] {
    try {
      const data = localStorage.getItem(SaveManager.SLOTS_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  private updateSaveSlot(slotId: string, data: Partial<SaveSlot>): void {
    const slots = this.getSaveSlots();
    const index = slots.findIndex(s => s.id === slotId);

    const newSlot: SaveSlot = {
      id: slotId,
      name: data.name || `Run ${slots.length + 1}`,
      timestamp: Date.now(),
      playTime: data.playTime || 0,
      floor: data.floor || 1,
      characterId: data.characterId || '',
      checksum: data.checksum || ''
    };

    if (index >= 0) {
      slots[index] = { ...slots[index], ...newSlot };
    } else {
      slots.push(newSlot);
    }

    localStorage.setItem(SaveManager.SLOTS_KEY, JSON.stringify(slots));
  }

  deleteSaveSlot(slotId: string): boolean {
    try {
      localStorage.removeItem(`${SaveManager.SAVE_KEY_PREFIX}${slotId}`);

      const slots = this.getSaveSlots().filter(s => s.id !== slotId);
      localStorage.setItem(SaveManager.SLOTS_KEY, JSON.stringify(slots));

      return true;
    } catch (error) {
      console.error('Failed to delete save slot:', error);
      return false;
    }
  }

  // ==================== Game State Save/Load ====================

  saveGame(slotId: string, state: GameState, playTime?: number): boolean {
    try {
      const saveData: SaveData = {
        version: SaveManager.SAVE_VERSION,
        timestamp: Date.now(),
        playTime: playTime ?? this.accumulatedPlayTime,
        state: this.serializeState(state),
        metadata: {
          floor: this.getCurrentFloor(state),
          characterId: state.character?.id || '',
          seed: state.seed,
          runStartTime: this.currentRunStartTime
        }
      };

      const serialized = JSON.stringify(saveData);
      const checksum = this.calculateChecksum(serialized);

      localStorage.setItem(`${SaveManager.SAVE_KEY_PREFIX}${slotId}`, serialized);

      this.updateSaveSlot(slotId, {
        name: `${state.character?.name || 'Unknown'} - Floor ${saveData.metadata.floor}`,
        timestamp: saveData.timestamp,
        playTime: saveData.playTime,
        floor: saveData.metadata.floor,
        characterId: saveData.metadata.characterId,
        checksum
      });

      globalEventBus.publish({
        type: 'GameSaved',
        slotId,
        timestamp: saveData.timestamp
      });

      return true;
    } catch (error) {
      console.error('Failed to save game:', error);
      globalEventBus.publish({
        type: 'SaveFailed',
        error: String(error)
      });
      return false;
    }
  }

  loadGame(slotId: string): SaveData | null {
    try {
      const data = localStorage.getItem(`${SaveManager.SAVE_KEY_PREFIX}${slotId}`);
      if (!data) return null;

      const saveData: SaveData = JSON.parse(data);

      if (saveData.version !== SaveManager.SAVE_VERSION) {
        console.warn(`Save version mismatch: ${saveData.version} vs ${SaveManager.SAVE_VERSION}`);
        const migrated = this.migrateSaveData(saveData);
        if (!migrated) return null;
        return migrated;
      }

      this.currentRunStartTime = saveData.metadata.runStartTime;
      this.accumulatedPlayTime = saveData.playTime;

      globalEventBus.publish({
        type: 'GameLoaded',
        slotId,
        timestamp: saveData.timestamp
      });

      return saveData;
    } catch (error) {
      console.error('Failed to load game:', error);
      globalEventBus.publish({
        type: 'LoadFailed',
        error: String(error)
      });
      return null;
    }
  }

  hasSave(slotId: string): boolean {
    return localStorage.getItem(`${SaveManager.SAVE_KEY_PREFIX}${slotId}`) !== null;
  }

  // ==================== Quick Save/Load ====================

  quickSave(state: GameState, playTime?: number): boolean {
    return this.saveGame('quicksave', state, playTime);
  }

  quickLoad(): SaveData | null {
    return this.loadGame('quicksave');
  }

  hasQuickSave(): boolean {
    return this.hasSave('quicksave');
  }

  // ==================== Auto Save ====================

  private autoSaveInterval: ReturnType<typeof setTimeout> | null = null;

  private setupAutoSave(): void {
    globalEventBus.subscribe('CombatVictory', () => {
      this.triggerAutoSave();
    });

    globalEventBus.subscribe('NodeCompleted', () => {
      this.triggerAutoSave();
    });
  }

  private triggerAutoSave(): void {
    if (typeof window === 'undefined') return;

    if (this.autoSaveInterval) {
      clearTimeout(this.autoSaveInterval);
    }

    this.autoSaveInterval = setTimeout(() => {
      globalEventBus.publish({ type: 'AutoSaveTriggered' });
    }, 1000);
  }

  // ==================== Settings ====================

  saveSettings(settings: Record<string, any>): boolean {
    try {
      localStorage.setItem(SaveManager.SETTINGS_KEY, JSON.stringify(settings));
      return true;
    } catch (error) {
      console.error('Failed to save settings:', error);
      return false;
    }
  }

  loadSettings(): Record<string, any> | null {
    try {
      const data = localStorage.getItem(SaveManager.SETTINGS_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  // ==================== Unlocks ====================

  saveUnlocks(unlocks: {
    characters: string[];
    cards: string[];
    relics: string[];
    achievements: string[];
  }): boolean {
    try {
      localStorage.setItem(SaveManager.UNLOCKS_KEY, JSON.stringify(unlocks));
      return true;
    } catch (error) {
      console.error('Failed to save unlocks:', error);
      return false;
    }
  }

  loadUnlocks() {
    try {
      const data = localStorage.getItem(SaveManager.UNLOCKS_KEY);
      return data ? JSON.parse(data) : {
        characters: ['warrior'],
        cards: [],
        relics: [],
        achievements: []
      };
    } catch {
      return {
        characters: ['warrior'],
        cards: [],
        relics: [],
        achievements: []
      };
    }
  }

  unlockCharacter(characterId: string): void {
    const unlocks = this.loadUnlocks();
    if (!unlocks.characters.includes(characterId)) {
      unlocks.characters.push(characterId);
      this.saveUnlocks(unlocks);

      globalEventBus.publish({
        type: 'CharacterUnlocked',
        characterId
      });
    }
  }

  unlockCard(cardId: string): void {
    const unlocks = this.loadUnlocks();
    if (!unlocks.cards.includes(cardId)) {
      unlocks.cards.push(cardId);
      this.saveUnlocks(unlocks);
    }
  }

  unlockRelic(relicId: string): void {
    const unlocks = this.loadUnlocks();
    if (!unlocks.relics.includes(relicId)) {
      unlocks.relics.push(relicId);
      this.saveUnlocks(unlocks);
    }
  }

  unlockAchievement(achievementId: string): void {
    const unlocks = this.loadUnlocks();
    if (!unlocks.achievements.includes(achievementId)) {
      unlocks.achievements.push(achievementId);
      this.saveUnlocks(unlocks);

      globalEventBus.publish({
        type: 'AchievementUnlocked',
        achievementId
      });
    }
  }

  // ==================== Statistics ====================

  saveStats(stats: {
    totalRuns: number;
    totalWins: number;
    totalPlayTime: number;
    bestFloor: number;
    favoriteCharacter: string;
    achievements: Record<string, number>;
  }): boolean {
    try {
      localStorage.setItem(SaveManager.STATS_KEY, JSON.stringify(stats));
      return true;
    } catch (error) {
      console.error('Failed to save stats:', error);
      return false;
    }
  }

  loadStats() {
    try {
      const data = localStorage.getItem(SaveManager.STATS_KEY);
      return data ? JSON.parse(data) : {
        totalRuns: 0,
        totalWins: 0,
        totalPlayTime: 0,
        bestFloor: 0,
        favoriteCharacter: '',
        achievements: {}
      };
    } catch {
      return {
        totalRuns: 0,
        totalWins: 0,
        totalPlayTime: 0,
        bestFloor: 0,
        favoriteCharacter: '',
        achievements: {}
      };
    }
  }

  updateStats(runStats: {
    won: boolean;
    floor: number;
    characterId: string;
    playTime: number;
  }): void {
    const stats = this.loadStats();

    stats.totalRuns++;
    if (runStats.won) stats.totalWins++;
    stats.totalPlayTime += runStats.playTime;
    stats.bestFloor = Math.max(stats.bestFloor, runStats.floor);

    this.saveStats(stats);
  }

  // ==================== Utility ====================

  private serializeState(state: GameState): GameState {
    return JSON.parse(JSON.stringify(state));
  }

  private getCurrentFloor(state: GameState): number {
    if (!state.map || !state.currentNodeId) return 1;
    return state.map.findIndex(n => n.id === state.currentNodeId) + 1;
  }

  private calculateChecksum(data: string): string {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  private migrateSaveData(oldData: SaveData): SaveData | null {
    if (!oldData.version) {
      console.error('Save data has no version');
      return null;
    }

    const versionParts = oldData.version.split('.').map(Number);
    const currentParts = SaveManager.SAVE_VERSION.split('.').map(Number);

    if (versionParts[0] < currentParts[0]) {
      console.error('Major version mismatch, cannot migrate');
      return null;
    }

    return {
      ...oldData,
      version: SaveManager.SAVE_VERSION
    };
  }

  // ==================== Import/Export ====================

  exportSave(slotId: string): string | null {
    const data = localStorage.getItem(`${SaveManager.SAVE_KEY_PREFIX}${slotId}`);
    if (!data) return null;

    try {
      const compressed = btoa(data);
      return compressed;
    } catch (error) {
      console.error('Failed to export save:', error);
      return null;
    }
  }

  importSave(slotId: string, exportedData: string): boolean {
    try {
      const decompressed = atob(exportedData);
      const saveData: SaveData = JSON.parse(decompressed);

      if (saveData.version !== SaveManager.SAVE_VERSION) {
        const migrated = this.migrateSaveData(saveData);
        if (!migrated) return false;
      }

      localStorage.setItem(`${SaveManager.SAVE_KEY_PREFIX}${slotId}`, decompressed);

      this.updateSaveSlot(slotId, {
        name: `Imported - ${saveData.metadata.characterId}`,
        timestamp: saveData.timestamp,
        playTime: saveData.playTime,
        floor: saveData.metadata.floor,
        characterId: saveData.metadata.characterId,
        checksum: this.calculateChecksum(decompressed)
      });

      return true;
    } catch (error) {
      console.error('Failed to import save:', error);
      return false;
    }
  }

  // ==================== Clear All Data ====================

  clearAllData(): boolean {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('deckrogue_')) {
          keysToRemove.push(key);
        }
      }

      keysToRemove.forEach(key => localStorage.removeItem(key));

      globalEventBus.publish({ type: 'AllDataCleared' });

      return true;
    } catch (error) {
      console.error('Failed to clear all data:', error);
      return false;
    }
  }

  // ==================== Play Time Tracking ====================

  startRun(): void {
    this.currentRunStartTime = Date.now();
    this.accumulatedPlayTime = 0;
  }

  getCurrentPlayTime(): number {
    if (this.currentRunStartTime === 0) return 0;
    return this.accumulatedPlayTime + (Date.now() - this.currentRunStartTime);
  }

  pauseRun(): void {
    if (this.currentRunStartTime > 0) {
      this.accumulatedPlayTime += Date.now() - this.currentRunStartTime;
      this.currentRunStartTime = 0;
    }
  }

  resumeRun(): void {
    if (this.currentRunStartTime === 0) {
      this.currentRunStartTime = Date.now();
    }
  }
}

export const saveManager = new SaveManager();
