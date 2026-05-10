import { AudioManager, type AudioLayer } from '@/features/audio/AudioManager';
import {
  SCENE_MUSIC,
  CHARACTER_THEMES,
  EVENT_MUSIC,
  type SceneType,
} from '@/content/data/musicManifest';

export class MusicEngine {
  private currentScene: SceneType | null = null;
  private currentCharacter: string | null = null;
  private currentEventId: string | null = null;
  private muted = false;
  private masterVolume = 1.0;

  async playScene(scene: SceneType): Promise<void> {
    const track = SCENE_MUSIC[scene];
    if (!track) return;
    await AudioManager.crossfade('scene', track.url, 2.0);
    this.currentScene = scene;
  }

  async playCharacterTheme(characterId: string): Promise<void> {
    const track = CHARACTER_THEMES[characterId];
    if (!track) return;
    await AudioManager.crossfade('character', track.url, 2.5);
    this.currentCharacter = characterId;
  }

  async playEventMusic(eventId: string): Promise<void> {
    const track = EVENT_MUSIC[eventId];
    if (!track) return;
    await AudioManager.crossfade('event', track.url, 1.5);
    this.currentEventId = eventId;
  }

  async stopEventMusic(): Promise<void> {
    AudioManager.stop('event');
    this.currentEventId = null;
  }

  async playAmbient(ambientId: string): Promise<void> {
    const url = `/assets/music/ambient_${ambientId}.mp3`;
    await AudioManager.crossfade('ambient', url, 3.0);
  }

  async stopAmbient(): Promise<void> {
    AudioManager.stop('ambient');
  }

  setMasterVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, Number.isFinite(volume) ? volume : 1));
    if (!this.muted) {
      AudioManager.setMasterVolume(this.masterVolume);
    }
  }

  setSceneVolume(volume: number): void {
    AudioManager.setVolume('scene', volume);
  }

  setCharacterVolume(volume: number): void {
    AudioManager.setVolume('character', volume);
  }

  setEventVolume(volume: number): void {
    AudioManager.setVolume('event', volume);
  }

  mute(): void {
    this.muted = true;
    AudioManager.setMasterVolume(0);
  }

  unmute(): void {
    this.muted = false;
    AudioManager.setMasterVolume(this.masterVolume);
  }

  getCurrentScene(): SceneType | null {
    return this.currentScene;
  }

  getCurrentCharacter(): string | null {
    return this.currentCharacter;
  }

  getCurrentEventId(): string | null {
    return this.currentEventId;
  }

  isMuted(): boolean {
    return this.muted;
  }
}

export const musicEngine = new MusicEngine();
