import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { ActionFactoryV2 } from '@/core/actions/v2/ActionFactory';
import { cardsData } from '@/content/narrative/numericSystem';
import { getCardRouteAffinityTags } from '@/content/narrative/routeSignals';
import type { ActionSpec, CardDef } from '@/core/types';

const EXPANSION_CARD_IDS = [
  'ash_bargain',
  'shielded_advance',
  'rite_breaker',
  'blackout_round',
  'grim_tithe',
  'sealed_reserve',
  'martyr_vector',
  'oath_of_motion',
  'forensic_ping',
  'classified_angle',
  'wiretap_liturgy',
  'ledger_trap',
  'silent_subpoena',
  'ghost_briefing',
  'total_exposure',
  'blood_knuckle',
  'brace_for_impact',
  'rib_breaker',
  'pain_engine',
  'wall_crusher',
  'red_bulwark',
  'butcher_zenith',
  'spotter_drone',
  'crossfire_order',
  'smoke_screen_line',
  'reserve_signal',
  'kill_box',
  'layered_orders',
  'decapitation_plan',
  'second_hand_cut',
  'borrowed_minute',
  'stutter_guard',
  'echo_cut',
  'fixed_point',
  'rift_interleave',
  'causal_collapse',
  'needle_servo',
  'string_snare',
  'repair_marionette',
  'overclock_strings',
  'puppet_screen',
  'red_thread_contract',
  'theater_of_knives',
  'ember_reagent',
  'acid_measure',
  'coagulate',
  'volatile_retort',
  'base_catalyst',
  'sealed_alembic',
  'world_formula',
] as const;

const expansionIdSet = new Set<string>(EXPANSION_CARD_IDS);

const JUDGMENT_AND_SEAL_CARD_IDS = [
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

const judgmentAndSealIdSet = new Set<string>(JUDGMENT_AND_SEAL_CARD_IDS);

function expansionCards(): CardDef[] {
  return cardsData.filter((card) => expansionIdSet.has(card.id));
}

function judgmentAndSealCards(): CardDef[] {
  return cardsData.filter((card) => judgmentAndSealIdSet.has(card.id));
}

function collectActionTypes(actions: ActionSpec[] = [], out = new Set<string>()): Set<string> {
  for (const action of actions) {
    out.add(action.type);
    collectActionTypes(action.trueActions, out);
    collectActionTypes(action.falseActions, out);
    collectActionTypes(action.actions, out);
    collectActionTypes(action.effects, out);
    const effect = action.effect as ActionSpec | ActionSpec[] | undefined;
    if (Array.isArray(effect)) {
      collectActionTypes(effect, out);
    } else if (effect?.type) {
      out.add(effect.type);
    }
  }
  return out;
}

test('new card expansion pack keeps the expected size and distribution', () => {
  const cards = expansionCards();
  assert.equal(cards.length, 50);
  assert.deepEqual(
    cards.reduce<Record<string, number>>((acc, card) => {
      acc[card.character || ''] = (acc[card.character || ''] || 0) + 1;
      return acc;
    }, {}),
    { All: 8, informant: 7, brute: 7, tactician: 7, chronomancer: 7, puppeteer: 7, alchemist: 7 },
  );
  assert.deepEqual(
    cards.reduce<Record<string, number>>((acc, card) => {
      acc[card.rarity] = (acc[card.rarity] || 0) + 1;
      return acc;
    }, {}),
    { Common: 22, Uncommon: 21, Rare: 7 },
  );
});

test('new card expansion pack uses registered actions and bounded numeric surfaces', () => {
  const registeredActions = new Set(ActionFactoryV2.getRegisteredTypes());
  for (const card of expansionCards()) {
    assert.ok(card.cost >= 0 && card.cost <= 3, `${card.id} has out-of-range cost`);
    assert.ok(['Common', 'Uncommon', 'Rare'].includes(card.rarity), `${card.id} has unsupported rarity`);
    assert.ok(card.actions.length > 0, `${card.id} has no actions`);
    for (const type of collectActionTypes(card.actions)) {
      assert.ok(registeredActions.has(type), `${card.id} uses unregistered action ${type}`);
    }
    for (const type of collectActionTypes(card.upgrade?.actions ?? [])) {
      assert.ok(registeredActions.has(type), `${card.id}+ uses unregistered action ${type}`);
    }
  }
});

test('new profession cards remain visible to route affinity and card art lookup', () => {
  for (const card of expansionCards()) {
    assert.ok(card.art_prompt, `${card.id} must declare an art prompt for runtime image lookup`);
    assert.ok(existsSync(resolve('public/assets/cards', `${card.id}.png`)), `${card.id} art is missing`);
    if (card.character && card.character !== 'All') {
      assert.ok(getCardRouteAffinityTags(card).length > 0, `${card.id} must map to at least one route tag`);
    }
  }
});

test('judgment and seal profession cards are route-visible and executable', () => {
  const cards = judgmentAndSealCards();
  const registeredActions = new Set(ActionFactoryV2.getRegisteredTypes());
  assert.equal(cards.length, JUDGMENT_AND_SEAL_CARD_IDS.length);
  assert.deepEqual(
    cards.reduce<Record<string, number>>((acc, card) => {
      acc[card.character || ''] = (acc[card.character || ''] || 0) + 1;
      return acc;
    }, {}),
    { penitent_judge: 11, void_sanctioner: 11 },
  );

  for (const card of cards) {
    assert.ok(card.art_prompt, `${card.id} should provide an art prompt`);
    assert.ok(getCardRouteAffinityTags(card).length > 0, `${card.id} must map to at least one route tag`);
    for (const type of collectActionTypes(card.actions)) {
      assert.ok(registeredActions.has(type), `${card.id} uses unregistered action ${type}`);
    }
    for (const type of collectActionTypes(card.upgrade?.actions ?? [])) {
      assert.ok(registeredActions.has(type), `${card.id}+ uses unregistered action ${type}`);
    }
  }
});
