import test, { after } from 'node:test';
import assert from 'node:assert/strict';

class FakeAudioParam {
  value = 1;

  setValueAtTime(value: number): void {
    this.value = value;
  }

  linearRampToValueAtTime(value: number): void {
    this.value = value;
  }
}

class FakeGainNode {
  gain = new FakeAudioParam();

  connect(): void {
    // WebAudio graph wiring is not needed for these state tests.
  }
}

class FakeBufferSourceNode {
  buffer: unknown = null;
  loop = false;

  connect(): void {
    // WebAudio graph wiring is not needed for these state tests.
  }

  start(): void {
    // Playback is not needed for these state tests.
  }

  stop(): void {
    // Source shutdown is not needed for these state tests.
  }
}

class FakeAudioContext {
  currentTime = 0;
  destination = {};

  createGain(): FakeGainNode {
    return new FakeGainNode();
  }

  createBufferSource(): FakeBufferSourceNode {
    return new FakeBufferSourceNode();
  }

  async decodeAudioData(): Promise<unknown> {
    return {};
  }
}

const originalAudioContext = (globalThis as any).AudioContext;
const originalWebkitAudioContext = (globalThis as any).webkitAudioContext;
const originalFetch = (globalThis as any).fetch;

(globalThis as any).AudioContext = FakeAudioContext;
(globalThis as any).webkitAudioContext = undefined;
(globalThis as any).fetch = async () => ({
  arrayBuffer: async () => new ArrayBuffer(0),
});

after(() => {
  (globalThis as any).AudioContext = originalAudioContext;
  (globalThis as any).webkitAudioContext = originalWebkitAudioContext;
  (globalThis as any).fetch = originalFetch;
});

test('AudioManager preserves master and layer volume set before initialization', async () => {
  const { AudioManager } = await import('../../src/features/audio/AudioManager');

  AudioManager.setMasterVolume(0.35);
  AudioManager.setVolume('event', 0.25);
  await AudioManager.play('event', '/assets/music/test-event.mp3');

  const eventLayer = (AudioManager as any).layers.get('event');
  assert.equal(AudioManager.getMasterGain()?.gain.value, 0.35);
  assert.equal(eventLayer.volume, 0.25);
  assert.equal(eventLayer.gainNode.gain.value, 0.25);
});

test('AudioManager ignores stale crossfade completions', async () => {
  const { AudioManager } = await import('../../src/features/audio/AudioManager');
  const manager = AudioManager as any;
  const originalPlayInternal = manager.playInternal.bind(AudioManager);
  const calls: string[] = [];

  manager.playInternal = async (_layer: string, url: string) => {
    calls.push(url);
  };

  try {
    await AudioManager.crossfade('scene', '/assets/music/old-scene.mp3', 0.01);
    await AudioManager.crossfade('scene', '/assets/music/new-scene.mp3', 0.01);
    await new Promise((resolve) => setTimeout(resolve, 30));

    assert.deepEqual(calls, ['/assets/music/new-scene.mp3']);
  } finally {
    manager.playInternal = originalPlayInternal;
  }
});

test('MusicEngine restores the configured volume after mute', async () => {
  const { AudioManager } = await import('../../src/features/audio/AudioManager');
  const { MusicEngine } = await import('../../src/features/audio/MusicEngine');
  const originalSetMasterVolume = AudioManager.setMasterVolume.bind(AudioManager);
  const calls: number[] = [];

  (AudioManager as any).setMasterVolume = (volume: number) => {
    calls.push(volume);
  };

  try {
    const engine = new MusicEngine();
    engine.setMasterVolume(0.4);
    engine.mute();
    engine.setMasterVolume(0.7);
    engine.unmute();

    assert.deepEqual(calls, [0.4, 0, 0.7]);
  } finally {
    (AudioManager as any).setMasterVolume = originalSetMasterVolume;
  }
});
