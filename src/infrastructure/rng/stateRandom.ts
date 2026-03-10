import type { GameState } from '@/core/types';
import { systemRandom } from '@/infrastructure/rng/systemRandom';

type RNG = () => number;

const stateRngRegistry = new WeakMap<GameState, RNG>();

function fallbackRandom(): number {
  return systemRandom();
}

function getBoundRng(state: GameState): RNG {
  return stateRngRegistry.get(state) || fallbackRandom;
}

export function bindStateRng(state: GameState, rng: RNG): void {
  if (!state || typeof rng !== 'function') return;
  stateRngRegistry.set(state, rng);
}

export function stateRandom(state: GameState): number {
  const raw = getBoundRng(state)();
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
