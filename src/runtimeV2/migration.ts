/**
 * @file migration.ts
 * @description 旧版存档迁移工具，将遗留存档数据转换为 SaveGameV2 格式
 *
 * 主要职责:
 * - 从旧版存档数据中提取种子并重建 GameEngine
 * - 通过 normalizeLegacyGameState 规范化遗留游戏状态
 * - 生成符合 V2 格式的 SaveGameV2 存档
 */
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
