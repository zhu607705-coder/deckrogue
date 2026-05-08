/**
 * @file MemoryManager.ts
 * @description 内存管理器 - 监控和管理游戏运行时内存使用
 *
 * 主要职责:
 * - 监控 JS 堆内存使用 (usedJSHeapSize, totalJSHeapSize, jsHeapSizeLimit)
 * - 追踪战斗临时数据和事件监听器数量
 * - 管理临时数据缓存和战斗临时数据
 * - 提供内存快照和 GC 警告功能
 */
export interface MemoryStats {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
  timestamp: number;
}

export interface MemorySnapshot {
 战斗: number;
  临时数据: number;
  事件监听器: number;
  总计: number;
}

class MemoryManager {
  private static instance: MemoryManager;
  private snapshots: MemoryStats[] = [];
  private maxSnapshots = 60;
  private eventListenerCount = 0;
  private temporaryDataCache = new WeakMap<object, unknown>();
  private combatTempData = new WeakMap<object, unknown>();
  private lastGCWarning = 0;
  private _tempDataCount = 0;
  private _combatTempCount = 0;
  private monitoringTimer: ReturnType<typeof setInterval> | null = null;

  private constructor() {
    if (typeof window !== 'undefined') {
      this.startMonitoring();
    }
  }

  static getInstance(): MemoryManager {
    if (!MemoryManager.instance) {
      MemoryManager.instance = new MemoryManager();
    }
    return MemoryManager.instance;
  }

  startMonitoring(): void {
    if (typeof window === 'undefined' || this.monitoringTimer) return;

    this.monitoringTimer = setInterval(() => {
      this.takeSnapshot();
    }, 1000);
  }

  stopMonitoring(): void {
    if (!this.monitoringTimer) return;

    clearInterval(this.monitoringTimer);
    this.monitoringTimer = null;
  }

  dispose(): void {
    this.stopMonitoring();
    this.snapshots = [];
    this.forceCleanup();
  }

  private takeSnapshot(): void {
    if (typeof window === 'undefined' || !(performance as any).memory) return;

    const memory = (performance as any).memory;
    const snapshot: MemoryStats = {
      usedJSHeapSize: memory.usedJSHeapSize,
      totalJSHeapSize: memory.totalJSHeapSize,
      jsHeapSizeLimit: memory.jsHeapSizeLimit,
      timestamp: Date.now()
    };

    this.snapshots.push(snapshot);
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.shift();
    }

    const usageRatio = snapshot.usedJSHeapSize / snapshot.jsHeapSizeLimit;
    if (usageRatio > 0.9 && Date.now() - this.lastGCWarning > 30000) {
      console.warn('[MemoryManager] 内存使用率超过 90%，建议执行清理');
      this.lastGCWarning = Date.now();
    }
  }

  getCurrentMemory(): MemoryStats | null {
    if (typeof window === 'undefined' || !(performance as any).memory) return null;

    const memory = (performance as any).memory;
    return {
      usedJSHeapSize: memory.usedJSHeapSize,
      totalJSHeapSize: memory.totalJSHeapSize,
      jsHeapSizeLimit: memory.jsHeapSizeLimit,
      timestamp: Date.now()
    };
  }

  getMemoryTrend(): number {
    if (this.snapshots.length < 2) return 0;

    const recent = this.snapshots.slice(-10);
    const avg = recent.reduce((sum, s) => sum + s.usedJSHeapSize, 0) / recent.length;
    const prev = this.snapshots.slice(-20, -10);
    const prevAvg = prev.length > 0
      ? prev.reduce((sum, s) => sum + s.usedJSHeapSize, 0) / prev.length
      : avg;

    return avg - prevAvg;
  }

  registerEventListener(): () => void {
    this.eventListenerCount++;
    return () => {
      this.eventListenerCount--;
    };
  }

  setTemporaryData(key: object, value: unknown): void {
    if (!this.temporaryDataCache.has(key) && value !== undefined) {
      this._tempDataCount++;
    } else if (this.temporaryDataCache.has(key) && value === undefined) {
      this._tempDataCount--;
    }
    this.temporaryDataCache.set(key, value);
  }

  getTemporaryData(key: object): unknown {
    return this.temporaryDataCache.get(key);
  }

  setCombatTempData(key: object, value: unknown): void {
    this.combatTempData.set(key, value);
  }

  getCombatTempData(key: object): unknown {
    return this.combatTempData.get(key);
  }

  clearTemporaryData(): void {
    this.temporaryDataCache = new WeakMap();
    this._tempDataCount = 0;
  }

  clearCombatTempData(): void {
    this.combatTempData = new WeakMap();
    this._combatTempCount = 0;
  }

  getMemorySnapshot(): MemorySnapshot {
    const current = this.getCurrentMemory();
    const combatMem = this.estimateCombatMemory();
    const tempMem = this.estimateTemporaryDataMemory();

    return {
      战斗: combatMem,
      临时数据: tempMem,
      事件监听器: this.eventListenerCount * 1000,
      总计: current?.usedJSHeapSize || 0
    };
  }

  private estimateCombatMemory(): number {
    return this._combatTempCount > 0 ? 50000 : 0;
  }

  private estimateTemporaryDataMemory(): number {
    return this._tempDataCount * 2000;
  }

  forceCleanup(): void {
    this.clearTemporaryData();
    this.clearCombatTempData();
    this.eventListenerCount = 0;
  }

  getFPS(): number {
    if (typeof window === 'undefined') return 0;

    const frameData = (window as any).__fpsData;
    if (!frameData) return 60;

    const now = performance.now();
    const recentFrames = frameData.frames.filter((t: number) => now - t < 1000);
    return recentFrames.length;
  }

  recordFrame(): void {
    if (typeof window === 'undefined') return;

    if (!(window as any).__fpsData) {
      (window as any).__fpsData = { frames: [] };
    }

    const frameData = (window as any).__fpsData;
    frameData.frames.push(performance.now());

    const now = performance.now();
    frameData.frames = frameData.frames.filter((t: number) => now - t < 2000);
  }

  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  getSnapshots(): MemoryStats[] {
    return [...this.snapshots];
  }

  isMemoryLeakSuspected(): boolean {
    if (this.snapshots.length < 30) return false;

    const recent = this.snapshots.slice(-30);
    const trend = recent[recent.length - 1].usedJSHeapSize - recent[0].usedJSHeapSize;
    const avgSize = recent.reduce((sum, s) => sum + s.usedJSHeapSize, 0) / recent.length;

    return trend > avgSize * 0.2;
  }
}

export const memoryManager = MemoryManager.getInstance();
export { MemoryManager };
