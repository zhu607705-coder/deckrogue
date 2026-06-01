/**
 * @file mapViewRenderModel.test.tsx
 * @description Regression coverage for runtime-v2 map render nodes.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import type { GameEngine } from '@/core';
import type { RenderModel } from '@/runtimeV2';
import { MapView } from '@/ui/views/MapView';

function createMapEngine(): GameEngine {
  return {
    state: {
      map: [],
      currentNodeId: null,
      pendingNodeResolution: false,
      character: { id: 'informant' },
      player: {
        hp: 52,
        maxHp: 70,
        energy: 3,
        maxEnergy: 3,
        intel: 1,
        relics: [],
        deck: [],
      },
    },
    enterNode: () => {},
    revealNode: () => {},
  } as unknown as GameEngine;
}

test('MapView renders runtime-v2 map nodes when legacy map state is empty', () => {
  const engine = createMapEngine();
  const renderModel = {
    screen: 'Map',
    lifecycle: {
      screen: 'Map',
      phase: 'map',
      pendingNodeResolution: false,
    },
    map: {
      currentNodeId: null,
      currentFloor: null,
      revealedNodeIds: ['runtime-combat-1'],
      availableNodeIds: ['runtime-combat-1'],
      nodes: [
        {
          id: 'runtime-combat-1',
          type: 'Combat',
          x: 0.5,
          y: 0,
          revealed: true,
          next: ['runtime-event-2'],
        },
        {
          id: 'runtime-event-2',
          type: 'Event',
          x: 0.55,
          y: 1,
          revealed: false,
          next: [],
        },
      ],
    },
  } as RenderModel;

  const html = renderToStaticMarkup(<MapView engine={engine} renderModel={renderModel} />);

  assert.match(html, /data-node-id="runtime-combat-1"/);
  assert.match(html, /data-keyboard-option="1"/);
  assert.match(html, /可选路线/);
  assert.doesNotMatch(html, /Infinity/);
  assert.doesNotMatch(html, /NaN/);
});

test('MapView trusts runtime-v2 map pending state and player summary over stale legacy state', () => {
  const engine = createMapEngine();
  engine.state.pendingNodeResolution = true;
  engine.state.player.hp = 1;
  engine.state.player.maxHp = 99;
  engine.state.player.energy = 0;
  engine.state.player.maxEnergy = 0;
  engine.state.player.intel = 0;
  engine.state.player.relics = ['legacy_relic'];
  engine.state.player.deck = [{ id: 'legacy_card' }] as any;

  const renderModel = {
    screen: 'Map',
    lifecycle: {
      screen: 'Map',
      phase: 'map',
      pendingNodeResolution: false,
    },
    player: {
      characterId: 'informant',
      hp: 44,
      maxHp: 70,
      gold: 0,
      deck: [],
      deckCount: 7,
      relicCount: 3,
      potionCount: 0,
      intel: 4,
      devotion: 0,
      corruption: 0,
      energy: 3,
      maxEnergy: 3,
      healthRatio: 44 / 70,
    },
    map: {
      currentNodeId: null,
      currentFloor: null,
      revealedNodeIds: ['runtime-combat-1'],
      availableNodeIds: ['runtime-combat-1'],
      nodes: [
        {
          id: 'runtime-combat-1',
          type: 'Combat',
          x: 0.5,
          y: 0,
          revealed: true,
          next: [],
        },
      ],
    },
  } as RenderModel;

  const html = renderToStaticMarkup(<MapView engine={engine} renderModel={renderModel} />);

  assert.match(html, /data-node-id="runtime-combat-1"/);
  assert.match(html, /data-keyboard-option="1"/);
  assert.match(html, /生命值<\/span><span class="grimdark-resource-value">44\/70/);
  assert.match(html, /能量<\/span><span class="grimdark-resource-value">3\/3/);
  assert.match(html, /grimdark-terminal-sensor-value text-lg font-bold">4<\/span>/);
  assert.match(html, /遗物<\/span><span class="grimdark-resource-value">3/);
  assert.match(html, /牌库<\/span><span class="grimdark-resource-value">7/);
  assert.doesNotMatch(html, /巡逻结算中/);
});
