import test from 'node:test';
import assert from 'node:assert/strict';

import charactersDataRaw from '@/content/data/characters.json';
import enemiesDataRaw from '@/content/data/enemies.json';
import { buildRuntimeV2ContentBundle } from '@/runtimeV2/content/buildContentBundle';

test('runtime v2 content bundle projects real character and enemy content for the Python core', () => {
  const bundle = buildRuntimeV2ContentBundle();
  const charactersData = charactersDataRaw as Array<{
    id: string;
    maxHp: number;
    maxEnergy: number;
    startingDeck: string[];
    extendedPool?: string[];
  }>;
  const enemiesData = enemiesDataRaw as Array<{
    id: string;
    hp_range?: [number, number];
    keywords?: string[];
  }>;

  assert.match(bundle.version, /^runtime-v2-/);
  assert.equal(bundle.map.floors, 26);
  assert.equal(bundle.map.branching, 3);
  assert.ok(bundle.map.encounters.normal.length > 0);
  assert.ok(bundle.map.encounters.elite.length > 0);
  assert.ok(bundle.map.encounters.boss.length > 0);

  const informant = bundle.characters.find((entry) => entry.id === 'informant');
  const informantSource = charactersData.find((entry) => entry.id === 'informant');
  assert.ok(informant);
  assert.ok(informantSource);
  assert.equal(informant.max_hp, informantSource.maxHp);
  assert.equal(informant.max_energy, informantSource.maxEnergy);
  assert.equal(informant.starting_gold, 99);
  assert.equal(informant.starting_deck.length, informantSource.startingDeck.length);
  assert.deepEqual(informant.starting_deck, informantSource.startingDeck);
  assert.deepEqual(informant.extended_pool, informantSource.extendedPool ?? []);

  const gremlinNob = bundle.enemies.find((entry) => entry.id === 'gremlin_nob');
  const gremlinNobSource = enemiesData.find((entry) => entry.id === 'gremlin_nob');
  assert.ok(gremlinNob);
  assert.ok(gremlinNobSource);
  assert.deepEqual(gremlinNob.hp_range, gremlinNobSource.hp_range);
  assert.deepEqual(gremlinNob.keywords, gremlinNobSource.keywords ?? []);
  assert.ok(bundle.map.encounters.elite.includes('gremlin_nob'));
  assert.ok(gremlinNob.intent_policy);
  assert.ok(gremlinNob.intent_policy!.length > 0);

  assert.ok(bundle.cards);
  assert.ok(bundle.cards.length > 0);
  const gatherIntel = bundle.cards.find((entry) => entry.id === 'gather_intel');
  assert.ok(gatherIntel);
  assert.equal(gatherIntel.rarity, 'Common');
  assert.equal(gatherIntel.character, 'informant');
});
