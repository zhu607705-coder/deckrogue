/**
 * @file tutorialModule.test.tsx
 * @description Unit tests for tutorial module views including launcher, reward, and combat.
 *
 * 主要职责:
 * - 测试 SetupLauncher 的教程入口渲染
 * - 测试 RewardView、CombatView、TutorialView 的渲染
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { GameEngine, type MetaProfile, type SaveSlot } from '@/core';
import { SetupLauncher } from '@/ui/launcher/SetupLauncher';
import { RewardView } from '@/ui/views/RewardView';
import { CombatView } from '@/ui/views/CombatView';
import { TutorialView } from '@/ui/views/TutorialView';

const metaProfileStub = {
  currencies: {
    requisition: 12,
    warpEchoes: 7,
  },
  unlocks: {
    characters: ['informant'],
  },
  runHistory: [],
} as unknown as MetaProfile;

const saveSlotsStub: SaveSlot[] = [];

test('SetupLauncher renders a tutorial entry in the launch sequence', () => {
  const html = renderToStaticMarkup(
    <SetupLauncher
      canContinue={false}
      saveSlots={saveSlotsStub}
      metaProfile={metaProfileStub}
      onNewRun={() => {}}
      onContinue={() => {}}
      onLoadSlot={() => {}}
      onDeleteSlot={() => {}}
      onOpenTutorial={() => {}}
      error={null}
    />
  );

  assert.match(html, /战区教程/);
  assert.match(html, /术语、资源与战斗流程/);
});

test('TutorialView renders glossary-driven onboarding content', () => {
  const html = renderToStaticMarkup(
    <TutorialView open onClose={() => {}} />
  );

  assert.match(html, /新手战区教程/);
  assert.match(html, /术语索引/);
  assert.match(html, /glossary-term__trigger/);
  assert.match(html, /情报/);
  assert.match(html, /护盾/);
  assert.match(html, /单体异端/);
  assert.match(html, /易伤/);
});

test('CombatView links first battle context with the glossary tutorial', () => {
  const engine = new GameEngine(9001);
  engine.selectCharacter('informant');
  (engine as any).startCombat('Combat');

  const html = renderToStaticMarkup(<CombatView engine={engine} />);

  assert.match(html, /首战术语联动/);
  assert.match(html, /打开术语教程/);
  assert.match(html, /先看资源、敌方意图，再读手牌正文/);
});

test('CombatView compacts the glossary guide after the first card is played', () => {
  const engine = new GameEngine(9003);
  engine.selectCharacter('informant');
  (engine as any).startCombat('Combat');
  engine.state.combat!.player.cardsPlayedThisTurn = 1;

  const html = renderToStaticMarkup(<CombatView engine={engine} />);

  assert.match(html, /combat-guide-panel--compact/);
});

test('RewardView uses compact card presentation for post-combat drafting', () => {
  const engine = new GameEngine(9002);
  engine.selectCharacter('informant');
  engine.state.rewardCards = (engine as any).generateCardRewards(3);
  engine.state.screen = 'Reward';

  const html = renderToStaticMarkup(<RewardView engine={engine} />);

  assert.match(html, /reward-view__draftStage/);
  assert.match(html, /immersive-card--compact/);
});
