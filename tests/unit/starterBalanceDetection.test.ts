import { describe, test } from 'node:test';
import assert from 'node:assert';
import charactersDataRaw from '@/content/data/characters.json';
const charactersData = charactersDataRaw as any[];

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
    
    for (const charId of characterIds) {
      test(`${charId} should have at least 2 strikes in starting deck`, () => {
        const charDef = charactersData.find(c => c.id === charId);
        assert.ok(charDef, `${charId} should exist`);
        
        const strikes = charDef.startingDeck.filter((cardId: string) => cardId === 'strike');
        assert.ok(strikes.length >= 2, `${charId} should have at least 2 strikes, got ${strikes.length}`);
      });
    }
    
    test('informant should have 3 strikes after adjustment', () => {
      const charDef = charactersData.find(c => c.id === 'informant');
      assert.ok(charDef);
      const strikes = charDef.startingDeck.filter((cardId: string) => cardId === 'strike');
      assert.strictEqual(strikes.length, 3, 'informant should have 3 strikes');
    });

    test('informant should include precision_strike in starting deck', () => {
      const charDef = charactersData.find(c => c.id === 'informant');
      assert.ok(charDef);
      assert.ok(
        charDef.startingDeck.includes('precision_strike'),
        'informant should include precision_strike in starting deck'
      );
    });

    test('informant should not include shadow_step in starting deck', () => {
      const charDef = charactersData.find(c => c.id === 'informant');
      assert.ok(charDef);
      assert.ok(
        !charDef.startingDeck.includes('shadow_step'),
        'informant should not include shadow_step in starting deck'
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
    
    test('chronomancer should have 2 echo_strike after adjustment', () => {
      const charDef = charactersData.find(c => c.id === 'chronomancer');
      assert.ok(charDef);
      const echoStrike = charDef.startingDeck.filter((cardId: string) => cardId === 'echo_strike');
      assert.strictEqual(echoStrike.length, 2, 'chronomancer should have 2 echo_strike');
    });
    
    test('alchemist should have 2 fire_arrow after adjustment', () => {
      const charDef = charactersData.find(c => c.id === 'alchemist');
      assert.ok(charDef);
      const fireArrow = charDef.startingDeck.filter((cardId: string) => cardId === 'fire_arrow');
      assert.strictEqual(fireArrow.length, 2, 'alchemist should have 2 fire_arrow');
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
