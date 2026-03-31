import React from 'react';
import { Shield, Sword, Heart, Clock, Layers, FlaskConical } from 'lucide-react';
import { motion } from 'motion/react';
import type { GameEngine } from '@/core';
import type { IntentDisplay } from '@/types';
import { CardView } from '@/ui/views/CardView';
import { WarpDeceptionText } from '@/ui/overlays/WarpDeceptionText';
import { ASSET_PLACEHOLDERS, bindImgFallback } from '@/ui/components/assetHelpers';
import { getPotionRuntimeConfig, potionsData, relicsData } from '@/content/narrative/numericSystem';
import { grimdarkTerminology } from '@/ui/theme';
import { clampCombatInteger, clampCombatPercent, getIntentThreatLevel } from './combatViewModel';
import { COMBAT_BEATS, triggerCombatBeat, triggerScreenShake } from '@/ui/motion';

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
  renderEnemyStatuses: (statuses: Record<string, number>) => React.ReactNode | null;
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
  const enemyRefs = React.useRef<Record<string, HTMLDivElement | null>>({});
  const defeatedEnemyIdsRef = React.useRef<Set<string>>(new Set());

  React.useEffect(() => {
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
    <div className="relative flex-1 flex items-center justify-between gap-8 px-8 xl:px-12 grimdark-battlefield">
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
                  <span>剩余: {clampCombatInteger(player.energy - getPreviewCost(selectedCardPreview))} 机魂</span>
                </div>
              </div>
            )}

          {/* 玩家立绘框架 */}
          <div className="player-standee__frame grimdark-player-frame">
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
                <span className="label grimdark-label">肉体</span>
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

            {renderEnemyStatuses(player.statuses)}
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
      <div className="flex gap-8 grimdark-enemies-section">
        {state.enemies.map(enemy => (
          (() => {
            const intent = maybeMasqueradeIntent(enemy, getIntentDisplay(enemy));
            const standeeClass = getEnemyStandeeClass(enemy);
            const isDead = enemy.hp <= 0;
            const hpPct = enemy.maxHp > 0 ? Math.max(0, Math.min(100, (enemy.hp / enemy.maxHp) * 100)) : 0;
            const enemyHpNow = Math.max(0, Math.round(enemy.hp));
            const enemyMaxHpNow = Math.max(0, Math.round(enemy.maxHp));
            const imageUrl =
              enemy.autonomyState === 'ChaosEgg'
                ? '/assets/enemies/chaos_egg.png'
                : enemy.autonomyState === 'Martyr'
                  ? '/assets/enemies/martyr_frenzy.png'
                  : `/assets/enemies/${enemy.defId}.png`;
            const toneClass =
              intent.tone === 'attack' ? 'grimdark-intent--attack' :
              intent.tone === 'block' ? 'grimdark-intent--block' :
              intent.tone === 'status' ? 'grimdark-intent--status' :
              intent.tone === 'hybrid' ? 'grimdark-intent--hybrid' : 'grimdark-intent--neutral';
            const threatLevel = getIntentThreatLevel(intent);
            return (
          <div 
            key={enemy.id} 
            ref={(element) => {
              enemyRefs.current[enemy.id] = element;
            }}
            className={[
              'enemy-standee grimdark-enemy-standee',
              standeeClass,
              selectedCard ? 'is-targetable' : '',
              selectedCard ? 'is-targeting' : '',
              isDead ? 'is-dead' : '',
              enemy.autonomyState === 'ChaosEgg' ? 'grimdark-enemy--chaos-egg' : '',
              enemy.autonomyState === 'Martyr' ? 'grimdark-enemy--martyr' : ''
            ].filter(Boolean).join(' ')}
            onClick={() => handleEnemyClick(enemy.id)}
            onMouseEnter={() => setHoveredEnemyId(enemy.id)}
            onMouseLeave={() => setHoveredEnemyId(null)}
            role="button"
            tabIndex={0}
            data-keyboard-focus="true"
            data-keyboard-target="true"
            data-keyboard-enemy-id={enemy.id}
            aria-label={enemy.name}
          >
            {/* 敌人意图 */}
            <div className={`enemy-standee__intent grimdark-enemy-intent ${toneClass}`}>
              <div className="enemy-standee__intentHeader">
                <div className="enemy-standee__intentIcon grimdark-enemy-intent-icon">{intent.icon}</div>
                <div className="enemy-standee__intentTextBlock">
                  <div className="enemy-standee__intentValue grimdark-enemy-intent-value">{intent.text}</div>
                  <div className="enemy-standee__intentMeta">{threatLevel}</div>
                </div>
              </div>
              {intent.isWarpMasquerade && (
                <div className="grimdark-masquerade-badge">
                  伪装
                </div>
              )}
              {intent.breakdown.totalDamage > 0 && (() => {
                const playerMaxHp = engine.state.player.maxHp;
                const playerHp = engine.state.player.hp;
                const damageRatio = intent.breakdown.totalDamage / playerMaxHp;
                const isLethal = intent.breakdown.totalDamage >= playerHp;
                const isCritical = damageRatio >= 0.5;
                const isWarning = damageRatio >= 0.3;
                if (isLethal) {
                  return (
                    <div className="enemy-standee__intentWarning grimdark-intent-warning grimdark-intent-warning--lethal" title="致命伤害预警">
                      <span>⚠️ 致命</span>
                    </div>
                  );
                }
                if (isCritical) {
                  return (
                    <div className="enemy-standee__intentWarning grimdark-intent-warning grimdark-intent-warning--critical" title="高风险伤害预警">
                      <span>⚠️ 危险</span>
                    </div>
                  );
                }
                if (isWarning) {
                  return (
                    <div className="enemy-standee__intentWarning grimdark-intent-warning grimdark-intent-warning--warning" title="中等风险伤害预警">
                      <span>⚡ 警告</span>
                    </div>
                  );
                }
                return null;
              })()}
              {hasIntelRead && (intent.breakdown.totalDamage > 0 || intent.breakdown.block > 0 || intent.breakdown.statuses.length > 0 || intent.breakdown.extras.length > 0) && (
                <div className="enemy-standee__intentBreakdown grimdark-intent-breakdown">
                  {intent.breakdown.totalDamage > 0 && (
                    <div className="enemy-standee__intentChip grimdark-intent-chip grimdark-intent-chip--damage" title="预估总创伤 (考虑力量/虚弱/易伤)">
                      <span>创伤</span>
                      <strong><WarpDeceptionText realValue={intent.breakdown.totalDamage} warpTide={state.warpTide} type="damage" /></strong>
                      {intent.breakdown.hits.length > 1 && <em>{formatHitBreakdown(intent.breakdown.hits)}</em>}
                    </div>
                  )}
                  {intent.breakdown.block > 0 && (
                    <div className="enemy-standee__intentChip grimdark-intent-chip grimdark-intent-chip--block" title="预估虚空盾增益">
                      <span>护盾</span>
                      <strong>+<WarpDeceptionText realValue={intent.breakdown.block} warpTide={state.warpTide} type="block" /></strong>
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
              {selectedCard && <div className="enemy-standee__targetRing grimdark-target-ring" />}
            </div>

            {/* 敌人HUD */}
            <div className="enemy-standee__hud grimdark-enemy-hud">
              <div className="enemy-standee__hpBar grimdark-enemy-hp-bar">
                <div className="enemy-standee__hpFill grimdark-enemy-hp-fill" style={{ width: `${hpPct}%` }} />
                <div className="enemy-standee__hpText grimdark-enemy-hp-text" key={`enemyhp-${enemy.id}-${enemyHpNow}-${enemyMaxHpNow}`}>{enemyHpNow}/{enemyMaxHpNow}</div>
              </div>
              {renderEnemyStatuses(enemy.statuses)}
              {renderAxisGauge(enemy)}
            </div>
          </div>
            );
          })()
        ))}
      </div>
    </div>
  );
}
