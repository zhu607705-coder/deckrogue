/**
 * @file unifiedAppShell.test.ts
 * @description Unit tests for unified app shell active screen resolution.
 *
 * 主要职责:
 * - 测试 resolveActiveScreen 保留特定屏幕类型
 * - 测试不回退到启动器的逻辑
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveActiveScreen } from '@/ui/views/UnifiedAppShell';

test('resolveActiveScreen keeps RelicUpgrade instead of falling back to Launcher', () => {
  assert.equal(resolveActiveScreen('RelicUpgrade'), 'RelicUpgrade');
});

test('resolveActiveScreen keeps Enchant instead of falling back to Launcher', () => {
  assert.equal(resolveActiveScreen('Enchant'), 'Enchant');
});
