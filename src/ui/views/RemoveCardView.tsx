import React from 'react';
import { GameEngine } from '@/core';
import { CardView } from '@/ui/views/CardView';
import { ErrorBoundary } from '@/ui/components/ErrorBoundary';
import type { RunCardInstance } from '@/core';
import { uiWorldLore } from '@/ui/content/worldLore';

interface WorldLoreData {
  viewAtmosphere?: {
    RemoveCard?: string;
  };
}

export function RemoveCardView({ engine }: { engine: GameEngine }) {
  const WORLD_LORE = uiWorldLore as WorldLoreData;
  const player = engine.state.player;
  const background = '/assets/upgrade/upgrade_forge.png';
  const isEventRemoval = engine.isEventFreeCardRemovalMode();
  const remaining = engine.getEventFreeRemovalsRemaining();

  return (
    <ErrorBoundary>
      <div className="flex flex-col h-full text-slate-200 p-8 relative" style={{ backgroundImage: `url(${background})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <div className="absolute inset-0 bg-black/60" />
        <div className="relative z-10 flex flex-col h-full">
          <div className="text-center mb-8">
        <h1 className="text-4xl font-serif text-red-400 mb-2 drop-shadow-lg">焚毁记忆印痕</h1>
        <p className="text-slate-400">{isEventRemoval ? '选择要献祭给神龛的印痕。' : '选择一张永久移除出记忆印痕库的卡牌。'}</p>
        <p className="text-yellow-400 mt-2">
          {isEventRemoval ? `事件献祭剩余次数：${remaining}` : `基础费用：${engine.state.cardRemovalCost} 信用筹码`}
        </p>
        <p className="text-xs text-slate-500 mt-2 max-w-3xl mx-auto leading-5">{WORLD_LORE?.viewAtmosphere?.RemoveCard}</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-wrap gap-4 justify-center max-w-5xl mx-auto">
          {player.deck.map((card: RunCardInstance, index: number) => (
            <div key={card.instanceId} className="relative group">
              <CardView
                card={card}
                onClick={() => engine.removeCard(card.instanceId)}
                rootProps={{
                  'data-keyboard-option': index < 10 ? String(index + 1) : undefined,
                  'data-keyboard-focus': 'true',
                  'aria-label': `${index + 1}. ${card.name}`
                }}
              />
              <div className="absolute inset-0 bg-red-900/0 group-hover:bg-red-900/50 transition-colors rounded-xl pointer-events-none flex items-center justify-center">
                <div className="opacity-0 group-hover:opacity-100 text-white font-bold text-center drop-shadow-md">
                  <div className="text-xl">焚毁</div>
                  {!isEventRemoval && (
                    <div className="text-xs text-yellow-200 mt-1">{engine.getCardRemovalCostForCard(card)} 信用筹码</div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8 flex justify-center">
        <button
          type="button"
          onClick={() => engine.cancelCardRemoval()}
          className="px-8 py-3 bg-slate-800/80 hover:bg-slate-700/80 text-white font-bold rounded-xl border border-slate-600 transition-colors backdrop-blur-sm"
          data-keyboard-close="true"
          data-keyboard-focus="true"
          data-keyboard-option="10"
        >
          {isEventRemoval ? '返回事件' : '取消'}
        </button>
      </div>
        </div>
      </div>
      </ErrorBoundary>
  );
}
