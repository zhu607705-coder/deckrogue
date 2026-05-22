/**
 * @file runtimeV2LegacyRenderBridge.test.ts
 * @description Unit tests for projecting a legacy engine into the runtime v2 render contract.
 *
 * 主要职责:
 * - 测试 createLegacyRenderModel 的投影逻辑
 * - 测试商店房间摘要的包含性
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { GameEngine } from '@/core/events/gameEngine';
import { createLegacyRenderModel, createRenderModel, type RuleSnapshot } from '@/runtimeV2';

test('createLegacyRenderModel projects a legacy engine into the runtime v2 render contract', () => {
  const engine = new GameEngine(12345, null);
  try {
    engine.selectCharacter('informant');

    const renderModel = createLegacyRenderModel(engine);

    assert.equal(renderModel.screen, 'Map');
    assert.equal(renderModel.player.characterId, 'informant');
    assert.equal(renderModel.player.deckCount, engine.state.player.deck.length);
    assert.equal(renderModel.player.healthRatio, 1);
    assert.deepEqual(renderModel.map.availableNodeIds, engine.state.map.filter((node) => node.revealed && node.y === 0).map((node) => node.id));
  } finally {
    engine.dispose();
  }
});

test('createLegacyRenderModel includes shop room summary for legacy shop screens', () => {
  const engine = new GameEngine(12345, null);
  try {
    engine.selectCharacter('informant');
    (engine as any).enterShop();

    const renderModel = createLegacyRenderModel(engine);

    assert.equal(renderModel.screen, 'Shop');
    assert.equal(renderModel.room?.kind, 'shop');
    assert.equal(renderModel.room?.cardCount, engine.state.shopCards.length);
    assert.equal(renderModel.room?.relicCount, engine.state.shopRelics.length);
    assert.equal(renderModel.room?.potionStockCount, engine.state.shopPotions.length);
    assert.equal(renderModel.room?.cardRemovalCost, engine.state.cardRemovalCost);
  } finally {
    engine.dispose();
  }
});

test('createLegacyRenderModel preserves the selected character across the legacy post-selection transition', () => {
  const engine = new GameEngine(12345, null);
  try {
    engine.selectCharacter('brute');

    const renderModel = createLegacyRenderModel(engine);

    assert.equal(renderModel.screen, 'Map');
    assert.equal(renderModel.player.characterId, 'brute');
  } finally {
    engine.dispose();
  }
});

test('createLegacyRenderModel includes rest room summary for legacy rest screens', () => {
  const engine = new GameEngine(12345, null);
  try {
    engine.selectCharacter('informant');
    engine.state.screen = 'Rest';
    engine.state.player.hp = Math.max(1, engine.state.player.maxHp - 12);

    const renderModel = createLegacyRenderModel(engine);

    assert.equal(renderModel.room?.kind, 'rest');
    assert.equal(renderModel.room?.canHeal, true);
    assert.equal(renderModel.room?.healAmount, Math.floor(engine.state.player.maxHp * 0.3));
  } finally {
    engine.dispose();
  }
});

test('createRenderModel exposes runtime-v2 rest potion mix choices', () => {
  const snapshot: RuleSnapshot = {
    schemaVersion: 2,
    engineVersion: 'test',
    seed: 1,
    lifecycle: {
      screen: 'Rest',
      phase: 'rest',
      pendingNodeResolution: true,
    },
    player: {
      characterId: 'informant',
      hp: 40,
      maxHp: 70,
      gold: 99,
      intel: 0,
      devotion: 0,
      corruption: 0,
      deck: [],
      relicIds: [],
      potionIds: ['healing_potion', 'block_potion'],
      relicStates: {},
    },
    map: {
      currentNodeId: null,
      nodes: [],
    },
    combat: null,
    reward: null,
    activeEvent: null,
    meta: {
      runId: null,
      replayLength: 0,
      generatedAt: '1970-01-01T00:00:00.000Z',
      adapter: 'python-wasm',
    },
  };

  const renderModel = createRenderModel(snapshot);

  assert.equal(renderModel.room?.kind, 'rest');
  assert.equal(renderModel.room?.canMix, true);
  assert.deepEqual(renderModel.room?.potions?.map((potion) => potion.id), ['healing_potion', 'block_potion']);
});

test('createRenderModel resolves enchanted card ids when building deck surface choices', () => {
  const snapshot: RuleSnapshot = {
    schemaVersion: 2,
    engineVersion: 'test',
    seed: 1,
    lifecycle: {
      screen: 'Enchant',
      phase: 'event',
      pendingNodeResolution: true,
    },
    player: {
      characterId: 'informant',
      hp: 40,
      maxHp: 70,
      gold: 99,
      intel: 0,
      devotion: 0,
      corruption: 0,
      deck: ['calculated_strike*'],
      relicIds: [],
      potionIds: [],
      relicStates: {},
    },
    map: {
      currentNodeId: null,
      nodes: [],
    },
    combat: null,
    reward: null,
    activeEvent: null,
    meta: {
      runId: null,
      replayLength: 0,
      generatedAt: '1970-01-01T00:00:00.000Z',
      adapter: 'python-wasm',
    },
  };

  const renderModel = createRenderModel(snapshot);
  const choice = renderModel.room?.kind === 'enchant' ? renderModel.room.choices[0] : null;

  assert.ok(choice);
  assert.equal(choice.id, '0:calculated_strike*');
  assert.equal(choice.label, '计算打击 *');
  assert.equal(choice.description, '造成 7 点伤害。若你有 1 点情报，则消耗 1 点并额外造成 7 点伤害。');
});

test('createLegacyRenderModel includes reward room summary for legacy reward screens', () => {
  const engine = new GameEngine(12345, null);
  try {
    engine.selectCharacter('informant');
    (engine.state as any).rewardCards = engine.state.player.deck.slice(0, 3);
    engine.state.screen = 'Reward';

    const renderModel = createLegacyRenderModel(engine);

    assert.equal(renderModel.room?.kind, 'reward');
    assert.equal(renderModel.room?.offerCount, 3);
  } finally {
    engine.dispose();
  }
});
