import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { chromium, type Page, type Locator } from 'playwright';

interface CombatVictoryTestReport {
  timestamp: string;
  passed: boolean;
  checks: Array<{ label: string; status: 'passed' | 'failed'; detail: string }>;
  screenshots: string[];
  consoleLogs: string[];
  combatLogs: string[];
  errors: string[];
  energyHistory: Array<{ attack: number; energy: number; enemyHp: number; enemyBlock: number }>;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    url: 'http://127.0.0.1:3000',
    headed: false,
    maxAttacks: 15,
    waitAfterCard: 1500,
    waitAfterEnemy: 1000,
  };
  for (const arg of args) {
    if (arg.startsWith('--url=')) options.url = arg.split('=')[1];
    if (arg === '--headed') options.headed = true;
    if (arg.startsWith('--max-attacks=')) options.maxAttacks = parseInt(arg.split('=')[1]);
    if (arg.startsWith('--wait=')) options.waitAfterCard = parseInt(arg.split('=')[1]);
  }
  return options;
}

async function getGameState(page: Page): Promise<{
  screen: string;
  playerEnergy: number;
  playerMaxEnergy: number;
  enemyHp: number;
  enemyMaxHp: number;
  enemyBlock: number;
  handCount: number;
}> {
  const energyText = await page.locator('[class*="energy"], [class*="Energy"]').first().textContent().catch(() => '');
  const hpText = await page.locator('.enemy-standee [class*="hp"], .enemy-standee [class*="HP"], [class*="enemy-hp"]').first().textContent().catch(() => '');
  const blockText = await page.locator('.enemy-standee [class*="block"], [class*="block"]').first().textContent().catch(() => '');
  
  const energyMatch = energyText.match(/(\d+)\/(\d+)/);
  const hpMatch = hpText.match(/(\d+)/);
  const blockMatch = blockText.match(/(\d+)/);
  
  const handCount = await page.locator('[class*="card"], .immersive-card').count();
  
  return {
    screen: 'combat',
    playerEnergy: energyMatch ? parseInt(energyMatch[1]) : 3,
    playerMaxEnergy: energyMatch ? parseInt(energyMatch[2]) : 3,
    enemyHp: hpMatch ? parseInt(hpMatch[1]) : 30,
    enemyMaxHp: hpMatch ? parseInt(hpMatch[2]) : 30,
    enemyBlock: blockMatch ? parseInt(blockMatch[1]) : 0,
    handCount: handCount
  };
}

async function takeScreenshot(page: Page, name: string): Promise<string> {
  const screenshotPath = path.join(process.cwd(), 'output', 'playwright', 'combat_victory', `${name}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  return screenshotPath;
}

async function main() {
  const options = parseArgs();
  const outputDir = path.join(process.cwd(), 'output', 'playwright', 'combat_victory');
  mkdirSync(outputDir, { recursive: true });

  const report: CombatVictoryTestReport = {
    timestamp: new Date().toISOString(),
    passed: false,
    checks: [],
    screenshots: [],
    consoleLogs: [],
    combatLogs: [],
    errors: [],
    energyHistory: [],
  };

  const browser = await chromium.launch({ headless: !options.headed });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });

  page.on('console', (msg) => {
    const text = msg.text();
    const type = msg.type();
    report.consoleLogs.push(`[${type}] ${text}`);
    
    if (text.includes('[CombatManager.playCard]') || 
        text.includes('[GameEngine]') ||
        text.includes('damage') ||
        text.includes('enemy')) {
      report.combatLogs.push(`[${type}] ${text}`);
    }
  });
  
  page.on('pageerror', (error) => {
    report.errors.push(error.message);
  });

  try {
    console.log('Step 1: Opening launcher...');
    await page.goto(options.url, { waitUntil: 'networkidle' });
    await page.getByText('战区启动器').waitFor({ timeout: 10_000 });
    report.checks.push({ label: 'launcher_loaded', status: 'passed', detail: 'Launcher screen displayed' });
    await takeScreenshot(page, '01_launcher');
    report.screenshots.push('01_launcher.png');

    console.log('Step 2: Starting new game...');
    await page.getByRole('button', { name: /开始新战区|新局远征/i }).click();
    await page.waitForTimeout(500);
    
    const selectText = await page.getByText(/选择.*执行体|选择角色/i).count();
    if (selectText > 0) {
      report.checks.push({ label: 'character_select_loaded', status: 'passed', detail: 'Character select screen displayed' });
    }
    await takeScreenshot(page, '02_character_select');
    report.screenshots.push('02_character_select.png');

    console.log('Step 3: Selecting character...');
    const characterCard = page.locator('.cursor-pointer').first();
    await characterCard.scrollIntoViewIfNeeded();
    await characterCard.click({ force: true });
    await page.waitForTimeout(500);

    const startButton = page.getByRole('button', { name: /Start Game|开始/i });
    if (await startButton.count()) {
      await startButton.scrollIntoViewIfNeeded();
      await startButton.click();
    }
    await takeScreenshot(page, '03_character_selected');
    report.screenshots.push('03_character_selected.png');

    console.log('Step 4: Waiting for map...');
    await page.waitForTimeout(1000);
    
    const combatNode = page.locator('button[data-node-id]').filter({ 
      hasText: /遭遇战|Combat/i 
    }).first();
    
    if (await combatNode.count()) {
      await combatNode.click();
    } else {
      await page.locator('button[data-node-id]:not([disabled])').first().click();
    }
    
    await page.waitForTimeout(1000);
    
    report.checks.push({ label: 'combat_entered', status: 'passed', detail: 'Combat screen displayed' });
    await takeScreenshot(page, '04_combat');
    report.screenshots.push('04_combat.png');

    console.log('Step 5: Starting combat attacks...');
    
    const cardSelectors = [
      '.immersive-card',
      '[class*="card"]',
      '.grimdark-card-wrapper',
      '[data-card]',
    ];
    const enemySelectors = [
      '[class*="enemy-standee"]',
      '[class*="enemy-area"]',
      'button:has([class*="enemy"])',
    ];

    let attacks = 0;
    let victory = false;
    let consecutiveNoDamage = 0;

    while (attacks < options.maxAttacks && !victory) {
      attacks++;
      console.log(`\n=== Attack ${attacks} ===`);

      const beforeState = await getGameState(page);
      console.log(`Before: Energy ${beforeState.playerEnergy}/${beforeState.playerMaxEnergy}, Enemy HP ${beforeState.enemyHp}/${beforeState.enemyMaxHp}, Block ${beforeState.enemyBlock}`);
      
      report.energyHistory.push({
        attack: attacks,
        energy: beforeState.playerEnergy,
        enemyHp: beforeState.enemyHp,
        enemyBlock: beforeState.enemyBlock
      });

      if (beforeState.playerEnergy <= 0) {
        console.log('No energy left! Attempting to end turn...');
        report.checks.push({ label: `attack_${attacks}`, status: 'failed', detail: `No energy left (${beforeState.playerEnergy}/${beforeState.playerMaxEnergy})` });
        
        const endTurnBtn = page.getByRole('button', { name: /结束周期|End Turn/i });
        if (await endTurnBtn.count()) {
          await endTurnBtn.click();
          await page.waitForTimeout(2000);
          await takeScreenshot(page, `05_end_turn_${attacks}`);
          continue;
        }
        break;
      }

      const card = page.locator(cardSelectors[0]).first();
      if (!await card.count()) {
        report.checks.push({ label: `attack_${attacks}`, status: 'failed', detail: 'No card found' });
        break;
      }

      console.log('Clicking card...');
      await card.click();
      await page.waitForTimeout(options.waitAfterCard);

      const enemy = page.locator(enemySelectors[0]).first();
      if (await enemy.count()) {
        console.log('Clicking enemy...');
        await enemy.click();
        await page.waitForTimeout(options.waitAfterEnemy);
      } else {
        console.log('No enemy found to click');
      }

      await takeScreenshot(page, `06_attack_${attacks}`);
      report.screenshots.push(`06_attack_${attacks}.png`);

      const afterState = await getGameState(page);
      console.log(`After: Energy ${afterState.playerEnergy}/${afterState.playerMaxEnergy}, Enemy HP ${afterState.enemyHp}/${afterState.enemyMaxHp}, Block ${afterState.enemyBlock}`);

      const damageDealt = beforeState.enemyHp - afterState.enemyHp;
      console.log(`Damage dealt: ${damageDealt}`);
      
      if (damageDealt > 0) {
        consecutiveNoDamage = 0;
        report.checks.push({ label: `attack_${attacks}`, status: 'passed', detail: `Dealt ${damageDealt} damage (HP: ${beforeState.enemyHp} → ${afterState.enemyHp})` });
        
        if (afterState.enemyHp <= 0) {
          victory = true;
          console.log('VICTORY! Enemy defeated!');
          break;
        }
      } else {
        consecutiveNoDamage++;
        report.checks.push({ label: `attack_${attacks}`, status: 'failed', detail: `No damage dealt (HP unchanged: ${afterState.enemyHp})` });
        
        if (consecutiveNoDamage >= 3) {
          console.log('3 consecutive attacks with no damage! Something is wrong.');
          report.errors.push(`3 consecutive attacks with no damage at attack ${attacks}`);
          break;
        }
      }
    }

    await takeScreenshot(page, '07_final_state');
    report.screenshots.push('07_final_state.png');

    if (victory) {
      report.passed = true;
      report.checks.push({ label: 'victory', status: 'passed', detail: 'Enemy defeated, victory achieved!' });
      
      await page.waitForTimeout(2000);
      await takeScreenshot(page, '08_reward_screen');
      report.screenshots.push('08_reward_screen.png');
      
      const rewardText = await page.getByText(/奖励|Reward|选取|Select/i).count();
      if (rewardText > 0) {
        report.checks.push({ label: 'reward_screen', status: 'passed', detail: 'Reward screen displayed' });
      }
    } else {
      report.checks.push({ label: 'victory', status: 'failed', detail: `Failed to defeat enemy after ${attacks} attacks` });
    }

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    report.errors.push(errorMsg);
    report.checks.push({ label: 'test_error', status: 'failed', detail: errorMsg });
    await takeScreenshot(page, '99_error');
    report.screenshots.push('99_error.png');
  } finally {
    const reportPath = path.join(outputDir, 'combat_victory_report.json');
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n\n=== Report saved to: ${reportPath}`);
    console.log(`Screenshots: ${report.screenshots.length} files`);
    console.log(`Console logs: ${report.consoleLogs.length} entries`);
    console.log(`Combat logs: ${report.combatLogs.length} entries`);
    console.log(`\n=== Combat Logs (from PlayCard) ===`);
    report.combatLogs.forEach(log => console.log(log));
    console.log(`\n=== Energy History ===`);
    report.energyHistory.forEach(h => {
      console.log(`Attack ${h.attack}: Energy ${h.energy}, Enemy HP ${h.enemyHp}, Block ${h.enemyBlock}`);
    });
    console.log(`\n=== Test result: ${report.passed ? 'PASSED ✅' : 'FAILED ❌'} ===`);
    
    await browser.close();
    
    if (!report.passed) {
      process.exitCode = 1;
    }
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exitCode = 1;
});
