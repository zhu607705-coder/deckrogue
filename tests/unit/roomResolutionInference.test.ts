import test from 'node:test';
import assert from 'node:assert/strict';

import { inferRoomResolutionKindFromLegacyState } from '@/core/events/roomResolutionInference';

test('inferRoomResolutionKindFromLegacyState keeps event ownership for free-remove screens', () => {
  const kind = inferRoomResolutionKindFromLegacyState(
    {
      screen: 'RemoveCard',
      activeEvent: { id: 'test_event', data: {}, stage: 'free_remove' } as any,
      campfireChoiceLocked: false,
      upgradeReturnScreen: undefined,
      relicUpgradeReturnScreen: undefined,
      enchantContext: null,
    },
    { isEventFreeCardRemovalMode: true }
  );

  assert.equal(kind, 'event');
});

test('inferRoomResolutionKindFromLegacyState keeps rest ownership for campfire nested screens', () => {
  const removeCardKind = inferRoomResolutionKindFromLegacyState({
    screen: 'RemoveCard',
    activeEvent: null,
    campfireChoiceLocked: true,
    upgradeReturnScreen: undefined,
    relicUpgradeReturnScreen: undefined,
    enchantContext: null,
  });
  const enchantKind = inferRoomResolutionKindFromLegacyState({
    screen: 'Enchant',
    activeEvent: null,
    campfireChoiceLocked: true,
    upgradeReturnScreen: undefined,
    relicUpgradeReturnScreen: undefined,
    enchantContext: { source: 'Rest', enchantmentId: 'blood_rune', returnScreen: 'Rest' },
  });
  const relicUpgradeKind = inferRoomResolutionKindFromLegacyState({
    screen: 'RelicUpgrade',
    activeEvent: null,
    campfireChoiceLocked: true,
    upgradeReturnScreen: undefined,
    relicUpgradeReturnScreen: 'Rest',
    enchantContext: null,
  });

  assert.equal(removeCardKind, 'rest');
  assert.equal(enchantKind, 'rest');
  assert.equal(relicUpgradeKind, 'rest');
});

test('inferRoomResolutionKindFromLegacyState keeps shop ownership for shop nested screens', () => {
  const upgradeKind = inferRoomResolutionKindFromLegacyState({
    screen: 'Upgrade',
    activeEvent: null,
    campfireChoiceLocked: false,
    upgradeReturnScreen: 'Shop',
    relicUpgradeReturnScreen: 'Shop',
    enchantContext: null,
  });
  const enchantKind = inferRoomResolutionKindFromLegacyState({
    screen: 'Enchant',
    activeEvent: null,
    campfireChoiceLocked: false,
    upgradeReturnScreen: undefined,
    relicUpgradeReturnScreen: undefined,
    enchantContext: { source: 'Shop', enchantmentId: 'swift_sigil', returnScreen: 'Shop' },
  });

  assert.equal(upgradeKind, 'shop');
  assert.equal(enchantKind, 'shop');
});
