/**
 * 主题系统入口
 * 导出所有主题配置和工具函数
 */

export * from './grimdark';

// 主题工具函数
import { grimdarkColors, grimdarkTerminology } from './grimdark';

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
 * 检查是否应该使用战锤术语
 * 可以通过 localStorage 或环境变量控制
 */
export function shouldUseGrimdarkTerms(): boolean {
  if (typeof window !== 'undefined') {
    const setting = localStorage.getItem('deckrogue_grimdark_terms');
    return setting !== 'false';
  }
  return true;
}

/**
 * 切换战锤术语显示
 */
export function toggleGrimdarkTerms(): void {
  if (typeof window !== 'undefined') {
    const current = localStorage.getItem('deckrogue_grimdark_terms') !== 'false';
    localStorage.setItem('deckrogue_grimdark_terms', String(!current));
  }
}
