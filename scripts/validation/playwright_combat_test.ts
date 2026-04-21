import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium, type Page } from 'playwright';

interface CombatTestReport {
  baseUrl: string;
  combatLogs: string[];
  screenshots: string[];
  combatSuccess: boolean;
  reachedRewardPage: boolean;
  error?: string;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    url: 'http://localhost:3001',
    headed: false,
    maxAttacks: 20,
  };
  for (const arg of args) {
    if (arg.startsWith('--url=')) options.url = arg.split('=')[1];
    if (arg === '--headed') options.headed = true;
  }
  return options;
}

async function clearLocalStorage(page: Page) {
  await page.evaluate(() => {
    localStorage.clear();
    console.log('[Test] localStorage cleared');
  });
}

async function clickCharacterBrute(page: Page) {
  console.log('[Test] Looking for The Brute character...');

  const bruteCard = page.locator('[data-character-id="brute"]').first();
  if (await bruteCard.count() === 0) {
    const allCards = page.locator('[data-character-id]');
    const count = await allCards.count();
    console.log(`[Test] Found ${count} character cards`);
    for (let i = 0; i < count; i++) {
      const id = await allCards.nth(i).getAttribute('data-character-id');
      console.log(`[Test] Card ${i}: ${id}`);
    }
    throw new Error('The Brute character card not found');
  }

  await bruteCard.scrollIntoViewIfNeeded();
  await bruteCard.click();
  console.log('[Test] Clicked The Brute character');
  await page.waitForTimeout(500);
}

async function startGame(page: Page) {
  console.log('[Test] Looking for Start Game button...');
  const startButton = page.getByRole('button', { name: /Start Game|开始战区部署|开始游戏/i }).first();
  await startButton.scrollIntoViewIfNeeded();
  await startButton.click();
  console.log('[Test] Clicked Start Game');
  await page.waitForTimeout(1000);
}

async function enterFirstCombat(page: Page) {
  console.log('[Test] Waiting for map to load...');
  await page.locator('button[data-node-id]').first().waitFor({ timeout: 15_000 });
  await page.waitForTimeout(500);

  const combatNodes = page.locator('button[data-node-id]').filter({ hasText: /Combat|Encounter/i });
  const nodeCount = await combatNodes.count();
  console.log(`[Test] Found ${nodeCount} combat nodes`);

  if (nodeCount > 0) {
    console.log('[Test] Clicking first combat node...');
    await combatNodes.first().click();
  } else {
    console.log('[Test] No combat nodes found, clicking first available node...');
    await page.locator('button[data-node-id]').first().click();
  }

  console.log('[Test] Waiting for combat to load...');
  await Promise.race([
    page.locator('.enemy-standee').first().waitFor({ timeout: 15_000 }),
    page.locator('[data-screen="Combat"]').waitFor({ timeout: 15_000 }),
  ]);
  await page.waitForTimeout(1000);
  console.log('[Test] Combat loaded');
}

async function getEnemyHP(page: Page): Promise<number | null> {
  const hpText = await page.locator('.enemy-standee [class*="hp"], .enemy-standee [class*="HP"]').first().textContent().catch(() => null);
  if (hpText) {
    const match = hpText.match(/(\d+)/);
    return match ? parseInt(match[1]) : null;
  }
  return null;
}

async function playAttackCard(page: Page, cardIndex: number = 0): Promise<boolean> {
  const cards = page.locator('.immersive-card, [class*="card"]').filter({ hasNot: page.locator('[disabled]') });
  const count = await cards.count();

  if (count === 0) {
    console.log('[Test] No playable cards found');
    return false;
  }

  const targetCard = count > cardIndex ? cards.nth(cardIndex) : cards.first();
  await targetCard.scrollIntoViewIfNeeded();
  await targetCard.click();
  console.log(`[Test] Clicked card at index ${cardIndex}`);
  await page.waitForTimeout(300);

  const enemyTarget = page.locator('.enemy-standee, [data-target="enemy"]').first();
  if (await enemyTarget.count() > 0) {
    await enemyTarget.click();
    console.log('[Test] Clicked enemy target');
    await page.waitForTimeout(500);
  }

  return true;
}

async function executeCombat(page: Page, maxAttacks: number): Promise<{ success: boolean; attacksUsed: number }> {
  console.log('[Test] Starting combat execution...');

  for (let i = 0; i < maxAttacks; i++) {
    const enemyHp = await getEnemyHP(page);
    console.log(`[Test] Attack ${i + 1}: Enemy HP = ${enemyHp ?? 'unknown'}`);

    if (enemyHp === null || enemyHp <= 0) {
      console.log('[Test] Enemy defeated!');
      return { success: true, attacksUsed: i + 1 };
    }

    const played = await playAttackCard(page, 0);
    if (!played) {
      console.log('[Test] No more playable cards, combat may be over');
      await page.waitForTimeout(1000);
      break;
    }

    await page.waitForTimeout(800);
  }

  const finalHp = await getEnemyHP(page);
  console.log(`[Test] Final enemy HP: ${finalHp ?? 'unknown'}`);

  const rewardScreen = await page.locator('[data-screen="Reward"], [data-scene="reward"]').count();
  return { success: rewardScreen > 0, attacksUsed: maxAttacks };
}

async function captureCombatLogs(page: Page): Promise<string[]> {
  return await page.evaluate(() => {
    const logs: string[] = [];
    const originalLog = console.log;

    const filterLog = (...args: unknown[]) => {
      const text = args.map(a => String(a)).join(' ');
      if (text.includes('[CombatManager]') || text.includes('[GameEngine]')) {
        logs.push(text);
      }
      originalLog.apply(console, args);
    };

    console.log = filterLog;
    return logs;
  });
}

async function main() {
  const options = parseArgs();
  const outputDir = path.join(process.cwd(), 'output', 'playwright', 'combat_test');
  mkdirSync(outputDir, { recursive: true });

  const report: CombatTestReport = {
    baseUrl: options.url,
    combatLogs: [],
    screenshots: [],
    combatSuccess: false,
    reachedRewardPage: false,
  };

  const browser = await chromium.launch({ headless: !options.headed });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });

  page.on('console', (msg) => {
    const text = msg.text();
    report.combatLogs.push(text);
    if (text.includes('[CombatManager]') || text.includes('[GameEngine]')) {
      console.log(text);
    }
  });

  page.on('pageerror', (error) => {
    console.log('[Page Error]', error.message);
    report.combatLogs.push(`[Page Error] ${error.message}`);
  });

  try {
    console.log(`[Test] Navigating to ${options.url}`);
    await page.goto(options.url, { waitUntil: 'networkidle', timeout: 30_000 });

    await page.waitForTimeout(2000);

    await clearLocalStorage(page);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    const screenshotPath = path.join(outputDir, '01_initial_load.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    report.screenshots.push(screenshotPath);
    console.log('[Test] Screenshot: initial load');

    console.log('[Test] Looking for New Expedition button...');
    const newGameButton = page.getByRole('button', { name: /New Expedition|新局远征/i }).first();
    await newGameButton.waitFor({ timeout: 10_000 });
    await newGameButton.scrollIntoViewIfNeeded();
    await newGameButton.click();
    console.log('[Test] Clicked New Expedition');
    await page.waitForTimeout(1000);

    const charSelectScreenshot = path.join(outputDir, '02_character_select.png');
    await page.screenshot({ path: charSelectScreenshot, fullPage: true });
    report.screenshots.push(charSelectScreenshot);
    console.log('[Test] Screenshot: character select');

    await clickCharacterBrute(page);
    await startGame(page);

    const mapScreenshot = path.join(outputDir, '03_map.png');
    await page.screenshot({ path: mapScreenshot, fullPage: true });
    report.screenshots.push(mapScreenshot);
    console.log('[Test] Screenshot: map');

    await enterFirstCombat(page);

    const combatScreenshot = path.join(outputDir, '04_combat.png');
    await page.screenshot({ path: combatScreenshot, fullPage: true });
    report.screenshots.push(combatScreenshot);
    console.log('[Test] Screenshot: combat');

    const combatResult = await executeCombat(page, options.maxAttacks);
    report.combatSuccess = combatResult.success;
    console.log(`[Test] Combat result: success=${combatResult.success}, attacksUsed=${combatResult.attacksUsed}`);

    await page.waitForTimeout(2000);

    const rewardScreenshot = path.join(outputDir, '05_reward_or_final.png');
    await page.screenshot({ path: rewardScreenshot, fullPage: true });
    report.screenshots.push(rewardScreenshot);
    console.log('[Test] Screenshot: final state');

    const rewardScreen = await page.locator('[data-screen="Reward"], [data-scene="reward"]').count();
    report.reachedRewardPage = rewardScreen > 0;
    console.log(`[Test] Reached reward page: ${report.reachedRewardPage}`);

    if (!report.reachedRewardPage) {
      const currentScreen = await page.locator('[data-screen]').first().getAttribute('data-screen');
      console.log(`[Test] Current screen: ${currentScreen ?? 'unknown'}`);
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[Test] Error:', errorMessage);
    report.error = errorMessage;

    const errorScreenshot = path.join(outputDir, '99_error.png');
    await page.screenshot({ path: errorScreenshot, fullPage: true }).catch(() => {});
    report.screenshots.push(errorScreenshot);
  } finally {
    const relevantLogs = report.combatLogs.filter(log =>
      log.includes('[CombatManager]') ||
      log.includes('[GameEngine]') ||
      log.includes('[Test]')
    );

    const reportPath = path.join(outputDir, 'report.json');
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`[Test] Report saved to ${reportPath}`);

    const logsPath = path.join(outputDir, 'combat_logs.txt');
    writeFileSync(logsPath, relevantLogs.join('\n'));
    console.log(`[Test] Logs saved to ${logsPath}`);

    const summaryPath = path.join(outputDir, 'summary.txt');
    const summary = `
Combat Test Summary
===================
URL: ${report.baseUrl}
Combat Success: ${report.combatSuccess}
Reached Reward Page: ${report.reachedRewardPage}
Screenshots: ${report.screenshots.length}
Error: ${report.error ?? 'None'}

Relevant Logs:
${relevantLogs.join('\n')}
`;
    writeFileSync(summaryPath, summary);
    console.log(`[Test] Summary saved to ${summaryPath}`);

    await browser.close();
  }

  if (report.error) {
    console.error('Test failed with error:', report.error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
