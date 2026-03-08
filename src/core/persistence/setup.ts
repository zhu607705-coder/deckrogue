import { GameEngine } from '@/core/events/gameEngine';
import { saveManager, SaveData } from '@/core/persistence/saveManager';
import { globalEventBus } from '@/core/events/eventBus';
import { getActionManager, createActionManager } from '@/core/actions/actionManager';
import { setupActionManager } from '@/core/actions/v2/ActionFactory';
import { computeRunSummary } from '@/core/events/runSummarySystem';
import { applyRunSummaryToMetaProfile, loadMetaProfile, saveMetaProfile } from '@/core/persistence/metaProfileStore';
import type { MetaProfile } from '@/core/types';
import { RuntimeEventType } from '@/core/events/eventContract';

export interface GameSetupConfig {
  enableAutoSave: boolean;
  autoSaveInterval: number;
  enableDebugLogging: boolean;
  defaultSeed?: number;
}

export interface GameState {
  isInitialized: boolean;
  isRunning: boolean;
  isPaused: boolean;
  currentSeed: number;
  currentSaveSlot: string | null;
}

class GameSetup {
  private engine: GameEngine | null = null;
  private config: GameSetupConfig;
  private state: GameState = {
    isInitialized: false,
    isRunning: false,
    isPaused: false,
    currentSeed: 0,
    currentSaveSlot: null
  };
  private autoSaveTimer: number | null = null;
  private visibilityHandler: (() => void) | null = null;
  private beforeUnloadHandler: ((e: BeforeUnloadEvent) => void) | null = null;
  private disposables: Array<() => void> = [];

  constructor(config: Partial<GameSetupConfig> = {}) {
    this.config = {
      enableAutoSave: true,
      autoSaveInterval: 60000,
      enableDebugLogging: process.env.NODE_ENV === 'development',
      ...config
    };
  }

  // ==================== 初始化 ====================

  async initialize(): Promise<void> {
    if (this.state.isInitialized) {
      return;
    }

    this.log('Initializing game systems...');

    try {
      this.setupEventListeners();
      this.setupAutoSave();
      this.setupLifecycleHandlers();

      this.state.isInitialized = true;
      this.log('Game systems initialized successfully');

      globalEventBus.publish({
        type: 'GameInitialized',
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('[GameSetup] Initialization failed:', error);
      throw error;
    }
  }

  private setupEventListeners(): void {
    this.disposables.push(globalEventBus.subscribe(RuntimeEventType.CombatVictory, () => {
      if (this.config.enableAutoSave && this.engine) {
        this.triggerAutoSave('combat_victory');
      }
    }));

    this.disposables.push(globalEventBus.subscribe(RuntimeEventType.NodeCompleted, () => {
      if (this.config.enableAutoSave && this.engine) {
        this.triggerAutoSave('node_completed');
      }
    }));

    this.disposables.push(globalEventBus.subscribe(RuntimeEventType.PlayerDefeated, () => {
      if (this.engine) {
        this.handleGameOver();
      }
    }));

    this.disposables.push(globalEventBus.subscribe(RuntimeEventType.RunVictory, () => {
      if (this.engine) {
        this.handleRunVictory();
      }
    }));
  }

  private setupAutoSave(): void {
    if (!this.config.enableAutoSave) return;

    this.autoSaveTimer = window.setInterval(() => {
      if (this.engine && this.state.isRunning && !this.state.isPaused) {
        this.triggerAutoSave('interval');
      }
    }, this.config.autoSaveInterval);
  }

  private setupLifecycleHandlers(): void {
    this.visibilityHandler = () => {
      if (document.hidden) {
        this.pause();
      } else {
        this.resume();
      }
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);

    this.beforeUnloadHandler = (e: BeforeUnloadEvent) => {
      if (this.engine && this.state.isRunning) {
        this.triggerAutoSave('before_unload');
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', this.beforeUnloadHandler);
  }

  // ==================== 游戏生命周期 ====================

  startNewRun(seed?: number): GameEngine {
    if (!this.state.isInitialized) {
      throw new Error('[GameSetup] Must call initialize() before starting a run');
    }

    this.log(`Starting new run with seed: ${seed || 'random'}`);

    this.disposeCurrentRun();

    this.state.currentSeed = seed || Date.now();
    this.state.currentSaveSlot = null;
    this.state.isRunning = true;
    this.state.isPaused = false;

    const metaProfile = this.getMetaProfile();
    this.engine = new GameEngine(this.state.currentSeed, metaProfile);

    saveManager.startRun();

    globalEventBus.publish({
      type: RuntimeEventType.RunStarted,
      seed: this.state.currentSeed,
      timestamp: Date.now()
    });

    return this.engine;
  }

  loadRun(slotId: string): GameEngine | null {
    if (!this.state.isInitialized) {
      throw new Error('[GameSetup] Must call initialize() before loading a run');
    }

    this.log(`Loading run from slot: ${slotId}`);

    this.disposeCurrentRun();

    const saveData = saveManager.loadGame(slotId);
    if (!saveData) {
      console.error(`[GameSetup] Failed to load save from slot: ${slotId}`);
      return null;
    }

    this.state.currentSeed = saveData.metadata.seed;
    this.state.currentSaveSlot = slotId;
    this.state.isRunning = true;
    this.state.isPaused = false;

    this.engine = new GameEngine(this.state.currentSeed);
    this.engine.loadSaveData(saveData);

    saveManager.resumeRun();

    globalEventBus.publish({
      type: RuntimeEventType.RunLoaded,
      slotId,
      seed: this.state.currentSeed,
      timestamp: Date.now()
    });

    return this.engine;
  }

  pause(): void {
    if (!this.state.isRunning || this.state.isPaused) return;

    this.log('Game paused');
    this.state.isPaused = true;
    saveManager.pauseRun();

    globalEventBus.publish({
      type: RuntimeEventType.GamePaused,
      timestamp: Date.now()
    });
  }

  resume(): void {
    if (!this.state.isRunning || !this.state.isPaused) return;

    this.log('Game resumed');
    this.state.isPaused = false;
    saveManager.resumeRun();

    globalEventBus.publish({
      type: RuntimeEventType.GameResumed,
      timestamp: Date.now()
    });
  }

  clearActiveRun(): void {
    if (this.engine && this.state.isRunning) {
      this.triggerAutoSave('clear_active_run');
    }
    this.disposeCurrentRun();
    this.state.isRunning = false;
    this.state.isPaused = false;
    this.state.currentSaveSlot = null;
  }

  shutdown(): void {
    this.log('Shutting down game...');

    this.clearActiveRun();

    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }

    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
    }

    if (this.beforeUnloadHandler) {
      window.removeEventListener('beforeunload', this.beforeUnloadHandler);
    }

    this.disposables.splice(0).forEach((dispose) => {
      try {
        dispose();
      } catch (error) {
        console.error('[GameSetup] Failed to dispose subscription:', error);
      }
    });

    this.state.isInitialized = false;

    globalEventBus.publish({
      type: RuntimeEventType.GameShutdown,
      timestamp: Date.now()
    });
  }

  // ==================== 存档管理 ====================

  quickSave(): boolean {
    if (!this.engine || !this.state.isRunning) {
      console.warn('[GameSetup] Cannot quick save: no active run');
      return false;
    }

    const playTime = saveManager.getCurrentPlayTime();
    const result = saveManager.quickSave(this.engine.state, playTime);

    if (result) {
      this.state.currentSaveSlot = 'quicksave';
      this.log('Quick save successful');
    }

    return result;
  }

  quickLoad(): GameEngine | null {
    return this.loadRun('quicksave');
  }

  hasQuickSave(): boolean {
    return saveManager.hasQuickSave();
  }

  saveToSlot(slotId: string, name?: string): boolean {
    if (!this.engine || !this.state.isRunning) {
      console.warn('[GameSetup] Cannot save: no active run');
      return false;
    }

    const playTime = saveManager.getCurrentPlayTime();
    const result = saveManager.saveGame(slotId, this.engine.state, playTime);

    if (result) {
      this.state.currentSaveSlot = slotId;
      this.log(`Saved to slot: ${slotId}`);
    }

    return result;
  }

  private triggerAutoSave(reason: string): void {
    if (!this.engine || !this.state.isRunning) return;

    this.log(`Auto-saving (${reason})...`);

    const slotId = this.state.currentSaveSlot || 'autosave';
    const playTime = saveManager.getCurrentPlayTime();
    saveManager.saveGame(slotId, this.engine.state, playTime);
  }

  private handleGameOver(): void {
    this.handleRunEnd(false);
  }

  private handleRunVictory(): void {
    this.handleRunEnd(true);
  }

  private handleRunEnd(won: boolean): void {
    if (!this.engine || !this.state.isRunning) return;
    const currentNode = this.engine.state.currentNodeId
      ? this.engine.state.map.find((n) => n.id === this.engine.state.currentNodeId)
      : null;
    const floor = currentNode?.y ?? 0;

    saveManager.updateStats({
      won,
      floor: floor + 1,
      characterId: this.engine?.state.character?.id || '',
      playTime: saveManager.getCurrentPlayTime()
    });

    try {
      const summary = computeRunSummary(this.engine.state);
      const currentMeta = loadMetaProfile();
      const nextMeta = applyRunSummaryToMetaProfile(currentMeta, this.engine.state, summary);
      saveMetaProfile(nextMeta);
      const prevAch = new Set(currentMeta.achievements?.unlockedIds || []);
      const newAchievementIds = (nextMeta.achievements?.unlockedIds || []).filter((id) => !prevAch.has(id));
      globalEventBus.publish({ type: 'MetaProfileUpdated', summary, newAchievementIds } as any);
      this.log('Meta progression updated from run summary', summary);
    } catch (error) {
      console.error('[GameSetup] Failed to update meta progression:', error);
    }

    this.state.isRunning = false;
  }

  // ==================== 获取器 ====================

  getEngine(): GameEngine | null {
    return this.engine;
  }

  getSaveManager() {
    return saveManager;
  }

  getMetaProfile(): MetaProfile {
    return loadMetaProfile();
  }

  getState(): Readonly<GameState> {
    return { ...this.state };
  }

  isInitialized(): boolean {
    return this.state.isInitialized;
  }

  isRunning(): boolean {
    return this.state.isRunning;
  }

  isPaused(): boolean {
    return this.state.isPaused;
  }

  // ==================== 工具 ====================

  private log(...args: any[]): void {
    if (this.config.enableDebugLogging) {
      console.log('[GameSetup]', ...args);
    }
  }

  private disposeCurrentRun(): void {
    if (!this.engine) return;
    this.engine.dispose();
    this.engine = null;
  }
}

// ==================== 单例导出 ====================

let globalSetup: GameSetup | null = null;

export function createGameSetup(config?: Partial<GameSetupConfig>): GameSetup {
  if (globalSetup) {
    console.warn('[GameSetup] Global setup already exists, returning existing instance');
    return globalSetup;
  }

  globalSetup = new GameSetup(config);
  return globalSetup;
}

export function getGameSetup(): GameSetup | null {
  return globalSetup;
}

export function resetGameSetup(): void {
  if (globalSetup) {
    globalSetup.shutdown();
    globalSetup = null;
  }
}

// 默认导出配置好的实例
export const gameSetup = createGameSetup();
