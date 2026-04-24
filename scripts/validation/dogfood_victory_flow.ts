/**
 * @file dogfood_victory_flow.ts
 * @description 使用 Playwright 进行胜利流程的端到端测试。
 *
 * 主要职责:
 * - 启动开发服务器并运行浏览器测试
 * - 模拟完整游戏流程直到胜利
 * - 记录每个步骤的截图和错误信息
 */

import { mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { chromium, type Page, type ConsoleMessage } from 'playwright';

interface VictoryTestReport {
  testName: string;
  testTime: string;
  passed: boolean;
  steps: Array<{
    step: string;
    screenshot: string;
    success: boolean;
    timestamp: string;
    details?: string;
  }>;
  errors: string[];
  consoleErrors: string[];
  finalUrl?: string;
  victoryPageReached: boolean;
  screenshotPath: string;
}

function getTimestamp(): string {
  return new Date().toISOString();
}

function log(msg: string): void {
  console.log(`[${getTimestamp()}] ${msg}`);
}

function checkServer(url: string): boolean {
  try {
    execSync(`curl -s --max-time 3 "${url}" > /dev/null 2>&1`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

async function waitForCombatReady(page: Page): Promise<boolean> {
  try {
    await Promise.race([
      page.locator('.enemy-standee').first().waitFor({ state: 'visible', timeout: 15000 }),
      page.locator('[class*="enemy"]').first().waitFor({ state: 'visible', timeout: 15000 }),
      page.locator('[class*="combat"]').first().waitFor({ state: 'visible', timeout: 15000 }),
    ]);
    return true;
  } catch {
    return false;
  }
}

async function clickCharacterAndStart(page: Page): Promise<void> {
  await page.waitForTimeout(500);

  const characterCards = page.locator('div.cursor-pointer, [class*="character"], button[class*="char"]');
  const count = await characterCards.count();

  if (count > 0) {
    await characterCards.first().scrollIntoViewIfNeeded();
    await characterCards.first().click({ force: true });
    await page.waitForTimeout(500);
  }

  const startButton = page.getByRole('button', { name: /开始|Start/i });
  if (await startButton.count() > 0) {
    await startButton.first().scrollIntoViewIfNeeded();
    await startButton.first().click({ force: true });
    await page.waitForTimeout(500);
  }
}

async function enterFirstCombat(page: Page): Promise<boolean> {
  await page.waitForTimeout(1000);

  const combatNode = page.locator('button[data-node-id]').filter({ hasText: /遭遇战|战斗|Combat/i }).first();
  if (await combatNode.count() > 0) {
    await combatNode.scrollIntoViewIfNeeded();
    await combatNode.click({ force: true });
    await page.waitForTimeout(500);
    return true;
  }

  const firstNode = page.locator('button[data-node-id]:not([disabled])').first();
  if (await firstNode.count() > 0) {
    await firstNode.scrollIntoViewIfNeeded();
    await firstNode.click({ force: true });
    await page.waitForTimeout(500);
    return true;
  }

  return false;
}

async function getEnemyHp(page: Page): Promise<number | null> {
  const hpSelectors = [
    '[class*="hp"]',
    '[class*="health"]',
    '[class*="enemy"]',
    'span:text-matches(/\\d+/):visible'
  ];

  for (const selector of hpSelectors) {
    const elements = page.locator(selector);
    const count = await elements.count();
    for (let i = 0; i < count; i++) {
      const text = await elements.nth(i).innerText().catch(() => '');
      const match = text.match(/(\d+)\s*[\/\-]\s*(\d+)/);
      if (match) {
        return parseInt(match[1], 10);
      }
      const numMatch = text.match(/^(\d+)$/);
      if (numMatch) {
        return parseInt(numMatch[1], 10);
      }
    }
  }
  return null;
}

async function attackUntilVictory(page: Page, maxTurns: number = 30): Promise<{ victory: boolean; turnsUsed: number }> {
  let previousHp = -1;
  let noChangeCount = 0;

  for (let turn = 0; turn < maxTurns; turn++) {
    const currentUrl = page.url().toLowerCase();
    if (currentUrl.includes('reward') || currentUrl.includes('victory')) {
      return { victory: true, turnsUsed: turn };
    }

    const bodyText = await page.locator('body').innerText().catch(() => '');
    if (/胜利|Victory|奖励|Reward|战利品/i.test(bodyText)) {
      return { victory: true, turnsUsed: turn };
    }

    const cardButtons = page.locator('button[class*="card"], [class*="card-button"], .card');
    const cardCount = await cardButtons.count();

    if (cardCount === 0) {
      await page.waitForTimeout(500);
      continue;
    }

    const enemyHp = await getEnemyHp(page);
    if (enemyHp !== null && enemyHp === previousHp) {
      noChangeCount++;
    } else {
      noChangeCount = 0;
      previousHp = enemyHp ?? -1;
    }

    if (noChangeCount >= 3 && turn > 2) {
      const endTurnBtn = page.getByRole('button', { name: /结束|End/i }).first();
      if (await endTurnBtn.count() > 0 && await endTurnBtn.isEnabled()) {
        await endTurnBtn.click();
        await page.waitForTimeout(500);
        noChangeCount = 0;
        continue;
      }
    }

    const attackCard = page.locator('button').filter({ hasText: /攻击|Strike|Slash|打击|斩/i }).first();
    if (await attackCard.count() > 0 && await attackCard.isEnabled()) {
      await attackCard.click();
      await page.waitForTimeout(300);
    } else if (cardCount > 0) {
      const randomCard = cardButtons.nth(Math.floor(Math.random() * cardCount));
      if (await randomCard.isEnabled()) {
        await randomCard.click();
        await page.waitForTimeout(300);
      }
    }

    const endTurnBtn = page.getByRole('button', { name: /结束|End/i }).first();
    if (await endTurnBtn.count() > 0 && await endTurnBtn.isEnabled()) {
      await endTurnBtn.click();
      await page.waitForTimeout(800);
    }
  }

  return { victory: false, turnsUsed: maxTurns };
}

async function checkVictoryPageReached(page: Page): Promise<{ reached: boolean; details: string }> {
  const currentUrl = page.url().toLowerCase();
  const bodyText = await page.locator('body').innerText().catch(() => '');

  const victoryKeywords = ['victory', 'victory', '胜利', '奖励', 'reward', 'loot', '战利品', 'reward'];
  const urlIndicatesVictory = victoryKeywords.some(k => currentUrl.includes(k));
  const textIndicatesVictory = victoryKeywords.some(k => bodyText.toLowerCase().includes(k));

  const rewardElements = await page.locator('[class*="reward"], [class*="victory"], [class*="loot"], #reward, #victory, .reward, .victory').count();

  if (urlIndicatesVictory || textIndicatesVictory || rewardElements > 0) {
    return {
      reached: true,
      details: `URL: ${currentUrl}, Victory/Reward elements: ${rewardElements}`
    };
  }

  return {
    reached: false,
    details: `URL: ${currentUrl}, Body preview: ${bodyText.substring(0, 200)}`
  };
}

async function captureConsoleErrors(page: Page): Promise<string[]> {
  const errors: string[] = [];

  page.on('console', (msg: ConsoleMessage) => {
    if (msg.type() === 'error') {
      errors.push(`[${msg.type()}] ${msg.text()}`);
    }
  });

  page.on('pageerror', (err: Error) => {
    errors.push(`[pageerror] ${err.message}`);
  });

  return errors;
}

async function main() {
  const baseUrl = 'http://127.0.0.1:3001';
  const outputDir = path.join(process.cwd(), 'dogfood-output');
  const screenshotDir = path.join(outputDir, 'screenshots');

  mkdirSync(screenshotDir, { recursive: true });

  const report: VictoryTestReport = {
    testName: '敌人死亡后自动跳转结算页面功能验证',
    testTime: new Date().toISOString(),
    passed: false,
    steps: [],
    errors: [],
    consoleErrors: [],
    victoryPageReached: false,
    screenshotPath: screenshotDir
  };

  log('========== DeckRogue 战斗胜利跳转验证测试 ==========');

  if (!checkServer(baseUrl)) {
    log(`错误: 服务器未运行于 ${baseUrl}`);
    log('请先启动服务器: npm run dev (端口 3001)');
    report.errors.push(`服务器未运行于 ${baseUrl}`);
    report.passed = false;

    writeFileSync(
      path.join(outputDir, 'report.md'),
      generateMarkdownReport(report)
    );
    process.exit(1);
  }

  log('服务器连接正常');

  const browser = await chromium.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });

  await captureConsoleErrors(page);

  try {
    log('步骤 1: 加载首页...');
    await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 30000 });
    const screenshot = path.join(screenshotDir, '01_homepage.png');
    await page.screenshot({ path: screenshot, fullPage: true });

    const launcherText = await page.locator('body').innerText().catch(() => '');
    const hasLauncher = /战区|启动|Launcher/i.test(launcherText);

    report.steps.push({
      step: '1. 加载首页',
      screenshot: screenshot,
      success: hasLauncher,
      timestamp: getTimestamp(),
      details: hasLauncher ? '战区启动器界面正常显示' : '未找到战区启动器'
    });

    if (!hasLauncher) {
      throw new Error('未检测到战区启动器界面');
    }

    log('步骤 2: 开始新游戏...');
    const newGameBtn = page.getByRole('button', { name: /新局远征|开始新战区|新战区/i }).first();
    if (await newGameBtn.count() === 0) {
      const anyStartBtn = page.locator('button').filter({ hasText: /开始|Start/i }).first();
      if (await anyStartBtn.count() > 0) {
        await anyStartBtn.click();
      } else {
        throw new Error('未找到开始游戏按钮');
      }
    } else {
      await newGameBtn.click();
    }
    await page.waitForTimeout(1000);

    const screenshot2 = path.join(screenshotDir, '02_new_game.png');
    await page.screenshot({ path: screenshot2, fullPage: true });

    const charSelectText = await page.locator('body').innerText().catch(() => '');
    const hasCharSelect = /选择|角色|Character|Select/i.test(charSelectText);

    report.steps.push({
      step: '2. 开始新游戏',
      screenshot: screenshot2,
      success: true,
      timestamp: getTimestamp(),
      details: hasCharSelect ? '显示角色选择界面' : '进入角色选择'
    });

    log('步骤 3: 选择角色并开始游戏...');
    await clickCharacterAndStart(page);
    await page.waitForTimeout(1500);

    const screenshot3 = path.join(screenshotDir, '03_character_selected.png');
    await page.screenshot({ path: screenshot3, fullPage: true });

    report.steps.push({
      step: '3. 选择角色并开始',
      screenshot: screenshot3,
      success: true,
      timestamp: getTimestamp(),
      details: '角色已选择，等待进入地图'
    });

    log('步骤 4: 进入第一个战斗房间...');
    const combatEntered = await enterFirstCombat(page);
    await page.waitForTimeout(1500);

    const screenshot4 = path.join(screenshotDir, '04_in_combat.png');
    await page.screenshot({ path: screenshot4, fullPage: true });

    const combatReady = await waitForCombatReady(page);

    report.steps.push({
      step: '4. 进入战斗房间',
      screenshot: screenshot4,
      success: combatEntered && combatReady,
      timestamp: getTimestamp(),
      details: combatReady ? '战斗界面已加载，敌人可见' : '战斗界面加载状态未知'
    });

    if (!combatReady) {
      throw new Error('战斗界面未正确加载');
    }

    log('步骤 5: 持续攻击直到敌人死亡...');
    const screenshot5 = path.join(screenshotDir, '05_combat_start.png');
    await page.screenshot({ path: screenshot5, fullPage: true });

    const { victory, turnsUsed } = await attackUntilVictory(page, 30);

    log(`攻击结束，使用了 ${turnsUsed} 个回合`);

    const screenshot6 = path.join(screenshotDir, '06_after_combat.png');
    await page.screenshot({ path: screenshot6, fullPage: true });

    const { reached, details } = await checkVictoryPageReached(page);
    report.victoryPageReached = reached;

    report.steps.push({
      step: '6. 战斗结束状态',
      screenshot: screenshot6,
      success: true,
      timestamp: getTimestamp(),
      details: `使用了 ${turnsUsed} 个回合, ${details}`
    });

    report.finalUrl = page.url();

    if (reached) {
      log('✅ 成功: 敌人死亡后跳转到了奖励页面!');

      const screenshot7 = path.join(screenshotDir, '07_victory_page.png');
      await page.screenshot({ path: screenshot7, fullPage: true });

      report.steps.push({
        step: '7. 奖励/Victory 页面',
        screenshot: screenshot7,
        success: true,
        timestamp: getTimestamp(),
        details: '敌人死亡后正确跳转到奖励页面'
      });

      report.passed = true;
    } else {
      log('❌ 失败: 敌人死亡后未跳转到奖励页面');

      const screenshot7 = path.join(screenshotDir, '07_no_victory.png');
      await page.screenshot({ path: screenshot7, fullPage: true });

      report.steps.push({
        step: '7. 未到达奖励页面',
        screenshot: screenshot7,
        success: false,
        timestamp: getTimestamp(),
        details: details
      });

      report.errors.push(`敌人死亡后未跳转: ${details}`);
      report.passed = false;
    }

  } catch (error) {
    const err = error as Error;
    log(`测试异常: ${err.message}`);
    report.errors.push(err.message);

    const errorScreenshot = path.join(screenshotDir, 'error_state.png');
    await page.screenshot({ path: errorScreenshot, fullPage: true }).catch(() => {});

    report.steps.push({
      step: '错误状态',
      screenshot: errorScreenshot,
      success: false,
      timestamp: getTimestamp(),
      details: err.message
    });

    report.passed = false;
  } finally {
    report.finalUrl = page.url();
    report.consoleErrors = report.consoleErrors.filter(e =>
      !e.includes('favicon') && !e.includes('404')
    );

    const jsonReport = path.join(outputDir, 'victory_flow_report.json');
    writeFileSync(jsonReport, JSON.stringify(report, null, 2));

    const mdReport = path.join(outputDir, 'report.md');
    writeFileSync(mdReport, generateMarkdownReport(report));

    log('========== 测试报告 ==========');
    log(`测试名称: ${report.testName}`);
    log(`测试时间: ${report.testTime}`);
    log(`测试结果: ${report.passed ? '✅ 通过' : '❌ 失败'}`);
    log(`奖励页面到达: ${report.victoryPageReached ? '✅ 是' : '❌ 否'}`);
    log(`最终 URL: ${report.finalUrl}`);
    log(`截图目录: ${screenshotDir}`);
    log(`控制台错误: ${report.consoleErrors.length > 0 ? report.consoleErrors.length + ' 个' : '无'}`);
    log(`详细报告: ${mdReport}`);
    log('==============================');

    await browser.close();
  }
}

function generateMarkdownReport(report: VictoryTestReport): string {
  const status = report.passed ? '✅ 通过' : '❌ 失败';
  const victoryStatus = report.victoryPageReached ? '✅ 已到达' : '❌ 未到达';

  let md = `# DeckRogue 战斗胜利跳转验证报告

## 测试概览

| 字段 | 内容 |
|------|------|
| 测试目标 | 敌人死亡后自动跳转结算页面功能 |
| 测试时间 | ${report.testTime} |
| 测试结果 | ${status} |
| 奖励页面到达 | ${victoryStatus} |
| 最终 URL | ${report.finalUrl || 'N/A'} |
| 控制台错误 | ${report.consoleErrors.length} 个 |

## 验收标准

- 敌人死亡后界面应自动跳转到奖励选择页面: ${report.victoryPageReached ? '✅ 通过' : '❌ 未通过'}
- 不应出现黑屏、卡死或停留在战斗界面的情况: ${report.victoryPageReached ? '✅ 通过' : '❌ 未通过'}

## 测试步骤详情

`;

  for (const step of report.steps) {
    const stepStatus = step.success ? '✅' : '❌';
    md += `### ${stepStatus} ${step.step}\n\n`;
    md += `- 时间: ${step.timestamp}\n`;
    md += `- 截图: [${path.basename(step.screenshot)}](screenshots/${path.basename(step.screenshot)})\n`;
    if (step.details) {
      md += `- 详情: ${step.details}\n`;
    }
    md += '\n';
  }

  if (report.consoleErrors.length > 0) {
    md += `## 控制台错误\n\n`;
    for (const error of report.consoleErrors) {
      md += `- \`${error}\`\n`;
    }
    md += '\n';
  }

  if (report.errors.length > 0) {
    md += `## 发现的问题\n\n`;
    for (let i = 0; i < report.errors.length; i++) {
      md += `### 问题 ${i + 1}: ${report.errors[i]}\n\n`;
    }
  }

  md += `## 总结\n\n`;
  md += `| 验收项 | 结果 |\n|--------|------|\n`;
  md += `| 敌人死亡后跳转到奖励页面 | ${report.victoryPageReached ? '✅ 通过' : '❌ 失败'} |\n`;
  md += `| 无黑屏/卡死现象 | ${report.victoryPageReached ? '✅ 通过' : '❌ 失败'} |\n\n`;

  md += `---\n\n*报告生成时间: ${new Date().toISOString()}*\n`;

  return md;
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
