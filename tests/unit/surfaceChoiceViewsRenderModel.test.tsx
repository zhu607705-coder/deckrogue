/**
 * @file surfaceChoiceViewsRenderModel.test.tsx
 * @description Regression coverage for runtime-v2 nested surface choices.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { GameEngine, type RunCardInstance } from '@/core';
import type { RenderModel } from '@/runtimeV2';
import { EnchantView } from '@/ui/views/EnchantView';
import { RelicUpgradeView } from '@/ui/views/RelicUpgradeView';
import { UpgradeView } from '@/ui/views/UpgradeView';

function createRouteState(primaryTag: string) {
  return {
    primaryTag,
    secondaryTag: null,
    confidence: 90,
    stage: 'committed',
    recentCommits: [],
  };
}

function createRuntimeCard(overrides: Partial<RunCardInstance> = {}): RunCardInstance {
  return {
    id: 'legacy_card',
    name: 'Legacy Card',
    rarity: 'Common',
    cost: 1,
    type: 'Skill',
    targeting: 'Self',
    tags: [],
    text: 'Legacy instance should keep its instance id path.',
    actions: [],
    upgrade: {
      cost: 0,
      text: 'Upgraded legacy card.',
    },
    instanceId: 'legacy-instance-1',
    baseCardId: 'legacy_card',
    runtimeBase: {
      id: 'legacy_card',
      name: 'Legacy Card',
      rarity: 'Common',
      cost: 1,
      type: 'Skill',
      targeting: 'Self',
      tags: [],
      text: 'Legacy instance should keep its instance id path.',
      actions: [],
    },
    persistentEnchantments: [],
    combatAfflictions: [],
    ...overrides,
  };
}

function createSurfaceEngine(overrides: Partial<GameEngine> = {}, deck: RunCardInstance[] = []): GameEngine {
  return {
    state: {
      character: null,
      routeState: null,
      player: {
        deck,
        relics: [],
        relicStates: {},
        gold: 100,
      },
      enchantContext: {
        title: 'Runtime Enchant',
        description: 'Runtime enchant description',
        price: 65,
      },
    },
    upgradeCard: () => {},
    cancelUpgrade: () => {},
    applyEnchantment: () => true,
    cancelEnchant: () => {},
    getEnchantPreview: () => null,
    getRelicUpgradeInfo: () => ({
      currentLevel: 1,
      maxLevel: 3,
      canUpgrade: true,
      canAfford: true,
      nextLevelCost: 50,
      effectDescription: 'Runtime relic upgrade',
    }),
    upgradeRelic: () => true,
    cancelRelicUpgrade: () => {},
    ...overrides,
  } as unknown as GameEngine;
}

test('UpgradeView renders runtime-v2 upgrade choices when legacy deck is empty', () => {
  const engine = createSurfaceEngine();
  const renderModel = {
    screen: 'Upgrade',
    room: {
      kind: 'upgrade',
      choices: [
        {
          id: '0:gather_intel',
          label: 'Runtime Upgrade Card',
          description: 'Projected upgrade choice',
          disabled: false,
        },
      ],
    },
  } as RenderModel;

  const html = renderToStaticMarkup(<UpgradeView engine={engine} renderModel={renderModel} />);

  assert.match(html, /Runtime Upgrade Card/);
  assert.match(html, /Projected upgrade choice/);
  assert.match(html, /data-runtime-choice-id="0:gather_intel"/);
  assert.doesNotMatch(html, /记忆印痕库中没有可强化的卡牌/);
});

test('EnchantView renders runtime-v2 enchant choices when legacy deck is empty', () => {
  const engine = createSurfaceEngine();
  const renderModel = {
    screen: 'Enchant',
    room: {
      kind: 'enchant',
      title: 'Runtime Enchant',
      body: 'Projected enchant body',
      choices: [
        {
          id: '0:precision_strike',
          label: 'Runtime Enchant Card',
          description: 'Projected enchant choice',
          disabled: false,
        },
      ],
    },
  } as RenderModel;

  const html = renderToStaticMarkup(<EnchantView engine={engine} renderModel={renderModel} />);

  assert.match(html, /Runtime Enchant Card/);
  assert.match(html, /Projected enchant choice/);
  assert.match(html, /data-runtime-choice-id="0:precision_strike"/);
  assert.doesNotMatch(html, /当前没有可接受附魔的攻击或技能牌/);
});

test('RelicUpgradeView renders runtime-v2 relic choices when legacy relic inventory is empty', () => {
  const engine = createSurfaceEngine();
  const renderModel = {
    screen: 'RelicUpgrade',
    room: {
      kind: 'relic_upgrade',
      choices: [
        {
          id: 'burning_blood',
          label: 'Runtime Relic Choice',
          description: 'Projected relic upgrade choice',
          disabled: false,
        },
      ],
    },
  } as RenderModel;

  const html = renderToStaticMarkup(<RelicUpgradeView engine={engine} renderModel={renderModel} />);

  assert.match(html, /Runtime Relic Choice/);
  assert.match(html, /Projected relic upgrade choice/);
  assert.match(html, /data-runtime-choice-id="burning_blood"/);
  assert.doesNotMatch(html, /当前没有可升级的遗物/);
});

test('UpgradeView and EnchantView keep legacy card instances when legacy deck is available', () => {
  const engine = createSurfaceEngine({}, [createRuntimeCard()]);
  const upgradeModel = {
    screen: 'Upgrade',
    room: {
      kind: 'upgrade',
      choices: [{ id: '0:gather_intel', label: 'Runtime Upgrade Card', disabled: false }],
    },
  } as RenderModel;
  const enchantModel = {
    screen: 'Enchant',
    room: {
      kind: 'enchant',
      choices: [{ id: '0:gather_intel', label: 'Runtime Enchant Card', disabled: false }],
    },
  } as RenderModel;

  const upgradeHtml = renderToStaticMarkup(<UpgradeView engine={engine} renderModel={upgradeModel} />);
  const enchantHtml = renderToStaticMarkup(<EnchantView engine={engine} renderModel={enchantModel} />);

  assert.match(upgradeHtml, /Legacy Card/);
  assert.match(enchantHtml, /Legacy Card/);
  assert.doesNotMatch(upgradeHtml, /Runtime Upgrade Card/);
  assert.doesNotMatch(enchantHtml, /Runtime Enchant Card/);
});

test('UpgradeView does not show runtime choices when legacy deck has no upgrade targets', () => {
  const engine = createSurfaceEngine({}, [createRuntimeCard({ upgrade: undefined })]);
  const renderModel = {
    screen: 'Upgrade',
    room: {
      kind: 'upgrade',
      choices: [{ id: '0:legacy_card', label: 'Runtime Upgrade Card', disabled: false }],
    },
  } as RenderModel;

  const html = renderToStaticMarkup(<UpgradeView engine={engine} renderModel={renderModel} />);

  assert.match(html, /记忆印痕库中没有可强化的卡牌/);
  assert.doesNotMatch(html, /Runtime Upgrade Card/);
  assert.doesNotMatch(html, /data-runtime-choice-id=/);
});

test('EnchantView does not show runtime choices when legacy deck has no enchant targets', () => {
  const engine = createSurfaceEngine({}, [
    createRuntimeCard({
      type: 'Power',
      persistentEnchantments: [
        {
          id: 'existing_enchant',
          label: 'Existing Enchant',
          scope: 'persistent',
          effect: {},
        },
      ] as any,
    }),
  ]);
  const renderModel = {
    screen: 'Enchant',
    room: {
      kind: 'enchant',
      choices: [{ id: '0:legacy_card', label: 'Runtime Enchant Card', disabled: false }],
    },
  } as RenderModel;

  const html = renderToStaticMarkup(<EnchantView engine={engine} renderModel={renderModel} />);

  assert.match(html, /当前没有可接受附魔的攻击或技能牌/);
  assert.doesNotMatch(html, /Runtime Enchant Card/);
  assert.doesNotMatch(html, /data-runtime-choice-id=/);
});

test('RelicUpgradeView does not show runtime choices when legacy relics are not upgradeable', () => {
  const engine = createSurfaceEngine({
    state: {
      character: null,
      routeState: null,
      player: {
        deck: [],
        relics: ['non_upgradeable_relic'],
        relicStates: {
          non_upgradeable_relic: { level: 1, progress: 0, corrupted: false },
        },
        gold: 100,
      },
      enchantContext: null,
    },
  } as unknown as Partial<GameEngine>);
  const renderModel = {
    screen: 'RelicUpgrade',
    room: {
      kind: 'relic_upgrade',
      choices: [{ id: 'non_upgradeable_relic', label: 'Runtime Relic Choice', disabled: false }],
    },
  } as RenderModel;

  const html = renderToStaticMarkup(<RelicUpgradeView engine={engine} renderModel={renderModel} />);

  assert.match(html, /当前没有可升级的遗物/);
  assert.doesNotMatch(html, /Runtime Relic Choice/);
  assert.doesNotMatch(html, /data-runtime-choice-id=/);
});

test('UpgradeView sorts legacy card targets from runtime-v2 routeState before stale legacy routeState', () => {
  const warpCard = createRuntimeCard({
    id: 'temporal_mastery',
    name: 'Runtime Warp Upgrade',
    instanceId: 'warp-upgrade-instance',
    baseCardId: 'temporal_mastery',
  });
  const delayCard = createRuntimeCard({
    id: 'time_bomb',
    name: 'Runtime Delay Upgrade',
    instanceId: 'delay-upgrade-instance',
    baseCardId: 'time_bomb',
  });
  const engine = createSurfaceEngine(
    {
      state: {
        character: { id: 'chronomancer' },
        routeState: createRouteState('chronomancer:delay'),
        player: {
          deck: [delayCard, warpCard],
          relics: [],
          relicStates: {},
          gold: 100,
        },
        enchantContext: null,
      },
    } as unknown as Partial<GameEngine>,
  );
  const renderModel = {
    screen: 'Upgrade',
    player: {
      characterId: 'chronomancer',
      deck: ['temporal_mastery'],
    },
    routeState: createRouteState('chronomancer:warp'),
    room: {
      kind: 'upgrade',
      choices: [],
    },
  } as unknown as RenderModel;

  const html = renderToStaticMarkup(<UpgradeView engine={engine} renderModel={renderModel} />);

  assert.ok(
    html.indexOf('Runtime Warp Upgrade') < html.indexOf('Runtime Delay Upgrade'),
    'runtime-v2 warp route should sort warp card before stale legacy delay route',
  );
});

test('EnchantView sorts legacy card targets from runtime-v2 routeState before stale legacy routeState', () => {
  const warpCard = createRuntimeCard({
    id: 'temporal_mastery',
    name: 'Runtime Warp Enchant',
    instanceId: 'warp-enchant-instance',
    baseCardId: 'temporal_mastery',
  });
  const delayCard = createRuntimeCard({
    id: 'time_bomb',
    name: 'Runtime Delay Enchant',
    instanceId: 'delay-enchant-instance',
    baseCardId: 'time_bomb',
  });
  const engine = createSurfaceEngine(
    {
      state: {
        character: { id: 'chronomancer' },
        routeState: createRouteState('chronomancer:delay'),
        player: {
          deck: [delayCard, warpCard],
          relics: [],
          relicStates: {},
          gold: 100,
        },
        enchantContext: {
          title: 'Runtime Enchant',
          description: 'Runtime enchant description',
          price: 65,
        },
      },
    } as unknown as Partial<GameEngine>,
  );
  const renderModel = {
    screen: 'Enchant',
    player: {
      characterId: 'chronomancer',
      deck: ['temporal_mastery'],
    },
    routeState: createRouteState('chronomancer:warp'),
    room: {
      kind: 'enchant',
      choices: [],
    },
  } as unknown as RenderModel;

  const html = renderToStaticMarkup(<EnchantView engine={engine} renderModel={renderModel} />);

  assert.ok(
    html.indexOf('Runtime Warp Enchant') < html.indexOf('Runtime Delay Enchant'),
    'runtime-v2 warp route should sort warp card before stale legacy delay route',
  );
});

test('RelicUpgradeView labels relic route affinity from runtime-v2 routeState before stale legacy routeState', () => {
  const engine = createSurfaceEngine(
    {
      state: {
        character: { id: 'chronomancer' },
        routeState: createRouteState('chronomancer:delay'),
        player: {
          deck: [],
          relics: ['lantern'],
          relicStates: {
            lantern: { level: 1, progress: 0, corrupted: false },
          },
          gold: 100,
        },
        enchantContext: null,
      },
    } as unknown as Partial<GameEngine>,
  );
  const renderModel = {
    screen: 'RelicUpgrade',
    player: {
      characterId: 'chronomancer',
      deck: ['temporal_mastery'],
    },
    routeState: createRouteState('chronomancer:warp'),
    room: {
      kind: 'relic_upgrade',
      choices: [],
    },
  } as unknown as RenderModel;

  const html = renderToStaticMarkup(<RelicUpgradeView engine={engine} renderModel={renderModel} />);

  assert.match(html, /当前路线强化：跃迁链/);
  assert.doesNotMatch(html, /当前路线强化：延时链/);
});
