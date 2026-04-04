import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { chromium, type Page, type ConsoleMessage } from 'playwright';

interface CombatFlowReport {
  timestamp: string;
  baseUrl: string;
  consoleLogs: string[];
  targetLogs: {
    combatManagerPlayCard: boolean;
    enemyHpAfterAttack: boolean;
    enemyDefeated: boolean;
    handleCombatVictory: boolean;
  };
  screenshots: string[];
  findings: {
    autoNavigationAfterDefeat: boolean;
    consoleOutput: string[];
  };
}

async function main() {
  const baseUrl = 'http://localhost:3001';
  const outputDir = path.join(process.cwd(), 'output', 'combat-flow');
  mkdirSync(outputDir, { recursive: true });

  console.log('Starting combat flow test...');
  console.log('Target URL:', baseUrl);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  
  const targetLogs: CombatFlowReport['targetLogs'] = {
    combatManagerPlayCard: false,
    enemyHpAfterAttack: false,
    enemyDefeated: false,
    handleCombatVictory: false
  };
  const allConsoleLogs: string[] = [];
  const screenshots: string[] = [];

  page.on('console', (msg: ConsoleMessage) => {
    const text = msg.text();
    allConsoleLogs.push(`[${msg.type()}] ${text}`);
    
    if (text.includes('[CombatManager.playCard]')) {
      targetLogs.combatManagerPlayCard = true;
      console.log('✓ Found: [CombatManager.playCard]');
    }
    if (text.includes('[CombatManager] Enemy HP after attack')) {
      targetLogs.enemyHpAfterAttack = true;
      console.log('✓ Found: [CombatManager] Enemy HP after attack');
    }
    if (text.includes('[CombatManager] Enemy defeated')) {
      targetLogs.enemyDefeated = true;
      console.log('✓ Found: [CombatManager] Enemy defeated');
    }
    if (text.includes('[GameEngine.handleCombatVictory]')) {
      targetLogs.handleCombatVictory = true;
      console.log('✓ Found: [GameEngine.handleCombatVictory]');
    }
  });

  page.on('pageerror', (error) => {
    allConsoleLogs.push(`[pageerror] ${error.message}`);
  });

  try {
    console.log('\n1. Opening page...');
    await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(outputDir, '01-initial-load.png') });
    screenshots.push('01-initial-load.png');
    console.log('   Screenshot saved: 01-initial-load.png');

    console.log('\n2. Looking for "新局远征" button...');
    const startButton = page.getByRole('button', { name: /新局远征/i });
    if (await startButton.count() === 0) {
      const anyStartButton = page.getByRole('button', { name: /Start/i });
      if (await anyStartButton.count() > 0) {
        console.log('   Found "Start" button instead');
        await anyStartButton.first().click();
      } else {
        throw new Error('Could not find start button');
      }
    } else {
      await startButton.click();
    }
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(outputDir, '02-after-start-click.png') });
    screenshots.push('02-after-start-click.png');
    console.log('   Screenshot saved: 02-after-start-click.png');

    console.log('\n3. Selecting first character...');
    const characterCards = page.locator('[class*="cursor-pointer"]').filter({ has: page.locator('h2, h3, [class*="name"]') });
    const cardCount = await characterCards.count();
    console.log(`   Found ${cardCount} character cards`);
    
    if (cardCount > 0) {
      await characterCards.first().click({ force: true });
      await page.waitForTimeout(500);
    }
    await page.screenshot({ path: path.join(outputDir, '03-after-character-select.png') });
    screenshots.push('03-after-character-select.png');
    console.log('   Screenshot saved: 03-after-character-select.png');

    console.log('\n4. Starting game and entering first combat...');
    const beginButton = page.getByRole('button', { name: /Begin|开始|出发/i }).first();
    if (await beginButton.count() > 0) {
      await beginButton.click();
      await page.waitForTimeout(1000);
    }

    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(outputDir, '04-before-combat.png') });
    screenshots.push('04-before-combat.png');
    console.log('   Screenshot saved: 04-before-combat.png');

    const combatNode = page.locator('button[data-node-id]').filter({ hasText: /遭遇战|战斗/i }).first();
    if (await combatNode.count() > 0) {
      await combatNode.click();
      await page.waitForTimeout(1500);
    } else {
      const firstNode = page.locator('button[data-node-id]').first();
      if (await firstNode.count() > 0) {
        await firstNode.click();
        await page.waitForTimeout(1500);
      }
    }

    await page.screenshot({ path: path.join(outputDir, '05-in-combat.png') });
    screenshots.push('05-in-combat.png');
    console.log('   Screenshot saved: 05-in-combat.png');

    console.log('\n5. Attacking enemy until defeat...');
    let attackCount = 0;
    const maxAttacks = 20;
    
    while (attackCount < maxAttacks) {
      const enemyExists = await page.locator('.enemy-standee, [class*="enemy"], [class*="Enemy"]').count() > 0;
      if (!enemyExists) {
        console.log('   Enemy no longer visible');
        break;
      }

      const attackButton = page.getByRole('button', { name: /攻击|Attack|攻击敌人/i }).first();
      const anyClickable = page.locator('.immersive-card, [class*="card"], button[class*="cursor"]').first();
      
      if (await attackButton.count() > 0) {
        await attackButton.click();
        console.log(`   Attack ${attackCount + 1}: clicked attack button`);
      } else if (await anyClickable.count() > 0) {
        await anyClickable.click({ force: true });
        console.log(`   Attack ${attackCount + 1}: clicked card`);
      } else {
        console.log('   No attack button found, trying to find enemy to click...');
        const enemy = page.locator('.enemy-standee, [class*="enemy"]').first();
        if (await enemy.count() > 0) {
          await enemy.click();
          console.log(`   Attack ${attackCount + 1}: clicked enemy`);
        }
      }
      
      attackCount++;
      await page.waitForTimeout(800);
      
      const newEnemyExists = await page.locator('.enemy-standee, [class*="enemy"], [class*="Enemy"]').count() > 0;
      if (!newEnemyExists) {
        console.log('   Enemy appears defeated!');
        await page.waitForTimeout(1000);
        await page.screenshot({ path: path.join(outputDir, '06-enemy-defeated.png') });
        screenshots.push('06-enemy-defeated.png');
        console.log('   Screenshot saved: 06-enemy-defeated.png');
        break;
      }
    }

    console.log('\n6. Checking for auto-navigation after enemy defeat...');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(outputDir, '07-after-wait.png') });
    screenshots.push('07-after-wait.png');
    console.log('   Screenshot saved: 07-after-wait.png');

    const currentUrl = page.url();
    console.log('\n   Current URL:', currentUrl);

    const bodyText = await page.locator('body').innerText();
    const hasVictoryScreen = /Victory|胜利|结算|Reward|奖励/i.test(bodyText);
    const hasContinueButton = await page.getByRole('button', { name: /Continue|继续|结算/i }).count() > 0;
    
    console.log('\n7. Checking page state:');
    console.log('   - Victory/结算 screen detected:', hasVictoryScreen);
    console.log('   - Continue button exists:', hasContinueButton);

  } catch (error) {
    console.error('\n   Error during test:', error);
    await page.screenshot({ path: path.join(outputDir, '99-error-state.png') });
    screenshots.push('99-error-state.png');
  }

  console.log('\n========== TEST SUMMARY ==========');
  console.log('\nTarget Console Logs:');
  console.log('  [CombatManager.playCard]:', targetLogs.combatManagerPlayCard ? 'FOUND ✓' : 'NOT FOUND ✗');
  console.log('  [CombatManager] Enemy HP after attack:', targetLogs.enemyHpAfterAttack ? 'FOUND ✓' : 'NOT FOUND ✗');
  console.log('  [CombatManager] Enemy defeated:', targetLogs.enemyDefeated ? 'FOUND ✓' : 'NOT FOUND ✗');
  console.log('  [GameEngine.handleCombatVictory]:', targetLogs.handleCombatVictory ? 'FOUND ✓' : 'NOT FOUND ✗');

  console.log('\nAll Console Logs (filtered for CombatManager/GameEngine):');
  const relevantLogs = allConsoleLogs.filter(log => 
    log.includes('CombatManager') || log.includes('GameEngine') || log.includes('Combat')
  );
  if (relevantLogs.length > 0) {
    relevantLogs.forEach(log => console.log('  ', log));
  } else {
    console.log('  (No relevant logs found)');
  }

  console.log('\nScreenshots saved to:', outputDir);

  const report: CombatFlowReport = {
    timestamp: new Date().toISOString(),
    baseUrl,
    consoleLogs: allConsoleLogs,
    targetLogs,
    screenshots,
    findings: {
      autoNavigationAfterDefeat: allConsoleLogs.some(log => log.includes('Victory') || log.includes('handleCombatVictory')),
      consoleOutput: relevantLogs
    }
  };

  const fs = await import('node:fs');
  fs.writeFileSync(path.join(outputDir, 'combat-flow-report.json'), JSON.stringify(report, null, 2));
  console.log('\nReport saved to: output/combat-flow/combat-flow-report.json');

  await browser.close();
  console.log('\n===================================');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
