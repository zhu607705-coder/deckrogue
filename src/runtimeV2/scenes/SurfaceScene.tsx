import React from 'react';
import type { RenderModel } from '../contracts';

type SurfaceScreen = Extract<
  RenderModel['screen'],
  'Upgrade' | 'RemoveCard' | 'Enchant' | 'RelicUpgrade' | 'Victory' | 'GameOver'
>;

export interface SurfaceSceneProps {
  screen: SurfaceScreen;
  room: RenderModel['room'];
  player: RenderModel['player'];
  onUpgrade?: (cardToken?: string) => void;
  onRemoveCard?: (cardToken?: string) => void;
  onApplyEnchantment?: (cardToken: string) => void;
  onUpgradeRelic?: (relicId: string) => void;
  onCancelSurface?: () => void;
}

function formatCardLabel(cardId: string): string {
  return cardId.replace(/_/g, ' ');
}

export function SurfaceScene({
  screen,
  room,
  player,
  onUpgrade,
  onRemoveCard,
  onApplyEnchantment,
  onUpgradeRelic,
  onCancelSurface,
}: SurfaceSceneProps) {
  const title = room?.title ?? screen;
  const body = room?.body ?? '';
  const previewCards = player.deck.slice(0, 6);
  const isTerminal = screen === 'Victory' || screen === 'GameOver';

  return (
    <div className="runtime-v2-surface-scene" data-scene="runtime-v2-surface" data-surface={screen}>
      <h2>{title}</h2>
      {body ? <p className="room-description">{body}</p> : null}

      <div className="runtime-v2-surface-summary">
        <span>生命：{player.hp}/{player.maxHp}</span>
        <span>金币：{player.gold}</span>
        <span>牌库：{player.deckCount}</span>
      </div>

      {!isTerminal && previewCards.length > 0 ? (
        <div className="runtime-v2-surface-card-list">
          {previewCards.map((cardId, index) => (
            <div key={`${cardId}:${index}`} className="runtime-v2-surface-card-chip">
              {formatCardLabel(cardId)}
            </div>
          ))}
          {player.deck.length > previewCards.length ? (
            <div className="runtime-v2-surface-card-chip">+{player.deck.length - previewCards.length}</div>
          ) : null}
        </div>
      ) : null}

      <div className="runtime-v2-surface-actions">
        {(screen === 'Upgrade' || screen === 'RemoveCard' || screen === 'Enchant' || screen === 'RelicUpgrade') && room?.choices?.length ? (
          <div className="runtime-v2-surface-choice-list">
            {room.choices.map((choice) => (
              <button
                key={choice.id}
                disabled={choice.disabled}
                onClick={() => {
                  if (screen === 'Upgrade') {
                    onUpgrade?.(choice.id);
                    return;
                  }
                  if (screen === 'RemoveCard') {
                    onRemoveCard?.(choice.id);
                    return;
                  }
                  if (screen === 'Enchant') {
                    onApplyEnchantment?.(choice.id);
                    return;
                  }
                  onUpgradeRelic?.(choice.id);
                }}
                className="runtime-v2-surface-btn"
                data-action={
                  screen === 'Upgrade'
                    ? 'upgrade-card'
                    : screen === 'RemoveCard'
                      ? 'remove-card'
                      : screen === 'Enchant'
                        ? 'enchant-card'
                        : 'upgrade-relic'
                }
                data-card-token={screen === 'Enchant' || screen === 'Upgrade' || screen === 'RemoveCard' ? choice.id : undefined}
                data-relic-id={screen === 'RelicUpgrade' ? choice.id : undefined}
              >
                {choice.label}
              </button>
            ))}
          </div>
        ) : null}
        {(screen === 'Upgrade' || screen === 'RemoveCard' || screen === 'Enchant' || screen === 'RelicUpgrade') && onCancelSurface ? (
          <button onClick={onCancelSurface} className="runtime-v2-surface-btn" data-action="cancel-surface">
            取消并返回
          </button>
        ) : null}
        {screen === 'Enchant' && !room?.choices?.length ? (
          <div className="runtime-v2-surface-note">当前没有可附魔的目标。</div>
        ) : null}
        {screen === 'RelicUpgrade' && !room?.choices?.length ? (
          <div className="runtime-v2-surface-note">当前没有可升级的遗物。</div>
        ) : null}
        {screen === 'Victory' ? (
          <div className="runtime-v2-surface-note">本次远征已经结束，可使用顶部控件保存或开启新局。</div>
        ) : null}
        {screen === 'GameOver' ? (
          <div className="runtime-v2-surface-note">当前运行已结束，可使用顶部控件重置或切回其他入口。</div>
        ) : null}
      </div>
    </div>
  );
}
