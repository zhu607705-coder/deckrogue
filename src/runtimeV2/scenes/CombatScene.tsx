import React from 'react';
import type { CombatSceneProps } from '../sceneProps';

export interface CombatSceneComponentProps {
  scene: CombatSceneProps;
  onComplete: () => void;
}

export function CombatScene({ scene, onComplete }: CombatSceneComponentProps) {
  const { player, combat, room } = scene;

  return (
    <div className="combat-scene" data-scene="combat">
      <div className="combat-header">
        <h2>{room.title ?? 'Combat'}</h2>
        <span className="turn-indicator">Turn {combat.turn}</span>
      </div>
      <div className="player-hud">
        <span>HP: {player.hp}/{player.maxHp}</span>
        <span>Energy: {combat.playerEnergy}</span>
        <span>Block: {combat.playerBlock}</span>
        <span>Hand: {combat.hand.length}</span>
        <span>Draw Pile: {combat.drawPileCount}</span>
        <span>Discard: {combat.discardPileCount}</span>
      </div>
      <div className="enemies">
        {combat.enemies.map((enemy) => (
          <div key={enemy.id} className="enemy" data-enemy-id={enemy.id}>
            <div className="enemy-header">
              <span className="enemy-name">{enemy.defId}</span>
              <span className="enemy-block">Block: {enemy.block}</span>
            </div>
            <div className="enemy-hp-bar">
              <div className="hp-fill" style={{ width: `${(enemy.hp / enemy.maxHp) * 100}%` }} />
              <span className="hp-text">{enemy.hp}/{enemy.maxHp}</span>
            </div>
            <div className="enemy-intent">
              <span className="intent-label">Next:</span>
              <span className="intent-value">{enemy.nextIntent ?? 'unknown'}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="hand-area">
        {combat.hand.map((cardId, index) => (
          <div key={`${cardId}-${index}`} className="hand-card" data-card-id={cardId}>
            {cardId}
          </div>
        ))}
      </div>
      <button onClick={onComplete} className="complete-combat-btn">
        End Combat
      </button>
    </div>
  );
}
