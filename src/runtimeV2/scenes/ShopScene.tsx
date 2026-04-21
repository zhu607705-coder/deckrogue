import React from 'react';
import type { ShopSceneProps } from '../sceneProps';

export interface ShopSceneComponentProps {
  scene: ShopSceneProps;
  onLeave: () => void;
  onBuyCard?: (cardId: string) => void;
  onBuyRelic?: (relicId: string) => void;
  onBuyPotion?: (potionId: string) => void;
  onRemoveCard?: () => void;
  onEnterEnchant?: () => void;
}

export function ShopScene({
  scene,
  onLeave,
  onBuyCard,
  onBuyRelic,
  onBuyPotion,
  onRemoveCard,
  onEnterEnchant,
}: ShopSceneComponentProps) {
  const { player, room } = scene;

  return (
    <div className="shop-scene" data-scene="shop">
      <h2>{room.title ?? 'Shop'}</h2>
      {room.body && <p className="room-description">{room.body}</p>}
      {room.guidance && (
        <div className="route-guidance-panel">
          <strong>{room.guidance.headline}</strong>
          <span>{room.guidance.routeLabel ? `${room.guidance.routeLabel} · ` : ''}{room.guidance.reason}</span>
        </div>
      )}
      <div className="player-gold">Gold: {player.gold}</div>
      <div className="shop-services">
        {room.cardCount && <div className="shop-cards">Cards: {room.cardCount}</div>}
        {room.relicCount && <div className="shop-relics">Relics: {room.relicCount}</div>}
        {room.potionStockCount && <div className="shop-potions">Potions: {room.potionStockCount}</div>}
      </div>
      {room.cards.length > 0 && (
        <div className="shop-offers">
          {room.cards.map((card) => {
            const canAfford = player.gold >= card.price;
            return (
              <button
                key={card.id}
                onClick={() => onBuyCard?.(card.id)}
                disabled={!canAfford || !onBuyCard}
                className="shop-buy-card-btn"
                data-action="buy-card"
                data-card-id={card.id}
                data-recommended={card.recommended ? 'true' : undefined}
              >
                {card.name} · Buy {card.price}g
                {card.routeReason && <span className="offer-route">{card.routeReason}</span>}
              </button>
            );
          })}
        </div>
      )}
      {room.relics.length > 0 && (
        <div className="shop-relic-offers">
          {room.relics.map((relic) => {
            const canAfford = player.gold >= relic.price;
            return (
              <button
                key={relic.id}
                onClick={() => onBuyRelic?.(relic.id)}
                disabled={!canAfford || !onBuyRelic}
                className="shop-buy-relic-btn"
                data-action="buy-relic"
                data-relic-id={relic.id}
                data-recommended={relic.recommended ? 'true' : undefined}
              >
                {relic.name} · Buy {relic.price}g
                {relic.routeReason && <span className="offer-route">{relic.routeReason}</span>}
              </button>
            );
          })}
        </div>
      )}
      {room.potions.length > 0 && (
        <div className="shop-potion-offers">
          {room.potions.map((potion) => {
            const canAfford = player.gold >= potion.price;
            return (
              <button
                key={potion.id}
                onClick={() => onBuyPotion?.(potion.id)}
                disabled={!canAfford || !onBuyPotion}
                className="shop-buy-potion-btn"
                data-action="buy-potion"
                data-potion-id={potion.id}
              >
                {potion.name} · Buy {potion.price}g
              </button>
            );
          })}
        </div>
      )}
      <div className="shop-actions">
        {room.canRemove && onRemoveCard && (
          <button onClick={() => onRemoveCard()} className="shop-remove-btn" data-action="remove">
            Remove Card: {room.cardRemovalCost ?? 75}g
          </button>
        )}
        {room.canEnchant && onEnterEnchant ? (
          <button onClick={onEnterEnchant} className="shop-enchant-btn" data-action="enchant">
            附魔服务
          </button>
        ) : null}
      </div>
      <button onClick={onLeave} className="leave-shop-btn">
        Leave Shop
      </button>
    </div>
  );
}
