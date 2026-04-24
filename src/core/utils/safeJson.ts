/**
 * @file safeJson.ts
 * @description 安全 JSON 操作 - 提供防御性 JSON 解析和克隆工具函数
 *
 * 主要职责:
 * - 实现 safeJsonParse，安全地解析 JSON 字符串，失败时返回默认值
 * - 实现 cloneJsonValue，深拷贝 JSON 可序列化的值
 * - 防止无效 JSON 导致的运行时错误
 * - 为存档系统和状态管理提供可靠的克隆功能
 */
export function safeJsonParse<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function cloneJsonValue<T>(value: T, fallback: T): T {
  try {
    return safeJsonParse(JSON.stringify(value), fallback);
  } catch {
    return fallback;
  }
}
