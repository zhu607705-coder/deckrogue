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
import { calculateRestHealAmount } from '@/core/events/restHealing';
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

test('createRenderModel preserves a custom shop removal cost while selecting a paid shop removal', () => {
  const snapshot: RuleSnapshot = {
    schemaVersion: 2,
    engineVersion: 'test',
    seed: 1,
    lifecycle: {
      screen: 'RemoveCard',
      phase: 'remove_card',
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
      deck: ['calculated_strike'],
      relicIds: [],
      potionIds: [],
      relicStates: {},
    },
    map: {
      currentNodeId: 'shop-1',
      nodes: [],
    },
    shop: {
      cards: [],
      relics: [],
      potions: [],
      cardRemovalCost: 125,
    },
    surfaceContext: {
      upgradeReturnScreen: 'Shop',
    },
    roomSession: {
      token: 'test-shop-remove',
      nodeId: 'shop-1',
      ownerKind: 'shop',
      resolverKind: 'shop',
      surfaceStack: ['shop', 'remove_card'],
      status: 'active',
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

  assert.equal(renderModel.room?.kind, 'remove_card');
  assert.equal(renderModel.room?.cardRemovalCost, 125);
});

test('createLegacyRenderModel preserves a custom shop removal cost on the remove-card surface', () => {
  const engine = new GameEngine(12345, null);
  try {
    engine.selectCharacter('informant');
    engine.enterShop();
    engine.state.cardRemovalCost = 125;
    engine.enterCardRemoval();

    const renderModel = createLegacyRenderModel(engine);

    assert.equal(renderModel.screen, 'RemoveCard');
    assert.equal(renderModel.room?.kind, 'remove_card');
    assert.equal(renderModel.room?.cardRemovalCost, 125);
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
    assert.equal(renderModel.room?.healAmount, calculateRestHealAmount(engine.state.player.maxHp));
  } finally {
    engine.dispose();
  }
});

test('createRenderModel reports a nonzero rest heal amount for low max HP snapshots', () => {
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
      hp: 1,
      maxHp: 3,
      gold: 99,
      intel: 0,
      devotion: 0,
      corruption: 0,
      deck: [],
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

  assert.equal(renderModel.room?.kind, 'rest');
  assert.equal(renderModel.room?.healAmount, 1);
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

test('createRenderModel resolves enchanted card ids when building remove-card surface choices', () => {
  const snapshot: RuleSnapshot = {
    schemaVersion: 2,
    engineVersion: 'test',
    seed: 1,
    lifecycle: {
      screen: 'RemoveCard',
      phase: 'remove_card',
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
  const choice = renderModel.room?.kind === 'remove_card' ? renderModel.room.choices[0] : null;

  assert.ok(choice);
  assert.equal(choice.id, '0:calculated_strike*');
  assert.equal(choice.label, '计算打击 *');
  assert.equal(choice.description, '造成 7 点伤害。若你有 1 点情报，则消耗 1 点并额外造成 7 点伤害。');
});

test('createRenderModel only exposes valid upgrade card choices', () => {
  const snapshot: RuleSnapshot = {
    schemaVersion: 2,
    engineVersion: 'test',
    seed: 1,
    lifecycle: {
      screen: 'Upgrade',
      phase: 'upgrade',
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
      deck: ['calculated_strike+', 'defend', 'time_bomb'],
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

  assert.equal(renderModel.room?.kind, 'upgrade');
  assert.deepEqual(renderModel.room.choices?.map((choice) => choice.id), ['1:defend']);
});

test('createRenderModel only exposes enchant-applicable unenchanted card choices', () => {
  const snapshot: RuleSnapshot = {
    schemaVersion: 2,
    engineVersion: 'test',
    seed: 1,
    lifecycle: {
      screen: 'Enchant',
      phase: 'enchant',
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
      deck: ['defend', 'calculated_strike', 'calculated_strike*', 'stasis_field'],
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
    surfaceContext: {
      enchantContext: {
        source: 'Rest',
        enchantmentId: 'blood_rune',
        title: '营火刻印',
        description: '从一张攻击牌上刻下稳定的永久附魔。',
        returnScreen: 'Rest',
      },
    },
    meta: {
      runId: null,
      replayLength: 0,
      generatedAt: '1970-01-01T00:00:00.000Z',
      adapter: 'python-wasm',
    },
  };

  const renderModel = createRenderModel(snapshot);

  assert.equal(renderModel.room?.kind, 'enchant');
  assert.deepEqual(renderModel.room.choices?.map((choice) => choice.id), ['1:calculated_strike']);
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
