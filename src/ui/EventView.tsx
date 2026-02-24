import React from 'react';
import { GameEngine } from '../engine/engine';
import relicsData from '../content/relics.json';

export function EventView({ engine }: { engine: GameEngine }) {
  const event = engine.state.activeEvent;
  if (!event) {
    return (
      <div className="flex flex-col h-full bg-slate-950 text-slate-200 p-8 items-center justify-center max-w-2xl mx-auto">
        <div className="text-2xl text-slate-300 mb-4">No Event</div>
        <button onClick={() => { engine.state.screen = 'Map'; engine.notify(); }} className="px-6 py-3 bg-slate-800 rounded-xl border border-slate-600">
          Return to Map
        </button>
      </div>
    );
  }

  if (event.id === 'heretic_altar') {
    const relic = (relicsData as any[]).find(r => r.id === event.offeredRelicId);
    return (
      <div className="flex flex-col h-full bg-slate-950 text-slate-200 p-8 items-center justify-center max-w-3xl mx-auto">
        <h1 className="text-4xl font-serif text-red-400 mb-8">Heretic Altar</h1>

        <div className="bg-slate-900 border border-red-900/60 rounded-xl p-8 mb-8 text-lg leading-relaxed shadow-2xl">
          A rusted altar hums with warp static. A relic rests within a circle of blood and ash.
          Accepting it will brand your deck with corruption.
        </div>

        {relic && (
          <div className="w-full bg-slate-900/90 border border-slate-700 rounded-xl p-4 mb-6">
            <div className="text-xl font-bold text-red-300">{relic.name}</div>
            <div className="text-sm text-slate-300 mt-1">{relic.description}</div>
            <div className="text-xs text-red-200/80 mt-2">
              Cost of corruption: +1 Curse on pickup{relic.effect?.maxHpPenalty ? `, -${relic.effect.maxHpPenalty} Max HP` : ''}.
            </div>
          </div>
        )}

        <div className="flex flex-col gap-4 w-full">
          <button
            onClick={() => engine.resolveEventChoice('accept_corruption')}
            className="w-full p-4 bg-red-950/50 hover:bg-red-900/50 rounded-xl border border-red-700 flex justify-between items-center transition-colors"
          >
            <span className="font-bold">Accept the Relic</span>
            <span className="text-red-300 text-sm">Embrace corruption</span>
          </button>

          <button
            onClick={() => engine.resolveEventChoice('refuse')}
            className="w-full p-4 bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-600 flex justify-between items-center transition-colors"
          >
            <span className="font-bold">Refuse</span>
            <span className="text-slate-400 text-sm">Leave the altar untouched</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-200 p-8 items-center justify-center max-w-2xl mx-auto">
      <h1 className="text-4xl font-serif text-blue-400 mb-8">Mysterious Shrine</h1>
      
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-8 mb-8 text-lg leading-relaxed shadow-2xl">
        You come across an ancient shrine glowing with a faint blue light. 
        A voice echoes in your mind, offering you a choice.
      </div>

      <div className="flex flex-col gap-4 w-full">
        <button 
          onClick={() => engine.resolveEventChoice('pray')}
          className="w-full p-4 bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-600 flex justify-between items-center transition-colors"
        >
          <span className="font-bold">Pray</span>
          <span className="text-emerald-400 text-sm">Gain 10 Max HP</span>
        </button>
        
        <button 
          onClick={() => engine.resolveEventChoice('leave')}
          className="w-full p-4 bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-600 flex justify-between items-center transition-colors"
        >
          <span className="font-bold">Leave</span>
          <span className="text-slate-400 text-sm">Nothing happens</span>
        </button>
      </div>
    </div>
  );
}
