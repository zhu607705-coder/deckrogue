export function safeArrayAccess<T>(array: T[] | undefined | null, index: number): T | undefined {
  if (!array || !Array.isArray(array)) return undefined;
  if (index < 0 || index >= array.length) return undefined;
  return array[index];
}

export function safeArrayAccessWithDefault<T>(array: T[] | undefined | null, index: number, defaultValue: T): T {
  const result = safeArrayAccess(array, index);
  return result !== undefined ? result : defaultValue;
}

export function safeArrayFirst<T>(array: T[] | undefined | null): T | undefined {
  return safeArrayAccess(array, 0);
}

export function safeArrayLast<T>(array: T[] | undefined | null): T | undefined {
  if (!array || array.length === 0) return undefined;
  return safeArrayAccess(array, array.length - 1);
}

export function safeArraySlice<T>(array: T[] | undefined | null, start: number, end?: number): T[] {
  if (!array || !Array.isArray(array)) return [];
  const safeStart = Math.max(0, Math.min(start, array.length));
  const safeEnd = end !== undefined ? Math.max(safeStart, Math.min(end, array.length)) : array.length;
  return array.slice(safeStart, safeEnd);
}

export function safeArrayFind<T>(array: T[] | undefined | null, predicate: (item: T) => boolean): T | undefined {
  if (!array || !Array.isArray(array)) return undefined;
  return array.find(predicate);
}

export function safeArrayFilter<T>(array: T[] | undefined | null, predicate: (item: T) => boolean): T[] {
  if (!array || !Array.isArray(array)) return [];
  return array.filter(predicate);
}

export function safeArrayMap<T, U>(array: T[] | undefined | null, mapper: (item: T, index: number) => U): U[] {
  if (!array || !Array.isArray(array)) return [];
  return array.map(mapper);
}

export function safeArrayReduce<T, U>(array: T[] | undefined | null, reducer: (acc: U, item: T, index: number) => U, initialValue: U): U {
  if (!array || !Array.isArray(array)) return initialValue;
  return array.reduce(reducer, initialValue);
}

export function safeArrayLength(array: unknown[] | undefined | null): number {
  if (!array || !Array.isArray(array)) return 0;
  return array.length;
}

export function safeArrayIncludes<T>(array: T[] | undefined | null, item: T): boolean {
  if (!array || !Array.isArray(array)) return false;
  return array.includes(item);
}

export function safeArrayIndexOf<T>(array: T[] | undefined | null, item: T): number {
  if (!array || !Array.isArray(array)) return -1;
  return array.indexOf(item);
}

export function clampIndex(index: number, arrayLength: number): number {
  if (arrayLength <= 0) return 0;
  return Math.max(0, Math.min(index, arrayLength - 1));
}

export function isValidArrayIndex(index: number, arrayLength: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < arrayLength;
}
