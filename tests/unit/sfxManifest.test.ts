/**
 * @file sfxManifest.test.ts
 * @description Verifies SFX manifest structure and consistency.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { SFX_MANIFEST, SFX_VOLUME, SFXCategory } from '@/content/data/sfxManifest';

const EXPECTED_CATEGORIES: SFXCategory[] = ['combat', 'card', 'ui', 'power', 'ambient', 'status'];

test('SFX manifest has all expected categories', () => {
  for (const cat of EXPECTED_CATEGORIES) {
    assert.ok(
      cat in SFX_VOLUME,
      `Category '${cat}' missing from SFX_VOLUME`
    );
  }
});

test('SFX manifest has minimum required sounds per category', () => {
  const counts: Record<SFXCategory, number> = {
    combat: 0,
    card: 0,
    ui: 0,
    power: 0,
    ambient: 0,
    status: 0,
  };

  for (const sfx of Object.values(SFX_MANIFEST)) {
    counts[sfx.category]++;
  }

  assert.ok(counts.combat >= 3, 'Combat should have at least 3 sounds');
  assert.ok(counts.card >= 3, 'Card should have at least 3 sounds');
  assert.ok(counts.ui >= 3, 'UI should have at least 3 sounds');
  assert.ok(counts.power >= 3, 'Power should have at least 3 sounds');
  assert.ok(counts.ambient >= 2, 'Ambient should have at least 2 sounds');
  assert.ok(counts.status >= 3, 'Status should have at least 3 sounds');
});

test('All SFX have valid synthesis parameters', () => {
  for (const [id, sfx] of Object.entries(SFX_MANIFEST)) {
    assert.ok(sfx.id === id, `ID mismatch: ${sfx.id} vs ${id}`);
    assert.ok(EXPECTED_CATEGORIES.includes(sfx.category), `${id} has unknown category ${sfx.category}`);
    assert.ok(sfx.synthesis.duration > 0, `${id} has invalid duration`);
    assert.ok(sfx.synthesis.duration <= 2, `${id} duration is too long for a short SFX`);
    assert.ok(sfx.synthesis.volume !== undefined, `${id} missing volume`);
    assert.ok(sfx.synthesis.volume! > 0 && sfx.synthesis.volume! <= 1, `${id} has invalid volume`);
    if (sfx.synthesis.frequency !== undefined) {
      assert.ok(sfx.synthesis.frequency > 0, `${id} has invalid frequency`);
    }
    if (sfx.synthesis.frequencyEnd !== undefined) {
      assert.ok(sfx.synthesis.frequencyEnd > 0, `${id} has invalid ending frequency`);
    }
  }
});

test('SFX volume categories are within valid range', () => {
  for (const [cat, vol] of Object.entries(SFX_VOLUME)) {
    assert.ok(vol >= 0 && vol <= 1, `Category ${cat} has invalid volume ${vol}`);
  }
});
