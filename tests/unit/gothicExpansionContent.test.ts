import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import charactersDataRaw from '@/content/data/characters.json';
import { ActionFactoryV2 } from '@/core/actions/v2/ActionFactory';
import { cardsData, relicsData } from '@/content/narrative/numericSystem';
import { getCardRouteAffinityTags, getRelicRouteTags } from '@/content/narrative/routeSignals';
import { localCardArt } from '@/content/assets/standeeArt';
import { getCodexCatalog } from '@/ui/overlays/codexCatalog';
import type { ActionSpec, CardDef } from '@/core/types';

const REVIEWED_CHARACTER_IDS = [
  'informant',
  'brute',
  'tactician',
  'puppeteer',
  'chronomancer',
  'alchemist',
  'penitent_judge',
  'void_sanctioner',
] as const;

const GOTHIC_CARD_IDS = [
  'judgement_cut',
  'edict_mark',
  'absolution_guard',
  'excommunication_bolt',
  'sentence_cache',
  'confession_chain',
  'seal_the_sin',
  'black_trial',
  'last_warrant',
  'burning_crossfile',
  'redacted_saint',
  'void_lance',
  'containment_ward',
  'seal_siphon',
  'void_censure',
  'null_protocol',
  'rift_pin',
  'hollow_vow',
  'gravetic_cage',
  'event_horizon',
  'quietus_bell',
  'anti_miracle',
] as const;

const GOTHIC_RELIC_IDS = [
  'mortuary_warrant',
  'confessor_sigil',
  'blackened_gavel',
  'void_anchor_litany',
  'nullglass_lens',
  'cage_bell_clapper',
] as const;

type CharacterData = {
  id: string;
  description?: string;
  specialMechanic?: string;
  background?: string;
  mechanicNarrative?: string;
  loreFragments?: string[];
  startingDeck?: string[];
  extendedPool?: string[];
  specialResource?: string;
  secondaryResource?: string;
};

function collectActionTypes(actions: ActionSpec[] = [], out = new Set<string>()): Set<string> {
  for (const action of actions) {
    out.add(action.type);
    collectActionTypes(action.trueActions, out);
    collectActionTypes(action.falseActions, out);
    collectActionTypes(action.actions, out);
    collectActionTypes(action.effects, out);
    const effect = (action as ActionSpec & { effect?: ActionSpec | ActionSpec[] }).effect;
    if (Array.isArray(effect)) {
      collectActionTypes(effect, out);
    } else if (effect?.type) {
      out.add(effect.type);
    }
  }
  return out;
}

function assertPng(path: string, minWidth: number, minHeight: number): void {
  assert.ok(existsSync(path), `missing png asset: ${path}`);
  const buffer = readFileSync(path);
  assert.equal(buffer.readUInt32BE(0), 0x89504e47, `${path} is not a PNG`);
  assert.ok(buffer.readUInt32BE(16) >= minWidth, `${path} is too narrow`);
  assert.ok(buffer.readUInt32BE(20) >= minHeight, `${path} is too short`);
}

function assertWebp(path: string): void {
  assert.ok(existsSync(path), `missing webp asset: ${path}`);
  const buffer = readFileSync(path);
  assert.equal(buffer.toString('ascii', 0, 4), 'RIFF', `${path} is not a RIFF container`);
  assert.equal(buffer.toString('ascii', 8, 12), 'WEBP', `${path} is not a WebP asset`);
}

function assertCardAsset(cardId: string): void {
  assertWebp(resolve('public', `.${localCardArt(cardId)}`));
}

test('all eight characters meet the narrative and deck integrity standard', () => {
  const characters = charactersDataRaw as CharacterData[];
  const cardIds = new Set(cardsData.map((card) => card.id));

  for (const id of REVIEWED_CHARACTER_IDS) {
    const character = characters.find((entry) => entry.id === id);
    assert.ok(character, `missing character ${id}`);
    assert.ok((character!.description || '').length > 12, `${id} needs a description`);
    assert.ok((character!.specialMechanic || '').length > 6, `${id} needs a mechanic summary`);
    assert.ok((character!.background || '').length > 20, `${id} needs background story`);
    assert.ok((character!.mechanicNarrative || '').length > 20, `${id} needs mechanic narrative`);
    assert.ok((character!.loreFragments || []).length >= 1, `${id} needs fragmented lore`);
    assert.equal(character!.startingDeck?.length, 10, `${id} starter deck must stay at 10 cards`);
    assert.ok((character!.extendedPool || []).length >= 5, `${id} needs an extended pool`);
    assert.ok(character!.specialResource || character!.secondaryResource, `${id} must expose a unique resource hook`);

    for (const cardId of [...(character!.startingDeck || []), ...(character!.extendedPool || [])]) {
      assert.ok(cardIds.has(cardId), `${id} references missing card ${cardId}`);
    }
  }
});

test('gothic character cards are balanced, registered, routed, narrated, and illustrated', () => {
  const registeredActions = new Set(ActionFactoryV2.getRegisteredTypes());
  const cards = GOTHIC_CARD_IDS.map((id) => {
    const card = cardsData.find((entry) => entry.id === id) as CardDef | undefined;
    assert.ok(card, `missing card ${id}`);
    return card!;
  });

  assert.equal(cards.length, 22);
  assert.deepEqual(
    cards.reduce<Record<string, number>>((acc, card) => {
      acc[card.character || ''] = (acc[card.character || ''] || 0) + 1;
      return acc;
    }, {}),
    { penitent_judge: 11, void_sanctioner: 11 },
  );

  for (const card of cards) {
    assert.ok(card.cost >= 0 && card.cost <= 3, `${card.id} has out-of-range cost`);
    assert.ok(['Common', 'Uncommon', 'Rare'].includes(card.rarity), `${card.id} has unsupported rarity`);
    assert.ok(card.actions.length > 0, `${card.id} has no actions`);
    assert.ok((card.art_prompt || '').length > 20, `${card.id} needs an art prompt`);
    assert.ok((card.background || '').length > 20, `${card.id} needs background story`);
    assert.ok((card.loreText || '').length > 20, `${card.id} needs lore text`);
    assert.ok((card.lastWords || '').length > 10, `${card.id} needs last words`);
    assert.ok(getCardRouteAffinityTags(card).length > 0, `${card.id} must map to at least one route tag`);
    assertCardAsset(card.id);

    for (const type of collectActionTypes(card.actions)) {
      assert.ok(registeredActions.has(type), `${card.id} uses unregistered action ${type}`);
    }
    for (const type of collectActionTypes(card.upgrade?.actions ?? [])) {
      assert.ok(registeredActions.has(type), `${card.id}+ uses unregistered action ${type}`);
    }
  }
});

test('gothic relics are routed, narrated, and illustrated', () => {
  for (const id of GOTHIC_RELIC_IDS) {
    const relic = relicsData.find((entry) => entry.id === id) as any;
    assert.ok(relic, `missing relic ${id}`);
    assert.ok((relic.inscription || '').length > 10, `${id} needs inscription lore`);
    assert.ok((relic.flavorText || '').length > 10, `${id} needs owner lore`);
    assert.ok((relic.background || '').length > 20, `${id} needs background story`);
    assert.ok(getRelicRouteTags(id).length > 0, `${id} must support at least one route`);
    assertPng(resolve('public/assets/relics', `${id}.png`), 64, 64);
  }
});

test('all card and relic definitions have runtime image assets', () => {
  for (const card of cardsData) {
    assertCardAsset(card.id);
  }
  for (const relic of relicsData) {
    assertPng(resolve('public/assets/relics', `${relic.id}.png`), 64, 64);
  }
});

test('codex catalog exposes upgrade effects and fragmented lore for the expansion', () => {
  const catalog = getCodexCatalog();
  const cardEntry = catalog.find((entry) => entry.category === 'cards' && entry.id === 'judgement_cut');
  const relicEntry = catalog.find((entry) => entry.category === 'relics' && entry.id === 'mortuary_warrant');

  assert.ok(cardEntry, 'missing card codex entry');
  assert.ok(cardEntry!.background);
  assert.ok((cardEntry!.loreFragments || []).length >= 2);
  assert.ok(cardEntry!.dataPoints.some((point) => point.label === '升级' && point.value.length > 0));

  assert.ok(relicEntry, 'missing relic codex entry');
  assert.ok((relicEntry!.loreFragments || []).length >= 2);
  assert.ok(relicEntry!.searchText.includes('mortuary_warrant') || relicEntry!.searchText.includes('停尸拘票'));
});

test('codex catalog reads modern enemy hp and intent policy fields', () => {
  const catalog = getCodexCatalog();
  const coolantHound = catalog.find((entry) => entry.id === 'coolant_hound');

  assert.ok(coolantHound, 'missing coolant_hound codex entry');
  assert.match(coolantHound!.summary, /生命值 42-45/);
  assert.match(coolantHound!.summary, /3 种意图/);
  assert.ok(coolantHound!.demo?.frames.length, 'coolant_hound should expose intent demo frames');
});
