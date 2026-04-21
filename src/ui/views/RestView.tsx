import React, { useState } from 'react';
import { GameEngine } from '@/core';
import type { RenderModel } from '@/runtimeV2';
import { Flame, Heart, Hammer, FlaskConical, Sparkles, Skull, Gem } from 'lucide-react';
import { potionsData, relicsData } from '@/content/narrative/numericSystem';
import { BackgroundImage, VIEW_BACKGROUNDS } from '@/ui/components/BackgroundImage';
import { systemRandomInt } from '@/infrastructure/rng/systemRandom';
import { RELIC_UPGRADE_CONFIGS } from '@/core/relic/RelicUpgrade';
import { uiWorldLore } from '@/ui/content/worldLore';
import { buildRestRouteAdvice, type RestActionId } from '@/ui/views/restRouteAdvisor';

export function RestView({ engine, renderModel }: { engine: GameEngine; renderModel?: RenderModel | null }) {
  const WORLD_LORE = uiWorldLore as any;
  const player = engine.state.player;
  const roomSummary = renderModel?.room?.kind === 'rest' ? renderModel.room : null;
  const healAmount = roomSummary?.healAmount ?? Math.floor(player.maxHp * 0.3);
  const canHeal = roomSummary?.canHeal ?? (player.hp < player.maxHp);
  const canUpgrade = roomSummary?.canUpgrade ?? player.deck.some(c => !c.isUpgraded && c.upgrade);
  const canEnchant = roomSummary?.canEnchant ?? player.deck.some(c => (c.type === 'Attack' || c.type === 'Skill') && (!(c as any).persistentEnchantments || (c as any).persistentEnchantments.length === 0));
  const canUpgradeRelic = RELIC_UPGRADE_CONFIGS.some(config => player.relics.includes(config.relicId));
  const [mixA, setMixA] = useState<number>(0);
  const [mixB, setMixB] = useState<number>(1);
  const potionChoices = player.potions.map((id, idx) => ({
    index: idx,
    id,
    def: (potionsData as any[]).find(p => p.id === id)
  }));
  const canMix = (roomSummary?.canMix ?? (player.potions.length >= 2)) && mixA !== mixB && player.potions[mixA] && player.potions[mixB];
  const restRouteAdvice = buildRestRouteAdvice({
    characterId: engine.state.character?.id,
    deck: player.deck,
    routeState: engine.state.routeState ?? null,
    relicIds: player.relics,
    currentHp: player.hp,
    maxHp: player.maxHp,
    canHeal,
    canUpgrade,
    canEnchant,
    canUpgradeRelic,
  });
  const hintFor = (action: RestActionId) => restRouteAdvice.actionHints[action];

  const [backgroundIndex] = useState(() =>
    VIEW_BACKGROUNDS.rest.length > 0 ? systemRandomInt(VIEW_BACKGROUNDS.rest.length) : 0
  );
  const backgroundSrc = VIEW_BACKGROUNDS.rest[backgroundIndex]?.desktop || '';

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
      {restRouteAdvice.primaryAction && (
        <div className="mb-8 rounded-full border border-orange-400/30 bg-slate-950/45 px-5 py-2 text-sm text-orange-100">
          当前路线：{restRouteAdvice.preferredRouteLabel || '未成型'} · 推荐先做
          <span className="mx-1 font-semibold text-orange-300">
            {restRouteAdvice.primaryAction === 'upgrade' ? '锻造' :
              restRouteAdvice.primaryAction === 'enchant' ? '刻写附魔' :
              restRouteAdvice.primaryAction === 'relic_upgrade' ? '遗物升级' :
              restRouteAdvice.primaryAction === 'heal' ? '休整' : '驱散'}
          </span>
          · {hintFor(restRouteAdvice.primaryAction)?.reason}
        </div>
      )}

      <div className="flex gap-8">
        <button
          onClick={() => engine.restHeal()}
          disabled={!canHeal}
          className={`w-48 h-48 rounded-2xl border-2 flex flex-col items-center justify-center gap-4 transition-all backdrop-blur-sm
            ${canHeal ? 'bg-slate-900/80 border-orange-500 hover:bg-slate-800/80 hover:scale-105 cursor-pointer' : 'bg-slate-900/80 border-slate-700 opacity-50 cursor-not-allowed'}
          `}
          data-keyboard-option="1"
          data-keyboard-focus="true"
        >
          <Heart size={48} className={canHeal ? "text-red-400" : "text-slate-500"} />
          <div className="text-xl font-bold">休整</div>
          {hintFor('heal') && (
            <div className="rounded-full border border-red-400/30 bg-red-900/30 px-3 py-1 text-xs font-semibold text-red-200">
              {hintFor('heal')!.reason}
            </div>
          )}
          <div className="text-sm text-slate-400">恢复 {healAmount} 点生命值</div>
        </button>

        <button
          onClick={() => engine.enterUpgrade()}
          disabled={!canUpgrade}
          className={`w-48 h-48 rounded-2xl border-2 flex flex-col items-center justify-center gap-4 transition-all backdrop-blur-sm
            ${canUpgrade ? 'bg-slate-900/80 border-emerald-500 hover:bg-slate-800/80 hover:scale-105 cursor-pointer' : 'bg-slate-900/80 border-slate-700 opacity-50 cursor-not-allowed'}
          `}
          data-keyboard-option="2"
          data-keyboard-focus="true"
        >
          <Hammer size={48} className={canUpgrade ? "text-emerald-400" : "text-slate-500"} />
          <div className="text-xl font-bold">锻造</div>
          {hintFor('upgrade') && (
            <div className="rounded-full border border-emerald-400/30 bg-emerald-900/30 px-3 py-1 text-xs font-semibold text-emerald-200">
              当前路线强化：{hintFor('upgrade')!.routeLabel}
            </div>
          )}
          <div className="text-sm text-slate-400">强化一张记忆印痕</div>
        </button>

        <button
          onClick={() => engine.restEnchant()}
          disabled={!canEnchant}
          className={`w-48 h-48 rounded-2xl border-2 flex flex-col items-center justify-center gap-4 transition-all backdrop-blur-sm
            ${canEnchant
              ? 'bg-slate-900/80 border-amber-500 hover:bg-slate-800/80 hover:scale-105 cursor-pointer'
              : 'bg-slate-900/80 border-slate-700 opacity-50 cursor-not-allowed'}
          `}
          data-keyboard-option="3"
          data-keyboard-focus="true"
        >
          <Sparkles size={48} className={canEnchant ? "text-amber-300" : "text-slate-500"} />
          <div className="text-xl font-bold">刻写附魔</div>
          {hintFor('enchant') && (
            <div className="rounded-full border border-amber-400/30 bg-amber-900/30 px-3 py-1 text-xs font-semibold text-amber-100">
              当前路线强化：{hintFor('enchant')!.routeLabel}
            </div>
          )}
          <div className="text-sm text-slate-400">为一张牌追加局内强化</div>
        </button>

        <button
          onClick={() => engine.restDisperse()}
          disabled={!player.relics.some((r: string) => {
            const relic = (relicsData as any[]).find((rel: any) => rel.id === r);
            return relic?.corrupted;
          })}
          className={`w-48 h-48 rounded-2xl border-2 flex flex-col items-center justify-center gap-4 transition-all backdrop-blur-sm
            ${player.relics.some((r: string) => {
              const relic = (relicsData as any[]).find((rel: any) => rel.id === r);
              return relic?.corrupted;
            })
              ? 'bg-slate-900/80 border-purple-500 hover:bg-slate-800/80 hover:scale-105 cursor-pointer'
              : 'bg-slate-900/80 border-slate-700 opacity-50 cursor-not-allowed'}
          `}
          data-keyboard-option="4"
          data-keyboard-focus="true"
        >
          <Skull size={48} className={player.relics.some((r: string) => {
            const relic = (relicsData as any[]).find((rel: any) => rel.id === r);
            return relic?.corrupted;
          }) ? "text-purple-400" : "text-slate-500"} />
          <div className="text-xl font-bold">驱散</div>
          <div className="text-sm text-slate-400">随机移除一个腐化遗物</div>
        </button>

        <button
          onClick={() => engine.restUpgradeRelic()}
          disabled={!canUpgradeRelic}
          className={`w-48 h-48 rounded-2xl border-2 flex flex-col items-center justify-center gap-4 transition-all backdrop-blur-sm
            ${canUpgradeRelic
              ? 'bg-slate-900/80 border-yellow-500 hover:bg-slate-800/80 hover:scale-105 cursor-pointer'
              : 'bg-slate-900/80 border-slate-700 opacity-50 cursor-not-allowed'}
          `}
          data-keyboard-option="5"
          data-keyboard-focus="true"
        >
          <Gem size={48} className={canUpgradeRelic ? "text-yellow-400" : "text-slate-500"} />
          <div className="text-xl font-bold">遗物升级</div>
          {hintFor('relic_upgrade') && (
            <div className="rounded-full border border-yellow-400/30 bg-yellow-900/30 px-3 py-1 text-xs font-semibold text-yellow-100">
              当前路线强化：{hintFor('relic_upgrade')!.routeLabel}
            </div>
          )}
          <div className="text-sm text-slate-400">消耗信用筹码强化遗物</div>
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
            data-keyboard-option="4"
            data-keyboard-focus="true"
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
