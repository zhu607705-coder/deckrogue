/**
 * @file runtimeV2UIInterface.test.ts
 * @description Unit tests for runtime v2 UI interface and content service management.
 *
 * 主要职责:
 * - 测试内容服务的重置与获取
 * - 测试 UI 模型转换器的转换逻辑
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ContentService,
  getContentService,
  resetContentService,
  UIModelConverter,
  convertToUIModel,
  EventBus,
  getEventBus,
  resetEventBus,
  type RuleSnapshot
} from '@/runtimeV2';

const mockSnapshot: RuleSnapshot = {
  schemaVersion: 2,
  engineVersion: '1.0.0',
  seed: 12345,
  lifecycle: {
    screen: 'Combat',
    phase: 'player_turn',
    pendingNodeResolution: false,
  },
  player: {
    characterId: 'informant',
    hp: 50,
    maxHp: 70,
    gold: 100,
    intel: 3,
    devotion: 0,
    corruption: 0,
    deck: ['strike', 'defend', 'gather_intel'],
    relicIds: ['burning_blood'],
    potionIds: [],
  },
  map: {
    currentNodeId: 'node_1',
    nodes: [
      { id: 'node_0', type: 'Combat', x: 0, y: 0, revealed: true, next: ['node_1'] },
      { id: 'node_1', type: 'Combat', x: 1, y: 1, revealed: true, next: ['node_2'] },
      { id: 'node_2', type: 'Elite', x: 2, y: 2, revealed: false, next: [] },
    ],
  },
  combat: {
    turn: 1,
    isPlayerTurn: true,
    playerBlock: 5,
    playerEnergy: 3,
    enemyIds: ['enemy_0'],
    enemies: [
      { id: 'enemy_0', defId: 'slime_small', hp: 20, maxHp: 25, block: 0, nextIntent: 'attack' },
    ],
    hand: ['strike', 'defend'],
    drawPileCount: 5,
    discardPileCount: 2,
  },
  reward: null,
  activeEvent: null,
  meta: {
    runId: 'test-run',
    replayLength: 0,
    generatedAt: '2024-01-01T00:00:00Z',
    adapter: 'legacy-oracle',
  },
};

test('ContentService loads card data from content bundle', () => {
  resetContentService();
  const service = getContentService();
  const strikeCard = service.getCard('strike');

  assert.ok(strikeCard);
  assert.equal(strikeCard?.name, '打击');
  assert.equal(strikeCard?.cost, 1);
  assert.equal(strikeCard?.type, 'Attack');
});

test('ContentService loads character data from content bundle', () => {
  resetContentService();
  const service = getContentService();
  const informant = service.getCharacter('informant');

  assert.ok(informant);
  assert.equal(informant?.name, '情报员');
  assert.equal(informant?.maxHp, 70);
  assert.equal(informant?.maxEnergy, 3);
});

test('ContentService returns undefined for non-existent content', () => {
  resetContentService();
  const service = getContentService();
  assert.equal(service.getCard('non_existent_card'), undefined);
  assert.equal(service.getCharacter('non_existent_character'), undefined);
  assert.equal(service.getEnemy('non_existent_enemy'), undefined);
});

test('ContentService filters cards by character', () => {
  resetContentService();
  const service = getContentService();
  const informantCards = service.getCardsByCharacter('informant');

  assert.ok(informantCards.length > 0);
  informantCards.forEach(card => {
    assert.ok(['informant', 'All'].includes(card.character || ''));
  });
});

test('UIModelConverter converts RuleSnapshot to UIModel', () => {
  resetContentService();
  const uiModel = convertToUIModel(mockSnapshot);

  assert.equal(uiModel.screen, 'Combat');
  assert.equal(uiModel.player.characterId, 'informant');
  assert.equal(uiModel.player.hp, 50);
  assert.equal(uiModel.player.maxHp, 70);
  assert.equal(uiModel.player.gold, 100);
  assert.equal(uiModel.player.deckCount, 3);
  assert.ok(Math.abs(uiModel.player.healthRatio - 50 / 70) < 0.01);
});

test('UIModelConverter converts map data with available nodes', () => {
  resetContentService();
  const uiModel = convertToUIModel(mockSnapshot);

  assert.equal(uiModel.map.currentNodeId, 'node_1');
  assert.equal(uiModel.map.currentFloor, 2);
  assert.equal(uiModel.map.nodes.length, 3);
  assert.ok(uiModel.map.availableNodeIds.includes('node_2'));
});

test('UIModelConverter converts combat data with real card info', () => {
  resetContentService();
  const uiModel = convertToUIModel(mockSnapshot);

  assert.ok(uiModel.combat);
  assert.equal(uiModel.combat?.turn, 1);
  assert.equal(uiModel.combat?.isPlayerTurn, true);
  assert.equal(uiModel.combat?.hand.length, 2);

  const strikeCard = uiModel.combat?.hand.find(c => c.id === 'strike');
  assert.ok(strikeCard);
  assert.equal(strikeCard?.name, '打击');
  assert.equal(strikeCard?.cost, 1);
});

test('UIModelConverter converts reward data with real card info', () => {
  resetContentService();
  const rewardSnapshot: RuleSnapshot = {
    ...mockSnapshot,
    lifecycle: { ...mockSnapshot.lifecycle, screen: 'Reward' },
    combat: null,
    reward: {
      cardIds: ['strike', 'defend', 'gather_intel'],
      source: 'combat',
    },
  };

  const uiModel = convertToUIModel(rewardSnapshot);

  assert.ok(uiModel.reward);
  assert.equal(uiModel.reward?.cards.length, 3);
  assert.equal(uiModel.reward?.source, 'combat');

  const strikeCard = uiModel.reward?.cards.find(c => c.id === 'strike');
  assert.ok(strikeCard);
  assert.equal(strikeCard?.name, '打击');
});

test('UIModelConverter converts room data for Rest screen', () => {
  resetContentService();
  const restSnapshot: RuleSnapshot = {
    ...mockSnapshot,
    lifecycle: { ...mockSnapshot.lifecycle, screen: 'Rest' },
    combat: null,
  };

  const uiModel = convertToUIModel(restSnapshot);

  assert.ok(uiModel.room);
  assert.equal(uiModel.room?.kind, 'rest');
  assert.equal(uiModel.room?.title, '休整据点');
  assert.equal(uiModel.room?.choices.length, 3);

  const restChoice = uiModel.room?.choices.find(c => c.id === 'rest');
  assert.ok(restChoice);
  assert.equal(restChoice?.label, '休息');
});

test('UIModelConverter converts room data for Event screen', () => {
  resetContentService();
  const eventSnapshot: RuleSnapshot = {
    ...mockSnapshot,
    lifecycle: { ...mockSnapshot.lifecycle, screen: 'Event' },
    combat: null,
    activeEvent: {
      id: 'mysterious_shrine',
      stage: 'initial',
    },
  };

  const uiModel = convertToUIModel(eventSnapshot);

  assert.ok(uiModel.room);
  assert.equal(uiModel.room?.kind, 'event');
  assert.ok((uiModel.room?.choices.length ?? 0) > 0);
});

test('UIModelConverter exposes shop remove-service metadata for Shop screen', () => {
  resetContentService();
  const shopSnapshot: RuleSnapshot = {
    ...mockSnapshot,
    lifecycle: { ...mockSnapshot.lifecycle, screen: 'Shop' },
    combat: null,
  };

  const uiModel = convertToUIModel(shopSnapshot);

  assert.ok(uiModel.room);
  assert.equal(uiModel.room?.kind, 'shop');
  assert.equal(uiModel.room?.metadata.canRemove, true);
  assert.equal(uiModel.room?.metadata.cardRemovalCost, 75);
});

test('UIModelConverter maps special runtime-v2 surfaces into dedicated room kinds', () => {
  resetContentService();
  const upgradeSnapshot: RuleSnapshot = {
    ...mockSnapshot,
    lifecycle: { ...mockSnapshot.lifecycle, screen: 'Upgrade', phase: 'upgrade', pendingNodeResolution: true },
    combat: null,
  };
  const enchantSnapshot: RuleSnapshot = {
    ...mockSnapshot,
    lifecycle: { ...mockSnapshot.lifecycle, screen: 'Enchant', phase: 'enchant', pendingNodeResolution: true },
    combat: null,
    surfaceContext: {
      enchantContext: {
        source: 'Rest',
        enchantmentId: 'swift_sigil',
        title: '黑市附魔',
        description: '选择一张牌接受附魔。',
      },
    },
  };

  const upgradeUi = convertToUIModel(upgradeSnapshot);
  const enchantUi = convertToUIModel(enchantSnapshot);

  assert.equal(upgradeUi.room?.kind, 'upgrade');
  assert.equal(enchantUi.room?.kind, 'enchant');
  assert.equal(enchantUi.room?.title, '黑市附魔');
});

test('EventBus publishes and subscribes to events', () => {
  resetEventBus();
  const eventBus = getEventBus();
  let receivedEvent: unknown = null;

  const unsubscribe = eventBus.subscribe('combat.damage.dealt', (event) => {
    receivedEvent = event;
  });

  eventBus.publish('combat.damage.dealt', { amount: 10, target: 'enemy_0' });

  assert.ok(receivedEvent);
  const payload = (receivedEvent as { payload: { amount: number } }).payload;
  assert.equal(payload.amount, 10);

  unsubscribe();
});

test('EventBus supports global event listeners', () => {
  resetEventBus();
  const eventBus = getEventBus();
  const events: unknown[] = [];

  eventBus.subscribe('*', (event) => {
    events.push(event);
  });

  eventBus.publish('combat.start', { turn: 1 });
  eventBus.publish('combat.end', { victory: true });

  assert.equal(events.length, 2);
});

test('EventBus maintains event history', () => {
  resetEventBus();
  const eventBus = getEventBus();

  eventBus.publish('combat.start', { turn: 1 });
  eventBus.publish('combat.damage.dealt', { amount: 5 });

  const history = eventBus.getHistory();
  assert.equal(history.length, 2);

  const combatEvents = eventBus.getHistoryByType('combat.start');
  assert.equal(combatEvents.length, 1);
});

test('EventBus limits history size', () => {
  const smallEventBus = new EventBus(5);

  for (let i = 0; i < 10; i++) {
    smallEventBus.publish('combat.damage.dealt', { amount: i });
  }

  assert.equal(smallEventBus.getHistory().length, 5);
});
