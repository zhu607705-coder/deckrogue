/**
 * @file EnemyStandee.tsx
 * @description 敌人立牌组件 - 渲染单个敌人的立牌、意图和状态
 *
 * 主要职责:
 * - 渲染敌人图片和状态栏
 * - 显示敌人意图图标和数值
 * - 支持扭曲欺诈文本
 * - 提供选中/目标高亮
 */

import React from 'react';
import { Shield } from 'lucide-react';
import { motion } from 'motion/react';
import type { GameEngine } from '@/core';
import type { IntentDisplay } from '@/types';
import { WarpDeceptionText } from '@/ui/overlays/WarpDeceptionText';
import { ASSET_PLACEHOLDERS, bindImgFallback, localEnemyArt } from '@/ui/components/assetHelpers';
import { grimdarkTerminology } from '@/ui/theme';
import { getIntentThreatLevel } from './combatViewModel';

type RuntimeEnemy = NonNullable<GameEngine['state']['combat']>['enemies'][number];

interface EnemyStandeeProps {
  enemy: RuntimeEnemy;
  engine: GameEngine;
  selectedCard: string | null;
  onClick: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  maybeMasqueradeIntent: (enemy: RuntimeEnemy, intent: IntentDisplay) => IntentDisplay;
  getIntentDisplay: (enemy: RuntimeEnemy) => IntentDisplay;
  getEnemyStandeeClass: (enemy: RuntimeEnemy) => string;
  renderEnemyStatuses: (statuses: Record<string, number>, entityId?: string) => React.ReactNode | null;
  renderAxisGauge: (entity: { devotion: number; corruptionAxis?: number; axisDisposition?: string; autonomyState?: string }) => React.ReactNode;
  formatHitBreakdown: (hits: number[]) => string;
  hasIntelRead: boolean;
  enemyRef?: (element: HTMLDivElement | null) => void;
}

export const EnemyStandee = React.memo(function EnemyStandee({
  enemy,
  engine,
  selectedCard,
  onClick,
  onMouseEnter,
  onMouseLeave,
  maybeMasqueradeIntent,
  getIntentDisplay,
  getEnemyStandeeClass,
  renderEnemyStatuses,
  renderAxisGauge,
  formatHitBreakdown,
  hasIntelRead,
  enemyRef
}: EnemyStandeeProps) {
  const intent = maybeMasqueradeIntent(enemy, getIntentDisplay(enemy));
  const standeeClass = getEnemyStandeeClass(enemy);
  const isDead = enemy.hp <= 0;
  const hpPct = enemy.maxHp > 0 ? Math.max(0, Math.min(100, (enemy.hp / enemy.maxHp) * 100)) : 0;
  const enemyHpNow = Math.max(0, Math.round(enemy.hp));
  const enemyMaxHpNow = Math.max(0, Math.round(enemy.maxHp));
  const imageUrl =
    enemy.autonomyState === 'ChaosEgg'
      ? localEnemyArt('chaos_egg')
      : enemy.autonomyState === 'Martyr'
        ? localEnemyArt('martyr_frenzy')
        : localEnemyArt(enemy.defId);
  const toneClass =
    intent.tone === 'attack' ? 'grimdark-intent--attack' :
    intent.tone === 'block' ? 'grimdark-intent--block' :
    intent.tone === 'status' ? 'grimdark-intent--status' :
    intent.tone === 'hybrid' ? 'grimdark-intent--hybrid' : 'grimdark-intent--neutral';
  const threatLevel = getIntentThreatLevel(intent);
  const terms = grimdarkTerminology;

  return (
    <div
      ref={enemyRef}
      className={[
        'enemy-standee grimdark-enemy-standee',
        standeeClass,
        selectedCard && !isDead ? 'is-targetable' : '',
        selectedCard && !isDead ? 'is-targeting' : '',
        isDead ? 'is-dead' : '',
        enemy.autonomyState === 'ChaosEgg' ? 'grimdark-enemy--chaos-egg' : '',
        enemy.autonomyState === 'Martyr' ? 'grimdark-enemy--martyr' : ''
      ].filter(Boolean).join(' ')}
      style={{ transition: 'all 0.2s ease-in-out' }}
      onClick={isDead ? undefined : onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      role="button"
      tabIndex={isDead ? -1 : 0}
      aria-disabled={isDead}
      data-keyboard-focus={isDead ? undefined : 'true'}
      data-keyboard-target={isDead ? undefined : 'true'}
      data-keyboard-enemy-id={enemy.id}
      aria-label={`目标: ${enemy.name}, 生命值: ${enemyHpNow}/${enemyMaxHpNow}`}
      aria-describedby={`enemy-intent-${enemy.id}`}
    >
      {/* 敌人意图 */}
      <div id={`enemy-intent-${enemy.id}`} className={`enemy-standee__intent grimdark-enemy-intent ${toneClass}`} aria-live="polite">
        <div className="enemy-standee__intentHeader">
          <div className="enemy-standee__intentIcon grimdark-enemy-intent-icon">{intent.icon}</div>
          <div className="enemy-standee__intentTextBlock">
            <div className="enemy-standee__intentValue grimdark-enemy-intent-value">{intent.text}</div>
            <div className="enemy-standee__intentMeta">{threatLevel}</div>
          </div>
        </div>
        {intent.isWarpMasquerade && (
          <div className="grimdark-masquerade-badge">伪装</div>
        )}
        <IntentWarnings
          intent={intent}
          playerHp={engine.state.player.hp}
          playerMaxHp={engine.state.player.maxHp}
        />
        {hasIntelRead && (intent.breakdown.totalDamage > 0 || intent.breakdown.block > 0 || intent.breakdown.statuses.length > 0 || intent.breakdown.extras.length > 0) && (
          <IntentBreakdown
            intent={intent}
            warpTide={engine.state.combat?.warpTide || 0}
            formatHitBreakdown={formatHitBreakdown}
          />
        )}
      </div>

      {/* 敌人立绘框架 */}
      <div className="enemy-standee__frame grimdark-enemy-frame">
        <img src={imageUrl} alt={enemy.name} className="enemy-standee__art grimdark-enemy-art" onError={(e) => bindImgFallback(e, ASSET_PLACEHOLDERS.enemy)} />
        <div className="enemy-standee__shade grimdark-enemy-shade" />
        <div className="enemy-standee__nameplate grimdark-enemy-nameplate">{enemy.name}</div>
        {enemy.block > 0 && (
          <div className="enemy-standee__armorBadge grimdark-enemy-armor" title={`${terms.resources.block.name} ${enemy.block}`}>
            <Shield size={12} />
            <span>{enemy.block}</span>
          </div>
        )}
        {selectedCard && !isDead && <div className="enemy-standee__targetRing grimdark-target-ring" />}
      </div>

      {/* 敌人HUD */}
      <div className="enemy-standee__hud grimdark-enemy-hud">
        <div className="enemy-standee__hpBar grimdark-enemy-hp-bar">
          <div className="enemy-standee__hpFill grimdark-enemy-hp-fill" style={{ width: `${hpPct}%` }} />
          <div className="enemy-standee__hpText grimdark-enemy-hp-text" key={`enemyhp-${enemy.id}-${enemyHpNow}-${enemyMaxHpNow}`}>{enemyHpNow}/{enemyMaxHpNow}</div>
        </div>
        {renderEnemyStatuses(enemy.statuses, enemy.id)}
        {renderAxisGauge(enemy)}
      </div>
    </div>
  );
});

function IntentWarnings({
  intent,
  playerHp,
  playerMaxHp
}: {
  intent: IntentDisplay;
  playerHp: number;
  playerMaxHp: number;
}) {
  if (intent.breakdown.totalDamage <= 0) return null;

  const damageRatio = intent.breakdown.totalDamage / playerMaxHp;
  const isLethal = intent.breakdown.totalDamage >= playerHp;
  const isCritical = damageRatio >= 0.5;
  const isWarning = damageRatio >= 0.3;

  if (isLethal) {
    return (
      <motion.div
        className="enemy-standee__intentWarning grimdark-intent-warning grimdark-intent-warning--lethal"
        title="致命伤害预警"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: [1, 1.08, 1], opacity: 1 }}
        style={{ willChange: 'transform, opacity' }}
        transition={{ scale: { repeat: Infinity, duration: 1.2, ease: "easeInOut" }, opacity: { duration: 0.3 } }}
      >
        <span className="animate-pulse">💀 致命</span>
      </motion.div>
    );
  }
  if (isCritical) {
    return (
      <motion.div
        className="enemy-standee__intentWarning grimdark-intent-warning grimdark-intent-warning--critical"
        title="高风险伤害预警"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: [1, 1.05, 1], opacity: 1 }}
        style={{ willChange: 'transform, opacity' }}
        transition={{ scale: { repeat: Infinity, duration: 1.6, ease: "easeInOut" }, opacity: { duration: 0.3 } }}
      >
        <span>⚠️ 危险</span>
      </motion.div>
    );
  }
  if (isWarning) {
    return (
      <motion.div
        className="enemy-standee__intentWarning grimdark-intent-warning grimdark-intent-warning--warning"
        title="中等风险伤害预警"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <span>⚡ 警告</span>
      </motion.div>
    );
  }
  return null;
}

function IntentBreakdown({
  intent,
  warpTide,
  formatHitBreakdown
}: {
  intent: IntentDisplay;
  warpTide: number;
  formatHitBreakdown: (hits: number[]) => string;
}) {
  return (
    <div className="enemy-standee__intentBreakdown grimdark-intent-breakdown">
      {intent.breakdown.totalDamage > 0 && (
        <div className="enemy-standee__intentChip grimdark-intent-chip grimdark-intent-chip--damage" title="预估总创伤 (考虑力量/虚弱/易伤)">
          <span>创伤</span>
          <strong><WarpDeceptionText realValue={intent.breakdown.totalDamage} warpTide={warpTide} type="damage" /></strong>
          {intent.breakdown.hits.length > 1 && <em>{formatHitBreakdown(intent.breakdown.hits)}</em>}
        </div>
      )}
      {intent.breakdown.block > 0 && (
        <div className="enemy-standee__intentChip grimdark-intent-chip grimdark-intent-chip--block" title="预估护盾增益">
          <span>护盾</span>
          <strong>+<WarpDeceptionText realValue={intent.breakdown.block} warpTide={warpTide} type="block" /></strong>
        </div>
      )}
      {intent.breakdown.statuses.slice(0, 2).map((s, idx: number) => (
        <div
          key={`${s.status}_${idx}`}
          className="enemy-standee__intentChip grimdark-intent-chip grimdark-intent-chip--status"
          title={`状态: ${s.status} ${s.amount > 0 ? `+${s.amount}` : ''} (${s.target})`}
        >
          <span>{s.target === 'self' ? '自身' : '目标'}</span>
          <strong>{s.status}</strong>
          {s.amount > 0 && <em>+{s.amount}</em>}
        </div>
      ))}
      {intent.breakdown.extras.slice(0, 2).map((extra: string, idx: number) => (
        <div key={`${extra}_${idx}`} className="enemy-standee__intentChip grimdark-intent-chip grimdark-intent-chip--extra" title={extra}>
          <span>特效</span>
          <strong>{extra}</strong>
        </div>
      ))}
    </div>
  );
}
