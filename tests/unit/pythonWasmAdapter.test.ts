/**
 * @file pythonWasmAdapter.test.ts
 * @description Unit tests for the Python WASM adapter snapshot envelope unwrapping.
 *
 * 主要职责:
 * - 测试裸快照载荷的透传
 * - 测试 dispatch 信封的解包
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { unwrapPythonSnapshotEnvelope } from '@/runtimeV2/bridge/pythonWasmAdapter';

test('unwrapPythonSnapshotEnvelope accepts a bare snapshot payload', () => {
  const payload = { lifecycle: { screen: 'Map' }, player: { hp: 10 } };
  assert.deepEqual(unwrapPythonSnapshotEnvelope(payload), payload);
});

test('unwrapPythonSnapshotEnvelope unwraps dispatch envelopes to the nested snapshot', () => {
  const snapshot = { lifecycle: { screen: 'Map' }, player: { hp: 10 } };
  const payload = {
    snapshot,
    events: [{ type: 'runtime.select_character' }],
  };

  assert.deepEqual(unwrapPythonSnapshotEnvelope(payload), snapshot);
});
