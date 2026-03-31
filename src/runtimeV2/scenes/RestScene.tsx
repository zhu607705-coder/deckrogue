import React from 'react';
import type { RestSceneProps } from '../sceneProps';

export interface RestSceneComponentProps {
  scene: RestSceneProps;
  onRest: () => void;
  onUpgrade: () => void;
  onRemoveCard: () => void;
  onLeave: () => void;
}

export function RestScene({ scene, onRest, onUpgrade, onRemoveCard, onLeave }: RestSceneComponentProps) {
  const { player, room } = scene;

  return (
    <div className="rest-scene" data-scene="rest">
      <h2>{room.title ?? '休整据点'}</h2>
      {room.body && <p className="room-description">{room.body}</p>}
      <div className="player-hud">
        <span>生命：{player.hp}/{player.maxHp}</span>
        <span>金币：{player.gold}</span>
      </div>
      <div className="rest-actions">
        {room.canHeal && (
          <button onClick={onRest} className="rest-action-btn" data-action="rest">
            <span className="action-title">休整</span>
            <span className="action-desc">恢复 {room.healAmount} 点生命</span>
          </button>
        )}
        {room.canUpgrade && (
          <button onClick={onUpgrade} className="rest-action-btn" data-action="upgrade">
            <span className="action-title">强化</span>
            <span className="action-desc">强化牌库中的一张牌</span>
          </button>
        )}
        {room.canRemove && (
          <button onClick={onRemoveCard} className="rest-action-btn" data-action="remove">
            <span className="action-title">移除卡牌</span>
            <span className="action-desc">花费：{room.cardRemovalCost} 金币</span>
          </button>
        )}
      </div>
      <button onClick={onLeave} className="leave-rest-btn">
        继续前进
      </button>
    </div>
  );
}
