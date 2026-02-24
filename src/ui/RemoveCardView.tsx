import React from 'react';
import { GameEngine } from '../engine/engine';
import { CardView } from './CardView';

export function RemoveCardView({ engine }: { engine: GameEngine }) {
  const player = engine.state.player;

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-200 p-8">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-serif text-red-400 mb-2">Remove a Card</h1>
        <p className="text-slate-400">Select a card to permanently remove from your deck.</p>
        <p className="text-yellow-400 mt-2">Cost: {engine.state.cardRemovalCost} Gold</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-wrap gap-4 justify-center max-w-5xl mx-auto">
          {player.deck.map((card: any) => (
            <div key={card.instanceId} className="relative group">
              <CardView card={card} onClick={() => engine.removeCard(card.instanceId)} />
              <div className="absolute inset-0 bg-red-900/0 group-hover:bg-red-900/50 transition-colors rounded-xl pointer-events-none flex items-center justify-center">
                <span className="opacity-0 group-hover:opacity-100 text-white font-bold text-xl drop-shadow-md">Remove</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8 flex justify-center">
        <button 
          onClick={() => {
            engine.state.screen = 'Shop';
            engine.notify();
          }}
          className="px-8 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl border border-slate-600 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
