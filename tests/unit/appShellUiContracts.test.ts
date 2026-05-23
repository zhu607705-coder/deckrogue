/**
 * @file appShellUiContracts.test.ts
 * @description Regression tests for AppShell routing and keyboard menu contracts.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { resolveActiveScreen } from '@/ui/views/AppShell';
import type { ScreenId } from '@/ui/components/ViewBackgroundLayer';

function readSource(filePath: string): string {
  return readFileSync(resolve(filePath), 'utf-8').replace(/\r\n?/g, '\n');
}

const APP_SHELL_SOURCE = readSource('src/ui/views/AppShell.tsx');
const REST_VIEW_SOURCE = readSource('src/ui/views/RestView.tsx');

test('AppShell active screen resolver preserves every renderable screen', () => {
  const screens: ScreenId[] = [
    'Launcher',
    'CharacterSelect',
    'Map',
    'Combat',
    'Reward',
    'Event',
    'Shop',
    'Rest',
    'Upgrade',
    'RelicUpgrade',
    'RemoveCard',
    'Enchant',
    'GameOver',
    'Victory',
  ];

  for (const screen of screens) {
    assert.equal(resolveActiveScreen(screen), screen);
  }

  assert.equal(resolveActiveScreen('UnknownScreen'), 'Launcher');
});

test('AppShell root menu keyboard options are unique and sequential', () => {
  const rootStart = APP_SHELL_SOURCE.indexOf("{menuPage === 'root'");
  const rootEnd = APP_SHELL_SOURCE.indexOf("{menuPage === 'theme'", rootStart);
  assert.ok(rootStart >= 0, 'root menu block should exist');
  assert.ok(rootEnd > rootStart, 'theme menu block should follow root menu block');

  const rootMenuSource = APP_SHELL_SOURCE.slice(rootStart, rootEnd);
  const options = Array.from(rootMenuSource.matchAll(/data-keyboard-option="(\d+)"/g), (match) => match[1]);

  assert.deepEqual(options, ['1', '2', '3', '4', '5', '6', '7', '8', '9']);
  assert.equal(new Set(options).size, options.length);
});

test('AppShell restart combat confirmation is not gated by the system menu visibility', () => {
  assert.ok(
    APP_SHELL_SOURCE.includes("      )}\n\n      {showRestartCombatConfirm && ("),
    'restart confirmation should render outside the showMenu block'
  );
  assert.match(
    APP_SHELL_SOURCE,
    /modal:\s*showRestartCombatConfirm\s*\?\s*'restartCombatConfirm'\s*:\s*null/,
    'restart confirmation should put keyboard handling into modal mode'
  );
});

test('RestView uses runtime-v2 rest capability gates before legacy fallback', () => {
  assert.match(
    REST_VIEW_SOURCE,
    /roomSummary\?\.canRelicUpgrade\s*\?\?\s*RELIC_UPGRADE_CONFIGS/,
    'relic upgrade gate should trust renderModel room capability before legacy relic inventory'
  );
  assert.match(
    REST_VIEW_SOURCE,
    /roomSummary\?\.potions\?\.map/,
    'potion choices should have a runtime-v2 renderModel source'
  );
  assert.match(
    REST_VIEW_SOURCE,
    /roomSummary\?\.canMix\s*\?\?\s*\(player\.potions\.length\s*>=\s*2\)/,
    'mix gate should trust renderModel room capability before legacy potion inventory'
  );
  assert.match(
    REST_VIEW_SOURCE,
    /roomSummary\?\.healAmount\s*\?\?\s*calculateRestHealAmount\(player\.maxHp\)/,
    'legacy fallback heal label should share the runtime rest-heal floor'
  );
  const options = Array.from(REST_VIEW_SOURCE.matchAll(/data-keyboard-option="(\d+)"/g), (match) => match[1]);
  assert.equal(options.filter((value) => value === '4').length, 1);
  assert.equal(new Set(options).size, options.length);
});
