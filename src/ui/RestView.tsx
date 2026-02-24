import React, { useState } from 'react';
import { GameEngine } from '../engine/engine';
import { Flame, Heart, Hammer, FlaskConical, Sparkles } from 'lucide-react';
import potionsData from '../content/potions.json';

export function RestView({ engine }: { engine: GameEngine }) {
  const player = engine.state.player;
  const healAmount = Math.floor(player.maxHp * 0.3);
  const canHeal = player.hp < player.maxHp;
  const canUpgrade = player.deck.some(c => !c.isUpgraded && c.upgrade);
  const [mixA, setMixA] = useState<number>(0);
  const [mixB, setMixB] = useState<number>(1);
  const potionChoices = player.potions.map((id, idx) => ({
    index: idx,
    id,
    def: (potionsData as any[]).find(p => p.id === id)
  }));
  const canMix = player.potions.length >= 2 && mixA !== mixB && player.potions[mixA] && player.potions[mixB];

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-200 p-8 items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none">
        <Flame size={400} className="text-orange-500 animate-pulse" />
      </div>

      <h1 className="text-4xl font-serif text-orange-400 mb-12 z-10">Campfire</h1>
      
      <div className="flex gap-8 z-10">
        <button 
          onClick={() => engine.restHeal()}
          disabled={!canHeal}
          className={`w-48 h-48 rounded-2xl border-2 flex flex-col items-center justify-center gap-4 transition-all
            ${canHeal ? 'bg-slate-900 border-orange-500 hover:bg-slate-800 hover:scale-105 cursor-pointer' : 'bg-slate-900 border-slate-700 opacity-50 cursor-not-allowed'}
          `}
        >
          <Heart size={48} className={canHeal ? "text-red-400" : "text-slate-500"} />
          <div className="text-xl font-bold">Rest</div>
          <div className="text-sm text-slate-400">Heal {healAmount} HP</div>
        </button>

        <button 
          onClick={() => engine.enterUpgrade()}
          disabled={!canUpgrade}
          className={`w-48 h-48 rounded-2xl border-2 flex flex-col items-center justify-center gap-4 transition-all
            ${canUpgrade ? 'bg-slate-900 border-emerald-500 hover:bg-slate-800 hover:scale-105 cursor-pointer' : 'bg-slate-900 border-slate-700 opacity-50 cursor-not-allowed'}
          `}
        >
          <Hammer size={48} className={canUpgrade ? "text-emerald-400" : "text-slate-500"} />
          <div className="text-xl font-bold">Smith</div>
          <div className="text-sm text-slate-400">Upgrade a Card</div>
        </button>
      </div>

      <div className="z-10 mt-10 w-full max-w-4xl rounded-2xl border border-emerald-800/60 bg-slate-900/90 p-6 shadow-2xl">
        <div className="flex items-center gap-2 text-emerald-300 mb-4">
          <FlaskConical size={18} />
          <h2 className="text-xl font-bold">Alchemical Mix</h2>
          <span className="text-xs text-slate-400">Combine 2 potions into a mutagenic brew</span>
        </div>

        <div className="flex flex-wrap gap-4 items-end">
          <label className="flex flex-col gap-2 text-sm text-slate-300">
            <span>First Potion</span>
            <select
              value={mixA}
              onChange={e => setMixA(Number(e.target.value))}
              className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 min-w-56"
            >
              {potionChoices.map(p => (
                <option key={`a_${p.index}`} value={p.index}>
                  {p.def?.name || p.id}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-2 text-sm text-slate-300">
            <span>Second Potion</span>
            <select
              value={mixB}
              onChange={e => setMixB(Number(e.target.value))}
              className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 min-w-56"
            >
              {potionChoices.map(p => (
                <option key={`b_${p.index}`} value={p.index}>
                  {p.def?.name || p.id}
                </option>
              ))}
            </select>
          </label>

          <button
            onClick={() => {
              if (engine.mixPotions(mixA, mixB)) {
                setMixA(0);
                setMixB(0);
                engine.notify();
              }
            }}
            disabled={!canMix}
            className={`px-5 py-2 rounded-xl border font-bold flex items-center gap-2 ${
              canMix
                ? 'bg-emerald-900/40 border-emerald-500 text-emerald-300 hover:bg-emerald-900/60'
                : 'bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed'
            }`}
          >
            <Sparkles size={16} /> Distill Mix
          </button>
        </div>

        <div className="mt-4 text-xs text-slate-400">
          Inventory: {player.potions.length}/3 potions. Mixing consumes two and returns one advanced draft.
        </div>
      </div>
    </div>
  );
}
