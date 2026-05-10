import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { MusicDispatcher } from '@/core/events/MusicDispatcher';
import { globalEventBus } from '@/core/events/eventBus';
import { musicEngine } from '@/features/audio/MusicEngine';
import { sfxPlayer } from '@/features/audio/SFXPlayer';

function fakeEngine(nodeType: string = 'Boss'): any {
  return {
    state: {
      currentNodeId: 'node_1',
      map: [{ id: 'node_1', type: nodeType }],
    },
  };
}

afterEach(() => {
  globalEventBus.clear();
});

test('MusicDispatcher wires global combat events to music and SFX playback', () => {
  globalEventBus.clear();

  const playedSfx: string[] = [];
  const playedScenes: string[] = [];
  const originalPlaySfx = sfxPlayer.play.bind(sfxPlayer);
  const originalPlayScene = musicEngine.playScene.bind(musicEngine);

  (sfxPlayer as any).play = (id: string) => {
    playedSfx.push(id);
    return true;
  };
  (musicEngine as any).playScene = async (scene: string) => {
    playedScenes.push(scene);
  };

  const dispatcher = new MusicDispatcher(fakeEngine('Boss'));

  try {
    globalEventBus.publish({ type: 'CombatStart' } as any);
    globalEventBus.publish({ type: 'CombatVictory' } as any);
    globalEventBus.publish({ type: 'PlayerDeath' } as any);

    assert.deepEqual(playedScenes, ['CombatBoss', 'Victory', 'GameOver']);
    assert.deepEqual(playedSfx, ['turn_start', 'enemy_death', 'player_death']);
  } finally {
    dispatcher.dispose();
    (sfxPlayer as any).play = originalPlaySfx;
    (musicEngine as any).playScene = originalPlayScene;
  }
});

test('MusicDispatcher wires gameplay telemetry to procedural SFX', () => {
  globalEventBus.clear();

  const playedSfx: string[] = [];
  const originalPlaySfx = sfxPlayer.play.bind(sfxPlayer);
  (sfxPlayer as any).play = (id: string) => {
    playedSfx.push(id);
    return true;
  };

  const dispatcher = new MusicDispatcher(fakeEngine('Normal'));

  try {
    globalEventBus.publish({ type: 'CardPlayed', cardId: 'strike', cardType: 'Attack' } as any);
    globalEventBus.publish({ type: 'CardDrawn', cardId: 'strike' } as any);
    globalEventBus.publish({ type: 'DamageDealt', amount: 6, targetType: 'enemy', targetId: 'e1' } as any);
    globalEventBus.publish({ type: 'DamageReceived', amount: 3, sourceType: 'enemy' } as any);
    globalEventBus.publish({ type: 'BlockGained', amount: 5 } as any);
    globalEventBus.publish({ type: 'RelicAcquired', relicId: 'anchor' } as any);

    assert.deepEqual(playedSfx, [
      'card_play',
      'card_draw',
      'attack_hit',
      'damage_taken',
      'block_success',
      'relic_pickup',
    ]);
  } finally {
    dispatcher.dispose();
    (sfxPlayer as any).play = originalPlaySfx;
  }
});
