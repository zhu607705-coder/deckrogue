import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { EngineHost, RenderModel, RuleCommand, RuleSnapshot, EngineHostStartOptions } from '../index';

interface EngineHostContextValue {
  host: EngineHost | null;
  snapshot: RuleSnapshot | null;
  renderModel: RenderModel | null;
  status: 'idle' | 'starting' | 'ready' | 'error';
  error: Error | null;
  dispatch: (command: RuleCommand) => Promise<void>;
  start: (options?: EngineHostStartOptions) => Promise<void>;
  reset: () => void;
}

const EngineHostContext = createContext<EngineHostContextValue | null>(null);

export interface EngineHostProviderProps {
  host: EngineHost;
  children: React.ReactNode;
}

export function EngineHostProvider({ host, children }: EngineHostProviderProps) {
  const [snapshot, setSnapshot] = useState<RuleSnapshot | null>(null);
  const [renderModel, setRenderModel] = useState<RenderModel | null>(null);
  const [status, setStatus] = useState<'idle' | 'starting' | 'ready' | 'error'>('idle');
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const unsubscribe = host.subscribe((newSnapshot) => {
      setSnapshot(newSnapshot);
      setRenderModel(host.getRenderModel());
      setStatus('ready');
    });

    const unsubscribeRender = host.subscribeRenderModel((newRenderModel) => {
      setRenderModel(newRenderModel);
    });

    return () => {
      unsubscribe();
      unsubscribeRender();
    };
  }, [host]);

  const start = useCallback(async (options?: EngineHostStartOptions) => {
    if (status === 'starting') return;
    setStatus('starting');
    setError(null);
    try {
      await host.start(options);
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err : new Error(String(err)));
    }
  }, [host, status]);

  const dispatch = useCallback(async (command: RuleCommand) => {
    try {
      await host.dispatch(command);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    }
  }, [host]);

  const reset = useCallback(() => {
    host.dispose();
    setSnapshot(null);
    setRenderModel(null);
    setStatus('idle');
    setError(null);
  }, [host]);

  return (
    <EngineHostContext.Provider value={{ host, snapshot, renderModel, status, error, dispatch, start, reset }}>
      {children}
    </EngineHostContext.Provider>
  );
}

export function useEngineHost(): EngineHostContextValue {
  const context = useContext(EngineHostContext);
  if (!context) {
    throw new Error('useEngineHost must be used within an EngineHostProvider');
  }
  return context;
}

export function useRenderModel(): RenderModel | null {
  const { renderModel } = useEngineHost();
  return renderModel;
}

export function useSnapshot(): RuleSnapshot | null {
  const { snapshot } = useEngineHost();
  return snapshot;
}

export function useStatus(): EngineHostContextValue['status'] {
  const { status } = useEngineHost();
  return status;
}

export function useDispatch() {
  const { dispatch } = useEngineHost();
  return dispatch;
}
