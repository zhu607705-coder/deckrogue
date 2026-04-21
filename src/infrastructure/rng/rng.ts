export type RNG = (() => number) & { getState?: () => number };

export function createRNG(seed: number, initialState?: number): RNG {
  let state = typeof initialState === 'number' && Number.isFinite(initialState) ? initialState : seed;
  const rng = function() {
    state |= 0; state = state + 0x6D2B79F5 | 0;
    let t = Math.imul(state ^ state >>> 15, 1 | state);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  } as RNG;
  rng.getState = () => state;
  return rng;
}
