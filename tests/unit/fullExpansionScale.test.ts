import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { ActionFactoryV2 } from '@/core/actions/v2/ActionFactory';
import { cardsData, enemiesData, relicsData, STORY_EVENTS } from '@/content/narrative/numericSystem';
import {
  getCardRouteSignal,
  getEventChoiceRouteRole,
  getEventRouteSignal,
  getKnownRouteTagsForCharacter,
  getRelicRouteTags,
} from '@/content/narrative/routeSignals';
import { localCardArt, localEnemyArt } from '@/content/assets/standeeArt';
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

const WAVE_II_CARD_IDS = [
  'cipher_dead_drop',
  'shadow_ledger_route',
  'witness_box_trap',
  'sainted_sinew',
  'nailwall_stance',
  'redline_bellow',
  'venom_grid',
  'command_canticle',
  'bastion_geometry',
  'choir_thread',
  'reliquary_golem',
  'severance_pact',
  'minute_tax',
  'delayed_funeral',
  'warp_notary',
  'ember_distillate',
  'acidic_catechism',
  'choir_reagent',
  'docket_of_bones',
  'execution_hour',
  'compelled_confession',
  'seal_of_stillwater',
  'suppression_field',
  'rift_liability',
] as const;

const WAVE_II_RELIC_IDS = [
  'cipher_lantern',
  'iron_votive',
  'command_seal',
  'marionette_reliquary',
  'minute_censer',
  'crucible_choir',
  'verdict_thurible',
  'null_chalice',
] as const;

const WAVE_II_EVENT_IDS = [
  'cipher_bazaar',
  'redoubt_of_nails',
  'banner_court',
  'string_scriptorium',
  'hourglass_morgue',
  'choir_crucible',
  'verdict_catacomb',
  'null_well',
] as const;

const WAVE_II_ENEMY_IDS = [
  'cipher_surgeon',
  'redline_penitent',
  'banner_tax_collector',
  'reliquary_string_host',
  'morgue_timekeeper',
  'crucible_deacon',
  'catacomb_bailiff',
  'null_cup_bearer',
] as const;

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

function assertWebp(path: string): void {
  assert.ok(existsSync(path), `missing webp asset: ${path}`);
  const buffer = readFileSync(path);
  assert.equal(buffer.toString('ascii', 0, 4), 'RIFF', `${path} is not a RIFF container`);
  assert.equal(buffer.toString('ascii', 8, 12), 'WEBP', `${path} is not a WebP asset`);
}

function assertPng(path: string): void {
  assert.ok(existsSync(path), `missing png asset: ${path}`);
  const buffer = readFileSync(path);
  assert.equal(buffer.readUInt32BE(0), 0x89504e47, `${path} is not a PNG`);
}

function cardById(id: string): CardDef {
  const card = cardsData.find((entry) => entry.id === id);
  assert.ok(card, `missing wave II card ${id}`);
  return card;
}

test('wave II route cards add full-scale support across all 24 route tags', () => {
  const registeredActions = new Set(ActionFactoryV2.getRegisteredTypes());
  const cards = WAVE_II_CARD_IDS.map(cardById);

  assert.equal(cards.length, 24);
  assert.deepEqual(
    cards.reduce<Record<string, number>>((acc, card) => {
      acc[card.character || ''] = (acc[card.character || ''] || 0) + 1;
      return acc;
    }, {}),
    {
      informant: 3,
      brute: 3,
      tactician: 3,
      puppeteer: 3,
      chronomancer: 3,
      alchemist: 3,
      penitent_judge: 3,
      void_sanctioner: 3,
    },
  );

  for (const card of cards) {
    assert.ok((card.tags || []).includes('wave2'), `${card.id} should be marked as wave2 content`);
    assert.ok((card.background || '').length > 20, `${card.id} needs background story`);
    assert.ok((card.loreText || '').length > 20, `${card.id} needs lore text`);
    assert.ok((card.lastWords || '').length > 10, `${card.id} needs last words`);
    assert.ok(getCardRouteSignal(card), `${card.id} must declare an explicit route signal`);
    assertWebp(resolve('public', `.${localCardArt(card.id)}`));

    for (const type of collectActionTypes(card.actions)) {
      assert.ok(registeredActions.has(type), `${card.id} uses unregistered action ${type}`);
    }
    for (const type of collectActionTypes(card.upgrade?.actions ?? [])) {
      assert.ok(registeredActions.has(type), `${card.id}+ uses unregistered action ${type}`);
    }
  }

  const countByRoute = new Map<string, number>();
  for (const card of cardsData) {
    const signal = getCardRouteSignal(card);
    for (const routeTag of signal?.routeTags ?? []) {
      countByRoute.set(routeTag, (countByRoute.get(routeTag) ?? 0) + 1);
    }
  }

  for (const characterId of REVIEWED_CHARACTER_IDS) {
    for (const routeTag of getKnownRouteTagsForCharacter(characterId)) {
      assert.ok((countByRoute.get(routeTag) ?? 0) >= 3, `${routeTag} should have at least 3 explicit route cards`);
    }
  }
});

test('wave II relics make every character route easier to surface in shop decisions', () => {
  for (const id of WAVE_II_RELIC_IDS) {
    const relic = relicsData.find((entry) => entry.id === id) as any;
    assert.ok(relic, `missing wave II relic ${id}`);
    assert.ok((relic.tags || []).includes('wave2'), `${id} should be marked as wave2 content`);
    assert.ok((relic.background || '').length > 20, `${id} needs background story`);
    assert.ok(getRelicRouteTags(id).length >= 3, `${id} should support the three routes of its character`);
    assertPng(resolve('public/assets/relics', `${id}.png`));
  }
});

test('wave II events provide route-readable choices for all eight characters', () => {
  for (const id of WAVE_II_EVENT_IDS) {
    const event = STORY_EVENTS.find((entry) => entry.id === id);
    assert.ok(event, `missing wave II event ${id}`);
    assert.equal(event!.options.length, 3, `${id} should expose three choices`);

    const signal = getEventRouteSignal(id);
    assert.ok(signal, `${id} should have an event route signal`);
    assert.ok(signal!.routeTags.length >= 3, `${id} should cover a full character route set`);

    for (const option of event!.options) {
      assert.ok(getEventChoiceRouteRole(id, option.id), `${id}/${option.id} needs a route choice role`);
      assert.ok((option.gains || []).length > 0, `${id}/${option.id} should communicate gains`);
    }
  }
});

test('wave II enemies add midgame route pressure with readable intent coverage', () => {
  for (const id of WAVE_II_ENEMY_IDS) {
    const enemy = enemiesData.find((entry) => entry.id === id) as any;
    assert.ok(enemy, `missing wave II enemy ${id}`);
    assert.ok((enemy.keywords || []).includes('wave2_route_enemy'), `${id} should be marked as wave2 route pressure`);

    const hpRange = enemy.hp_range ?? [enemy.minHp, enemy.maxHp];
    assert.ok(Array.isArray(hpRange) && hpRange.length === 2, `${id} needs hp range`);
    assert.ok(hpRange[0] >= 55 && hpRange[1] <= 90, `${id} should stay in midgame combat range`);
    assert.ok(Array.isArray(enemy.intent_policy) && enemy.intent_policy.length >= 3, `${id} needs three readable intents`);
    assert.ok(enemy.ai_profile, `${id} needs an AI profile`);

    for (const policy of enemy.intent_policy) {
      assert.ok(enemy.moves?.[policy.intent]?.length > 0, `${id} intent ${policy.intent} lacks moves`);
    }
    assertPng(resolve('public', `.${localEnemyArt(id)}`));
  }
});
