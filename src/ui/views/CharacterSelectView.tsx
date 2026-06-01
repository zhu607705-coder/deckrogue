/**
 * @file CharacterSelectView.tsx
 * @description 角色选择视图 - 游戏开始时的角色选择界面
 *
 * 主要职责:
 * - 展示可选角色列表及其属性
 * - 管理角色选择和确认
 * - 显示进阶等级选择
 * - 提供图鉴和成就入口
 * - 展示上次运行记录
 */
import React, { Suspense, lazy, useEffect, useState } from 'react';
import {
  GameEngine,
  getAscensionMaxLevel,
  getCodexUnlockedCount,
  globalEventBus,
  loadCodexProfile,
  loadMetaProfile,
  saveMetaProfile
} from '@/core';
import { Heart, Zap, Play, BookOpen, Trophy, Sparkles, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Shield } from 'lucide-react';
import { ASSET_PLACEHOLDERS, bindImgFallback } from '@/ui/components/assetHelpers';
import { localCharacterArt } from '@/content/assets/standeeArt';
import { BackgroundImage, VIEW_BACKGROUNDS } from '@/ui/components/BackgroundImage';
import { getAchievementDefById, getAchievementTotalCount, getAchievementUnlockedCount } from '@/features/achievements/achievementSystem';
import { relicsData } from '@/content/narrative/numericSystem';
import { getUiLabelZh } from '@/ui/content/terminology';
import { safeStorageGetString, safeStorageSetString } from '@/core/utils/safeStorage';
import { uiCharacters } from '@/ui/content/characters';

const CodexOverlay = lazy(async () => import('../overlays/CodexOverlay').then((m) => ({ default: m.CodexOverlay })));
const AchievementOverlay = lazy(async () => import('../overlays/AchievementOverlay').then((m) => ({ default: m.AchievementOverlay })));

export function CharacterSelectView({ engine }: { engine: GameEngine }) {
  const backgroundSrc = VIEW_BACKGROUNDS.characterSelect.desktop;
  const [metaProfile, setMetaProfile] = useState(() => loadMetaProfile());
  const lastRun = metaProfile.runHistory?.[0] || null;
  const [showCodex, setShowCodex] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
  const [isTopPanelExpanded, setIsTopPanelExpanded] = useState(() => {
    if (typeof window === 'undefined') return true;
    const saved = safeStorageGetString('deckrogue:charselect:top-panel-expanded', '').value;
    if (saved === '1') return true;
    if (saved === '0') return false;
    return window.innerHeight >= 1080;
  });
  const codexProfile = loadCodexProfile();
  const codexUnlockedTotal = getCodexUnlockedCount(codexProfile);
  const achievementUnlockedCount = getAchievementUnlockedCount(metaProfile);
  const achievementTotalCount = getAchievementTotalCount();
  const latestAchievement = metaProfile.achievements?.lastUnlockedIds?.[0]
    ? getAchievementDefById(metaProfile.achievements.lastUnlockedIds[0])
    : null;
  const totalUnlockRewardCount =
    (metaProfile.unlocks?.startingRelics?.length || 0) +
    (metaProfile.unlocks?.backgrounds?.length || 0) +
    (metaProfile.unlocks?.cardSkins?.length || 0) +
    (metaProfile.unlocks?.characters?.length || 0);
  const ascensionMax = Math.max(0, getAscensionMaxLevel());
  const ascensionUnlockedByChar = metaProfile.progression?.ascensionUnlockedLevelByCharacter || {};
  const selectedCharId = engine.state.character?.id || '';
  const ascensionUnlockedForChar = Math.max(0, ascensionUnlockedByChar[selectedCharId] || 0);
  const selectedAscension = Math.max(0, Math.min(ascensionUnlockedForChar, metaProfile.preferences?.selectedAscension || 0));
  const unlockedStartingRelics = (metaProfile.unlocks?.startingRelics || [])
    .map((id) => ({ id, def: (relicsData as any[]).find((r) => r.id === id) as any }))
    .filter((x) => x.def);

  useEffect(() => {
    const unsub = globalEventBus.subscribe('MetaProfileUpdated', () => {
      setMetaProfile(loadMetaProfile());
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    safeStorageSetString('deckrogue:charselect:top-panel-expanded', isTopPanelExpanded ? '1' : '0');
  }, [isTopPanelExpanded]);

  const persistMeta = (updater: (prev: any) => any) => {
    setMetaProfile((prev) => {
      const next = updater(prev);
      saveMetaProfile(next);
      return next;
    });
  };

  const setSelectedAscension = (nextLevel: number) => {
    const clamped = Math.max(0, Math.min(ascensionUnlockedForChar, Math.floor(nextLevel)));
    persistMeta((prev: any) => ({
      ...prev,
      preferences: {
        ...(prev.preferences || {}),
        selectedAscension: clamped
      }
    }));
  };

  const setSelectedStartingRelic = (relicId: string | null) => {
    persistMeta((prev: any) => ({
      ...prev,
      preferences: {
        ...(prev.preferences || {}),
        selectedStartingRelicId: relicId
      }
    }));
  };

  return (
    <BackgroundImage
      src={backgroundSrc}
      className="campaign-shell h-full text-slate-200"
      overlayOpacity={0.55}
    >
      <div className="w-full h-full overflow-y-auto overscroll-contain px-4 sm:px-6 lg:px-8 py-6">
        <div className="w-full max-w-7xl mx-auto flex flex-col items-center">
      <div className="w-full mb-6 border-b border-white/10 pb-8 text-center">
        <div className="campaign-kicker">{getUiLabelZh('Execution Registry')}</div>
        <h1 className="campaign-title campaign-poster-title mt-4 text-[clamp(2.6rem,5vw,5rem)] leading-[0.92] text-emerald-100">
          选择你的执行体
        </h1>
        <p className="campaign-copy mx-auto mt-4 max-w-2xl text-sm md:text-base">
          先确定角色身份，再决定本局难度、起始遗物与长线推进方向。这里展示的只保留影响开局判断的关键情报。
        </p>
      </div>

      <div className="campaign-section w-full mb-4 p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="px-2.5 py-1 border border-amber-700/40 bg-black/30 text-amber-200">
              征用点 <span className="font-bold">{metaProfile.currencies.requisition}</span>
            </div>
            <div className="px-2.5 py-1 border border-violet-700/40 bg-black/30 text-violet-200">
              回响 <span className="font-bold">{metaProfile.currencies.warpEchoes}</span>
            </div>
            <div className="px-2.5 py-1 border border-cyan-700/40 bg-black/30 text-cyan-200">
              图鉴 {codexUnlockedTotal}
            </div>
            <div className="px-2.5 py-1 border border-emerald-700/40 bg-black/30 text-emerald-200">
              成就 {achievementUnlockedCount}/{achievementTotalCount}
            </div>
            <div className="px-2.5 py-1 border border-sky-700/40 bg-black/30 text-sky-200">
              难度 Lv{selectedAscension}
            </div>
          </div>
          <button
            onClick={() => setIsTopPanelExpanded((v) => !v)}
            className="flex min-h-10 items-center gap-2 px-3 py-2 rounded-lg border border-slate-600 bg-slate-900/80 hover:bg-slate-800 text-slate-200 text-sm"
            title={isTopPanelExpanded ? '收起顶部面板' : '展开顶部面板'}
            data-keyboard-focus="true"
          >
            {isTopPanelExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            {isTopPanelExpanded ? '收起场外面板' : '展开场外面板'}
          </button>
        </div>
      </div>

      {isTopPanelExpanded && (
      <div className="w-full mb-8 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-8 gap-3">
        <div className="campaign-section px-4 py-3">
          <div className="text-[10px] uppercase tracking-[0.16em] text-amber-300/70 mb-1">征用点</div>
          <div className="text-2xl font-bold text-amber-300">{metaProfile.currencies.requisition}</div>
        </div>
        <div className="campaign-section px-4 py-3">
          <div className="text-[10px] uppercase tracking-[0.16em] text-violet-300/70 mb-1">亚空间回响</div>
          <div className="text-2xl font-bold text-violet-300">{metaProfile.currencies.warpEchoes}</div>
        </div>
        <div className="campaign-section px-4 py-3">
          <div className="text-[10px] uppercase tracking-[0.16em] text-slate-400 mb-1">最近结算</div>
          {lastRun ? (
            <div className="text-sm text-slate-200 leading-tight">
              <div>第 {lastRun.reachedFloor} 层 · {lastRun.isVictory ? '胜利' : '阵亡'}</div>
              <div className="text-slate-400">+{lastRun.earnedRequisition} 征用点 / +{lastRun.earnedWarpEchoes} 回响</div>
            </div>
          ) : (
            <div className="text-sm text-slate-500">尚无已归档战区记录</div>
          )}
        </div>
        <button
          onClick={() => setShowCodex(true)}
          className="campaign-action text-left px-4 py-3 hover:border-cyan-500/50"
          data-keyboard-focus="true"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="text-[10px] uppercase tracking-[0.16em] text-cyan-300/70">{getUiLabelZh('Codex')} 图鉴</div>
            <BookOpen size={15} className="text-cyan-300" />
          </div>
          <div className="text-lg font-bold text-cyan-200 mt-1">已解锁 {codexUnlockedTotal} 项</div>
          <div className="text-xs text-slate-400 mt-1">遇见即解锁 · 点击进入图鉴说明书</div>
        </button>
        <button
          onClick={() => setShowAchievements(true)}
          className="campaign-action text-left px-4 py-3 hover:border-emerald-500/50"
          data-keyboard-focus="true"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="text-[10px] uppercase tracking-[0.16em] text-emerald-300/70">{getUiLabelZh('Achievements')}</div>
            <Trophy size={15} className="text-emerald-300" />
          </div>
          <div className="text-lg font-bold text-emerald-200 mt-1">{achievementUnlockedCount} / {achievementTotalCount}</div>
          <div className="text-xs text-slate-400 mt-1 truncate" title={latestAchievement ? latestAchievement.title : '尚未解锁成就'}>
            {latestAchievement ? `最新：${latestAchievement.title}` : '尚未解锁成就'}
          </div>
        </button>
        <div className="campaign-section px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[10px] uppercase tracking-[0.16em] text-fuchsia-300/70">{getUiLabelZh('Unlocks')}</div>
            <Sparkles size={15} className="text-fuchsia-300" />
          </div>
          <div className="text-lg font-bold text-fuchsia-200 mt-1">{totalUnlockRewardCount} 项</div>
          <div className="text-xs text-slate-400 mt-1">
            起始遗物 {metaProfile.unlocks?.startingRelics?.length || 0} · 背景 {metaProfile.unlocks?.backgrounds?.length || 0}
          </div>
        </div>
        <div className="campaign-section px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[10px] uppercase tracking-[0.16em] text-sky-300/70">难度</div>
            <Shield size={15} className="text-sky-300" />
          </div>
          <div className="mt-1 flex items-center justify-between gap-2">
            <button
              onClick={() => setSelectedAscension(selectedAscension - 1)}
              className="w-7 h-7 border border-slate-600 bg-slate-900/70 hover:bg-slate-800/80 flex items-center justify-center"
              title="降低难度"
            >
              <ChevronLeft size={14} />
            </button>
            <div className="text-center flex-1">
              <div className="text-lg font-bold text-sky-200">Lv{selectedAscension}</div>
              <div className="text-[10px] text-slate-400">已解锁至 Lv{ascensionUnlockedForChar}</div>
            </div>
            <button
              onClick={() => setSelectedAscension(selectedAscension + 1)}
              className="w-7 h-7 border border-slate-600 bg-slate-900/70 hover:bg-slate-800/80 flex items-center justify-center"
              title="提高难度"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
        <div className="campaign-section px-4 py-3 xl:col-span-2">
          <div className="text-[10px] uppercase tracking-[0.16em] text-rose-300/70 mb-1">{getUiLabelZh('Starting Relic')}（已解锁）</div>
          <select
            value={metaProfile.preferences?.selectedStartingRelicId || ''}
            onChange={(e) => setSelectedStartingRelic(e.target.value || null)}
            className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-200"
          >
            <option value="">不注入额外遗物</option>
            {unlockedStartingRelics.map(({ id, def }) => (
              <option key={id} value={id}>{def.name}</option>
            ))}
          </select>
          <div className="text-xs text-slate-400 mt-1">成就奖励中的起始遗物可在新局注入（不会覆盖角色起始卡组）。</div>
        </div>
      </div>
      )}

      <div className="campaign-rail w-full pt-5">
      <div className="w-full mb-4">
        <div className="campaign-kicker">{getUiLabelZh('Operative Lineup')}</div>
        <h2 className="campaign-title mt-3 text-2xl md:text-3xl text-stone-100">执行体档案墙</h2>
      </div>
      <div className="w-full max-w-6xl flex flex-wrap justify-center gap-3 lg:gap-3">
        {uiCharacters.map((char, index) => {
          const isSelected = engine.state.character?.id === char.id;
          const charUnlockedLv = ascensionUnlockedByChar[char.id] || 0;
          return (
            <div
              key={char.id}
              onClick={() => engine.selectCharacter(char.id)}
              className={`campaign-choice w-full max-w-[10.75rem] md:w-[10.75rem] p-4 flex flex-col items-center cursor-pointer shadow-xl backdrop-blur-sm
                ${isSelected ? 'is-selected scale-[1.02]' : 'border-slate-700'}
              `}
              role="button"
              tabIndex={0}
              data-keyboard-option={String(index + 1)}
              data-keyboard-focus="true"
              data-character-id={char.id}
            >
              <div className="w-16 h-16 bg-slate-800 rounded-full mb-2.5 flex items-center justify-center border border-slate-600 overflow-hidden">
                <img
                  src={localCharacterArt(char.id)}
                  alt={char.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    bindImgFallback(e, ASSET_PLACEHOLDERS.character);
                  }}
                />
              </div>
              <h2 className="text-base font-bold mb-1.5 text-center leading-tight">{char.name}</h2>
              <div className="flex gap-3 mb-1.5 text-xs">
                <span className="flex items-center gap-1 text-red-400"><Heart size={14}/> {char.maxHp}</span>
                <span className="flex items-center gap-1 text-yellow-400"><Zap size={14}/> {char.maxEnergy}</span>
              </div>
              <div className="text-[11px] text-sky-300 bg-slate-800/80 px-2 py-1 rounded-lg border border-sky-700/40">
                已解锁: Lv{charUnlockedLv}
              </div>
              <p className="mt-2 text-[11px] leading-5 text-slate-400 text-center">
                {char.description}
              </p>
            </div>
          );
        })}
      </div>
      </div>

      {engine.state.character && (
        <div className="mt-10 mb-6">
          <button
            onClick={() => engine.startGame()}
            className="campaign-action flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 px-8 py-3 font-bold text-white transition-colors shadow-lg shadow-emerald-900/50"
            data-keyboard-option="9"
            data-keyboard-focus="true"
          >
            <Play size={20} fill="currentColor" /> 开始战区部署
          </button>
        </div>
      )}

      <Suspense fallback={showCodex || showAchievements ? (
        <div className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm flex items-center justify-center text-slate-200">
          <div className="rounded-xl border border-slate-700 bg-slate-950/90 px-5 py-4">正在加载…</div>
        </div>
      ) : null}>
        <CodexOverlay open={showCodex} onClose={() => setShowCodex(false)} />
        <AchievementOverlay open={showAchievements} onClose={() => setShowAchievements(false)} />
      </Suspense>
        </div>
      </div>
    </BackgroundImage>
  );
}
