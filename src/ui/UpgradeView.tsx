import React from 'react';
import { GameEngine } from '../engine/engine';
import { CardView } from './CardView';

export function UpgradeView({ engine }: { engine: GameEngine }) {
  const deck = engine.state.player.deck;
  const upgradableCards = deck.filter(c => !c.isUpgraded && c.upgrade);

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-200 p-8 items-center overflow-y-auto">
      <h1 className="text-4xl font-serif text-emerald-400 mb-8">Select a Card to Upgrade</h1>
      
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
          <div className="text-slate-500 text-xl">No upgradable cards in your deck.</div>
        )}
      </div>

      <button 
        onClick={() => engine.cancelUpgrade()}
        className="px-8 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl border border-slate-600 transition-colors mt-auto"
      >
        Cancel
      </button>
    </div>
  );
}
