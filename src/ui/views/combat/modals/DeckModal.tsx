import React from 'react';
import { CardView } from '@/ui/views/CardView';
import type { GameEngine } from '@/core';

interface DeckModalProps {
  engine: GameEngine;
  showDeck: boolean;
  setShowDeck: (show: boolean) => void;
  GLOSSARY: any;
}

export function DeckModal({ engine, showDeck, setShowDeck, GLOSSARY }: DeckModalProps) {
  if (!showDeck) return null;

  const state = engine.state.combat!;

  return (
    <div className="absolute inset-0 bg-black/90 z-50 flex flex-col p-8 overflow-hidden" data-keyboard-modal="true">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">{GLOSSARY.Deck || '记忆印痕库'}（{engine.state.player.deck.length} 张）</h2>
        <button onClick={() => setShowDeck(false)} className="text-slate-400 hover:text-white px-4 py-2" data-keyboard-close="true" data-keyboard-focus="true">关闭</button>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-wrap gap-4 justify-center">
          {engine.state.player.deck.map((card: any, idx: number) => (
            <CardView key={idx} card={card} warpTide={state.warpTide} />
          ))}
        </div>
      </div>
    </div>
  );
}
