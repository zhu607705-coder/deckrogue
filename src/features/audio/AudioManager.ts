export type AudioLayer = 'scene' | 'character' | 'event' | 'ambient' | 'combat';

export interface LayerNode {
  gainNode: GainNode;
  sourceNode: AudioBufferSourceNode | HTMLAudioElement | null;
  audioElement: HTMLAudioElement | null;
  volume: number;
  isPlaying: boolean;
}

const AUDIO_LAYERS: AudioLayer[] = ['scene', 'character', 'event', 'ambient', 'combat'];

function clampVolume(volume: number): number {
  if (!Number.isFinite(volume)) return 1;
  return Math.max(0, Math.min(1, volume));
}

class AudioManagerImpl {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private layers: Map<AudioLayer, LayerNode> = new Map();
  private audioBuffers: Map<string, AudioBuffer> = new Map();
  private initialized = false;
  private mixToSingleTrackMode = false;
  private masterVolume = 1.0;
  private layerVolumes: Record<AudioLayer, number> = {
    scene: 1.0,
    character: 1.0,
    event: 1.0,
    ambient: 1.0,
    combat: 1.0,
  };
  private transitionIds: Record<AudioLayer, number> = {
    scene: 0,
    character: 0,
    event: 0,
    ambient: 0,
    combat: 0,
  };

  private getAudioContextConstructor(): (new () => AudioContext) | null {
    return (globalThis as any).AudioContext ?? (globalThis as any).webkitAudioContext ?? null;
  }

  private getContext(): AudioContext | null {
    if (!this.context) {
      const AudioContextConstructor = this.getAudioContextConstructor();
      if (!AudioContextConstructor) {
        return null;
      }

      this.context = new AudioContextConstructor();
      this.masterGain = this.context.createGain();
      this.masterGain.gain.value = this.masterVolume;
      this.masterGain.connect(this.context.destination);

      for (const layer of AUDIO_LAYERS) {
        const gainNode = this.context.createGain();
        gainNode.connect(this.masterGain);
        gainNode.gain.value = this.layerVolumes[layer];
        this.layers.set(layer, {
          gainNode,
          sourceNode: null,
          audioElement: null,
          volume: this.layerVolumes[layer],
          isPlaying: false,
        });
      }
      this.initialized = true;
    }
    return this.context;
  }

  async loadAudio(url: string): Promise<AudioBuffer> {
    const cached = this.audioBuffers.get(url);
    if (cached) return cached;

    const ctx = this.getContext();
    if (!ctx) {
      throw new Error('AudioContext is unavailable');
    }
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    this.audioBuffers.set(url, audioBuffer);
    return audioBuffer;
  }

  async play(layer: AudioLayer, url: string, options?: { loop?: boolean; volume?: number }): Promise<void> {
    this.transitionIds[layer] += 1;
    await this.playInternal(layer, url, options);
  }

  private async playInternal(layer: AudioLayer, url: string, options?: { loop?: boolean; volume?: number }): Promise<void> {
    const ctx = this.getContext();
    if (!ctx) return;
    const layerNode = this.layers.get(layer);
    if (!layerNode) return;

    if (layerNode.sourceNode) {
      try {
        if ('stop' in layerNode.sourceNode && typeof layerNode.sourceNode.stop === 'function') {
          (layerNode.sourceNode as AudioBufferSourceNode).stop();
        }
      } catch { /* ignore */ }
    }

    if (layerNode.audioElement) {
      layerNode.audioElement.pause();
      layerNode.audioElement = null;
    }

    try {
      const buffer = await this.loadAudio(url);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = options?.loop ?? true;
      source.connect(layerNode.gainNode);
      source.start(0);

      layerNode.sourceNode = source;
      layerNode.isPlaying = true;
      if (options?.volume !== undefined) {
        this.layerVolumes[layer] = clampVolume(options.volume);
        layerNode.volume = this.layerVolumes[layer];
        layerNode.gainNode.gain.value = layerNode.volume;
      }
    } catch {
      const audio = new Audio(url);
      audio.loop = options?.loop ?? true;
      audio.volume = options?.volume ?? layerNode.volume;
      audio.crossOrigin = 'anonymous';
      const mediaSource = ctx.createMediaElementSource(audio);
      mediaSource.connect(layerNode.gainNode);
      audio.play().catch(() => { /* ignore */ });

      layerNode.sourceNode = null;
      layerNode.audioElement = audio;
      layerNode.isPlaying = true;
    }
  }

  stop(layer: AudioLayer): void {
    const layerNode = this.layers.get(layer);
    if (!layerNode) return;

    if (layerNode.sourceNode) {
      try {
        if ('stop' in layerNode.sourceNode && typeof layerNode.sourceNode.stop === 'function') {
          (layerNode.sourceNode as AudioBufferSourceNode).stop();
        }
      } catch { /* ignore */ }
      layerNode.sourceNode = null;
    }

    if (layerNode.audioElement) {
      layerNode.audioElement.pause();
      layerNode.audioElement = null;
    }

    layerNode.isPlaying = false;
  }

  setVolume(layer: AudioLayer, volume: number): void {
    this.layerVolumes[layer] = clampVolume(volume);
    const layerNode = this.layers.get(layer);
    if (!layerNode) return;
    layerNode.volume = this.layerVolumes[layer];
    layerNode.gainNode.gain.value = layerNode.volume;
  }

  async crossfade(layer: AudioLayer, url: string, duration: number = 2.0): Promise<void> {
    const ctx = this.getContext();
    if (!ctx) return;
    const layerNode = this.layers.get(layer);
    if (!layerNode) return;

    const transitionId = this.transitionIds[layer] + 1;
    this.transitionIds[layer] = transitionId;
    const fadeDuration = Math.max(0, duration / 2);
    const currentTime = ctx.currentTime;

    layerNode.gainNode.gain.setValueAtTime(layerNode.gainNode.gain.value, currentTime);
    layerNode.gainNode.gain.linearRampToValueAtTime(0, currentTime + fadeDuration);

    setTimeout(async () => {
      if (this.transitionIds[layer] !== transitionId) return;
      await this.playInternal(layer, url).catch(() => { /* ignore stale or unavailable audio */ });
      if (this.transitionIds[layer] !== transitionId) return;
      const ln = this.layers.get(layer);
      if (!ln) return;
      ln.gainNode.gain.setValueAtTime(0, ctx.currentTime);
      ln.gainNode.gain.linearRampToValueAtTime(ln.volume, ctx.currentTime + fadeDuration);
    }, fadeDuration * 1000);
  }

  setMasterVolume(volume: number): void {
    this.masterVolume = clampVolume(volume);
    if (this.masterGain) {
      this.masterGain.gain.value = this.masterVolume;
    }
  }

  getMasterGain(): GainNode | null {
    return this.masterGain;
  }

  mixToSingleTrack(): void {
    this.mixToSingleTrackMode = true;
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}

export const AudioManager = new AudioManagerImpl();
