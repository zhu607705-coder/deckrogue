/**
 * @file pythonWasmRuntimeSync.test.ts
 * @description Locks the browser Python WASM runtime to the package runtime source.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { PYTHON_RUNTIME_CODE } from '@/content/narrative/pythonRuntime';

function normalizeSource(source: string): string {
  return source.replace(/\r\n?/g, '\n');
}

test('embedded Python WASM runtime matches the package runtime source', () => {
  const source = normalizeSource(readFileSync('python_runtime/src/deckrogue_rules_core/runtime.py', 'utf-8'));

  assert.equal(PYTHON_RUNTIME_CODE, source);
  assert.match(PYTHON_RUNTIME_CODE, /SECONDARY_RESOURCES/);
  assert.match(PYTHON_RUNTIME_CODE, /def create_save_game_v2/);
  assert.match(PYTHON_RUNTIME_CODE, /def restore_snapshot_from_save_game/);
});
