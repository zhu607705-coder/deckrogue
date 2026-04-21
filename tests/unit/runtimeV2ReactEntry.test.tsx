import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import type { RenderModel } from '@/runtimeV2';
import { resolveAppEntryMode } from '@/runtimeV2/react/entryMode';
import { RuntimeV2AppShell, type RuntimeV2CharacterOption } from '@/runtimeV2/react/runtimeV2AppShell';

const characters: RuntimeV2CharacterOption[] = [
  {
    id: 'informant',
    name: 'The Informant',
    description: 'Intel-driven duelist.',
    maxHp: 85,
    maxEnergy: 3,
    complexity: 'low',
    archetype: ['intel', 'precision'],
  },
  {
    id: 'brute',
    name: 'The Brute',
    description: 'High-health brawler.',
    maxHp: 70,
    maxEnergy: 3,
    complexity: 'low',
    archetype: ['strength', 'survival'],
  },
];

function createRenderModel(overrides: Partial<RenderModel> = {}): RenderModel {
  return {
    screen: 'CharacterSelect',
    lifecycle: {
      screen: 'CharacterSelect',
      phase: 'setup',
      pendingNodeResolution: false,
    },
    player: {
      characterId: null,
      hp: 1,
      maxHp: 1,
      gold: 0,
      intel: 0,
      devotion: 0,
      corruption: 0,
      deck: [],
      deckCount: 0,
      relicCount: 0,
      potionCount: 0,
      healthRatio: 0,
    },
    map: {
      currentNodeId: null,
      nodes: [
        { id: 'floor_1_node_0', type: 'Event', x: 0.5, y: 0, revealed: true, next: ['floor_2_node_0'] },
        { id: 'floor_2_node_0', type: 'Combat', x: 0.5, y: 1, revealed: false, next: [] },
      ],
      currentFloor: null,
      revealedNodeIds: ['floor_1_node_0'],
      availableNodeIds: ['floor_1_node_0'],
    },
    combat: null,
    reward: null,
    activeEvent: null,
    room: null,
    ...overrides,
  };
}

const noopHandlers = {
  onSeedChange: () => {},
  onStartRun: () => {},
  onResetRun: () => {},
  onSaveRun: () => {},
  onLoadSave: () => {},
  onReplayRun: () => {},
  onSelectCharacter: () => {},
  onEnterNode: () => {},
  onLeaveRoom: () => {},
  onCompleteCombat: () => {},
  onTakeReward: () => {},
  onSkipReward: () => {},
  onChooseEventOption: () => {},
  onRest: () => {},
  onBuyShopCard: () => {},
  onBuyShopRelic: () => {},
  onBuyShopPotion: () => {},
  onEnterEnchant: () => {},
  onApplyEnchantment: () => {},
  onEnterRelicUpgrade: () => {},
  onUpgradeRelic: () => {},
  onUpgrade: () => {},
  onRemoveCard: () => {},
  onCancelSurface: () => {},
};

test('resolveAppEntryMode keeps legacy as the default entry and only enables runtime-v2 explicitly', () => {
  assert.equal(resolveAppEntryMode(''), 'legacy');
  assert.equal(resolveAppEntryMode('?runtimeV2=1'), 'runtime-v2');
  assert.equal(resolveAppEntryMode('?foo=1&runtimeV2=1'), 'runtime-v2');
  assert.equal(resolveAppEntryMode('?legacy=1'), 'legacy');
  assert.equal(resolveAppEntryMode('?runtimeV2=0'), 'legacy');
});

test('RuntimeV2AppShell renders a launcher before the host boots a run', () => {
  const html = renderToStaticMarkup(
    <RuntimeV2AppShell
      status="idle"
      renderModel={null}
      seed={12345}
      errorMessage={null}
      characters={characters}
      {...noopHandlers}
    />
  );

  assert.match(html, /Launch Runtime V2/);
  assert.match(html, /开始新局/);
  assert.match(html, /12345/);
});

test('RuntimeV2AppShell renders a character roster after the launcher starts a run', () => {
  const html = renderToStaticMarkup(
    <RuntimeV2AppShell
      status="ready"
      renderModel={createRenderModel()}
      seed={12345}
      errorMessage={null}
      characters={characters}
      {...noopHandlers}
    />
  );

  assert.match(html, /运行时 V2 控制台/);
  assert.match(html, /The Informant/);
  assert.match(html, /The Brute/);
});

test('RuntimeV2AppShell renders map navigation directly from RenderModel', () => {
  const html = renderToStaticMarkup(
    <RuntimeV2AppShell
      status="ready"
      renderModel={createRenderModel({
        screen: 'Map',
        lifecycle: {
          screen: 'Map',
          phase: 'map',
          pendingNodeResolution: false,
        },
        player: {
          characterId: 'informant',
          hp: 85,
          maxHp: 85,
          gold: 99,
          intel: 0,
          devotion: 0,
          corruption: 0,
          deck: ['strike', 'defend'],
          deckCount: 2,
          relicCount: 0,
          potionCount: 0,
          healthRatio: 1,
        },
      })}
      seed={12345}
      errorMessage={null}
      characters={characters}
      {...noopHandlers}
    />
  );

  assert.match(html, /地图路线/);
  assert.match(html, /floor_1_node_0/);
  assert.match(html, /Event/);
});

test('RuntimeV2AppShell renders reward picks without requiring a legacy engine prop', () => {
  const html = renderToStaticMarkup(
    <RuntimeV2AppShell
      status="ready"
      renderModel={createRenderModel({
        screen: 'Reward',
        lifecycle: {
          screen: 'Reward',
          phase: 'reward',
          pendingNodeResolution: true,
        },
        player: {
          characterId: 'informant',
          hp: 85,
          maxHp: 85,
          gold: 99,
          intel: 0,
          devotion: 0,
          corruption: 0,
          deck: ['strike', 'defend'],
          deckCount: 2,
          relicCount: 0,
          potionCount: 0,
          healthRatio: 1,
        },
        reward: {
          cardIds: ['gather_intel', 'precision_strike', 'surveillance'],
          source: 'combat',
          offerCount: 3,
          cards: [
            { id: 'gather_intel', name: 'Gather Intel', cost: 1, rarity: 'Common', type: 'Skill' },
            { id: 'precision_strike', name: 'Precision Strike', cost: 1, rarity: 'Common', type: 'Attack' },
            { id: 'surveillance', name: 'Surveillance', cost: 1, rarity: 'Common', type: 'Skill' },
          ],
        },
        room: {
          kind: 'reward',
          offerCount: 3,
        },
      })}
      seed={12345}
      errorMessage={null}
      characters={characters}
      {...noopHandlers}
    />
  );

  assert.match(html, /Reward Draft/);
  assert.match(html, /Gather Intel/);
  assert.match(html, /Skip Reward/);
});

test('RuntimeV2AppShell renders event choices from room payload', () => {
  const html = renderToStaticMarkup(
    <RuntimeV2AppShell
      status="ready"
      renderModel={createRenderModel({
        screen: 'Event',
        lifecycle: {
          screen: 'Event',
          phase: 'event',
          pendingNodeResolution: true,
        },
        player: {
          characterId: 'informant',
          hp: 85,
          maxHp: 85,
          gold: 99,
          intel: 0,
          devotion: 0,
          corruption: 0,
          deck: ['strike', 'defend'],
          deckCount: 2,
          relicCount: 0,
          potionCount: 0,
          healthRatio: 1,
        },
        room: {
          kind: 'event',
          title: 'Mysterious Stranger',
          body: 'A cloaked figure offers you a deal.',
          choices: [
            { id: 'accept', label: 'Accept the offer', description: 'Gain 50 gold' },
            { id: 'decline', label: 'Decline', description: 'Walk away' },
          ],
        },
      })}
      seed={12345}
      errorMessage={null}
      characters={characters}
      {...noopHandlers}
    />
  );

  assert.match(html, /Mysterious Stranger/);
  assert.match(html, /cloaked figure/);
  assert.match(html, /Accept the offer/);
  assert.match(html, /Decline/);
});

test('RuntimeV2AppShell renders rest site actions from room payload', () => {
  const html = renderToStaticMarkup(
    <RuntimeV2AppShell
      status="ready"
      renderModel={createRenderModel({
        screen: 'Rest',
        lifecycle: {
          screen: 'Rest',
          phase: 'rest',
          pendingNodeResolution: true,
        },
        player: {
          characterId: 'informant',
          hp: 60,
          maxHp: 85,
          gold: 99,
          intel: 0,
          devotion: 0,
          corruption: 0,
          deck: ['strike', 'defend'],
          deckCount: 2,
          relicCount: 0,
          potionCount: 0,
          healthRatio: 0.7,
        },
        room: {
          kind: 'rest',
          title: 'Rest Site',
          body: 'Take a moment to recover.',
          canHeal: true,
          healAmount: 25,
          canUpgrade: true,
          canRemove: true,
          cardRemovalCost: 75,
          canEnchant: true,
          canRelicUpgrade: true,
        },
      })}
      seed={12345}
      errorMessage={null}
      characters={characters}
      {...noopHandlers}
    />
  );

  assert.match(html, /Rest Site/);
  assert.match(html, /恢复 25 点生命/);
  assert.match(html, /强化牌库中的一张牌/);
  assert.match(html, /移除卡牌/);
  assert.match(html, /附魔/);
  assert.match(html, /遗物升级/);
});

test('RuntimeV2AppShell renders shop purchase actions from room payload', () => {
  const html = renderToStaticMarkup(
    <RuntimeV2AppShell
      status="ready"
      renderModel={createRenderModel({
        screen: 'Shop',
        lifecycle: {
          screen: 'Shop',
          phase: 'shop',
          pendingNodeResolution: true,
        },
        player: {
          characterId: 'informant',
          hp: 85,
          maxHp: 85,
          gold: 99,
          intel: 0,
          devotion: 0,
          corruption: 0,
          deck: ['strike', 'defend'],
          deckCount: 2,
          relicCount: 0,
          potionCount: 0,
          healthRatio: 1,
        },
        room: {
          kind: 'shop',
          title: '黑市据点',
          body: '购买卡牌、遗物或药水。',
          cardCount: 2,
          canRemove: true,
          cardRemovalCost: 75,
          canEnchant: true,
          cards: [
            { id: 'surveillance', name: 'Surveillance', price: 50, rarity: 'Common', type: 'Skill' },
            { id: 'false_identity', name: 'False Identity', price: 75, rarity: 'Uncommon', type: 'Skill' },
          ],
          relics: [
            { id: 'anchor', name: 'Anchor', price: 145, rarity: 'Rare', type: 'Relic' },
          ],
          potions: [
            { id: 'healing_potion', name: 'Healing Potion', price: 65, rarity: 'Common', type: 'Potion' },
          ],
        } as RenderModel['room'],
      })}
      seed={12345}
      errorMessage={null}
      characters={characters}
      {...noopHandlers}
    />
  );

  assert.match(html, /data-card-id="surveillance"/);
  assert.match(html, /data-card-id="false_identity"/);
  assert.match(html, /data-relic-id="anchor"/);
  assert.match(html, /data-potion-id="healing_potion"/);
  assert.match(html, /Buy 50g/);
  assert.match(html, /Buy 65g/);
  assert.match(html, /附魔服务/);
});

test('RuntimeV2AppShell surfaces an engine error on the launcher', () => {
  const html = renderToStaticMarkup(
    <RuntimeV2AppShell
      status="error"
      renderModel={null}
      seed={42}
      errorMessage="legacy adapter failed"
      characters={characters}
      {...noopHandlers}
    />
  );

  assert.match(html, /legacy adapter failed/);
  assert.match(html, /Reset Host/);
});
