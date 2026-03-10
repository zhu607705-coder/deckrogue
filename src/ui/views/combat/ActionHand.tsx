import React from 'react';
import { CardView } from '@/ui/views/CardView';
import type { GameEngine } from '@/core';
import { grimdarkTerminology } from '@/ui/theme';

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
  getPreviewCost
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
        >
          <span className="grimdark-end-turn-text">结束周期</span>
          <span className="grimdark-end-turn-sub">END TURN</span>
        </button>
      </div>
      
      {/* 手牌区域 */}
      <div className="flex justify-center gap-2 mb-4 grimdark-hand">
        {state.hand.map((card: any) => (
          <div
            key={card.instanceId}
            className={`grimdark-card-wrapper ${selectedCard === card.instanceId ? 'grimdark-card-wrapper--selected' : ''}`}
          >
            <CardView 
              card={card} 
              displayText={getDynamicCardText(card)}
              warpTide={state.warpTide}
              selected={selectedCard === card.instanceId}
              disabled={!state.isPlayerTurn || (card.tags || []).includes('Unplayable') || player.energy < getPreviewCost(card)}
              onClick={() => handleCardClick(card)}
            />
          </div>
        ))}
      </div>
      
      {/* 牌堆按钮 */}
      <div className="flex justify-between px-8 text-sm grimdark-pile-controls">
        <button
          onClick={() => setShowDrawPile(true)}
          className="grimdark-pile-btn grimdark-pile-btn--draw"
          title={`查看${terms.game.drawPile.name}`}
        >
          <span className="grimdark-pile-icon">📚</span>
          <span className="grimdark-pile-name">{terms.game.drawPile.name}</span>
          <span className="grimdark-pile-count">{state.drawPile.length}</span>
        </button>
        <button
          onClick={() => setShowDiscardPile(true)}
          className="grimdark-pile-btn grimdark-pile-btn--discard"
          title={`查看${terms.game.discardPile.name}`}
        >
          <span className="grimdark-pile-icon">🗑️</span>
          <span className="grimdark-pile-name">{terms.game.discardPile.name}</span>
          <span className="grimdark-pile-count">{state.discardPile.length}</span>
        </button>
      </div>
    </div>
  );
}
