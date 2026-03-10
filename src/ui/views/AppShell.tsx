import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { computeRunSummary, GameEngine, gameSetup, globalEventBus, loadMetaProfile } from '@/core';
import { BACKGROUND_VISUAL_MODE_OPTIONS, BackgroundVisualMode } from '@/ui/components/backgroundVisuals';
import { ThemeProvider, useTheme } from '@/ui/theme/ThemeContext';
import { GlobalFilterOverlay } from '@/ui/overlays/GlobalFilterOverlay';
import { ViewBackgroundLayer } from '@/ui/components/ViewBackgroundLayer';
import { SetupLauncher } from '@/ui/launcher/SetupLauncher';
import { Sun, Moon, Eye, Layers, Zap, Skull } from 'lucide-react';
import worldLoreData from '@/content/data/worldLore.json';

const BG_VISUAL_MODE_KEY = 'deckrogue_bg_visual_mode';
const WORLD_LORE = worldLoreData as any;
const CharacterSelectView = lazy(async () => import('@/ui/views/CharacterSelectView').then((m) => ({ default: m.CharacterSelectView })));
const MapView = lazy(async () => import('@/ui/views/MapView').then((m) => ({ default: m.MapView })));
const CombatView = lazy(async () => import('@/ui/views/CombatView').then((m) => ({ default: m.CombatView })));
const RewardView = lazy(async () => import('@/ui/views/RewardView').then((m) => ({ default: m.RewardView })));
const ShopView = lazy(async () => import('@/ui/views/ShopView').then((m) => ({ default: m.ShopView })));
const RestView = lazy(async () => import('@/ui/views/RestView').then((m) => ({ default: m.RestView })));
const EventView = lazy(async () => import('@/ui/views/EventView').then((m) => ({ default: m.EventView })));
const UpgradeView = lazy(async () => import('@/ui/views/UpgradeView').then((m) => ({ default: m.UpgradeView })));
const RemoveCardView = lazy(async () => import('@/ui/views/RemoveCardView').then((m) => ({ default: m.RemoveCardView })));

function ScreenLoadingFallback({ label }: { label: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="rounded-xl border border-slate-700 bg-slate-950/90 px-5 py-4 text-sm text-slate-200">
        Loading {label}...
      </div>
    </div>
  );
}

function AppContent() {
  const [engine, setEngine] = useState<GameEngine | null>(() => gameSetup.getEngine());
  const [launcherError, setLauncherError] = useState<string | null>(null);
  const [, setTick] = useState(0);
  const [showMenu, setShowMenu] = useState(false);
  const [menuPage, setMenuPage] = useState<'root' | 'save' | 'theme'>('root');
  const [isThemeTransitioning, setIsThemeTransitioning] = useState(false);
  const [themeFlashKey, setThemeFlashKey] = useState(0);
  const [, setMetaTick] = useState(0);
  const themeTransitionTimerRef = useRef<number | null>(null);
  const [backgroundVisualMode, setBackgroundVisualMode] = useState<BackgroundVisualMode>(() => {
    if (typeof window === 'undefined') return 'balanced';
    const saved = window.localStorage.getItem(BG_VISUAL_MODE_KEY);
    return saved === 'cinematic' || saved === 'balanced' || saved === 'vivid' ? saved : 'balanced';
  });

  const {
    mode: themeMode,
    setMode: setThemeMode,
    visualIntensity,
    setVisualIntensity,
    filterEffects,
    toggleFilter
  } = useTheme();

  useEffect(() => {
    return () => {
      if (themeTransitionTimerRef.current != null) {
        window.clearTimeout(themeTransitionTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!engine && gameSetup.isInitialized() && gameSetup.isRunning()) {
      const existingEngine = gameSetup.getEngine();
      if (existingEngine) {
        setEngine(existingEngine);
      }
    }
  }, [engine]);

  useEffect(() => {
    if (!engine) return;
    const unsubscribe = engine.subscribe(() => setTick(t => t + 1));
    return unsubscribe;
  }, [engine]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(BG_VISUAL_MODE_KEY, backgroundVisualMode);
  }, [backgroundVisualMode]);

  useEffect(() => {
    const unsub = globalEventBus.subscribe('MetaProfileUpdated', () => {
      setMetaTick((t) => t + 1);
    });
    return unsub;
  }, []);

  const handleStartNewRun = () => {
    try {
      setLauncherError(null);
      if (gameSetup.isRunning()) {
        gameSetup.clearActiveRun();
      }
      const newEngine = gameSetup.startNewRun();
      setEngine(newEngine);
    } catch (error) {
      setLauncherError(error instanceof Error ? error.message : '无法启动新战区');
    }
  };

  const handleLoadSlot = (slotId: string) => {
    try {
      setLauncherError(null);
      const loadedEngine = gameSetup.loadRun(slotId);
      if (!loadedEngine) {
        setLauncherError(`读取存档失败：${slotId}`);
        return;
      }
      setEngine(loadedEngine);
    } catch (error) {
      setLauncherError(error instanceof Error ? error.message : '读取存档失败');
    }
  };

  const handleContinueRun = () => {
    const saveSlots = gameSetup.getSaveManager().getSaveSlots().slice().sort((a, b) => b.timestamp - a.timestamp);
    if (gameSetup.hasQuickSave()) {
      handleLoadSlot('quicksave');
      return;
    }
    if (saveSlots.length > 0) {
      handleLoadSlot(saveSlots[0].id);
      return;
    }
    setLauncherError('当前没有可继续的作战存档。');
  };

  const handleDeleteSlot = (slotId: string) => {
    const removed = gameSetup.getSaveManager().deleteSaveSlot(slotId);
    if (!removed) {
      setLauncherError(`删除存档失败：${slotId}`);
      return;
    }
    setTick((t) => t + 1);
  };

  const handleReturnToLauncher = () => {
    setShowMenu(false);
    setMenuPage('root');
    setLauncherError(null);
    gameSetup.clearActiveRun();
    setEngine(null);
  };

  const handleRestart = () => {
    setShowMenu(false);
    setMenuPage('root');
    gameSetup.clearActiveRun();
    const newEngine = gameSetup.startNewRun();
    setEngine(newEngine);
  };

  const handleQuickSave = () => {
    gameSetup.quickSave();
    setTick(t => t + 1);
    setShowMenu(false);
    setMenuPage('root');
  };

  const handleQuickLoad = () => {
    const loadedEngine = gameSetup.quickLoad();
    if (loadedEngine) {
      setEngine(loadedEngine);
    } else {
      setLauncherError('快速读取失败：未找到有效快速存档。');
    }
    setShowMenu(false);
    setMenuPage('root');
  };

  const runThemeTransition = () => {
    setThemeFlashKey((k) => k + 1);
    setIsThemeTransitioning(true);
    if (themeTransitionTimerRef.current != null) {
      window.clearTimeout(themeTransitionTimerRef.current);
    }
    themeTransitionTimerRef.current = window.setTimeout(() => {
      setIsThemeTransitioning(false);
      themeTransitionTimerRef.current = null;
    }, 420);
  };

  const handleSetThemeMode = (nextMode: 'dark' | 'light') => {
    if (nextMode === themeMode) return;
    runThemeTransition();
    setThemeMode(nextMode);
  };

  if (!engine) {
    const saveSlots = gameSetup.getSaveManager().getSaveSlots();
    const metaProfile = loadMetaProfile();
    return (
      <SetupLauncher
        canContinue={gameSetup.hasQuickSave() || saveSlots.length > 0}
        saveSlots={saveSlots}
        metaProfile={metaProfile}
        onNewRun={handleStartNewRun}
        onContinue={handleContinueRun}
        onLoadSlot={handleLoadSlot}
        onDeleteSlot={handleDeleteSlot}
        error={launcherError}
      />
    );
  }

  const isTerminalScreen = engine.state.screen === 'GameOver' || engine.state.screen === 'Victory';
  const terminalSummary = isTerminalScreen ? computeRunSummary(engine.state) : null;
  const metaProfile = isTerminalScreen ? loadMetaProfile() : null;
  const runAlreadyRecorded = !!(terminalSummary && metaProfile?.runHistory?.some((r) => r.runId === terminalSummary.runId));
  const projectedRequisition = terminalSummary && metaProfile
    ? metaProfile.currencies.requisition + (runAlreadyRecorded ? 0 : terminalSummary.earnedRequisition)
    : 0;
  const projectedWarpEchoes = terminalSummary && metaProfile
    ? metaProfile.currencies.warpEchoes + (runAlreadyRecorded ? 0 : terminalSummary.earnedWarpEchoes)
    : 0;
  const corruptionNow = engine.state.player.corruption || 0;
  const devotionNow = engine.state.player.devotion ?? 0;
  const terminalNarrative = (() => {
    if (!terminalSummary) return '';
    if (terminalSummary.isVictory) {
      return corruptionNow >= 70
        ? WORLD_LORE?.deathNarratives?.victoryHighCorruption
        : WORLD_LORE?.deathNarratives?.victoryLowCorruption;
    }
    const cause = (terminalSummary.causeOfDeath || '').toLowerCase();
    if (corruptionNow >= 90) return WORLD_LORE?.deathNarratives?.highCorruption;
    if (cause.includes('warp') || cause.includes('peril') || cause.includes('亚空间')) return WORLD_LORE?.deathNarratives?.warp;
    if (cause.includes('boss') || cause.includes('领主')) return WORLD_LORE?.deathNarratives?.boss;
    if (cause.includes('elite') || cause.includes('精英')) return WORLD_LORE?.deathNarratives?.elite;
    return WORLD_LORE?.deathNarratives?.normalEnemy;
  })();

  return (
    <div
      className={`app-shell w-full h-screen bg-black font-sans overflow-hidden relative ${isThemeTransitioning ? 'theme-transitioning' : ''}`}
      data-theme-mode={themeMode}
      data-bg-visual-mode={backgroundVisualMode}
    >
      <ViewBackgroundLayer
        screen={engine.state.screen}
        themeMode={themeMode}
        backgroundVisualMode={backgroundVisualMode}
      />
      <div key={`theme-flash-${themeFlashKey}`} className={`theme-swap-flash ${isThemeTransitioning ? 'is-active' : ''}`} aria-hidden="true" />
      <GlobalFilterOverlay />
      
      <div className="fixed top-2 right-2 z-50 flex gap-2">
        <button
          onClick={() => handleSetThemeMode(themeMode === 'dark' ? 'light' : 'dark')}
          className="app-topbar-btn px-3 py-1.5 text-xs rounded-lg border shadow-lg flex items-center gap-1.5 transition-colors"
          title={`切换到${themeMode === 'dark' ? '亮色' : '暗色'}模式`}
        >
          {themeMode === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          {themeMode === 'dark' ? '亮色' : '暗色'}
        </button>
        <button
          onClick={() => {
            setShowMenu(v => !v);
            setMenuPage('root');
          }}
          className="app-topbar-btn px-3 py-1.5 text-xs rounded-lg border shadow-lg"
        >
          菜单
        </button>
      </div>

      {showMenu && (
        <div className="fixed inset-0 z-[60] app-menu-backdrop" onClick={() => setShowMenu(false)}>
          <div
            className="absolute top-12 right-2 w-80 rounded-xl app-menu-panel backdrop-blur-md shadow-2xl p-3"
            onClick={(e) => e.stopPropagation()}
          >
            {menuPage === 'root' && (
              <div className="flex flex-col gap-2">
                <div className="px-2 py-1 text-[11px] tracking-wider uppercase text-slate-400">系统</div>
                
                <button
                  onClick={() => setMenuPage('theme')}
                  className="w-full text-left px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-100 flex items-center justify-between"
                >
                  <span className="flex items-center gap-2">
                    {themeMode === 'dark' ? <Moon size={14} /> : <Sun size={14} />}
                    主题与视觉
                  </span>
                  <span className="text-xs text-slate-400">{themeMode === 'dark' ? '暗色' : '亮色'}</span>
                </button>

                <div className="px-2 py-1 rounded-lg border border-slate-800 bg-slate-900/60">
                  <div className="text-[10px] tracking-wider uppercase text-slate-500 mb-2">背景强度</div>
                  <div className="grid grid-cols-3 gap-1">
                    {BACKGROUND_VISUAL_MODE_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => setBackgroundVisualMode(opt.id)}
                        className={[
                          'px-2 py-1.5 rounded-md border text-[11px] transition-colors',
                          backgroundVisualMode === opt.id
                            ? 'bg-slate-700 border-slate-500 text-white'
                            : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
                        ].join(' ')}
                        title={`背景强度：${opt.label}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => setMenuPage('save')}
                  className="w-full text-left px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-100"
                >
                  存档 / 读取
                </button>
                <button
                  onClick={handleRestart}
                  className="w-full text-left px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-100"
                >
                  重启本局
                </button>
                <button
                  onClick={handleReturnToLauncher}
                  className="w-full text-left px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-100"
                >
                  返回启动器
                </button>
                <button
                  onClick={() => setShowMenu(false)}
                  className="w-full text-left px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-400"
                >
                  关闭
                </button>
              </div>
            )}

            {menuPage === 'theme' && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between px-2 py-1">
                  <button
                    onClick={() => setMenuPage('root')}
                    className="text-xs text-slate-400 hover:text-slate-200"
                  >
                    ← 返回
                  </button>
                  <div className="text-[11px] tracking-wider uppercase text-slate-400">主题与视觉</div>
                </div>

                <div className="px-2 py-2 rounded-lg border border-slate-800 bg-slate-900/60">
                  <div className="text-[10px] tracking-wider uppercase text-slate-500 mb-2">色彩模式</div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleSetThemeMode('dark')}
                      className={`px-3 py-2 rounded-lg border text-sm flex items-center justify-center gap-2 transition-colors ${
                        themeMode === 'dark'
                          ? 'bg-slate-700 border-slate-500 text-white'
                          : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <Moon size={14} /> 暗色
                    </button>
                    <button
                      onClick={() => handleSetThemeMode('light')}
                      className={`px-3 py-2 rounded-lg border text-sm flex items-center justify-center gap-2 transition-colors ${
                        themeMode === 'light'
                          ? 'bg-slate-700 border-slate-500 text-white'
                          : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <Sun size={14} /> 亮色
                    </button>
                  </div>
                </div>

                <div className="px-2 py-2 rounded-lg border border-slate-800 bg-slate-900/60">
                  <div className="text-[10px] tracking-wider uppercase text-slate-500 mb-2">视觉强度</div>
                  <div className="grid grid-cols-3 gap-1">
                    {(['subtle', 'balanced', 'intense'] as const).map((intensity) => (
                      <button
                        key={intensity}
                        onClick={() => setVisualIntensity(intensity)}
                        className={`px-2 py-1.5 rounded-md border text-[11px] capitalize transition-colors ${
                          visualIntensity === intensity
                            ? 'bg-slate-700 border-slate-500 text-white'
                            : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        {intensity === 'subtle' ? '轻微' : intensity === 'balanced' ? '均衡' : '强烈'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="px-2 py-2 rounded-lg border border-slate-800 bg-slate-900/60">
                  <div className="text-[10px] tracking-wider uppercase text-slate-500 mb-2">滤镜层效果</div>
                  <div className="flex flex-col gap-2">
                    <label className="flex items-center justify-between cursor-pointer">
                      <span className="text-xs text-slate-300 flex items-center gap-2">
                        <Eye size={12} /> 暗角（边缘压暗）
                      </span>
                      <input
                        type="checkbox"
                        checked={filterEffects.vignette}
                        onChange={() => toggleFilter('vignette')}
                        className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-blue-500 focus:ring-blue-500"
                      />
                    </label>
                    <label className="flex items-center justify-between cursor-pointer">
                      <span className="text-xs text-slate-300 flex items-center gap-2">
                        <Layers size={12} /> 噪点纹理
                      </span>
                      <input
                        type="checkbox"
                        checked={filterEffects.noise}
                        onChange={() => toggleFilter('noise')}
                        className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-blue-500 focus:ring-blue-500"
                      />
                    </label>
                    <label className="flex items-center justify-between cursor-pointer">
                      <span className="text-xs text-slate-300 flex items-center gap-2">
                        <Zap size={12} /> 扫描线
                      </span>
                      <input
                        type="checkbox"
                        checked={filterEffects.scanlines}
                        onChange={() => toggleFilter('scanlines')}
                        className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-blue-500 focus:ring-blue-500"
                      />
                    </label>
                  </div>
                </div>
              </div>
            )}

            {menuPage === 'save' && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between px-2 py-1">
                  <button
                    onClick={() => setMenuPage('root')}
                    className="text-xs text-slate-400 hover:text-slate-200"
                  >
                    ← 返回
                  </button>
                  <div className="text-[11px] tracking-wider uppercase text-slate-400">存档 / 读取</div>
                </div>
                <button
                  onClick={handleQuickSave}
                  className="w-full text-left px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-100"
                >
                  快速存档
                </button>
                <button
                  onClick={handleQuickLoad}
                  disabled={!gameSetup.hasQuickSave()}
                  className="w-full text-left px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  快速读取
                </button>
                <div className="px-3 pt-1 text-xs text-slate-500">
                  存储到本地浏览器存储。
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {engine.state.screen === 'CharacterSelect' && (
        <Suspense fallback={<ScreenLoadingFallback label="CharacterSelect" />}>
          <CharacterSelectView engine={engine} />
        </Suspense>
      )}
      {engine.state.screen === 'Map' && (
        <Suspense fallback={<ScreenLoadingFallback label="Map" />}>
          <MapView engine={engine} backgroundVisualMode={backgroundVisualMode} />
        </Suspense>
      )}
      {engine.state.screen === 'Combat' && (
        <Suspense fallback={<ScreenLoadingFallback label="Combat" />}>
          <CombatView engine={engine} backgroundVisualMode={backgroundVisualMode} />
        </Suspense>
      )}
      {engine.state.screen === 'Reward' && (
        <Suspense fallback={<ScreenLoadingFallback label="Reward" />}>
          <RewardView engine={engine} />
        </Suspense>
      )}
      {engine.state.screen === 'Shop' && (
        <Suspense fallback={<ScreenLoadingFallback label="Shop" />}>
          <ShopView engine={engine} />
        </Suspense>
      )}
      {engine.state.screen === 'Rest' && (
        <Suspense fallback={<ScreenLoadingFallback label="Rest" />}>
          <RestView engine={engine} />
        </Suspense>
      )}
      {engine.state.screen === 'Upgrade' && (
        <Suspense fallback={<ScreenLoadingFallback label="Upgrade" />}>
          <UpgradeView engine={engine} />
        </Suspense>
      )}
      {engine.state.screen === 'RemoveCard' && (
        <Suspense fallback={<ScreenLoadingFallback label="RemoveCard" />}>
          <RemoveCardView engine={engine} />
        </Suspense>
      )}
      {engine.state.screen === 'Event' && (
        <Suspense fallback={<ScreenLoadingFallback label="Event" />}>
          <EventView engine={engine} />
        </Suspense>
      )}
      {engine.state.screen === 'GameOver' && (
        <div className="grimdark-dossier-screen h-full overflow-y-auto font-mono px-4 py-8">
          <div className="absolute inset-0 grimdark-crt-overlay" />
          <div className="absolute inset-0 grimdark-terminal-vignette" />
          <div className="min-h-full flex flex-col items-center justify-start relative z-10">
          <div className="flex items-center gap-4 mb-6 text-[#ef4444]">
            <Skull size={48} />
            <h1 className="text-4xl font-black tracking-[0.3em] uppercase">执行失败 (MIA/KIA)</h1>
          </div>
          {terminalSummary && metaProfile && (
            <div className="grimdark-dossier-frame">
              <div className="grimdark-dossier-corner grimdark-dossier-corner--tl" />
              <div className="grimdark-dossier-corner grimdark-dossier-corner--tr" />
              <div className="grimdark-dossier-corner grimdark-dossier-corner--bl" />
              <div className="grimdark-dossier-corner grimdark-dossier-corner--br" />

              <div className="grimdark-dossier-header flex justify-between items-end pb-4 mb-6">
                <div>
                  <div className="grimdark-dossier-kicker text-[10px]">审判庭档案录入</div>
                  <div className="text-xl text-[#ef4444] font-bold uppercase mt-1">死因: {terminalSummary.causeOfDeath}</div>
                </div>
                <div className="text-right text-xs text-[#a1a1aa] uppercase tracking-wider">
                  <div>最终深度: <span className="text-white">{terminalSummary.reachedFloor}</span></div>
                  <div>遗留战术典积: <span className="text-white">{terminalSummary.finalDeckSize}</span> 卷</div>
                </div>
              </div>

              {!!terminalSummary.voxLogTail?.length && (
                <div className="grimdark-blackbox mb-6 p-4">
                  <div className="grimdark-blackbox-title text-[10px] mb-2">机仆记录器碎片 (Blackbox Logs)</div>
                  <div className="space-y-1 font-mono text-[11px] leading-5 text-[#d4d4d8]">
                    {terminalSummary.voxLogTail.map((line, idx) => (
                      <div key={`go-vox-${idx}`} className="grimdark-blackbox-line truncate" title={line}>
                        &gt; {line}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-6">
                <div className="grimdark-dossier-card grimdark-dossier-card--verdict">
                  <div className="grimdark-dossier-cardTitle text-[10px] mb-2">异端裁定 / 信仰结算</div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>腐化度 (Corruption)</span>
                    <span className="grimdark-dossier-accent grimdark-dossier-accent--verdict">{corruptionNow}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>帝皇庇护 (Devotion)</span>
                    <span className="grimdark-dossier-accent grimdark-dossier-accent--devotion">{devotionNow}</span>
                  </div>
                </div>

                <div className="grimdark-dossier-card grimdark-dossier-card--requisition">
                  <div className="grimdark-dossier-cardTitle text-[10px] mb-2">战备回收评估</div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>回收征用点 (Requisition)</span>
                    <span className="grimdark-dossier-accent grimdark-dossier-accent--requisition">+{terminalSummary.earnedRequisition}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>亚空间回响 (Warp Echoes)</span>
                    <span className="grimdark-dossier-accent grimdark-dossier-accent--warp">+{terminalSummary.earnedWarpEchoes}</span>
                  </div>
                </div>
              </div>

              <div className="grimdark-dossier-archive mt-6">
                <div className="grimdark-dossier-cardTitle text-[10px] mb-2">综合归档</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                  <div>档案编号: <span className="font-mono text-white">{terminalSummary.runId}</span></div>
                  <div>死亡原因: <span className="text-[#fca5a5]">{terminalSummary.causeOfDeath}</span></div>
                  <div>当前征用点: <span className="text-white">{projectedRequisition}</span></div>
                  <div>当前亚空间回响: <span className="text-white">{projectedWarpEchoes}</span></div>
                </div>
              </div>

              {terminalNarrative && (
                <div className="grimdark-dossier-narrative mt-6 p-4 text-sm leading-6">
                  <div className="grimdark-dossier-kicker text-[10px] mb-2">判词附言</div>
                  {terminalNarrative}
                </div>
              )}

              {metaProfile.martyrLegacy && (
                <div className="grimdark-dossier-epitaph mt-6 text-center text-xs">
                  “他们的牺牲将被铭记：{metaProfile.martyrLegacy.epitaph}”
                </div>
              )}
            </div>
          )}
          <button 
            onClick={handleRestart}
            className="grimdark-dossier-action mt-8 px-8 py-4 font-bold"
          >
            派遣下一任牺牲者
          </button>
          </div>
        </div>
      )}
      {engine.state.screen === 'Victory' && (
        <div className="h-full overflow-y-auto text-white px-4 py-6 md:py-8">
          <div className="min-h-full flex flex-col items-center justify-start">
          <h1 className="text-4xl mb-4 text-yellow-500">行动归档 / Victory</h1>
          {terminalSummary && metaProfile && (
            <div className="w-full max-w-4xl rounded-2xl border border-slate-700/80 bg-slate-950/75 backdrop-blur-md p-5 md:p-6 mb-6 shadow-2xl">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <div className="text-xs tracking-[0.18em] uppercase text-slate-400">场外结算 / Meta Settlement</div>
                  <div className="text-sm text-emerald-300">行动完成</div>
                </div>
                <div className="text-right text-xs text-slate-400">
                  <div>层数 {terminalSummary.reachedFloor}</div>
                  <div>记忆印痕库 {terminalSummary.finalDeckSize}</div>
                </div>
              </div>
              {terminalNarrative && (
                <div className="mb-4 rounded-xl border border-emerald-900/30 bg-emerald-950/15 p-4">
                  <div className="text-[11px] uppercase tracking-widest text-emerald-300/80 mb-1">战区档案 / Debrief</div>
                  <div className="text-sm leading-6 text-emerald-100/90">{terminalNarrative}</div>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                  <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-2">本局收获</div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-300">征用点</span>
                    <span className="font-bold text-amber-300">+{terminalSummary.earnedRequisition}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm mt-1">
                    <span className="text-slate-300">亚空间回响</span>
                    <span className="font-bold text-violet-300">+{terminalSummary.earnedWarpEchoes}</span>
                  </div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                  <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-2">场外总量</div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-300">征用点</span>
                    <span className="font-bold text-amber-200">{projectedRequisition}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm mt-1">
                    <span className="text-slate-300">亚空间回响</span>
                    <span className="font-bold text-violet-200">{projectedWarpEchoes}</span>
                  </div>
                </div>
              </div>
              <div className="mt-3 rounded-xl border border-emerald-900/30 bg-emerald-950/15 p-3">
                <div className="text-[11px] uppercase tracking-wider text-emerald-300/80 mb-2">殉道者档案 / Martyr Archive</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                  <div className="text-slate-200">档案编号: <span className="font-mono text-slate-300">{terminalSummary.runId}</span></div>
                  <div className="text-slate-200">腐化 / 信仰: <span className="text-violet-200">{corruptionNow}</span> / <span className="text-emerald-200">{devotionNow}</span></div>
                  <div className="text-slate-200">状态: <span className="text-emerald-200">生还（暂准存续）</span></div>
                  <div className="text-slate-200">结算: <span className="text-slate-300">已归档</span></div>
                </div>
                {metaProfile.martyrLegacy && (
                  <div className="mt-2 text-sm text-emerald-100/90">当前传承位：{metaProfile.martyrLegacy.epitaph}</div>
                )}
                {!!terminalSummary.voxLogTail?.length && (
                  <div className="mt-3 rounded-lg border border-emerald-900/30 bg-black/35 p-3">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-emerald-200/70 mb-2">黑匣子 / Final Vox-Log</div>
                    <div className="space-y-1 font-mono text-[11px] leading-5 text-emerald-100/85">
                      {terminalSummary.voxLogTail.map((line, idx) => (
                        <div key={`vic-vox-${idx}`} className="truncate" title={line}>{line}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          <button 
            onClick={handleRestart}
            className="px-6 py-3 bg-slate-800 rounded-lg border border-slate-600 hover:bg-slate-700"
          >
            再来一局
          </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AppShell() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
