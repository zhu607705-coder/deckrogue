import { SFX_MANIFEST, SFX_VOLUME, type SoundEffect, type SFXCategory } from '@/content/data/sfxManifest';

export class SFXPlayer {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private categoryVolumes: Record<SFXCategory, number> = { ...SFX_VOLUME };
  private masterVolume = 1;

  private getAudioContext(): AudioContext | null {
    if (!this.context) {
      const AudioContextClass = (globalThis as any).AudioContext ?? (globalThis as any).webkitAudioContext;
      if (!AudioContextClass) return null;

      try {
        this.context = new AudioContextClass();
      } catch {
        return null;
      }
      this.masterGain = this.context.createGain();
      this.masterGain.gain.value = this.masterVolume;
      this.masterGain.connect(this.context.destination);
    }
    if (this.context.state === 'suspended') {
      void this.context.resume().catch(() => undefined);
    }
    return this.context;
  }

  async init(): Promise<void> {
    this.getAudioContext();
  }

  play(sfxId: string): boolean {
    const sfx = SFX_MANIFEST[sfxId];
    if (!sfx) {
      return false;
    }
    return this.playSynth(sfx);
  }

  private playSynth(sfx: SoundEffect): boolean {
    const ctx = this.getAudioContext();
    if (!ctx || !this.masterGain) return false;

    const { synthesis } = sfx;
    const categoryVolume = this.categoryVolumes[sfx.category] ?? 1.0;
    const finalVolume = (synthesis.volume ?? 0.5) * categoryVolume;
    if (finalVolume <= 0) return false;

    // Create oscillator for tonal sounds
    if (synthesis.type !== 'noise') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = synthesis.type;
      osc.frequency.setValueAtTime(synthesis.frequency ?? 440, ctx.currentTime);
      if (synthesis.frequencyEnd !== undefined) {
        osc.frequency.exponentialRampToValueAtTime(
          Math.max(synthesis.frequencyEnd, 1),
          ctx.currentTime + synthesis.duration
        );
      }

      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(finalVolume, ctx.currentTime + (synthesis.attack ?? 0.01));
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + synthesis.duration);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + synthesis.duration + 0.1);
      return true;
    } else {
      // White noise for percussion/impact sounds
      return this.playNoise(synthesis.duration, synthesis.filterFreq, synthesis.filterType, finalVolume);
    }
  }

  private playNoise(
    duration: number,
    filterFreq: number | undefined,
    filterType: 'lowpass' | 'highpass' | 'bandpass' | undefined,
    volume: number
  ): boolean {
    const ctx = this.getAudioContext();
    if (!ctx || !this.masterGain) return false;

    const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    if (filterFreq) {
      const filter = ctx.createBiquadFilter();
      filter.type = filterType ?? 'lowpass';
      filter.frequency.value = filterFreq;
      source.connect(filter);
      filter.connect(gain);
    } else {
      source.connect(gain);
    }

    gain.connect(this.masterGain);
    source.start(ctx.currentTime);
    return true;
  }

  setCategoryVolume(category: SFXCategory, volume: number): void {
    this.categoryVolumes[category] = Math.max(0, Math.min(1, volume));
  }

  setMasterVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, Number.isFinite(volume) ? volume : 1));
    if (this.masterGain) {
      this.masterGain.gain.value = this.masterVolume;
    }
  }

  getMasterVolume(): number {
    return this.masterVolume;
  }

  isInitialized(): boolean {
    return this.context !== null;
  }
}

export const sfxPlayer = new SFXPlayer();
