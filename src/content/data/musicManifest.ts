export type SceneType =
  | 'CharacterSelect'
  | 'MapExplore'
  | 'CombatNormal'
  | 'CombatElite'
  | 'CombatBoss'
  | 'Event'
  | 'Shop'
  | 'Rest'
  | 'Reward'
  | 'Victory'
  | 'GameOver';

export type MusicMood =
  | 'mysterious' | 'tense' | 'intense' | 'epic'
  | 'apocalyptic' | 'calm' | 'peaceful' | 'triumphant'
  | 'somber' | 'horror' | 'chaotic' | 'ominous'
  | 'devotional' | 'furious' | 'strategic' | 'eerie'
  | 'temporal' | 'alchemical' | 'gothic' | 'void'
  | 'cold' | 'mechanical' | 'sacred' | 'organic'
  | 'dimensional' | 'prophetic';

export interface MusicTrack {
  id: string;
  url: string;
  mood: MusicMood;
  bpm: number;
  tags: string[];
}

export const SCENE_MUSIC: Record<SceneType, MusicTrack> = {
  CharacterSelect: {
    id: 'char_select',
    url: '/assets/music/scene/char_select.mp3',
    mood: 'mysterious',
    bpm: 80,
    tags: ['menu', 'ethereal'],
  },
  MapExplore: {
    id: 'map_explore',
    url: '/assets/music/scene/map_explore.mp3',
    mood: 'tense',
    bpm: 90,
    tags: ['exploration', 'ambient'],
  },
  CombatNormal: {
    id: 'combat_normal',
    url: '/assets/music/scene/combat_normal.mp3',
    mood: 'intense',
    bpm: 140,
    tags: ['battle', 'percussive'],
  },
  CombatElite: {
    id: 'combat_elite',
    url: '/assets/music/scene/combat_elite.mp3',
    mood: 'epic',
    bpm: 155,
    tags: ['battle', 'choral'],
  },
  CombatBoss: {
    id: 'combat_boss',
    url: '/assets/music/scene/combat_boss.mp3',
    mood: 'apocalyptic',
    bpm: 170,
    tags: ['boss', 'orchestral'],
  },
  Event: {
    id: 'event',
    url: '/assets/music/scene/event.mp3',
    mood: 'mysterious',
    bpm: 70,
    tags: ['mystery', 'ambient'],
  },
  Shop: {
    id: 'shop',
    url: '/assets/music/scene/shop.mp3',
    mood: 'calm',
    bpm: 85,
    tags: ['merchant', 'warm'],
  },
  Rest: {
    id: 'rest',
    url: '/assets/music/scene/rest.mp3',
    mood: 'peaceful',
    bpm: 60,
    tags: ['rest', 'serene'],
  },
  Reward: {
    id: 'reward',
    url: '/assets/music/scene/reward.mp3',
    mood: 'triumphant',
    bpm: 120,
    tags: ['reward', 'positive'],
  },
  Victory: {
    id: 'victory',
    url: '/assets/music/scene/victory.mp3',
    mood: 'triumphant',
    bpm: 130,
    tags: ['victory', 'uplifting'],
  },
  GameOver: {
    id: 'game_over',
    url: '/assets/music/scene/game_over.mp3',
    mood: 'somber',
    bpm: 50,
    tags: ['death', 'funeral'],
  },
};

export const CHARACTER_THEMES: Record<string, MusicTrack> = {
  informant: {
    id: 'theme_informant',
    url: '/assets/music/character/char_informant.mp3',
    mood: 'mysterious',
    bpm: 90,
    tags: ['character', 'mysterious', 'intel'],
  },
  brute: {
    id: 'theme_brute',
    url: '/assets/music/character/char_brute.mp3',
    mood: 'furious',
    bpm: 160,
    tags: ['character', 'rage', 'war'],
  },
  tactician: {
    id: 'theme_tactician',
    url: '/assets/music/character/char_tactician.mp3',
    mood: 'strategic',
    bpm: 110,
    tags: ['character', 'command', 'order'],
  },
  puppeteer: {
    id: 'theme_puppeteer',
    url: '/assets/music/character/char_puppeteer.mp3',
    mood: 'eerie',
    bpm: 95,
    tags: ['character', 'creepy', 'puppet'],
  },
  chronomancer: {
    id: 'theme_chronomancer',
    url: '/assets/music/character/char_chronomancer.mp3',
    mood: 'temporal',
    bpm: 100,
    tags: ['character', 'time', 'cosmic'],
  },
  alchemist: {
    id: 'theme_alchemist',
    url: '/assets/music/character/char_alchemist.mp3',
    mood: 'alchemical',
    bpm: 100,
    tags: ['character', 'alchemy', 'reaction'],
  },
  penitent_judge: {
    id: 'theme_judge',
    url: '/assets/music/character/char_judge.mp3',
    mood: 'gothic',
    bpm: 120,
    tags: ['character', 'judgement', 'gothic'],
  },
  void_sanctioner: {
    id: 'theme_void',
    url: '/assets/music/character/char_void.mp3',
    mood: 'void',
    bpm: 85,
    tags: ['character', 'void', 'suppression'],
  },
};

export const EVENT_MUSIC: Record<string, MusicTrack> = {
  rusting_medicae: {
    id: 'event_medicae',
    url: '/assets/music/event/event_medicae.mp3',
    mood: 'horror',
    bpm: 75,
    tags: ['event', 'medical', 'horror'],
  },
  nameless_martyr_shrine: {
    id: 'event_martyr',
    url: '/assets/music/event/event_martyr.mp3',
    mood: 'devotional',
    bpm: 65,
    tags: ['event', 'religious', 'sacrifice'],
  },
  warp_tear_whispers: {
    id: 'event_warp',
    url: '/assets/music/event/event_warp.mp3',
    mood: 'chaotic',
    bpm: 130,
    tags: ['event', 'warp', 'chaos'],
  },
  inquisitor_legacy: {
    id: 'event_inquisitor',
    url: '/assets/music/event/event_inquisitor.mp3',
    mood: 'ominous',
    bpm: 85,
    tags: ['event', 'inquisition', 'danger'],
  },
  coolant_crypt: {
    id: 'event_crypt',
    url: '/assets/music/event/event_crypt.mp3',
    mood: 'cold',
    bpm: 70,
    tags: ['event', 'mechanical', 'cold'],
  },
  logic_tribunal: {
    id: 'event_logic',
    url: '/assets/music/event/event_logic.mp3',
    mood: 'mechanical',
    bpm: 100,
    tags: ['event', 'logic', 'mechanical'],
  },
  servo_reliquary: {
    id: 'event_servo',
    url: '/assets/music/event/event_servo.mp3',
    mood: 'sacred',
    bpm: 90,
    tags: ['event', 'relic', 'sacred'],
  },
  reactor_chapel: {
    id: 'event_reactor',
    url: '/assets/music/event/event_reactor.mp3',
    mood: 'sacred',
    bpm: 110,
    tags: ['event', 'reactor', 'sacred'],
  },
  machine_psalm_archive: {
    id: 'event_psalm',
    url: '/assets/music/event/event_psalm.mp3',
    mood: 'mechanical',
    bpm: 80,
    tags: ['event', 'archive', 'mechanical'],
  },
  flesh_replacement_cradle: {
    id: 'event_flesh',
    url: '/assets/music/event/event_flesh.mp3',
    mood: 'horror',
    bpm: 85,
    tags: ['event', 'horror', 'body'],
  },
  sacred_overclock: {
    id: 'event_overclock',
    url: '/assets/music/event/event_overclock.mp3',
    mood: 'intense',
    bpm: 140,
    tags: ['event', 'overclock', 'energy'],
  },
  cooling_vault_breach: {
    id: 'event_vault',
    url: '/assets/music/event/event_vault.mp3',
    mood: 'tense',
    bpm: 110,
    tags: ['event', 'vault', 'danger'],
  },
  abbot_confession: {
    id: 'event_confession',
    url: '/assets/music/event/event_confession.mp3',
    mood: 'gothic',
    bpm: 75,
    tags: ['event', 'confession', 'religious'],
  },
  terminal_silence: {
    id: 'event_terminal',
    url: '/assets/music/event/event_terminal.mp3',
    mood: 'void',
    bpm: 60,
    tags: ['event', 'terminal', 'silent'],
  },
  spore_cathedral: {
    id: 'event_spore',
    url: '/assets/music/event/event_spore.mp3',
    mood: 'organic',
    bpm: 80,
    tags: ['event', 'plague', 'organic'],
  },
  blood_mill: {
    id: 'event_bloodmill',
    url: '/assets/music/event/event_bloodmill.mp3',
    mood: 'horror',
    bpm: 90,
    tags: ['event', 'blood', 'industrial'],
  },
  husk_orphanage: {
    id: 'event_orphanage',
    url: '/assets/music/event/event_orphanage.mp3',
    mood: 'somber',
    bpm: 65,
    tags: ['event', 'orphan', 'somber'],
  },
  septic_archive: {
    id: 'event_septic',
    url: '/assets/music/event/event_septic.mp3',
    mood: 'cold',
    bpm: 70,
    tags: ['event', 'plague', 'archive'],
  },
  mire_wedding: {
    id: 'event_wedding',
    url: '/assets/music/event/event_wedding.mp3',
    mood: 'mysterious',
    bpm: 85,
    tags: ['event', 'wedding', 'swamp'],
  },
  blessing_of_flies: {
    id: 'event_flies',
    url: '/assets/music/event/event_flies.mp3',
    mood: 'organic',
    bpm: 75,
    tags: ['event', 'plague', 'flies'],
  },
  rotted_operatory: {
    id: 'event_operatory',
    url: '/assets/music/event/event_operatory.mp3',
    mood: 'horror',
    bpm: 80,
    tags: ['event', 'surgery', 'horror'],
  },
  grave_choir: {
    id: 'event_grave',
    url: '/assets/music/event/event_grave.mp3',
    mood: 'somber',
    bpm: 60,
    tags: ['event', 'undead', 'choir'],
  },
  larval_pit: {
    id: 'event_larval',
    url: '/assets/music/event/event_larval.mp3',
    mood: 'organic',
    bpm: 85,
    tags: ['event', 'larvae', 'organic'],
  },
  eaten_sanctum: {
    id: 'event_sanctum',
    url: '/assets/music/event/event_sanctum.mp3',
    mood: 'ominous',
    bpm: 90,
    tags: ['event', 'eaten', 'sanctum'],
  },
  corruption_well: {
    id: 'event_corruption',
    url: '/assets/music/event/event_corruption.mp3',
    mood: 'chaotic',
    bpm: 100,
    tags: ['event', 'corruption', 'chaos'],
  },
  silent_plague: {
    id: 'event_plague',
    url: '/assets/music/event/event_plague.mp3',
    mood: 'apocalyptic',
    bpm: 110,
    tags: ['event', 'plague', 'apocalypse'],
  },
  warp_gate_discovery: {
    id: 'event_warp_gate',
    url: '/assets/music/event/event_warp_gate.mp3',
    mood: 'dimensional',
    bpm: 120,
    tags: ['event', 'warp', 'portal'],
  },
  secret_passage: {
    id: 'event_passage',
    url: '/assets/music/event/event_passage.mp3',
    mood: 'mysterious',
    bpm: 75,
    tags: ['event', 'secret', 'discovery'],
  },
  oracle_shrine: {
    id: 'event_oracle',
    url: '/assets/music/event/event_oracle.mp3',
    mood: 'prophetic',
    bpm: 75,
    tags: ['event', 'oracle', 'prophecy'],
  },
};