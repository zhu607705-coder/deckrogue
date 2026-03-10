import { useCallback, useMemo } from 'react';
import type { GameEngine } from '@/core';
import type { ActionSpec, CardDef } from '@/core';
import type { CardInstance } from '@/types';

interface ActionNumberPair {
  base: number;
  final: number;
}

interface CardWithTempCost extends CardDef {
  tempCost?: number;
}

export function useCardPreview(engine: GameEngine) {
  const state = engine.state.combat!;
  const player = state.player;
  type RuntimeEnemy = typeof state.enemies[number];

  const flattenActions = useCallback((actions: ActionSpec[] | undefined): ActionSpec[] => {
    if (!actions) return [];
    const flat: ActionSpec[] = [];
    for (const action of actions) {
      flat.push(action);
      if (action.actions?.length) flat.push(...flattenActions(action.actions));
      if (action.trueActions?.length) flat.push(...flattenActions(action.trueActions));
      if (action.falseActions?.length) flat.push(...flattenActions(action.falseActions));
    }
    return flat;
  }, []);

  const previewBlockAmount = useCallback((amount: number): number => {
    let block = amount;
    if (player.statuses['Dexterity']) block += player.statuses['Dexterity'];
    if (player.statuses['Frail']) block = Math.floor(block * 0.75);
    return Math.max(0, block);
  }, [player.statuses]);

  const getPreviewTarget = useCallback((_card: CardDef, hoveredEnemyId: string | null): RuntimeEnemy | null => {
    const aliveEnemies = state.enemies.filter((e) => e.hp > 0);
    if (aliveEnemies.length === 0) return null;
    if (hoveredEnemyId) {
      const hovered = aliveEnemies.find((e) => e.id === hoveredEnemyId);
      if (hovered) return hovered;
    }
    return aliveEnemies[0] || null;
  }, [state.enemies]);

  const previewActionNumberPairs = useCallback((card: CardDef, hoveredEnemyId: string | null): ActionNumberPair[] => {
    const target = getPreviewTarget(card, hoveredEnemyId);
    const pairs: ActionNumberPair[] = [];
    const actions = flattenActions(card.actions);

    for (const action of actions) {
      if (action.type === 'DealDamage' && typeof action.amount === 'number') {
        let baseDamage = action.amount;
        if (card.id === 'body_slam') baseDamage = player.block;
        if (action.scaling?.type === 'DelayedCards') {
          baseDamage += (player.delayedCards?.length || 0) * (action.scaling.multiplier || 1);
        } else if (action.scaling?.type === 'Constructs') {
          baseDamage += (player.constructs?.length || 0) * (action.scaling.multiplier || 1);
        }
        const targetStatuses = action.target === 'Self' ? player.statuses : target?.statuses || {};
        pairs.push({ base: action.amount, final: engine.calculateDamage(baseDamage, player.statuses, targetStatuses) });
        continue;
      }

      if (action.type === 'DealWarpDamage' && typeof action.amount === 'number') {
        const alpha = engine.getWarpEffectiveAlpha(typeof action.alpha === 'number' ? action.alpha : undefined);
        const scaledBase = Math.max(0, Math.floor(action.amount * engine.getWarpPowerMultiplier(state.warpTide, alpha)));
        const targetStatuses = action.target === 'Self' ? player.statuses : target?.statuses || {};
        pairs.push({ base: action.amount, final: engine.calculateDamage(scaledBase, player.statuses, targetStatuses) });
        continue;
      }

      if (action.type === 'GainBlock' && typeof action.amount === 'number') {
        pairs.push({ base: action.amount, final: previewBlockAmount(action.amount) });
        continue;
      }

      if (action.type === 'EmergencyBlock') {
        if (typeof action.amount === 'number') {
          const final = player.hp < player.maxHp * 0.3 ? (action.bonus ?? action.amount) : action.amount;
          pairs.push({ base: action.amount, final: previewBlockAmount(final) });
        }
        if (typeof action.bonus === 'number') {
          const final = player.hp < player.maxHp * 0.3 ? action.bonus : (action.amount ?? action.bonus);
          pairs.push({ base: action.bonus, final: previewBlockAmount(final) });
        }
        continue;
      }

      if (action.type === 'ElementalOverloadDamage' && typeof action.amount === 'number') {
        const uniqueElements = new Set(player.elements || []);
        const final = uniqueElements.size >= 3 ? action.amount * 2 : action.amount;
        pairs.push({ base: action.amount, final });
        continue;
      }

      if (action.type === 'PrecisionThrowDamage') {
        if (typeof action.amount === 'number' && typeof action.bonus === 'number') {
          const final = (target?.block || 0) > 0 ? action.bonus : action.amount;
          pairs.push({ base: action.amount, final });
          pairs.push({ base: action.bonus, final });
        } else if (typeof action.amount === 'number') {
          pairs.push({ base: action.amount, final: action.amount });
        }
        continue;
      }

      if (action.type === 'SolventDamage' && typeof action.amount === 'number') {
        const final = action.amount + ((target?.block || 0) > 0 ? (target?.block || 0) : 0);
        pairs.push({ base: action.amount, final });
        continue;
      }

      if (typeof action.amount === 'number') {
        pairs.push({ base: action.amount, final: action.amount });
      }
      if (typeof action.bonus === 'number') {
        pairs.push({ base: action.bonus, final: action.bonus });
      }
    }

    return pairs;
  }, [flattenActions, player, state, engine, previewBlockAmount, getPreviewTarget]);

  const getDynamicCardText = useCallback((card: CardDef, hoveredEnemyId: string | null): string => {
    const pairs = previewActionNumberPairs(card, hoveredEnemyId).filter(p => Number.isFinite(p.base) && Number.isFinite(p.final));
    if (!pairs.some(p => p.base !== p.final)) return card.text;

    let searchStart = 0;
    return card.text.replace(/\d+/g, (match) => {
      const raw = Number(match);
      let foundIndex = -1;
      for (let i = searchStart; i < pairs.length; i++) {
        if (pairs[i].base === raw) {
          foundIndex = i;
          break;
        }
      }
      if (foundIndex === -1) return match;
      searchStart = foundIndex + 1;
      return String(pairs[foundIndex].final);
    });
  }, [previewActionNumberPairs]);

  const getPreviewCost = useCallback((card: CardWithTempCost): number => {
    let cost = card.cost;
    if (card.type === 'Attack' && player.statuses['NextAttackDiscount']) {
      cost = Math.max(0, cost - player.statuses['NextAttackDiscount']);
    }
    if (card.tempCost !== undefined) {
      cost = card.tempCost;
    }
    return cost;
  }, [player.statuses]);

  return { previewActionNumberPairs, getDynamicCardText, getPreviewCost };
}
