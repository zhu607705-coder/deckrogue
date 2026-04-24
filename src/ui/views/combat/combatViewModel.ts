/**
 * @file combatViewModel.ts
 * @description 战斗视图模型 - 从引擎状态派生 UI 所需的结构化数据
 *
 * 主要职责:
 * - 提取角色资源快照
 * - 计算次要资源状态
 * - 提供战斗数值钳制工具
 * - 管理意图威胁等级判定
 */

import type { GameEngine } from '@/core';
import type { IntentDisplay } from '@/types';

type RuntimeCombat = NonNullable<GameEngine['state']['combat']>;
type RuntimePlayer = RuntimeCombat['player'];

export type CharacterResourceId =
  | 'informant'
  | 'brute'
  | 'tactician'
  | 'chronomancer'
  | 'puppeteer'
  | 'alchemist';

export interface SecondaryResourceState {
  evidence?: number;
  rage?: number;
  command?: number;
}

export interface CharacterResourceSnapshot {
  label: string;
  value: number;
  tone: 'grimdark-pill--resource';
}

export function clampCombatInteger(value: unknown, minimum = 0, maximum = Number.MAX_SAFE_INTEGER): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return minimum;
  return Math.max(minimum, Math.min(maximum, Math.floor(numeric)));
}

export function clampCombatPercent(value: unknown): number {
  return clampCombatInteger(value, 0, 100);
}

export function getCharacterResourceSnapshot(
  characterId: string,
  player: Pick<RuntimePlayer, 'timeLayer' | 'thread' | 'concoction'>,
  secondaryResources: SecondaryResourceState = {}
): CharacterResourceSnapshot | null {
  switch (characterId as CharacterResourceId) {
    case 'informant':
      return { label: '证据', value: clampCombatInteger(secondaryResources.evidence), tone: 'grimdark-pill--resource' };
    case 'brute':
      return { label: '狂怒', value: clampCombatInteger(secondaryResources.rage), tone: 'grimdark-pill--resource' };
    case 'tactician':
      return { label: '指令', value: clampCombatInteger(secondaryResources.command), tone: 'grimdark-pill--resource' };
    case 'chronomancer':
      return { label: '时层', value: clampCombatInteger(player.timeLayer), tone: 'grimdark-pill--resource' };
    case 'puppeteer':
      return { label: '丝线', value: clampCombatInteger(player.thread), tone: 'grimdark-pill--resource' };
    case 'alchemist':
      return { label: '配剂', value: clampCombatInteger(player.concoction), tone: 'grimdark-pill--resource' };
    default:
      return null;
  }
}

export function getIntentThreatLevel(intent: IntentDisplay): '致命' | '高危' | '警惕' | '控场' | '防御' | '常规' {
  const totalDamage = clampCombatInteger(intent.breakdown.totalDamage);
  const statusPressure = intent.breakdown.statuses.length;
  const blockValue = clampCombatInteger(intent.breakdown.block);

  if (totalDamage >= 30) return '致命';
  if (totalDamage >= 18) return '高危';
  if (totalDamage > 0) return '警惕';
  if (statusPressure > 0) return '控场';
  if (blockValue > 0) return '防御';
  return '常规';
}
