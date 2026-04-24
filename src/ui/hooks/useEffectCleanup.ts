/**
 * @file useEffectCleanup.ts
 * @description 效果清理 Hooks 工具集 - 提供各类资源清理的标准化 Hooks
 *
 * 主要职责:
 * - 提供事件监听器清理 Hook
 * - 提供定时器清理 Hooks (interval/timeout)
 * - 提供动画帧清理 Hook
 * - 提供弱引用清理 Hook
 */

import { useEffect, useRef, useCallback } from 'react';
import { memoryManager } from '@/core/performance/MemoryManager';

type CleanupFn = () => void;

interface ListenerRegistration {
  unsubscribe: CleanupFn;
}

export function useEffectCleanup(
  effect: () => CleanupFn | void,
  deps?: React.DependencyList
): void {
  useEffect(() => {
    const cleanupFn = effect();
    return () => {
      if (typeof cleanupFn === 'function') {
        cleanupFn();
      }
    };
  }, deps);
}

export function useEventListenerCleanup(): {
  addEventListener: <K extends keyof WindowEventMap>(
    type: K,
    listener: (event: WindowEventMap[K]) => void,
    options?: AddEventListenerOptions
  ) => void;
  addCustomListener: (
    subscribe: () => CleanupFn
  ) => void;
  removeAllListeners: () => void;
} {
  const listenersRef = useRef<CleanupFn[]>([]);

  useEffect(() => {
    return () => {
      listenersRef.current.forEach(cleanup => {
        try {
          cleanup();
        } catch (e) {
          console.warn('[useEventListenerCleanup] 清理监听器失败:', e);
        }
      });
      listenersRef.current = [];
    };
  }, []);

  const addEventListener = useCallback(<K extends keyof WindowEventMap>(
    type: K,
    listener: (event: WindowEventMap[K]) => void,
    options?: AddEventListenerOptions
  ) => {
    window.addEventListener(type, listener, options);
    const cleanup = () => window.removeEventListener(type, listener, options);
    listenersRef.current.push(cleanup);
  }, []);

  const addCustomListener = useCallback((subscribe: () => CleanupFn) => {
    const unregister = memoryManager.registerEventListener();
    const cleanup = () => {
      unregister();
      subscribe();
    };
    listenersRef.current.push(cleanup);
  }, []);

  const removeAllListeners = useCallback(() => {
    listenersRef.current.forEach(cleanup => {
      try {
        cleanup();
      } catch (e) {
        console.warn('[useEventListenerCleanup] 清理监听器失败:', e);
      }
    });
    listenersRef.current = [];
  }, []);

  return { addEventListener, addCustomListener, removeAllListeners };
}

export function useIntervalCleanup(
  callback: () => void,
  delay: number | null
): void {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delay === null) return;

    const id = setInterval(() => savedCallback.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}

export function useTimeoutCleanup(
  callback: () => void,
  delay: number | null
): void {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delay === null) return;

    const id = setTimeout(() => savedCallback.current(), delay);
    return () => clearTimeout(id);
  }, [delay]);
}

export function useAnimationFrameCleanup(
  callback: (deltaTime: number) => void
): void {
  const savedCallback = useRef(callback);
  const frameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    const animate = (time: number) => {
      const deltaTime = time - lastTimeRef.current;
      lastTimeRef.current = time;
      savedCallback.current(deltaTime);
      frameRef.current = requestAnimationFrame(animate);
    };

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, []);
}

export function useWeakRefCleanup<T extends object>(
  key: T,
  cleanup: () => void
): void {
  useEffect(() => {
    memoryManager.setTemporaryData(key, true);
    return () => {
      memoryManager.setTemporaryData(key, undefined);
      cleanup();
    };
  }, [key, cleanup]);
}

export default useEffectCleanup;
