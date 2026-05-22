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
import { globalEventBus, type GameEvent } from '@/core/events/eventBus';

type HostListener = (snapshot: RuleSnapshot) => void;
type RenderListener = (renderModel: RenderModel) => void;

export interface EngineHostDispatchOptions {
  throwOnFailure?: boolean;
}

export class DispatchFailedError extends Error {
  constructor(
    public readonly commandType: RuleCommand['type'],
    public readonly events: RuleResult['events'],
    public readonly source: RuleRuntimeAdapter['source'],
    public override readonly cause: unknown,
    public readonly result?: RuleResult
  ) {
    const causeMessage = cause instanceof Error ? cause.message : String(cause);
    super(`Dispatch ${commandType} failed: ${causeMessage}`, { cause });
    this.name = 'DispatchFailedError';
  }
}

function stripSnapshotForDiff(snapshot: RuleSnapshot | null): unknown {
  if (!snapshot) return null;
  const { compat: _compat, ...rest } = snapshot;
  return rest;
}

function hasStableId(value: unknown): value is { id: string } {
  return !!value && typeof value === 'object' && typeof (value as { id?: unknown }).id === 'string';
}

function mapByStableId(values: Array<{ id: string }>): Map<string, { id: string }> | null {
  const byId = new Map<string, { id: string }>();
  for (const value of values) {
    if (byId.has(value.id)) {
      return null;
    }
    byId.set(value.id, value);
  }
  return byId;
}

function appendPath(basePath: string, suffix: string): string {
  return basePath ? `${basePath}.${suffix}` : suffix;
}

function keyedArrayPath(basePath: string, id: string): string {
  const encodedId = encodeURIComponent(id);
  return basePath ? `${basePath}[id=${encodedId}]` : `[id=${encodedId}]`;
}

function diffStableIdArray(
  before: Array<{ id: string }>,
  after: Array<{ id: string }>,
  basePath: string,
  out: string[]
): void {
  const beforeById = mapByStableId(before);
  const afterById = mapByStableId(after);
  if (!beforeById || !afterById) {
    out.push(basePath);
    return;
  }

  const beforeIds = before.map((entry) => entry.id);
  const afterIds = after.map((entry) => entry.id);
  const sameIds = beforeById.size === afterById.size && beforeIds.every((id) => afterById.has(id));
  if (!sameIds) {
    out.push(appendPath(basePath, '$ids'));
  }

  if (sameIds && beforeIds.some((id, index) => id !== afterIds[index])) {
    out.push(appendPath(basePath, '$order'));
  }

  for (const id of beforeIds) {
    const afterEntry = afterById.get(id);
    if (!afterEntry) continue;
    diffValues(beforeById.get(id), afterEntry, keyedArrayPath(basePath, id), out);
  }
}

function diffValues(before: unknown, after: unknown, basePath: string, out: string[]): void {
  if (Object.is(before, after)) return;
  if (Array.isArray(before) && Array.isArray(after)) {
    if (before.every(hasStableId) && after.every(hasStableId)) {
      diffStableIdArray(before, after, basePath, out);
      return;
    }
    if (before.length !== after.length) {
      out.push(basePath);
      return;
    }
    for (let index = 0; index < before.length; index += 1) {
      diffValues(before[index], after[index], basePath ? `${basePath}.${index}` : String(index), out);
    }
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

function createRuleResultError(error: unknown, commandType: RuleCommand['type']): NonNullable<RuleResult['error']> {
  return {
    name: error instanceof Error ? error.name : typeof error,
    message: error instanceof Error ? error.message : String(error),
    commandType
  };
}

export class EngineHost {
  private snapshot: RuleSnapshot | null = null;
  private listeners = new Set<HostListener>();
  private renderListeners = new Set<RenderListener>();
  private adapterUnsubscribe: (() => void) | null = null;
  private disposed = false;
  private dispatchDepth = 0;

  constructor(private readonly adapter: RuleRuntimeAdapter) {}

  getAdapter(): RuleRuntimeAdapter {
    return this.adapter;
  }

  async start(options: EngineHostStartOptions = {}): Promise<RuleSnapshot> {
    this.disposed = false;
    if (this.adapterUnsubscribe) {
      this.adapterUnsubscribe();
      this.adapterUnsubscribe = null;
    }
    this.snapshot = await this.adapter.start(options);
    const startupSnapshot = this.snapshot;
    let startupSnapshotDelivered = false;
    if (this.adapter.subscribe) {
      this.adapterUnsubscribe = this.adapter.subscribe((snapshot) => {
        if (this.disposed) return;
        if (this.dispatchDepth > 0) {
          return;
        }
        if (startupSnapshotDelivered && snapshot === startupSnapshot) {
          return;
        }
        this.snapshot = snapshot;
        startupSnapshotDelivered = true;
        this.emit(snapshot);
      });
    }
    if (!startupSnapshotDelivered) {
      startupSnapshotDelivered = true;
      this.emit(this.snapshot);
    }
    return this.snapshot;
  }

  async dispatch(command: RuleCommand, options: EngineHostDispatchOptions = {}): Promise<RuleResult> {
    if (this.disposed) {
      throw new Error('EngineHost is disposed');
    }
    const before = this.snapshot;
    const startedAt = performance.now();
    const events: RuleResult['events'] = [{ type: `runtime.${command.type}`, payload: { source: this.adapter.source } }];
    const unsubscribeEvents = globalEventBus.subscribeAll((event: GameEvent) => {
      events.push({
        type: event.type,
        payload: Object.fromEntries(
          Object.entries(event).filter(([key]) => key !== 'type')
        )
      });
    });
    this.dispatchDepth += 1;

    try {
      const snapshot = await this.adapter.dispatch(command);
      if (this.disposed) {
        throw new Error('EngineHost was disposed during dispatch');
      }
      const dispatchMs = Number((performance.now() - startedAt).toFixed(3));
      const diff = createDiff(before, snapshot);
      this.snapshot = snapshot;
      this.emit(snapshot);
      return {
        ok: true,
        snapshot,
        diff,
        events,
        timings: { dispatchMs },
        source: this.adapter.source
      };
    } catch (error) {
      if (!this.disposed) {
        this.snapshot = before;
        if (before) {
          this.emit(before);
          const dispatchMs = Number((performance.now() - startedAt).toFixed(3));
          const result: RuleResult = {
            ok: false,
            snapshot: before,
            diff: createDiff(before, before),
            events: [...events],
            timings: { dispatchMs },
            source: this.adapter.source,
            error: createRuleResultError(error, command.type)
          };
          if (options.throwOnFailure) {
            throw new DispatchFailedError(command.type, result.events, this.adapter.source, error, result);
          }
          return result;
        }
        throw new DispatchFailedError(command.type, [...events], this.adapter.source, error);
      }
      throw error;
    } finally {
      this.dispatchDepth = Math.max(0, this.dispatchDepth - 1);
      unsubscribeEvents();
    }
  }

  getSnapshot(): RuleSnapshot | null {
    return this.snapshot;
  }

  getRenderModel(): RenderModel | null {
    return this.snapshot ? createRenderModel(this.snapshot) : null;
  }

  subscribe(listener: HostListener): () => void {
    this.listeners.add(listener);
    if (this.snapshot && this.dispatchDepth === 0 && !this.disposed) listener(this.snapshot);
    return () => {
      this.listeners.delete(listener);
    };
  }

  subscribeRenderModel(listener: RenderListener): () => void {
    this.renderListeners.add(listener);
    if (this.snapshot && this.dispatchDepth === 0 && !this.disposed) {
      listener(createRenderModel(this.snapshot));
    }
    return () => {
      this.renderListeners.delete(listener);
    };
  }

  dispose(): void {
    this.disposed = true;
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
