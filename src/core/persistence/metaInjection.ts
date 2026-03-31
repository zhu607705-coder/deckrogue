import type { CardDef, GameState, MetaProfile, RunCardInstance } from '@/core/types';
import { getAscensionLevelConfig, getAscensionMaxLevel, metaBalance } from '@/core/balance/metaBalance';
import { createRunCardInstance, normalizeRunCardInstance } from '@/core/combat/runCardInstance';
import { cardsData } from '@/content/narrative/numericSystem';
import { relicsData } from '@/content/narrative/numericSystem';
import { systemRandom } from '@/infrastructure/rng/systemRandom';

interface MetaInjectionContext {
  rng?: () => number;
  generateId: () => string;
}

function pickRandom<T>(items: T[], rng?: () => number): T | null {
  if (items.length === 0) return null;
  const roll = Math.max(0, Math.min(0.999999, rng ? rng() : systemRandom()));
  return items[Math.floor(roll * items.length)] ?? items[0];
}

function addCardToDeck(state: GameState, cardId: string, ctx: MetaInjectionContext, mutate?: (card: RunCardInstance) => CardDef | RunCardInstance): boolean {
  const def = (cardsData as any[]).find((c) => c.id === cardId);
  if (!def) return false;
  const baseCard = createRunCardInstance(def as CardDef, ctx.generateId());
  const mutated = mutate ? mutate(baseCard) : baseCard;
  state.player.deck.push(normalizeRunCardInstance(mutated, ctx.generateId));
  return true;
}

function addRelic(state: GameState, relicId: string): boolean {
  const relic = (relicsData as any[]).find((r) => r.id === relicId);
  if (!relic || state.player.relics.includes(relicId)) return false;
  state.player.relics.push(relicId);
  state.player.relicStates[relicId] ||= { level: 1, progress: 0, corrupted: !!(relic as any).corrupted };
  return true;
}

export function applyMetaProfileToNewRunState(state: GameState, meta: MetaProfile | null | undefined, ctx: MetaInjectionContext): void {
  if (!meta) return;

  state.metaRuntime = {
    unlockedPoolIds: [...new Set(meta.unlockedPools || [])],
    appliedUpgradeIds: [],
    appliedPactIds: [],
    appliedMartyrLegacyId: meta.martyrLegacy?.id
  };

  for (const upgradeId of meta.activeUpgrades || []) {
    const upgrade = (metaBalance.upgrades as any)[upgradeId];
    if (!upgrade) continue;
    const fx = upgrade.effects || {};

    if (typeof fx.startingGold === 'number') {
      state.player.gold += fx.startingGold;
    }
    if (typeof fx.maxHpFlat === 'number') {
      state.player.maxHp += fx.maxHpFlat;
      state.player.hp += fx.maxHpFlat;
    }
    if (typeof fx.startingIntel === 'number') {
      state.player.intel += fx.startingIntel;
    }
    state.metaRuntime.appliedUpgradeIds.push(upgradeId);
  }

  for (const pactId of meta.activePacts || []) {
    const pact = (metaBalance.pacts as any)[pactId];
    if (!pact) continue;
    const benefits = pact.benefits || {};
    const penalties = pact.penalties || {};

    if (typeof benefits.maxEnergyFlat === 'number') {
      state.player.maxEnergy += benefits.maxEnergyFlat;
      state.player.energy += benefits.maxEnergyFlat;
    }
    if (typeof benefits.addRandomRareCard === 'number' && benefits.addRandomRareCard > 0) {
      const charId = state.character?.id;
      const rarePool = (cardsData as any[]).filter((c) =>
        c.rarity === 'Rare' &&
        ((((c as any).character ?? 'All') === 'All') || (c as any).character === charId)
      );
      for (let i = 0; i < benefits.addRandomRareCard; i++) {
        const picked = pickRandom(rarePool, ctx.rng);
        if (picked) {
          state.player.deck.push(createRunCardInstance(picked as CardDef, ctx.generateId()) as RunCardInstance);
        }
      }
    }

    // Dual-edge law: penalties are applied in the same pact branch as benefits.
    if (typeof penalties.maxHpPctLoss === 'number' && penalties.maxHpPctLoss > 0) {
      const loss = Math.max(1, Math.floor(state.player.maxHp * penalties.maxHpPctLoss));
      state.player.maxHp = Math.max(1, state.player.maxHp - loss);
      state.player.hp = Math.min(state.player.hp, state.player.maxHp);
    }
    if (Array.isArray(penalties.addCurseCardIds)) {
      for (const curseId of penalties.addCurseCardIds) {
        if (typeof curseId === 'string') addCardToDeck(state, curseId, ctx);
      }
    }

    state.metaRuntime.appliedPactIds.push(pactId);
  }

  const legacy = meta.martyrLegacy;
  if (legacy) {
    const legacyCfg = metaBalance.martyrLegacy;
    if (legacy.inheritedCardId) {
      addCardToDeck(state, legacy.inheritedCardId, ctx, (card) => {
        const extraTags = new Set([...(card.tags || []), String(legacyCfg.inheritedCardWeakTag || 'OldEcho')]);
        return {
          ...card,
          cost: Math.max(0, card.cost + Math.max(0, Number(legacyCfg.inheritedCardCostPenalty || 1))),
          tags: Array.from(extraTags),
          text: `${card.text} [Legacy: burdened by old echoes]`
        };
      });
    }
    if (legacy.inheritedRelicId) {
      addRelic(state, legacy.inheritedRelicId);
      const curseId = String(legacyCfg.inheritedRelicAddsCurse || '');
      if (curseId) addCardToDeck(state, curseId, ctx);
    }
  }

  const selectedStartingRelicId = meta.preferences?.selectedStartingRelicId || null;
  if (selectedStartingRelicId && (meta.unlocks?.startingRelics || []).includes(selectedStartingRelicId)) {
    addRelic(state, selectedStartingRelicId);
  }

  const maxAsc = getAscensionMaxLevel();
  const unlockedAsc = Math.max(0, Math.floor(meta.progression?.ascensionUnlockedLevel || 0));
  const selectedAsc = Math.max(0, Math.min(maxAsc, Math.floor(meta.preferences?.selectedAscension || 0)));
  const activeAsc = Math.min(selectedAsc, unlockedAsc);
  if (activeAsc > 0) {
    const ascCfg = getAscensionLevelConfig(activeAsc) || {};
    state.metaRuntime.ascensionLevel = activeAsc;
    state.metaRuntime.ascensionEnemyHpMultiplier = Math.max(1, Number(ascCfg.enemyHpMultiplier) || 1);
    state.metaRuntime.ascensionEnemyDamageMultiplier = Math.max(1, Number(ascCfg.enemyDamageMultiplier) || 1);
    state.metaRuntime.ascensionEliteUpgradeChance = Math.max(0, Math.min(0.9, Number(ascCfg.eliteUpgradeChance) || 0));
    state.metaRuntime.ascensionIntentAggroBias = Math.max(0, Number(ascCfg.intentAggroBias) || 0);
    const mapWeightDelta = ascCfg.mapWeightDelta;
    if (mapWeightDelta && typeof mapWeightDelta === 'object') {
      state.metaRuntime.ascensionMapWeightDelta = {
        elite: Number(mapWeightDelta.elite) || 0,
        event: Number(mapWeightDelta.event) || 0,
        shop: Number(mapWeightDelta.shop) || 0,
        rest: Number(mapWeightDelta.rest) || 0
      };
    }
    const hpMultiplier = Math.max(0.5, Math.min(1.5, Number(ascCfg.playerMaxHpMultiplier) || 1));
    if (hpMultiplier !== 1) {
      state.player.maxHp = Math.max(1, Math.floor(state.player.maxHp * hpMultiplier));
      state.player.hp = Math.min(state.player.hp, state.player.maxHp);
    }
    const startingCurseIds = Array.isArray(ascCfg.startingCurseCardIds) ? ascCfg.startingCurseCardIds : [];
    for (const curseId of startingCurseIds) {
      if (typeof curseId === 'string' && curseId) {
        addCardToDeck(state, curseId, ctx);
      }
    }
  }

  state.player.gold = Math.max(0, Math.floor(state.player.gold));
  state.player.maxHp = Math.max(1, Math.floor(state.player.maxHp));
  state.player.hp = Math.max(1, Math.min(state.player.maxHp, Math.floor(state.player.hp)));
  state.player.maxEnergy = Math.max(1, Math.floor(state.player.maxEnergy));
  state.player.energy = Math.max(0, Math.floor(state.player.energy));
  state.player.intel = Math.max(0, Math.floor(state.player.intel));
}
