/**
 * @file unifiedRuntimeV2.test.tsx
 * @description Unit tests for unified runtime v2 screen rendering and adapter boot.
 *
 * 主要职责:
 * - 测试统一运行时适配器的启动
 * - 测试 UnifiedRuntimeV2Screen 的渲染输出
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import type { EngineHost, RenderModel, RuleRuntimeAdapter, UnifiedEngineAdapter } from '@/runtimeV2';
import {
  buildUnifiedRuntimeV2Characters,
  bootUnifiedRuntimeV2Adapter,
  UnifiedRuntimeV2Screen,
} from '@/ui/views/unifiedRuntimeV2';

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
    room: {
      kind: 'character_select',
      title: 'Select Character',
      body: 'Choose your operative.',
    },
    ...overrides,
  };
}

function createAdapterStub(): UnifiedEngineAdapter {
  return {
    mode: 'runtimeV2',
    snapshot: null,
    renderModel: null,
    subscribe: () => () => {},
    dispatch: async () => {},
    start: async () => {},
    dispose: () => {},
    getLegacyEngine: () => null,
  };
}

test('buildUnifiedRuntimeV2Characters uses project character ids', () => {
  const characters = buildUnifiedRuntimeV2Characters();
  assert(characters.some((character) => character.id === 'informant'));
  assert(characters.some((character) => character.id === 'alchemist'));
  assert(!characters.some((character) => character.id === 'ironclad'));
  assert(!characters.some((character) => character.id === 'watcher'));
});

test('bootUnifiedRuntimeV2Adapter wires Python-WASM runtime through EngineHost', async () => {
  let createRuleAdapterCalls = 0;
  let createHostArgument: RuleRuntimeAdapter | null = null;
  let createUnifiedAdapterArgument: EngineHost | null = null;
  let startedWithSeed: number | undefined;

  const stubRuleAdapter = {} as RuleRuntimeAdapter;
  const stubHost = {} as EngineHost;
  const stubUnifiedAdapter = {
    ...createAdapterStub(),
    start: async ({ seed }: { seed?: number } = {}) => {
      startedWithSeed = seed;
    },
  };

  await bootUnifiedRuntimeV2Adapter(2468, {
    createRuleAdapter: () => {
      createRuleAdapterCalls += 1;
      return stubRuleAdapter;
    },
    createHost: (adapter) => {
      createHostArgument = adapter;
      return stubHost;
    },
    createUnifiedAdapter: (host) => {
      createUnifiedAdapterArgument = host;
      return stubUnifiedAdapter;
    },
  });

  assert.equal(createRuleAdapterCalls, 1);
  assert.equal(createHostArgument, stubRuleAdapter);
  assert.equal(createUnifiedAdapterArgument, stubHost);
  assert.equal(startedWithSeed, 2468);
});

test('UnifiedRuntimeV2Screen renders real character choices and map scenes without a legacy engine', () => {
  const characters = buildUnifiedRuntimeV2Characters();
  const characterSelectHtml = renderToStaticMarkup(
    <UnifiedRuntimeV2Screen
      renderModel={createRenderModel()}
      adapter={createAdapterStub()}
      characters={characters}
    />
  );

  assert.match(characterSelectHtml, /data-character-id="informant"/);
  assert.doesNotMatch(characterSelectHtml, /ironclad/);

  const mapHtml = renderToStaticMarkup(
    <UnifiedRuntimeV2Screen
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
          gold: 12,
          intel: 0,
          devotion: 0,
          corruption: 0,
          deck: ['strike', 'defend'],
          deckCount: 2,
          relicCount: 0,
          potionCount: 0,
          healthRatio: 1,
        },
        room: null,
      })}
      adapter={createAdapterStub()}
      characters={characters}
    />
  );

  assert.match(mapHtml, /data-scene="map"/);
  assert.match(mapHtml, /floor_1_node_0/);
});

test('UnifiedRuntimeV2Screen renders dedicated runtime-v2 surface for RelicUpgrade', () => {
  const html = renderToStaticMarkup(
    <UnifiedRuntimeV2Screen
      renderModel={createRenderModel({
        screen: 'RelicUpgrade',
        lifecycle: {
          screen: 'RelicUpgrade',
          phase: 'relic_upgrade',
          pendingNodeResolution: true,
        },
        room: {
          kind: 'rest',
          title: 'Relic Upgrade',
          body: 'Choose a relic to refine.',
        },
      })}
      adapter={createAdapterStub()}
      characters={buildUnifiedRuntimeV2Characters()}
    />
  );

  assert.match(html, /data-screen="RelicUpgrade"/);
  assert.match(html, /data-scene="runtime-v2-surface"/);
  assert.match(html, /Relic Upgrade/);
});

test('UnifiedRuntimeV2Screen renders dedicated runtime-v2 surface actions for Upgrade and RemoveCard', () => {
  const upgradeHtml = renderToStaticMarkup(
    <UnifiedRuntimeV2Screen
      renderModel={createRenderModel({
        screen: 'Upgrade',
        lifecycle: {
          screen: 'Upgrade',
          phase: 'upgrade',
          pendingNodeResolution: true,
        },
        player: {
          characterId: 'informant',
          hp: 70,
          maxHp: 70,
          gold: 50,
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
          kind: 'upgrade',
          title: '牌库强化',
          body: '选择一张牌强化。',
          choices: [
            { id: '0:strike', label: '打击' },
            { id: '1:defend', label: '防御' },
          ],
        },
      })}
      adapter={createAdapterStub()}
      characters={buildUnifiedRuntimeV2Characters()}
    />
  );

  assert.match(upgradeHtml, /data-scene="runtime-v2-surface"/);
  assert.match(upgradeHtml, /data-action="upgrade-card"/);
  assert.match(upgradeHtml, /data-card-token="0:strike"/);
  assert.match(upgradeHtml, /data-action="cancel-surface"/);

  const removeHtml = renderToStaticMarkup(
    <UnifiedRuntimeV2Screen
      renderModel={createRenderModel({
        screen: 'RemoveCard',
        lifecycle: {
          screen: 'RemoveCard',
          phase: 'remove_card',
          pendingNodeResolution: true,
        },
        player: {
          characterId: 'informant',
          hp: 70,
          maxHp: 70,
          gold: 50,
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
          kind: 'remove_card',
          title: '移除卡牌',
          body: '移除一张牌。',
          choices: [
            { id: '0:strike', label: '打击' },
            { id: '1:defend', label: '防御' },
          ],
        },
      })}
      adapter={createAdapterStub()}
      characters={buildUnifiedRuntimeV2Characters()}
    />
  );

  assert.match(removeHtml, /data-scene="runtime-v2-surface"/);
  assert.match(removeHtml, /data-action="remove-card"/);
  assert.match(removeHtml, /data-card-token="0:strike"/);
  assert.match(removeHtml, /data-action="cancel-surface"/);
});

test('UnifiedRuntimeV2Screen renders dedicated runtime-v2 surface actions for Enchant and RelicUpgrade', () => {
  const enchantHtml = renderToStaticMarkup(
    <UnifiedRuntimeV2Screen
      renderModel={createRenderModel({
        screen: 'Enchant',
        lifecycle: {
          screen: 'Enchant',
          phase: 'enchant',
          pendingNodeResolution: true,
        },
        player: {
          characterId: 'informant',
          hp: 70,
          maxHp: 70,
          gold: 50,
          intel: 0,
          devotion: 0,
          corruption: 0,
          deck: ['strike', 'defend'],
          deckCount: 2,
          relicCount: 1,
          potionCount: 0,
          healthRatio: 1,
        },
        room: {
          kind: 'enchant',
          title: '黑市附魔',
          body: '选择一张牌施加附魔。',
          choices: [
            { id: '0:strike', label: '打击' },
            { id: '1:defend', label: '防御' },
          ],
        },
      })}
      adapter={createAdapterStub()}
      characters={buildUnifiedRuntimeV2Characters()}
    />
  );

  assert.match(enchantHtml, /data-action="enchant-card"/);
  assert.match(enchantHtml, /data-card-token="0:strike"/);
  assert.match(enchantHtml, /data-action="cancel-surface"/);

  const relicUpgradeHtml = renderToStaticMarkup(
    <UnifiedRuntimeV2Screen
      renderModel={createRenderModel({
        screen: 'RelicUpgrade',
        lifecycle: {
          screen: 'RelicUpgrade',
          phase: 'relic_upgrade',
          pendingNodeResolution: true,
        },
        player: {
          characterId: 'informant',
          hp: 70,
          maxHp: 70,
          gold: 150,
          intel: 0,
          devotion: 0,
          corruption: 0,
          deck: ['strike', 'defend'],
          deckCount: 2,
          relicCount: 1,
          potionCount: 0,
          healthRatio: 1,
        },
        room: {
          kind: 'relic_upgrade',
          title: '遗物升级',
          body: '选择一件遗物进行升级。',
          choices: [
            { id: 'corrupted_relic', label: '失落圣骨匣' },
          ],
        },
      })}
      adapter={createAdapterStub()}
      characters={buildUnifiedRuntimeV2Characters()}
    />
  );

  assert.match(relicUpgradeHtml, /data-action="upgrade-relic"/);
  assert.match(relicUpgradeHtml, /data-relic-id="corrupted_relic"/);
  assert.match(relicUpgradeHtml, /data-action="cancel-surface"/);
});
