import React from 'react';
import { GameEngine } from '../engine/engine';
import { CardView } from './CardView';

export function RewardView({ engine }: { engine: GameEngine }) {
  const cards = engine.state.rewardCards;

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-200 p-8 items-center justify-center">
      <h1 className="text-4xl font-serif mb-12 text-yellow-400">Choose a Card</h1>
      
      <div className="flex gap-8 mb-12">
        {cards.map((card: any) => (
          <CardView 
            key={card.instanceId} 
            card={card} 
            onClick={() => engine.pickRewardCard(card.instanceId)}
          />
        ))}
      </div>

      <button 
        onClick={() => engine.skipReward()}
        className="px-8 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl border border-slate-600 transition-colors"
      >
        Skip
      </button>
    </div>
  );
}
