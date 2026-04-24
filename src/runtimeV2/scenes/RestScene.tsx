/**
 * @file RestScene.tsx
 * @description 休整场景 DOM 组件，渲染休息、升级和附魔等操作按钮
 *
 * 主要职责:
 * - 渲染玩家状态和可用操作按钮（休息、升级、移除、附魔等）
 * - 处理各操作按钮的点击回调
 * - 显示路线引导信息
 */
import React from 'react';
import type { RestSceneProps } from '../sceneProps';

export interface RestSceneComponentProps {
  scene: RestSceneProps;
  onRest: () => void;
  onUpgrade: () => void;
  onRemoveCard: () => void;
  onEnterEnchant?: () => void;
  onEnterRelicUpgrade?: () => void;
  onLeave: () => void;
}

export function RestScene({
  scene,
  onRest,
  onUpgrade,
  onRemoveCard,
  onEnterEnchant,
  onEnterRelicUpgrade,
  onLeave,
}: RestSceneComponentProps) {
  const { player, room } = scene;

  return (
    <div className="rest-scene" data-scene="rest">
      <h2>{room.title ?? '休整据点'}</h2>
      {room.body && <p className="room-description">{room.body}</p>}
      {room.guidance && (
        <div className="route-guidance-panel">
          <strong>{room.guidance.headline}</strong>
          <span>{room.guidance.routeLabel ? `${room.guidance.routeLabel} · ` : ''}{room.guidance.reason}</span>
        </div>
      )}
      <div className="player-hud">
        <span>生命：{player.hp}/{player.maxHp}</span>
        <span>金币：{player.gold}</span>
      </div>
      <div className="rest-actions">
        {room.canHeal && (
          <button onClick={onRest} className="rest-action-btn" data-action="rest">
            <span className="action-title">休整</span>
            <span className="action-desc">恢复 {room.healAmount} 点生命</span>
            {room.routeAdvice?.actionHints.heal?.reason && <span className="action-route">{room.routeAdvice.actionHints.heal.reason}</span>}
          </button>
        )}
        {room.canUpgrade && (
          <button onClick={() => onUpgrade()} className="rest-action-btn" data-action="upgrade">
            <span className="action-title">强化</span>
            <span className="action-desc">强化牌库中的一张牌</span>
            {room.routeAdvice?.actionHints.upgrade?.reason && <span className="action-route">{room.routeAdvice.actionHints.upgrade.reason}</span>}
          </button>
        )}
        {room.canRemove && (
          <button onClick={() => onRemoveCard()} className="rest-action-btn" data-action="remove">
            <span className="action-title">移除卡牌</span>
            <span className="action-desc">花费：{room.cardRemovalCost} 金币</span>
          </button>
        )}
        {room.canEnchant && onEnterEnchant ? (
          <button onClick={onEnterEnchant} className="rest-action-btn" data-action="enchant">
            <span className="action-title">附魔</span>
            <span className="action-desc">为一张牌施加永久附魔</span>
            {room.routeAdvice?.actionHints.enchant?.reason && <span className="action-route">{room.routeAdvice.actionHints.enchant.reason}</span>}
          </button>
        ) : null}
        {room.canRelicUpgrade && onEnterRelicUpgrade ? (
          <button onClick={onEnterRelicUpgrade} className="rest-action-btn" data-action="relic-upgrade">
            <span className="action-title">遗物升级</span>
            <span className="action-desc">净化并强化一件受污染遗物</span>
            {room.routeAdvice?.actionHints.relic_upgrade?.reason && <span className="action-route">{room.routeAdvice.actionHints.relic_upgrade.reason}</span>}
          </button>
        ) : null}
      </div>
      <button onClick={onLeave} className="leave-rest-btn">
        继续前进
      </button>
    </div>
  );
}
