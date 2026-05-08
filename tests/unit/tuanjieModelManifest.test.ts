import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getTuanjieModelEntry,
  getTuanjieModelForSource,
  listTuanjieModelEntries,
  resolveTuanjiePreviewArt,
  TUANJIE_MODEL_MANIFEST,
} from '@/content/assets/tuanjieModelManifest';
import { localCardArt, localCharacterArt, localEnemyArt } from '@/content/assets/standeeArt';

test('Tuanjie manifest exposes placeholder entries for all DeckRogue characters', () => {
  const characters = listTuanjieModelEntries('character');
  assert.equal(characters.length, 8);
  assert.deepEqual(
    characters.map((entry) => entry.sourceId).sort(),
    ['alchemist', 'brute', 'chronomancer', 'informant', 'penitent_judge', 'puppeteer', 'tactician', 'void_sanctioner'],
  );

  for (const entry of characters) {
    assert.equal(entry.status, 'placeholder');
    assert.equal(entry.format, 'tuanjie-2d-prefab');
    assert.equal(entry.previewArt, localCharacterArt(entry.sourceId));
    assert.ok(entry.tuanjieProjectHint.startsWith('My deckrogue/Assets/DeckRogue/Characters/'));
  }
});

test('Tuanjie manifest lookup resolves by model id and source id', () => {
  const model = getTuanjieModelEntry('enemy_goblin');
  assert.ok(model);
  assert.equal(model.sourceId, 'goblin');
  assert.equal(model.previewArt, localEnemyArt('goblin'));

  const card = getTuanjieModelForSource('card', 'strike');
  assert.ok(card);
  assert.equal(card.modelId, 'card_strike');
  assert.equal(card.previewArt, localCardArt('strike'));
});

test('Tuanjie preview resolver falls back to runtime art helpers', () => {
  assert.equal(resolveTuanjiePreviewArt('character', 'informant'), localCharacterArt('informant'));
  assert.equal(resolveTuanjiePreviewArt('enemy', 'unknown_enemy'), localEnemyArt('unknown_enemy'));
  assert.equal(resolveTuanjiePreviewArt('relic', 'missing_relic'), localCardArt('strike'));
});

test('Tuanjie manifest model ids are unique', () => {
  const ids = TUANJIE_MODEL_MANIFEST.map((entry) => entry.modelId);
  assert.equal(new Set(ids).size, ids.length);
});
