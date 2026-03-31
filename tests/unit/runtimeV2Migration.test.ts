import test from 'node:test';
import assert from 'node:assert/strict';

import { GameEngine } from '@/core/events/gameEngine';
import { migrateLegacySaveDataToSaveGameV2, restoreSnapshotFromSaveGame } from '@/runtimeV2';

test('migrateLegacySaveDataToSaveGameV2 converts legacy save payloads into compat-free SaveGameV2 snapshots', () => {
  const engine = new GameEngine(77, null);
  try {
    engine.selectCharacter('informant');
    const legacySaveData = engine.getSaveData();

    const migrated = migrateLegacySaveDataToSaveGameV2(legacySaveData, 'web', '2026-03-12T11:00:00.000Z');
    const snapshot = restoreSnapshotFromSaveGame(migrated);

    assert.equal(migrated.schemaVersion, 2);
    assert.equal(migrated.hostPlatform, 'web');
    assert.equal(migrated.savedAt, '2026-03-12T11:00:00.000Z');
    assert.equal(snapshot.player.characterId, 'informant');
    assert.equal(snapshot.seed, 77);
    assert.equal(snapshot.compat, undefined);
  } finally {
    engine.dispose();
  }
});
