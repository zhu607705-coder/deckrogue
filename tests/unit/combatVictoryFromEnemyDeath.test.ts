/**
 * @file combatVictoryFromEnemyDeath.test.ts
 * @description Unit tests for combat victory triggered by enemy death in the damage pipeline.
 *
 * 主要职责:
 * - 测试敌人死亡后战斗推进到奖励阶段
 * - 测试共享伤害管道的胜利判定
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { GameEngine } from '@/core/events/gameEngine';
import { globalEventBus } from '@/core/events/eventBus';

test.afterEach(() => {
  globalEventBus.clear();
});

test('enemy death from the shared damage pipeline should advance combat to reward', () => {
  const engine = new GameEngine(4242, null, { enableRuntimeDelegation: false });

  engine.state.screen = 'Combat';
  engine.state.pendingNodeResolution = true;
  engine.state.player.deck = [];
  engine.state.combat = {
    player: {
      hp: 20,
      maxHp: 20,
      block: 0,
      energy: 3,
      statuses: {},
      delayedCards: [],
      constructs: [],
      elements: [],
      potionToxicity: 0,
      potionsUsedThisTurn: 0,
      cardsPlayedThisTurn: 0,
      damageTakenThisTurn: 0,
      damageTakenLastTurn: 0,
      intel: 0,
      devotion: 0,
      corruptionAxis: 0,
      axisDisposition: 'balanced',
    },
    enemies: [
      {
        id: 'enemy_1',
        defId: 'goblin',
        name: 'Test Enemy',
        hp: 0,
        maxHp: 10,
        block: 0,
        statuses: {} as Record<string, number>,
        nextIntent: 'Attack',
        lastUsedIntent: '',
        intentCooldowns: {} as Record<string, number>,
        devotion: 0,
        corruptionAxis: 0,
        axisDisposition: 'balanced',
      },
    ],
    drawPile: [],
    hand: [],
    discardPile: [],
    exhaustPile: [],
    turn: 1,
    isPlayerTurn: true,
    warpTide: 0,
    warpAlpha: 0.5,
    warpPerilK: 0.05,
  };

  globalEventBus.publish({ type: 'EnemyDeath', enemyId: 'enemy_1' });

  assert.equal(engine.state.screen, 'Reward');
  assert.equal(engine.state.combat, null);
  assert.equal(engine.state.pendingNodeResolution, true);
  assert.ok((engine.state.rewardCards?.length || 0) > 0);

  engine.dispose();
});
