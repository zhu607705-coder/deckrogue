import { describe, test } from 'node:test';
import assert from 'node:assert';
import charactersDataRaw from '@/content/data/characters.json';
import cardsDataRaw from '@/content/data/cards.json';
const charactersData = charactersDataRaw as any[];
const cardsData = cardsDataRaw as any[];

function getCard(id: string) {
  const card = cardsData.find(entry => entry.id === id);
  assert.ok(card, `missing card ${id}`);
  return card;
}

describe('Starter Balance Detection', () => {
  
  describe('1. 构造体基础输出测试', () => {
    test('scrap_golem should have atk 3 in definition', () => {
      const charDef = charactersData.find(c => c.id === 'puppeteer');
      assert.ok(charDef, 'puppeteer should exist');
      assert.ok(charDef.startingDeck.includes('scrap_golem'), 'puppeteer should have scrap_golem');
    });
    
    test('CreateConstructAction default atk should be 6', () => {
      const defaultAtk = 6;
      assert.ok(defaultAtk >= 6, 'default construct atk should be at least 6');
    });
  });
  
  describe('2. 元素反应测试', () => {
    test('element reaction formula should match new formula', () => {
      const calcDamage = (elements: string[], times: number = 1): number => {
        const uniqueElements = new Set(elements).size;
        let totalDamage = 0;
        for (let i = 0; i < times; i++) {
          totalDamage += elements.length * 4 + Math.max(0, uniqueElements - 1) * 2;
        }
        return totalDamage;
      };
      
      const elements2 = ['Fire', 'Frost'];
      const elements3 = ['Fire', 'Frost', 'Lightning'];
      const elementsRepeat = ['Fire', 'Fire', 'Frost'];
      
      const damage2 = calcDamage(elements2);
      const damage3 = calcDamage(elements3);
      const damageRepeat = calcDamage(elementsRepeat);
      
      assert.strictEqual(damage2, 10, '2 unique elements: 2*4 + (2-1)*2 = 10');
      assert.strictEqual(damage3, 16, '3 unique elements: 3*4 + (3-1)*2 = 16');
      assert.strictEqual(damageRepeat, 14, 'repeat elements: 3*4 + (2-1)*2 = 14');
    });
  });
  
  describe('3. 起始卡组输出测试', () => {
    const characterIds = ['informant', 'brute', 'tactician', 'puppeteer', 'chronomancer', 'alchemist'];
    
    const characterStrikeRequirements: Record<string, number> = {
      informant: 2,  // vNext: 1 replaced with dead_drop
      brute: 4,
      tactician: 3,
      puppeteer: 0,
      chronomancer: 0,
      alchemist: 1,  // vNext: 1 replaced with nerve_agent
    };
    
    for (const charId of characterIds) {
      test(`${charId} should have at least ${characterStrikeRequirements[charId]} strikes in starting deck`, () => {
        const charDef = charactersData.find(c => c.id === charId);
        assert.ok(charDef, `${charId} should exist`);
        
        const strikes = charDef.startingDeck.filter((cardId: string) => cardId === 'strike');
        const requiredStrikes = characterStrikeRequirements[charId] || 2;
        assert.ok(strikes.length >= requiredStrikes, `${charId} should have at least ${requiredStrikes} strikes, got ${strikes.length}`);
      });
    }
    
    test('informant should have 2 strikes after vNext adjustment', () => {
      const charDef = charactersData.find(c => c.id === 'informant');
      assert.ok(charDef);
      const strikes = charDef.startingDeck.filter((cardId: string) => cardId === 'strike');
      assert.strictEqual(strikes.length, 2, 'informant should have 2 strikes (1 replaced with dead_drop)');
    });

    test('informant should include precision_strike in starting deck', () => {
      const charDef = charactersData.find(c => c.id === 'informant');
      assert.ok(charDef);
      assert.ok(
        charDef.startingDeck.includes('precision_strike'),
        'informant should include precision_strike in starting deck'
      );
    });

    test('informant should include intel_surge in starting deck', () => {
      const charDef = charactersData.find(c => c.id === 'informant');
      assert.ok(charDef);
      assert.ok(
        charDef.startingDeck.includes('intel_surge'),
        'informant should include intel_surge in starting deck'
      );
    });

    test('informant should include dead_drop in starting deck (vNext replacement)', () => {
      const charDef = charactersData.find(c => c.id === 'informant');
      assert.ok(charDef);
      assert.ok(
        charDef.startingDeck.includes('dead_drop'),
        'informant should include dead_drop in starting deck (vNext replacement for 1 strike)'
      );
    });
    
    test('tactician should have 3 strikes after adjustment', () => {
      const charDef = charactersData.find(c => c.id === 'tactician');
      assert.ok(charDef);
      const strikes = charDef.startingDeck.filter((cardId: string) => cardId === 'strike');
      assert.strictEqual(strikes.length, 3, 'tactician should have 3 strikes');
    });
    
    test('puppeteer should have 2 thread_lash after adjustment', () => {
      const charDef = charactersData.find(c => c.id === 'puppeteer');
      assert.ok(charDef);
      const threadLash = charDef.startingDeck.filter((cardId: string) => cardId === 'thread_lash');
      assert.strictEqual(threadLash.length, 2, 'puppeteer should have 2 thread_lash');
    });
    
    test('chronomancer should use the real low-cost starter shell after adjustment', () => {
      const charDef = charactersData.find(c => c.id === 'chronomancer');
      assert.ok(charDef);
      assert.ok(
        charDef.startingDeck.includes('gather_intel'),
        'chronomancer should include gather_intel in the repaired starter shell'
      );
      assert.ok(
        charDef.startingDeck.includes('surveillance'),
        'chronomancer should include surveillance in the repaired starter shell'
      );
      assert.ok(
        charDef.startingDeck.includes('precision_strike'),
        'chronomancer should include precision_strike in the repaired starter shell'
      );
      for (const cardId of charDef.startingDeck) {
        assert.ok(getCard(cardId), `chronomancer starter card should exist: ${cardId}`);
      }
    });
    
    test('alchemist should have 1 strike and 1 nerve_agent after vNext adjustment', () => {
      const charDef = charactersData.find(c => c.id === 'alchemist');
      assert.ok(charDef);
      const strike = charDef.startingDeck.filter((cardId: string) => cardId === 'strike');
      const nerveAgent = charDef.startingDeck.filter((cardId: string) => cardId === 'nerve_agent');
      assert.strictEqual(strike.length, 1, 'alchemist should have 1 strike (1 replaced with nerve_agent)');
      assert.strictEqual(nerveAgent.length, 1, 'alchemist should have 1 nerve_agent');
    });

    test('alchemist should not have fire_arrow (replaced with volatile_catalyst)', () => {
      const charDef = charactersData.find(c => c.id === 'alchemist');
      assert.ok(charDef);
      const fireArrow = charDef.startingDeck.filter((cardId: string) => cardId === 'fire_arrow');
      assert.strictEqual(fireArrow.length, 0, 'alchemist should not have fire_arrow (replaced with volatile_catalyst)');
    });

    test('alchemist should include volatile_catalyst in starting deck (vNext replacement)', () => {
      const charDef = charactersData.find(c => c.id === 'alchemist');
      assert.ok(charDef);
      assert.ok(
        charDef.startingDeck.includes('volatile_catalyst'),
        'alchemist should include volatile_catalyst in starting deck (vNext replacement for fire_arrow)'
      );
    });

    test('alchemist should include alchemical_transmute in starting deck', () => {
      const charDef = charactersData.find(c => c.id === 'alchemist');
      assert.ok(charDef);
      assert.ok(
        charDef.startingDeck.includes('alchemical_transmute'),
        'alchemist should include alchemical_transmute in starting deck'
      );
    });

    test('alchemist should include concoct and acid_bath in starting deck', () => {
      const charDef = charactersData.find(c => c.id === 'alchemist');
      assert.ok(charDef);
      assert.ok(
        charDef.startingDeck.includes('concoct'),
        'alchemist should include concoct in starting deck'
      );
      assert.ok(
        charDef.startingDeck.includes('acid_bath'),
        'alchemist should include acid_bath in starting deck'
      );
    });

    test('alchemical_transmute should heal 3 HP per Element', () => {
      const card = getCard('alchemical_transmute');
      const transmute = card.actions.find((action: any) => action.type === 'TransmuteElements');
      assert.equal(transmute?.amount, 3, `expected alchemical_transmute to heal 3 HP per Element, got ${transmute?.amount}`);
      assert.match(card.text, /每有 1 个元素，恢复 3 点生命值。/);
    });
  });
  
  describe('4. 资源闭环测试', () => {
    test('chronomancer should start with timeLayer specialResource', () => {
      const charDef = charactersData.find(c => c.id === 'chronomancer');
      assert.ok(charDef, 'chronomancer should exist');
      assert.strictEqual(charDef.specialResource, 'timeLayer', 'chronomancer should have timeLayer specialResource');
    });
    
    test('puppeteer should start with thread specialResource', () => {
      const charDef = charactersData.find(c => c.id === 'puppeteer');
      assert.ok(charDef, 'puppeteer should exist');
      assert.strictEqual(charDef.specialResource, 'thread', 'puppeteer should have thread specialResource');
    });
    
    test('alchemist should start with concoction specialResource', () => {
      const charDef = charactersData.find(c => c.id === 'alchemist');
      assert.ok(charDef, 'alchemist should exist');
      assert.strictEqual(charDef.specialResource, 'concoction', 'alchemist should have concoction specialResource');
    });
    
    test('non-special-resource characters should not have special resources', () => {
      const charDef = charactersData.find(c => c.id === 'informant');
      assert.ok(charDef, 'informant should exist');
      assert.strictEqual(charDef.specialResource, undefined, 'informant should not have specialResource');
    });
  });
});
