/**
 * @file musicManifest.test.ts
 * @description Verifies that declared music tracks resolve to shipped assets.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';

import { CHARACTER_THEMES, EVENT_MUSIC, SCENE_MUSIC } from '@/content/data/musicManifest';

function localPathForTrackUrl(url: string): string {
  assert.ok(url.startsWith('/assets/'), `unexpected music URL ${url}`);
  return path.join(process.cwd(), 'public', url.slice(1));
}

test('music manifest references existing non-empty mp3 files', () => {
  const tracks = [
    ...Object.values(SCENE_MUSIC),
    ...Object.values(CHARACTER_THEMES),
    ...Object.values(EVENT_MUSIC),
  ];

  assert.equal(Object.keys(SCENE_MUSIC).length, 11);
  assert.equal(Object.keys(CHARACTER_THEMES).length, 8);
  assert.ok(Object.keys(EVENT_MUSIC).length >= 28);

  for (const track of tracks) {
    const filePath = localPathForTrackUrl(track.url);
    assert.equal(existsSync(filePath), true, `${track.id} missing ${track.url}`);
    assert.ok(statSync(filePath).size > 0, `${track.id} is empty`);
  }
});
