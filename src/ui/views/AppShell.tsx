/**
 * @file AppShell.tsx
 * @description 旧版应用外壳组件 - 旧引擎模式下的主界面结构
 *
 * 主要职责:
 * - 旧引擎模式下的游戏界面管理
 * - 资源预加载和路由资源管理
 * - 主题和背景视觉效果
 * - 游戏菜单和存档管理
 * - 各游戏视图的懒加载和切换
 *
 * 注意: 此组件为旧版实现，新版本请参考 UnifiedAppShell.tsx
 * UnifiedAppShell 支持旧引擎和新引擎(RuntimeV2)的双模式切换
 */
import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { ResourcePreloader, preloadRouteAssets } from '@/ui/components/ResourcePreloader';
import { computeRunSummary, GameEngine, gameSetup, globalEventBus, loadMetaProfile } from '@/core';
import { createLegacyRenderModel, type RenderModel } from '@/runtimeV2';
import { BACKGROUND_VISUAL_MODE_OPTIONS, BackgroundVisualMode } from '@/ui/components/backgroundVisuals';
import { ThemeProvider, useTheme } from '@/ui/theme/ThemeContext';
import { GlobalFilterOverlay } from '@/ui/overlays/GlobalFilterOverlay';
import { ViewBackgroundLayer, type ScreenId } from '@/ui/components/ViewBackgroundLayer';
import { SetupLauncher } from '@/ui/launcher/SetupLauncher';
import { Eye, Layers, Zap, Skull, Sun, Moon } from 'lucide-react';
import { getUiLabelZh } from '@/ui/content/terminology';
import { uiWorldLore } from '@/ui/content/worldLore';
import {
  buildEffectiveKeybinds,
  DEFAULT_KEYBINDS,
  detectKeybindConflicts,
  RESERVED_ACTIONS,
  type KeyboardActionId,
  type KeybindMap,
  useGlobalKeyboardInput
} from '@/ui/input';

const BG_VISUAL_MODE_KEY = 'deckrogue_bg_visual_mode';
const WORLD_LORE = uiWorldLore as any;
const KEYBIND_LABELS: Record<KeyboardActionId, string> = {
  toggleMenu: '打开菜单',
  back: '返回 / 关闭上一级',
  confirm: '确认当前焦点',
  close: '关闭 / 菜单',
  endTurn: '结束回合',
  cycleTarget: '切换目标',
  focusUp: '焦点上移',
  focusDown: '焦点下移',
  focusLeft: '焦点左移',
  focusRight: '焦点右移',
  playCard1: '打出第 1 张手牌',
  playCard2: '打出第 2 张手牌',
  playCard3: '打出第 3 张手牌',
  playCard4: '打出第 4 张手牌',
  playCard5: '打出第 5 张手牌',
  playCard6: '打出第 6 张手牌',
  playCard7: '打出第 7 张手牌',
  playCard8: '打出第 8 张手牌',
  playCard9: '打出第 9 张手牌',
  playCard10: '打出第 10 张手牌',
  selectOption1: '选择第 1 个选项',
  selectOption2: '选择第 2 个选项',
  selectOption3: '选择第 3 个选项',
  selectOption4: '选择第 4 个选项',
  selectOption5: '选择第 5 个选项',
  selectOption6: '选择第 6 个选项',
  selectOption7: '选择第 7 个选项',
  selectOption8: '选择第 8 个选项',
  selectOption9: '选择第 9 个选项',
  selectOption10: '选择第 10 个选项'
};
const KEYBIND_GROUPS: Array<{ label: string; actions: KeyboardActionId[] }> = [
  { label: '系统', actions: ['toggleMenu', 'back', 'close', 'confirm'] },
  { label: '战斗', actions: ['endTurn', 'cycleTarget'] },
  { label: '导航', actions: ['focusUp', 'focusDown', 'focusLeft', 'focusRight'] },
  { label: '手牌直选', actions: ['playCard1', 'playCard2', 'playCard3', 'playCard4', 'playCard5', 'playCard6', 'playCard7', 'playCard8', 'playCard9', 'playCard10'] },
  { label: '通用选项', actions: ['selectOption1', 'selectOption2', 'selectOption3', 'selectOption4', 'selectOption5', 'selectOption6', 'selectOption7', 'selectOption8', 'selectOption9', 'selectOption10'] }
];
const CharacterSelectView = lazy(async () => import('@/ui/views/CharacterSelectView').then((m) => ({ default: m.CharacterSelectView })));
const MapView = lazy(async () => import('@/ui/views/MapView').then((m) => ({ default: m.MapView })));
const CombatView = lazy(async () => import('@/ui/views/CombatView').then((m) => ({ default: m.CombatView })));
const RewardView = lazy(async () => import('@/ui/views/RewardView').then((m) => ({ default: m.RewardView })));
const ShopView = lazy(async () => import('@/ui/views/ShopView').then((m) => ({ default: m.ShopView })));
const RestView = lazy(async () => import('@/ui/views/RestView').then((m) => ({ default: m.RestView })));
const EventView = lazy(async () => import('@/ui/views/EventView').then((m) => ({ default: m.EventView })));
const UpgradeView = lazy(async () => import('@/ui/views/UpgradeView').then((m) => ({ default: m.UpgradeView })));
const RelicUpgradeView = lazy(async () => import('@/ui/views/RelicUpgradeView').then((m) => ({ default: m.RelicUpgradeView })));
const EnchantView = lazy(async () => import('@/ui/views/EnchantView').then((m) => ({ default: m.EnchantView })));
const RemoveCardView = lazy(async () => import('@/ui/views/RemoveCardView').then((m) => ({ default: m.RemoveCardView })));
const TutorialView = lazy(async () => import('@/ui/views/TutorialView').then((m) => ({ default: m.TutorialView })));

function ScreenLoadingFallback({ label }: { label: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="rounded-xl border border-slate-700 bg-slate-950/90 px-5 py-4 text-sm text-slate-200">
        正在加载 {getUiLabelZh(label)}...
      </div>
    </div>
  );
}

function formatKeyCodeLabel(code: string) {
  if (code.startsWith('Key')) return code.slice(3).toUpperCase();
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Arrow')) return ({ ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' } as Record<string, string>)[code] || code;
  if (code === 'Escape') return 'Esc';
  if (code === 'Enter') return 'Enter';
  if (code === 'Tab') return 'Tab';
  return code;
}

function resolveActiveScreen(screen: string): ScreenId {
  switch (screen) {
    case 'Launcher':
    case 'CharacterSelect':
    case 'Map':
    case 'Combat':
    case 'Reward':
    case 'Event':
    case 'Shop':
    case 'Rest':
    case 'Upgrade':
    case 'RemoveCard':
    case 'Enchant':
    case 'GameOver':
    case 'Victory':
      return screen;
    default:
      return 'Launcher';
  }
}

function AppContent() {
  const [engine, setEngine] = useState<GameEngine | null>(() => gameSetup.getEngine());
  const [renderModel, setRenderModel] = useState<RenderModel | null>(() => {
    const initialEngine = gameSetup.getEngine();
    return initialEngine ? createLegacyRenderModel(initialEngine) : null;
  });
  const [launcherError, setLauncherError] = useState<string | null>(null);
  const [, setTick] = useState(0);
  const [showMenu, setShowMenu] = useState(false);
  const [menuPage, setMenuPage] = useState<'root' | 'save' | 'theme' | 'keybinds'>('root');
  const [showTutorial, setShowTutorial] = useState(false);
  const [keybinds, setKeybinds] = useState<KeybindMap>(() => {
    const stored = gameSetup.getSaveManager().loadSettings()?.keybinds as Partial<Record<KeyboardActionId, string>> | undefined;
    return buildEffectiveKeybinds(stored);
  });
  const [rebindingAction, setRebindingAction] = useState<KeyboardActionId | null>(null);
  const [keybindError, setKeybindError] = useState<string | null>(null);
  const [isThemeTransitioning, setIsThemeTransitioning] = useState(false);
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
        setRenderModel(createLegacyRenderModel(existingEngine));
      }
    }
  }, [engine]);

  useEffect(() => {
    if (!engine) {
      setRenderModel(null);
      return;
    }
    setRenderModel(createLegacyRenderModel(engine));
    const unsubscribe = engine.subscribe(() => {
      setTick(t => t + 1);
      setRenderModel(createLegacyRenderModel(engine));
    });
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

  const persistKeybinds = useCallback((next: KeybindMap) => {
    const saveManager = gameSetup.getSaveManager();
    const currentSettings = saveManager.loadSettings() ?? {};
    saveManager.saveSettings({ ...currentSettings, keybinds: next });
  }, []);

  const getVisibleInteractiveElements = useCallback((selector: string) => {
    if (typeof document === 'undefined') return [] as HTMLElement[];
    return Array.from(document.querySelectorAll<HTMLElement>(selector)).filter((element) => {
      if (element.hasAttribute('disabled') || element.getAttribute('aria-disabled') === 'true') return false;
      if (element.getAttribute('data-keyboard-hidden') === 'true') return false;
      if (element.getClientRects().length === 0) return false;
      const style = window.getComputedStyle(element);
      return style.visibility !== 'hidden' && style.display !== 'none';
    });
  }, []);

  const clickFirst = useCallback((selector: string) => {
    const [target] = getVisibleInteractiveElements(selector);
    if (!target) return false;
    target.focus();
    target.click();
    return true;
  }, [getVisibleInteractiveElements]);

  const focusByStep = useCallback((step: number) => {
    const elements = getVisibleInteractiveElements('[data-keyboard-focus="true"]');
    if (elements.length === 0) return false;
    const active = document.activeElement as HTMLElement | null;
    const currentIndex = active ? elements.indexOf(active) : -1;
    const nextIndex = currentIndex === -1 ? (step > 0 ? 0 : elements.length - 1) : (currentIndex + step + elements.length) % elements.length;
    const next = elements[nextIndex];
    next.focus();
    next.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    return true;
  }, [getVisibleInteractiveElements]);

  const cycleTarget = useCallback(() => {
    const targets = getVisibleInteractiveElements('[data-keyboard-target="true"]');
    if (targets.length === 0) return false;
    const active = document.activeElement as HTMLElement | null;
    const currentIndex = active ? targets.indexOf(active) : -1;
    const next = targets[(currentIndex + 1 + targets.length) % targets.length];
    next.focus();
    next.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    return true;
  }, [getVisibleInteractiveElements]);

  const handleConfirm = useCallback(() => {
    const active = document.activeElement as HTMLElement | null;
    if (active && active.matches('[data-keyboard-focus="true"], button, [role="button"]')) {
      active.click();
      return true;
    }
    return clickFirst('[data-keyboard-default="true"], [data-keyboard-option="1"]');
  }, [clickFirst]);

  const handleClose = useCallback(() => {
    if (rebindingAction) {
      setRebindingAction(null);
      setKeybindError(null);
      return true;
    }
    if (showMenu) {
      if (menuPage !== 'root') {
        setMenuPage('root');
      } else {
        setShowMenu(false);
      }
      return true;
    }
    return clickFirst('[data-keyboard-close="true"]');
  }, [clickFirst, menuPage, rebindingAction, showMenu]);

  const handleKeyboardAction = useCallback((action: KeyboardActionId) => {
    if (action === 'toggleMenu') {
      setShowMenu((open) => !open);
      if (!showMenu) setMenuPage('root');
      return;
    }
    if (action === 'close' || action === 'back') {
      handleClose();
      return;
    }
    if (action === 'confirm') {
      handleConfirm();
      return;
    }
    if (action === 'focusUp' || action === 'focusLeft') {
      focusByStep(-1);
      return;
    }
    if (action === 'focusDown' || action === 'focusRight') {
      focusByStep(1);
      return;
    }
    if (action === 'cycleTarget') {
      cycleTarget();
      return;
    }
    if (action === 'endTurn') {
      clickFirst('[data-keyboard-end-turn="true"]');
      return;
    }
    if (action.startsWith('playCard')) {
      const index = action.replace('playCard', '');
      clickFirst(`[data-keyboard-card-index="${index}"]`);
      return;
    }
    if (action.startsWith('selectOption')) {
      const index = action.replace('selectOption', '');
      clickFirst(`[data-keyboard-option="${index}"]`);
    }
  }, [clickFirst, cycleTarget, focusByStep, handleClose, handleConfirm, showMenu]);

  const handleCaptureKey = useCallback((code: string) => {
    if (!rebindingAction) return;
    const proposed = buildEffectiveKeybinds({ ...keybinds, [rebindingAction]: code });
    const conflicts = detectKeybindConflicts(proposed).filter((entry) => entry.actions.includes(rebindingAction));
    if (conflicts.length > 0) {
      const conflictingLabels = conflicts[0].actions.map((action) => KEYBIND_LABELS[action]).join(' / ');
      setKeybindError(`键位 ${formatKeyCodeLabel(code)} 与 ${conflictingLabels} 冲突`);
      return;
    }
    setKeybinds(proposed);
    persistKeybinds(proposed);
    setRebindingAction(null);
    setKeybindError(null);
  }, [keybinds, persistKeybinds, rebindingAction]);

  const keyboardContext = {
    screen: renderModel?.screen ?? engine?.state.screen ?? 'Launcher',
    menuOpen: showMenu,
    menuPage,
    overlay: null,
    modal: null,
    rebindingAction
  };

  useGlobalKeyboardInput({
    context: keyboardContext,
    keybinds,
    onAction: (action) => handleKeyboardAction(action),
    onCaptureKey: (code) => handleCaptureKey(code),
    onCaptureCancel: () => {
      setRebindingAction(null);
      setKeybindError(null);
    }
  });

  const handleStartNewRun = () => {
    try {
      setLauncherError(null);
      setShowTutorial(false);
      if (gameSetup.isRunning()) {
        gameSetup.clearActiveRun();
      }
      const newEngine = gameSetup.startNewRun();
      setEngine(newEngine);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '无法启动新战区';
      console.error('启动新战区失败:', error);
      setLauncherError(`启动失败: ${errorMessage}。请检查游戏文件是否完整。`);
    }
  };

  const handleLoadSlot = (slotId: string) => {
    try {
      setLauncherError(null);
      setShowTutorial(false);
      const loadedEngine = gameSetup.loadRun(slotId);
      if (!loadedEngine) {
        setLauncherError(`读取存档失败：${slotId}。存档文件可能已损坏或不存在。`);
        return;
      }
      setEngine(loadedEngine);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '读取存档失败';
      console.error('读取存档失败:', error);
      setLauncherError(`读取存档失败: ${errorMessage}。请检查存档文件是否完整。`);
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
    setShowTutorial(false);
    setLauncherError(null);
    gameSetup.clearActiveRun();
    setEngine(null);
  };

  const handleSaveAndQuit = () => {
    try {
      const result = gameSetup.saveAndQuit();
      if (result.ok) {
        setShowMenu(false);
        setMenuPage('root');
        setLauncherError(null);
        setEngine(null);
      } else {
        const errorMessage = result.error || '保存失败';
        console.error('保存游戏失败:', errorMessage);
        setLauncherError(`保存失败: ${errorMessage}。请检查存储空间是否充足。`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '保存失败';
      console.error('保存游戏失败:', error);
      setLauncherError(`保存失败: ${errorMessage}。请检查存储空间是否充足。`);
    }
  };

  const [showRestartCombatConfirm, setShowRestartCombatConfirm] = useState(false);

  const handleRestartCombat = () => {
    setShowMenu(false);
    setShowRestartCombatConfirm(true);
  };

  const confirmRestartCombat = () => {
    try {
      setShowRestartCombatConfirm(false);
      const result = gameSetup.restartCurrentCombat();
      if (!result.ok) {
        const errorMessage = result.error || '重开失败';
        console.error('重开战斗失败:', errorMessage);
        setLauncherError(`重开战斗失败: ${errorMessage}。请尝试返回主菜单后重新开始。`);
      }
      setTick(t => t + 1);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '重开失败';
      console.error('重开战斗失败:', error);
      setLauncherError(`重开战斗失败: ${errorMessage}。请尝试返回主菜单后重新开始。`);
    }
  };

  const handleRestart = () => {
    try {
      setShowMenu(false);
      setMenuPage('root');
      gameSetup.clearActiveRun();
      const newEngine = gameSetup.startNewRun();
      setEngine(newEngine);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '重启失败';
      console.error('重启游戏失败:', error);
      setLauncherError(`重启游戏失败: ${errorMessage}。请检查游戏文件是否完整。`);
    }
  };

  const handleQuickSave = () => {
    try {
      gameSetup.quickSave();
      setTick(t => t + 1);
      setShowMenu(false);
      setMenuPage('root');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '快速保存失败';
      console.error('快速保存失败:', error);
      setLauncherError(`快速保存失败: ${errorMessage}。请检查存储空间是否充足。`);
    }
  };

  const handleQuickLoad = () => {
    try {
      const loadedEngine = gameSetup.quickLoad();
      if (loadedEngine) {
        setEngine(loadedEngine);
      } else {
        setLauncherError('快速读取失败：未找到有效快速存档。');
      }
      setShowMenu(false);
      setMenuPage('root');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '快速读取失败';
      console.error('快速读取失败:', error);
      setLauncherError(`快速读取失败: ${errorMessage}。请检查存档文件是否完整。`);
    }
  };

  const runThemeTransition = () => {
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
  const topbarThemeLabel = themeMode === 'dark' ? '亮色' : '暗色';
  const menuThemeLabel = themeMode === 'dark' ? '暗色' : '亮色';

  if (!engine) {
    const saveSlots = gameSetup.getSaveManager().getSaveSlots();
    const metaProfile = loadMetaProfile();
    return (
      <>
        <SetupLauncher
          canContinue={gameSetup.hasQuickSave() || saveSlots.length > 0}
          saveSlots={saveSlots}
          metaProfile={metaProfile}
          tutorialOpen={showTutorial}
          onNewRun={handleStartNewRun}
          onOpenTutorial={() => setShowTutorial(true)}
          onContinue={handleContinueRun}
          onLoadSlot={handleLoadSlot}
          onDeleteSlot={handleDeleteSlot}
          error={launcherError}
        />
        <Suspense fallback={<ScreenLoadingFallback label="Tutorial" />}>
          <TutorialView
            open={showTutorial}
            onClose={() => setShowTutorial(false)}
            onStartRun={handleStartNewRun}
          />
        </Suspense>
      </>
    );
  }

  const activeScreen = resolveActiveScreen(renderModel?.screen ?? engine.state.screen);
  const isTerminalScreen = activeScreen === 'GameOver' || activeScreen === 'Victory';
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
        screen={activeScreen}
        themeMode={themeMode}
        backgroundVisualMode={backgroundVisualMode}
      />
      <div className={`theme-swap-flash ${isThemeTransitioning ? 'is-active' : ''}`} aria-hidden="true" />
      <GlobalFilterOverlay />

      <div className="fixed top-2 right-2 z-50 flex gap-2">
        <button
          onClick={() => handleSetThemeMode(themeMode === 'dark' ? 'light' : 'dark')}
          className="app-topbar-btn px-3 py-1.5 text-xs rounded-lg border shadow-lg flex items-center gap-1.5 transition-colors"
          title={`切换到${topbarThemeLabel}模式`}
        >
          <span className="relative inline-flex h-[14px] w-[14px] items-center justify-center" aria-hidden="true">
            <Sun size={14} className={themeMode === 'dark' ? 'block' : 'hidden'} />
            <Moon size={14} className={themeMode === 'dark' ? 'hidden' : 'block'} />
          </span>
          {topbarThemeLabel}
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
                  data-keyboard-option="1"
                  data-keyboard-focus="true"
                >
                  <span className="flex items-center gap-2">
                    <span className="relative inline-flex h-[14px] w-[14px] items-center justify-center" aria-hidden="true">
                      <Moon size={14} className={themeMode === 'dark' ? 'block' : 'hidden'} />
                      <Sun size={14} className={themeMode === 'dark' ? 'hidden' : 'block'} />
                    </span>
                    主题与视觉
                  </span>
                  <span className="text-xs text-slate-400">{menuThemeLabel}</span>
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
                  data-keyboard-option="2"
                  data-keyboard-focus="true"
                >
                  存档 / 读取
                </button>
                <button
                  onClick={() => setMenuPage('keybinds')}
                  className="w-full text-left px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-100"
                  data-keyboard-option="3"
                  data-keyboard-focus="true"
                >
                  键位设置
                </button>
                <button
                  onClick={() => {
                    setShowMenu(false);
                    setMenuPage('root');
                    setShowTutorial(true);
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-100"
                  data-keyboard-option="4"
                  data-keyboard-focus="true"
                >
                  战区教程
                </button>
                <button
                  onClick={handleRestart}
                  className="w-full text-left px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-100"
                  data-keyboard-option="5"
                  data-keyboard-focus="true"
                >
                  重启本局
                </button>
                <button
                  onClick={handleReturnToLauncher}
                  className="w-full text-left px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-100"
                  data-keyboard-option="5"
                  data-keyboard-focus="true"
                >
                  返回启动器
                </button>
                <button
                  onClick={handleSaveAndQuit}
                  className="w-full text-left px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-100"
                  data-keyboard-option="6"
                  data-keyboard-focus="true"
                >
                  保存并退出
                </button>
                <button
                  onClick={handleRestartCombat}
                  disabled={!gameSetup.hasCombatRestartCheckpoint()}
                  className="w-full text-left px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
                  data-keyboard-option="7"
                  data-keyboard-focus="true"
                >
                  重开当前战斗
                </button>
                <button
                  onClick={() => setShowMenu(false)}
                  className="w-full text-left px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-400"
                  data-keyboard-option="8"
                  data-keyboard-focus="true"
                  data-keyboard-close="true"
                >
                  关闭
                </button>
              </div>
            )}

            {showRestartCombatConfirm && (
              <div className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center" onClick={() => setShowRestartCombatConfirm(false)}>
                <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-sm mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                  <h3 className="text-lg font-bold text-white mb-2">确认重开当前战斗？</h3>
                  <p className="text-sm text-slate-300 mb-4">当前战斗进度将丢失，但异端阵列和抽牌堆保持不变。</p>
                  <div className="flex gap-3 justify-end">
                    <button
                      onClick={() => setShowRestartCombatConfirm(false)}
                      className="px-4 py-2 rounded-lg border border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700"
                      data-keyboard-option="1"
                      data-keyboard-focus="true"
                    >
                      取消
                    </button>
                    <button
                      onClick={confirmRestartCombat}
                      className="px-4 py-2 rounded-lg bg-red-700 text-white hover:bg-red-600"
                      data-keyboard-option="2"
                      data-keyboard-focus="true"
                    >
                      确认重开
                    </button>
                  </div>
                </div>
              </div>
            )}

            {menuPage === 'theme' && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between px-2 py-1">
                  <button
                    onClick={() => setMenuPage('root')}
                    className="text-xs text-slate-400 hover:text-slate-200"
                    data-keyboard-focus="true"
                    data-keyboard-back="true"
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
                      data-keyboard-option="1"
                      data-keyboard-focus="true"
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
                      data-keyboard-option="2"
                      data-keyboard-focus="true"
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
                        data-keyboard-focus="true"
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
                        data-keyboard-focus="true"
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
                        data-keyboard-focus="true"
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
                        data-keyboard-focus="true"
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
                    data-keyboard-focus="true"
                    data-keyboard-back="true"
                  >
                    ← 返回
                  </button>
                  <div className="text-[11px] tracking-wider uppercase text-slate-400">存档 / 读取</div>
                </div>
                <button
                  onClick={handleQuickSave}
                  className="w-full text-left px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-100"
                  data-keyboard-option="1"
                  data-keyboard-focus="true"
                >
                  快速存档
                </button>
                <button
                  onClick={handleQuickLoad}
                  disabled={!gameSetup.hasQuickSave()}
                  className="w-full text-left px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
                  data-keyboard-option="2"
                  data-keyboard-focus="true"
                >
                  快速读取
                </button>
                <div className="px-3 pt-1 text-xs text-slate-500">
                  存储到本地浏览器存储。
                </div>
              </div>
            )}

            {menuPage === 'keybinds' && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between px-2 py-1">
                  <button
                    onClick={() => {
                      setMenuPage('root');
                      setRebindingAction(null);
                      setKeybindError(null);
                    }}
                    className="text-xs text-slate-400 hover:text-slate-200"
                    data-keyboard-focus="true"
                    data-keyboard-back="true"
                  >
                    ← 返回
                  </button>
                  <div className="text-[11px] tracking-wider uppercase text-slate-400">键位设置</div>
                  <button
                    onClick={() => {
                      setKeybinds(DEFAULT_KEYBINDS);
                      persistKeybinds(DEFAULT_KEYBINDS);
                      setRebindingAction(null);
                      setKeybindError(null);
                    }}
                    className="text-xs text-slate-300 hover:text-white"
                    data-keyboard-option="10"
                    data-keyboard-focus="true"
                  >
                    恢复默认
                  </button>
                </div>

                <div className="px-3 text-xs text-slate-500">
                  单键重绑。按下条目后直接捕获下一个按键。`Esc` 为系统保留键，不可重绑。
                </div>
                {keybindError && (
                  <div className="mx-2 rounded-lg border border-red-800/60 bg-red-950/40 px-3 py-2 text-xs text-red-200">
                    {keybindError}
                  </div>
                )}

                <div className="max-h-[26rem] overflow-y-auto pr-1 space-y-3">
                  {KEYBIND_GROUPS.map((group) => (
                    <div key={group.label} className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                      <div className="mb-2 text-[10px] tracking-widest uppercase text-slate-500">{group.label}</div>
                      <div className="space-y-2">
                        {group.actions.map((action) => {
                          const reserved = RESERVED_ACTIONS.has(action);
                          const isCapturing = rebindingAction === action;
                          return (
                            <div key={action} className="flex items-center justify-between gap-3 rounded-md border border-slate-800 bg-slate-950/70 px-3 py-2">
                              <div className="text-sm text-slate-200">{KEYBIND_LABELS[action]}</div>
                              <button
                                onClick={() => {
                                  if (reserved) return;
                                  setRebindingAction(action);
                                  setKeybindError(null);
                                }}
                                disabled={reserved}
                                className={`min-w-24 rounded-md border px-3 py-1.5 text-sm ${reserved ? 'border-slate-700 bg-slate-900 text-slate-500 cursor-not-allowed' : isCapturing ? 'border-emerald-500 bg-emerald-950/40 text-emerald-200 animate-pulse' : 'border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800'}`}
                                data-keyboard-focus="true"
                              >
                                {reserved ? `${formatKeyCodeLabel(keybinds[action])} 固定` : isCapturing ? '按下按键…' : formatKeyCodeLabel(keybinds[action])}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <Suspense fallback={<ScreenLoadingFallback label="Tutorial" />}>
        <TutorialView
          open={showTutorial}
          onClose={() => setShowTutorial(false)}
          onStartRun={activeScreen === 'Launcher' ? handleStartNewRun : undefined}
        />
      </Suspense>

      <ResourcePreloader resources={preloadRouteAssets(activeScreen)}>
        {activeScreen === 'CharacterSelect' && (
          <Suspense fallback={<ScreenLoadingFallback label="CharacterSelect" />}>
            <CharacterSelectView engine={engine} />
          </Suspense>
        )}
        {activeScreen === 'Map' && (
          <Suspense fallback={<ScreenLoadingFallback label="Map" />}>
            <MapView engine={engine} renderModel={renderModel} backgroundVisualMode={backgroundVisualMode} />
          </Suspense>
        )}
        {activeScreen === 'Combat' && (
          <Suspense fallback={<ScreenLoadingFallback label="Combat" />}>
            <CombatView engine={engine} backgroundVisualMode={backgroundVisualMode} />
          </Suspense>
        )}
        {activeScreen === 'Reward' && (
          <Suspense fallback={<ScreenLoadingFallback label="Reward" />}>
            <RewardView engine={engine} renderModel={renderModel} />
          </Suspense>
        )}
        {activeScreen === 'Shop' && (
          <Suspense fallback={<ScreenLoadingFallback label="Shop" />}>
            <ShopView engine={engine} renderModel={renderModel} />
          </Suspense>
        )}
        {activeScreen === 'Rest' && (
          <Suspense fallback={<ScreenLoadingFallback label="Rest" />}>
            <RestView engine={engine} renderModel={renderModel} />
          </Suspense>
        )}
        {activeScreen === 'Upgrade' && (
          <Suspense fallback={<ScreenLoadingFallback label="Upgrade" />}>
            <UpgradeView engine={engine} />
          </Suspense>
        )}
        {activeScreen === 'RelicUpgrade' && (
          <Suspense fallback={<ScreenLoadingFallback label="RelicUpgrade" />}>
            <RelicUpgradeView engine={engine} />
          </Suspense>
        )}
        {activeScreen === 'Enchant' && (
          <Suspense fallback={<ScreenLoadingFallback label="Enchant" />}>
            <EnchantView engine={engine} />
          </Suspense>
        )}
        {activeScreen === 'RemoveCard' && (
          <Suspense fallback={<ScreenLoadingFallback label="RemoveCard" />}>
            <RemoveCardView engine={engine} />
          </Suspense>
        )}
        {activeScreen === 'Event' && (
          <Suspense fallback={<ScreenLoadingFallback label="Event" />}>
            <EventView engine={engine} />
          </Suspense>
        )}
      </ResourcePreloader>
      {activeScreen === 'GameOver' && (
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
                    <span>回收征用点</span>
                    <span className="grimdark-dossier-accent grimdark-dossier-accent--requisition">+{terminalSummary.earnedRequisition}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>亚空间回响</span>
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
      {activeScreen === 'Victory' && (
        <div className="h-full overflow-y-auto text-white px-4 py-6 md:py-8">
          <div className="min-h-full flex flex-col items-center justify-start">
          <h1 className="text-4xl mb-4 text-yellow-500">行动归档</h1>
          {terminalSummary && metaProfile && (
            <div className="w-full max-w-4xl rounded-2xl border border-slate-700/80 bg-slate-950/75 backdrop-blur-md p-5 md:p-6 mb-6 shadow-2xl">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <div className="text-xs tracking-[0.18em] uppercase text-slate-400">局外结算</div>
                  <div className="text-sm text-emerald-300">行动完成</div>
                </div>
                <div className="text-right text-xs text-slate-400">
                  <div>层数 {terminalSummary.reachedFloor}</div>
                  <div>记忆印痕库 {terminalSummary.finalDeckSize}</div>
                </div>
              </div>
              {terminalNarrative && (
                <div className="mb-4 rounded-xl border border-emerald-900/30 bg-emerald-950/15 p-4">
                  <div className="text-[11px] uppercase tracking-widest text-emerald-300/80 mb-1">战区简报</div>
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
                <div className="text-[11px] uppercase tracking-wider text-emerald-300/80 mb-2">殉道者档案</div>
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
                    <div className="text-[10px] uppercase tracking-[0.16em] text-emerald-200/70 mb-2">最终语音记录</div>
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
