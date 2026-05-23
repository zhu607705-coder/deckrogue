/**
 * @file removeCardViewRenderModel.test.tsx
 * @description Regression coverage for runtime-v2 RemoveCard render choices.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { GameEngine, type RunCardInstance } from '@/core';
import type { RenderModel } from '@/runtimeV2';
import { RemoveCardView } from '@/ui/views/RemoveCardView';

function createRuntimeCard(overrides: Partial<RunCardInstance> = {}): RunCardInstance {
  return {
    id: 'legacy_card',
    name: 'Legacy Card',
    rarity: 'Common',
    cost: 1,
    type: 'Skill',
    targeting: 'Self',
    tags: [],
    text: 'Legacy instance should keep its instance id removal path.',
    actions: [],
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
      text: 'Legacy instance should keep its instance id removal path.',
      actions: [],
    },
    persistentEnchantments: [],
    combatAfflictions: [],
    ...overrides,
  };
}

function createRenderModelOnlyEngine(deck: RunCardInstance[] = []): GameEngine {
  return {
    state: {
      player: {
        deck,
      },
      cardRemovalCost: 75,
    },
    isEventFreeCardRemovalMode: () => false,
    getEventFreeRemovalsRemaining: () => 0,
    getCardRemovalCostForCard: () => 75,
    removeCard: () => {},
    cancelCardRemoval: () => {},
  } as unknown as GameEngine;
}

test('RemoveCardView renders runtime-v2 remove-card choices when legacy deck is empty', () => {
  const engine = createRenderModelOnlyEngine();
  const renderModel = {
    screen: 'RemoveCard',
    room: {
      kind: 'remove_card',
      cardRemovalCost: 125,
      choices: [
        {
          id: '0:gather_intel',
          label: 'Runtime-only Strike',
          description: 'Projected from runtime-v2 room choices',
          disabled: false,
        },
      ],
    },
  } as RenderModel;

  const html = renderToStaticMarkup(<RemoveCardView engine={engine} renderModel={renderModel} />);

  assert.match(html, /Runtime-only Strike/);
  assert.match(html, /Projected from runtime-v2 room choices/);
  assert.match(html, /125 信用筹码/);
  assert.match(html, /data-runtime-choice-id="0:gather_intel"/);
  assert.match(html, /data-keyboard-option="1"/);
});

test('RemoveCardView keeps legacy card instances when the legacy deck is available', () => {
  const engine = createRenderModelOnlyEngine([createRuntimeCard()]);
  const renderModel = {
    screen: 'RemoveCard',
    room: {
      kind: 'remove_card',
      cardRemovalCost: 125,
      choices: [
        {
          id: '0:gather_intel',
          label: 'Runtime-only Strike',
          description: 'Projected from runtime-v2 room choices',
          disabled: false,
        },
      ],
    },
  } as RenderModel;

  const html = renderToStaticMarkup(<RemoveCardView engine={engine} renderModel={renderModel} />);

  assert.match(html, /Legacy Card/);
  assert.doesNotMatch(html, /Runtime-only Strike/);
  assert.doesNotMatch(html, /data-runtime-choice-id=/);
});
