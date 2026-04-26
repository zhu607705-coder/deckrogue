/**
 * @file CombatView.tsx
 * @description 战斗视图 - 游戏核心战斗界面
 *
 * 主要职责:
 * - 渲染战场和敌我双方站位
 * - 管理手牌区和行动牌操作
 * - 显示敌人意图和状态
 * - 处理卡牌使用和目标选择
 * - 集成战斗 HUD 和各种模态框
 * - 支持 Warp Eye 机制可视化
 *
 * 架构说明:
 * - 组合 Battlefield、ActionHand、WarpEye、CombatHUD 等子组件
 * - 通过 hooks 管理战斗遥测、意图伪装、卡牌预览
 */
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Cog, Clock, Crown } from 'lucide-react';
import StatusAnimation from '@/ui/animations/StatusAnimation';
import { loadMetaProfile, type GameEngine } from '@/core';
import type { CardDef } from '@/core';
import { enemiesData } from '@/content/narrative/numericSystem';
import { BackgroundVisualMode, getCombatBackgroundTuning } from '@/ui/components/backgroundVisuals';
import { VoxLogPanel } from '@/ui/components/VoxLogPanel';
import { getCardTargetingZh } from '@/ui/content/terminology';
import { uiBattleBackgrounds } from '@/ui/content/battleBackgrounds';
import { uiWorldLore } from '@/ui/content/worldLore';
import { GlossaryText } from '@/ui/components/GlossaryText';
import { CombatHUD, WarpEye, Battlefield, ActionHand } from './combat';
import { DeckModal, DrawPileModal, DiscardPileModal } from './combat/modals';
import { useIntentMasquerade, useCardPreview, useCombatTelemetry } from '@/ui/hooks';
import type { IntentDisplay } from '@/types';
import { TutorialView } from '@/ui/views/TutorialView';
import { ErrorBoundary } from '@/ui/components/ErrorBoundary';

interface WorldLoreData {
  termGlossary?: Record<string, { zh: string; en?: string; description?: string }>;
}

const WORLD_LORE = uiWorldLore as unknown as WorldLoreData;
const GLOSSARY = WORLD_LORE?.termGlossary || {};

const cardBackThemes = {
  mechanical: {
    name: '机械纹',
    palette: {
      primary: 'rgba(30, 64, 175, 0.25)',
      secondary: 'rgba(56, 189, 248, 0.18)',
      accent: 'rgba(148, 163, 184, 0.3)',
      border: 'border-slate-600/80',
      innerBorder: 'border-slate-500/35',
      outerBorder: 'border-slate-700/70',
      bg: 'bg-slate-950',
      innerBg: 'bg-slate-900/60',
      labelBg: 'bg-slate-950/80',
      textColor: 'text-slate-300',
      iconColor: 'text-slate-300/90',
      countBorder: 'border-slate-500',
      countBg: 'bg-slate-900'
    },
    gradients: [
      'radial-gradient(circle at 24% 18%, rgba(30, 64, 175, 0.25), transparent 42%)',
      'radial-gradient(circle at 76% 82%, rgba(56, 189, 248, 0.18), transparent 48%)',
      'linear-gradient(180deg, rgba(15, 23, 42, 0.95), rgba(2, 6, 23, 0.98))'
    ],
    patterns: [
      'linear-gradient(45deg, transparent 46%, rgba(148, 163, 184, 0.25) 48%, transparent 50%), linear-gradient(-45deg, transparent 46%, rgba(148, 163, 184, 0.18) 48%, transparent 50%)'
    ],
    patternSize: '18px 18px',
    label: '机械装置',
    icon: 'cog'
  },
  subspace: {
    name: '亚空间纹',
    palette: {
      primary: 'rgba(148, 163, 184, 0.22)',
      secondary: 'rgba(59, 130, 246, 0.2)',
      accent: 'rgba(168, 85, 247, 0.18)',
      border: 'border-blue-600/70',
      innerBorder: 'border-blue-500/35',
      outerBorder: 'border-blue-700/70',
      bg: 'bg-slate-950',
      innerBg: 'bg-slate-900/60',
      labelBg: 'bg-slate-950/80',
      textColor: 'text-blue-300',
      iconColor: 'text-blue-300/90',
      countBorder: 'border-blue-500',
      countBg: 'bg-slate-900'
    },
    gradients: [
      'radial-gradient(circle at 24% 18%, rgba(59, 130, 246, 0.22), transparent 42%)',
      'radial-gradient(circle at 76% 82%, rgba(168, 85, 247, 0.18), transparent 48%)',
      'linear-gradient(180deg, rgba(15, 23, 42, 0.95), rgba(30, 27, 75, 0.98))'
    ],
    patterns: [
      'linear-gradient(90deg, transparent 46%, rgba(148, 163, 184, 0.2) 48%, transparent 50%), linear-gradient(0deg, transparent 46%, rgba(168, 85, 247, 0.15) 48%, transparent 50%)'
    ],
    patternSize: '20px 20px',
    label: '亚空间',
    icon: 'clock'
  },
  imperial: {
    name: '帝国纹',
    palette: {
      primary: 'rgba(180, 83, 9, 0.25)',
      secondary: 'rgba(220, 38, 38, 0.18)',
      accent: 'rgba(234, 179, 8, 0.22)',
      border: 'border-yellow-600/70',
      innerBorder: 'border-yellow-500/35',
      outerBorder: 'border-yellow-700/70',
      bg: 'bg-slate-950',
      innerBg: 'bg-slate-900/60',
      labelBg: 'bg-slate-950/80',
      textColor: 'text-yellow-300',
      iconColor: 'text-yellow-300/90',
      countBorder: 'border-yellow-500',
      countBg: 'bg-slate-900'
    },
    gradients: [
      'radial-gradient(circle at 24% 18%, rgba(180, 83, 9, 0.25), transparent 42%)',
      'radial-gradient(circle at 76% 82%, rgba(220, 38, 38, 0.18), transparent 48%)',
      'linear-gradient(180deg, rgba(28, 25, 23, 0.95), rgba(23, 19, 17, 0.98))'
    ],
    patterns: [
      'linear-gradient(135deg, transparent 46%, rgba(234, 179, 8, 0.18) 48%, transparent 50%), linear-gradient(45deg, transparent 46%, rgba(180, 83, 9, 0.15) 48%, transparent 50%)'
    ],
    patternSize: '22px 22px',
    label: '帝国军',
    icon: 'crown'
  }
};

const characterToTheme: Record<string, string> = {
  'puppeteer': 'mechanical',
  'chronomancer': 'subspace',
  'informant': 'subspace',
  'tactician': 'imperial',
  'brute': 'imperial',
  'alchemist': 'imperial'
};

const defaultTheme = 'subspace';

interface CombatViewProps {
  engine: GameEngine;
  backgroundVisualMode?: BackgroundVisualMode;
}

export function CombatView({
  engine,
  backgroundVisualMode = 'balanced'
}: CombatViewProps) {
  if (!engine || !engine.state.combat) {
    return null;
  }

  const state = engine.state.combat;
  const player = state.player;

  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [showDeck, setShowDeck] = useState(false);
  const [showDrawPile, setShowDrawPile] = useState(false);
  const [showDiscardPile, setShowDiscardPile] = useState(false);
  const [useIntelForDrawPile, setUseIntelForDrawPile] = useState(false);
  const [hoveredEnemyId, setHoveredEnemyId] = useState<string | null>(null);
  const [isOverdriveShake, setIsOverdriveShake] = useState(false);
  const [overdriveFlash, setOverdriveFlash] = useState(false);
  const [frontlineWreckage, setFrontlineWreckage] = useState<{ label: string; timestamp: number } | null>(null);
  const [showCombatGuide, setShowCombatGuide] = useState(() => {
    try {
      return (loadMetaProfile().runHistory?.length || 0) === 0;
    } catch {
      return false;
    }
  });
  const [showTutorialOverlay, setShowTutorialOverlay] = useState(false);

  const lastOverdriveMarkerRef = useRef<string>('');
  const previousConstructsRef = useRef<Array<{ name: string; hp: number; maxHp: number; atk: number }>>([]);

  const playerHpNow = Math.max(0, Math.round(player.hp));
  const playerMaxHpNow = Math.max(0, Math.round(player.maxHp));
  const playerHpPct = player.maxHp > 0 ? Math.max(0, Math.min(100, (player.hp / player.maxHp) * 100)) : 0;
  const intelNow = Math.max(0, engine.state.player.intel || 0);
  const hasIntelRead = intelNow > 0;

  const playerPortrait = engine.state.player.portraitUrl || engine.loadCharacterPortrait();
  const playerName = engine.state.character?.name || 'Player';
  const shouldHighlightTutorial = showCombatGuide && state.isPlayerTurn && state.turn <= 2;
  const shouldCompactCombatGuide = shouldHighlightTutorial && player.cardsPlayedThisTurn > 0;

  const bgTuning = getCombatBackgroundTuning(backgroundVisualMode);
  const battleBackgrounds = uiBattleBackgrounds as any;

  const enemyDefById = useMemo(
    () => new Map((enemiesData as any[]).map((def: any) => [def.id, def])),
    []
  );

  const battleTheme = useMemo(() => {
    const enemyIdToTheme = battleBackgrounds.enemyIdToTheme || {};
    const keywordFallbackToTheme = battleBackgrounds.keywordFallbackToTheme || {};
    const themes = battleBackgrounds.themes || {};
    const fallbackPool: string[] = battleBackgrounds.fallbackThemePool || [];
    const enemies = (state.enemies || []).filter((e: any) => e.hp > 0);
    const candidates = enemies.length > 0 ? enemies : (state.enemies || []);
    const sorted = [...candidates].sort((a: any, b: any) => {
      const aDef = enemyDefById.get(a.defId);
      const bDef = enemyDefById.get(b.defId);
      const aBoss = aDef?.keywords?.includes('boss') ? 2 : aDef?.keywords?.includes('elite') ? 1 : 0;
      const bBoss = bDef?.keywords?.includes('boss') ? 2 : bDef?.keywords?.includes('elite') ? 1 : 0;
      return bBoss - aBoss;
    });

    for (const enemy of sorted) {
      const key = enemyIdToTheme[enemy.defId];
      if (key && themes[key]) return { key, ...(themes[key] as any) };
    }
    for (const enemy of sorted) {
      const def = enemyDefById.get(enemy.defId);
      const keywords: string[] = def?.keywords || [];
      for (const kw of keywords) {
        const key = keywordFallbackToTheme[kw];
        if (key && themes[key]) return { key, ...(themes[key] as any) };
      }
    }

    const encounterKey = sorted.map((e: any) => e.defId).sort().join('|') || 'default';
    let hash = 0;
    for (let i = 0; i < encounterKey.length; i++) hash = (hash * 31 + encounterKey.charCodeAt(i)) >>> 0;
    const fallbackKey = fallbackPool.length > 0 ? fallbackPool[hash % fallbackPool.length] : 'ancient_ruins';
    return { key: fallbackKey, ...(themes[fallbackKey] as any) };
  }, [battleBackgrounds, enemyDefById, state.enemies]);

  const battleBackground = battleTheme?.image || '/assets/backgrounds/bg_gothic_battlefield.png';
  const tintA = battleTheme?.tints?.a || 'rgba(127,29,29,0.18)';
  const tintB = battleTheme?.tints?.b || 'rgba(88,28,135,0.16)';

  const warpTide = state.warpTide || 0;
  const warpTier = warpTide >= 70 ? 'high' : warpTide >= 30 ? 'mid' : 'low';
  const isWarpBoiling = warpTide >= 80;
  const warpOverlayOpacity = Math.max(0, Math.min(0.75, warpTide / 140));
  const warpRiftOpacity = Math.max(0, Math.min(0.6, (warpTide - 35) / 100));
  const warpStormOpacity = Math.max(0, Math.min(0.45, (warpTide - 70) / 80));

  const { intentDeceptionTick, maybeMasqueradeIntent } = useIntentMasquerade(engine);
  const { getDynamicCardText, getPreviewCost } = useCardPreview(engine);
  const { intentTelemetry } = useCombatTelemetry(engine, hoveredEnemyId);

  useEffect(() => {
    const lastPlayed = player.lastPlayedCard;
    const marker = `${state.turn}:${player.cardsPlayedThisTurn}:${lastPlayed?.instanceId || lastPlayed?.id || 'none'}`;
    if (!lastPlayed || lastPlayed.id !== 'overdrive') return;
    if (marker === lastOverdriveMarkerRef.current) return;
    lastOverdriveMarkerRef.current = marker;

    const priorConstructs = previousConstructsRef.current || [];
    const consumedCount = priorConstructs.length;
    const wreckageLabel = consumedCount > 0 ? `过载残骸 ×${consumedCount}` : '过载余烬';

    setOverdriveFlash(true);
    setIsOverdriveShake(true);

    const timeout1 = setTimeout(() => setFrontlineWreckage({ label: wreckageLabel, timestamp: Date.now() }), 120);
    const timeout2 = setTimeout(() => setOverdriveFlash(false), 280);
    const timeout3 = setTimeout(() => setIsOverdriveShake(false), 700);
    const timeout4 = setTimeout(() => {
      setFrontlineWreckage((curr) => (curr && Date.now() - curr.timestamp >= 900 ? null : curr));
    }, 1400);

    return () => {
      clearTimeout(timeout1);
      clearTimeout(timeout2);
      clearTimeout(timeout3);
      clearTimeout(timeout4);
    };
  }, [player.lastPlayedCard, player.cardsPlayedThisTurn, state.turn]);

  useEffect(() => {
    previousConstructsRef.current = (player.constructs || []).map((c) => ({
      name: c.name,
      hp: c.hp,
      maxHp: c.maxHp,
      atk: c.atk
    }));
  }, [player.constructs]);

  const handleCardClick = (card: any) => {
    if (card.targeting === 'Enemy') {
      setSelectedCard(card.instanceId);
    } else {
      engine.playCard(card.instanceId);
      setSelectedCard(null);
    }
  };

  const handleEnemyClick = (enemyId: string) => {
    if (selectedCard) {
      const target = state.enemies.find((enemy: any) => enemy.id === enemyId);
      if (!target || target.hp <= 0) return;
      engine.playCard(selectedCard, enemyId);
      setSelectedCard(null);
    }
  };

  const selectedCardPreview = selectedCard
    ? state.hand.find((c: any) => c.instanceId === selectedCard) || null
    : null;
  const selectedCardTargetLabel = selectedCardPreview
    ? getCardTargetingZh(selectedCardPreview.targeting || 'None')
    : '无目标';

  const getEnemyStandeeClass = (enemy: any) => {
    if (enemy.autonomyState === 'ChaosEgg') return 'enemy-standee--void';
    if (enemy.autonomyState === 'Martyr') return 'enemy-standee--boss';
    const def = enemiesData.find(e => e.id === enemy.defId) as any;
    const keywords: string[] = def?.keywords || [];
    if (enemy.defId === 'goblin') return 'enemy-standee--goblin';
    if (enemy.defId === 'alchemy_master') return 'enemy-standee--plague';
    if (enemy.defId === 'hexaghost') return 'enemy-standee--void';
    if (enemy.defId === 'time_guardian') return 'enemy-standee--clockwork';
    if (enemy.defId === 'slime_small' || enemy.defId === 'slime_boss') return 'enemy-standee--slime';
    if (enemy.defId === 'fission' || enemy.defId === 'fission_small') return 'enemy-standee--clockwork';
    if (enemy.defId === 'jaw_worm') return 'enemy-standee--worm';
    if (enemy.defId === 'lagavulin') return 'enemy-standee--stone';
    if (enemy.defId === 'predictor') return 'enemy-standee--clockwork';
    if (enemy.defId === 'puppet_queen') return 'enemy-standee--clockwork';
    if (enemy.defId === 'cultist' || enemy.defId === 'intelligence_officer') return 'enemy-standee--void';
    if (enemy.defId === 'barrier') return 'enemy-standee--guard';
    if (enemy.defId.startsWith('symbiote')) return 'enemy-standee--void';
    if (keywords.includes('goblin_family')) return 'enemy-standee--goblin';
    if (keywords.includes('slime_family')) return 'enemy-standee--slime';
    if (keywords.includes('worm_family')) return 'enemy-standee--worm';
    if (keywords.includes('cultist_family')) return 'enemy-standee--void';
    if (keywords.includes('barrier_family')) return 'enemy-standee--guard';
    if (keywords.includes('boss')) return 'enemy-standee--boss';
    if (keywords.includes('elite')) return 'enemy-standee--elite';
    return 'enemy-standee--guard';
  };

  const renderEnemyStatuses = (statuses: Record<string, number>, _entityId?: string) => {
    const statusMeta: Record<string, { icon: string; color: string; type: 'buff' | 'debuff' | 'neutral'; priority: number; short: string; title: string }> = {
      Vulnerable: { icon: '💀', color: '#c084fc', type: 'debuff', priority: 1, short: '易伤', title: '易伤' },
      Weak: { icon: '🌀', color: '#60a5fa', type: 'debuff', priority: 2, short: '虚弱', title: '虚弱' },
      Strength: { icon: '⚔️', color: '#f87171', type: 'buff', priority: 1, short: '力量', title: '力量' },
      Poison: { icon: '☣', color: '#4ade80', type: 'debuff', priority: 3, short: '中毒', title: '中毒' },
      Stealth: { icon: '👁', color: '#cbd5e1', type: 'neutral', priority: 5, short: '潜行', title: '潜行' },
      Burn: { icon: '🔥', color: '#fb923c', type: 'debuff', priority: 4, short: '灼烧', title: '灼烧' },
      BlockBlocked: { icon: '⛓', color: '#fca5a5', type: 'debuff', priority: 5, short: '锁盾', title: '护盾封锁' },
      Fear: { icon: '😱', color: '#f59e0b', type: 'debuff', priority: 6, short: '恐惧', title: '恐惧' },
      HexWard: { icon: '✡', color: '#93c5fd', type: 'buff', priority: 2, short: '护咒', title: '护咒' },
      MartyrsVigor: { icon: '✝', color: '#fbbf24', type: 'buff', priority: 3, short: '圣烈', title: '殉道之烈' },
      FleshChange: { icon: '🧬', color: '#a855f7', type: 'neutral', priority: 4, short: '异变', title: '血肉异变' }
    };

    const active = Object.entries(statuses).filter(([, amount]) => amount > 0);
    if (active.length === 0) return null;

    const buffs = active.filter(([status]) => statusMeta[status]?.type === 'buff').sort((a, b) => (statusMeta[a[0]]?.priority || 99) - (statusMeta[b[0]]?.priority || 99));
    const debuffs = active.filter(([status]) => statusMeta[status]?.type === 'debuff').sort((a, b) => (statusMeta[a[0]]?.priority || 99) - (statusMeta[b[0]]?.priority || 99));
    const neutrals = active.filter(([status]) => statusMeta[status]?.type === 'neutral' || !statusMeta[status]);

    const renderStatusIcon = (status: string, amount: number, type: 'buff' | 'debuff' | 'neutral') => {
      const meta = statusMeta[status] || { icon: '✧', color: type === 'buff' ? '#22c55e' : type === 'debuff' ? '#ef4444' : '#94a3b8', type: 'neutral' as const, priority: 99, short: status, title: status };
      const borderColor = type === 'buff' ? '#22c55e' : type === 'debuff' ? '#ef4444' : '#94a3b8';

      return (
        <StatusAnimation key={status}>
          <div
            className={`enemy-standee__statusIcon enemy-standee__statusIcon--${type}`}
            title={`${meta.title} · ${type === 'buff' ? '增益' : type === 'debuff' ? '减益' : '状态'} · ${amount}`}
            aria-label={`${meta.title} ${type === 'buff' ? '增益' : type === 'debuff' ? '减益' : '状态'} ${amount}`}
            style={{ color: meta.color, borderColor }}
          >
            <span>{meta.icon}</span>
            <span className="enemy-standee__statusStack">{amount}</span>
            <span className="enemy-standee__statusLabel">{meta.short}</span>
          </div>
        </StatusAnimation>
      );
    };

    return (
      <div className="enemy-standee__statusContainer">
        {buffs.length > 0 && (
          <div className="enemy-standee__statusGroup enemy-standee__statusGroup--buff">
            <div className="enemy-standee__statusGroupLabel enemy-standee__statusGroupLabel--buff">增益</div>
            {buffs.map(([status, amount]) => renderStatusIcon(status, amount, 'buff'))}
          </div>
        )}
        {debuffs.length > 0 && (
          <div className="enemy-standee__statusGroup enemy-standee__statusGroup--debuff">
            <div className="enemy-standee__statusGroupLabel enemy-standee__statusGroupLabel--debuff">减益</div>
            {debuffs.map(([status, amount]) => renderStatusIcon(status, amount, 'debuff'))}
          </div>
        )}
        {neutrals.length > 0 && (
          <div className="enemy-standee__statusGroup enemy-standee__statusGroup--neutral">
            <div className="enemy-standee__statusGroupLabel enemy-standee__statusGroupLabel--neutral">状态</div>
            {neutrals.map(([status, amount]) => renderStatusIcon(status, amount, 'neutral'))}
          </div>
        )}
      </div>
    );
  };

  const renderAxisGauge = (entity: any) => {
    const devotion = entity.devotion || 0;
    const corruptionAxis = entity.corruptionAxis || 0;
    const pointer = Math.max(-1, Math.min(1, (corruptionAxis - devotion) / 100));
    const pointerLeft = `${50 + pointer * 40}%`;
    const stateLabel = entity.autonomyState && entity.autonomyState !== 'Normal' ? entity.autonomyState : '';
    return (
      <div className="axis-dial" title={`虔敬 ${devotion} / 腐化 ${corruptionAxis}`}>
        <div className="axis-dial__track">
          <div className="axis-dial__fill axis-dial__fill--devotion" style={{ width: `${Math.min(50, devotion / 2)}%` }} />
          <div className="axis-dial__fill axis-dial__fill--corruption" style={{ width: `${Math.min(50, corruptionAxis / 2)}%` }} />
          <div className="axis-dial__needle" style={{ left: pointerLeft }} />
        </div>
        <div className="axis-dial__labels">
          <span className="is-devotion">D {devotion}</span>
          <span className="axis-dial__state">{stateLabel || '稳定'}</span>
          <span className="is-corruption">C {corruptionAxis}</span>
        </div>
      </div>
    );
  };

  const formatHitBreakdown = (hits: number[]) => {
    if (hits.length <= 1) return '';
    const groups: string[] = [];
    for (const hit of hits) {
      const last = groups[groups.length - 1];
      if (!last) {
        groups.push(`${hit}`);
        continue;
      }
      const match = last.match(/^(\d+)(x(\d+))?$/);
      if (match && Number(match[1]) === hit) {
        const count = match[3] ? Number(match[3]) + 1 : 2;
        groups[groups.length - 1] = `${hit}x${count}`;
      } else {
        groups.push(`${hit}`);
      }
    }
    return groups.join(' + ');
  };

  const getIntentDisplay = (_enemy: typeof state.enemies[number]): IntentDisplay => {
    // This is now handled by useCombatTelemetry hook
    // Keeping for backward compatibility with Battlefield component
    return { icon: '…', text: '战术动向', tone: 'neutral', breakdown: { totalDamage: 0, hits: [], block: 0, statuses: [], extras: [] } };
  };

  return (
    <ErrorBoundary>
      <div
        className={`campaign-shell flex flex-col h-full text-slate-200 p-4 relative combat-root warp-tier-${warpTier} ${isWarpBoiling ? 'is-warp-boiling' : ''} ${shouldHighlightTutorial ? 'combat-root--guide' : ''}`}
        data-battle-theme={battleTheme?.key || 'fallback'}
        style={{ backgroundColor: '#07080b' }}
      >
      {/* Background Layers */}
      <div
        key={battleTheme?.key || battleBackground}
        className="absolute inset-0 bg-cover bg-center pointer-events-none"
        style={{
          backgroundImage: `url(${battleBackground})`,
          opacity: bgTuning.mainOpacity,
          filter: bgTuning.mainFilter,
          animation: 'combat-bg-fade-in 380ms ease-out'
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(circle at 22% 20%, ${tintA}, transparent 45%), radial-gradient(circle at 82% 18%, ${tintB}, transparent 42%)`,
          transition: 'background 300ms ease'
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none combat-warp-layer combat-warp-layer--veil"
        style={{
          opacity: warpOverlayOpacity,
          background: `radial-gradient(circle at 15% 15%, rgba(168,85,247,0.22), transparent 38%), radial-gradient(circle at 85% 75%, rgba(236,72,153,0.16), transparent 42%), radial-gradient(circle at 55% 50%, rgba(59,130,246,0.08), transparent 55%)`
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none combat-warp-layer combat-warp-layer--rifts"
        style={{
          opacity: warpRiftOpacity,
          backgroundImage: 'linear-gradient(115deg, transparent 30%, rgba(168,85,247,0.10) 40%, transparent 48%), linear-gradient(72deg, transparent 52%, rgba(99,102,241,0.10) 58%, transparent 64%), linear-gradient(140deg, transparent 62%, rgba(236,72,153,0.08) 66%, transparent 72%)'
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none combat-warp-layer combat-warp-layer--storm"
        style={{
          opacity: warpStormOpacity,
          background: 'radial-gradient(circle at 50% 40%, rgba(168,85,247,0.09), transparent 52%), repeating-linear-gradient(0deg, rgba(255,255,255,0.015) 0 1px, transparent 1px 4px)'
        }}
      />
      <div className={`absolute inset-0 ${bgTuning.blackVeil}`} />
      <div className={`absolute inset-0 pointer-events-none bg-gradient-to-b ${bgTuning.gradientVeil}`} />

      {/* Overdrive Flash Effect */}
      <AnimatePresence>
        {overdriveFlash && (
          <motion.div
            className="absolute inset-0 z-30 pointer-events-none"
            initial={{ opacity: 0.82, backgroundColor: 'rgba(249,115,22,0.85)' }}
            animate={{ opacity: 0, backgroundColor: 'rgba(0,0,0,0)' }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
            style={{ mixBlendMode: 'color-dodge' }}
          />
        )}
      </AnimatePresence>

      {/* Main Content with Shake Animation */}
      <motion.div
        className="relative z-10 flex flex-col h-full"
        animate={isOverdriveShake ? {
          x: [0, -10, 12, -14, 9, -5, 0],
          y: [0, 7, -10, 8, -6, 3, 0]
        } : { x: 0, y: 0 }}
        transition={{ duration: 0.52, ease: 'easeOut' }}
      >
        {/* Combat HUD */}
        <CombatHUD
          engine={engine}
          showDeck={showDeck}
          setShowDeck={setShowDeck}
          GLOSSARY={GLOSSARY}
          cardBackThemes={cardBackThemes}
          characterToTheme={characterToTheme}
          defaultTheme={defaultTheme}
          tutorialHighlightActive={shouldHighlightTutorial}
        />

        <AnimatePresence>
          {shouldHighlightTutorial && !showTutorialOverlay ? (
            <motion.div
              className={`combat-guide-panel ${shouldCompactCombatGuide ? 'combat-guide-panel--compact' : ''}`}
              data-testid="combat-guide-panel"
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              <div className="combat-guide-panel__kicker">首战术语联动</div>
              <h3 className="combat-guide-panel__title">先看资源、敌方意图，再读手牌正文</h3>
              <div className="combat-guide-panel__copy">
                <GlossaryText text="优先确认上方[生命值]、[护盾]、[能量]与职业资源，再看敌方动作风险，最后决定哪张牌最值得打出。遇到陌生词条时，可以直接打开术语教程继续查阅。" />
              </div>
              <div className="combat-guide-panel__actions">
                <button
                  type="button"
                  className="combat-guide-panel__button combat-guide-panel__button--primary"
                  onClick={() => setShowTutorialOverlay(true)}
                >
                  打开术语教程
                </button>
                <button
                  type="button"
                  className="combat-guide-panel__button"
                  onClick={() => setShowCombatGuide(false)}
                >
                  知道了
                </button>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* Warp Pulse Notification */}
        {state.warpPulse && (
          <div className={`warp-pulse warp-pulse--${state.warpPulse.tone}`}>{state.warpPulse.text}</div>
        )}

        {/* Battlefield */}
        <Battlefield
          engine={engine}
          selectedCard={selectedCard}
          setSelectedCard={setSelectedCard}
          hoveredEnemyId={hoveredEnemyId}
          setHoveredEnemyId={setHoveredEnemyId}
          handleEnemyClick={handleEnemyClick}
          frontlineWreckage={frontlineWreckage}
          intentDeceptionTick={intentDeceptionTick}
          maybeMasqueradeIntent={maybeMasqueradeIntent}
          getIntentDisplay={getIntentDisplay}
          getEnemyStandeeClass={getEnemyStandeeClass}
          renderEnemyStatuses={renderEnemyStatuses}
          renderAxisGauge={renderAxisGauge}
          formatHitBreakdown={formatHitBreakdown}
          hasIntelRead={hasIntelRead}
          selectedCardPreview={selectedCardPreview}
          selectedCardTargetLabel={selectedCardTargetLabel}
          getPreviewCost={getPreviewCost}
          playerPortrait={playerPortrait}
          playerName={playerName}
          playerHpPct={playerHpPct}
          playerHpNow={playerHpNow}
          playerMaxHpNow={playerMaxHpNow}
          intentTelemetry={intentTelemetry}
          tutorialHighlightActive={shouldHighlightTutorial}
        />

        {/* Action Hand */}
        <ActionHand
          engine={engine}
          selectedCard={selectedCard}
          setSelectedCard={setSelectedCard}
          setShowDrawPile={setShowDrawPile}
          setShowDiscardPile={setShowDiscardPile}
          GLOSSARY={GLOSSARY}
          handleCardClick={handleCardClick}
          getDynamicCardText={(card) => getDynamicCardText(card, hoveredEnemyId)}
          getPreviewCost={getPreviewCost}
          tutorialHighlightActive={shouldHighlightTutorial}
        />

        {/* Modals */}
        <DeckModal
          engine={engine}
          showDeck={showDeck}
          setShowDeck={setShowDeck}
          GLOSSARY={GLOSSARY}
        />

        <DrawPileModal
          engine={engine}
          showDrawPile={showDrawPile}
          setShowDrawPile={setShowDrawPile}
          useIntelForDrawPile={useIntelForDrawPile}
          setUseIntelForDrawPile={setUseIntelForDrawPile}
          GLOSSARY={GLOSSARY}
          cardBackThemes={cardBackThemes}
          characterToTheme={characterToTheme}
          defaultTheme={defaultTheme}
        />

        <DiscardPileModal
          engine={engine}
          showDiscardPile={showDiscardPile}
          setShowDiscardPile={setShowDiscardPile}
          GLOSSARY={GLOSSARY}
        />

        {/* Vox Log Panel */}
        <VoxLogPanel logLines={engine.state.combatVoxLog || []} maxVisibleLines={6} />

          <TutorialView
            open={showTutorialOverlay}
            onClose={() => {
              setShowTutorialOverlay(false);
              setShowCombatGuide(false);
            }}
          />
        </motion.div>
      </div>
    </ErrorBoundary>
  );
}
