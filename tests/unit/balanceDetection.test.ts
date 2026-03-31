import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

interface BalanceRegressionPayload {
  characters?: Array<{
    characterId: string;
    survivalRateFirst3: number;
    survivalRateAll5: number;
    avgCombatTurns: number;
    avgMaxFloor: number;
    overallScore: number;
    enchantmentPickupRate: number;
    enchantmentContributionScore: number;
    afflictionContributionPenalty: number;
  }>;
  analysis?: {
    survivalSpreadFirst3?: number;
    survivalSpreadAll5?: number;
    avgCombatTurnsSpread?: number;
    avgMaxFloorSpread?: number;
    overallScoreSpread?: number;
    outliers?: Array<{
      characterId: string;
      flags: string[];
    }>;
  };
}

function loadCombatRegression(): BalanceRegressionPayload {
  return JSON.parse(
    readFileSync(
      '/Users/zhuhangcheng/Downloads/好玩/deckrogue/output/numerics/combat_regression.json',
      'utf8'
    )
  ) as BalanceRegressionPayload;
}

test('combat regression must expose aggregate balance analysis', () => {
  const payload = loadCombatRegression();
  assert.ok(Array.isArray(payload.characters), 'expected characters array');
  assert.ok(payload.analysis, 'expected analysis block');
  assert.ok(typeof payload.analysis?.survivalSpreadFirst3 === 'number', 'expected survivalSpreadFirst3');
  assert.ok(typeof payload.analysis?.survivalSpreadAll5 === 'number', 'expected survivalSpreadAll5');
  assert.ok(typeof payload.analysis?.avgCombatTurnsSpread === 'number', 'expected avgCombatTurnsSpread');
  assert.ok(typeof payload.analysis?.avgMaxFloorSpread === 'number', 'expected avgMaxFloorSpread');
  assert.ok(typeof payload.analysis?.overallScoreSpread === 'number', 'expected overallScoreSpread');
  assert.ok(Array.isArray(payload.analysis?.outliers), 'expected outliers array');
});

test('combat regression must expose enchantment and affliction diagnostics per character', () => {
  const payload = loadCombatRegression();
  assert.ok(Array.isArray(payload.characters) && payload.characters.length > 0, 'expected non-empty characters array');
  for (const character of payload.characters) {
    assert.ok(typeof character.enchantmentPickupRate === 'number', `expected enchantmentPickupRate for ${character.characterId}`);
    assert.ok(typeof character.enchantmentContributionScore === 'number', `expected enchantmentContributionScore for ${character.characterId}`);
    assert.ok(typeof character.afflictionContributionPenalty === 'number', `expected afflictionContributionPenalty for ${character.characterId}`);
  }
});

test('combat balance analysis must keep spread values in sane numeric bounds', () => {
  const payload = loadCombatRegression();
  const analysis = payload.analysis!;
  assert.ok((analysis.survivalSpreadFirst3 ?? -1) >= 0, 'survivalSpreadFirst3 must be >= 0');
  assert.ok((analysis.survivalSpreadFirst3 ?? 2) <= 1, 'survivalSpreadFirst3 must be <= 1');
  assert.ok((analysis.survivalSpreadAll5 ?? -1) >= 0, 'survivalSpreadAll5 must be >= 0');
  assert.ok((analysis.survivalSpreadAll5 ?? 2) <= 1, 'survivalSpreadAll5 must be <= 1');
  assert.ok((analysis.avgCombatTurnsSpread ?? -1) >= 0, 'avgCombatTurnsSpread must be >= 0');
  assert.ok((analysis.avgMaxFloorSpread ?? -1) >= 0, 'avgMaxFloorSpread must be >= 0');
  assert.ok((analysis.overallScoreSpread ?? -1) >= 0, 'overallScoreSpread must be >= 0');
});

test('combat enchantment and affliction diagnostics must stay in sane bounds', () => {
  const payload = loadCombatRegression();
  assert.ok(Array.isArray(payload.characters), 'expected characters array');
  for (const character of payload.characters ?? []) {
    assert.ok(character.enchantmentPickupRate >= 0, `${character.characterId} enchantmentPickupRate must be >= 0`);
    assert.ok(character.enchantmentPickupRate <= 1, `${character.characterId} enchantmentPickupRate must be <= 1`);
    assert.ok(character.enchantmentContributionScore >= 0, `${character.characterId} enchantmentContributionScore must be >= 0`);
    assert.ok(character.afflictionContributionPenalty >= 0, `${character.characterId} afflictionContributionPenalty must be >= 0`);
  }
});
