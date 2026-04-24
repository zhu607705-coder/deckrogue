/**
 * @file combatCalibration.test.ts
 * @description Unit tests for combat balance regression data and character survival rates.
 *
 * 主要职责:
 * - 测试角色前3层/全5层生存率
 * - 测试战斗平衡回归基线
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

interface CombatRegressionCharacter {
  characterId: string;
  survivalRateFirst3: number;
  survivalRateAll5: number;
  avgCombatTurns: number;
  overallScore: number;
}

interface CombatRegressionPayload {
  characters: CombatRegressionCharacter[];
}

function loadCombatRegression(): CombatRegressionPayload {
  const raw = readFileSync(
    '/Users/zhuhangcheng/Downloads/好玩/deckrogue/output/numerics/combat_regression.json',
    'utf8'
  );
  return JSON.parse(raw) as CombatRegressionPayload;
}

function getCharacter(payload: CombatRegressionPayload, id: string): CombatRegressionCharacter {
  const match = payload.characters.find(character => character.characterId === id);
  assert.ok(match, `missing combat regression entry for ${id}`);
  return match;
}

test('informant must stabilize early survival in combat regression', () => {
  const payload = loadCombatRegression();
  const informant = getCharacter(payload, 'informant');
  assert.ok(
    informant.survivalRateFirst3 >= 0.4,
    `informant survival for first 3 floors must be >= 0.4, got ${informant.survivalRateFirst3}`
  );
  assert.ok(
    informant.survivalRateAll5 >= 0.25,
    `informant survival for first 5 floors must be >= 0.25, got ${informant.survivalRateAll5}`
  );
  assert.ok(
    informant.avgCombatTurns < 6,
    `informant avg combat turns must be < 6, got ${informant.avgCombatTurns}`
  );
});

test('brute and tactician must not both sit at perfect early survival', () => {
  const payload = loadCombatRegression();
  const brute = getCharacter(payload, 'brute');
  const tactician = getCharacter(payload, 'tactician');
  assert.ok(
    brute.survivalRateFirst3 < 1 || tactician.survivalRateFirst3 < 1,
    `expected at least one of brute/tactician to fall below perfect survival, got brute=${brute.survivalRateFirst3}, tactician=${tactician.survivalRateFirst3}`
  );
});

test('profession spread should stay within a bounded early-game band', () => {
  const payload = loadCombatRegression();
  const survivalRates = payload.characters.map(character => character.survivalRateFirst3);
  const spread = Math.max(...survivalRates) - Math.min(...survivalRates);
  assert.ok(spread <= 0.85, `expected survival spread <= 0.85, got ${spread}`);
});

test('informant overall score must stay below chronomancer and tactician', () => {
  const payload = loadCombatRegression();
  const informant = getCharacter(payload, 'informant');
  const chronomancer = getCharacter(payload, 'chronomancer');
  const tactician = getCharacter(payload, 'tactician');
  assert.ok(
    informant.overallScore <= chronomancer.overallScore,
    `informant overall score must stay <= chronomancer, got informant=${informant.overallScore}, chronomancer=${chronomancer.overallScore}`
  );
  assert.ok(
    informant.overallScore <= tactician.overallScore,
    `informant overall score must stay <= tactician, got informant=${informant.overallScore}, tactician=${tactician.overallScore}`
  );
});
