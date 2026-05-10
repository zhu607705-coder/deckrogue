/**
 * @file index.ts
 * @description 主题系统入口 - 导出所有主题配置和工具函数
 *
 * 主要职责:
 * - 导出 grimdark 主题颜色和术语
 * - 提供资源和战斗术语获取函数
 * - 管理黑暗哥特术语切换配置
 */

export * from '@/ui/theme/grimdark';

// 主题工具函数
import { grimdarkColors, grimdarkTerminology } from '@/ui/theme/grimdark';
import { safeStorageGetString, safeStorageSetString } from '@/core/utils/safeStorage';

/**
 * 获取资源显示名称
 */
export function getResourceName(resourceKey: keyof typeof grimdarkTerminology.resources): string {
  return grimdarkTerminology.resources[resourceKey]?.name || resourceKey;
}

/**
 * 获取资源图标
 */
export function getResourceIcon(resourceKey: keyof typeof grimdarkTerminology.resources): string {
  return grimdarkTerminology.resources[resourceKey]?.icon || '';
}

/**
 * 获取资源描述
 */
export function getResourceDescription(resourceKey: keyof typeof grimdarkTerminology.resources): string {
  return grimdarkTerminology.resources[resourceKey]?.description || '';
}

/**
 * 获取游戏元素名称
 */
export function getGameElementName(
  elementKey: keyof typeof grimdarkTerminology.game
): string {
  return grimdarkTerminology.game[elementKey]?.name || elementKey;
}

/**
 * 获取战斗术语
 */
export function getCombatTerm(
  termKey: keyof typeof grimdarkTerminology.combat
): string {
  return grimdarkTerminology.combat[termKey]?.name || termKey;
}

/**
 * 获取颜色值
 */
export function getColor(
  colorFamily: keyof typeof grimdarkColors,
  shade: string
): string {
  const family = grimdarkColors[colorFamily];
  if (family && typeof family === 'object') {
    return (family as Record<string, string>)[shade] || '';
  }
  return '';
}

/**
 * 检查是否应该使用黑暗哥特术语
 * 可以通过 localStorage 或环境变量控制
 */
export function shouldUseGrimdarkTerms(): boolean {
  if (typeof window !== 'undefined') {
    const setting = safeStorageGetString('deckrogue_grimdark_terms', '').value;
    return setting !== 'false';
  }
  return true;
}

/**
 * 切换黑暗哥特术语显示
 */
export function toggleGrimdarkTerms(): void {
  if (typeof window !== 'undefined') {
    const current = safeStorageGetString('deckrogue_grimdark_terms', '').value !== 'false';
    safeStorageSetString('deckrogue_grimdark_terms', String(!current));
  }
}
