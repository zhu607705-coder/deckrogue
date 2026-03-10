import React, { useState } from 'react';
import { GameEngine } from '@/core';
import { CardView } from '@/ui/views/CardView';
import { Coins, Hammer, Trash2, FlaskConical } from 'lucide-react';
import { getPotionRuntimeConfig, potionsData, relicsData } from '@/content/narrative/numericSystem';
import worldLoreData from '@/content/data/worldLore.json';
import { ASSET_PLACEHOLDERS, bindImgFallback } from '@/ui/components/assetHelpers';
import { BackgroundImage, VIEW_BACKGROUNDS } from '@/ui/components/BackgroundImage';
import { systemRandomInt } from '@/infrastructure/rng/systemRandom';

export function ShopView({ engine }: { engine: GameEngine }) {
  const potionRuntime = getPotionRuntimeConfig();
  const WORLD_LORE = worldLoreData as any;
  const cards = engine.state.shopCards;
  const relics = engine.state.shopRelics;
  const potions = engine.state.shopPotions;
  const player = engine.state.player;
  const canUpgrade = player.deck.some(c => !c.isUpgraded && c.upgrade) && player.gold >= 50;
  const canRemove = player.gold >= engine.state.cardRemovalCost && player.deck.length > 0;
  const [mixA, setMixA] = useState<number>(0);
  const [mixB, setMixB] = useState<number>(Math.min(1, Math.max(0, player.potions.length - 1)));
  const potionChoices = player.potions.map((id, idx) => ({
    index: idx,
    id,
    def: (potionsData as any[]).find(p => p.id === id)
  }));
  const canMix = player.potions.length >= 2 && mixA !== mixB && player.potions[mixA] && player.potions[mixB];
  const relicIconSrc = (id: string) => `/assets/relics/${id}.png`;
  const potionIconSrc = (id: string) => `/assets/potions/${id}.png`;
  
  const [backgroundIndex] = useState(() => systemRandomInt(VIEW_BACKGROUNDS.shop.length));
  const backgroundSrc = VIEW_BACKGROUNDS.shop[backgroundIndex].desktop;
  const merchantImage = '/assets/shop/shop_merchant.png';
  const [merchantLine] = useState(() => {
    const lines = (WORLD_LORE?.npcDialogueTemplates?.merchant || []) as string[];
    if (!lines.length) return '货在这，命也在这。风险自负。';
    return lines[systemRandomInt(lines.length)];
  });

  return (
    <BackgroundImage 
      src={backgroundSrc} 
      className="flex flex-col h-full text-slate-200 p-8 items-center overflow-y-auto"
      overlayOpacity={0.6}
    >
      <div className="relative z-10 flex flex-col h-full w-full items-center">
      <div className="absolute top-3 right-3 w-16 h-16 sm:top-4 sm:right-4 sm:w-24 sm:h-24 lg:w-32 lg:h-32 rounded-full border-4 border-yellow-600/50 overflow-hidden shadow-2xl bg-slate-900/80">
        <img
          src={merchantImage}
          alt="Merchant"
          className="w-full h-full object-cover object-center"
          onError={(e) => bindImgFallback(e, ASSET_PLACEHOLDERS.merchant)}
        />
      </div>
      
      <div className="mb-8 flex items-center justify-between w-full max-w-5xl sticky top-0 bg-slate-950/80 backdrop-blur-md p-4 z-10 rounded-2xl border border-slate-800 shadow-xl">
        <div className="text-3xl font-bold font-serif flex items-center gap-4">
          <span className="text-yellow-400">黑市拾荒者</span>
        </div>
        <div className="flex items-center gap-2 text-yellow-400 bg-slate-900/80 px-4 py-2 rounded-full border border-yellow-900/50 shadow-inner">
          <Coins size={18} className="text-yellow-400" />
          <span className="font-bold">{player.gold}</span>
          <span className="text-slate-500 text-sm">信用筹码</span>
        </div>
      </div>
      <div className="w-full max-w-5xl mb-6 rounded-xl border border-yellow-900/40 bg-slate-950/65 px-4 py-3 text-sm leading-6 text-yellow-100/75">
        {WORLD_LORE?.viewAtmosphere?.Shop}
      </div>
      <div className="w-full max-w-5xl mb-6 rounded-xl border border-yellow-700/30 bg-yellow-950/10 px-4 py-3 text-sm leading-6 text-yellow-100/85 italic">
        “{merchantLine}”
      </div>
      
      <div className="w-full max-w-5xl mb-8 bg-slate-900/50 p-6 rounded-2xl border border-slate-800 shadow-xl">
        <h2 className="text-2xl font-serif text-yellow-400 mb-6 pb-2 border-b border-slate-700">记忆印痕</h2>
        <div className="flex flex-wrap justify-center gap-6">
          {cards.map((card: any, index: number) => {
            const basePrice = card.rarity === 'Rare' ? 150 : card.rarity === 'Uncommon' ? 75 : 50;
            const price = engine.getAdjustedShopPrice(basePrice);
            const canAfford = player.gold >= price;
            
            return (
              <div key={card.instanceId} className="flex flex-col items-center gap-3 group">
                <CardView card={card} disabled={!canAfford} />
                <button 
                  onClick={() => engine.buyShopCard(card.instanceId, basePrice)}
                  disabled={!canAfford}
                  className={`px-5 py-2 rounded-full text-sm font-bold border-2 flex items-center gap-2 transition-all duration-300 shadow-lg
                    ${canAfford ? 'bg-yellow-900/60 border-yellow-500 text-yellow-400 hover:bg-yellow-900 hover:scale-105 hover:shadow-[0_0_20px_rgba(234,179,8,0.3)]' : 'bg-slate-800 border-slate-600 text-slate-500 cursor-not-allowed opacity-60'}
                  `}
                >
                  <Coins size={16} /> {price}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="w-full max-w-5xl mb-8 grid grid-cols-2 gap-8">
        <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 shadow-xl">
          <h2 className="text-2xl font-serif text-emerald-400 mb-6 pb-2 border-b border-slate-700">遗物</h2>
          <div className="flex flex-col gap-4">
            {relics.map((relicId: string) => {
              const relic = relicsData.find(r => r.id === relicId);
              if (!relic) return null;
              const basePrice = relic.price;
              const price = engine.getAdjustedShopPrice(basePrice);
              const canAfford = player.gold >= price;
              return (
                <div key={relic.id} className="flex items-center justify-between bg-slate-800/80 p-4 rounded-xl border border-slate-700 hover:border-emerald-500/50 transition-all duration-300 group" title={`${relic.description}${(relic as any).inscription ? `\n铭文：${(relic as any).inscription}` : ''}${(relic as any).flavorText ? `\n遗言：${(relic as any).flavorText}` : ''}${(relic as any).corrupted ? ' [Corrupted Relic]' : ''}`}>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-slate-700 rounded-xl flex items-center justify-center text-yellow-400 border-2 border-yellow-500/30 overflow-hidden group-hover:scale-110 transition-transform duration-300 shadow-lg">
                      <img
                        src={relicIconSrc(relic.id)}
                        alt={relic.name}
                        className="w-10 h-10 object-cover rounded-lg"
                        onError={(e) => bindImgFallback(e, ASSET_PLACEHOLDERS.relic)}
                      />
                    </div>
                    <div>
                      <div className="font-bold text-emerald-400 text-lg">{relic.name}</div>
                      <div className="text-sm text-slate-400">{relic.description}</div>
                      {(relic as any).inscription && (
                        <div className="text-[11px] text-slate-500 mt-1 line-clamp-1">铭文：{(relic as any).inscription}</div>
                      )}
                      {(relic as any).flavorText && (
                        <div className="text-[11px] italic text-emerald-200/70 mt-0.5 line-clamp-1">“{String((relic as any).flavorText).replace(/^“|”$/g, '')}”</div>
                      )}
                    </div>
                  </div>
                  <button 
                    onClick={() => engine.buyShopRelic(relic.id, basePrice)}
                    disabled={!canAfford}
                    className={`px-4 py-2 rounded-full text-sm font-bold border-2 flex items-center gap-2 shrink-0 transition-all duration-300 shadow-lg
                      ${canAfford ? 'bg-yellow-900/60 border-yellow-500 text-yellow-400 hover:bg-yellow-900 hover:scale-105 hover:shadow-[0_0_15px_rgba(234,179,8,0.4)]' : 'bg-slate-800 border-slate-600 text-slate-500 cursor-not-allowed opacity-60'}
                    `}
                  >
                    <Coins size={16} /> {price}
                  </button>
                </div>
              );
            })}
            {relics.length === 0 && <div className="text-slate-500 italic text-center py-4">库存售罄</div>}
          </div>
        </div>

        <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 shadow-xl">
          <h2 className="text-2xl font-serif text-blue-400 mb-6 pb-2 border-b border-slate-700">药剂</h2>
          <div className="flex flex-col gap-4">
            {potions.map((potionId: string, index: number) => {
              const potion = potionsData.find(p => p.id === potionId);
              if (!potion) return null;
              const basePrice = potion.price;
              const price = engine.getAdjustedShopPrice(basePrice);
              const canAfford = player.gold >= price && player.potions.length < potionRuntime.slotLimit;
              return (
                <div key={`${potion.id}-${index}`} className="flex items-center justify-between bg-slate-800/80 p-4 rounded-xl border border-slate-700 hover:border-blue-500/50 transition-all duration-300 group" title={`${potion.description} (Toxicity +${(potion as any).toxicity ?? 1})`}>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-slate-700 rounded-xl flex items-center justify-center text-blue-400 border-2 border-blue-500/30 overflow-hidden group-hover:scale-110 transition-transform duration-300 shadow-lg">
                      <img
                        src={potionIconSrc(potion.id)}
                        alt={potion.name}
                        className="w-10 h-10 object-cover rounded-lg"
                        onError={(e) => bindImgFallback(e, ASSET_PLACEHOLDERS.potion)}
                      />
                    </div>
                    <div>
                      <div className="font-bold text-blue-400 text-lg">{potion.name}</div>
                      <div className="text-sm text-slate-400">{potion.description}</div>
                    </div>
                  </div>
                  <button 
                    onClick={() => engine.buyShopPotion(potion.id, basePrice, index)}
                    disabled={!canAfford}
                    className={`px-4 py-2 rounded-full text-sm font-bold border-2 flex items-center gap-2 shrink-0 transition-all duration-300 shadow-lg
                      ${canAfford ? 'bg-yellow-900/60 border-yellow-500 text-yellow-400 hover:bg-yellow-900 hover:scale-105 hover:shadow-[0_0_15px_rgba(234,179,8,0.4)]' : 'bg-slate-800 border-slate-600 text-slate-500 cursor-not-allowed opacity-60'}
                    `}
                  >
                    <Coins size={16} /> {price}
                  </button>
                </div>
              );
            })}
            {potions.length === 0 && <div className="text-slate-500 italic text-center py-4">库存售罄</div>}
          </div>
        </div>
      </div>

      <div className="w-full max-w-5xl bg-slate-900/50 p-6 rounded-2xl border border-slate-800 shadow-xl mb-12">
        <h2 className="text-2xl font-serif text-slate-300 mb-6 pb-2 border-b border-slate-700">服务</h2>
        <div className="flex gap-6 justify-center flex-wrap">
          <button 
            onClick={() => engine.enterUpgrade('Shop')}
            disabled={!canUpgrade}
            className={`px-6 py-5 rounded-2xl border-2 flex items-center gap-4 transition-all w-64 shadow-lg
              ${canUpgrade ? 'bg-slate-800 border-emerald-500 hover:bg-slate-700 hover:scale-105 cursor-pointer text-emerald-400 hover:shadow-[0_0_20px_rgba(16,185,129,0.3)]' : 'bg-slate-800 border-slate-700 opacity-50 cursor-not-allowed text-slate-500'}
            `}
          >
            <Hammer size={28} />
            <div className="text-left">
              <div className="font-bold text-lg">锻造强化</div>
              <div className="text-sm opacity-80 flex items-center gap-1"><Coins size={16}/> 50 信用筹码</div>
            </div>
          </button>

          <button 
            onClick={() => engine.enterCardRemoval()}
            disabled={!canRemove}
            className={`px-6 py-5 rounded-2xl border-2 flex items-center gap-4 transition-all w-64 shadow-lg
              ${canRemove ? 'bg-slate-800 border-red-500 hover:bg-slate-700 hover:scale-105 cursor-pointer text-red-400 hover:shadow-[0_0_20px_rgba(239,68,68,0.3)]' : 'bg-slate-800 border-slate-700 opacity-50 cursor-not-allowed text-slate-500'}
            `}
          >
            <Trash2 size={28} />
            <div className="text-left">
              <div className="font-bold text-lg">焚毁记忆印痕</div>
              <div className="text-sm opacity-80 flex items-center gap-1"><Coins size={16}/> {engine.state.cardRemovalCost} 信用筹码</div>
            </div>
          </button>
        </div>

        <div className="mt-8 w-full max-w-3xl mx-auto rounded-2xl border border-cyan-900/50 bg-slate-800/80 p-6 shadow-lg">
          <div className="text-cyan-300 font-bold mb-4 flex items-center gap-2 text-lg"><FlaskConical size={20} /> 炼金调和</div>
          <div className="flex flex-wrap gap-4 items-end">
            <label className="text-sm text-slate-300 flex flex-col gap-2">
              <span className="font-medium">药剂 A</span>
              <select value={mixA} onChange={e => setMixA(Number(e.target.value))} className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 min-w-52">
                {potionChoices.map(p => <option key={`shop_a_${p.index}`} value={p.index}>{p.def?.name || p.id}</option>)}
              </select>
            </label>
            <label className="text-sm text-slate-300 flex flex-col gap-2">
              <span className="font-medium">药剂 B</span>
              <select value={mixB} onChange={e => setMixB(Number(e.target.value))} className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 min-w-52">
                {potionChoices.map(p => <option key={`shop_b_${p.index}`} value={p.index}>{p.def?.name || p.id}</option>)}
              </select>
            </label>
            <button
              onClick={() => {
                if (engine.mixPotions(mixA, mixB)) {
                  setMixA(0);
                  setMixB(0);
                }
              }}
              disabled={!canMix}
              className={`px-6 py-3 rounded-xl border-2 text-sm font-bold transition-all duration-300 shadow-lg ${canMix ? 'bg-cyan-900/50 border-cyan-500 text-cyan-300 hover:bg-cyan-900/70 hover:scale-105 hover:shadow-[0_0_20px_rgba(6,182,212,0.3)]' : 'bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed'}`}
            >
              蒸馏
            </button>
          </div>
          <div className="mt-3 text-sm text-slate-400">调和会消耗两瓶药剂，并返还一瓶更危险的配方。</div>
        </div>
      </div>

      <button 
        onClick={() => engine.leaveCurrentRoomToMap()}
        className="px-10 py-4 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl border-2 border-slate-600 hover:border-slate-500 transition-all duration-300 shadow-lg hover:scale-105 mt-auto"
      >
        离开据点
      </button>
      </div>
    </BackgroundImage>
  );
}
