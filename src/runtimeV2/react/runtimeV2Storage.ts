import type { ReplayLogV1, SaveGameV2 } from '@/runtimeV2/contracts';

export const RUNTIME_V2_SAVE_STORAGE_KEY = 'deckrogue:runtime-v2:save';
export const RUNTIME_V2_REPLAY_STORAGE_KEY = 'deckrogue:runtime-v2:replay';

interface RuntimeV2StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function getBrowserStorage(): RuntimeV2StorageLike | null {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }
  return window.localStorage;
}

function parseJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function loadRuntimeV2SaveGame(storage: RuntimeV2StorageLike | null = getBrowserStorage()): SaveGameV2 | null {
  const save = parseJson<SaveGameV2>(storage?.getItem(RUNTIME_V2_SAVE_STORAGE_KEY) ?? null);
  if (!save || save.schemaVersion !== 2 || !save.snapshot) {
    return null;
  }
  return save;
}

export function saveRuntimeV2SaveGame(saveGame: SaveGameV2, storage: RuntimeV2StorageLike | null = getBrowserStorage()): SaveGameV2 {
  if (storage) {
    storage.setItem(RUNTIME_V2_SAVE_STORAGE_KEY, JSON.stringify(saveGame));
  }
  return saveGame;
}

export function loadRuntimeV2ReplayLog(storage: RuntimeV2StorageLike | null = getBrowserStorage()): ReplayLogV1 | null {
  const replay = parseJson<ReplayLogV1>(storage?.getItem(RUNTIME_V2_REPLAY_STORAGE_KEY) ?? null);
  if (!replay || replay.schemaVersion !== 1 || !Array.isArray(replay.commands)) {
    return null;
  }
  return replay;
}

export function saveRuntimeV2ReplayLog(replayLog: ReplayLogV1, storage: RuntimeV2StorageLike | null = getBrowserStorage()): ReplayLogV1 {
  if (storage) {
    storage.setItem(RUNTIME_V2_REPLAY_STORAGE_KEY, JSON.stringify(replayLog));
  }
  return replayLog;
}
