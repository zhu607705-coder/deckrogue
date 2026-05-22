/**
 * @file contentReachabilityCheck.test.ts
 * @description Regression tests for content reachability validation guards.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('content reachability chapter event gate uses story events rather than mirror event count', () => {
  const source = readFileSync('scripts/validation/contentReachabilityCheck.ts', 'utf-8');

  assert.match(source, /STORY_EVENTS/);
  assert.match(source, /chapter1EventPool/);
  assert.doesNotMatch(source, /mirrorEvents\.length\s*>=\s*14/);
});
