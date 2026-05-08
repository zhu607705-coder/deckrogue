/**
 * @file Battlefield.tsx
 * @description 战场组件 - 渲染战斗场景和敌我双方站位
 *
 * 主要职责:
 * - 渲染战场布局和背景
 * - 显示敌人立牌和状态
 * - 处理目标选择
 * - 显示扭曲欺诈文本
 */

import React, { useRef, useEffect } from 'react';
import { Shield, Sword, Heart, Clock, Layers, FlaskConical } from 'lucide-react';
import { motion } from 'motion/react';
import type { GameEngine } from '@/core';
import type { IntentDisplay } from '@/types';
import { CardView } from '@/ui/views/CardView';
import { WarpDeceptionText } from '@/ui/overlays/WarpDeceptionText';
import { ASSET_PLACEHOLDERS, bindImgFallback } from '@/ui/components/assetHelpers';
import { getPotionRuntimeConfig } from '@/content/narrative/numericSystem';
import { grimdarkTerminology } from '@/ui/theme';
import { clampCombatInteger, clampCombatPercent } from './combatViewModel';
import { COMBAT_BEATS, triggerCombatBeat, triggerScreenShake } from '@/ui/motion';
import { EnemyStandee } from './EnemyStandee';

type RuntimeCombat = NonNullable<GameEngine['state']['combat']>;
type RuntimeEnemy = RuntimeCombat['enemies'][number];
type RuntimePlayer = RuntimeCombat['player'];
type RuntimeConstruct = NonNullable<RuntimePlayer['constructs']>[number];
type RuntimeDelayedCard = NonNullable<RuntimePlayer['delayedCards']>[number];
type PreviewCard = RuntimeCombat['hand'][number];
type AxisGaugeEntity = Pick<RuntimePlayer, 'devotion' | 'corruptionAxis' | 'axisDisposition'> & { autonomyState?: string };
type RuntimeIntentTelemetry = {
  enemyId: string;
  laneY: number;
  enemyX: number;
  mode: 'direct' | 'taunt' | 'cover';
  frontlineAbsorb: number;
  frontlineLabel: string;
  playerDamage: number;
  frontlineOverflow: number;
};

interface BattlefieldProps {
  engine: GameEngine;
  selectedCard: string | null;
  setSelectedCard: (id: string | null) => void;
  hoveredEnemyId: string | null;
  setHoveredEnemyId: (id: string | null) => void;
  handleEnemyClick: (enemyId: string) => void;
  frontlineWreckage: { label: string; timestamp: number } | null;
  intentDeceptionTick: number;
  maybeMasqueradeIntent: (enemy: RuntimeEnemy, intent: IntentDisplay) => IntentDisplay;
  getIntentDisplay: (enemy: RuntimeEnemy) => IntentDisplay;
  getEnemyStandeeClass: (enemy: RuntimeEnemy) => string;
  renderEnemyStatuses: (statuses: Record<string, number>, entityId?: string) => React.ReactNode | null;
  renderAxisGauge: (entity: AxisGaugeEntity) => React.ReactNode;
  formatHitBreakdown: (hits: number[]) => string;
  hasIntelRead: boolean;
  selectedCardPreview: PreviewCard | null;
  selectedCardTargetLabel: string;
  getPreviewCost: (card: PreviewCard) => number;
  playerPortrait: string;
  playerName: string;
  playerHpPct: number;
  playerHpNow: number;
  playerMaxHpNow: number;
  intentTelemetry: RuntimeIntentTelemetry[];
  tutorialHighlightActive?: boolean;
}

export function Battlefield({
  engine,
  selectedCard,
  setSelectedCard,
  hoveredEnemyId,
  setHoveredEnemyId,
  handleEnemyClick,
  frontlineWreckage,
  intentDeceptionTick,
  maybeMasqueradeIntent,
  getIntentDisplay,
  getEnemyStandeeClass,
  renderEnemyStatuses,
  renderAxisGauge,
  formatHitBreakdown,
  hasIntelRead,
  selectedCardPreview,
  selectedCardTargetLabel,
  getPreviewCost,
  playerPortrait,
  playerName,
  playerHpPct,
  playerHpNow,
  playerMaxHpNow,
  intentTelemetry,
  tutorialHighlightActive = false
}: BattlefieldProps) {
  const state = engine.state.combat!;
  const player = state.player;
  const terms = grimdarkTerminology;
  const enemyRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const defeatedEnemyIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    state.enemies.forEach((enemy) => {
      if (enemy.hp > 0) {
        defeatedEnemyIdsRef.current.delete(enemy.id);
        return;
      }
      if (defeatedEnemyIdsRef.current.has(enemy.id)) return;
      const element = enemyRefs.current[enemy.id];
      if (element) {
        triggerCombatBeat(element, COMBAT_BEATS.KILL);
        triggerScreenShake('light');
      }
      defeatedEnemyIdsRef.current.add(enemy.id);
    });
  }, [state.enemies]);

  return (
    <div className="relative flex-1 flex flex-col md:flex-row items-center justify-between gap-4 md:gap-8 px-4 md:px-8 xl:px-12 grimdark-battlefield">
      {/* 亚空间扭曲背景效果 */}
      <div className="grimdark-warp-overlay" style={{ opacity: (state.warpTide || 0) / 100 }} />

      {/* 玩家立绘区域 */}
      <div className="flex flex-col items-center grimdark-player-section">
        <div className={`player-standee grimdark-player-standee ${state.isPlayerTurn ? 'is-player-turn' : 'is-enemy-turn'}`}>
          {/* 意图显示 */}
          <div className={`player-standee__intent grimdark-intent ${tutorialHighlightActive ? 'grimdark-intent--guided' : ''}`}>
            <div className="player-standee__intentIcon grimdark-intent-icon">{state.isPlayerTurn ? '✦' : '⏳'}</div>
            <div className="player-standee__intentValue grimdark-intent-value">
              {state.isPlayerTurn ? '指挥者行动' : '敌袭等待'}
            </div>
            <div className="player-standee__intentMeta">
              {state.isPlayerTurn ? '先看能量、手牌和敌方风险' : '等待敌方结算完成'}
            </div>
          </div>

          {/* 施法预览 */}
          {selectedCardPreview && (
            <div className="player-standee__castPreview grimdark-cast-preview">
              <div className="player-standee__castName grimdark-cast-name">{selectedCardPreview.name}</div>
                <div className="player-standee__castMeta grimdark-cast-meta">
                  <span>目标: {selectedCardTargetLabel}</span>
                  <span>消耗: {getPreviewCost(selectedCardPreview)}</span>
                  <span>剩余: {clampCombatInteger(player.energy - getPreviewCost(selectedCardPreview))} 机颂核心</span>
                </div>
              </div>
            )}

          {/* 玩家立绘框架 */}
          <div className="player-standee__frame grimdark-player-frame" aria-label={`玩家: ${playerName}, 生命值: ${playerHpNow}/${playerMaxHpNow}`}>
            {playerPortrait ? (
              <img src={playerPortrait} alt={playerName} className="player-standee__art grimdark-player-art" onError={(e) => bindImgFallback(e, ASSET_PLACEHOLDERS.character)} />
            ) : (
              <div className="player-standee__fallback grimdark-player-fallback">指挥者</div>
            )}
            <div className="player-standee__shade grimdark-player-shade" />
            <div className="player-standee__nameplate grimdark-player-nameplate">{playerName}</div>
            {player.block > 0 && (
              <div className="player-standee__armorBadge grimdark-armor-badge" title={`${terms.resources.block.name} ${player.block}`}>
                <Shield size={12} />
                <span>{player.block}</span>
              </div>
            )}
          </div>

          {/* 玩家HUD */}
          <div className="player-standee__hud grimdark-player-hud">
            {/* 玻璃管生命值 */}
            <div className="player-standee__tubeVitals grimdark-tube-vitals">
              <div className="player-standee__glassTube grimdark-glass-tube" title={`${terms.resources.hp.name} ${clampCombatInteger(player.hp)}/${clampCombatInteger(player.maxHp, 1)}`}>
                <div className={`player-standee__bloodFill grimdark-blood-fill ${playerHpPct < 30 ? 'is-critical' : ''}`} style={{ height: `${playerHpPct}%` }} />
                <div className="player-standee__glassHighlight grimdark-glass-highlight" />
                <div className="player-standee__glassCracks grimdark-glass-cracks" style={{ opacity: `${Math.max(0, clampCombatPercent(100 - playerHpPct) / 120)}` }} />
              </div>
              <div className="player-standee__tubeText grimdark-tube-text">
                <span className="value grimdark-value" key={`tubehp-${playerHpNow}-${playerMaxHpNow}`}>{playerHpNow}/{playerMaxHpNow}</span>
              </div>
            </div>

            {/* 生命值条 */}
            <div className="player-standee__hpBar grimdark-hp-bar">
              <div className="player-standee__hpFill grimdark-hp-fill" style={{ width: `${playerHpPct}%` }} />
              <div className="player-standee__hpText grimdark-hp-text" key={`barhp-${playerHpNow}-${playerMaxHpNow}`}>{playerHpNow}/{playerMaxHpNow}</div>
            </div>

            {/* 资源显示 */}
            <div className="player-standee__resources grimdark-resources">
              <div className="player-standee__resource player-standee__resource--energy grimdark-resource grimdark-resource--energy" title={terms.resources.energy.name}>
                <Clock size={12} /> {player.energy}/{engine.state.player.maxEnergy}
              </div>
              <div className="player-standee__resource player-standee__resource--intel grimdark-resource grimdark-resource--intel" title={terms.resources.intel.name}>
                <Layers size={12} /> {engine.state.player.intel}
              </div>
              {engine.state.character?.id === 'chronomancer' && (
                <div className="player-standee__resource player-standee__resource--timelayer grimdark-resource grimdark-resource--timelayer" title={terms.mechanics.timeLayer.name}>
                  <Clock size={12} /> {player.timeLayer || 0}
                </div>
              )}
              {engine.state.character?.id === 'puppeteer' && (
                <div className="player-standee__resource player-standee__resource--thread grimdark-resource grimdark-resource--thread" title={terms.mechanics.thread.name}>
                  <Layers size={12} /> {player.thread || 0}
                </div>
              )}
              {engine.state.character?.id === 'alchemist' && (
                <div className="player-standee__resource player-standee__resource--concoction grimdark-resource grimdark-resource--concoction" title={terms.mechanics.concoction.name}>
                  <FlaskConical size={12} /> {player.concoction || 0}
                </div>
              )}
            </div>

            {renderEnemyStatuses(player.statuses, 'player')}
            {renderAxisGauge(player)}
          </div>
        </div>

        {/* 元素显示 */}
        {player.elements && player.elements.length > 0 && (
          <div className="flex gap-1 mt-2 grimdark-elements">
            {player.elements.map((el: string, i: number) => (
              <div key={i} className={`grimdark-element grimdark-element--${el.toLowerCase()}`} title={el} />
            ))}
          </div>
        )}

        {/* 延迟卡牌 */}
        {player.delayedCards && player.delayedCards.length > 0 && (
          <div className="flex gap-1 mt-4 grimdark-delayed-cards">
            {player.delayedCards.map((d: RuntimeDelayedCard, i: number) => (
              <div key={i} className="grimdark-delayed-card" title={d.card.name}>
                <span>{d.card.name}</span>
                <span className="grimdark-delayed-turns">{d.turns}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 前线阵地 */}
      <div className="relative z-10 flex-1 max-w-[420px] h-full mx-2 grimdark-frontline-zone">
        <svg
          className="absolute inset-0 w-full h-full z-0 pointer-events-none grimdark-intent-svg"
          style={{ filter: 'drop-shadow(0 0 6px rgba(139, 26, 26, 0.4))' }}
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <defs>
            <marker id="combat-arrow-red" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
              <polygon points="0 0, 6 3, 0 6" fill="#8b1a1a" />
            </marker>
            <marker id="combat-arrow-darkred" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
              <polygon points="0 0, 6 3, 0 6" fill="#5c1212" />
            </marker>
          </defs>
          {intentTelemetry.map((tele) => {
            const lineY = tele.laneY;
            const enemyXLocal = Math.max(76, Math.min(98, tele.enemyX));
            const frontlineX = 52;
            const playerXLocal = 12;
            return (
              <g key={`intent-path-${tele.enemyId}`}>
                {tele.mode !== 'direct' && tele.frontlineAbsorb > 0 && (
                  <>
                    <line
                      x1={enemyXLocal}
                      y1={lineY}
                      x2={frontlineX}
                      y2={50}
                      stroke="#8b1a1a"
                      strokeWidth={hasIntelRead ? Math.max(1.8, Math.min(4.5, 1.4 + tele.frontlineAbsorb / 10)) : 2.6}
                      markerEnd="url(#combat-arrow-red)"
                      opacity={0.92}
                    />
                    <text
                      x={(enemyXLocal + frontlineX) / 2}
                      y={Math.max(8, lineY - 3)}
                      fill="#dc4444"
                      fontSize="3.2"
                      fontWeight="700"
                      textAnchor="middle"
                    >
                      {tele.frontlineLabel}
                    </text>
                  </>
                )}
                {tele.playerDamage > 0 && (
                  <>
                    <motion.line
                      x1={tele.mode === 'direct' ? enemyXLocal : frontlineX}
                      y1={tele.mode === 'direct' ? lineY : 50}
                      x2={playerXLocal}
                      y2={50}
                      stroke={hasIntelRead ? (tele.frontlineOverflow > 0 ? '#5c1212' : '#8b1a1a') : '#8b1a1a'}
                      strokeWidth={hasIntelRead ? (tele.frontlineOverflow > 0 ? 3.6 : 2.6) : 2.8}
                      strokeDasharray={hasIntelRead && tele.frontlineOverflow > 0 ? '2.6 2.2' : '0'}
                      markerEnd="url(#combat-arrow-darkred)"
                      animate={hasIntelRead && tele.frontlineOverflow > 0 ? { strokeDashoffset: [0, -5] } : undefined}
                      transition={hasIntelRead && tele.frontlineOverflow > 0 ? { repeat: Infinity, duration: 0.35, ease: 'linear' } : undefined}
                      opacity={0.95}
                    />
                    <text
                      x={tele.mode === 'direct' ? ((enemyXLocal + playerXLocal) / 2) : ((frontlineX + playerXLocal) / 2)}
                      y={hasIntelRead ? (tele.frontlineOverflow > 0 ? 43 : 46) : 45}
                      fill={hasIntelRead ? (tele.frontlineOverflow > 0 ? '#dc4444' : '#ff6b6b') : '#ff6b6b'}
                      fontSize={hasIntelRead ? (tele.frontlineOverflow > 0 ? '4.1' : '3.1') : '3.1'}
                      fontWeight={hasIntelRead ? (tele.frontlineOverflow > 0 ? '900' : '700') : '700'}
                      textAnchor="middle"
                    >
                      {hasIntelRead
                        ? (tele.frontlineOverflow > 0 ? `-${tele.playerDamage} 溢出致命伤` : `-${tele.playerDamage} 直击`)
                        : '创伤路径'}
                    </text>
                  </>
                )}
              </g>
            );
          })}
        </svg>

        <div className="absolute inset-y-6 left-1/2 -translate-x-1/2 w-[82%] rounded-2xl border border-dashed grimdark-frontline-container">
          <div className="pt-8 pb-4 px-4 h-full flex flex-col">
            <div className="text-[10px] tracking-[0.26em] uppercase grimdark-frontline-label mb-3">
              {terms.combat.frontline.name}
            </div>

            <div className="flex-1 flex items-center justify-center">
              {(player.constructs?.length || 0) > 0 ? (
                <div className="flex flex-wrap justify-center gap-3 grimdark-constructs">
                  {player.constructs.map((c: RuntimeConstruct, i: number) => (
                    <motion.div
                      key={`${c.id}-${i}`}
                      whileHover={{ scale: 1.04 }}
                      className={`grimdark-construct ${
                        c.taunt
                          ? 'grimdark-construct--taunt'
                          : (c.damageSharePct || 0) > 0
                            ? 'grimdark-construct--cover'
                            : 'grimdark-construct--normal'
                      }`}
                      title={
                        c.taunt
                          ? '嘲讽：优先承受攻击（溢出可能穿透）'
                          : (c.damageSharePct || 0) > 0
                            ? `战壕掩体：分担约 ${Math.round((c.damageSharePct || 0) * 100)}% 玩家受击伤害`
                            : c.name
                      }
                      aria-label={`构造物: ${c.name}, 生命值: ${c.hp}/${c.maxHp}, 攻击力: ${c.atk}`}
                    >
                      <div className="grimdark-construct-name">{c.name}</div>
                      <div className="grimdark-construct-stat grimdark-construct-stat--hp">
                        <Heart size={10} /> {c.hp}/{c.maxHp}
                      </div>
                      <div className="grimdark-construct-stat grimdark-construct-stat--atk">
                        <Sword size={10} /> {c.atk}
                      </div>
                      <div className="grimdark-construct-type">
                        {c.taunt ? '嘲讽拦截' : (c.damageSharePct || 0) > 0 ? `战壕掩体 ${Math.round((c.damageSharePct || 0) * 100)}%` : '前线单元'}
                      </div>
                      {c.taunt && <Shield size={11} className="grimdark-construct-icon" />}
                      {!c.taunt && (c.damageSharePct || 0) > 0 && (
                        <div className="grimdark-construct-badge">掩体</div>
                      )}
                    </motion.div>
                  ))}
                </div>
              ) : frontlineWreckage ? (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="grimdark-wreckage"
                  style={{
                    willChange: 'transform, opacity'
                  }}
                >
                  <div className="grimdark-wreckage-glow" />
                  <div className="grimdark-wreckage-ember" />
                  <span className="grimdark-wreckage-text">{frontlineWreckage.label}</span>
                </motion.div>
              ) : (
                <div className="grimdark-frontline-empty">
                  防线空缺
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 敌人区域 */}
      <div className="flex flex-wrap justify-center gap-4 md:gap-8 grimdark-enemies-section">
        {state.enemies.map(enemy => (
          <EnemyStandee
            key={enemy.id}
            enemy={enemy}
            engine={engine}
            selectedCard={selectedCard}
            onClick={() => handleEnemyClick(enemy.id)}
            onMouseEnter={() => setHoveredEnemyId(enemy.id)}
            onMouseLeave={() => setHoveredEnemyId(null)}
            maybeMasqueradeIntent={maybeMasqueradeIntent}
            getIntentDisplay={getIntentDisplay}
            getEnemyStandeeClass={getEnemyStandeeClass}
            renderEnemyStatuses={renderEnemyStatuses}
            renderAxisGauge={renderAxisGauge}
            formatHitBreakdown={formatHitBreakdown}
            hasIntelRead={hasIntelRead}
            enemyRef={(element) => { enemyRefs.current[enemy.id] = element; }}
          />
        ))}
      </div>
    </div>
  );
}
