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
import charactersData from '@/content/data/characters.json';
import { Heart, Zap, Play, BookOpen, Trophy, Sparkles, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Shield } from 'lucide-react';
import { ASSET_PLACEHOLDERS, bindImgFallback } from '@/ui/components/assetHelpers';
import { BackgroundImage, VIEW_BACKGROUNDS } from '@/ui/components/BackgroundImage';
import { getAchievementDefById, getAchievementTotalCount, getAchievementUnlockedCount } from '@/features/achievements/achievementSystem';
import { relicsData } from '@/content/narrative/numericSystem';

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
    const saved = window.localStorage.getItem('deckrogue:charselect:top-panel-expanded');
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
  const ascensionUnlocked = Math.max(0, metaProfile.progression?.ascensionUnlockedLevel || 0);
  const selectedAscension = Math.max(0, Math.min(ascensionUnlocked, metaProfile.preferences?.selectedAscension || 0));
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
    window.localStorage.setItem('deckrogue:charselect:top-panel-expanded', isTopPanelExpanded ? '1' : '0');
  }, [isTopPanelExpanded]);

  const persistMeta = (updater: (prev: any) => any) => {
    setMetaProfile((prev) => {
      const next = updater(prev);
      saveMetaProfile(next);
      return next;
    });
  };

  const setSelectedAscension = (nextLevel: number) => {
    const clamped = Math.max(0, Math.min(ascensionUnlocked, Math.floor(nextLevel)));
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
      className="h-full text-slate-200"
      overlayOpacity={0.55}
    >
      <div className="w-full h-full overflow-y-auto overscroll-contain px-4 sm:px-6 lg:px-8 py-6">
        <div className="w-full max-w-7xl mx-auto flex flex-col items-center">
      <h1 className="text-4xl font-serif mb-5 text-emerald-400 drop-shadow-lg text-center">选择你的执行体</h1>

      <div className="w-full mb-4 rounded-2xl border border-slate-700/70 bg-slate-950/55 backdrop-blur-sm p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="px-2.5 py-1 rounded-lg border border-amber-700/40 bg-black/30 text-amber-200">
              征用点 <span className="font-bold">{metaProfile.currencies.requisition}</span>
            </div>
            <div className="px-2.5 py-1 rounded-lg border border-violet-700/40 bg-black/30 text-violet-200">
              回响 <span className="font-bold">{metaProfile.currencies.warpEchoes}</span>
            </div>
            <div className="px-2.5 py-1 rounded-lg border border-cyan-700/40 bg-black/30 text-cyan-200">
              图鉴 {codexUnlockedTotal}
            </div>
            <div className="px-2.5 py-1 rounded-lg border border-emerald-700/40 bg-black/30 text-emerald-200">
              成就 {achievementUnlockedCount}/{achievementTotalCount}
            </div>
            <div className="px-2.5 py-1 rounded-lg border border-sky-700/40 bg-black/30 text-sky-200">
              Ascension A{selectedAscension}
            </div>
          </div>
          <button
            onClick={() => setIsTopPanelExpanded((v) => !v)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-600 bg-slate-900/80 hover:bg-slate-800 text-slate-200 text-sm"
            title={isTopPanelExpanded ? '收起顶部面板' : '展开顶部面板'}
          >
            {isTopPanelExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            {isTopPanelExpanded ? '收起场外面板' : '展开场外面板'}
          </button>
        </div>
      </div>

      {isTopPanelExpanded && (
      <div className="w-full mb-8 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-8 gap-3">
        <div className="rounded-xl border border-amber-700/40 bg-slate-950/70 backdrop-blur-sm px-4 py-3">
          <div className="text-[10px] uppercase tracking-[0.16em] text-amber-300/70 mb-1">征用点</div>
          <div className="text-2xl font-bold text-amber-300">{metaProfile.currencies.requisition}</div>
        </div>
        <div className="rounded-xl border border-violet-700/40 bg-slate-950/70 backdrop-blur-sm px-4 py-3">
          <div className="text-[10px] uppercase tracking-[0.16em] text-violet-300/70 mb-1">亚空间回响</div>
          <div className="text-2xl font-bold text-violet-300">{metaProfile.currencies.warpEchoes}</div>
        </div>
        <div className="rounded-xl border border-slate-700/60 bg-slate-950/70 backdrop-blur-sm px-4 py-3">
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
          className="text-left rounded-xl border border-cyan-700/40 bg-slate-950/70 backdrop-blur-sm px-4 py-3 hover:bg-slate-900/80 hover:border-cyan-500/50 transition-colors"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="text-[10px] uppercase tracking-[0.16em] text-cyan-300/70">Codex 图鉴</div>
            <BookOpen size={15} className="text-cyan-300" />
          </div>
          <div className="text-lg font-bold text-cyan-200 mt-1">已解锁 {codexUnlockedTotal} 项</div>
          <div className="text-xs text-slate-400 mt-1">遇见即解锁 · 点击进入图鉴说明书</div>
        </button>
        <button
          onClick={() => setShowAchievements(true)}
          className="text-left rounded-xl border border-emerald-700/40 bg-slate-950/70 backdrop-blur-sm px-4 py-3 hover:bg-slate-900/80 hover:border-emerald-500/50 transition-colors"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="text-[10px] uppercase tracking-[0.16em] text-emerald-300/70">Achievements</div>
            <Trophy size={15} className="text-emerald-300" />
          </div>
          <div className="text-lg font-bold text-emerald-200 mt-1">{achievementUnlockedCount} / {achievementTotalCount}</div>
          <div className="text-xs text-slate-400 mt-1 truncate" title={latestAchievement ? latestAchievement.title : '尚未解锁成就'}>
            {latestAchievement ? `最新：${latestAchievement.title}` : '尚未解锁成就'}
          </div>
        </button>
        <div className="rounded-xl border border-fuchsia-700/40 bg-slate-950/70 backdrop-blur-sm px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[10px] uppercase tracking-[0.16em] text-fuchsia-300/70">Unlocks</div>
            <Sparkles size={15} className="text-fuchsia-300" />
          </div>
          <div className="text-lg font-bold text-fuchsia-200 mt-1">{totalUnlockRewardCount} 项</div>
          <div className="text-xs text-slate-400 mt-1">
            起始遗物 {metaProfile.unlocks?.startingRelics?.length || 0} · 背景 {metaProfile.unlocks?.backgrounds?.length || 0}
          </div>
        </div>
        <div className="rounded-xl border border-sky-700/40 bg-slate-950/70 backdrop-blur-sm px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[10px] uppercase tracking-[0.16em] text-sky-300/70">Ascension</div>
            <Shield size={15} className="text-sky-300" />
          </div>
          <div className="mt-1 flex items-center justify-between gap-2">
            <button
              onClick={() => setSelectedAscension(selectedAscension - 1)}
              className="w-7 h-7 rounded-lg border border-slate-600 bg-slate-900/70 hover:bg-slate-800/80 flex items-center justify-center"
              title="降低 Ascension"
            >
              <ChevronLeft size={14} />
            </button>
            <div className="text-center flex-1">
              <div className="text-lg font-bold text-sky-200">A{selectedAscension}</div>
              <div className="text-[10px] text-slate-400">已解锁至 A{Math.min(ascensionUnlocked, ascensionMax)}</div>
            </div>
            <button
              onClick={() => setSelectedAscension(selectedAscension + 1)}
              className="w-7 h-7 rounded-lg border border-slate-600 bg-slate-900/70 hover:bg-slate-800/80 flex items-center justify-center"
              title="提高 Ascension"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
        <div className="rounded-xl border border-rose-700/40 bg-slate-950/70 backdrop-blur-sm px-4 py-3 xl:col-span-2">
          <div className="text-[10px] uppercase tracking-[0.16em] text-rose-300/70 mb-1">Starting Relic（已解锁）</div>
          <select
            value={metaProfile.preferences?.selectedStartingRelicId || ''}
            onChange={(e) => setSelectedStartingRelic(e.target.value || null)}
            className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-200"
          >
            <option value="">None</option>
            {unlockedStartingRelics.map(({ id, def }) => (
              <option key={id} value={id}>{def.name}</option>
            ))}
          </select>
          <div className="text-xs text-slate-400 mt-1">成就奖励中的起始遗物可在新局注入（不会覆盖角色起始卡组）。</div>
        </div>
      </div>
      )}
      
      <div className="w-full max-w-6xl flex flex-wrap justify-center gap-6 lg:gap-8">
        {charactersData.map(char => {
          const isSelected = engine.state.character?.id === char.id;
          return (
            <div 
              key={char.id}
              onClick={() => engine.selectCharacter(char.id)}
              className={`w-full max-w-[18rem] md:w-[17rem] bg-slate-900/80 border-2 rounded-xl p-6 flex flex-col items-center cursor-pointer transition-all shadow-xl backdrop-blur-sm
                ${isSelected ? 'border-emerald-500 scale-105 bg-slate-800/80' : 'border-slate-700 hover:border-emerald-400 hover:-translate-y-2'}
              `}
            >
              <div className="w-24 h-24 bg-slate-800 rounded-full mb-4 flex items-center justify-center border border-slate-600 overflow-hidden">
                <img 
                  src={`/assets/characters/${char.id}.png`} 
                  alt={char.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    bindImgFallback(e, ASSET_PLACEHOLDERS.character);
                  }}
                />
              </div>
              <h2 className="text-xl font-bold mb-2">{char.name}</h2>
              <div className="flex gap-4 mb-4 text-sm">
                <span className="flex items-center gap-1 text-red-400"><Heart size={16}/> {char.maxHp}</span>
                <span className="flex items-center gap-1 text-yellow-400"><Zap size={16}/> {char.maxEnergy}</span>
              </div>
              <p className="text-sm text-slate-400 text-center">
                {char.description}
              </p>
            </div>
          );
        })}
      </div>

      {engine.state.character && (
        <div className="mt-10 mb-6">
          <button 
            onClick={() => engine.startGame()}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 px-8 py-3 rounded-xl font-bold text-white transition-colors shadow-lg shadow-emerald-900/50"
          >
            <Play size={20} fill="currentColor" /> Start Game
          </button>
        </div>
      )}

      <Suspense fallback={showCodex || showAchievements ? (
        <div className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm flex items-center justify-center text-slate-200">
          <div className="rounded-xl border border-slate-700 bg-slate-950/90 px-5 py-4">Loading...</div>
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
