/**
 * @file rewardViewRenderModel.test.tsx
 * @description Regression coverage for runtime-v2 RewardView render choices.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import type { GameEngine } from '@/core';
import type { RenderModel } from '@/runtimeV2';
import { RewardView } from '@/ui/views/RewardView';

function createRewardEngine(): GameEngine {
  return {
    state: {
      rewardCards: [],
    },
    pickRewardCard: () => {},
    skipReward: () => {},
  } as unknown as GameEngine;
}

test('RewardView renders runtime-v2 reward cards when legacy reward cards are empty', () => {
  const engine = createRewardEngine();
  const renderModel = {
    screen: 'Reward',
    lifecycle: {
      screen: 'Reward',
      phase: 'reward',
      pendingNodeResolution: true,
    },
    reward: {
      source: 'combat',
      cardIds: ['runtime_precision_strike'],
      offerCount: 1,
      cards: [
        {
          id: 'runtime_precision_strike',
          name: 'Runtime Precision Strike',
          cost: 1,
          rarity: 'Common',
          type: 'Attack',
          description: 'Projected runtime reward card',
        },
      ],
    },
  } as RenderModel;

  const html = renderToStaticMarkup(<RewardView engine={engine} renderModel={renderModel} />);

  assert.match(html, /Runtime Precision Strike/);
  assert.match(html, /Projected runtime reward card/);
  assert.match(html, /data-reward-card-id="runtime_precision_strike"/);
  assert.match(html, /data-keyboard-option="1"/);
  assert.doesNotMatch(html, /没有可回收的战术残片/);
});

test('RewardView prefers runtime-v2 reward cards over stale legacy reward cards', () => {
  const engine = createRewardEngine();
  (engine.state as any).rewardCards = [
    {
      id: 'strike',
      instanceId: 'stale_reward_1',
      name: 'Stale Legacy Strike',
      cost: 1,
      rarity: 'Common',
      type: 'Attack',
      targeting: 'Enemy',
      tags: [],
      actions: [],
      persistentEnchantments: [],
      combatAfflictions: [],
    },
  ];
  const renderModel = {
    screen: 'Reward',
    lifecycle: {
      screen: 'Reward',
      phase: 'reward',
      pendingNodeResolution: true,
    },
    reward: {
      source: 'combat',
      cardIds: ['runtime_precision_strike'],
      offerCount: 1,
      cards: [
        {
          id: 'runtime_precision_strike',
          name: 'Runtime Precision Strike',
          cost: 1,
          rarity: 'Common',
          type: 'Attack',
          description: 'Projected runtime reward card',
        },
      ],
    },
  } as RenderModel;

  const html = renderToStaticMarkup(<RewardView engine={engine} renderModel={renderModel} />);

  assert.match(html, /Runtime Precision Strike/);
  assert.match(html, /data-reward-card-id="runtime_precision_strike"/);
  assert.doesNotMatch(html, /Stale Legacy Strike/);
  assert.doesNotMatch(html, /data-reward-card-id="strike"/);
});
