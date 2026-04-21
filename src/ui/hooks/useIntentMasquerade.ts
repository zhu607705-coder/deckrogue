import { useCallback, useRef, useEffect, useState } from 'react';
import type { GameEngine } from '@/core';
import type { IntentDisplay, IntentType } from '@/types';

type RuntimeEnemy = NonNullable<GameEngine['state']['combat']>['enemies'][number];

interface MasqueradeMask {
  icon: string;
  text: string;
  tone: IntentType;
}

export function useIntentMasquerade(engine: GameEngine) {
  const state = engine.state.combat!;
  const [intentDeceptionTick, setIntentDeceptionTick] = useState(0);
  const hasIntelRead = (engine.state.player.intel || 0) > 0;

  useEffect(() => {
    if ((state.warpTide || 0) < 70) return;
    const intervalMs = Math.max(300, 1400 - Math.floor(((state.warpTide || 0) - 70) * 12));
    const id = setInterval(() => setIntentDeceptionTick((t) => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [state.warpTide]);

  const hashIntentSeed = useCallback((seed: string): number => {
    let h = 2166136261;
    for (let i = 0; i < seed.length; i += 1) {
      h ^= seed.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }, []);

  const maybeMasqueradeIntent = useCallback((enemy: RuntimeEnemy, intent: IntentDisplay): IntentDisplay => {
    const warpTide = Math.max(0, Math.min(100, Number(state.warpTide || 0)));
    if (warpTide < 70) return intent;
    if (!intent || intent.tone === 'neutral') return intent;
    if (enemy.hp <= 0) return intent;

    const chaos = (warpTide - 70) / 30;
    const roll = (hashIntentSeed(`${enemy.id}:${enemy.nextIntent || 'unknown'}:${state.turn}:${intentDeceptionTick}`) % 1000) / 1000;
    const shouldLie = roll < (0.18 + chaos * 0.42);
    if (!shouldLie) return intent;

    const masks: MasqueradeMask[] = [
      { icon: '⚔️', text: hasIntelRead ? '重击' : 'Attack', tone: 'attack' },
      { icon: '🛡️', text: hasIntelRead ? '坚守' : 'Guard', tone: 'block' },
      { icon: '✦', text: hasIntelRead ? '仪式' : 'Ritual', tone: 'status' }
    ];
    const filteredMasks = masks.filter((m) => !(m.icon === intent.icon && m.text === intent.text));
    
    if (!filteredMasks.length) return intent;
    const picked = filteredMasks[hashIntentSeed(`${enemy.id}:${intentDeceptionTick}:mask`) % filteredMasks.length];
    
    return {
      ...intent,
      icon: picked.icon,
      text: picked.text,
      tone: picked.tone,
      isWarpMasquerade: true
    };
  }, [state.warpTide, state.turn, intentDeceptionTick, hasIntelRead, hashIntentSeed]);

  return { intentDeceptionTick, maybeMasqueradeIntent };
}
