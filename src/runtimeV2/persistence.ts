/**
 * @file persistence.ts
 * @description 存档持久化工具，提供 SaveGameV2 和 ReplayLogV1 的创建、恢复与追加操作
 *
 * 主要职责:
 * - 创建 SaveGameV2 存档并深拷贝快照
 * - 从存档恢复 RuleSnapshot 快照
 * - 创建与追加 ReplayLogV1 回放日志
 */
import type { ReplayLogV1, RuleCommand, RuleRuntimeAdapter, RuleSnapshot, SaveGameV2 } from '@/runtimeV2/contracts';

export function createSaveGameV2(
  snapshot: RuleSnapshot,
  hostPlatform: SaveGameV2['hostPlatform'],
  savedAt = new Date().toISOString(),
): SaveGameV2 {
  return {
    schemaVersion: 2,
    snapshot: structuredClone(snapshot),
    savedAt,
    hostPlatform,
  };
}

export function restoreSnapshotFromSaveGame(saveGame: SaveGameV2): RuleSnapshot {
  return structuredClone(saveGame.snapshot);
}

export function createReplayLogV1(seed: number, commands: RuleCommand[] = []): ReplayLogV1 {
  return {
    schemaVersion: 1,
    seed,
    commands: structuredClone(commands),
  };
}

export function appendReplayCommand(log: ReplayLogV1, command: RuleCommand): ReplayLogV1 {
  return {
    ...log,
    commands: [...log.commands, structuredClone(command)],
  };
}

export async function replayOnAdapter(adapter: RuleRuntimeAdapter, replayLog: ReplayLogV1): Promise<RuleSnapshot> {
  let snapshot = await adapter.start({ seed: replayLog.seed });
  for (const command of replayLog.commands) {
    snapshot = await adapter.dispatch(command);
  }
  return snapshot;
}
