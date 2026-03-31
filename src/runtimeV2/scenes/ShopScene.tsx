import React from 'react';
import type { ShopSceneProps } from '../sceneProps';

export interface ShopSceneComponentProps {
  scene: ShopSceneProps;
  onLeave: () => void;
}

export function ShopScene({ scene, onLeave }: ShopSceneComponentProps) {
  const { player, room } = scene;

  return (
    <div className="shop-scene" data-scene="shop">
      <h2>{room.title ?? 'Shop'}</h2>
      {room.body && <p className="room-description">{room.body}</p>}
      <div className="player-gold">Gold: {player.gold}</div>
      <div className="shop-services">
        {room.cardCount && <div className="shop-cards">Cards: {room.cardCount}</div>}
        {room.relicCount && <div className="shop-relics">Relics: {room.relicCount}</div>}
        {room.potionStockCount && <div className="shop-potions">Potions: {room.potionStockCount}</div>}
      </div>
      <div className="shop-actions">
        {room.canRemove && (
          <div className="remove-service">
            <span>Remove Card: {room.cardRemovalCost ?? 75}g</span>
          </div>
        )}
      </div>
      <button onClick={onLeave} className="leave-shop-btn">
        Leave Shop
      </button>
    </div>
  );
}
