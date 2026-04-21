import test from 'node:test';
import assert from 'node:assert/strict';

import { RunGenerator } from '@/core/events/runGenerator';

test('RunGenerator resets room streak state between generateMap calls on the same instance', () => {
  const seed = 27;
  const sharedGenerator = new RunGenerator(1);
  const baselineGenerator = new RunGenerator(seed);

  const firstRun = sharedGenerator.generateMap(seed, 10);
  const secondRun = sharedGenerator.generateMap(seed, 10);
  const baselineRun = baselineGenerator.generateMap(seed, 10);

  assert.deepEqual(firstRun, baselineRun);
  assert.deepEqual(secondRun, baselineRun);
});
