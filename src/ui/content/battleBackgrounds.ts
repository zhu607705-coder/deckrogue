/**
 * @file battleBackgrounds.ts
 * @description 战斗背景数据导出 - 提供战斗场景背景配置
 *
 * 主要职责:
 * - 导出战斗背景 JSON 数据
 * - 提供类型安全的背景资源访问
 */

import battleBackgroundsData from '@/content/data/battleBackgrounds.json';

export const uiBattleBackgrounds = battleBackgroundsData as Record<string, unknown>;
