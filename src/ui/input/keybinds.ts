export type KeyboardActionId =
  | 'toggleMenu'
  | 'back'
  | 'confirm'
  | 'close'
  | 'endTurn'
  | 'cycleTarget'
  | 'focusUp'
  | 'focusDown'
  | 'focusLeft'
  | 'focusRight'
  | `playCard${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10}`
  | `selectOption${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10}`;

export type KeybindMap = Record<KeyboardActionId, string>;

export interface AppKeyboardContext {
  screen: string;
  menuOpen: boolean;
  menuPage: string;
  overlay: string | null;
  modal: string | null;
  rebindingAction: KeyboardActionId | null;
}

const PLAY_CARD_ACTIONS: KeyboardActionId[] = Array.from({ length: 10 }, (_, idx) => `playCard${idx + 1}` as KeyboardActionId);
const SELECT_OPTION_ACTIONS: KeyboardActionId[] = Array.from({ length: 10 }, (_, idx) => `selectOption${idx + 1}` as KeyboardActionId);

export const RESERVED_KEYBINDS: Partial<KeybindMap> = {
  close: 'Escape',
  back: 'Escape'
};

export const RESERVED_ACTIONS = new Set<KeyboardActionId>(['close', 'back']);

export const DEFAULT_KEYBINDS: KeybindMap = {
  toggleMenu: 'KeyM',
  back: 'Escape',
  confirm: 'Enter',
  close: 'Escape',
  endTurn: 'KeyE',
  cycleTarget: 'Tab',
  focusUp: 'ArrowUp',
  focusDown: 'ArrowDown',
  focusLeft: 'ArrowLeft',
  focusRight: 'ArrowRight',
  playCard1: 'Digit1',
  playCard2: 'Digit2',
  playCard3: 'Digit3',
  playCard4: 'Digit4',
  playCard5: 'Digit5',
  playCard6: 'Digit6',
  playCard7: 'Digit7',
  playCard8: 'Digit8',
  playCard9: 'Digit9',
  playCard10: 'Digit0',
  selectOption1: 'Digit1',
  selectOption2: 'Digit2',
  selectOption3: 'Digit3',
  selectOption4: 'Digit4',
  selectOption5: 'Digit5',
  selectOption6: 'Digit6',
  selectOption7: 'Digit7',
  selectOption8: 'Digit8',
  selectOption9: 'Digit9',
  selectOption10: 'Digit0'
};

const KEYCODE_PATTERN = /^[A-Za-z0-9]+$/;

function isValidKeyCode(code: unknown): code is string {
  return typeof code === 'string' && code.length > 0 && KEYCODE_PATTERN.test(code);
}

export function normalizeKeybindSettings(settings: Partial<Record<KeyboardActionId, string>> | null | undefined): KeybindMap {
  const next = { ...DEFAULT_KEYBINDS };
  if (settings) {
    for (const [action, code] of Object.entries(settings) as [KeyboardActionId, string][]) {
      if (!(action in DEFAULT_KEYBINDS)) continue;
      if (RESERVED_ACTIONS.has(action)) continue;
      if (!isValidKeyCode(code)) continue;
      next[action] = code;
    }
  }
  for (const [action, code] of Object.entries(RESERVED_KEYBINDS) as [KeyboardActionId, string][]) {
    next[action] = code;
  }
  return next;
}

export function buildEffectiveKeybinds(settings: Partial<Record<KeyboardActionId, string>> | null | undefined): KeybindMap {
  return normalizeKeybindSettings(settings);
}

function areActionsCompatible(a: KeyboardActionId, b: KeyboardActionId) {
  if (a === b) return true;
  const pair = [a, b].sort().join('|');
  if (pair === 'back|close') return true;
  const playCardMatch = /^playCard(\d+)$/.exec(a) || /^playCard(\d+)$/.exec(b);
  const selectOptionMatch = /^selectOption(\d+)$/.exec(a) || /^selectOption(\d+)$/.exec(b);
  if (playCardMatch && selectOptionMatch) {
    const playIndex = /^playCard(\d+)$/.exec(a)?.[1] ?? /^playCard(\d+)$/.exec(b)?.[1];
    const optionIndex = /^selectOption(\d+)$/.exec(a)?.[1] ?? /^selectOption(\d+)$/.exec(b)?.[1];
    return playIndex === optionIndex;
  }
  return false;
}

export interface KeybindConflict {
  key: string;
  actions: KeyboardActionId[];
}

export function detectKeybindConflicts(keybinds: KeybindMap): KeybindConflict[] {
  const byKey = new Map<string, KeyboardActionId[]>();
  for (const [action, key] of Object.entries(keybinds) as [KeyboardActionId, string][]) {
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push(action);
  }
  const conflicts: KeybindConflict[] = [];
  for (const [key, actions] of byKey.entries()) {
    const incompatible = actions.filter((action, idx) =>
      actions.slice(idx + 1).some((other) => !areActionsCompatible(action, other))
    );
    if (incompatible.length > 0) {
      const unique = Array.from(new Set(actions));
      conflicts.push({ key, actions: unique });
    }
  }
  return conflicts;
}

function findSelectOptionAction(code: string) {
  return (SELECT_OPTION_ACTIONS.find((action) => DEFAULT_KEYBINDS[action] === code) ?? null) as KeyboardActionId | null;
}

function findPlayCardAction(code: string) {
  return (PLAY_CARD_ACTIONS.find((action) => DEFAULT_KEYBINDS[action] === code) ?? null) as KeyboardActionId | null;
}

function findActionByKey(code: string, keybinds: KeybindMap, actions: KeyboardActionId[]) {
  return actions.find((action) => keybinds[action] === code) ?? null;
}

export function resolveKeyboardAction(
  code: string,
  context: AppKeyboardContext,
  keybinds: KeybindMap
): KeyboardActionId | null {
  if (!isValidKeyCode(code)) return null;
  if (context.rebindingAction) return null;

  if (keybinds.close === code) return 'close';
  if (keybinds.toggleMenu === code) return context.menuOpen ? 'close' : 'toggleMenu';

  const navigationAction = findActionByKey(code, keybinds, ['focusUp', 'focusDown', 'focusLeft', 'focusRight']);
  const confirmAction = keybinds.confirm === code ? 'confirm' : null;

  if (context.menuOpen) {
    const optionAction = findActionByKey(code, keybinds, SELECT_OPTION_ACTIONS);
    return optionAction ?? confirmAction ?? navigationAction;
  }

  if (context.overlay || context.modal) {
    const optionAction = findActionByKey(code, keybinds, SELECT_OPTION_ACTIONS);
    return optionAction ?? confirmAction ?? navigationAction;
  }

  if (context.screen === 'Combat') {
    const playCardAction = findActionByKey(code, keybinds, PLAY_CARD_ACTIONS);
    if (playCardAction) return playCardAction;
    if (keybinds.endTurn === code) return 'endTurn';
    if (keybinds.cycleTarget === code) return 'cycleTarget';
    return confirmAction ?? navigationAction;
  }

  const optionAction = findActionByKey(code, keybinds, SELECT_OPTION_ACTIONS);
  return optionAction ?? confirmAction ?? navigationAction;
}
