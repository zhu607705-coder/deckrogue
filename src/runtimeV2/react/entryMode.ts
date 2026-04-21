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
