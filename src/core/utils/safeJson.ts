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
