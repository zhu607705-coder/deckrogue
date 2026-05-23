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
