import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_KEYBINDS,
  RESERVED_ACTIONS,
  RESERVED_KEYBINDS,
  normalizeKeybindSettings,
  buildEffectiveKeybinds,
  detectKeybindConflicts,
  resolveKeyboardAction,
  type KeyboardActionId,
  type KeybindMap,
  type AppKeyboardContext
} from '../../src/ui/input/keybinds';

test('DEFAULT_KEYBINDS should have all required actions', () => {
  const requiredActions: KeyboardActionId[] = [
    'toggleMenu', 'back', 'confirm', 'close', 'endTurn', 'cycleTarget',
    'focusUp', 'focusDown', 'focusLeft', 'focusRight'
  ];
  for (const action of requiredActions) {
    assert.ok(DEFAULT_KEYBINDS[action], `Missing action: ${action}`);
  }
});

test('DEFAULT_KEYBINDS should have playCard1-10 actions', () => {
  for (let i = 1; i <= 10; i++) {
    assert.ok(DEFAULT_KEYBINDS[`playCard${i}` as KeyboardActionId], `Missing playCard${i}`);
  }
});

test('DEFAULT_KEYBINDS should have selectOption1-10 actions', () => {
  for (let i = 1; i <= 10; i++) {
    assert.ok(DEFAULT_KEYBINDS[`selectOption${i}` as KeyboardActionId], `Missing selectOption${i}`);
  }
});

test('DEFAULT_KEYBINDS should map Digit1-9 to playCard1-9 and Digit0 to playCard10', () => {
  assert.strictEqual(DEFAULT_KEYBINDS.playCard1, 'Digit1');
  assert.strictEqual(DEFAULT_KEYBINDS.playCard9, 'Digit9');
  assert.strictEqual(DEFAULT_KEYBINDS.playCard10, 'Digit0');
});

test('RESERVED_ACTIONS should contain close and back', () => {
  assert.ok(RESERVED_ACTIONS.has('close'));
  assert.ok(RESERVED_ACTIONS.has('back'));
});

test('RESERVED_ACTIONS should not contain other actions', () => {
  assert.ok(!RESERVED_ACTIONS.has('toggleMenu'));
  assert.ok(!RESERVED_ACTIONS.has('endTurn'));
});

test('RESERVED_KEYBINDS should bind close and back to Escape', () => {
  assert.strictEqual(RESERVED_KEYBINDS.close, 'Escape');
  assert.strictEqual(RESERVED_KEYBINDS.back, 'Escape');
});

test('normalizeKeybindSettings should return default keybinds when settings is null', () => {
  const result = normalizeKeybindSettings(null);
  assert.deepStrictEqual(result, DEFAULT_KEYBINDS);
});

test('normalizeKeybindSettings should return default keybinds when settings is undefined', () => {
  const result = normalizeKeybindSettings(undefined);
  assert.deepStrictEqual(result, DEFAULT_KEYBINDS);
});

test('normalizeKeybindSettings should merge valid settings with defaults', () => {
  const settings = { endTurn: 'KeyQ' };
  const result = normalizeKeybindSettings(settings);
  assert.strictEqual(result.endTurn, 'KeyQ');
  assert.strictEqual(result.toggleMenu, DEFAULT_KEYBINDS.toggleMenu);
});

test('normalizeKeybindSettings should ignore unknown actions', () => {
  const settings = { unknownAction: 'KeyX' } as any;
  const result = normalizeKeybindSettings(settings);
  assert.strictEqual((result as any).unknownAction, undefined);
});

test('normalizeKeybindSettings should ignore reserved actions', () => {
  const settings = { close: 'KeyX' };
  const result = normalizeKeybindSettings(settings);
  assert.strictEqual(result.close, 'Escape');
});

test('normalizeKeybindSettings should ignore invalid key codes', () => {
  const settings = { endTurn: '' };
  const result = normalizeKeybindSettings(settings);
  assert.strictEqual(result.endTurn, DEFAULT_KEYBINDS.endTurn);
});

test('normalizeKeybindSettings should always override with reserved keybinds', () => {
  const settings = { close: 'KeyX', back: 'KeyY' };
  const result = normalizeKeybindSettings(settings);
  assert.strictEqual(result.close, 'Escape');
  assert.strictEqual(result.back, 'Escape');
});

test('buildEffectiveKeybinds should delegate to normalizeKeybindSettings', () => {
  const settings = { endTurn: 'KeyQ' };
  const result = buildEffectiveKeybinds(settings);
  assert.strictEqual(result.endTurn, 'KeyQ');
});

test('detectKeybindConflicts should return empty array for default keybinds', () => {
  const conflicts = detectKeybindConflicts(DEFAULT_KEYBINDS);
  assert.strictEqual(conflicts.length, 0);
});

test('detectKeybindConflicts should detect conflict when same key is bound to incompatible actions', () => {
  const keybinds: KeybindMap = {
    ...DEFAULT_KEYBINDS,
    endTurn: 'KeyM',
    toggleMenu: 'KeyM'
  };
  const conflicts = detectKeybindConflicts(keybinds);
  assert.ok(conflicts.length > 0);
  assert.strictEqual(conflicts[0].key, 'KeyM');
  assert.ok(conflicts[0].actions.includes('endTurn'));
  assert.ok(conflicts[0].actions.includes('toggleMenu'));
});

test('detectKeybindConflicts should not detect conflict for playCard and selectOption with same index', () => {
  const keybinds: KeybindMap = DEFAULT_KEYBINDS;
  const conflicts = detectKeybindConflicts(keybinds);
  const digit1Conflict = conflicts.find(c => c.key === 'Digit1');
  assert.strictEqual(digit1Conflict, undefined);
});

test('detectKeybindConflicts should not detect conflict for back and close', () => {
  const keybinds: KeybindMap = DEFAULT_KEYBINDS;
  const conflicts = detectKeybindConflicts(keybinds);
  const escapeConflict = conflicts.find(c => c.key === 'Escape');
  assert.strictEqual(escapeConflict, undefined);
});

test('resolveKeyboardAction should return null for invalid key code', () => {
  const defaultContext: AppKeyboardContext = {
    screen: 'Map',
    menuOpen: false,
    menuPage: 'root',
    overlay: null,
    modal: null,
    rebindingAction: null
  };
  const result = resolveKeyboardAction('', defaultContext, DEFAULT_KEYBINDS);
  assert.strictEqual(result, null);
});

test('resolveKeyboardAction should return null when rebinding action is active', () => {
  const defaultContext: AppKeyboardContext = {
    screen: 'Map',
    menuOpen: false,
    menuPage: 'root',
    overlay: null,
    modal: null,
    rebindingAction: null
  };
  const context = { ...defaultContext, rebindingAction: 'endTurn' as KeyboardActionId };
  const result = resolveKeyboardAction('KeyE', context, DEFAULT_KEYBINDS);
  assert.strictEqual(result, null);
});

test('resolveKeyboardAction should return close for Escape key', () => {
  const defaultContext: AppKeyboardContext = {
    screen: 'Map',
    menuOpen: false,
    menuPage: 'root',
    overlay: null,
    modal: null,
    rebindingAction: null
  };
  const result = resolveKeyboardAction('Escape', defaultContext, DEFAULT_KEYBINDS);
  assert.strictEqual(result, 'close');
});

test('resolveKeyboardAction should return toggleMenu when menu is closed', () => {
  const defaultContext: AppKeyboardContext = {
    screen: 'Map',
    menuOpen: false,
    menuPage: 'root',
    overlay: null,
    modal: null,
    rebindingAction: null
  };
  const result = resolveKeyboardAction('KeyM', defaultContext, DEFAULT_KEYBINDS);
  assert.strictEqual(result, 'toggleMenu');
});

test('resolveKeyboardAction should return close when menu is open and M is pressed', () => {
  const defaultContext: AppKeyboardContext = {
    screen: 'Map',
    menuOpen: false,
    menuPage: 'root',
    overlay: null,
    modal: null,
    rebindingAction: null
  };
  const context = { ...defaultContext, menuOpen: true };
  const result = resolveKeyboardAction('KeyM', context, DEFAULT_KEYBINDS);
  assert.strictEqual(result, 'close');
});

test('resolveKeyboardAction should return selectOption in menu context', () => {
  const defaultContext: AppKeyboardContext = {
    screen: 'Map',
    menuOpen: false,
    menuPage: 'root',
    overlay: null,
    modal: null,
    rebindingAction: null
  };
  const context = { ...defaultContext, menuOpen: true };
  const result = resolveKeyboardAction('Digit1', context, DEFAULT_KEYBINDS);
  assert.strictEqual(result, 'selectOption1');
});

test('resolveKeyboardAction should return selectOption in overlay context', () => {
  const defaultContext: AppKeyboardContext = {
    screen: 'Map',
    menuOpen: false,
    menuPage: 'root',
    overlay: null,
    modal: null,
    rebindingAction: null
  };
  const context = { ...defaultContext, overlay: 'test' };
  const result = resolveKeyboardAction('Digit1', context, DEFAULT_KEYBINDS);
  assert.strictEqual(result, 'selectOption1');
});

test('resolveKeyboardAction should return selectOption in modal context', () => {
  const defaultContext: AppKeyboardContext = {
    screen: 'Map',
    menuOpen: false,
    menuPage: 'root',
    overlay: null,
    modal: null,
    rebindingAction: null
  };
  const context = { ...defaultContext, modal: 'test' };
  const result = resolveKeyboardAction('Digit1', context, DEFAULT_KEYBINDS);
  assert.strictEqual(result, 'selectOption1');
});

test('resolveKeyboardAction should return playCard in Combat context', () => {
  const defaultContext: AppKeyboardContext = {
    screen: 'Map',
    menuOpen: false,
    menuPage: 'root',
    overlay: null,
    modal: null,
    rebindingAction: null
  };
  const context = { ...defaultContext, screen: 'Combat' };
  const result = resolveKeyboardAction('Digit1', context, DEFAULT_KEYBINDS);
  assert.strictEqual(result, 'playCard1');
});

test('resolveKeyboardAction should return endTurn in Combat context', () => {
  const defaultContext: AppKeyboardContext = {
    screen: 'Map',
    menuOpen: false,
    menuPage: 'root',
    overlay: null,
    modal: null,
    rebindingAction: null
  };
  const context = { ...defaultContext, screen: 'Combat' };
  const result = resolveKeyboardAction('KeyE', context, DEFAULT_KEYBINDS);
  assert.strictEqual(result, 'endTurn');
});

test('resolveKeyboardAction should return cycleTarget in Combat context', () => {
  const defaultContext: AppKeyboardContext = {
    screen: 'Map',
    menuOpen: false,
    menuPage: 'root',
    overlay: null,
    modal: null,
    rebindingAction: null
  };
  const context = { ...defaultContext, screen: 'Combat' };
  const result = resolveKeyboardAction('Tab', context, DEFAULT_KEYBINDS);
  assert.strictEqual(result, 'cycleTarget');
});

test('resolveKeyboardAction should return navigation actions', () => {
  const defaultContext: AppKeyboardContext = {
    screen: 'Map',
    menuOpen: false,
    menuPage: 'root',
    overlay: null,
    modal: null,
    rebindingAction: null
  };
  const result = resolveKeyboardAction('ArrowUp', defaultContext, DEFAULT_KEYBINDS);
  assert.strictEqual(result, 'focusUp');
});

test('resolveKeyboardAction should return confirm for Enter key', () => {
  const defaultContext: AppKeyboardContext = {
    screen: 'Map',
    menuOpen: false,
    menuPage: 'root',
    overlay: null,
    modal: null,
    rebindingAction: null
  };
  const result = resolveKeyboardAction('Enter', defaultContext, DEFAULT_KEYBINDS);
  assert.strictEqual(result, 'confirm');
});

test('resolveKeyboardAction should return selectOption in non-Combat screen', () => {
  const defaultContext: AppKeyboardContext = {
    screen: 'Map',
    menuOpen: false,
    menuPage: 'root',
    overlay: null,
    modal: null,
    rebindingAction: null
  };
  const context = { ...defaultContext, screen: 'Map' };
  const result = resolveKeyboardAction('Digit1', context, DEFAULT_KEYBINDS);
  assert.strictEqual(result, 'selectOption1');
});
