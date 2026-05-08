/**
 * @file safeStorage.ts
 * @description 安全存储操作 - 提供防御性 localStorage 访问工具
 *
 * 主要职责:
 * - 实现 isStorageAvailable，检测 localStorage 是否可用
 * - 实现 getStorage，安全获取 localStorage 引用
 * - 提供安全存取操作，防止隐私模式或存储不可用时的错误
 */
const STORAGE_UNAVAILABLE = 'Storage is not available';

export interface StorageResult<T> {
  success: boolean;
  value: T | null;
  error?: string;
}

export function isStorageAvailable(): boolean {
  try {
    const testKey = '__storage_test__';
    const storage = getStorage();
    if (!storage) return false;
    storage.setItem(testKey, testKey);
    storage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

export function getStorage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

export function safeStorageGetString(key: string, defaultValue: string): StorageResult<string> {
  try {
    const storage = getStorage();
    if (!storage) {
      return { success: false, value: defaultValue, error: STORAGE_UNAVAILABLE };
    }

    const raw = storage.getItem(key);
    return { success: true, value: raw ?? defaultValue };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown storage error';
    return { success: false, value: defaultValue, error: errorMessage };
  }
}

export function safeStorageSetString(key: string, value: string): StorageResult<void> {
  try {
    const storage = getStorage();
    if (!storage) {
      return { success: false, value: null, error: STORAGE_UNAVAILABLE };
    }

    storage.setItem(key, value);
    return { success: true, value: null };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown storage error';
    return { success: false, value: null, error: errorMessage };
  }
}

export function safeStorageGet<T>(key: string, defaultValue: T): StorageResult<T> {
  try {
    const storage = getStorage();
    if (!storage) {
      return { success: false, value: defaultValue, error: STORAGE_UNAVAILABLE };
    }

    const raw = storage.getItem(key);
    if (raw === null) {
      return { success: true, value: defaultValue };
    }

    const parsed = JSON.parse(raw);
    return { success: true, value: parsed };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown storage error';
    return { success: false, value: defaultValue, error: errorMessage };
  }
}

export function safeStorageSet<T>(key: string, value: T): StorageResult<void> {
  try {
    const storage = getStorage();
    if (!storage) {
      return { success: false, value: null, error: STORAGE_UNAVAILABLE };
    }

    const serialized = JSON.stringify(value);
    storage.setItem(key, serialized);
    return { success: true, value: null };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown storage error';

    if (errorMessage.includes('quota') || errorMessage.includes('QuotaExceededError')) {
      return { success: false, value: null, error: 'Storage quota exceeded. Please free up some space.' };
    }

    if (errorMessage.includes('permission') || errorMessage.includes('access')) {
      return { success: false, value: null, error: 'Storage access denied. Please check browser permissions.' };
    }

    return { success: false, value: null, error: errorMessage };
  }
}

export function safeStorageRemove(key: string): StorageResult<void> {
  try {
    const storage = getStorage();
    if (!storage) {
      return { success: false, value: null, error: STORAGE_UNAVAILABLE };
    }

    storage.removeItem(key);
    return { success: true, value: null };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown storage error';
    return { success: false, value: null, error: errorMessage };
  }
}

export function safeStorageClear(): StorageResult<void> {
  try {
    const storage = getStorage();
    if (!storage) {
      return { success: false, value: null, error: STORAGE_UNAVAILABLE };
    }

    storage.clear();
    return { success: true, value: null };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown storage error';
    return { success: false, value: null, error: errorMessage };
  }
}

export function getStorageSize(): number {
  try {
    const storage = getStorage();
    if (!storage) return 0;

    let total = 0;
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key) {
        const value = storage.getItem(key);
        if (value) {
          total += key.length + value.length;
        }
      }
    }
    return total * 2; // UTF-16 encoding
  } catch {
    return 0;
  }
}

export function getStorageQuota(): { used: number; available: number } {
  try {
    const used = getStorageSize();
    const available = 5 * 1024 * 1024 - used; // Typical 5MB limit
    return { used, available: Math.max(0, available) };
  } catch {
    return { used: 0, available: 0 };
  }
}

export function withStorageFallback<T>(key: string, getValue: () => T, defaultValue: T): T {
  const result = safeStorageGet<T>(key, defaultValue);
  if (result.success) {
    return result.value ?? defaultValue;
  }

  const newValue = getValue();
  safeStorageSet(key, newValue);
  return newValue;
}
