let fallbackState = 0;

function nextFallbackUint32(): number {
  if (fallbackState === 0) {
    const now = Date.now() >>> 0;
    const perfNow = (typeof performance !== 'undefined' && typeof performance.now === 'function')
      ? Math.floor(performance.now() * 1000) >>> 0
      : 0;
    fallbackState = (now ^ perfNow ^ 0x9e3779b9) >>> 0;
    if (fallbackState === 0) fallbackState = 0x6d2b79f5;
  }
  fallbackState = (fallbackState + 0x6d2b79f5) >>> 0;
  let t = fallbackState;
  t = Math.imul(t ^ (t >>> 15), 1 | t);
  t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
  return (t ^ (t >>> 14)) >>> 0;
}

export function systemRandom(): number {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.getRandomValues === 'function') {
    const arr = new Uint32Array(1);
    cryptoApi.getRandomValues(arr);
    const value = arr[0];
    return (value ?? nextFallbackUint32()) / 4294967296;
  }
  return nextFallbackUint32() / 4294967296;
}

export function systemRandomInt(maxExclusive: number): number {
  if (!Number.isFinite(maxExclusive) || maxExclusive <= 0) return 0;
  return Math.floor(systemRandom() * Math.floor(maxExclusive));
}

