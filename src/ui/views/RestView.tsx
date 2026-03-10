import React, { useState } from 'react';
import { GameEngine } from '@/core';
import { Flame, Heart, Hammer, FlaskConical, Sparkles } from 'lucide-react';
import { potionsData } from '@/content/narrative/numericSystem';
import { BackgroundImage, VIEW_BACKGROUNDS } from '@/ui/components/BackgroundImage';
import { systemRandomInt } from '@/infrastructure/rng/systemRandom';
import worldLoreData from '@/content/data/worldLore.json';

export function RestView({ engine }: { engine: GameEngine }) {
  const WORLD_LORE = worldLoreData as any;
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
  
  const [backgroundIndex] = useState(() => systemRandomInt(VIEW_BACKGROUNDS.rest.length));
  const backgroundSrc = VIEW_BACKGROUNDS.rest[backgroundIndex].desktop;

  return (
    <BackgroundImage 
      src={backgroundSrc} 
      className="flex flex-col h-full text-slate-200 p-8 items-center justify-center"
      overlayOpacity={0.55}
    >
      <div className="absolute inset-0 flex items-center justify-center opacity-15 pointer-events-none">
        <Flame size={400} className="text-orange-500 animate-pulse" />
      </div>
      <div className="relative z-10 flex flex-col items-center">

      <h1 className="text-4xl font-serif text-orange-400 mb-4 drop-shadow-lg">篝火据点</h1>
      <div className="max-w-3xl text-center text-sm leading-6 text-orange-100/80 mb-8 px-4">
        {WORLD_LORE?.viewAtmosphere?.Rest}
      </div>
      
      <div className="flex gap-8">
        <button 
          onClick={() => engine.restHeal()}
          disabled={!canHeal}
          className={`w-48 h-48 rounded-2xl border-2 flex flex-col items-center justify-center gap-4 transition-all backdrop-blur-sm
            ${canHeal ? 'bg-slate-900/80 border-orange-500 hover:bg-slate-800/80 hover:scale-105 cursor-pointer' : 'bg-slate-900/80 border-slate-700 opacity-50 cursor-not-allowed'}
          `}
        >
          <Heart size={48} className={canHeal ? "text-red-400" : "text-slate-500"} />
          <div className="text-xl font-bold">休整</div>
          <div className="text-sm text-slate-400">恢复 {healAmount} 点肉体承载力</div>
        </button>

        <button 
          onClick={() => engine.enterUpgrade()}
          disabled={!canUpgrade}
          className={`w-48 h-48 rounded-2xl border-2 flex flex-col items-center justify-center gap-4 transition-all backdrop-blur-sm
            ${canUpgrade ? 'bg-slate-900/80 border-emerald-500 hover:bg-slate-800/80 hover:scale-105 cursor-pointer' : 'bg-slate-900/80 border-slate-700 opacity-50 cursor-not-allowed'}
          `}
        >
          <Hammer size={48} className={canUpgrade ? "text-emerald-400" : "text-slate-500"} />
          <div className="text-xl font-bold">锻造</div>
          <div className="text-sm text-slate-400">强化一张记忆印痕</div>
        </button>
      </div>

      <div className="mt-10 w-full max-w-4xl rounded-2xl border border-emerald-800/60 bg-slate-900/90 p-6 shadow-2xl backdrop-blur-sm">
        <div className="flex items-center gap-2 text-emerald-300 mb-4">
          <FlaskConical size={18} />
          <h2 className="text-xl font-bold">炼金调和</h2>
          <span className="text-xs text-slate-400">将两瓶药剂蒸馏为更危险的配方</span>
        </div>

        <div className="flex flex-wrap gap-4 items-end">
          <label className="flex flex-col gap-2 text-sm text-slate-300">
            <span>药剂 A</span>
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
            <span>药剂 B</span>
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
              }
            }}
            disabled={!canMix}
            className={`px-5 py-2 rounded-xl border font-bold flex items-center gap-2 ${
              canMix
                ? 'bg-emerald-900/40 border-emerald-500 text-emerald-300 hover:bg-emerald-900/60'
                : 'bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed'
            }`}
          >
            <Sparkles size={16} /> 蒸馏配方
          </button>
        </div>

        <div className="mt-4 text-xs text-slate-400">
          药剂库存：{player.potions.length}/3。调和会消耗两瓶并返还一瓶进阶配方。
        </div>
      </div>
      </div>
    </BackgroundImage>
  );
}
