#!/usr/bin/env node

/**
 * Simulated manual victory run through the real browser UI.
 *
 * This intentionally avoids save-state terminal fixtures and combat-complete
 * shortcuts. It boots the launcher, starts a new run, clicks map rooms, plays
 * hand cards, chooses rewards/options, and finishes on the Victory screen.
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium, type BrowserContext, type Locator, type Page } from 'playwright';

import {
  bootstrapContext,
  checkServer,
  ensureDir,
  getDefaultSmokeUrl,
  screenshotPath,
  spawnDevServer,
  waitForServer,
} from './flow_smoke_helpers';

type ManualScreen =
  | 'Launcher'
  | 'CharacterSelect'
  | 'Map'
  | 'Combat'
  | 'Reward'
  | 'Event'
  | 'Shop'
  | 'Rest'
  | 'Upgrade'
  | 'RemoveCard'
  | 'Enchant'
  | 'RelicUpgrade'
  | 'Victory'
  | 'GameOver'
  | 'Unknown';

interface ManualStep {
  index: number;
  screen: ManualScreen;
  action: string;
  detail?: string;
  screenshot?: string;
}

interface ManualVictoryReport {
  startedAt: string;
  completedAt?: string;
  baseUrl: string;
  characterId: string;
  seed: number;
  headed: boolean;
  victory: boolean;
  gameOver: boolean;
  finalScreen: ManualScreen;
  roomsVisited: number;
  combatsWon: number;
  rewardsTaken: number;
  eventsResolved: number;
  restsUsed: number;
  shopsVisited: number;
  upgradesApplied: number;
  potionsUsed: number;
  turnsEnded: number;
  cardsClicked: number;
  consoleErrors: string[];
  pageErrors: string[];
  failedRequests: string[];
  screenshots: string[];
  steps: ManualStep[];
  error?: string;
}

const DEFAULT_CHARACTER_ID = 'alchemist';
const DEFAULT_RUN_SEED = 1777217199075;
const MAX_ROOM_STEPS = 80;
const MAX_COMBAT_TURNS = 30;
const STEP_DELAY_MS = 140;

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    url: getDefaultSmokeUrl(),
    characterId: DEFAULT_CHARACTER_ID,
    seed: DEFAULT_RUN_SEED,
    headed: false,
  };
  for (const arg of args) {
    if (arg.startsWith('--url=')) options.url = arg.slice('--url='.length);
    if (arg.startsWith('--character=')) options.characterId = arg.slice('--character='.length);
    if (arg.startsWith('--seed=')) {
      const parsed = Number(arg.slice('--seed='.length));
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error(`Invalid --seed value: ${arg}`);
      }
      options.seed = Math.floor(parsed);
    }
    if (arg === '--headed') options.headed = true;
  }
  return options;
}

function isIgnoredConsoleNoise(text: string): boolean {
  return /favicon|404|ERR_CONNECTION_REFUSED|WebSocket connection to 'ws:\/\/127\.0\.0\.1:\d+\//i.test(text);
}

async function visibleCount(locator: Locator): Promise<number> {
  const count = await locator.count();
  let visible = 0;
  for (let i = 0; i < count; i += 1) {
    if (await locator.nth(i).isVisible().catch(() => false)) visible += 1;
  }
  return visible;
}

async function firstVisible(locator: Locator): Promise<Locator | null> {
  const count = await locator.count();
  for (let i = 0; i < count; i += 1) {
    const next = locator.nth(i);
    if (await next.isVisible().catch(() => false)) return next;
  }
  return null;
}


async function hasVisible(page: Page, selector: string): Promise<boolean> {
  return (await visibleCount(page.locator(selector))) > 0;
}

async function detectScreen(page: Page): Promise<ManualScreen> {
  if (await hasVisible(page, '[data-screen="Map"]')) return 'Map';
  if (await hasVisible(page, '.grimdark-action-hand, .grimdark-battlefield')) return 'Combat';
  if (await hasVisible(page, '.reward-view__frame')) return 'Reward';
  if (await hasVisible(page, '.shop-scene, .shop-merchant-stage, button[data-potion-id]')) return 'Shop';
  if (await hasVisible(page, '.event-npc-stage')) return 'Event';
  if (await hasVisible(page, '[data-character-id]')) return 'CharacterSelect';
  if (await hasVisible(page, '.launcher-shell')) return 'Launcher';
  if (await hasVisible(page, '[data-relic-id]')) return 'RelicUpgrade';
  if (await hasVisible(page, 'button[data-choice-id]')) return 'Event';

  const body = await page.locator('body').innerText({ timeout: 1_000 }).catch(() => '');
  if (/\u884c\u52a8\u5f52\u6863|\u672c\u6b21\u8fdc\u5f81\u5df2\u7ecf\u5b8c\u6210|Victory/.test(body)) return 'Victory';
  if (/\u6267\u884c\u5931\u8d25|\u8fdc\u5f81\u5931\u8d25|MIA\/KIA|Game Over/.test(body)) return 'GameOver';
  if (/\u53d9\u4e8b\u4e8b\u4ef6|\u4f4e\u5371|\u4e2d\u5371|\u9ad8\u5371/.test(body) && await hasVisible(page, 'button.campaign-choice[data-keyboard-option]')) return 'Event';
  if (/\u7bdd\u706b|\u4f11\u6574/.test(body)) return 'Rest';
  if (/\u9009\u62e9\u4e00\u5f20.*\u5f3a\u5316|\u5347\u7ea7\u754c\u9762/.test(body)) return 'Upgrade';
  if (/\u711a\u6bc1\u8bb0\u5fc6|\u711a\u6bc1/.test(body)) return 'RemoveCard';
  if (/\u9644\u9b54|\u523b\u5199/.test(body)) return 'Enchant';
  if (/\u9057\u7269\u5347\u7ea7/.test(body)) return 'RelicUpgrade';
  return 'Unknown';
}

function nodeTypeFromClassName(className: string): string {
  if (className.includes('grimdark-node-tone--boss')) return 'Boss';
  if (className.includes('grimdark-node-tone--rest')) return 'Rest';
  if (className.includes('grimdark-node-tone--combat')) return 'Combat';
  if (className.includes('grimdark-node-tone--event')) return 'Event';
  if (className.includes('grimdark-node-tone--shop')) return 'Shop';
  if (className.includes('grimdark-node-tone--elite')) return 'Elite';
  return 'Unknown';
}

async function recordStep(
  page: Page,
  report: ManualVictoryReport,
  outputDir: string,
  screen: ManualScreen,
  action: string,
  detail?: string,
  screenshot = false,
) {
  const step: ManualStep = {
    index: report.steps.length + 1,
    screen,
    action,
    detail,
  };
  if (screenshot) {
    const file = screenshotPath(outputDir, `${String(step.index).padStart(2, '0')}_${screen}_${action.replace(/[^a-z0-9]+/gi, '_')}.png`);
    await page.screenshot({ path: file, fullPage: true });
    report.screenshots.push(file);
    step.screenshot = file;
  }
  report.steps.push(step);
}

async function waitForScreenChange(page: Page, previous: ManualScreen): Promise<ManualScreen> {
  for (let i = 0; i < 40; i += 1) {
    await page.waitForTimeout(STEP_DELAY_MS);
    const next = await detectScreen(page);
    if (next !== previous && next !== 'Unknown') return next;
  }
  return detectScreen(page);
}

async function clickFirstEnabled(locator: Locator): Promise<boolean> {
  const count = await locator.count();
  for (let i = 0; i < count; i += 1) {
    const item = locator.nth(i);
    const enabled = await item.isEnabled().catch(() => false);
    const visible = await item.isVisible().catch(() => false);
    if (!enabled || !visible) continue;
    await item.scrollIntoViewIfNeeded().catch(() => undefined);
    await item.click({ force: true });
    return true;
  }
  return false;
}

async function startFreshRun(page: Page, report: ManualVictoryReport, outputDir: string) {
  await page.goto(report.baseUrl, { waitUntil: 'networkidle' });
  await page.locator('.launcher-shell').waitFor({ timeout: 15_000 });
  await recordStep(page, report, outputDir, 'Launcher', 'boot_launcher', undefined, true);

  await page.locator('[data-keyboard-option="1"]').first().click({ force: true });
  await page.locator(`[data-character-id="${report.characterId}"]`).waitFor({ timeout: 15_000 });
  await recordStep(page, report, outputDir, 'CharacterSelect', 'open_new_run', undefined, true);

  const characterCard = page.locator(`[data-character-id="${report.characterId}"]`).first();
  await characterCard.scrollIntoViewIfNeeded();
  await characterCard.click({ force: true });
  const mapAfterCharacterClick = await page.locator('[data-screen="Map"]').waitFor({ timeout: 3_000 }).then(() => true).catch(() => false);
  if (!mapAfterCharacterClick) {
    const startButton =
      (await firstVisible(page.locator('button').filter({ hasText: /\u5f00\u59cb|\u90e8\u7f72|Start/i }))) ??
      (await firstVisible(page.locator('[data-keyboard-option="9"]')));
    if (!startButton) {
      throw new Error(`Start button did not appear after selecting ${report.characterId}`);
    }
    await startButton.scrollIntoViewIfNeeded();
    await startButton.click({ force: true });
    await page.locator('[data-screen="Map"]').waitFor({ timeout: 15_000 });
  }
  await recordStep(page, report, outputDir, 'Map', 'select_character_start', report.characterId, true);
}

async function chooseMapNode(page: Page, report: ManualVictoryReport, outputDir: string) {
  const nodeButtons = page.locator('button[data-node-id]:not([disabled])');
  const candidates: Array<{ index: number; id: string; className: string; y: number }> = [];
  const count = await nodeButtons.count();
  for (let index = 0; index < count; index += 1) {
    const button = nodeButtons.nth(index);
    if (!(await button.isVisible().catch(() => false))) continue;
    candidates.push({
      index,
      id: (await button.getAttribute('data-node-id')) || '',
      className: (await button.getAttribute('class')) || '',
      y: Number((await button.getAttribute('data-floor')) || '0'),
    });
  }

  if (candidates.length === 0) {
    throw new Error('No selectable map node was available');
  }

  const scored = candidates.map((entry) => {
    const type = nodeTypeFromClassName(String(entry.className));
    const score =
      type === 'Boss' ? 100 :
      type === 'Combat' ? 85 :
      type === 'Shop' ? 70 :
      type === 'Rest' ? 60 :
      type === 'Event' ? 50 :
      type === 'Elite' ? 35 :
      10;
    return { ...entry, type, score };
  }).sort((a, b) => b.score - a.score || a.y - b.y || a.index - b.index);

  const choice = scored[0];
  const target = page.locator(`button[data-node-id="${choice.id}"]`).first();
  await page.waitForTimeout(250);
  const box = await target.boundingBox();
  if (!box) {
    throw new Error(`Selectable map node ${choice.id} had no clickable box`);
  }
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  report.roomsVisited += 1;
  await recordStep(page, report, outputDir, 'Map', 'enter_node', `${choice.type}:${choice.id}`, report.roomsVisited <= 3 || choice.type === 'Boss');
  await waitForScreenChange(page, 'Map');
}

async function clickLowestHpEnemy(page: Page): Promise<boolean> {
  const targetNodes = page.locator('[data-keyboard-target="true"]');
  const enemies: Array<{ index: number; hp: number }> = [];
  const count = await targetNodes.count();
  for (let index = 0; index < count; index += 1) {
    const target = targetNodes.nth(index);
    if (!(await target.isVisible().catch(() => false))) continue;
    const text = await target.innerText().catch(() => '');
    const match = text.match(/(\d+)\s*\/\s*(\d+)/);
    enemies.push({ index, hp: match ? Number(match[1]) : 9999 });
  }
  enemies.sort((a, b) => a.hp - b.hp || a.index - b.index);
  if (enemies.length === 0) return false;
  await page.locator('[data-keyboard-target="true"]').nth(enemies[0].index).click({ force: true });
  return true;
}

async function useAvailablePotions(page: Page, report: ManualVictoryReport, maxUses: number): Promise<number> {
  let used = 0;
  for (let attempt = 0; attempt < maxUses; attempt += 1) {
    const potion = page.locator('.grimdark-potion-slot--filled').first();
    if (!(await potion.isVisible().catch(() => false))) break;
    await potion.click({ force: true });
    report.potionsUsed += 1;
    used += 1;
    await page.waitForTimeout(180);
  }
  return used;
}

async function playOneCard(page: Page, report: ManualVictoryReport): Promise<boolean> {
  const cards = page.locator('[data-keyboard-card]');
  const count = await cards.count();
  for (let i = 0; i < count; i += 1) {
    const card = cards.nth(i);
    if (!(await card.isVisible().catch(() => false))) continue;
    const className = (await card.getAttribute('class')) || '';
    const disabled = await card.getAttribute('aria-disabled');
    if (disabled === 'true' || className.includes('is-disabled')) continue;

    await card.scrollIntoViewIfNeeded().catch(() => undefined);
    await card.click({ force: true });
    report.cardsClicked += 1;
    await page.waitForTimeout(110);
    await clickLowestHpEnemy(page);
    await page.waitForTimeout(180);
    return true;
  }
  return false;
}

async function playCombat(page: Page, report: ManualVictoryReport, outputDir: string) {
  await recordStep(page, report, outputDir, 'Combat', 'combat_start', undefined, report.combatsWon === 0);
  if (report.roomsVisited >= 6) {
    await useAvailablePotions(page, report, 2);
  }
  for (let turn = 1; turn <= MAX_COMBAT_TURNS; turn += 1) {
    const screen = await detectScreen(page);
    if (screen === 'Reward' || screen === 'Victory') {
      report.combatsWon += 1;
      return;
    }
    if (screen === 'GameOver') return;

    await page.waitForFunction(() => {
      const endTurn = document.querySelector('[data-keyboard-end-turn="true"]') as HTMLButtonElement | null;
      return !endTurn || !endTurn.disabled;
    }, undefined, { timeout: 15_000 }).catch(() => undefined);

    if (report.roomsVisited >= 8 || turn >= 3) {
      await useAvailablePotions(page, report, 1);
    }

    let playedThisTurn = 0;
    for (let attempts = 0; attempts < 10; attempts += 1) {
      if ((await detectScreen(page)) !== 'Combat') break;
      const played = await playOneCard(page, report);
      if (!played) break;
      playedThisTurn += 1;
    }

    if ((await detectScreen(page)) !== 'Combat') {
      report.combatsWon += 1;
      return;
    }

    const endTurn = page.locator('[data-keyboard-end-turn="true"]').first();
    if (await endTurn.isVisible().catch(() => false)) {
      await endTurn.click({ force: true });
      report.turnsEnded += 1;
      await page.waitForTimeout(900);
    } else if (playedThisTurn === 0) {
      throw new Error('Combat had neither playable cards nor an end-turn button');
    }
  }
  throw new Error(`Combat did not resolve within ${MAX_COMBAT_TURNS} turns`);
}

async function takeReward(page: Page, report: ManualVictoryReport, outputDir: string) {
  const picked = await clickFirstEnabled(page.locator('.reward-view__choice [data-keyboard-focus="true"], [data-keyboard-option="1"]'));
  if (!picked) {
    await clickFirstEnabled(page.locator('[data-keyboard-option="4"]'));
  }
  report.rewardsTaken += 1;
  await recordStep(page, report, outputDir, 'Reward', 'take_reward', undefined, report.rewardsTaken <= 2);
  await waitForScreenChange(page, 'Reward');
}

async function resolveEvent(page: Page, report: ManualVictoryReport, outputDir: string) {
  const options = page.locator('.campaign-decision-column button[data-keyboard-option], button.campaign-choice[data-keyboard-option], button[data-choice-id]');
  const scored: Array<{ index: number; score: number }> = [];
  const count = await options.count();
  for (let index = 0; index < count; index += 1) {
    const option = options.nth(index);
    if (!(await option.isVisible().catch(() => false)) || !(await option.isEnabled().catch(() => false))) continue;
    const text = await option.innerText().catch(() => '');
    let score = 20;
    if (/\u4f4e\u5371|leave|Leave|\u79bb\u5f00|\u62d2\u7edd/.test(text)) score += 20;
    if (/\u4e2d\u5371/.test(text)) score += 10;
    if (/\u9ad8\u5371/.test(text)) score -= 20;
    scored.push({ index, score });
  }
  scored.sort((a, b) => b.score - a.score || a.index - b.index);
  const clicked = scored.length > 0
    ? await options.nth(scored[0].index).click({ force: true }).then(() => true).catch(() => false)
    : await clickFirstEnabled(page.locator('button[data-choice-id], [data-keyboard-option="1"]'));
  if (!clicked) throw new Error('Event had no selectable option');
  report.eventsResolved += 1;
  await recordStep(page, report, outputDir, 'Event', 'choose_event_option', undefined, report.eventsResolved <= 2);
  await waitForScreenChange(page, 'Event');
}

async function leaveShop(page: Page, report: ManualVictoryReport, outputDir: string) {
  let purchases = 0;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const buyButtons = page.locator('button[data-keyboard-option]').filter({ hasText: /\d+/ });
    const bought = await clickFirstEnabled(buyButtons);
    if (!bought) break;
    purchases += 1;
    await page.waitForTimeout(300);
  }
  const exactLeaveButton = page.locator('button').filter({ hasText: /\u79bb\u5f00|Leave|leave/i }).last();
  if (await visibleCount(exactLeaveButton) > 0) {
    await exactLeaveButton.click({ force: true });
    report.shopsVisited += 1;
    await recordStep(page, report, outputDir, 'Shop', 'leave_shop', purchases > 0 ? `purchases=${purchases}` : undefined, report.shopsVisited <= 1);
    await waitForScreenChange(page, 'Shop');
    return;
  }
  const leaveButton = page.locator('button').filter({ hasText: /绂诲紑|leave|Leave/i }).last();
  if (await visibleCount(leaveButton) > 0) {
    await leaveButton.click({ force: true });
  } else {
    await clickFirstEnabled(page.locator('button').last());
  }
  report.shopsVisited += 1;
  await recordStep(page, report, outputDir, 'Shop', 'leave_shop', purchases > 0 ? `purchases=${purchases}` : undefined, report.shopsVisited <= 1);
  await waitForScreenChange(page, 'Shop');
}

async function useRest(page: Page, report: ManualVictoryReport, outputDir: string) {
  const heal = page.locator('[data-keyboard-option="1"]').first();
  if (await heal.isEnabled().catch(() => false)) {
    await heal.click({ force: true });
  } else {
    await clickFirstEnabled(page.locator('[data-keyboard-option="2"], [data-keyboard-option="5"], [data-keyboard-option="3"]'));
  }
  report.restsUsed += 1;
  await recordStep(page, report, outputDir, 'Rest', 'use_rest', undefined, report.restsUsed <= 2);
  await waitForScreenChange(page, 'Rest');
}

async function resolveSurface(page: Page, report: ManualVictoryReport, outputDir: string, screen: ManualScreen) {
  const option = page.locator('[data-keyboard-option="1"], [data-keyboard-focus="true"]').first();
  if (await option.isVisible().catch(() => false) && await option.isEnabled().catch(() => false)) {
    await option.click({ force: true });
    if (screen === 'Upgrade' || screen === 'RelicUpgrade' || screen === 'Enchant') report.upgradesApplied += 1;
    await recordStep(page, report, outputDir, screen, 'resolve_surface', undefined, false);
  } else {
    await clickFirstEnabled(page.locator('[data-keyboard-close="true"], [data-keyboard-option="10"]'));
    await recordStep(page, report, outputDir, screen, 'cancel_surface', undefined, false);
  }
  await waitForScreenChange(page, screen);
}

async function runManualVictory(page: Page, report: ManualVictoryReport, outputDir: string) {
  await startFreshRun(page, report, outputDir);

  for (let step = 0; step < MAX_ROOM_STEPS; step += 1) {
    const screen = await detectScreen(page);
    report.finalScreen = screen;
    if (screen === 'Victory') {
      report.victory = true;
      await recordStep(page, report, outputDir, 'Victory', 'victory_reached', undefined, true);
      return;
    }
    if (screen === 'GameOver') {
      report.gameOver = true;
      await recordStep(page, report, outputDir, 'GameOver', 'game_over_reached', undefined, true);
      return;
    }

    switch (screen) {
      case 'Map':
        await chooseMapNode(page, report, outputDir);
        break;
      case 'Combat':
        await playCombat(page, report, outputDir);
        break;
      case 'Reward':
        await takeReward(page, report, outputDir);
        break;
      case 'Event':
        await resolveEvent(page, report, outputDir);
        break;
      case 'Shop':
        await leaveShop(page, report, outputDir);
        break;
      case 'Rest':
        await useRest(page, report, outputDir);
        break;
      case 'Upgrade':
      case 'RemoveCard':
      case 'Enchant':
      case 'RelicUpgrade':
        await resolveSurface(page, report, outputDir, screen);
        break;
      default:
        await page.waitForTimeout(500);
        if ((await detectScreen(page)) === screen) {
          await recordStep(page, report, outputDir, screen, 'unknown_wait', undefined, true);
          throw new Error(`Unable to advance from screen ${screen}`);
        }
    }
  }

  throw new Error(`Manual victory run exceeded ${MAX_ROOM_STEPS} room steps`);
}

async function main() {
  const options = parseArgs();
  const reportPath = path.join(process.cwd(), 'reports', 'flows', 'manual-victory-run.json');
  const outputDir = path.join(process.cwd(), 'output', 'playwright', 'manual-victory-run');
  ensureDir(path.dirname(reportPath));
  ensureDir(outputDir);

  let devServer: ReturnType<typeof spawnDevServer> | null = null;
  if (!checkServer(options.url)) {
    devServer = spawnDevServer(options.url);
    await waitForServer(options.url);
  }

  const report: ManualVictoryReport = {
    startedAt: new Date().toISOString(),
    baseUrl: options.url,
    characterId: options.characterId,
    seed: options.seed,
    headed: options.headed,
    victory: false,
    gameOver: false,
    finalScreen: 'Unknown',
    roomsVisited: 0,
    combatsWon: 0,
    rewardsTaken: 0,
    eventsResolved: 0,
    restsUsed: 0,
    shopsVisited: 0,
    upgradesApplied: 0,
    potionsUsed: 0,
    turnsEnded: 0,
    cardsClicked: 0,
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],
    screenshots: [],
    steps: [],
  };

  const browser = await chromium.launch({ headless: !options.headed });
  let context: BrowserContext | null = null;
  try {
    context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
    await bootstrapContext(context, []);
    await context.addInitScript((seedValue: number) => {
      Date.now = () => seedValue;
    }, options.seed);
    const page = await context.newPage();
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !isIgnoredConsoleNoise(msg.text())) report.consoleErrors.push(msg.text());
    });
    page.on('pageerror', (error) => report.pageErrors.push(error.message));
    page.on('requestfailed', (request) => {
      report.failedRequests.push(`${request.resourceType()} ${request.url()} ${request.failure()?.errorText || 'unknown'}`);
    });

    await runManualVictory(page, report, outputDir);
    report.finalScreen = await detectScreen(page);
  } catch (error) {
    report.error = error instanceof Error ? error.message : String(error);
  } finally {
    report.completedAt = new Date().toISOString();
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    if (context) await context.close();
    await browser.close();
    if (devServer && !devServer.killed) devServer.kill('SIGTERM');
  }

  const ignoredConsoleErrors = report.consoleErrors.filter((entry) => isIgnoredConsoleNoise(entry));
  const blockingConsoleErrors = report.consoleErrors.filter((entry) => !ignoredConsoleErrors.includes(entry));
  if (!report.victory || report.gameOver || report.error || report.pageErrors.length > 0 || blockingConsoleErrors.length > 0) {
    throw new Error(
      `Manual victory run failed: victory=${report.victory} gameOver=${report.gameOver} finalScreen=${report.finalScreen} error=${report.error || 'none'} pageErrors=${report.pageErrors.length} consoleErrors=${blockingConsoleErrors.length}`
    );
  }

  console.log(JSON.stringify({
    reportPath,
    seed: report.seed,
    victory: report.victory,
    roomsVisited: report.roomsVisited,
    combatsWon: report.combatsWon,
    rewardsTaken: report.rewardsTaken,
    eventsResolved: report.eventsResolved,
    restsUsed: report.restsUsed,
    shopsVisited: report.shopsVisited,
    potionsUsed: report.potionsUsed,
    cardsClicked: report.cardsClicked,
    turnsEnded: report.turnsEnded,
    screenshots: report.screenshots,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
