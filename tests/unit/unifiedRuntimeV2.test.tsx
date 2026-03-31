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
