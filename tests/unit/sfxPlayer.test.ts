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

  exponentialRampToValueAtTime(value: number): void {
    this.value = value;
  }
}

class FakeGainNode {
  gain = new FakeAudioParam();

  connect(): void {
    // Graph wiring is not needed for these state tests.
  }
}

class FakeOscillatorNode {
  type = 'sine';
  frequency = new FakeAudioParam();
  started = false;
  stopped = false;

  connect(): void {
    // Graph wiring is not needed for these state tests.
  }

  start(): void {
    this.started = true;
  }

  stop(): void {
    this.stopped = true;
  }
}

class FakeAudioContext {
  currentTime = 0;
  destination = {};
  sampleRate = 48000;
  state = 'running';
  oscillators: FakeOscillatorNode[] = [];

  createGain(): FakeGainNode {
    return new FakeGainNode();
  }

  createOscillator(): FakeOscillatorNode {
    const oscillator = new FakeOscillatorNode();
    this.oscillators.push(oscillator);
    return oscillator;
  }

  createBuffer(): unknown {
    return { getChannelData: () => new Float32Array(1) };
  }

  createBufferSource(): unknown {
    return {
      buffer: null,
      connect: () => undefined,
      start: () => undefined,
    };
  }

  createBiquadFilter(): unknown {
    return {
      type: 'lowpass',
      frequency: { value: 0 },
      connect: () => undefined,
    };
  }

  async resume(): Promise<void> {
    this.state = 'running';
  }
}

const originalAudioContext = (globalThis as any).AudioContext;
const originalWebkitAudioContext = (globalThis as any).webkitAudioContext;

after(() => {
  (globalThis as any).AudioContext = originalAudioContext;
  (globalThis as any).webkitAudioContext = originalWebkitAudioContext;
});

test('SFXPlayer preserves master volume before lazy initialization and plays known sounds', async () => {
  const contexts: FakeAudioContext[] = [];
  (globalThis as any).AudioContext = class extends FakeAudioContext {
    constructor() {
      super();
      contexts.push(this);
    }
  };
  (globalThis as any).webkitAudioContext = undefined;

  const { SFXPlayer } = await import('../../src/features/audio/SFXPlayer');
  const player = new SFXPlayer();

  player.setMasterVolume(0.35);

  assert.equal(player.isInitialized(), false);
  assert.equal(player.getMasterVolume(), 0.35);
  assert.equal(player.play('attack_hit'), true);
  assert.equal(player.play('ambient_room_shift'), true);
  assert.equal(player.isInitialized(), true);
  assert.equal(contexts[0].oscillators.length, 1);
  assert.equal(contexts[0].oscillators[0].started, true);
});

test('SFXPlayer safely ignores unknown ids and muted categories', async () => {
  (globalThis as any).AudioContext = FakeAudioContext;
  (globalThis as any).webkitAudioContext = undefined;

  const { SFXPlayer } = await import('../../src/features/audio/SFXPlayer');
  const player = new SFXPlayer();

  player.setCategoryVolume('combat', 0);

  assert.equal(player.play('missing_sfx'), false);
  assert.equal(player.play('attack_hit'), false);
});
