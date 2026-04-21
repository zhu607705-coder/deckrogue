import React from 'react';
import { GameEngine } from '@/core';
import { CardView } from '@/ui/views/CardView';
import { BackgroundImage, VIEW_BACKGROUNDS } from '@/ui/components/BackgroundImage';
import { getCardEnchantmentDefById, getKnownRouteTagsForCharacter, getPreferredRouteTagFromState, sortCardsByRouteAffinity } from '@/content/narrative/numericSystem';
import { ErrorBoundary } from '@/ui/components/ErrorBoundary';
import type { RunCardInstance } from '@/core';
import { uiWorldLore } from '@/ui/content/worldLore';

interface WorldLoreType {
  viewAtmosphere?: {
    Upgrade?: string;
  };
}

const WORLD_LORE = uiWorldLore as WorldLoreType;

export function EnchantView({ engine }: { engine: GameEngine }) {
  const context = engine.state.enchantContext;
  const enchantment = context?.enchantmentId ? getCardEnchantmentDefById(context.enchantmentId) : null;
  const routeTagsForCharacter = engine.state.character?.id ? getKnownRouteTagsForCharacter(engine.state.character.id) : [];
  const preferredRouteTag = getPreferredRouteTagFromState(engine.state.player.deck, routeTagsForCharacter, engine.state.routeState ?? null);

  const enchantableCards = sortCardsByRouteAffinity(engine.state.player.deck.filter((card) => {
    const runCard = card as RunCardInstance;
    const hasNoEnchantment = (card.type === 'Attack' || card.type === 'Skill') && runCard.persistentEnchantments.length === 0;
    if (!hasNoEnchantment) return false;

    if (enchantment?.applicableTo && card.type) {
      return enchantment.applicableTo.includes(card.type as 'Attack' | 'Skill');
    }

    return true;
  }), preferredRouteTag);
  const backgroundSrc = VIEW_BACKGROUNDS.upgrade.desktop;

  return (
    <ErrorBoundary>
      <BackgroundImage
        src={backgroundSrc}
        className="flex flex-col h-full text-slate-200 p-8 items-center overflow-y-auto"
        overlayOpacity={0.68}
      >
        <h1 className="text-4xl font-serif text-amber-300 mb-4 drop-shadow-lg">
          {context?.title || '选择一张牌接受附魔'}
        </h1>
        <div className="max-w-3xl text-center text-sm leading-6 text-amber-100/80 mb-4 px-4">
          {context?.description || WORLD_LORE?.viewAtmosphere?.Upgrade}
        </div>
        {typeof context?.price === 'number' && (
          <div className="mb-6 rounded-full border border-amber-500/40 bg-amber-950/20 px-4 py-1 text-sm text-amber-100">
            费用：{context.price} 信用筹码
          </div>
        )}

        <div className="flex flex-wrap justify-center gap-6 mb-12 max-w-6xl">
          {enchantableCards.map((card, index) => {
          const preview = engine.getEnchantPreview(card.instanceId!);
          const baseCost = (card as any).runtimeBase?.cost ?? card.cost;
          const costChanged = preview ? preview.cost !== baseCost : false;
          return (
            <div key={card.instanceId} className="flex flex-col items-center gap-3">
              <CardView
                card={preview || card}
                onClick={() => engine.applyEnchantment(card.instanceId!)}
                rootProps={{
                  'data-keyboard-option': index < 10 ? String(index + 1) : undefined,
                  'data-keyboard-focus': 'true',
                  'aria-label': `${index + 1}. ${card.name}`
                }}
              />
              <div className="max-w-[16rem] rounded-lg border border-amber-500/20 bg-black/25 px-3 py-2 text-center text-xs text-slate-300">
                {preview ? (
                  <div className="space-y-1">
                    <div className="text-amber-200">{card.name}</div>
                    <div>
                      费用：{baseCost}
                      {costChanged ? ` → ${preview.cost}` : '（不变）'}
                    </div>
                    <div className="text-slate-400">{preview.text.split('\n').slice(-1)[0]}</div>
                  </div>
                ) : '无法预览'}
              </div>
            </div>
          );
        })}
          {enchantableCards.length === 0 && (
            <div className="text-slate-500 text-xl">当前没有可接受附魔的攻击或技能牌。</div>
          )}
        </div>

        <button
          type="button"
          onClick={() => engine.cancelEnchant()}
          className="px-8 py-3 bg-slate-800/80 hover:bg-slate-700/80 text-white font-bold rounded-xl border border-slate-600 transition-colors mt-auto backdrop-blur-sm"
          data-keyboard-close="true"
          data-keyboard-focus="true"
          data-keyboard-option="10"
        >
          取消
        </button>
      </BackgroundImage>
    </ErrorBoundary>
  );
}
