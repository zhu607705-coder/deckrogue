/**
 * @file engineHost.ts
 * @description 引擎主机适配器，提供快照订阅、差异计算和渲染模型更新的统一入口
 *
 * 主要职责:
 * - 管理快照监听器并触发渲染模型更新
 * - 实现快照差异计算检测状态变化
 * - 代理底层 RuleRuntimeAdapter 的启动与命令分发
 */
import type { EngineHostStartOptions, RenderModel, RuleCommand, RuleDiff, RuleResult, RuleRuntimeAdapter, RuleSnapshot } from '@/runtimeV2/contracts';
import { createRenderModel } from '@/runtimeV2/renderModel';

type HostListener = (snapshot: RuleSnapshot) => void;
type RenderListener = (renderModel: RenderModel) => void;

function stripSnapshotForDiff(snapshot: RuleSnapshot | null): unknown {
  if (!snapshot) return null;
  const { compat: _compat, ...rest } = snapshot;
  return rest;
}

function diffValues(before: unknown, after: unknown, basePath: string, out: string[]): void {
  if (Object.is(before, after)) return;
  if (Array.isArray(before) && Array.isArray(after)) {
    if (JSON.stringify(before) !== JSON.stringify(after)) out.push(basePath);
    return;
  }
  if (
    before &&
    after &&
    typeof before === 'object' &&
    typeof after === 'object'
  ) {
    const keys = new Set([...Object.keys(before as Record<string, unknown>), ...Object.keys(after as Record<string, unknown>)]);
    for (const key of keys) {
      diffValues(
        (before as Record<string, unknown>)[key],
        (after as Record<string, unknown>)[key],
        basePath ? `${basePath}.${key}` : key,
        out
      );
    }
    return;
  }
  out.push(basePath);
}

function createDiff(previous: RuleSnapshot | null, next: RuleSnapshot): RuleDiff {
  if (!previous) return { changedPaths: ['$boot'] };
  const changedPaths: string[] = [];
  diffValues(stripSnapshotForDiff(previous), stripSnapshotForDiff(next), '', changedPaths);
  return {
    changedPaths: Array.from(new Set(changedPaths.filter(Boolean))).sort()
  };
}

export class EngineHost {
  private snapshot: RuleSnapshot | null = null;
  private listeners = new Set<HostListener>();
  private renderListeners = new Set<RenderListener>();
  private adapterUnsubscribe: (() => void) | null = null;

  constructor(private readonly adapter: RuleRuntimeAdapter) {}

  getAdapter(): RuleRuntimeAdapter {
    return this.adapter;
  }

  async start(options: EngineHostStartOptions = {}): Promise<RuleSnapshot> {
    this.snapshot = await this.adapter.start(options);
    if (this.adapter.subscribe) {
      this.adapterUnsubscribe = this.adapter.subscribe((snapshot) => {
        this.snapshot = snapshot;
        this.emit(snapshot);
      });
    }
    this.emit(this.snapshot);
    return this.snapshot;
  }

  async dispatch(command: RuleCommand): Promise<RuleResult> {
    const before = this.snapshot;
    const startedAt = performance.now();
    const snapshot = await this.adapter.dispatch(command);
    const dispatchMs = Number((performance.now() - startedAt).toFixed(3));
    const diff = createDiff(before, snapshot);
    this.snapshot = snapshot;
    this.emit(snapshot);
    return {
      snapshot,
      diff,
      events: [{ type: `runtime.${command.type}`, payload: { source: this.adapter.source } }],
      timings: { dispatchMs },
      source: this.adapter.source
    };
  }

  getSnapshot(): RuleSnapshot | null {
    return this.snapshot;
  }

  getRenderModel(): RenderModel | null {
    return this.snapshot ? createRenderModel(this.snapshot) : null;
  }

  subscribe(listener: HostListener): () => void {
    this.listeners.add(listener);
    if (this.snapshot) listener(this.snapshot);
    return () => {
      this.listeners.delete(listener);
    };
  }

  subscribeRenderModel(listener: RenderListener): () => void {
    this.renderListeners.add(listener);
    if (this.snapshot) {
      listener(createRenderModel(this.snapshot));
    }
    return () => {
      this.renderListeners.delete(listener);
    };
  }

  dispose(): void {
    if (this.adapterUnsubscribe) {
      this.adapterUnsubscribe();
      this.adapterUnsubscribe = null;
    }
    this.adapter.dispose();
    this.listeners.clear();
    this.renderListeners.clear();
    this.snapshot = null;
  }

  private emit(snapshot: RuleSnapshot): void {
    const renderModel = createRenderModel(snapshot);
    for (const listener of this.listeners) {
      listener(snapshot);
    }
    for (const listener of this.renderListeners) {
      listener(renderModel);
    }
  }
}

export function createEngineHost(adapter: RuleRuntimeAdapter): EngineHost {
  return new EngineHost(adapter);
}
