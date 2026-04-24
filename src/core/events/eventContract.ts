/**
 * @file eventContract.ts
 * @description 事件契约 - 定义运行时事件的类型常量
 *
 * 主要职责:
 * - 定义 RuntimeEventType 常量对象，枚举所有运行时事件类型
 * - 定义 RuntimeDomainEventType 常量对象，枚举领域事件类型
 * - 为事件系统提供统一的事件类型标识
 */
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

