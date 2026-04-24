/**
 * @file DrawPileModal.tsx
 * @description 抽牌堆模态框 - 展示抽牌堆中的卡牌 (需要洞悉)
 *
 * 主要职责:
 * - 渲染抽牌堆卡牌列表
 * - 支持洞悉效果预览
 * - 显示卡牌数量和详情
 */

import React, { useMemo } from 'react';
import { Eye, Cog, Clock, Crown } from 'lucide-react';
import { CardView } from '@/ui/views/CardView';
import type { GameEngine } from '@/core';

interface DrawPileModalProps {
  engine: GameEngine;
  showDrawPile: boolean;
  setShowDrawPile: (show: boolean) => void;
  useIntelForDrawPile: boolean;
  setUseIntelForDrawPile: (use: boolean) => void;
  GLOSSARY: any;
  cardBackThemes: any;
  characterToTheme: any;
  defaultTheme: string;
}

export function DrawPileModal({
  engine,
  showDrawPile,
  setShowDrawPile,
  useIntelForDrawPile,
  setUseIntelForDrawPile,
  GLOSSARY,
  cardBackThemes,
  characterToTheme,
  defaultTheme
}: DrawPileModalProps) {
  const state = engine.state.combat!;
  const intelNow = Math.max(0, engine.state.player.intel || 0);

  const hiddenDrawPileDisplay = useMemo(() => {
    const grouped = new Map<string, { card: any; count: number }>();
    for (const card of state.drawPile as any[]) {
      const key = `${card.id}:${card.isUpgraded ? 'u' : 'n'}`;
      const current = grouped.get(key);
      if (current) {
        current.count += 1;
      } else {
        grouped.set(key, { card, count: 1 });
      }
    }
    return Array.from(grouped.values()).sort((a, b) => a.card.name.localeCompare(b.card.name));
  }, [state.drawPile]);

  const revealedDrawPileDisplay = useMemo(() => [...(state.drawPile as any[])], [state.drawPile]);

  const revealDrawPileOrderWithIntel = () => {
    if (useIntelForDrawPile) return;
    const globalIntel = Math.max(0, engine.state.player.intel || 0);
    if (globalIntel <= 0) return;
    engine.state.player.intel = globalIntel - 1;
    if (engine.state.combat) {
      engine.state.combat.player.intel = Math.max(0, (engine.state.combat.player.intel || 0) - 1);
      engine.state.combat.warpPulse = {
        text: '消耗 1 点情报：已揭示抽牌堆顺序',
        tone: 'faith'
      };
    }
    setUseIntelForDrawPile(true);
    engine.notify();
  };

  const closeDrawPileModal = () => {
    setShowDrawPile(false);
    setUseIntelForDrawPile(false);
  };

  const renderDrawPileCardBack = (card: any, idx: number, count?: number) => {
    const characterId = engine.state.character?.id || 'default';
    const themeKey = characterToTheme[characterId] || defaultTheme;
    const theme = cardBackThemes[themeKey as keyof typeof cardBackThemes];
    const palette = theme.palette;
    
    const IconComponent = theme.icon === 'cog' ? Cog : theme.icon === 'clock' ? Clock : Crown;
    
    return (
    <div key={`draw-back-${card.id}-${card.isUpgraded ? 'u' : 'n'}-${idx}`} className="relative">
      <div className={`w-32 h-48 rounded-xl border ${palette.border} ${palette.bg} shadow-[0_10px_30px_rgba(0,0,0,0.45)] overflow-hidden`}>
        <div className="h-full w-full relative" style={{
          background: `${theme.gradients[0]}, ${theme.gradients[1]}, ${theme.gradients[2]}`
        }}>
          <div className={`absolute inset-[6px] rounded-lg border ${palette.innerBorder}`} />
          <div className={`absolute inset-[14px] rounded-md border ${palette.outerBorder} ${palette.innerBg}`} />
          <div className="absolute inset-0 opacity-20" style={{
            backgroundImage: theme.patterns[0],
            backgroundSize: theme.patternSize
          }} />
          <div className={`absolute top-3 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full border ${palette.innerBorder} ${palette.labelBg} text-[10px] tracking-[0.2em] uppercase ${palette.textColor}`}>
            {theme.label}
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className={`w-14 h-14 rounded-full border ${palette.innerBorder} ${palette.innerBg} flex items-center justify-center`}>
              <IconComponent size={22} className={palette.iconColor} />
            </div>
          </div>
          <div className={`absolute bottom-0 left-0 right-0 px-2 py-2 border-t ${palette.outerBorder} bg-black/35`}>
            <div className={`text-[10px] tracking-[0.16em] uppercase ${palette.textColor} text-center opacity-70`}>{GLOSSARY.DrawPile || '战术缓存'}</div>
            <div className={`text-[11px] ${palette.textColor} text-center truncate`} title={card.name}>{card.name}</div>
          </div>
        </div>
      </div>
      {count && count > 1 && (
        <div className={`absolute -top-2 -right-2 px-2 py-0.5 rounded-full ${palette.countBg} border ${palette.countBorder} text-[11px] ${palette.textColor} font-mono shadow-lg`}>
          ×{count}
        </div>
      )}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <div className={`px-2 py-1 rounded border ${palette.innerBorder} bg-black/25 ${palette.textColor} text-xs`}>
          顺序未知
        </div>
      </div>
    </div>
  );
  };

  if (!showDrawPile) return null;

  return (
    <div className="absolute inset-0 bg-black/80 z-[55] flex flex-col p-6 md:p-8 overflow-hidden" data-keyboard-modal="true">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-2xl font-bold text-white">{GLOSSARY.DrawPile || '战术缓存'}（{state.drawPile.length}）</h2>
          <div className="text-xs text-slate-400 mt-1">
            {useIntelForDrawPile ? '顺序已揭示（已消耗 1 Intel）' : '默认仅能辨认牌面，不显示抽取顺序'}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!useIntelForDrawPile && intelNow > 0 && state.drawPile.length > 1 && (
            <button
              onClick={revealDrawPileOrderWithIntel}
              className="px-3 py-2 rounded-lg border border-emerald-500/60 bg-emerald-900/30 text-emerald-200 hover:bg-emerald-800/40 shadow-[0_0_18px_rgba(16,185,129,0.25)] transition-colors text-sm"
              title="消耗 1 点 Intel 揭示抽牌堆顺序"
              data-keyboard-focus="true"
              data-keyboard-option="1"
            >
              <Eye size={14} className="inline mr-1" />
              使用情报揭示顺序 (-1 Intel)
            </button>
          )}
          <button onClick={closeDrawPileModal} className="text-slate-300 hover:text-white px-3 py-2 rounded-lg border border-slate-700 bg-slate-900" data-keyboard-close="true" data-keyboard-focus="true" data-keyboard-option="2">
            关闭
          </button>
        </div>
      </div>

      {!useIntelForDrawPile && hiddenDrawPileDisplay.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2 text-xs">
          {hiddenDrawPileDisplay.map(({ card, count }) => (
            <div
              key={`draw-summary-${card.id}-${card.isUpgraded ? 'u' : 'n'}`}
              className="px-2 py-1 rounded border border-slate-700 bg-slate-900/70 text-slate-300"
              title="使用情报可揭示抽牌顺序"
            >
              {card.name}{count > 1 ? ` ×${count}` : ''}
            </div>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto pr-1">
        {state.drawPile.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-500">{GLOSSARY.DrawPile || '战术缓存'}为空。</div>
        ) : (
          <div className="flex flex-wrap gap-4 justify-center">
            {(useIntelForDrawPile ? revealedDrawPileDisplay : hiddenDrawPileDisplay).map((entryOrCard: any, idx: number) => {
              if (!useIntelForDrawPile) {
                return renderDrawPileCardBack(entryOrCard.card, idx, entryOrCard.count);
              }
              const card = entryOrCard as any;
              return (
                <div key={`draw-${card.instanceId || card.id}-${idx}`} className="relative">
                  <div className="ring-1 ring-emerald-500/40 rounded-xl shadow-[0_0_18px_rgba(16,185,129,0.12)]">
                    <CardView card={card} warpTide={state.warpTide} />
                  </div>
                  <div className="absolute top-1 right-1 px-1.5 py-0.5 rounded bg-emerald-900/90 border border-emerald-600/60 text-[10px] text-emerald-200 font-mono">
                    #{idx + 1}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
