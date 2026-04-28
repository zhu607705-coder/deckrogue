#!/usr/bin/env node

import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { chromium, type Page } from 'playwright';

import { cardsData } from '@/content/narrative/numericSystem';
import { CardView } from '@/ui/views/CardView';
import {
  bootstrapContext,
  buildSaveData,
  checkServer,
  createEngineAtFirstRoom,
  getDefaultSmokeUrl,
  loadSlotFromLauncher,
  spawnDevServer,
  waitForServer,
  type SaveSlotFixture,
} from './flow_smoke_helpers';

type ReviewFinding = {
  area: string;
  verdict: 'pass' | 'watch';
  detail: string;
};

type ReviewReport = {
  baseUrl: string;
  screenshots: string[];
  findings: ReviewFinding[];
};

const OUT_DIR = path.join(process.cwd(), 'output', 'playwright', 'manual_long_combat_review');
const TRANSPARENT_PIXEL = 'data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAA=';

function parseArgs() {
  const arg = process.argv.find((entry) => entry.startsWith('--url='));
  return {
    url: arg ? arg.split('=')[1] : getDefaultSmokeUrl(),
  };
}

function ensureOutDir() {
  mkdirSync(OUT_DIR, { recursive: true });
}

function latestBuiltCssHref() {
  const assetsDir = path.join(process.cwd(), 'dist', 'assets');
  const cssFile = readdirSync(assetsDir)
    .filter((file) => file.startsWith('index-') && file.endsWith('.css'))
    .sort()
    .pop();
  if (!cssFile) {
    throw new Error('manual_long_combat_review requires a fresh build before running.');
  }
  return `file://${path.join(assetsDir, cssFile)}`;
}

function createThemeReviewHtml() {
  const ids = ['defend', 'dead_drop', 'mirror_probe', 'acid_bath'];
  const labels: Record<string, string> = {
    defend: 'wood',
    dead_drop: 'tactic',
    mirror_probe: 'mirror',
    acid_bath: 'acid',
  };
  const cards = ids
    .map((id) => cardsData.find((card) => card.id === id))
    .filter((card): card is NonNullable<(typeof cardsData)[number]> => !!card)
    .map((card) => ({ ...card, artUrl: TRANSPARENT_PIXEL }));

  const body = renderToStaticMarkup(
    <div className="theme-review-shell">
      <header className="theme-review-header">
        <div className="theme-review-kicker">manual visual review</div>
        <h1 className="theme-review-title">wood / tactic / mirror / acid card text readability</h1>
      </header>
      <main className="theme-review-grid">
        {cards.map((card) => (
          <section key={card.id} className="theme-review-item">
            <div className="theme-review-label">{labels[card.id] || card.id}</div>
            <CardView card={card} />
          </section>
        ))}
      </main>
    </div>
  );

  const html = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>DeckRogue Theme Review</title>
    <link rel="stylesheet" href="${latestBuiltCssHref()}" />
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        background: radial-gradient(circle at top, rgba(245, 208, 108, 0.08), transparent 34%), #090a0d;
        color: #ede7db;
        font-family: Georgia, "Times New Roman", serif;
      }
      .theme-review-shell {
        padding: 32px;
      }
      .theme-review-header {
        margin-bottom: 24px;
      }
      .theme-review-kicker {
        font-size: 11px;
        letter-spacing: 0.28em;
        text-transform: uppercase;
        color: rgba(245, 208, 108, 0.75);
      }
      .theme-review-title {
        margin: 12px 0 0;
        font-size: 28px;
        line-height: 1.1;
      }
      .theme-review-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 24px;
        align-items: start;
      }
      .theme-review-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
      }
      .theme-review-label {
        font-size: 12px;
        letter-spacing: 0.22em;
        text-transform: uppercase;
        color: rgba(226, 232, 240, 0.8);
      }
    </style>
  </head>
  <body>${body}</body>
</html>`;

  const output = path.join(OUT_DIR, 'theme_review.html');
  writeFileSync(output, html, 'utf8');
  return output;
}

function createLongCombatFixture(seed = 6201): SaveSlotFixture {
  const engine = createEngineAtFirstRoom(seed, 'informant');
  const currentNode = engine.state.currentNodeId
    ? engine.state.map.find((node) => node.id === engine.state.currentNodeId)
    : null;
  if (currentNode) {
    currentNode.type = 'Combat';
  }
  (engine as any).startCombat('Combat');
  return buildSaveData(engine, 'manual_long_combat_review', 'Manual Long Combat Review');
}

async function getActiveScreen(page: Page): Promise<string | null> {
  return page.locator('[data-screen]').first().getAttribute('data-screen').catch(() => null);
}

async function waitForPlayerTurn(page: Page, timeout = 15_000): Promise<boolean> {
  try {
    await page.waitForFunction(() => {
      const marker = document.querySelector('[data-keyboard-end-turn="true"]') as HTMLButtonElement | null;
      return Boolean(marker) && !marker.disabled;
    }, undefined, { timeout });
    return true;
  } catch {
    return false;
  }
}

async function hasEndTurnControl(page: Page): Promise<boolean> {
  const button = page.locator('[data-keyboard-end-turn="true"]').first();
  if (!(await button.count())) return false;
  return button.evaluate((element) => !(element as HTMLButtonElement).disabled).catch(() => false);
}

async function clickEndTurn(page: Page): Promise<boolean> {
  if (!(await hasEndTurnControl(page))) return false;
  const button = page.locator('[data-keyboard-end-turn="true"]').first();
  await button.click({ force: true });
  return true;
}

async function captureLongCombat(url: string) {
  ensureOutDir();
  let devServer: ReturnType<typeof spawnDevServer> | null = null;
  if (!checkServer(url)) {
    devServer = spawnDevServer(url);
    await waitForServer(url);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1600, height: 960 } });
  await bootstrapContext(context, [createLongCombatFixture()]);
  const page = await context.newPage();
  const screenshots: string[] = [];
  const findings: ReviewFinding[] = [];

  try {
    await page.goto(url, { waitUntil: 'networkidle' });
    await loadSlotFromLauncher(page, 'Manual Long Combat Review');
    await page.locator('.enemy-standee, .player-standee').first().waitFor({ timeout: 15_000 });
    if (!(await waitForPlayerTurn(page))) {
      throw new Error('Manual long combat review did not reach a controllable player turn.');
    }

    const combatStart = path.join(OUT_DIR, 'long_combat_turn_start.png');
    await page.screenshot({ path: combatStart, fullPage: true });
    screenshots.push(combatStart);

    const guideVisible = await page.locator('[data-testid="combat-guide-panel"]').count();
    findings.push({
      area: 'first-combat guide',
      verdict: guideVisible > 0 ? 'pass' : 'watch',
      detail: guideVisible > 0 ? 'Combat guide panel was visible at battle start.' : 'Combat guide panel was not visible at battle start.',
    });

    const endedTurn = await clickEndTurn(page);
    await page.waitForTimeout(1400);

    const enemyTurn = path.join(OUT_DIR, 'long_combat_after_turn.png');
    await page.screenshot({ path: enemyTurn, fullPage: true });
    screenshots.push(enemyTurn);
    findings.push({
      area: 'combat readability',
      verdict: endedTurn ? 'pass' : 'watch',
      detail: endedTurn
        ? 'Captured combat after ending the player turn for HUD, enemy intent, and hand readability review.'
        : `Captured combat start only because the end-turn control was unavailable on screen ${await getActiveScreen(page) ?? 'unknown'}.`,
    });

    findings.push({
      area: 'reward transition',
      verdict: 'watch',
      detail: 'Manual long-combat visual review does not force reward; reward presentation is covered by reward flow smoke.',
    });

    const themeHtml = createThemeReviewHtml();
    await page.goto(`file://${themeHtml}`);
    await page.waitForLoadState('load');
    const themeShot = path.join(OUT_DIR, 'theme_card_review.png');
    await page.screenshot({ path: themeShot, fullPage: true });
    screenshots.push(themeShot);
    findings.push({
      area: 'theme card readability',
      verdict: 'pass',
      detail: 'Generated standalone wood/tactic/mirror/acid card readability screenshot.',
    });

    const report: ReviewReport = {
      baseUrl: url,
      screenshots,
      findings,
    };
    const reportPath = path.join(OUT_DIR, 'manual_long_combat_review.json');
    writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
    console.log(`report=${reportPath}`);
    screenshots.forEach((item) => console.log(`shot=${item}`));
  } finally {
    await context.close().catch(() => {});
    await browser.close();
    if (devServer && !devServer.killed) {
      devServer.kill('SIGTERM');
    }
  }
}

captureLongCombat(parseArgs().url)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
