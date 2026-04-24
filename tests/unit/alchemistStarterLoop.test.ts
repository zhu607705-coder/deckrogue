/**
 * @file alchemistStarterLoop.test.ts
 * @description Unit tests for alchemist character starter card balance and element interactions.
 *
 * 主要职责:
 * - 测试元素火花/寒霜护甲的基础数值
 * - 测试元素附加与护盾获取的协同
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import cardsDataRaw from '@/content/data/cards.json';

const cardsData = cardsDataRaw as any[];

function getCard(id: string) {
  const card = cardsData.find(entry => entry.id === id);
  assert.ok(card, `missing card ${id}`);
  return card;
}

test('element spark should gain 4 Block and still set up the element loop', () => {
  const card = getCard('element_spark');
  const gainBlock = card.actions.find((action: any) => action.type === 'GainBlock');
  assert.equal(gainBlock?.amount, 4, `expected element_spark GainBlock 4, got ${gainBlock?.amount}`);
  assert.match(card.text, /获得 4 点护盾。/);
});

test('frost armor should gain 8 Block and still add Frost', () => {
  const card = getCard('frost_armor');
  const gainBlock = card.actions.find((action: any) => action.type === 'GainBlock');
  const addElement = card.actions.find((action: any) => action.type === 'AddElement');
  assert.equal(gainBlock?.amount, 8, `expected frost_armor GainBlock 8, got ${gainBlock?.amount}`);
  assert.equal(addElement?.element, 'Frost');
  assert.match(card.text, /获得 8 点护盾。/);
  assert.match(card.text, /向元素池加入 1 个霜元素。/);
});

test('alchemical transmute should remain a meaningful sustain card in the starter loop', () => {
  const card = getCard('alchemical_transmute');
  const transmute = card.actions.find((action: any) => action.type === 'TransmuteElements');
  assert.equal(transmute?.amount, 3, `expected alchemical_transmute to heal 3 HP per Element, got ${transmute?.amount}`);
  assert.match(card.text, /每有 1 个元素，恢复 3 点生命值。/);
});

test('concoct should draw 1 card to keep the alchemist loop moving', () => {
  const card = getCard('concoct');
  const draw = card.actions.find((action: any) => action.type === 'Draw');
  assert.equal(draw?.amount, 1, `expected concoct to draw 1 card, got ${draw?.amount}`);
  assert.match(card.text, /抽 1 张牌。/);
});

test('acid bath should apply 2 poison and keep 1 concoction after the balance reduction', () => {
  const card = getCard('acid_bath');
  const poison = card.actions.find((action: any) => action.type === 'ApplyStatus' && action.status === 'Poison');
  const concoction = card.actions.find((action: any) => action.type === 'GainConcoction');
  assert.equal(poison?.amount, 2, `expected acid_bath to apply 2 poison, got ${poison?.amount}`);
  assert.equal(concoction?.amount, 1, `expected acid_bath to keep 1 concoction, got ${concoction?.amount}`);
  assert.match(card.text, /施加 2 层中毒。/);
  assert.match(card.upgrade?.text ?? '', /施加 5 层中毒。/);
});
