/**
 * @file worldLore.ts
 * @description 世界设定数据导出 - 提供游戏世界观和设定资料
 *
 * 主要职责:
 * - 导出世界设定 JSON 数据
 * - 提供类型安全的设定资源访问
 */

import worldLoreData from '@/content/data/worldLore.json';

export const uiWorldLore = worldLoreData as Record<string, unknown>;
