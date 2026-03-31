import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getDesktopEnvironment,
  resolveHostPlatform,
  type DeckrogueDesktopBridge,
} from '@/desktop/hostPlatform';

test('resolveHostPlatform falls back to web when no desktop bridge exists', () => {
  assert.equal(resolveHostPlatform(undefined), 'web');
  assert.deepEqual(getDesktopEnvironment(undefined), {
    hostPlatform: 'web',
    isDesktop: false,
    appVersion: null,
    channel: 'web',
    isPackaged: false,
  });
});

test('resolveHostPlatform returns desktop when the preload bridge is available', () => {
  const bridge: DeckrogueDesktopBridge = {
    hostPlatform: 'desktop',
    appVersion: '1.2.3',
    channel: 'production',
    isPackaged: true,
  };

  assert.equal(resolveHostPlatform({ deckrogueDesktop: bridge }), 'desktop');
  assert.deepEqual(getDesktopEnvironment({ deckrogueDesktop: bridge }), {
    hostPlatform: 'desktop',
    isDesktop: true,
    appVersion: '1.2.3',
    channel: 'production',
    isPackaged: true,
  });
});
