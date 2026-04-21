import test from 'node:test';
import assert from 'node:assert/strict';

import {
  RUNTIME_V2_SEED_STORAGE_KEY,
  coerceRuntimeV2Seed,
  loadRuntimeV2Seed,
  resolveRuntimeV2SeedFromSearch,
  saveRuntimeV2Seed,
} from '@/runtimeV2/react/launcherSeed';

function createStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  };
}

test('coerceRuntimeV2Seed normalizes invalid values to the provided fallback', () => {
  assert.equal(coerceRuntimeV2Seed(undefined, 7), 7);
  assert.equal(coerceRuntimeV2Seed(null, 7), 7);
  assert.equal(coerceRuntimeV2Seed('', 7), 7);
  assert.equal(coerceRuntimeV2Seed('abc', 7), 7);
  assert.equal(coerceRuntimeV2Seed('-5', 7), 7);
});

test('coerceRuntimeV2Seed floors decimal input into a non-negative integer seed', () => {
  assert.equal(coerceRuntimeV2Seed('42.8', 7), 42);
  assert.equal(coerceRuntimeV2Seed(19.9, 7), 19);
});

test('loadRuntimeV2Seed prefers persisted launcher seeds when available', () => {
  const storage = createStorage({ [RUNTIME_V2_SEED_STORAGE_KEY]: '123456' });
  assert.equal(loadRuntimeV2Seed(7, storage), 123456);
});

test('saveRuntimeV2Seed writes the normalized seed back to storage', () => {
  const storage = createStorage();
  saveRuntimeV2Seed(99.8, storage);
  assert.equal(storage.getItem(RUNTIME_V2_SEED_STORAGE_KEY), '99');
});

test('resolveRuntimeV2SeedFromSearch prefers explicit URL seeds over the fallback', () => {
  assert.equal(resolveRuntimeV2SeedFromSearch('?runtimeV2=1&seed=2468', 7), 2468);
  assert.equal(resolveRuntimeV2SeedFromSearch('?seed=12.9', 7), 12);
  assert.equal(resolveRuntimeV2SeedFromSearch('?seed=abc', 7), 7);
});
