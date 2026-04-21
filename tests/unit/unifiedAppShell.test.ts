import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveActiveScreen } from '@/ui/views/UnifiedAppShell';

test('resolveActiveScreen keeps RelicUpgrade instead of falling back to Launcher', () => {
  assert.equal(resolveActiveScreen('RelicUpgrade'), 'RelicUpgrade');
});

test('resolveActiveScreen keeps Enchant instead of falling back to Launcher', () => {
  assert.equal(resolveActiveScreen('Enchant'), 'Enchant');
});
