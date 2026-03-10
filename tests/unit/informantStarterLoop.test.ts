import test from 'node:test';
import assert from 'node:assert/strict';
import cardsDataRaw from '@/content/data/cards.json';

const cardsData = cardsDataRaw as any[];

function getCard(id: string) {
  const card = cardsData.find(entry => entry.id === id);
  assert.ok(card, `missing card ${id}`);
  return card;
}

test('gather_intel should gain 2 Intel and draw 2 cards', () => {
  const card = getCard('gather_intel');
  const gainIntel = card.actions.find((action: any) => action.type === 'GainIntel');
  const draw = card.actions.find((action: any) => action.type === 'Draw');
  assert.equal(gainIntel?.amount, 2, `expected gather_intel GainIntel 2, got ${gainIntel?.amount}`);
  assert.equal(draw?.amount, 2, `expected gather_intel Draw 2, got ${draw?.amount}`);
});

test('calculated_strike should spend 1 Intel and deal total 14 damage when condition passes', () => {
  const card = getCard('calculated_strike');
  const baseDamage = card.actions.find((action: any) => action.type === 'DealDamage');
  const conditional = card.actions.find((action: any) => action.type === 'Conditional');
  assert.equal(baseDamage?.amount, 7, `expected calculated_strike base damage 7, got ${baseDamage?.amount}`);
  assert.equal(conditional?.condition?.type, 'HasIntel');
  assert.equal(conditional?.condition?.amount, 1);
  const spendIntel = conditional?.trueActions?.find((action: any) => action.type === 'SpendIntel');
  const bonusDamage = conditional?.trueActions?.find((action: any) => action.type === 'DealDamage');
  assert.equal(spendIntel?.amount, 1, `expected calculated_strike to spend 1 Intel, got ${spendIntel?.amount}`);
  assert.equal(bonusDamage?.amount, 7, `expected calculated_strike bonus damage 7, got ${bonusDamage?.amount}`);
});

test('weak_point_analysis should gain 2 Intel and apply 1 Vulnerable', () => {
  const card = getCard('weak_point_analysis');
  const gainIntel = card.actions.find((action: any) => action.type === 'GainIntel');
  const vulnerable = card.actions.find(
    (action: any) => action.type === 'ApplyStatus' && action.status === 'Vulnerable'
  );
  assert.equal(gainIntel?.amount, 2, `expected weak_point_analysis GainIntel 2, got ${gainIntel?.amount}`);
  assert.equal(
    vulnerable?.amount,
    1,
    `expected weak_point_analysis Vulnerable 1, got ${vulnerable?.amount}`
  );
});
