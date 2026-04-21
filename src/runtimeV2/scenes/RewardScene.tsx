import React from 'react';
import type { RewardSceneProps } from '../sceneProps';

export interface RewardSceneComponentProps {
  scene: RewardSceneProps;
  onTake: (cardId?: string) => void;
  onSkip: () => void;
}

export function RewardScene({ scene, onTake, onSkip }: RewardSceneComponentProps) {
  const { player, reward, room } = scene;

  return (
    <div className="reward-scene" data-scene="reward">
      <h2>{room.title ?? 'Reward Draft'}</h2>
      {room.body && <p className="room-description">{room.body}</p>}
      <div className="player-hud">
        <span>HP: {player.hp}/{player.maxHp}</span>
        <span>Gold: {player.gold}</span>
      </div>
      <div className="reward-cards">
        {reward.cards.map((card) => (
          <button
            key={card.id}
            className="reward-card"
            onClick={() => onTake(card.id)}
            data-card-id={card.id}
            data-card-rarity={card.rarity}
            data-card-type={card.type}
          >
            <div className="card-header">
              <span className="card-cost">{card.cost}</span>
              <span className="card-rarity">{card.rarity}</span>
            </div>
            <div className="card-name">{card.name}</div>
            <div className="card-type">{card.type}</div>
            {card.description && <div className="card-description">{card.description}</div>}
          </button>
        ))}
      </div>
      <button onClick={onSkip} className="skip-reward-btn">
        Skip Reward
      </button>
    </div>
  );
}
