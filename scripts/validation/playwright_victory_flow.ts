/**
 * @file playwright_victory_flow.ts
 * @description 使用 Playwright 测试胜利流程的端到端测试。
 *
 * 主要职责:
 * - 运行完整游戏流程直到胜利
 * - 验证胜利条件和结局画面
 * - 记录每个步骤的截图和状态
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { execSync } from 'child_process';
import { chromium, type Page } from 'playwright';

interface VictoryTestReport {
  testName: string;
  passed: boolean;
  steps: Array<{
    step: string;
    screenshot: string;
    success: boolean;
    details?: string;
  }>;
  errors: string[];
  finalUrl?: string;
  victoryPageReached: boolean;
  screenshotPath: string;
}

function checkServer(url: string): boolean {
  try {
    execSync(`curl -s --max-time 2 ${url} > /dev/null 2>&1`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

async function waitForCombatReady(page: Page) {
  await Promise.race([
    page.locator('.enemy-standee').first().waitFor({ state: 'visible', timeout: 15000 }),
    page.locator('.player-standee').first().waitFor({ state: 'visible', timeout: 15000 })
  ]);
}

async function clickCharacterCard(page: Page, characterId: string) {
  const card = page.locator(`[data-character-id="${characterId}"]`).first();
  await card.scrollIntoViewIfNeeded();
  await card.click({ force: true });
  await page.waitForTimeout(500);
}

async function enterFirstCombat(page: Page) {
  await page.locator('button[data-node-id]').first().waitFor({ timeout: 10000 });
  const combatNode = page.locator('button[data-node-id]').filter({ hasText: /遭遇战|战斗/i }).first();
  if (await combatNode.count()) {
    await combatNode.click();
  } else {
    await page.locator('button[data-node-id]:not([disabled])').first().click();
  }
  await waitForCombatReady(page);
}

async function attackUntilVictory(page: Page, maxAttacks: number = 50): Promise<boolean> {
  for (let i = 0; i < maxAttacks; i++) {
    const currentUrl = page.url();

    const victorySelectors = [
      '[class*="victory"]',
      '[class*="reward"]',
      '[class*="loot"]',
      'text=/胜利|Victory|奖励|战利品/i',
      '.combat-result',
      '#victory',
      '#reward'
    ];

    for (const selector of victorySelectors) {
      const count = await page.locator(selector).count();
      if (count > 0) {
        console.log(`Victory/Reward page detected via selector: ${selector}`);
        return true;
      }
    }

    const strikeButton = page.getByRole('button', { name: /攻击|攻击|Strike/i }).first();
    if (await strikeButton.count() && await strikeButton.isEnabled()) {
      await strikeButton.click();
      await page.waitForTimeout(300);

      const endTurnButton = page.getByRole('button', { name: /结束回合|End Turn/i }).first();
      if (await endTurnButton.count() && await endTurnButton.isEnabled()) {
        await endTurnButton.click();
        await page.waitForTimeout(500);
      }
    } else {
      const cardButtons = page.locator('.card-button, button[class*="card"], [class*="card"] button').filter({ hasText: /.*/i });
      if (await cardButtons.count() > 0) {
        await cardButtons.first().click();
        await page.waitForTimeout(300);

        const endTurnButton = page.getByRole('button', { name: /结束回合|End Turn/i }).first();
        if (await endTurnButton.count() && await endTurnButton.isEnabled()) {
          await endTurnButton.click();
          await page.waitForTimeout(500);
        }
      } else {
        await page.waitForTimeout(500);
      }
    }
  }
  return false;
}

async function checkVictoryPageReached(page: Page): Promise<{ reached: boolean; details: string }> {
  const currentUrl = page.url().toLowerCase();
  const bodyText = await page.locator('body').innerText().catch(() => '');

  const victoryKeywords = ['victory', 'victory', '胜利', '奖励', 'reward', 'loot', '战利品'];
  const urlIndicatesVictory = victoryKeywords.some(k => currentUrl.includes(k));
  const textIndicatesVictory = victoryKeywords.some(k => bodyText.toLowerCase().includes(k));

  const victoryElements = await page.locator('[class*="victory"], [class*="reward"], [class*="loot"], #victory, #reward').count();

  if (urlIndicatesVictory || textIndicatesVictory || victoryElements > 0) {
    return {
      reached: true,
      details: `URL: ${currentUrl}, Victory elements: ${victoryElements}`
    };
  }

  return {
    reached: false,
    details: `Current URL: ${currentUrl}, Victory elements: ${victoryElements}`
  };
}

async function main() {
  const baseUrl = 'http://127.0.0.1:3001';
  const outputDir = path.join(process.cwd(), 'output', 'victory_test');
  mkdirSync(outputDir, { recursive: true });

  if (!checkServer(baseUrl)) {
    console.log('Server not running at', baseUrl, '- starting server...');
    console.log('Please start the server manually: npx vite --port=3001 --host');
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });

  const report: VictoryTestReport = {
    testName: 'Combat Victory Page Redirect Test',
    passed: false,
    steps: [],
    errors: [],
    victoryPageReached: false,
    screenshotPath: outputDir
  };

  try {
    console.log('Step 1: Loading homepage...');
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await page.screenshot({ path: path.join(outputDir, '01_homepage.png'), fullPage: true });

    const launcherVisible = await page.getByText('战区启动器').isVisible().catch(() => false);
    if (!launcherVisible) {
      throw new Error('Launcher not visible on homepage');
    }
    report.steps.push({
      step: 'Load homepage',
      screenshot: '01_homepage.png',
      success: true
    });

    console.log('Step 2: Starting new game...');
    await page.getByRole('button', { name: /开始新战区/i }).click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(outputDir, '02_new_game.png'), fullPage: true });

    const characterSelectVisible = await page.getByText('选择你的执行体').isVisible().catch(() => false);
    if (!characterSelectVisible) {
      throw new Error('Character select screen not visible');
    }
    report.steps.push({
      step: 'Open character select',
      screenshot: '02_new_game.png',
      success: true
    });

    console.log('Step 3: Selecting character...');
    await clickCharacterCard(page, 'brute');
    await page.waitForTimeout(500);

    const startButton = page.getByRole('button', { name: /Start Game|开始战区部署|开始游戏/i });
    if (await startButton.count()) {
      await startButton.scrollIntoViewIfNeeded();
      await startButton.click();
      await page.waitForTimeout(500);
    }
    await page.screenshot({ path: path.join(outputDir, '03_character_selected.png'), fullPage: true });
    report.steps.push({
      step: 'Select character and start',
      screenshot: '03_character_selected.png',
      success: true
    });

    console.log('Step 4: Entering first combat...');
    await enterFirstCombat(page);
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(outputDir, '04_in_combat.png'), fullPage: true });

    const enemyVisible = await page.locator('.enemy-standee').count();
    if (enemyVisible === 0) {
      throw new Error('Enemy not visible in combat');
    }
    report.steps.push({
      step: 'Enter first combat',
      screenshot: '04_in_combat.png',
      success: true,
      details: `Enemy standees found: ${enemyVisible}`
    });

    console.log('Step 5: Attacking until victory...');
    await page.screenshot({ path: path.join(outputDir, '05_combat_start.png'), fullPage: true });

    const victoryReached = await attackUntilVictory(page, 50);
    await page.waitForTimeout(1000);

    const { reached, details } = await checkVictoryPageReached(page);
    report.victoryPageReached = reached;

    await page.screenshot({ path: path.join(outputDir, '06_combat_end.png'), fullPage: true });
    report.steps.push({
      step: 'Combat ends',
      screenshot: '06_combat_end.png',
      success: true,
      details: details
    });

    report.finalUrl = page.url();

    if (reached) {
      console.log('SUCCESS: Victory page reached!');
      await page.screenshot({ path: path.join(outputDir, '07_victory_page.png'), fullPage: true });
      report.steps.push({
        step: 'Victory/Reward page',
        screenshot: '07_victory_page.png',
        success: true,
        details: details
      });
      report.passed = true;
    } else {
      console.log('FAILED: Victory page NOT reached');
      await page.screenshot({ path: path.join(outputDir, '07_no_victory.png'), fullPage: true });
      report.steps.push({
        step: 'No victory page',
        screenshot: '07_no_victory.png',
        success: false,
        details: details
      });
      report.errors.push(`Victory page not reached. Final state: ${details}`);
    }

  } catch (error) {
    const err = error as Error;
    console.error('Test error:', err.message);
    report.errors.push(err.message);
    await page.screenshot({ path: path.join(outputDir, 'error_state.png'), fullPage: true });
    report.steps.push({
      step: 'Error state',
      screenshot: 'error_state.png',
      success: false,
      details: err.message
    });
  } finally {
    report.finalUrl = page.url();
    writeFileSync(
      path.join(outputDir, 'victory_test_report.json'),
      JSON.stringify(report, null, 2)
    );

    console.log('\n=== Test Report ===');
    console.log(`Test: ${report.testName}`);
    console.log(`Passed: ${report.passed ? 'YES ✓' : 'NO ✗'}`);
    console.log(`Victory Page Reached: ${report.victoryPageReached ? 'YES ✓' : 'NO ✗'}`);
    console.log(`Final URL: ${report.finalUrl}`);
    console.log(`Screenshots: ${outputDir}`);
    console.log(`Errors: ${report.errors.length > 0 ? report.errors.join(', ') : 'None'}`);

    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
