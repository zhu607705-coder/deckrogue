/**
 * @file runtimeV2ContentBundle.test.ts
 * @description Unit tests for runtime v2 content bundle projection for the Python core.
 *
 * 主要职责:
 * - 测试角色和敌人内容的投影
 * - 测试内容包版本和地图参数
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import cardsDataRaw from '@/content/data/cards.json';
import charactersDataRaw from '@/content/data/characters.json';
import enemiesDataRaw from '@/content/data/enemies.json';
import relicsDataRaw from '@/content/data/relics.json';
import potionsDataRaw from '@/content/data/potions.json';
import { buildRuntimeV2ContentBundle } from '@/runtimeV2/content/buildContentBundle';

test('runtime v2 content bundle projects real character and enemy content for the Python core', () => {
  const bundle = buildRuntimeV2ContentBundle();
  const charactersData = charactersDataRaw as Array<{
    id: string;
    maxHp: number;
    maxEnergy: number;
    startingDeck: string[];
    extendedPool?: string[];
    secondaryResource?: string;
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
  assert.equal(bundle.map.runtime_strategy?.floor_type_caps?.Event, 1);
  assert.equal(bundle.map.runtime_strategy?.opening_route_expectation?.max_spread, 15);
  assert.equal(bundle.map.runtime_strategy?.opening_route_expectation?.max_branches_per_floor?.floor_1, 2);

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
  assert.equal(informant.secondary_resource, informantSource.secondaryResource);

  for (const characterId of ['brute', 'tactician', 'penitent_judge', 'void_sanctioner']) {
    const bundled = bundle.characters.find((entry) => entry.id === characterId);
    const source = charactersData.find((entry) => entry.id === characterId);
    assert.ok(bundled, `${characterId} should be bundled`);
    assert.ok(source, `${characterId} should exist in source data`);
    assert.equal(bundled!.secondary_resource, source!.secondaryResource);
  }

  const gremlinNob = bundle.enemies.find((entry) => entry.id === 'gremlin_nob');
  const gremlinNobSource = enemiesData.find((entry) => entry.id === 'gremlin_nob');
  assert.ok(gremlinNob);
  assert.ok(gremlinNobSource);
  assert.deepEqual(gremlinNob.hp_range, gremlinNobSource.hp_range);
  assert.deepEqual(gremlinNob.keywords, gremlinNobSource.keywords ?? []);
  assert.ok(bundle.map.encounters.elite.includes('gremlin_nob'));
  assert.ok(gremlinNob.intent_policy);
  assert.ok(gremlinNob.intent_policy!.length > 0);

  const camelCaseEnemy = bundle.enemies.find((entry) => entry.id === 'coolant_hound');
  assert.ok(camelCaseEnemy);
  assert.ok(camelCaseEnemy.intent_policy);
  assert.ok(camelCaseEnemy.intent_policy!.length > 0);

  assert.ok(bundle.cards);
  assert.ok(bundle.cards.length > 0);
  const gatherIntel = bundle.cards.find((entry) => entry.id === 'gather_intel');
  assert.ok(gatherIntel);
  assert.equal(gatherIntel.rarity, 'Common');
  assert.equal(gatherIntel.character, 'informant');
});

test('runtime v2 content bundle preserves potion display metadata for render models', () => {
  const bundle = buildRuntimeV2ContentBundle();
  const potionsData = potionsDataRaw as Array<{
    id: string;
    name: string;
    description: string;
    rarity?: string;
  }>;

  const healingPotion = bundle.potions?.find((entry) => entry.id === 'healing_potion');
  const healingPotionSource = potionsData.find((entry) => entry.id === 'healing_potion');

  assert.ok(healingPotion);
  assert.ok(healingPotionSource);
  assert.equal(healingPotion!.name, healingPotionSource!.name);
  assert.equal(healingPotion!.description, healingPotionSource!.description);
  assert.equal(healingPotion!.rarity, healingPotionSource!.rarity);
});

test('runtime v2 content bundle preserves relic display and corruption metadata for render models', () => {
  const bundle = buildRuntimeV2ContentBundle();
  const relicsData = relicsDataRaw as Array<{
    id: string;
    name: string;
    description: string;
    rarity?: string;
    corrupted?: boolean;
  }>;

  const burningBlood = bundle.relics?.find((entry) => entry.id === 'burning_blood');
  const burningBloodSource = relicsData.find((entry) => entry.id === 'burning_blood');
  const markOfEntropy = bundle.relics?.find((entry) => entry.id === 'mark_of_entropy');
  const markOfEntropySource = relicsData.find((entry) => entry.id === 'mark_of_entropy');

  assert.ok(burningBlood);
  assert.ok(burningBloodSource);
  assert.equal(burningBlood!.name, burningBloodSource!.name);
  assert.equal(burningBlood!.description, burningBloodSource!.description);
  assert.equal(burningBlood!.rarity, burningBloodSource!.rarity);

  assert.ok(markOfEntropy);
  assert.ok(markOfEntropySource);
  assert.equal(markOfEntropy!.corrupted, markOfEntropySource!.corrupted);
});

test('runtime v2 content bundle preserves card display metadata for render models', () => {
  const bundle = buildRuntimeV2ContentBundle();
  const cardsData = cardsDataRaw as Array<{
    id: string;
    name: string;
    cost: number;
    type: string;
    targeting?: string;
    tags?: string[];
    text?: string;
    upgrade?: unknown;
  }>;

  const gatherIntel = bundle.cards.find((entry) => entry.id === 'gather_intel');
  const gatherIntelSource = cardsData.find((entry) => entry.id === 'gather_intel');

  assert.ok(gatherIntel);
  assert.ok(gatherIntelSource);
  assert.equal(gatherIntel!.name, gatherIntelSource!.name);
  assert.equal(gatherIntel!.cost, gatherIntelSource!.cost);
  assert.equal(gatherIntel!.type, gatherIntelSource!.type);
  assert.equal(gatherIntel!.targeting, gatherIntelSource!.targeting);
  assert.deepEqual(gatherIntel!.tags, gatherIntelSource!.tags);
  assert.equal(gatherIntel!.text, gatherIntelSource!.text);
  assert.deepEqual(gatherIntel!.upgrade, gatherIntelSource!.upgrade);
});

test('runtime v2 content bundle preserves character display metadata for content service consumers', () => {
  const bundle = buildRuntimeV2ContentBundle();
  const charactersData = charactersDataRaw as Array<{
    id: string;
    name: string;
    description: string;
    portraitPrompt: string;
    complexity?: 'low' | 'medium' | 'high';
    archetype?: string[];
    background?: string;
    mechanicNarrative?: string;
    loreFragments?: string[];
  }>;

  const informant = bundle.characters.find((entry) => entry.id === 'informant');
  const informantSource = charactersData.find((entry) => entry.id === 'informant');

  assert.ok(informant);
  assert.ok(informantSource);
  assert.equal(informant!.name, informantSource!.name);
  assert.equal(informant!.description, informantSource!.description);
  assert.equal(informant!.portrait_prompt, informantSource!.portraitPrompt);
  assert.equal(informant!.complexity, informantSource!.complexity);
  assert.deepEqual(informant!.archetype, informantSource!.archetype);
  assert.equal(informant!.background, informantSource!.background);
  assert.equal(informant!.mechanic_narrative, informantSource!.mechanicNarrative);
  assert.deepEqual(informant!.lore_fragments, informantSource!.loreFragments);
});

test('runtime v2 content bundle preserves enemy display metadata for content service consumers', () => {
  const bundle = buildRuntimeV2ContentBundle();
  const enemiesData = enemiesDataRaw as Array<{
    id: string;
    name: string;
    description?: string;
  }>;

  const gremlinNob = bundle.enemies.find((entry) => entry.id === 'gremlin_nob');
  const gremlinNobSource = enemiesData.find((entry) => entry.id === 'gremlin_nob');
  const coolantHound = bundle.enemies.find((entry) => entry.id === 'coolant_hound');
  const coolantHoundSource = enemiesData.find((entry) => entry.id === 'coolant_hound');

  assert.ok(gremlinNob);
  assert.ok(gremlinNobSource);
  assert.equal(gremlinNob!.name, gremlinNobSource!.name);

  assert.ok(coolantHound);
  assert.ok(coolantHoundSource);
  assert.equal(coolantHound!.name, coolantHoundSource!.name);
  assert.equal(coolantHound!.description, coolantHoundSource!.description);
});
