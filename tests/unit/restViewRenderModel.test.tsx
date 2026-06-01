/**
 * @file restViewRenderModel.test.tsx
 * @description Regression coverage for runtime-v2 RestView render-model inputs.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import type { GameEngine } from '@/core';
import type { RenderModel } from '@/runtimeV2';
import { RestView } from '@/ui/views/RestView';

function createRestEngine(): GameEngine {
  return {
    state: {
      character: { id: 'chronomancer' },
      routeState: null,
      player: {
        hp: 48,
        maxHp: 60,
        gold: 120,
        deck: [],
        potions: [],
        relics: [],
        relicStates: {},
      },
    },
    restHeal: () => {},
    enterUpgrade: () => {},
    restEnchant: () => {},
    restDisperse: () => {},
    restUpgradeRelic: () => {},
    mixPotions: () => false,
    leaveCurrentRoomToMap: () => {},
  } as unknown as GameEngine;
}

test('RestView derives route advice from runtime-v2 deck when legacy deck is empty', () => {
  const engine = createRestEngine();
  const renderModel = {
    screen: 'Rest',
    lifecycle: {
      screen: 'Rest',
      phase: 'rest',
      pendingNodeResolution: true,
    },
    player: {
      characterId: 'chronomancer',
      hp: 48,
      maxHp: 60,
      gold: 120,
      deck: ['warp_surge', 'temporal_mastery'],
      deckCount: 2,
      relicCount: 0,
      potionCount: 0,
      potionIds: [],
      intel: 0,
      devotion: 0,
      corruption: 0,
      healthRatio: 0.8,
    },
    routeState: null,
    room: {
      kind: 'rest',
      canHeal: true,
      healAmount: 18,
      canUpgrade: true,
      canEnchant: true,
      canRemove: true,
      canRelicUpgrade: false,
      canMix: false,
      potions: [],
    },
  } as unknown as RenderModel;

  const html = renderToStaticMarkup(<RestView engine={engine} renderModel={renderModel} />);

  assert.match(html, /当前路线：跃迁链/);
  assert.match(html, /当前路线强化：跃迁链/);
});

test('RestView derives heal advice from runtime-v2 hp when legacy hp is stale', () => {
  const engine = createRestEngine();
  const renderModel = {
    screen: 'Rest',
    lifecycle: {
      screen: 'Rest',
      phase: 'rest',
      pendingNodeResolution: true,
    },
    player: {
      characterId: 'chronomancer',
      hp: 10,
      maxHp: 60,
      gold: 120,
      deck: [],
      deckCount: 0,
      relicCount: 0,
      potionCount: 0,
      potionIds: [],
      intel: 0,
      devotion: 0,
      corruption: 0,
      healthRatio: 10 / 60,
    },
    routeState: null,
    room: {
      kind: 'rest',
      canHeal: true,
      healAmount: 18,
      canUpgrade: false,
      canEnchant: false,
      canRemove: false,
      canRelicUpgrade: false,
      canMix: false,
      potions: [],
    },
  } as unknown as RenderModel;

  const html = renderToStaticMarkup(<RestView engine={engine} renderModel={renderModel} />);

  assert.match(html, /推荐先做\s*<span[^>]*>休整<\/span>/);
  assert.match(html, /当前生命偏低，先保住推进节奏/);
});

test('RestView derives route advice from runtime-v2 routeState before legacy routeState', () => {
  const engine = createRestEngine();
  engine.state.routeState = {
    primaryTag: 'chronomancer:delay',
    secondaryTag: null,
    confidence: 90,
    stage: 'committed',
    recentCommits: [],
  };
  const renderModel = {
    screen: 'Rest',
    lifecycle: {
      screen: 'Rest',
      phase: 'rest',
      pendingNodeResolution: true,
    },
    player: {
      characterId: 'chronomancer',
      hp: 48,
      maxHp: 60,
      gold: 120,
      deck: ['temporal_mastery'],
      deckCount: 1,
      relicCount: 0,
      potionCount: 0,
      potionIds: [],
      intel: 0,
      devotion: 0,
      corruption: 0,
      healthRatio: 0.8,
    },
    routeState: {
      primaryTag: 'chronomancer:warp',
      secondaryTag: null,
      confidence: 90,
      stage: 'committed',
      recentCommits: [],
    },
    room: {
      kind: 'rest',
      canHeal: true,
      healAmount: 18,
      canUpgrade: true,
      canEnchant: true,
      canRemove: true,
      canRelicUpgrade: false,
      canMix: false,
      potions: [],
    },
  } as unknown as RenderModel;

  const html = renderToStaticMarkup(<RestView engine={engine} renderModel={renderModel} />);

  assert.match(html, /当前路线：跃迁链/);
  assert.doesNotMatch(html, /延迟爆破/);
});
