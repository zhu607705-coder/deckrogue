/**
 * @file targetingService.ts
 * @description 目标选择服务 - 解析卡牌动作的目标
 *
 * 主要职责:
 * - 定义 CardTarget 类型 (Enemy, AllEnemies, Self, RandomEnemy, Player, AllAllies)
 * - 实现 TargetingService.resolveTargets，根据目标类型解析实际目标列表
 * - 支持随机目标选择和全目标选择
 */
import { GameState } from '@/core/types';
import { stateRandomInt } from '@/infrastructure/rng/stateRandom';

export type CardTarget = 
  | 'Enemy' 
  | 'AllEnemies' 
  | 'Self' 
  | 'RandomEnemy' 
  | 'Player'
  | 'AllAllies';

export interface TargetInfo {
  entity: any;
  type: 'player' | 'enemy';
  id: string;
}

export class TargetingService {
  static resolveTargets(
    state: GameState, 
    context: { 
      source: 'player' | string; 
      targetId?: string;
    },
    targetType: CardTarget
  ): TargetInfo[] {
    const combat = state.combat;
    if (!combat) return [];

    switch (targetType) {
      case 'Enemy': {
        if (context.targetId === 'player') {
          return [{ entity: combat.player, type: 'player', id: 'player' }];
        }
        if (context.targetId) {
          const enemy = combat.enemies.find(e => e.id === context.targetId);
          if (enemy && enemy.hp > 0) {
            return [{ entity: enemy, type: 'enemy', id: enemy.id }];
          }
        }
        return [];
      }

      case 'AllEnemies': {
        if (context.source === 'player') {
          return combat.enemies
            .filter(e => e.hp > 0)
            .map(e => ({ entity: e, type: 'enemy' as const, id: e.id }));
        }
        return [{ entity: combat.player, type: 'player', id: 'player' }];
      }

      case 'Self': {
        if (context.source === 'player') {
          return [{ entity: combat.player, type: 'player', id: 'player' }];
        }
        const sourceEnemy = combat.enemies.find(e => e.id === context.source);
        if (sourceEnemy && sourceEnemy.hp > 0) {
          return [{ entity: sourceEnemy, type: 'enemy', id: sourceEnemy.id }];
        }
        return [];
      }

      case 'RandomEnemy': {
        if (context.source === 'player') {
          const aliveEnemies = combat.enemies.filter(e => e.hp > 0);
          if (aliveEnemies.length > 0) {
            const randomEnemy = aliveEnemies[stateRandomInt(state, aliveEnemies.length)];
            return [{ entity: randomEnemy, type: 'enemy', id: randomEnemy.id }];
          }
          return [];
        }
        const aliveAllies = combat.enemies.filter(e => e.hp > 0 && e.id !== context.source);
        if (aliveAllies.length > 0) {
          const randomAlly = aliveAllies[stateRandomInt(state, aliveAllies.length)];
          return [{ entity: randomAlly, type: 'enemy', id: randomAlly.id }];
        }
        return [];
      }

      case 'Player': {
        return [{ entity: combat.player, type: 'player', id: 'player' }];
      }

      case 'AllAllies': {
        if (context.source !== 'player') {
          return combat.enemies
            .filter(e => e.hp > 0 && e.id !== context.source)
            .map(e => ({ entity: e, type: 'enemy' as const, id: e.id }));
        }
        return [{ entity: combat.player, type: 'player', id: 'player' }];
      }

      default:
        return [];
    }
  }

  static getAliveEnemies(state: GameState): any[] {
    return state.combat?.enemies.filter(e => e.hp > 0) || [];
  }

  static getFirstAliveEnemy(state: GameState): any | null {
    const combat = state.combat;
    if (!combat) return null;
    return combat.enemies.find(e => e.hp > 0) || null;
  }

  static getSourceEntity(state: GameState, source: 'player' | string): any | null {
    const combat = state.combat;
    if (!combat) return null;
    
    if (source === 'player') {
      return combat.player;
    }
    return combat.enemies.find(e => e.id === source) || null;
  }

  static hasValidTarget(state: GameState, targetType: CardTarget, context: { source: 'player' | string; targetId?: string }): boolean {
    return this.resolveTargets(state, context, targetType).length > 0;
  }
}

export const targetingService = TargetingService;
