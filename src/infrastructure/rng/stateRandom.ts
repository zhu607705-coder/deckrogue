import type { GameState } from '@/core/types';
import { createRNG, type RNG } from '@/infrastructure/rng/rng';
import { systemRandom } from '@/infrastructure/rng/systemRandom';

const stateRngRegistry = new WeakMap<GameState, RNG>();

function fallbackRandom(): number {
  return systemRandom();
}

function deriveRngFromState(state: GameState): RNG | null {
  const seed = Number((state as any).seed);
  const rngState = Number((state as any).rngState);
  if (!Number.isFinite(seed) || !Number.isFinite(rngState)) return null;
  const rng = createRNG(seed, rngState);
  stateRngRegistry.set(state, rng);
  return rng;
}

function getBoundRng(state: GameState): RNG {
  return stateRngRegistry.get(state) || deriveRngFromState(state) || fallbackRandom;
}

function syncRngState(state: GameState, rng: RNG): void {
  const nextState = rng.getState?.();
  if (Number.isFinite(nextState)) {
    (state as any).rngState = nextState;
  }
}

export function bindStateRng(state: GameState, rng: RNG): void {
  if (!state || typeof rng !== 'function') return;
  stateRngRegistry.set(state, rng);
}

export function stateRandom(state: GameState): number {
  const rng = getBoundRng(state);
  const raw = rng();
  syncRngState(state, rng);
  if (!Number.isFinite(raw)) return 0;
  if (raw <= 0) return 0;
  if (raw >= 1) return 1 - Number.EPSILON;
  return raw;
}

export function stateRandomInt(state: GameState, maxExclusive: number): number {
  if (!Number.isFinite(maxExclusive) || maxExclusive <= 0) return 0;
  return Math.floor(stateRandom(state) * maxExclusive);
}

export function stateRandomRangeInt(state: GameState, minInclusive: number, maxInclusive: number): number {
  const min = Math.floor(minInclusive);
  const max = Math.floor(maxInclusive);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return 0;
  if (max <= min) return min;
  return min + stateRandomInt(state, max - min + 1);
}

export function stateRandomChoice<T>(state: GameState, items: T[]): T | undefined {
  if (!items.length) return undefined;
  return items[stateRandomInt(state, items.length)];
}

export function stateShuffle<T>(state: GameState, items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = stateRandomInt(state, i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function stateRandomId(state: GameState, prefix = 'id'): string {
  const a = Math.floor(stateRandom(state) * 1e9).toString(36);
  const b = Math.floor(stateRandom(state) * 1e9).toString(36);
  return `${prefix}_${a}${b}`;
}
