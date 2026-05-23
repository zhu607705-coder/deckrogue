/**
 * @file RemoveCardView.tsx
 * @description 移除卡牌视图 - 从卡组中永久移除卡牌的界面
 *
 * 主要职责:
 * - 展示卡组中所有卡牌
 * - 处理卡牌移除操作
 * - 支持事件免费移除模式
 * - 显示移除费用或剩余次数
 */
import React from 'react';
import { GameEngine } from '@/core';
import type { RenderModel, RenderModelRoomChoice } from '@/runtimeV2';
import { CardView } from '@/ui/views/CardView';
import { ErrorBoundary } from '@/ui/components/ErrorBoundary';
import type { RunCardInstance } from '@/core';
import { uiWorldLore } from '@/ui/content/worldLore';

interface WorldLoreData {
  viewAtmosphere?: {
    RemoveCard?: string;
  };
}

function parseChoiceCardId(choiceId: string): string {
  const separatorIndex = choiceId.indexOf(':');
  return separatorIndex >= 0 ? choiceId.slice(separatorIndex + 1) : choiceId;
}

function RuntimeRemoveCardChoice({
  choice,
  index,
  onSelect,
}: {
  choice: RenderModelRoomChoice;
  index: number;
  onSelect: (choiceId: string) => void;
}) {
  const cardId = parseChoiceCardId(choice.id);
  return (
    <button
      type="button"
      key={choice.id}
      onClick={() => onSelect(choice.id)}
      disabled={choice.disabled}
      className={[
        'relative group w-56 min-h-72 text-left rounded-lg border p-4 transition-all backdrop-blur-sm',
        choice.disabled
          ? 'border-slate-700 bg-slate-900/60 opacity-50 cursor-not-allowed text-slate-500'
          : 'border-red-500/70 bg-slate-950/80 hover:bg-red-950/60 hover:scale-[1.02] cursor-pointer text-slate-100 shadow-lg hover:shadow-[0_0_20px_rgba(239,68,68,0.28)]',
      ].join(' ')}
      data-runtime-choice-id={choice.id}
      data-keyboard-option={index < 10 ? String(index + 1) : undefined}
      data-keyboard-focus={choice.disabled ? undefined : 'true'}
      aria-label={`${index + 1}. ${choice.label}`}
    >
      <div className="text-xs uppercase tracking-[0.16em] text-red-300/80 mb-3">{cardId}</div>
      <div className="text-xl font-serif text-red-100 mb-3">{choice.label}</div>
      {choice.description && (
        <div className="text-sm leading-6 text-slate-300">{choice.description}</div>
      )}
      <div className="absolute inset-0 bg-red-900/0 group-hover:bg-red-900/35 transition-colors rounded-lg pointer-events-none flex items-center justify-center">
        <div className="opacity-0 group-hover:opacity-100 text-white font-bold text-center drop-shadow-md">
          <div className="text-xl">焚毁</div>
        </div>
      </div>
    </button>
  );
}

export function RemoveCardView({ engine, renderModel }: { engine: GameEngine; renderModel?: RenderModel | null }) {
  const WORLD_LORE = uiWorldLore as WorldLoreData;
  const player = engine.state.player;
  const roomSummary = renderModel?.room?.kind === 'remove_card' ? renderModel.room : null;
  const runtimeChoices = roomSummary?.choices ?? [];
  const shouldUseRuntimeChoices = runtimeChoices.length > 0 && player.deck.length === 0;
  const background = '/assets/upgrade/upgrade_forge.svg';
  const removalCost = roomSummary?.cardRemovalCost ?? engine.state.cardRemovalCost;
  const isEventRemoval = engine.isEventFreeCardRemovalMode() || removalCost === 0;
  const remaining = engine.getEventFreeRemovalsRemaining();
  const body = roomSummary?.body ?? (isEventRemoval ? '选择要献祭给神龛的印痕。' : '选择一张永久移除出记忆印痕库的卡牌。');
  const costSummary = isEventRemoval
    ? (remaining > 0 ? `事件献祭剩余次数：${remaining}` : '事件献祭不消耗信用筹码')
    : `基础费用：${removalCost} 信用筹码`;

  return (
    <ErrorBoundary>
      <div className="flex flex-col h-full text-slate-200 p-8 relative" style={{ backgroundImage: `url(${background})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <div className="absolute inset-0 bg-black/60" />
      <div className="relative z-10 flex flex-col h-full">
        <div className="text-center mb-8">
        <h1 className="text-4xl font-serif text-red-400 mb-2 drop-shadow-lg">焚毁记忆印痕</h1>
        <p className="text-slate-400">{body}</p>
        <p className="text-yellow-400 mt-2">
          {costSummary}
        </p>
        <p className="text-xs text-slate-500 mt-2 max-w-3xl mx-auto leading-5">{WORLD_LORE?.viewAtmosphere?.RemoveCard}</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-wrap gap-4 justify-center max-w-5xl mx-auto">
          {shouldUseRuntimeChoices ? runtimeChoices.map((choice, index) => (
            <RuntimeRemoveCardChoice
              key={choice.id}
              choice={choice}
              index={index}
              onSelect={(choiceId) => engine.removeCard(choiceId)}
            />
          )) : player.deck.map((card: RunCardInstance, index: number) => (
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
        >
          {isEventRemoval ? '返回事件' : '取消'}
        </button>
      </div>
        </div>
      </div>
      </ErrorBoundary>
  );
}
