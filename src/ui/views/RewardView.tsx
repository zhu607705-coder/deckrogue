import React, { useState } from 'react';
import { GameEngine } from '@/core';
import { CardView } from '@/ui/views/CardView';
import { BackgroundImage, VIEW_BACKGROUNDS } from '@/ui/components/BackgroundImage';
import { systemRandomInt } from '@/infrastructure/rng/systemRandom';
import worldLoreData from '@/content/data/worldLore.json';

export function RewardView({ engine }: { engine: GameEngine }) {
  const WORLD_LORE = worldLoreData as any;
  const cards = engine.state.rewardCards.slice(0, 3);
  const [backgroundIndex] = useState(() => systemRandomInt(VIEW_BACKGROUNDS.reward.length));
  const backgroundSrc = VIEW_BACKGROUNDS.reward[backgroundIndex].desktop;

  return (
    <BackgroundImage 
      src={backgroundSrc} 
      className="flex flex-col h-full text-slate-200 p-8 items-center justify-center"
      overlayOpacity={0.6}
    >
      <h1 className="text-3xl sm:text-4xl font-serif mb-4 text-yellow-400 drop-shadow-lg text-center">选取 1 张记忆印痕</h1>
      <div className="max-w-3xl text-center text-sm leading-6 text-yellow-100/80 mb-6 px-4">
        {WORLD_LORE?.viewAtmosphere?.Reward}
      </div>
      
      {cards.length === 0 ? (
        <div className="text-slate-400 text-xl mb-12">没有可回收的战术残片</div>
      ) : (
        <div className="w-full max-w-6xl mb-10 flex justify-center">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 xl:gap-8 justify-items-center">
          {cards.map((card: any) => (
            <CardView 
              key={card.instanceId} 
              card={card} 
              onClick={() => engine.pickRewardCard(card.instanceId)}
            />
          ))}
          </div>
        </div>
      )}

      <button 
        onClick={() => engine.skipReward()}
        className="px-8 py-3 bg-slate-800/80 hover:bg-slate-700/80 text-white font-bold rounded-xl border border-slate-600 transition-colors backdrop-blur-sm"
      >
        跳过
      </button>
    </BackgroundImage>
  );
}
