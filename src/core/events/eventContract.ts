export const RuntimeEventType = {
  // Run lifecycle
  GameInitialized: 'GameInitialized',
  GameShutdown: 'GameShutdown',
  RunStarted: 'RunStarted',
  RunLoaded: 'RunLoaded',
  RunEnded: 'RunEnded',
  GamePaused: 'GamePaused',
  GameResumed: 'GameResumed',
  
  // Node lifecycle
  NodeEntered: 'NodeEntered',
  NodeCompleted: 'NodeCompleted',
  
  // Combat lifecycle
  CombatStart: 'CombatStart',
  CombatVictory: 'CombatVictory',
  CombatWon: 'CombatWon',
  CombatEnd: 'CombatEnd',
  
  // Player state
  PlayerDeath: 'PlayerDeath',
  PlayerDefeated: 'PlayerDefeated',
  
  // Run completion
  RunVictory: 'RunVictory',
  
  // Save/Load
  GameSaved: 'GameSaved',
  GameLoaded: 'GameLoaded',
  SaveFailed: 'SaveFailed',
  LoadFailed: 'LoadFailed',
  AutoSaveTriggered: 'AutoSaveTriggered',
  
  // Meta
  MetaProfileUpdated: 'MetaProfileUpdated'
} as const;

export type RuntimeEventType = typeof RuntimeEventType[keyof typeof RuntimeEventType];

export const RuntimeDomainEventType = {
  ...RuntimeEventType
} as const;

