import React from 'react';
import { GameEngine } from '@/core';
import { CardView } from '@/ui/views/CardView';
import { BackgroundImage, VIEW_BACKGROUNDS } from '@/ui/components/BackgroundImage';
import worldLoreData from '@/content/data/worldLore.json';

export function UpgradeView({ engine }: { engine: GameEngine }) {
  const WORLD_LORE = worldLoreData as any;
  const deck = engine.state.player.deck;
  const upgradableCards = deck.filter(c => !c.isUpgraded && c.upgrade);
  const backgroundSrc = VIEW_BACKGROUNDS.upgrade.desktop;

  return (
    <BackgroundImage 
      src={backgroundSrc} 
      className="flex flex-col h-full text-slate-200 p-8 items-center overflow-y-auto"
      overlayOpacity={0.6}
    >
      <h1 className="text-4xl font-serif text-emerald-400 mb-4 drop-shadow-lg">选择一张记忆印痕进行强化</h1>
      <div className="max-w-3xl text-center text-sm leading-6 text-emerald-100/80 mb-8 px-4">
        {WORLD_LORE?.viewAtmosphere?.Upgrade}
      </div>
      
      <div className="flex flex-wrap justify-center gap-6 mb-12 max-w-5xl">
        {upgradableCards.map(card => (
          <div key={card.instanceId} className="flex flex-col items-center gap-2">
            <CardView 
              card={card} 
              onClick={() => engine.upgradeCard(card.instanceId!)}
            />
          </div>
        ))}
        {upgradableCards.length === 0 && (
          <div className="text-slate-500 text-xl">记忆印痕库中没有可强化的卡牌。</div>
        )}
      </div>

      <button 
        onClick={() => engine.cancelUpgrade()}
        className="px-8 py-3 bg-slate-800/80 hover:bg-slate-700/80 text-white font-bold rounded-xl border border-slate-600 transition-colors mt-auto backdrop-blur-sm"
      >
        取消
      </button>
    </BackgroundImage>
  );
}
