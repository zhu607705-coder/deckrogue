/**
 * @file legacyRenderBridge.ts
 * @description 旧版渲染桥接器，将 GameEngine 状态桥接为 RenderModel 格式
 *
 * 主要职责:
 * - 从 GameEngine 状态创建旧版渲染模型
 * - 补充商店、附魔等旧版特有字段
 * - 集成遗物和药水定义解析
 */
import type { GameEngine } from '@/core/events/gameEngine';
import { getPotionDefById, getRelicDefById } from '@/content/narrative/numericSystem';

import type { RenderModel } from './contracts';
import { normalizeLegacyGameState } from './normalizeLegacyGameState';
import { createRenderModel } from './renderModel';

export function createLegacyRenderModel(engine: GameEngine): RenderModel {
  const base = createRenderModel(normalizeLegacyGameState(engine.state, engine.getSaveData()));
  const player = engine.state.player;
  const canEnchant = player.deck.some(
    (card) => (card.type === 'Attack' || card.type === 'Skill') && (!(card as any).persistentEnchantments || (card as any).persistentEnchantments.length === 0),
  );

  if (engine.state.screen === 'Shop') {
    return {
      ...base,
      room: {
        kind: 'shop',
        cardCount: engine.state.shopCards.length,
        relicCount: engine.state.shopRelics.length,
        potionStockCount: engine.state.shopPotions.length,
        cardRemovalCost: engine.state.cardRemovalCost,
        canUpgrade: player.deck.some((card) => !card.isUpgraded && card.upgrade) && player.gold >= 50,
        canRemove: player.gold >= engine.state.cardRemovalCost && player.deck.length > 0,
        canMix: player.potions.length >= 2,
        canEnchant,
        cards: engine.state.shopCards.map((card) => ({
          id: card.id,
          name: card.name,
          price: engine.getAdjustedShopPrice(card.rarity === 'Rare' ? 150 : card.rarity === 'Uncommon' ? 75 : 50),
          rarity: card.rarity,
          type: card.type,
          description: card.text,
        })),
        relics: engine.state.shopRelics.map((id) => {
          const relic = getRelicDefById(id);
          return {
            id,
            name: relic?.name || id,
            price: engine.getAdjustedShopPrice(relic?.price ?? 150),
            rarity: undefined,
            type: 'Relic',
            description: relic?.description,
          };
        }),
        potions: engine.state.shopPotions.map((id) => {
          const potion = getPotionDefById(id);
          return {
            id,
            name: potion?.name || id,
            price: engine.getAdjustedShopPrice(potion?.price ?? 65),
            rarity: undefined,
            type: 'Potion',
            description: potion?.description,
          };
        }),
      },
    };
  }

  if (engine.state.screen === 'Rest') {
    return {
      ...base,
      room: {
        kind: 'rest',
        healAmount: Math.floor(player.maxHp * 0.3),
        canHeal: player.hp < player.maxHp,
        canUpgrade: player.deck.some((card) => !card.isUpgraded && card.upgrade),
        canMix: player.potions.length >= 2,
        canEnchant,
      },
    };
  }

  if (engine.state.screen === 'Reward') {
    return {
      ...base,
      room: {
        kind: 'reward',
        offerCount: engine.state.rewardCards.length,
      },
    };
  }

  return base;
}
