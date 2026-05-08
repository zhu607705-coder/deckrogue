import { musicEngine } from '@/features/audio/MusicEngine';
import { globalEventBus } from '@/core/events/eventBus';
import type { GameEngine } from '@/core/events/gameEngine';
import type { SceneType } from '@/content/data/musicManifest';

export class MusicDispatcher {
  private engine: GameEngine;
  private lastScreen: string = '';
  private lastEventId: string | null = null;
  private disposables: Array<() => void> = [];

  constructor(engine: GameEngine) {
    this.engine = engine;
    this.setupGlobalListeners();
  }

  private setupGlobalListeners(): void {
    this.disposables.push(globalEventBus.subscribe('CombatStart', () => {
      const node = this.engine.state.map.find(
        (n) => n.id === this.engine.state.currentNodeId
      );
      if (node?.type === 'Boss') {
        musicEngine.playScene('CombatBoss');
      } else if (node?.type === 'Elite') {
        musicEngine.playScene('CombatElite');
      } else {
        musicEngine.playScene('CombatNormal');
      }
    }));

    this.disposables.push(globalEventBus.subscribe('CombatVictory', () => {
      musicEngine.playScene('Victory');
    }));

    this.disposables.push(globalEventBus.subscribe('PlayerDeath', () => {
      musicEngine.playScene('GameOver');
    }));
  }

  onScreenChange(screen: string): void {
    if (screen === this.lastScreen) return;
    this.lastScreen = screen;

    const sceneMap: Partial<Record<string, SceneType>> = {
      CharacterSelect: 'CharacterSelect',
      Map: 'MapExplore',
      Event: 'Event',
      Shop: 'Shop',
      Rest: 'Rest',
      Reward: 'Reward',
      Victory: 'Victory',
      GameOver: 'GameOver',
      Tutorial: 'CharacterSelect',
      Upgrade: 'Rest',
      RemoveCard: 'Rest',
      Enchant: 'Rest',
      RelicUpgrade: 'Rest',
    };

    const scene = sceneMap[screen];
    if (scene) {
      musicEngine.playScene(scene);
    }

    if (screen === 'CharacterSelect') {
      musicEngine.stopEventMusic();
    }
  }

  onCharacterSelected(characterId: string): void {
    musicEngine.playCharacterTheme(characterId);
  }

  onEventStart(eventId: string): void {
    this.lastEventId = eventId;
    musicEngine.playEventMusic(eventId);
  }

  onEventEnd(): void {
    musicEngine.stopEventMusic();
    this.lastEventId = null;
  }

  onBossEncounter(nodeId: string): void {
    musicEngine.playScene('CombatBoss');
  }

  onEliteEncounter(nodeId: string): void {
    musicEngine.playScene('CombatElite');
  }

  onNormalCombat(nodeId: string): void {
    musicEngine.playScene('CombatNormal');
  }

  mute(): void {
    musicEngine.mute();
  }

  unmute(): void {
    musicEngine.unmute();
  }

  setVolume(volume: number): void {
    musicEngine.setMasterVolume(volume);
  }

  setLayerVolume(layer: 'scene' | 'character' | 'event' | 'ambient', volume: number): void {
    switch (layer) {
      case 'scene':
        musicEngine.setSceneVolume(volume);
        break;
      case 'character':
        musicEngine.setCharacterVolume(volume);
        break;
      case 'event':
        musicEngine.setEventVolume(volume);
        break;
    }
  }

  dispose(): void {
    this.disposables.splice(0).forEach((dispose) => dispose());
  }
}
