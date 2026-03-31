import { GameEngine } from '@/core/events/gameEngine';
import type { SaveGameV2 } from '@/runtimeV2/contracts';
import { createSaveGameV2 } from '@/runtimeV2/persistence';
import { normalizeLegacyGameState } from '@/runtimeV2/normalizeLegacyGameState';

export function migrateLegacySaveDataToSaveGameV2(
  legacySaveData: object,
  hostPlatform: SaveGameV2['hostPlatform'] = 'web',
  savedAt?: string,
): SaveGameV2 {
  const legacySeed = (() => {
    const record = legacySaveData as { state?: { seed?: number }; metadata?: { seed?: number } };
    return record.state?.seed ?? record.metadata?.seed ?? 0;
  })();

  const engine = new GameEngine(legacySeed, null);
  try {
    engine.loadSaveData(legacySaveData);
    const snapshot = normalizeLegacyGameState(engine.state);
    return createSaveGameV2(snapshot, hostPlatform, savedAt);
  } finally {
    engine.dispose();
  }
}
