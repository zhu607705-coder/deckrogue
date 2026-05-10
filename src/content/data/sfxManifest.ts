// SFX Definitions - Sound Effects Manifest
// This file defines all sound effects used in Deckrogue

export type SFXCategory =
  | 'combat'      // Attack, block, hit
  | 'card'        // Card draw, play, discard
  | 'ui'          // Menu clicks, hover
  | 'power'       // Ability activation
  | 'ambient'     // Environmental sounds
  | 'status';     // Buff, debuff application

export interface SoundEffect {
  id: string;
  name: string;
  category: SFXCategory;
  description: string;
  // Web Audio synthesis parameters
  synthesis: {
    type: 'sine' | 'square' | 'sawtooth' | 'triangle' | 'noise';
    frequency?: number;
    frequencyEnd?: number;
    duration: number;
    attack?: number;
    decay?: number;
    sustain?: number;
    release?: number;
    volume?: number;
    filterFreq?: number;
    filterType?: 'lowpass' | 'highpass' | 'bandpass';
  };
}

export const SFX_MANIFEST: Record<string, SoundEffect> = {
  // Combat Sounds
  attack_slash: {
    id: 'attack_slash',
    name: 'Attack Slash',
    category: 'combat',
    description: 'Sword swing sound',
    synthesis: {
      type: 'sawtooth',
      frequency: 800,
      frequencyEnd: 200,
      duration: 0.15,
      volume: 0.4,
      filterFreq: 2000,
      filterType: 'lowpass',
    },
  },
  attack_hit: {
    id: 'attack_hit',
    name: 'Hit Impact',
    category: 'combat',
    description: 'Impact on enemy hit',
    synthesis: {
      type: 'square',
      frequency: 150,
      frequencyEnd: 50,
      duration: 0.1,
      volume: 0.5,
      filterFreq: 500,
    },
  },
  block_success: {
    id: 'block_success',
    name: 'Block Success',
    category: 'combat',
    description: 'Successful block sound',
    synthesis: {
      type: 'triangle',
      frequency: 400,
      frequencyEnd: 600,
      duration: 0.2,
      volume: 0.3,
    },
  },
  damage_taken: {
    id: 'damage_taken',
    name: 'Damage Taken',
    category: 'combat',
    description: 'Player takes damage',
    synthesis: {
      type: 'sawtooth',
      frequency: 200,
      frequencyEnd: 80,
      duration: 0.3,
      volume: 0.5,
      filterFreq: 800,
    },
  },

  // Card Sounds
  card_draw: {
    id: 'card_draw',
    name: 'Card Draw',
    category: 'card',
    description: 'Draw a card from deck',
    synthesis: {
      type: 'sine',
      frequency: 600,
      frequencyEnd: 900,
      duration: 0.15,
      volume: 0.25,
    },
  },
  card_play: {
    id: 'card_play',
    name: 'Card Play',
    category: 'card',
    description: 'Play a card',
    synthesis: {
      type: 'triangle',
      frequency: 800,
      frequencyEnd: 400,
      duration: 0.2,
      volume: 0.35,
    },
  },
  card_discard: {
    id: 'card_discard',
    name: 'Card Discard',
    category: 'card',
    description: 'Discard a card',
    synthesis: {
      type: 'sine',
      frequency: 500,
      frequencyEnd: 300,
      duration: 0.12,
      volume: 0.2,
    },
  },
  energy_gain: {
    id: 'energy_gain',
    name: 'Energy Gain',
    category: 'card',
    description: 'Gain energy',
    synthesis: {
      type: 'sine',
      frequency: 400,
      frequencyEnd: 1200,
      duration: 0.3,
      volume: 0.3,
    },
  },

  // UI Sounds
  ui_click: {
    id: 'ui_click',
    name: 'UI Click',
    category: 'ui',
    description: 'Menu button click',
    synthesis: {
      type: 'square',
      frequency: 1000,
      duration: 0.05,
      volume: 0.15,
    },
  },
  ui_hover: {
    id: 'ui_hover',
    name: 'UI Hover',
    category: 'ui',
    description: 'Button hover',
    synthesis: {
      type: 'sine',
      frequency: 2000,
      duration: 0.03,
      volume: 0.08,
    },
  },
  ui_confirm: {
    id: 'ui_confirm',
    name: 'UI Confirm',
    category: 'ui',
    description: 'Confirm selection',
    synthesis: {
      type: 'sine',
      frequency: 523,
      frequencyEnd: 784,
      duration: 0.15,
      volume: 0.25,
    },
  },
  ui_cancel: {
    id: 'ui_cancel',
    name: 'UI Cancel',
    category: 'ui',
    description: 'Cancel/back',
    synthesis: {
      type: 'sine',
      frequency: 400,
      frequencyEnd: 300,
      duration: 0.12,
      volume: 0.2,
    },
  },

  // Power/Ability Sounds
  power_activate: {
    id: 'power_activate',
    name: 'Power Activate',
    category: 'power',
    description: 'Ability activated',
    synthesis: {
      type: 'sine',
      frequency: 300,
      frequencyEnd: 1500,
      duration: 0.5,
      volume: 0.4,
      filterFreq: 3000,
      filterType: 'lowpass',
    },
  },
  buff_apply: {
    id: 'buff_apply',
    name: 'Buff Apply',
    category: 'power',
    description: 'Positive status applied',
    synthesis: {
      type: 'triangle',
      frequency: 800,
      frequencyEnd: 1600,
      duration: 0.25,
      volume: 0.3,
    },
  },
  debuff_apply: {
    id: 'debuff_apply',
    name: 'Debuff Apply',
    category: 'power',
    description: 'Negative status applied',
    synthesis: {
      type: 'sawtooth',
      frequency: 400,
      frequencyEnd: 150,
      duration: 0.3,
      volume: 0.35,
      filterFreq: 1000,
    },
  },
  relic_pickup: {
    id: 'relic_pickup',
    name: 'Relic Pickup',
    category: 'power',
    description: 'Obtain a relic',
    synthesis: {
      type: 'sine',
      frequency: 440,
      frequencyEnd: 1760,
      duration: 0.4,
      volume: 0.35,
    },
  },

  // Ambient/Transition Sounds
  ambient_chapel_hum: {
    id: 'ambient_chapel_hum',
    name: 'Chapel Hum',
    category: 'ambient',
    description: 'Short low environmental hum',
    synthesis: {
      type: 'sine',
      frequency: 90,
      frequencyEnd: 120,
      duration: 0.7,
      volume: 0.18,
      filterFreq: 400,
      filterType: 'lowpass',
    },
  },
  ambient_room_shift: {
    id: 'ambient_room_shift',
    name: 'Room Shift',
    category: 'ambient',
    description: 'Room transition air movement',
    synthesis: {
      type: 'noise',
      duration: 0.35,
      volume: 0.16,
      filterFreq: 900,
      filterType: 'bandpass',
    },
  },

  // Status Sounds
  turn_start: {
    id: 'turn_start',
    name: 'Turn Start',
    category: 'status',
    description: 'New turn begins',
    synthesis: {
      type: 'sine',
      frequency: 262,
      frequencyEnd: 330,
      duration: 0.2,
      volume: 0.25,
    },
  },
  turn_end: {
    id: 'turn_end',
    name: 'Turn End',
    category: 'status',
    description: 'Turn ends',
    synthesis: {
      type: 'triangle',
      frequency: 330,
      frequencyEnd: 262,
      duration: 0.15,
      volume: 0.2,
    },
  },
  enemy_death: {
    id: 'enemy_death',
    name: 'Enemy Death',
    category: 'status',
    description: 'Enemy defeated',
    synthesis: {
      type: 'sawtooth',
      frequency: 200,
      frequencyEnd: 30,
      duration: 0.6,
      volume: 0.4,
      filterFreq: 800,
    },
  },
  player_death: {
    id: 'player_death',
    name: 'Player Death',
    category: 'status',
    description: 'Player defeated',
    synthesis: {
      type: 'sawtooth',
      frequency: 150,
      frequencyEnd: 20,
      duration: 1.0,
      volume: 0.5,
      filterFreq: 500,
    },
  },
};

// Volume settings per category
export const SFX_VOLUME: Record<SFXCategory, number> = {
  combat: 1.0,
  card: 0.9,
  ui: 0.7,
  power: 1.0,
  ambient: 0.6,
  status: 0.8,
};
