import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_RUNTIME_V2_ADAPTER,
  DEFAULT_RUNTIME_V2_RENDERER,
  resolveAppEntryMode,
} from '@/runtimeV2';

test('legacy UI remains the default entry path and runtime-v2 stays explicit', () => {
  assert.equal(resolveAppEntryMode(''), 'legacy');
  assert.equal(resolveAppEntryMode('?runtimeV2=1'), 'runtime-v2');
  assert.equal(resolveAppEntryMode('?legacy=1'), 'legacy');
  assert.equal(DEFAULT_RUNTIME_V2_ADAPTER, 'python-wasm');
  assert.equal(DEFAULT_RUNTIME_V2_RENDERER, 'dom');
});
