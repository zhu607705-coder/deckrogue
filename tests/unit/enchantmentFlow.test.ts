/**
 * @file enchantmentFlow.test.ts
 * @description Unit tests for enchantment selection flow triggered by story events.
 *
 * 主要职责:
 * - 测试事件选择进入附魔模式的流程
 * - 测试附魔上下文的来源与附魔ID
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { GameEngine } from '@/core/events/gameEngine';

function buildEngine() {
  const engine = new GameEngine(12345, null);
  engine.selectCharacter('informant');
  return engine;
}

test('story event choice can enter enchant selection mode', () => {
  const engine = buildEngine();
  engine.state.activeEvent = { id: 'inquisitor_legacy', data: {} };
  engine.state.screen = 'Event';

  engine.resolveEventChoice('legacy_inscribe_sigil');

  assert.equal(engine.state.screen, 'Enchant');
  assert.ok(engine.state.enchantContext, 'enchant context should exist');
  assert.equal(engine.state.enchantContext?.source, 'Event');
  assert.equal(engine.state.enchantContext?.enchantmentId, 'swift_sigil');
});

test('second story event can also enter enchant selection mode with hp cost', () => {
  const engine = buildEngine();
  const hpBefore = engine.state.player.hp;
  engine.state.activeEvent = { id: 'nameless_martyr_shrine', data: {} };
  engine.state.screen = 'Event';

  engine.resolveEventChoice('martyr_inscribe_oath');

  assert.equal(engine.state.screen, 'Enchant');
  assert.equal(engine.state.enchantContext?.source, 'Event');
  assert.equal(engine.state.enchantContext?.enchantmentId, 'blood_rune');
  assert.ok(engine.state.player.hp < hpBefore);
});

test('rest can enter enchant selection mode', () => {
  const engine = buildEngine();
  engine.state.screen = 'Rest';
  engine.restEnchant();

  assert.equal(engine.state.screen, 'Enchant');
  assert.equal(engine.state.enchantContext?.source, 'Rest');
});

test('shop can enter enchant selection mode', () => {
  const engine = buildEngine();
  engine.state.screen = 'Shop';
  engine.state.player.gold = 999;
  engine.enterShopEnchant();

  assert.equal(engine.state.screen, 'Enchant');
  assert.equal(engine.state.enchantContext?.source, 'Shop');
  assert.ok(engine.state.enchantContext?.price && engine.state.enchantContext.price > 0);
});

test('rest enchant applies to a card and returns to map', () => {
  const engine = buildEngine();
  engine.state.map = [{ id: 'rest-1', type: 'Rest', revealed: true, next: [], x: 0.5, y: 1 }];
  engine.state.currentNodeId = 'rest-1';
  engine.state.pendingNodeResolution = true;
  engine.state.screen = 'Rest';
  const target = engine.state.player.deck.find((card) => card.id === 'strike');
  assert.ok(target?.instanceId);

  engine.restEnchant();
  assert.equal(engine.state.screen, 'Enchant');

  const applied = engine.applyEnchantment(target!.instanceId!);
  assert.equal(applied, true);
  assert.equal(engine.state.screen, 'Map');

  const updated = engine.state.player.deck.find((card) => card.instanceId === target!.instanceId);
  assert.equal(updated?.persistentEnchantments.length, 1);
  assert.equal(updated?.persistentEnchantments[0]?.id, 'blood_rune');
});

test('shop enchant deducts gold and returns to shop', () => {
  const engine = buildEngine();
  engine.state.screen = 'Shop';
  engine.state.player.gold = 999;
  const target = engine.state.player.deck.find((card) => card.id === 'strike');
  assert.ok(target?.instanceId);

  engine.enterShopEnchant();
  const price = engine.state.enchantContext?.price ?? 0;
  const applied = engine.applyEnchantment(target!.instanceId!);
  assert.equal(applied, true);
  assert.equal(engine.state.screen, 'Shop');
  assert.equal(engine.state.player.gold, 999 - price);
});

test('enemy combat affliction applies during combat and is cleared after victory cleanup', () => {
  const engine = buildEngine();
  engine.selectCharacter('informant');
  (engine as any).startCombat('Elite');
  const combat = engine.state.combat;
  assert.ok(combat);

  const cardBefore = combat!.hand[0] ?? combat!.drawPile[0];
  assert.ok(cardBefore?.instanceId);

  const enemy = combat!.enemies.find((entry) => ['hexaghost', 'lagavulin', 'cultist'].includes(entry.defId));
  if (!enemy) return;

  (engine as any).applyEnemyCardAffliction(enemy.id);

  const afflictedInDeck = engine.state.player.deck.find((card) => card.instanceId === cardBefore.instanceId);
  assert.ok((afflictedInDeck?.combatAfflictions.length || 0) >= 1);

  (engine as any).clearCombatAfflictionsForRunCards();

  const cleared = engine.state.player.deck.find((card) => card.instanceId === cardBefore.instanceId);
  assert.equal(cleared?.combatAfflictions.length, 0);
});
