/**
 * @file safeObject.ts
 * @description 安全对象访问 - 提供防御性对象属性访问工具函数
 *
 * 主要职责:
 * - 实现 safeGet，通过路径字符串安全地访问嵌套对象属性
 * - 实现 safeGetString/safeGetNumber/safeGetBoolean，类型安全的属性访问
 * - 防止 null/undefined 或非对象类型导致的运行时错误
 * - 支持点号分隔的路径访问 (如 'player.deck.0.id')
 */
export function safeGet<T>(obj: unknown, path: string, defaultValue: T): T {
  if (!obj || typeof obj !== 'object') return defaultValue;
  
  const keys = path.split('.');
  let current: unknown = obj;
  
  for (const key of keys) {
    if (current === null || current === undefined) return defaultValue;
    if (typeof current !== 'object') return defaultValue;
    
    current = (current as Record<string, unknown>)[key];
  }
  
  return current !== undefined && current !== null ? (current as T) : defaultValue;
}

export function safeGetString(obj: unknown, path: string, defaultValue: string = ''): string {
  const result = safeGet(obj, path, defaultValue);
  return typeof result === 'string' ? result : defaultValue;
}

export function safeGetNumber(obj: unknown, path: string, defaultValue: number = 0): number {
  const result = safeGet(obj, path, defaultValue);
  return typeof result === 'number' && !isNaN(result) ? result : defaultValue;
}

export function safeGetBoolean(obj: unknown, path: string, defaultValue: boolean = false): boolean {
  const result = safeGet(obj, path, defaultValue);
  return typeof result === 'boolean' ? result : defaultValue;
}

export function safeGetArray<T>(obj: unknown, path: string, defaultValue: T[] = []): T[] {
  const result = safeGet(obj, path, defaultValue);
  return Array.isArray(result) ? result : defaultValue;
}

export function safeGetObject<T extends Record<string, unknown>>(obj: unknown, path: string, defaultValue: T = {} as T): T {
  const result = safeGet(obj, path, defaultValue);
  return typeof result === 'object' && result !== null && !Array.isArray(result) ? (result as T) : defaultValue;
}

export function safeInvoke<T, R>(obj: T | null | undefined, fn: (obj: T) => R, defaultValue: R): R {
  if (obj === null || obj === undefined) return defaultValue;
  try {
    return fn(obj);
  } catch {
    return defaultValue;
  }
}

export function safeCall<T extends (...args: unknown[]) => unknown>(fn: T | null | undefined, ...args: Parameters<T>): ReturnType<T> | undefined {
  if (typeof fn !== 'function') return undefined;
  try {
    return fn(...args) as ReturnType<T>;
  } catch {
    return undefined;
  }
}

export function hasProperty(obj: unknown, prop: string): boolean {
  if (!obj || typeof obj !== 'object') return false;
  return prop in (obj as Record<string, unknown>);
}

export function isNonNullObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isEmptyObject(obj: unknown): boolean {
  if (!isNonNullObject(obj)) return true;
  return Object.keys(obj).length === 0;
}
