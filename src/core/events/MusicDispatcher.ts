import { musicEngine } from '@/features/audio/MusicEngine';
import { sfxPlayer } from '@/features/audio/SFXPlayer';
import { globalEventBus } from '@/core/events/eventBus';
import type { GameEngine } from '@/core/events/gameEngine';
import type { SceneType } from '@/content/data/musicManifest';

const BUFF_STATUSES = new Set(['Strength', 'Dexterity', 'Block', 'Regen', 'Artifact', 'Stealth']);

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
      sfxPlayer.play('turn_start');
      if (node?.type === 'Boss') {
        musicEngine.playScene('CombatBoss');
      } else if (node?.type === 'Elite') {
        musicEngine.playScene('CombatElite');
      } else {
        musicEngine.playScene('CombatNormal');
      }
    }));

    this.disposables.push(globalEventBus.subscribe('CombatVictory', () => {
      sfxPlayer.play('enemy_death');
      musicEngine.playScene('Victory');
    }));

    this.disposables.push(globalEventBus.subscribe('PlayerDeath', () => {
      sfxPlayer.play('player_death');
      musicEngine.playScene('GameOver');
    }));

    this.disposables.push(globalEventBus.subscribe('TurnStart', () => {
      sfxPlayer.play('turn_start');
    }));

    this.disposables.push(globalEventBus.subscribe('TurnEnd', () => {
      sfxPlayer.play('turn_end');
    }));

    this.disposables.push(globalEventBus.subscribe('CardPlayed', () => {
      sfxPlayer.play('card_play');
    }));

    this.disposables.push(globalEventBus.subscribe('CardDrawn', () => {
      sfxPlayer.play('card_draw');
    }));

    this.disposables.push(globalEventBus.subscribe('DamageDealt', (event) => {
      if ((event as { targetType?: string }).targetType === 'enemy') sfxPlayer.play('attack_hit');
    }));

    this.disposables.push(globalEventBus.subscribe('DamageReceived', () => {
      sfxPlayer.play('damage_taken');
    }));

    this.disposables.push(globalEventBus.subscribe('BlockGained', () => {
      sfxPlayer.play('block_success');
    }));

    this.disposables.push(globalEventBus.subscribe('StatusApplied', (event) => {
      const statusEvent = event as { targetType?: string; status?: string };
      const positive = statusEvent.targetType === 'player' && BUFF_STATUSES.has(String(statusEvent.status));
      sfxPlayer.play(positive ? 'buff_apply' : 'debuff_apply');
    }));

    this.disposables.push(globalEventBus.subscribe('RelicAcquired', () => {
      sfxPlayer.play('relic_pickup');
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
      sfxPlayer.play('ambient_room_shift');
      musicEngine.playScene(scene);
    }

    if (screen === 'CharacterSelect') {
      musicEngine.stopEventMusic();
    }
  }

  onCharacterSelected(characterId: string): void {
    sfxPlayer.play('ui_confirm');
    musicEngine.playCharacterTheme(characterId);
  }

  onEventStart(eventId: string): void {
    this.lastEventId = eventId;
    sfxPlayer.play('power_activate');
    musicEngine.playEventMusic(eventId);
  }

  onEventEnd(): void {
    sfxPlayer.play('ui_confirm');
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
    sfxPlayer.setMasterVolume(0);
    musicEngine.mute();
  }

  unmute(): void {
    sfxPlayer.setMasterVolume(1);
    musicEngine.unmute();
  }

  setVolume(volume: number): void {
    sfxPlayer.setMasterVolume(volume);
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
