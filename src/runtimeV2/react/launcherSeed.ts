export const RUNTIME_V2_SEED_STORAGE_KEY = 'deckrogue:runtime-v2:seed';

interface SeedStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function getBrowserStorage(): SeedStorageLike | null {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }
  return window.localStorage;
}

export function coerceRuntimeV2Seed(raw: unknown, fallback: number): number {
  if (raw === null || raw === undefined) {
    return Math.max(0, Math.floor(fallback));
  }
  if (typeof raw === 'string' && raw.trim() === '') {
    return Math.max(0, Math.floor(fallback));
  }
  const parsed = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return Math.max(0, Math.floor(fallback));
  }
  return Math.floor(parsed);
}

export function loadRuntimeV2Seed(fallback: number, storage: SeedStorageLike | null = getBrowserStorage()): number {
  if (!storage) {
    return coerceRuntimeV2Seed(fallback, fallback);
  }
  return coerceRuntimeV2Seed(storage.getItem(RUNTIME_V2_SEED_STORAGE_KEY), fallback);
}

export function saveRuntimeV2Seed(seed: number, storage: SeedStorageLike | null = getBrowserStorage()): number {
  const normalized = coerceRuntimeV2Seed(seed, seed);
  if (storage) {
    storage.setItem(RUNTIME_V2_SEED_STORAGE_KEY, String(normalized));
  }
  return normalized;
}

export function resolveRuntimeV2SeedFromSearch(search: string, fallback: number): number {
  const params = new URLSearchParams(search);
  return coerceRuntimeV2Seed(params.get('seed'), fallback);
}
