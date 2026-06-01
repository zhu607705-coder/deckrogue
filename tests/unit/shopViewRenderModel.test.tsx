/**
 * @file shopViewRenderModel.test.tsx
 * @description Regression coverage for runtime-v2 ShopView render offers.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import type { GameEngine } from '@/core';
import type { RenderModel } from '@/runtimeV2';
import { ShopView } from '@/ui/views/ShopView';

function createShopEngine(): GameEngine {
  return {
    state: {
      character: null,
      routeState: null,
      shopCards: [],
      shopRelics: [],
      shopPotions: [],
      cardRemovalCost: 75,
      player: {
        gold: 120,
        deck: [],
        potions: [],
        relics: [],
        relicStates: {},
      },
    },
    getAdjustedShopPrice: (price: number) => price,
    buyShopCard: () => {},
    buyShopRelic: () => {},
    buyShopPotion: () => {},
    enterUpgrade: () => {},
    enterCardRemoval: () => {},
    enterShopEnchant: () => {},
    shopPurify: () => false,
    mixPotions: () => false,
    leaveCurrentRoomToMap: () => {},
  } as unknown as GameEngine;
}

test('ShopView renders runtime-v2 shop offers when legacy shop stock is empty', () => {
  const engine = createShopEngine();
  const renderModel = {
    screen: 'Shop',
    lifecycle: {
      screen: 'Shop',
      phase: 'shop',
      pendingNodeResolution: true,
    },
    player: {
      gold: 120,
      deck: [],
      deckCount: 0,
      potionCount: 0,
    },
    room: {
      kind: 'shop',
      cardCount: 1,
      relicCount: 1,
      potionStockCount: 1,
      canRemove: true,
      canEnchant: true,
      cardRemovalCost: 75,
      cards: [
        {
          id: 'runtime_shop_strike',
          name: 'Runtime Shop Strike',
          price: 50,
          rarity: 'Common',
          type: 'Attack',
          description: 'Projected shop card',
        },
      ],
      relics: [
        {
          id: 'runtime_shop_relic',
          name: 'Runtime Shop Relic',
          price: 80,
          type: 'Relic',
          description: 'Projected shop relic',
        },
      ],
      potions: [
        {
          id: 'runtime_shop_potion',
          name: 'Runtime Shop Potion',
          price: 40,
          type: 'Potion',
          description: 'Projected shop potion',
        },
      ],
    },
  } as RenderModel;

  const html = renderToStaticMarkup(<ShopView engine={engine} renderModel={renderModel} />);

  assert.match(html, /Runtime Shop Strike/);
  assert.match(html, /Projected shop card/);
  assert.match(html, /Runtime Shop Relic/);
  assert.match(html, /Projected shop relic/);
  assert.match(html, /Runtime Shop Potion/);
  assert.match(html, /Projected shop potion/);
  assert.match(html, /data-shop-card-id="runtime_shop_strike"/);
  assert.doesNotMatch(html, /库存售罄/);
});

test('ShopView enables runtime-v2 potion mixing when legacy player potions are empty', () => {
  const engine = createShopEngine();
  const renderModel = {
    screen: 'Shop',
    lifecycle: {
      screen: 'Shop',
      phase: 'shop',
      pendingNodeResolution: true,
    },
    player: {
      gold: 120,
      deck: [],
      deckCount: 0,
      potionCount: 2,
      potionIds: ['healing_potion', 'block_potion'],
    },
    room: {
      kind: 'shop',
      cardCount: 0,
      relicCount: 0,
      potionStockCount: 0,
      canMix: true,
      canRemove: false,
      canEnchant: false,
      cardRemovalCost: 75,
      cards: [],
      relics: [],
      potions: [],
    },
  } as unknown as RenderModel;

  const html = renderToStaticMarkup(<ShopView engine={engine} renderModel={renderModel} />);

  assert.match(html, /疗愈药剂/);
  assert.match(html, /护盾药剂/);
  assert.match(html, />蒸馏</);
  assert.doesNotMatch(html, /<button[^>]*disabled=""[^>]*>\s*蒸馏/);
});

test('ShopView derives route advice from runtime-v2 deck when legacy deck is empty', () => {
  const engine = createShopEngine();
  engine.state.character = { id: 'chronomancer' } as any;
  const renderModel = {
    screen: 'Shop',
    lifecycle: {
      screen: 'Shop',
      phase: 'shop',
      pendingNodeResolution: true,
    },
    player: {
      characterId: 'chronomancer',
      gold: 120,
      deck: ['warp_surge', 'temporal_mastery'],
      deckCount: 2,
      potionCount: 0,
      potionIds: [],
    },
    routeState: null,
    room: {
      kind: 'shop',
      cardCount: 0,
      relicCount: 0,
      potionStockCount: 0,
      canUpgrade: true,
      canRemove: true,
      canEnchant: true,
      cardRemovalCost: 75,
      cards: [],
      relics: [],
      potions: [],
    },
  } as unknown as RenderModel;

  const html = renderToStaticMarkup(<ShopView engine={engine} renderModel={renderModel} />);

  assert.match(html, /当前路线：跃迁链/);
  assert.match(html, /当前路线强化：跃迁链/);
});

test('ShopView derives route advice from runtime-v2 routeState before legacy routeState', () => {
  const engine = createShopEngine();
  engine.state.character = { id: 'chronomancer' } as any;
  engine.state.routeState = {
    primaryTag: 'chronomancer:delay',
    secondaryTag: null,
    confidence: 90,
    stage: 'committed',
    recentCommits: [],
  };
  const renderModel = {
    screen: 'Shop',
    lifecycle: {
      screen: 'Shop',
      phase: 'shop',
      pendingNodeResolution: true,
    },
    player: {
      characterId: 'chronomancer',
      gold: 120,
      deck: ['temporal_mastery'],
      deckCount: 1,
      potionCount: 0,
      potionIds: [],
    },
    routeState: {
      primaryTag: 'chronomancer:warp',
      secondaryTag: null,
      confidence: 90,
      stage: 'committed',
      recentCommits: [],
    },
    room: {
      kind: 'shop',
      cardCount: 0,
      relicCount: 0,
      potionStockCount: 0,
      canUpgrade: true,
      canRemove: true,
      canEnchant: true,
      cardRemovalCost: 75,
      cards: [],
      relics: [],
      potions: [],
    },
  } as unknown as RenderModel;

  const html = renderToStaticMarkup(<ShopView engine={engine} renderModel={renderModel} />);

  assert.match(html, /当前路线：跃迁链/);
  assert.doesNotMatch(html, /延迟爆破/);
});
