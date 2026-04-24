/**
 * @file utils.ts
 * @description 通用工具函数库，提供深比较和哈希生成等辅助函数
 *
 * 主要职责:
 * - 实现 deepEqual 深度对象/数组比较
 * - 实现 generateHash 字符串哈希生成
 * - 为 UI 模型差异检测提供基础工具
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return a === b;
  if (typeof a !== typeof b) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  if (typeof a === 'object' && typeof b === 'object') {
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    const keysA = Object.keys(aObj);
    const keysB = Object.keys(bObj);

    if (keysA.length !== keysB.length) return false;

    for (const key of keysA) {
      if (!keysB.includes(key)) return false;
      if (!deepEqual(aObj[key], bObj[key])) return false;
    }

    return true;
  }

  return false;
}

export function generateHash(obj: unknown): string {
  const seen = new WeakSet();
  let hash = 0;

  function hashValue(val: unknown): void {
    if (val === null) {
      hash = (hash * 31) ^ 0;
      return;
    }

    if (typeof val === 'object') {
      if (seen.has(val)) {
        return;
      }
      seen.add(val);
    }

    const type = typeof val;
    switch (type) {
      case 'string':
        for (let i = 0; i < (val as string).length; i++) {
          hash = (hash * 31) ^ (val as string).charCodeAt(i);
        }
        break;
      case 'number':
        const num = val as number;
        hash = (hash * 31) ^ (num | 0);
        hash = (hash * 31) ^ ((num * 31) | 0);
        break;
      case 'boolean':
        hash = (hash * 31) ^ (val ? 1 : 0);
        break;
      case 'object':
        if (Array.isArray(val)) {
          hash = (hash * 31) ^ 1;
          for (const item of val) {
            hashValue(item);
          }
        } else {
          hash = (hash * 31) ^ 2;
          const obj = val as Record<string, unknown>;
          const keys = Object.keys(obj).sort();
          for (const key of keys) {
            hashValue(key);
            hashValue(obj[key]);
          }
        }
        break;
    }
  }

  hashValue(obj);
  return hash.toString(36);
}
