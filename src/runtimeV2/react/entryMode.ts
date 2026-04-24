/**
 * @file entryMode.ts
 * @description 应用入口模式解析器，根据 URL 参数决定使用 legacy、runtime-v2 或 unified 模式
 *
 * 主要职责:
 * - 解析 URL 查询参数中的模式标识
 * - 确定应用启动时应使用的引擎模式
 * - 提供默认回退策略（默认使用 legacy 模式）
 */
export function resolveAppEntryMode(search: string): 'legacy' | 'runtime-v2' | 'unified' {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const legacyParam = params.get('legacy');
  const runtimeV2Param = params.get('runtimeV2');
  const unifiedParam = params.get('unified');

  // Default to legacy (original UI) - runtime-v2 is debug/parity entry only
  if (unifiedParam === '1') return 'unified';
  if (runtimeV2Param === '1' && legacyParam !== '1') return 'runtime-v2';
  return 'legacy';
}
