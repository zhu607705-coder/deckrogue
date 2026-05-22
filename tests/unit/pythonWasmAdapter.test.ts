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

test('PythonWasmAdapter dispose prevents an in-flight start from restoring a snapshot', async () => {
  const calls: string[] = [];
  const previousWindow = (globalThis as any).window;
  let resolveLoader: ((pyodide: any) => void) | null = null;
  const loadPromise = new Promise<any>((resolve) => {
    resolveLoader = resolve;
  });
  (globalThis as any).window = {
    loadPyodide: () => loadPromise,
  };

  try {
    const adapter = new PythonWasmAdapter();
    const startPromise = adapter.start({ seed: 7 });
    await Promise.resolve();
    adapter.dispose();

    assert.ok(resolveLoader);
    resolveLoader({
      globals: { set(): void {} },
      runPythonAsync: async (code: string) => {
        calls.push(code);
        return {
          toJs: () => ({ snapshot: makePythonSnapshot('CharacterSelect') }),
        };
      },
    });

    await assert.rejects(startPromise, /disposed/i);
    assert.equal(adapter.getSnapshot(), null);
    assert.equal(calls.some((code) => code.trimStart().startsWith('init_runtime(')), false);
  } finally {
    (globalThis as any).window = previousWindow;
  }
});

test('PythonWasmAdapter retries Pyodide runtime injection after a half-boot failure', async () => {
  const previousWindow = (globalThis as any).window;
  const calls: string[] = [];
  let loadCount = 0;
  (globalThis as any).window = {
    loadPyodide: async () => {
      loadCount += 1;
      const currentLoad = loadCount;
      return {
        globals: { set(): void {} },
        runPythonAsync: async (code: string) => {
          calls.push(`${currentLoad}:${code.trimStart().startsWith('init_runtime(') ? 'init' : 'runtime'}`);
          if (currentLoad === 1 && !code.trimStart().startsWith('init_runtime(')) {
            throw new Error('runtime code injection failed');
          }
          if (currentLoad === 1 && code.trimStart().startsWith('init_runtime(')) {
            throw new Error('init_runtime is not defined');
          }
          return {
            toJs: () => ({ snapshot: makePythonSnapshot('CharacterSelect') }),
          };
        },
      };
    },
  };

  try {
    const adapter = new PythonWasmAdapter();
    await assert.rejects(adapter.start({ seed: 11 }), /runtime code injection failed/);

    const snapshot = await adapter.start({ seed: 11 });

    assert.equal(snapshot.lifecycle.screen, 'CharacterSelect');
    assert.equal(loadCount, 2);
    assert.deepEqual(calls, ['1:runtime', '2:runtime', '2:init']);
  } finally {
    (globalThis as any).window = previousWindow;
  }
});

test('PythonWasmAdapter replaces stale Pyodide loader scripts instead of waiting forever', async () => {
  const previousWindow = (globalThis as any).window;
  const previousDocument = (globalThis as any).document;
  let staleRemoved = false;
  let appendedScript: any = null;
  const calls: string[] = [];
  const staleScript = {
    dataset: { pyodideLoader: 'true' },
    addEventListener(): void {},
    remove(): void {
      staleRemoved = true;
    },
  };

  (globalThis as any).window = {};
  (globalThis as any).document = {
    querySelector: () => staleScript,
    createElement: () => {
      const listeners = new Map<string, () => void>();
      appendedScript = {
        dataset: {},
        addEventListener(type: string, listener: () => void): void {
          listeners.set(type, listener);
        },
        dispatch(type: string): void {
          listeners.get(type)?.();
        },
      };
      return appendedScript;
    },
    head: {
      appendChild(script: any): void {
        (globalThis as any).window.loadPyodide = async () => ({
          globals: { set(): void {} },
          runPythonAsync: async (code: string) => {
            calls.push(code);
            return {
              toJs: () => ({ snapshot: makePythonSnapshot('CharacterSelect') }),
            };
          },
        });
        queueMicrotask(() => script.dispatch('load'));
      },
    },
  };

  try {
    const adapter = new PythonWasmAdapter();
    const result = await Promise.race([
      adapter.start({ seed: 3 }),
      new Promise<'pending'>((resolve) => setTimeout(() => resolve('pending'), 25)),
    ]);

    assert.notEqual(result, 'pending', 'stale loader script should not leave start pending');
    assert.equal(staleRemoved, true);
    assert.ok(appendedScript);
    assert.equal(appendedScript.dataset.pyodideLoader, 'true');
    assert.equal((result as any).lifecycle.screen, 'CharacterSelect');
    assert.ok(calls.some((code) => code.trimStart().startsWith('init_runtime(')));
  } finally {
    (globalThis as any).window = previousWindow;
    (globalThis as any).document = previousDocument;
  }
});
