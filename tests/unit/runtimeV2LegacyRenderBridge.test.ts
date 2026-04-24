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
import { createLegacyRenderModel } from '@/runtimeV2';

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
