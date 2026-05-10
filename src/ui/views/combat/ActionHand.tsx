/**
 * @file ActionHand.tsx
 * @description 行动手牌区 - 渲染玩家可操作的卡牌手牌
 *
 * 主要职责:
 * - 渲染手牌区域的卡牌
 * - 处理卡牌选择和目标指定
 * - 显示卡牌消耗和可用状态
 * - 支持悬停预览
 */

import React from 'react';
import { CardView } from '@/ui/views/CardView';
import type { GameEngine } from '@/core';
import { getCardNameZh } from '@/ui/content/terminology';
import { grimdarkTerminology } from '@/ui/theme';
import { getCardPlayabilitySnapshot } from '@/ui/views/combat/combatViewModel';

interface ActionHandProps {
  engine: GameEngine;
  selectedCard: string | null;
  setSelectedCard: (id: string | null) => void;
  setShowDrawPile: (show: boolean) => void;
  setShowDiscardPile: (show: boolean) => void;
  GLOSSARY: any;
  handleCardClick: (card: any) => void;
  getDynamicCardText: (card: any) => string;
  getPreviewCost: (card: any) => number;
  tutorialHighlightActive?: boolean;
}

export function ActionHand({
  engine,
  selectedCard,
  setSelectedCard,
  setShowDrawPile,
  setShowDiscardPile,
  GLOSSARY,
  handleCardClick,
  getDynamicCardText,
  getPreviewCost,
  tutorialHighlightActive = false
}: ActionHandProps) {
  const state = engine.state.combat!;
  const player = state.player;
  const terms = grimdarkTerminology;

  return (
    <div className="h-64 flex flex-col justify-end relative grimdark-action-hand">
      {/* 结束回合按钮 */}
      <div className="absolute right-4 top-0 grimdark-end-turn-container">
        <button 
          onClick={() => engine.endTurn()}
          disabled={!state.isPlayerTurn}
          className="grimdark-end-turn-btn"
          title={state.isPlayerTurn ? '结束当前战术周期' : '等待敌袭阶段'}
          data-keyboard-end-turn="true"
          data-keyboard-focus="true"
        >
          <span className="grimdark-end-turn-text">结束周期</span>
          <span className="grimdark-end-turn-sub">敌袭结算</span>
        </button>
      </div>
      
      {/* 手牌区域 */}
      <div className={`flex justify-center gap-2 mb-4 grimdark-hand ${tutorialHighlightActive ? 'grimdark-hand--guided' : ''}`}>
        {state.hand.map((card: any, index: number) => {
          const playability = getCardPlayabilitySnapshot(
            { ...card, tempCost: getPreviewCost(card) },
            player.energy,
            state.isPlayerTurn,
          );
          return (
            <div
              key={card.instanceId}
              className={`grimdark-card-wrapper ${selectedCard === card.instanceId ? 'grimdark-card-wrapper--selected' : ''}`}
            >
              <CardView
                card={card}
                displayText={getDynamicCardText(card)}
                warpTide={state.warpTide}
                selected={selectedCard === card.instanceId}
                disabled={playability.isDisabled}
                onClick={() => handleCardClick(card)}
                rootProps={{
                  'data-keyboard-option': String(index + 1),
                  'data-keyboard-focus': 'true',
                  'data-keyboard-card-index': String(index + 1),
                  'data-keyboard-card': card.instanceId,
                  'aria-label': `${index + 1}. ${getCardNameZh(card)}`
                }}
              />
            </div>
          );
        })}
      </div>
      
      {/* 牌堆按钮 */}
      <div className="flex justify-between px-8 text-sm grimdark-pile-controls">
        <button
          onClick={() => setShowDrawPile(true)}
          className="grimdark-pile-btn grimdark-pile-btn--draw"
          title={`查看${terms.game.drawPile.name}`}
          data-keyboard-focus="true"
        >
          <span className="grimdark-pile-icon">📚</span>
          <span className="grimdark-pile-name">{terms.game.drawPile.name}</span>
          <span className="grimdark-pile-count">{state.drawPile.length}</span>
        </button>
        <button
          onClick={() => setShowDiscardPile(true)}
          className="grimdark-pile-btn grimdark-pile-btn--discard"
          title={`查看${terms.game.discardPile.name}`}
          data-keyboard-focus="true"
        >
          <span className="grimdark-pile-icon">🗑️</span>
          <span className="grimdark-pile-name">{terms.game.discardPile.name}</span>
          <span className="grimdark-pile-count">{state.discardPile.length}</span>
        </button>
      </div>
    </div>
  );
}
