import test from 'node:test';
import assert from 'node:assert/strict';
import { cardsData } from '@/content/narrative/numericSystem';
import {
  applyCombatAfflictionToInstance,
  applyPersistentEnchantmentToInstance,
  clearCombatAfflictionsFromInstance,
  createRunCardInstance
} from '@/core/combat/runCardInstance';

function getCard(id: string) {
  const card = cardsData.find((entry) => entry.id === id);
  assert.ok(card, `missing card ${id}`);
  return card!;
}

test('run card instances stay isolated even for the same base card', () => {
  const strike = getCard('strike');
  const a = createRunCardInstance(strike, 'instance_a');
  const b = createRunCardInstance(strike, 'instance_b');

  const enchanted = applyPersistentEnchantmentToInstance(a, {
    id: 'blood_rune',
    name: 'Blood Rune',
    scope: 'persistent',
    effect: { type: 'damage', amount: 2 },
    description: '+2 damage'
  });

  assert.equal(enchanted.instanceId, 'instance_a');
  assert.equal(enchanted.actions[0]?.amount, 7);
  assert.equal(b.actions[0]?.amount, 5);
  assert.equal(b.persistentEnchantments.length, 0);
});

test('persistent enchantment and combat affliction derive in the correct order', () => {
  const strike = createRunCardInstance(getCard('strike'), 'instance_order');
  const enchanted = applyPersistentEnchantmentToInstance(strike, {
    id: 'blood_rune',
    name: 'Blood Rune',
    scope: 'persistent',
    effect: { type: 'damage', amount: 2 },
    description: '+2 damage'
  });
  const afflicted = applyCombatAfflictionToInstance(enchanted, {
    id: 'dampened_edge',
    name: 'Dampened Edge',
    scope: 'combat',
    effect: { type: 'damage', amount: -2 },
    description: '-2 damage this combat'
  });

  assert.equal(enchanted.actions[0]?.amount, 7);
  assert.equal(afflicted.actions[0]?.amount, 5);
  assert.equal(afflicted.persistentEnchantments.length, 1);
  assert.equal(afflicted.combatAfflictions.length, 1);
});

test('clearing combat afflictions restores the persistent-only derived card', () => {
  const defend = createRunCardInstance(getCard('defend'), 'instance_clear');
  const enchanted = applyPersistentEnchantmentToInstance(defend, {
    id: 'ward_seal',
    name: 'Ward Seal',
    scope: 'persistent',
    effect: { type: 'block', amount: 2 },
    description: '+2 block'
  });
  const afflicted = applyCombatAfflictionToInstance(enchanted, {
    id: 'hex_tax',
    name: 'Hex Tax',
    scope: 'combat',
    effect: { type: 'cost', amount: 1 },
    description: '+1 cost this combat'
  });
  const cleared = clearCombatAfflictionsFromInstance(afflicted);

  assert.equal(afflicted.cost, 2);
  assert.equal(cleared.cost, 1);
  assert.equal(cleared.actions[0]?.amount, 6);
  assert.equal(cleared.combatAfflictions.length, 0);
  assert.equal(cleared.persistentEnchantments.length, 1);
});
