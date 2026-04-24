/**
 * @file useCombatFeedback.ts
 * @description 战斗反馈 Hook - 监听战斗事件并触发视觉/音效反馈
 *
 * 主要职责:
 * - 监听战斗事件流
 * - 触发战斗节拍和动画
 * - 处理伤害/护盾等反馈效果
 */

import { useEffect } from 'react';
import { globalEventBus } from '@/core';
import { 
  COMBAT_BEATS,
  triggerCombatBeat
} from '@/ui/motion';

import type { GameEngine } from '@/core';

export function useCombatFeedback(engine: GameEngine) {
  useEffect(() => {
    const handleDamageDealt = (event: any) => {
      if (event.targetType === 'player') {
        const playerElement = document.querySelector<HTMLElement>('.player-standee');
        if (playerElement) {
          triggerCombatBeat(playerElement, COMBAT_BEATS.HIT);
        }
      }
    };
    
    const handleDamageReceived = (event: any) => {
      const playerElement = document.querySelector<HTMLElement>('.player-standee');
      if (playerElement) {
        triggerCombatBeat(playerElement, COMBAT_BEATS.HIT);
      }
    };
    
    const handleBlockGained = (event: any) => {
      const playerElement = document.querySelector<HTMLElement>('.player-standee');
      if (playerElement) {
        triggerCombatBeat(playerElement, COMBAT_BEATS.BLOCK);
      }
    };
    
    const handleStatusApplied = (event: any) => {
      const targetElement = document.querySelector<HTMLElement>(`[data-enemy-id="${event.targetId}"]`);
      if (targetElement) {
        triggerCombatBeat(targetElement, COMBAT_BEATS.STATUS_APPLY);
      }
    };
    
    const handleEnergyChanged = (event: any) => {
      const energyElement = document.querySelector<HTMLElement>('.grimdark-pill--energy');
      if (energyElement) {
        triggerCombatBeat(energyElement, COMBAT_BEATS.RESOURCE_CHANGE, { resourceGlow: 'energy' });
      }
    };
    
    const handleEnemyDeath = (event: any) => {
      const enemyElement = document.querySelector<HTMLElement>(`[data-enemy-id="${event.enemyId}"]`);
      if (enemyElement) {
        triggerCombatBeat(enemyElement, COMBAT_BEATS.KILL);
      }
    };
    
    const handleTurnEnd = () => {
      const handElement = document.querySelector<HTMLElement>('.action-hand');
      if (handElement) {
        triggerCombatBeat(handElement, COMBAT_BEATS.TURN_END);
      }
    };

    const unsubDamageDealt = globalEventBus.subscribe('DamageDealt', handleDamageDealt);
    const unsubDamageReceived = globalEventBus.subscribe('DamageReceived', handleDamageReceived);
    const unsubBlockGained = globalEventBus.subscribe('BlockGained', handleBlockGained);
    const unsubStatusApplied = globalEventBus.subscribe('StatusApplied', handleStatusApplied);
    const unsubEnergyChanged = globalEventBus.subscribe('EnergyChanged', handleEnergyChanged);
    const unsubEnemyDeath = globalEventBus.subscribe('EnemyDeath', handleEnemyDeath);
    const unsubTurnEnd = globalEventBus.subscribe('TurnEnd', handleTurnEnd);

    
    return () => {
      unsubDamageDealt();
      unsubDamageReceived();
      unsubBlockGained();
      unsubStatusApplied();
      unsubEnergyChanged();
      unsubEnemyDeath();
      unsubTurnEnd();
    };
  }, [engine]);
}
