/**
 * @file unifiedEngineContext.tsx
 * @description 统一引擎 React 上下文，在 legacy 和 runtimeV2 模式间切换
 *
 * 主要职责:
 * - 提供 UnifiedEngineProvider 上下文组件
 * - 管理引擎模式切换与适配器生命周期
 * - 暴露快照、渲染模型、命令分发等 Hooks
 */
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { GameEngine } from '@/core/events/gameEngine';
import type { EngineHost, RenderModel, RuleCommand, RuleSnapshot } from '@/runtimeV2';
import type { EngineMode, UnifiedEngineAdapter } from '../bridge/unifiedEngineAdapter';
import { createLegacyAdapter, createRuntimeV2Adapter } from '../bridge/unifiedEngineAdapter';

interface UnifiedEngineContextValue {
  mode: EngineMode;
  adapter: UnifiedEngineAdapter | null;
  snapshot: RuleSnapshot | null;
  renderModel: RenderModel | null;
  status: 'idle' | 'starting' | 'ready' | 'error';
  error: Error | null;
  dispatch: (command: RuleCommand) => Promise<void>;
  switchMode: (mode: EngineMode) => void;
  reset: () => void;
}

const UnifiedEngineContext = createContext<UnifiedEngineContextValue | null>(null);

export interface UnifiedEngineProviderProps {
  initialMode?: EngineMode;
  legacyEngine?: GameEngine | null;
  runtimeV2Host?: EngineHost | null;
  children: React.ReactNode;
}

export function UnifiedEngineProvider({
  initialMode = 'legacy',
  legacyEngine: initialLegacyEngine,
  runtimeV2Host: initialRuntimeV2Host,
  children,
}: UnifiedEngineProviderProps) {
  const [mode, setMode] = useState<EngineMode>(initialMode);
  const [adapter, setAdapter] = useState<UnifiedEngineAdapter | null>(() => {
    if (initialMode === 'legacy' && initialLegacyEngine) {
      return createLegacyAdapter(initialLegacyEngine);
    }
    if (initialMode === 'runtimeV2' && initialRuntimeV2Host) {
      return createRuntimeV2Adapter(initialRuntimeV2Host);
    }
    return null;
  });
  const [snapshot, setSnapshot] = useState<RuleSnapshot | null>(null);
  const [renderModel, setRenderModel] = useState<RenderModel | null>(() => {
    return adapter?.renderModel ?? null;
  });
  const [status, setStatus] = useState<'idle' | 'starting' | 'ready' | 'error'>(
    adapter ? 'ready' : 'idle'
  );
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!adapter) {
      setSnapshot(null);
      setRenderModel(null);
      setStatus('idle');
      return;
    }

    setSnapshot(adapter.snapshot);
    setRenderModel(adapter.renderModel);
    setStatus('ready');

    const unsubscribe = adapter.subscribe(() => {
      setSnapshot(adapter.snapshot);
      setRenderModel(adapter.renderModel);
    });

    return unsubscribe;
  }, [adapter]);

  const dispatch = useCallback(
    async (command: RuleCommand) => {
      if (!adapter) {
        console.warn('UnifiedEngineProvider: No adapter available for dispatch');
        return;
      }
      try {
        setError(null);
        await adapter.dispatch(command);
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    },
    [adapter]
  );

  const switchMode = useCallback(
    (newMode: EngineMode) => {
      if (newMode === mode) return;
      
      if (adapter) {
        adapter.dispose();
      }
      
      setMode(newMode);
      setAdapter(null);
      setSnapshot(null);
      setRenderModel(null);
      setStatus('idle');
      setError(null);
    },
    [mode, adapter]
  );

  const reset = useCallback(() => {
    if (adapter) {
      adapter.dispose();
    }
    setAdapter(null);
    setSnapshot(null);
    setRenderModel(null);
    setStatus('idle');
    setError(null);
  }, [adapter]);

  const value = useMemo(
    () => ({
      mode,
      adapter,
      snapshot,
      renderModel,
      status,
      error,
      dispatch,
      switchMode,
      reset,
    }),
    [mode, adapter, snapshot, renderModel, status, error, dispatch, switchMode, reset]
  );

  return (
    <UnifiedEngineContext.Provider value={value}>
      {children}
    </UnifiedEngineContext.Provider>
  );
}

export function useUnifiedEngine(): UnifiedEngineContextValue {
  const context = useContext(UnifiedEngineContext);
  if (!context) {
    throw new Error('useUnifiedEngine must be used within a UnifiedEngineProvider');
  }
  return context;
}

export function useEngineMode(): EngineMode {
  const { mode } = useUnifiedEngine();
  return mode;
}

export function useUnifiedRenderModel(): RenderModel | null {
  const { renderModel } = useUnifiedEngine();
  return renderModel;
}

export function useUnifiedSnapshot(): RuleSnapshot | null {
  const { snapshot } = useUnifiedEngine();
  return snapshot;
}

export function useUnifiedDispatch() {
  const { dispatch } = useUnifiedEngine();
  return dispatch;
}

export function useEngineStatus() {
  const { status, error } = useUnifiedEngine();
  return { status, error };
}
