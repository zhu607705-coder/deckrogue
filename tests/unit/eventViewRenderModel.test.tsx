/**
 * @file eventViewRenderModel.test.tsx
 * @description Regression coverage for runtime-v2 EventView room choices.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import type { GameEngine } from '@/core';
import type { RenderModel } from '@/runtimeV2';
import { EventView } from '@/ui/views/EventView';

function createEventEngine(): GameEngine {
  return {
    state: {
      activeEvent: null,
      currentNodeId: null,
      map: [],
      player: {
        hp: 50,
        maxHp: 70,
        gold: 0,
        intel: 0,
        devotion: 0,
        corruption: 0,
      },
    },
    resolveEventChoice: () => {},
    leaveCurrentRoomToMap: () => {},
  } as unknown as GameEngine;
}

test('EventView renders runtime-v2 event choices when legacy activeEvent is empty', () => {
  const engine = createEventEngine();
  const renderModel = {
    screen: 'Event',
    lifecycle: {
      screen: 'Event',
      phase: 'event',
      pendingNodeResolution: true,
    },
    room: {
      kind: 'event',
      title: 'Runtime Signal Shrine',
      body: 'A runtime-only event body arrives from the Python adapter.',
      guidance: {
        routeTag: 'informant:evidence',
        routeLabel: 'Evidence',
        headline: 'Favor evidence',
        reason: 'Runtime guidance should be visible.',
        recommendedActionId: 'runtime_pray',
      },
      choices: [
        {
          id: 'runtime_pray',
          label: 'Read the runtime signal',
          description: 'Gain a clue from runtimeV2.',
          disabled: false,
          routeReason: 'Evidence route payoff',
        },
      ],
    },
  } as RenderModel;

  const html = renderToStaticMarkup(<EventView engine={engine} renderModel={renderModel} />);

  assert.match(html, /Runtime Signal Shrine/);
  assert.match(html, /runtime-only event body/);
  assert.match(html, /Favor evidence/);
  assert.match(html, /Read the runtime signal/);
  assert.match(html, /Gain a clue from runtimeV/);
  assert.match(html, /data-event-choice-id="runtime_pray"/);
  assert.match(html, /data-keyboard-option="1"/);
  assert.doesNotMatch(html, /无事件记录/);
});
