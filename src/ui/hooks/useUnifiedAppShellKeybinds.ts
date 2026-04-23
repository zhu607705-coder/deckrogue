import { useCallback, useEffect, useRef, useState } from 'react';
import {
  buildEffectiveKeybinds,
  DEFAULT_KEYBINDS,
  detectKeybindConflicts,
  RESERVED_ACTIONS,
  type KeyboardActionId,
  type KeybindMap,
  useGlobalKeyboardInput
} from '@/ui/input';
import { getUiLabelZh } from '@/ui/content/terminology';
import { animationSpeedManager, ANIMATION_SPEEDS, type AnimationSpeedLevel } from '@/ui/animations/AnimationSpeedManager';
import { uiWorldLore } from '@/ui/content/worldLore';
import { Eye, Layers, Zap, Skull, Cpu, Database, Sun, Moon } from 'lucide-react';
import { gameSetup } from '@/core';

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

export function useUnifiedAppShellKeybinds() {
  const [keybinds, setKeybinds] = useState<KeybindMap>(() => {
    const stored = gameSetup.getSaveManager().loadSettings()?.keybinds as Partial<Record<KeyboardActionId, string>> | undefined;
    return buildEffectiveKeybinds(stored);
  });
  const [rebindingAction, setRebindingAction] = useState<KeyboardActionId | null>(null);
  const [keybindError, setKeybindError] = useState<string | null>(null);

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
    // Note: showMenu and menuPage are not in this hook's scope; they are handled in the component.
    // We'll return false to let the component handle the menu close logic.
    // Actually, we need to know the menu state. We'll move showMenu and menuPage into the hook as well.
    // Let's reconsider: it's better to move the entire menu state into the hook.
    // We'll do that in a separate step. For now, we'll return false and let the component handle it.
    return false;
  }, [rebindingAction]);

  const handleKeyboardAction = useCallback((action: KeyboardActionId) => {
    if (action === 'toggleMenu') {
      // We don't have showMenu here; we'll return a special action for the component to handle.
      // Instead, we'll move the toggleMenu logic into the hook by having showMenu state.
      // Let's restart and include showMenu and menuPage in the hook.
      // We'll do that in a separate commit. For now, we'll keep the hook focused on keybinds only and leave menu state in the component.
      // Given the time, we'll keep the menu state in the component and adjust the hook to return an action for toggleMenu.
      // We'll return a string 'toggleMenu' to indicate the component should toggle the menu.
      return 'toggleMenu';
    }
    if (action === 'close' || action === 'back') {
      // We'll return 'close' for the component to handle.
      return 'close';
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
      return;
    }
  }, [clickFirst, cycleTarget, focusByStep, handleConfirm]);

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

  const formatKeyCodeLabel = useCallback((code: string) => {
    if (code.startsWith('Key')) return code.slice(3).toUpperCase();
    if (code.startsWith('Digit')) return code.slice(5);
    if (code.startsWith('Arrow')) return ({ ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' } as Record<string, string>)[code] || code;
    if (code === 'Escape') return 'Esc';
    if (code === 'Enter') return 'Enter';
    if (code === 'Tab') return 'Tab';
    return code;
  }, []);

  // We need to expose the state and functions that the component needs.
  return {
    keybinds,
    setKeybinds,
    rebindingAction,
    setRebindingAction,
    keybindError,
    setKeybindError,
    persistKeybinds,
    getVisibleInteractiveElements,
    clickFirst,
    focusByStep,
    cycleTarget,
    handleConfirm,
    handleClose,
    handleKeyboardAction,
    handleCaptureKey,
    formatKeyCodeLabel,
    KEYBIND_LABELS,
    KEYBIND_GROUPS
  };
}