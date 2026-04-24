/**
 * @file DiscardPileModal.tsx
 * @description 弃牌堆模态框 - 展示弃牌堆中的卡牌
 *
 * 主要职责:
 * - 渲染弃牌堆卡牌列表
 * - 显示卡牌详细信息
 * - 支持筛选和排序
 */

import React, { useMemo } from 'react';
import { CardView } from '@/ui/views/CardView';
import type { GameEngine } from '@/core';

interface DiscardPileModalProps {
  engine: GameEngine;
  showDiscardPile: boolean;
  setShowDiscardPile: (show: boolean) => void;
  GLOSSARY: any;
}

export function DiscardPileModal({ engine, showDiscardPile, setShowDiscardPile, GLOSSARY }: DiscardPileModalProps) {
  const state = engine.state.combat!;

  const discardPileDisplay = useMemo(() => [...(state.discardPile as any[])].reverse(), [state.discardPile]);

  if (!showDiscardPile) return null;

  return (
    <div className="absolute inset-0 bg-black/80 z-[55] flex flex-col p-6 md:p-8 overflow-hidden" data-keyboard-modal="true">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div>
          <h2 className="text-2xl font-bold text-white">{GLOSSARY.DiscardPile || '已执行指令'}（{state.discardPile.length}）</h2>
          <div className="text-xs text-slate-400 mt-1">按弃牌顺序显示（最新在前）</div>
        </div>
        <button onClick={() => setShowDiscardPile(false)} className="text-slate-300 hover:text-white px-3 py-2 rounded-lg border border-slate-700 bg-slate-900" data-keyboard-close="true" data-keyboard-focus="true" data-keyboard-option="1">
          关闭
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pr-1">
        {discardPileDisplay.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-500">{GLOSSARY.DiscardPile || '已执行指令'}为空。</div>
        ) : (
          <div className="flex flex-wrap gap-4 justify-center">
            {discardPileDisplay.map((card: any, idx: number) => (
              <div key={`discard-${card.instanceId || card.id}-${idx}`} className="relative">
                <CardView card={card} warpTide={state.warpTide} />
                <div className="absolute top-1 right-1 px-1.5 py-0.5 rounded bg-slate-900/90 border border-slate-600 text-[10px] text-slate-200 font-mono">
                  {idx === 0 ? 'NEW' : `-${idx}`}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
