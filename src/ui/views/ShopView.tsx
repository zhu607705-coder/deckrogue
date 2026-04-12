import React, { useState } from 'react';
import { GameEngine } from '@/core';
import type { RenderModel } from '@/runtimeV2';
import { CardView } from '@/ui/views/CardView';
import { Coins, Hammer, Trash2, FlaskConical, Skull } from 'lucide-react';
import { getPotionRuntimeConfig, potionsData, relicsData } from '@/content/narrative/numericSystem';
import { ASSET_PLACEHOLDERS, bindImgFallback } from '@/ui/components/assetHelpers';
import { BackgroundImage, VIEW_BACKGROUNDS } from '@/ui/components/BackgroundImage';
import { GlossaryText } from '@/ui/components/GlossaryText';
import { getUiLabelZh } from '@/ui/content/terminology';
import { systemRandomInt } from '@/infrastructure/rng/systemRandom';
import type { RunCardInstance, RelicDef, PotionDef as CorePotionDef } from '@/core/types/actions';
import { uiWorldLore } from '@/ui/content/worldLore';
import { buildShopRouteAdvice } from '@/ui/views/shopRouteAdvisor';

interface ShopRelic extends RelicDef {
  inscription?: string;
  flavorText?: string;
  corrupted?: boolean;
  price: number;
}

interface ShopPotion extends CorePotionDef {
  price: number;
}

interface WorldLore {
  viewAtmosphere?: {
    Shop?: string;
    [key: string]: string | undefined;
  };
  npcDialogueTemplates?: {
    merchant?: string[];
    [key: string]: string[] | undefined;
  };
  [key: string]: unknown;
}

export function ShopView({ engine, renderModel }: { engine: GameEngine; renderModel?: RenderModel | null }) {
  const potionRuntime = getPotionRuntimeConfig();
  const WORLD_LORE = uiWorldLore as WorldLore;
  const cards = engine.state.shopCards;
  const relics = engine.state.shopRelics;
  const potions = engine.state.shopPotions;
  const player = engine.state.player;
  const roomSummary = renderModel?.room?.kind === 'shop' ? renderModel.room : null;
  const playerGold = renderModel?.player.gold ?? player.gold;
  const playerDeckCount = renderModel?.player.deckCount ?? player.deck.length;
  const playerPotionCount = renderModel?.player.potionCount ?? player.potions.length;
  const canUpgrade = roomSummary?.canUpgrade ?? (player.deck.some(c => !c.isUpgraded && c.upgrade) && playerGold >= 50);
  const canRemove = roomSummary?.canRemove ?? (playerGold >= engine.state.cardRemovalCost && playerDeckCount > 0);
  const canEnchantService =
    (roomSummary?.canEnchant ?? player.deck.some(c => (c.type === 'Attack' || c.type === 'Skill') && (!c.persistentEnchantments || c.persistentEnchantments.length === 0))) &&
    playerGold >= engine.getAdjustedShopPrice(65);
  const cardOffers = cards.map((card) => {
    const basePrice = card.rarity === 'Rare' ? 150 : card.rarity === 'Uncommon' ? 75 : 50;
    return {
      card,
      basePrice,
      price: engine.getAdjustedShopPrice(basePrice),
    };
  });
  const relicOffers = relics
    .map((relicId) => {
      const relic = relicsData.find(r => r.id === relicId) as ShopRelic | undefined;
      if (!relic) return null;
      return {
        relic,
        basePrice: relic.price,
        price: engine.getAdjustedShopPrice(relic.price),
      };
    })
    .filter((offer): offer is { relic: ShopRelic; basePrice: number; price: number } => !!offer);
  const shopRouteAdvice = buildShopRouteAdvice({
    characterId: engine.state.character?.id,
    deck: player.deck,
    gold: playerGold,
    cardOffers: cardOffers.map(({ card, price }) => ({ card, price })),
    relicOffers: relicOffers.map(({ relic, price }) => ({ relicId: relic.id, price })),
    canUpgrade,
    canEnchant: canEnchantService,
  });
  const [mixA, setMixA] = useState<number>(0);
  const [mixB, setMixB] = useState<number>(Math.min(1, Math.max(0, playerPotionCount - 1)));
  const potionChoices = player.potions.map((id, idx) => ({
    index: idx,
    id,
    def: (potionsData as unknown as ShopPotion[]).find(p => p.id === id)
  }));
  const canMix = (roomSummary?.canMix ?? (playerPotionCount >= 2)) && mixA !== mixB && player.potions[mixA] && player.potions[mixB];
  const relicIconSrc = (id: string) => `/assets/relics/${id}.png`;
  const potionIconSrc = (id: string) => `/assets/potions/${id}.png`;
  
  const [backgroundIndex] = useState(() => 
    VIEW_BACKGROUNDS.shop.length > 0 ? systemRandomInt(VIEW_BACKGROUNDS.shop.length) : 0
  );
  const backgroundSrc = VIEW_BACKGROUNDS.shop[backgroundIndex]?.desktop || '';
  const merchantImage = '/assets/shop/shop_merchant.png';
  const [merchantLine] = useState(() => {
    const lines = (WORLD_LORE?.npcDialogueTemplates?.merchant || []) as string[];
    if (!lines.length) return '货在这，命也在这。风险自负。';
    const lineIndex = systemRandomInt(lines.length);
    return lines[lineIndex] || '货在这，命也在这。风险自负。';
  });

  return (
    <BackgroundImage 
      src={backgroundSrc} 
      className="campaign-shell flex h-full flex-col items-center overflow-y-auto px-4 py-8 text-slate-200 md:px-8"
      overlayOpacity={0.68}
    >
      <div className="relative z-10 flex h-full w-full max-w-6xl flex-col items-center">
      <div className="absolute right-4 top-5 h-16 w-16 overflow-hidden rounded-full border-4 border-yellow-600/50 bg-slate-900/80 shadow-2xl sm:h-24 sm:w-24 lg:h-32 lg:w-32">
        <img
          src={merchantImage}
          alt="商贩"
          className="w-full h-full object-cover object-center"
          onError={(e) => bindImgFallback(e, ASSET_PLACEHOLDERS.merchant)}
        />
      </div>
      
      <div className="mb-8 w-full border-b border-white/10 pb-8 text-left">
        <div className="campaign-kicker">{getUiLabelZh('Scavenger Exchange')}</div>
        <div className="mt-4 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <h1 className="campaign-title campaign-poster-title text-[clamp(2.4rem,4vw,4.4rem)] leading-[0.94] text-yellow-100">
              黑市拾荒者
            </h1>
            <p className="campaign-copy mt-4 text-sm md:text-base">
              这页只负责判断三件事：当前构筑缺什么、哪些购买真正值得、哪些服务会把你推进下一段构筑转折。
            </p>
          </div>
          <div className="campaign-section flex items-center gap-3 self-start px-4 py-3 text-yellow-300">
            <Coins size={18} className="text-yellow-400" />
            <span className="text-lg font-semibold">{playerGold}</span>
            <span className="text-xs uppercase tracking-[0.18em] text-stone-400">信用筹码</span>
          </div>
        </div>
      </div>
      <div className="campaign-section mb-6 grid w-full gap-4 p-4 md:grid-cols-[1.3fr_0.7fr]">
        <div>
          <div className="campaign-kicker">{getUiLabelZh('Atmosphere')}</div>
          <div className="campaign-copy mt-2 text-sm md:text-base">
            <GlossaryText text={WORLD_LORE?.viewAtmosphere?.Shop || ''} />
          </div>
        </div>
        <div className="campaign-decision-column md:pl-5">
          <div className="campaign-kicker">{getUiLabelZh('Merchant Note')}</div>
          <p className="campaign-copy mt-2 text-sm italic text-yellow-100/85">“{merchantLine}”</p>
        </div>
      </div>
      {shopRouteAdvice.primaryHint && (
        <div className="campaign-section mb-8 w-full max-w-4xl px-5 py-3 text-sm text-yellow-100">
          当前路线：{shopRouteAdvice.preferredRouteLabel || '未成型'} · 推荐先做
          <span className="mx-1 font-semibold text-yellow-300">
            {shopRouteAdvice.primaryHint.targetType === 'card'
              ? '补一张路线记忆印痕'
              : shopRouteAdvice.primaryHint.targetType === 'relic'
                ? '拿一件路线遗物'
                : shopRouteAdvice.primaryHint.targetId === 'upgrade'
                  ? '锻造强化'
                  : '附魔服务'}
          </span>
          · {shopRouteAdvice.primaryHint.reason}
        </div>
      )}
      
      <div className="campaign-section mb-8 w-full p-6">
        <div className="mb-6 border-b border-white/10 pb-3">
          <div className="campaign-kicker">{getUiLabelZh('Acquisition')}</div>
          <h2 className="campaign-title mt-3 text-2xl text-yellow-200">记忆印痕</h2>
        </div>
        <div className="flex flex-wrap justify-center gap-6">
          {cardOffers.map(({ card, basePrice, price }, index: number) => {
            const canAfford = playerGold >= price;
            const routeHint = shopRouteAdvice.cardHints[card.instanceId];
            
            const deckArchetype = player.deck.reduce((acc: Record<string, number>, c: RunCardInstance) => {
              if (c.type === 'Attack') acc.attack = (acc.attack || 0) + 1;
              if (c.type === 'Skill') acc.skill = (acc.skill || 0) + 1;
              if (c.type === 'Power') acc.power = (acc.power || 0) + 1;
              return acc;
            }, {} as Record<string, number>);
            
            const getBuildFitTags = (): string[] => {
              const tags: string[] = [];
              const attackCount = deckArchetype.attack || 0;
              const skillCount = deckArchetype.skill || 0;
              
              if (card.type === 'Attack' && attackCount < 5) {
                tags.push('补充攻击');
              } else if (card.type === 'Skill' && skillCount < 5) {
                tags.push('补充技能');
              }
              
              if (card.type === 'Power' && (deckArchetype.power || 0) < 3) {
                tags.push('能力核心');
              }
              
              if (card.rarity === 'Rare') {
                tags.push('稀有强化');
              }
              
              if (tags.length === 0) {
                tags.push('可选');
              }
              
              return tags.slice(0, 2);
            };
            
            const buildFitTags = getBuildFitTags();
            
            return (
              <div key={card.instanceId} className="campaign-choice flex max-w-[22rem] flex-col items-center gap-3 p-4 group">
                <div className="campaign-kicker">{getUiLabelZh('Offer')} {index + 1}</div>
                <div className="flex flex-wrap justify-center gap-1">
                  {buildFitTags.map((tag, i) => (
                    <span 
                      key={i}
                      className={`px-2 py-0.5 text-xs font-bold rounded border ${
                        tag === '补充攻击' ? 'bg-red-900/60 border-red-500/50 text-red-300' :
                        tag === '补充技能' ? 'bg-blue-900/60 border-blue-500/50 text-blue-300' :
                        tag === '能力核心' ? 'bg-purple-900/60 border-purple-500/50 text-purple-300' :
                        tag === '稀有强化' ? 'bg-yellow-900/60 border-yellow-500/50 text-yellow-300' :
                        'bg-slate-700/60 border-slate-500/50 text-slate-300'
                      }`}
                    >
                      {tag}
                    </span>
                  ))}
                  {routeHint && (
                    <span className="rounded border border-emerald-500/40 bg-emerald-900/40 px-2 py-0.5 text-xs font-bold text-emerald-200">
                      当前路线强化：{routeHint.routeLabel}
                    </span>
                  )}
                </div>
                <CardView card={card} disabled={!canAfford} />
                <button 
                  onClick={() => engine.buyShopCard(card.instanceId, basePrice)}
                  disabled={!canAfford}
                  className={`px-5 py-2 rounded-full text-sm font-bold border-2 flex items-center gap-2 transition-all duration-300 shadow-lg
                    ${canAfford ? 'bg-yellow-900/60 border-yellow-500 text-yellow-400 hover:bg-yellow-900 hover:scale-105 hover:shadow-[0_0_20px_rgba(234,179,8,0.3)]' : 'bg-slate-800 border-slate-600 text-slate-500 cursor-not-allowed opacity-60'}
                  `}
                  data-keyboard-option={index < 10 ? String(index + 1) : undefined}
                  data-keyboard-focus="true"
                >
                  <Coins size={16} /> {price}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mb-8 grid w-full gap-8 lg:grid-cols-2">
        <div className="campaign-section p-6">
          <div className="mb-6 border-b border-white/10 pb-3">
            <div className="campaign-kicker">{getUiLabelZh('Permanent Edge')}</div>
            <h2 className="campaign-title mt-3 text-2xl text-emerald-200">遗物</h2>
          </div>
          <div className="flex flex-col gap-4">
            {relicOffers.map(({ relic, basePrice, price }, index: number) => {
              const canAfford = playerGold >= price;
              const routeHint = shopRouteAdvice.relicHints[relic.id];
              return (
                <div key={relic.id} className="flex items-center justify-between bg-slate-800/80 p-4 rounded-xl border border-slate-700 hover:border-emerald-500/50 transition-all duration-300 group" title={`${relic.description}${relic.inscription ? `\n铭文：${relic.inscription}` : ''}${relic.flavorText ? `\n遗言：${relic.flavorText}` : ''}${relic.corrupted ? ' [腐化遗物]' : ''}`}>
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
                      {routeHint && (
                        <div className="mt-1 text-[11px] font-semibold text-emerald-200">
                          当前路线强化：{routeHint.routeLabel}
                        </div>
                      )}
                      {relic.inscription && (
                        <div className="text-[11px] text-slate-500 mt-1 line-clamp-1">铭文：{relic.inscription}</div>
                      )}
                      {relic.flavorText && (
                        <div className="text-[11px] italic text-emerald-200/70 mt-0.5 line-clamp-1">“{String(relic.flavorText).replace(/^“|”$/g, '')}”</div>
                      )}
                    </div>
                  </div>
                  <button 
                    onClick={() => engine.buyShopRelic(relic.id, basePrice)}
                    disabled={!canAfford}
                    className={`px-4 py-2 rounded-full text-sm font-bold border-2 flex items-center gap-2 shrink-0 transition-all duration-300 shadow-lg
                      ${canAfford ? 'bg-yellow-900/60 border-yellow-500 text-yellow-400 hover:bg-yellow-900 hover:scale-105 hover:shadow-[0_0_15px_rgba(234,179,8,0.4)]' : 'bg-slate-800 border-slate-600 text-slate-500 cursor-not-allowed opacity-60'}
                    `}
                    data-keyboard-option={cards.length + index < 10 ? String(cards.length + index + 1) : undefined}
                    data-keyboard-focus="true"
                  >
                    <Coins size={16} /> {price}
                  </button>
                </div>
              );
            })}
            {relics.length === 0 && <div className="text-slate-500 italic text-center py-4">库存售罄</div>}
          </div>
        </div>

        <div className="campaign-section p-6">
          <div className="mb-6 border-b border-white/10 pb-3">
            <div className="campaign-kicker">{getUiLabelZh('Volatile Tools')}</div>
            <h2 className="campaign-title mt-3 text-2xl text-blue-200">药剂</h2>
          </div>
          <div className="flex flex-col gap-4">
            {potions.map((potionId: string, index: number) => {
              const potion = potionsData.find(p => p.id === potionId) as ShopPotion | undefined;
              if (!potion) return null;
              const basePrice = potion.price;
              const price = engine.getAdjustedShopPrice(basePrice);
              const canAfford = playerGold >= price && playerPotionCount < potionRuntime.slotLimit;
              return (
                <div key={`${potion.id}-${index}`} className="flex items-center justify-between bg-slate-800/80 p-4 rounded-xl border border-slate-700 hover:border-blue-500/50 transition-all duration-300 group" title={`${potion.description} (Toxicity +${potion.toxicity ?? 1})`}>
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
                    data-keyboard-option={cards.length + relics.length + index < 10 ? String(cards.length + relics.length + index + 1) : undefined}
                    data-keyboard-focus="true"
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

      <div className="campaign-section mb-12 w-full p-6">
        <div className="mb-6 border-b border-white/10 pb-3">
          <div className="campaign-kicker">Services</div>
          <h2 className="campaign-title mt-3 text-2xl text-stone-100">服务</h2>
        </div>
        <div className="flex gap-6 justify-center flex-wrap">
          <button 
            onClick={() => engine.enterUpgrade('Shop')}
            disabled={!canUpgrade}
            className={`px-6 py-5 rounded-2xl border-2 flex items-center gap-4 transition-all w-64 shadow-lg
              ${canUpgrade ? 'bg-slate-800 border-emerald-500 hover:bg-slate-700 hover:scale-105 cursor-pointer text-emerald-400 hover:shadow-[0_0_20px_rgba(16,185,129,0.3)]' : 'bg-slate-800 border-slate-700 opacity-50 cursor-not-allowed text-slate-500'}
            `}
            data-keyboard-focus="true"
          >
            <Hammer size={28} />
            <div className="text-left">
              <div className="font-bold text-lg">锻造强化</div>
              {shopRouteAdvice.serviceHints.upgrade && (
                <div className="rounded-full border border-emerald-400/30 bg-emerald-900/30 px-2 py-1 text-[11px] font-semibold text-emerald-200">
                  当前路线强化：{shopRouteAdvice.serviceHints.upgrade.routeLabel}
                </div>
              )}
              <div className="text-sm opacity-80 flex items-center gap-1"><Coins size={16}/> 50 信用筹码</div>
            </div>
          </button>

          <button 
            onClick={() => engine.enterCardRemoval()}
            disabled={!canRemove}
            className={`px-6 py-5 rounded-2xl border-2 flex items-center gap-4 transition-all w-64 shadow-lg
              ${canRemove ? 'bg-slate-800 border-red-500 hover:bg-slate-700 hover:scale-105 cursor-pointer text-red-400 hover:shadow-[0_0_20px_rgba(239,68,68,0.3)]' : 'bg-slate-800 border-slate-700 opacity-50 cursor-not-allowed text-slate-500'}
            `}
            data-keyboard-focus="true"
          >
            <Trash2 size={28} />
            <div className="text-left">
              <div className="font-bold text-lg">焚毁记忆印痕</div>
              <div className="text-sm opacity-80 flex items-center gap-1"><Coins size={16}/> {engine.state.cardRemovalCost} 信用筹码</div>
            </div>
          </button>

          <button
            onClick={() => engine.enterShopEnchant()}
            disabled={!canEnchantService}
            className={`px-6 py-5 rounded-2xl border-2 flex items-center gap-4 transition-all w-64 shadow-lg
              ${canEnchantService
                ? 'bg-slate-800 border-amber-500 hover:bg-slate-700 hover:scale-105 cursor-pointer text-amber-300 hover:shadow-[0_0_20px_rgba(245,158,11,0.3)]'
                : 'bg-slate-800 border-slate-700 opacity-50 cursor-not-allowed text-slate-500'}
            `}
            data-keyboard-focus="true"
          >
            <FlaskConical size={28} />
            <div className="text-left">
              <div className="font-bold text-lg">附魔服务</div>
              {shopRouteAdvice.serviceHints.enchant && (
                <div className="rounded-full border border-amber-400/30 bg-amber-900/30 px-2 py-1 text-[11px] font-semibold text-amber-100">
                  当前路线强化：{shopRouteAdvice.serviceHints.enchant.routeLabel}
                </div>
              )}
              <div className="text-sm opacity-80 flex items-center gap-1"><Coins size={16}/> {engine.getAdjustedShopPrice(65)} 信用筹码</div>
            </div>
          </button>
        </div>

        <div className="campaign-section mt-8 w-full max-w-3xl self-center p-6">
          <div className="campaign-kicker">Purify</div>
          <div className="campaign-title mt-3 mb-4 flex items-center gap-2 text-xl text-purple-200"><Skull size={20} /> 驱魔服务</div>
          {(() => {
            const curseRelics = player.relics
              .map((relicId: string) => relicsData.find((r: any) => r.id === relicId) as any)
              .filter((relic: any) => relic?.corrupted);
            
            if (curseRelics.length === 0) {
              return (
                <div className="text-center py-4 text-slate-500 italic">
                  暂无需要驱魔的腐化遗物
                </div>
              );
            }

            return (
              <div className="flex flex-col gap-4">
                {curseRelics.map((relic: any) => {
                  const purifyCost = engine.getAdjustedShopPrice(75);
                  const canAfford = playerGold >= purifyCost;
                  return (
                    <div key={relic.id} className="flex items-center justify-between bg-purple-900/30 p-4 rounded-xl border border-purple-700/50 hover:border-purple-500/50 transition-all duration-300">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-slate-700 rounded-xl flex items-center justify-center text-purple-400 border-2 border-purple-500/30 overflow-hidden shadow-lg">
                          <img
                            src={relicIconSrc(relic.id)}
                            alt={relic.name}
                            className="w-10 h-10 object-cover rounded-lg opacity-70"
                            onError={(e) => bindImgFallback(e, ASSET_PLACEHOLDERS.relic)}
                          />
                        </div>
                        <div>
                          <div className="font-bold text-purple-400 text-lg">{relic.name}</div>
                          <div className="text-sm text-slate-400">移除此腐化遗物</div>
                        </div>
                      </div>
                      <button
                        onClick={() => engine.shopPurify(relic.id)}
                        disabled={!canAfford}
                        className={`px-4 py-2 rounded-full text-sm font-bold border-2 flex items-center gap-2 shrink-0 transition-all duration-300 shadow-lg
                          ${canAfford ? 'bg-purple-900/60 border-purple-500 text-purple-300 hover:bg-purple-900 hover:scale-105 hover:shadow-[0_0_15px_rgba(168,85,247,0.4)]' : 'bg-slate-800 border-slate-600 text-slate-500 cursor-not-allowed opacity-60'}
                        `}
                        title="驱魔移除腐化遗物"
                      >
                        <Skull size={16} /> {purifyCost}
                      </button>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>

        <div className="campaign-section mt-4 w-full max-w-3xl self-center p-6">
          <div className="campaign-kicker">Alchemy Station</div>
          <div className="campaign-title mt-3 mb-4 flex items-center gap-2 text-xl text-cyan-200"><FlaskConical size={20} /> 炼金调和</div>
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
              data-keyboard-focus="true"
            >
              蒸馏
            </button>
          </div>
          <div className="campaign-copy mt-3 text-sm">调和会消耗两瓶药剂，并返还一瓶更危险的配方。</div>
        </div>
      </div>

      <div className="mt-auto flex w-full justify-center">
        <button 
          onClick={() => engine.leaveCurrentRoomToMap()}
          className="campaign-action px-10 py-4 text-sm font-semibold uppercase tracking-[0.18em] text-stone-100"
          data-keyboard-focus="true"
        >
          离开据点
        </button>
      </div>
      </div>
    </BackgroundImage>
  );
}
