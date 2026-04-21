#!/usr/bin/env node

import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { chromium } from 'playwright';
import { CardView } from '@/ui/views/CardView';
import { GameEngine } from '@/core';
import { cardsData } from '@/content/narrative/numericSystem';

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
    url: arg ? arg.split('=')[1] : 'http://127.0.0.1:3000'
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
    acid_bath: 'acid'
  };
  const cards = ids
    .map((id) => cardsData.find((card) => card.id === id))
    .filter((card): card is NonNullable<(typeof cardsData)[number]> => !!card)
    .map((card) => ({ ...card, artUrl: TRANSPARENT_PIXEL }));

  const body = renderToStaticMarkup(
    <div className="theme-review-shell">
      <header className="theme-review-header">
        <div className="theme-review-kicker">manual visual review</div>
        <h1 className="theme-review-title">wood / tactic / mirror / acid 卡牌正文可读性</h1>
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

async function waitForPlayerTurn(page: import('playwright').Page) {
  await page.waitForFunction(() => {
    const marker = Array.from(document.querySelectorAll('.grimdark-turn-label')).find((el) =>
      (el.textContent || '').includes('指挥者阶段')
    );
    return !!marker;
  });
}

async function clickCharacterCard(page: import('playwright').Page, characterId: string) {
  const card = page.locator(`[data-character-id="${characterId}"]`).first();
  await card.scrollIntoViewIfNeeded();
  await card.click({ force: true });
}

async function clickEndTurn(page: import('playwright').Page) {
  const button = page.getByRole('button', { name: /结束周期/i });
  await button.click({ force: true });
}

async function playLongestTurn(page: import('playwright').Page) {
  for (;;) {
    const cards = page.locator('[data-keyboard-card]');
    const count = await cards.count();
    let played = false;

    for (let index = 0; index < count; index += 1) {
      const card = cards.nth(index);
      const cardClass = (await card.getAttribute('class')) || '';
      if (cardClass.includes('is-disabled')) continue;

      await card.click();
      const targets = page.locator('[data-keyboard-target="true"]');
      if (await targets.count()) {
        await targets.first().click();
      }
      await page.waitForTimeout(180);
      played = true;
      break;
    }

    if (!played) break;
  }
}

async function captureLongCombat(url: string) {
  ensureOutDir();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 960 } });
  const screenshots: string[] = [];
  const findings: ReviewFinding[] = [];

  await page.goto(url, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /开始新战区|new run/i }).click();
  await clickCharacterCard(page, 'informant');
  await page.locator('button[data-node-id]').first().waitFor({ timeout: 10_000 });
  const combatNode = page.locator('button[data-node-id]').filter({ hasText: /遭遇战|战斗/i }).first();
  if (await combatNode.count()) {
    await combatNode.click({ force: true });
  } else {
    await page.locator('button[data-node-id]:not([disabled])').first().click({ force: true });
  }
  await page.waitForSelector('.grimdark-battlefield');
  await waitForPlayerTurn(page);

  const combatStart = path.join(OUT_DIR, 'long_combat_turn_start.png');
  await page.screenshot({ path: combatStart, fullPage: true });
  screenshots.push(combatStart);

  const guideVisible = await page.locator('[data-testid="combat-guide-panel"]').count();
  findings.push({
    area: '首战引导',
    verdict: guideVisible > 0 ? 'pass' : 'watch',
    detail: guideVisible > 0 ? '首战术语联动面板已出现。' : '首战术语联动面板未出现。'
  });

  await playLongestTurn(page);
  await clickEndTurn(page);
  await page.waitForTimeout(1400);

  const enemyTurn = path.join(OUT_DIR, 'long_combat_enemy_turn.png');
  await page.screenshot({ path: enemyTurn, fullPage: true });
  screenshots.push(enemyTurn);

  findings.push({
    area: '战斗阅读',
    verdict: 'pass',
    detail: '已捕获玩家阶段和敌袭阶段两种阅读态，可对照 HUD、敌方意图和手牌正文。'
  });

  let rewardSeen = false;
  for (let round = 0; round < 5; round += 1) {
    if (await page.getByText('选取一张记忆印痕').count()) {
      rewardSeen = true;
      break;
    }
    await waitForPlayerTurn(page);
    await playLongestTurn(page);
    await clickEndTurn(page);
    await page.waitForTimeout(1200);
  }

  if (rewardSeen || (await page.getByText('选取一张记忆印痕').count()) > 0) {
    const rewardShot = path.join(OUT_DIR, 'long_combat_reward.png');
    await page.screenshot({ path: rewardShot, fullPage: true });
    screenshots.push(rewardShot);
    findings.push({
      area: '奖励页聚焦',
      verdict: 'pass',
      detail: '长战斗后已进入奖励页，可用于检查 compact 卡牌的居中和反馈。'
    });
  } else {
    findings.push({
      area: '奖励页聚焦',
      verdict: 'watch',
      detail: '本次长战斗未在脚本回合数内进入奖励页，需要人工继续补看。'
    });
  }

  const themeHtml = createThemeReviewHtml();
  await page.goto(`file://${themeHtml}`);
  await page.waitForLoadState('load');
  const themeShot = path.join(OUT_DIR, 'theme_card_review.png');
  await page.screenshot({ path: themeShot, fullPage: true });
  screenshots.push(themeShot);
  findings.push({
    area: '主题卡牌可读性',
    verdict: 'pass',
    detail: '已生成 wood / tactic / mirror / acid 四套主题卡牌的独立阅读截图。'
  });

  await browser.close();

  const report: ReviewReport = {
    baseUrl: url,
    screenshots,
    findings
  };
  const reportPath = path.join(OUT_DIR, 'manual_long_combat_review.json');
  writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(`report=${reportPath}`);
  screenshots.forEach((item) => console.log(`shot=${item}`));
}

captureLongCombat(parseArgs().url).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
