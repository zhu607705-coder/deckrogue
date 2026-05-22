/**
 * @file pythonWasmAdapter.test.ts
 * @description Python WASM adapter contract regressions.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { PythonWasmAdapter } from '@/runtimeV2/bridge/pythonWasmAdapter';

function makePythonSnapshot(screen: string) {
  return {
    schema_version: 2,
    engine_version: 'test',
    seed: 1,
    lifecycle: {
      screen,
      phase: screen === 'Map' ? 'map' : 'character_select',
      pending_node_resolution: false,
    },
    player: {
      character_id: null,
      hp: 0,
      max_hp: 0,
      gold: 0,
      intel: 0,
      devotion: 0,
      corruption: 0,
      secondary_resources: {},
      deck: [],
      relic_ids: [],
      potion_ids: [],
      relic_states: {},
    },
    map: {
      current_node_id: null,
      nodes: [],
    },
    combat: null,
    reward: null,
    shop: null,
    active_event: null,
    route_state: null,
    surface_context: null,
    room_session: null,
    meta: {
      run_id: null,
      replay_length: 0,
      generated_at: '2026-05-22T00:00:00.000Z',
      adapter: 'python-wasm',
      runtime_rng_state: 0,
    },
  };
}

test('PythonWasmAdapter dispatch auto-starts before running commands', async () => {
  const calls: string[] = [];
  const globals = new Map<string, unknown>();
  const previousWindow = (globalThis as any).window;
  (globalThis as any).window = {
    loadPyodide: async () => ({
      globals: {
        set(name: string, value: unknown): void {
          globals.set(name, value);
        },
      },
      runPythonAsync: async (code: string) => {
        calls.push(code);
        return {
          toJs: () => code.includes('dispatch_command')
            ? { snapshot: makePythonSnapshot('Map') }
            : { snapshot: makePythonSnapshot('CharacterSelect') },
        };
      },
    }),
  };

  try {
    const adapter = new PythonWasmAdapter();
    const snapshot = await adapter.dispatch({ type: 'select_character', characterId: 'informant' } as any);

    const initIndex = calls.findIndex((code) => code.trimStart().startsWith('init_runtime('));
    const dispatchIndex = calls.findIndex((code) => code.trimStart().startsWith('dispatch_command('));
    assert.ok(initIndex >= 0, 'dispatch should initialize the runtime first');
    assert.ok(dispatchIndex > initIndex, 'dispatch command should run after init_runtime');
    assert.equal(snapshot.lifecycle.screen, 'Map');
    assert.ok(globals.has('__deckrogue_content_bundle_json'));
    assert.ok(globals.has('__deckrogue_command_json'));
  } finally {
    (globalThis as any).window = previousWindow;
  }
});
