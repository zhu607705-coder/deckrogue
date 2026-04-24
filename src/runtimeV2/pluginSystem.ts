/**
 * @file pluginSystem.ts
 * @description UI 插件系统，支持可扩展的插件注册和生命周期管理
 *
 * 主要职责:
 * - 定义 UIPlugin 插件接口（initialize / cleanup / onModelUpdate / onEvent）
 * - 实现 PluginManager 插件管理器
 * - 提供 UISystem 系统接口暴露核心能力
 */
import type { UIModel } from './uiModel';
import type { EventType, UIEvent } from './eventBus';

export interface UIPlugin {
  name: string;
  version: string;
  initialize: (system: UISystem) => void;
  cleanup: () => void;
  onModelUpdate?: (model: UIModel) => void;
  onEvent?: (event: UIEvent) => void;
}

export interface UISystem {
  getContentService: () => any;
  getEventBus: () => any;
  getUIModelManager: () => any;
  subscribe: (type: EventType, listener: (event: UIEvent) => void) => () => void;
  publish: (type: EventType, payload: unknown, metadata?: Record<string, unknown>) => void;
}

export class PluginManager {
  private plugins: Map<string, UIPlugin>;
  private system: UISystem | null;

  constructor() {
    this.plugins = new Map();
    this.system = null;
  }

  register(plugin: UIPlugin): void {
    if (this.plugins.has(plugin.name)) {
      console.warn(`Plugin ${plugin.name} is already registered`);
      return;
    }

    this.plugins.set(plugin.name, plugin);
    console.log(`Plugin ${plugin.name} v${plugin.version} registered`);
  }

  unregister(pluginName: string): void {
    const plugin = this.plugins.get(pluginName);
    if (plugin) {
      plugin.cleanup();
      this.plugins.delete(pluginName);
      console.log(`Plugin ${pluginName} unregistered`);
    }
  }

  initialize(system: UISystem): void {
    this.system = system;

    this.plugins.forEach((plugin) => {
      try {
        plugin.initialize(system);
        console.log(`Plugin ${plugin.name} initialized`);
      } catch (error) {
        console.error(`Failed to initialize plugin ${plugin.name}:`, error);
      }
    });
  }

  cleanup(): void {
    this.plugins.forEach((plugin) => {
      try {
        plugin.cleanup();
        console.log(`Plugin ${plugin.name} cleaned up`);
      } catch (error) {
        console.error(`Failed to cleanup plugin ${plugin.name}:`, error);
      }
    });

    this.plugins.clear();
    this.system = null;
  }

  getPlugin(name: string): UIPlugin | undefined {
    return this.plugins.get(name);
  }

  getAllPlugins(): UIPlugin[] {
    return Array.from(this.plugins.values());
  }

  hasPlugin(name: string): boolean {
    return this.plugins.has(name);
  }

  getPluginCount(): number {
    return this.plugins.size;
  }
}

export interface UIModelVersion {
  major: number;
  minor: number;
  patch: number;
}

export class VersionManager {
  private currentVersion: UIModelVersion;
  private migrations: Map<string, (model: any) => any>;

  constructor() {
    this.currentVersion = { major: 1, minor: 0, patch: 0 };
    this.migrations = new Map();
    this.registerMigrations();
  }

  getCurrentVersion(): UIModelVersion {
    return { ...this.currentVersion };
  }

  migrate(model: any, fromVersion: UIModelVersion): any {
    const versionKey = `${fromVersion.major}.${fromVersion.minor}.${fromVersion.patch}`;
    const migration = this.migrations.get(versionKey);

    if (migration) {
      return migration(model);
    }

    return model;
  }

  private registerMigrations(): void {
    // Migration from 0.1.0 to 1.0.0
    this.migrations.set('0.1.0', (model) => {
      return {
        ...model,
        version: { major: 1, minor: 0, patch: 0 },
        // Add any additional migration logic here
      };
    });

    // Add more migrations as needed
  }

  isCompatible(version: UIModelVersion): boolean {
    return version.major === this.currentVersion.major;
  }

  formatVersion(version: UIModelVersion): string {
    return `${version.major}.${version.minor}.${version.patch}`;
  }

  parseVersion(versionStr: string): UIModelVersion | null {
    const match = versionStr.match(/^(\d+)\.(\d+)\.(\d+)$/);
    if (!match) {
      return null;
    }
    return {
      major: parseInt(match[1], 10),
      minor: parseInt(match[2], 10),
      patch: parseInt(match[3], 10),
    };
  }
}

let globalPluginManager: PluginManager | null = null;
let globalVersionManager: VersionManager | null = null;

export function getPluginManager(): PluginManager {
  if (!globalPluginManager) {
    globalPluginManager = new PluginManager();
  }
  return globalPluginManager;
}

export function getVersionManager(): VersionManager {
  if (!globalVersionManager) {
    globalVersionManager = new VersionManager();
  }
  return globalVersionManager;
}

export function resetPluginManager(): void {
  if (globalPluginManager) {
    globalPluginManager.cleanup();
  }
  globalPluginManager = null;
}

export function resetVersionManager(): void {
  globalVersionManager = null;
}
