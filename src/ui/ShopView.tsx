import React, { useState } from 'react';
import { GameEngine } from '../engine/engine';
import { CardView } from './CardView';
import { Coins, Hammer, Trash2, FlaskConical, Sparkles } from 'lucide-react';
import relicsData from '../content/relics.json';
import potionsData from '../content/potions.json';

export function ShopView({ engine }: { engine: GameEngine }) {
  const cards = engine.state.shopCards;
  const relics = engine.state.shopRelics;
  const potions = engine.state.shopPotions;
  const player = engine.state.player;
  const canUpgrade = player.deck.some(c => !c.isUpgraded && c.upgrade) && player.gold >= 50;
  const canRemove = player.gold >= engine.state.cardRemovalCost && player.deck.length > 0;
  const [mixA, setMixA] = useState<number>(0);
  const [mixB, setMixB] = useState<number>(1);
  const potionChoices = player.potions.map((id, idx) => ({
    index: idx,
    id,
    def: (potionsData as any[]).find(p => p.id === id)
  }));
  const canMix = player.potions.length >= 2 && mixA !== mixB && player.potions[mixA] && player.potions[mixB];

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-200 p-8 items-center overflow-y-auto">
      <div className="flex justify-between w-full max-w-5xl mb-8">
        <h1 className="text-4xl font-serif text-yellow-400">Merchant</h1>
        <div className="flex items-center gap-2 text-xl text-yellow-400 bg-slate-900 px-4 py-2 rounded-xl border border-slate-700">
          <Coins /> {player.gold} Gold
        </div>
      </div>
      
      <div className="w-full max-w-5xl mb-8">
        <h2 className="text-2xl font-serif text-slate-400 mb-4 border-b border-slate-800 pb-2">Cards</h2>
        <div className="flex flex-wrap justify-center gap-6">
          {cards.map((card: any, index: number) => {
            const basePrice = card.rarity === 'Rare' ? 150 : card.rarity === 'Uncommon' ? 75 : 50;
            const price = engine.getAdjustedShopPrice(basePrice);
            const canAfford = player.gold >= price;
            
            return (
              <div key={card.instanceId} className="flex flex-col items-center gap-2">
                <CardView card={card} disabled={!canAfford} />
                <button 
                  onClick={() => engine.buyShopCard(card.instanceId, basePrice)}
                  disabled={!canAfford}
                  className={`px-4 py-1 rounded-full text-sm font-bold border flex items-center gap-1
                    ${canAfford ? 'bg-yellow-900/50 border-yellow-500 text-yellow-400 hover:bg-yellow-900' : 'bg-slate-800 border-slate-600 text-slate-500 cursor-not-allowed'}
                  `}
                >
                  <Coins size={14} /> {price}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="w-full max-w-5xl mb-8 grid grid-cols-2 gap-8">
        <div>
          <h2 className="text-2xl font-serif text-slate-400 mb-4 border-b border-slate-800 pb-2">Relics</h2>
          <div className="flex flex-col gap-4">
            {relics.map((relicId: string) => {
              const relic = relicsData.find(r => r.id === relicId);
              if (!relic) return null;
              const basePrice = relic.price;
              const price = engine.getAdjustedShopPrice(basePrice);
              const canAfford = player.gold >= price;
              return (
                <div key={relic.id} className="flex items-center justify-between bg-slate-900 p-3 rounded-xl border border-slate-700" title={`${relic.description}${(relic as any).corrupted ? ' [Corrupted Relic]' : ''}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center text-yellow-400 border border-slate-600">
                      <Sparkles size={20} />
                    </div>
                    <div>
                      <div className="font-bold text-emerald-400">{relic.name}</div>
                      <div className="text-xs text-slate-400">{relic.description}</div>
                    </div>
                  </div>
                  <button 
                    onClick={() => engine.buyShopRelic(relic.id, basePrice)}
                    disabled={!canAfford}
                    className={`px-3 py-1 rounded-full text-sm font-bold border flex items-center gap-1 shrink-0
                      ${canAfford ? 'bg-yellow-900/50 border-yellow-500 text-yellow-400 hover:bg-yellow-900' : 'bg-slate-800 border-slate-600 text-slate-500 cursor-not-allowed'}
                    `}
                  >
                    <Coins size={14} /> {price}
                  </button>
                </div>
              );
            })}
            {relics.length === 0 && <div className="text-slate-500 italic">Sold out</div>}
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-serif text-slate-400 mb-4 border-b border-slate-800 pb-2">Potions</h2>
          <div className="flex flex-col gap-4">
            {potions.map((potionId: string, index: number) => {
              const potion = potionsData.find(p => p.id === potionId);
              if (!potion) return null;
              const basePrice = potion.price;
              const price = engine.getAdjustedShopPrice(basePrice);
              const canAfford = player.gold >= price && player.potions.length < 3;
              return (
                <div key={`${potion.id}-${index}`} className="flex items-center justify-between bg-slate-900 p-3 rounded-xl border border-slate-700" title={`${potion.description} (Toxicity +${(potion as any).toxicity ?? 1})`}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center text-emerald-400 border border-slate-600">
                      <FlaskConical size={20} />
                    </div>
                    <div>
                      <div className="font-bold text-blue-400">{potion.name}</div>
                      <div className="text-xs text-slate-400">{potion.description}</div>
                    </div>
                  </div>
                  <button 
                    onClick={() => engine.buyShopPotion(potion.id, basePrice, index)}
                    disabled={!canAfford}
                    className={`px-3 py-1 rounded-full text-sm font-bold border flex items-center gap-1 shrink-0
                      ${canAfford ? 'bg-yellow-900/50 border-yellow-500 text-yellow-400 hover:bg-yellow-900' : 'bg-slate-800 border-slate-600 text-slate-500 cursor-not-allowed'}
                    `}
                  >
                    <Coins size={14} /> {price}
                  </button>
                </div>
              );
            })}
            {potions.length === 0 && <div className="text-slate-500 italic">Sold out</div>}
          </div>
        </div>
      </div>

      <div className="w-full max-w-5xl border-t border-slate-800 pt-8 mb-12 flex flex-col items-center">
        <h2 className="text-2xl font-serif text-slate-400 mb-6">Services</h2>
        <div className="flex gap-8">
          <button 
            onClick={() => engine.enterUpgrade('Shop')}
            disabled={!canUpgrade}
            className={`px-6 py-4 rounded-xl border flex items-center gap-4 transition-all w-64
              ${canUpgrade ? 'bg-slate-900 border-emerald-500 hover:bg-slate-800 cursor-pointer text-emerald-400' : 'bg-slate-900 border-slate-700 opacity-50 cursor-not-allowed text-slate-500'}
            `}
          >
            <Hammer size={24} />
            <div className="text-left">
              <div className="font-bold text-lg">Smithing</div>
              <div className="text-sm opacity-80 flex items-center gap-1"><Coins size={14}/> 50 Gold</div>
            </div>
          </button>

          <button 
            onClick={() => engine.enterCardRemoval()}
            disabled={!canRemove}
            className={`px-6 py-4 rounded-xl border flex items-center gap-4 transition-all w-64
              ${canRemove ? 'bg-slate-900 border-red-500 hover:bg-slate-800 cursor-pointer text-red-400' : 'bg-slate-900 border-slate-700 opacity-50 cursor-not-allowed text-slate-500'}
            `}
          >
            <Trash2 size={24} />
            <div className="text-left">
              <div className="font-bold text-lg">Card Removal</div>
              <div className="text-sm opacity-80 flex items-center gap-1"><Coins size={14}/> {engine.state.cardRemovalCost} Gold</div>
            </div>
          </button>
        </div>

        <div className="mt-8 w-full max-w-3xl rounded-xl border border-cyan-900/50 bg-slate-900/80 p-4">
          <div className="text-cyan-300 font-semibold mb-3 flex items-center gap-2"><FlaskConical size={16} /> Alchemical Mix</div>
          <div className="flex flex-wrap gap-3 items-end">
            <label className="text-xs text-slate-300 flex flex-col gap-1">
              <span>Potion A</span>
              <select value={mixA} onChange={e => setMixA(Number(e.target.value))} className="bg-slate-800 border border-slate-600 rounded px-2 py-1 min-w-48">
                {potionChoices.map(p => <option key={`shop_a_${p.index}`} value={p.index}>{p.def?.name || p.id}</option>)}
              </select>
            </label>
            <label className="text-xs text-slate-300 flex flex-col gap-1">
              <span>Potion B</span>
              <select value={mixB} onChange={e => setMixB(Number(e.target.value))} className="bg-slate-800 border border-slate-600 rounded px-2 py-1 min-w-48">
                {potionChoices.map(p => <option key={`shop_b_${p.index}`} value={p.index}>{p.def?.name || p.id}</option>)}
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
              className={`px-4 py-2 rounded-lg border text-sm font-bold ${canMix ? 'bg-cyan-900/40 border-cyan-500 text-cyan-300 hover:bg-cyan-900/60' : 'bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed'}`}
            >
              Distill
            </button>
          </div>
          <div className="mt-2 text-xs text-slate-400">Mixing consumes two potions and returns an advanced concoction.</div>
        </div>
      </div>

      <button 
        onClick={() => { engine.state.screen = 'Map'; engine.notify(); }}
        className="px-8 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl border border-slate-600 transition-colors mt-auto"
      >
        Leave Shop
      </button>
    </div>
  );
}
