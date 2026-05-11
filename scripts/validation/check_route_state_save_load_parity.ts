#!/usr/bin/env node

/**
 * @file check_route_state_save_load_parity.ts
 * @description 检查路线状态的保存加载一致性，验证序列化/反序列化后状态保持不变。
 *
 * 主要职责:
 * - 运行多角色多种子场景并保存状态
 * - 重新加载并比较路线状态差异
 * - 报告保存加载不匹配问题
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { GameEngine } from '@/core/events/gameEngine';
import { normalizeLegacyGameState } from '@/runtimeV2/normalizeLegacyGameState';
import { projectRuleSnapshotToLegacyState } from '@/runtimeV2/legacyStateProjector';
import { syncRoomSessionFromLegacyState } from '@/core/events/roomSession';
import { syncSurfaceContextFromLegacyState } from '@/core/events/surfaceContext';
import type { RoomSession, SurfaceContext } from '@/core/types';

interface CaseResult {
  label: string;
  pass: boolean;
  restoredScreen: string;
  restoredRouteTag: string | null;
  restoredRouteConfidence: number | null;
  restoredRouteStage: string | null;
  pendingNodeResolution: boolean;
  surfaceContextPass?: boolean;
  roomSessionPass?: boolean;
  activeEventPass?: boolean;
  restoredRoomOwnerKind?: string | null;
  restoredRoomResolverKind?: string | null;
  restoredRoomSurfaceStack?: string[] | null;
  restoredSurfaceContext?: SurfaceContext | null;
}

function isSurfaceContextCleared(surfaceContext: SurfaceContext | null | undefined): boolean {
  return surfaceContext === null || surfaceContext === undefined;
}

function isRoomSessionCleared(roomSession: RoomSession | null | undefined): boolean {
  return roomSession === null || roomSession === undefined;
}

function isActiveShopRoomSession(roomSession: RoomSession | null | undefined): boolean {
  return (
    roomSession?.ownerKind === 'shop'
    && roomSession?.resolverKind === 'shop'
    && roomSession?.status === 'active'
    && roomSession?.surfaceStack.join('/') === 'shop'
  );
}

function buildUpgradeCase(): CaseResult {
  const source = new GameEngine(51, null, { enableRuntimeDelegation: false });
  const restored = new GameEngine(52, null, { enableRuntimeDelegation: false });
  try {
    source.selectCharacter('informant');
    source.state.currentNodeId = source.state.map.find((node) => node.y === 0)?.id ?? null;
    source.state.screen = 'Upgrade';
    source.state.upgradeReturnScreen = 'Rest';
    source.state.campfireChoiceLocked = true;
    source.state.routeState = {
      primaryTag: 'informant:evidence',
      secondaryTag: 'informant:intel',
      confidence: 72,
      stage: 'committed',
      recentCommits: [{ tag: 'informant:evidence', source: 'reward', floor: 2, weight: 16 }],
    };
    syncSurfaceContextFromLegacyState(source.state);
    syncRoomSessionFromLegacyState(source.state);

    const projection = projectRuleSnapshotToLegacyState(normalizeLegacyGameState(source.state, {}));
    restored.loadSaveData({
      state: {
        ...source.state,
        routeState: projection.routeState,
        surfaceContext: projection.surfaceContext,
        roomSession: projection.roomSession,
      },
      rngState: source.state.rngState,
    });
    restored.cancelUpgrade();

    return {
      label: 'rest-upgrade-cancel',
      pass: restored.state.screen === 'Rest' && restored.state.routeState?.primaryTag === 'informant:evidence',
      restoredScreen: restored.state.screen,
      restoredRouteTag: restored.state.routeState?.primaryTag ?? null,
      restoredRouteConfidence: restored.state.routeState?.confidence ?? null,
      restoredRouteStage: restored.state.routeState?.stage ?? null,
      pendingNodeResolution: !!restored.state.pendingNodeResolution,
    };
  } finally {
    source.dispose();
    restored.dispose();
  }
}

function buildEnchantCase(): CaseResult {
  const source = new GameEngine(53, null, { enableRuntimeDelegation: false });
  const restored = new GameEngine(54, null, { enableRuntimeDelegation: false });
  try {
    source.selectCharacter('informant');
    source.state.currentNodeId = source.state.map.find((node) => node.y === 0)?.id ?? null;
    source.state.screen = 'Enchant';
    source.state.enchantContext = {
      source: 'Event',
      enchantmentId: 'swift_sigil',
      returnScreen: 'Event',
    };
    source.state.routeState = {
      primaryTag: 'informant:evidence',
      secondaryTag: 'informant:intel',
      confidence: 68,
      stage: 'committed',
      recentCommits: [{ tag: 'informant:evidence', source: 'event', floor: 3, weight: 12 }],
    };
    syncSurfaceContextFromLegacyState(source.state);
    syncRoomSessionFromLegacyState(source.state);

    const projection = projectRuleSnapshotToLegacyState(normalizeLegacyGameState(source.state, {}));
    restored.loadSaveData({
      state: {
        ...source.state,
        routeState: projection.routeState,
        surfaceContext: projection.surfaceContext,
        roomSession: projection.roomSession,
      },
      rngState: source.state.rngState,
    });
    restored.cancelEnchant();

    return {
      label: 'event-enchant-cancel',
      pass: restored.state.screen === 'Event' && restored.state.routeState?.primaryTag === 'informant:evidence',
      restoredScreen: restored.state.screen,
      restoredRouteTag: restored.state.routeState?.primaryTag ?? null,
      restoredRouteConfidence: restored.state.routeState?.confidence ?? null,
      restoredRouteStage: restored.state.routeState?.stage ?? null,
      pendingNodeResolution: !!restored.state.pendingNodeResolution,
    };
  } finally {
    source.dispose();
    restored.dispose();
  }
}

function buildUpgradeConfirmCase(): CaseResult {
  const source = new GameEngine(61, null, { enableRuntimeDelegation: false });
  const restored = new GameEngine(62, null, { enableRuntimeDelegation: false });
  try {
    source.selectCharacter('informant');
    source.state.currentNodeId = source.state.map.find((node) => node.y === 0)?.id ?? null;
    source.state.screen = 'Upgrade';
    source.state.upgradeReturnScreen = 'Rest';
    source.state.campfireChoiceLocked = true;
    source.state.routeState = {
      primaryTag: 'informant:evidence',
      secondaryTag: 'informant:intel',
      confidence: 72,
      stage: 'committed',
      recentCommits: [{ tag: 'informant:evidence', source: 'reward', floor: 2, weight: 16 }],
    };
    syncSurfaceContextFromLegacyState(source.state);
    syncRoomSessionFromLegacyState(source.state);

    const projection = projectRuleSnapshotToLegacyState(normalizeLegacyGameState(source.state, {}));
    restored.loadSaveData({
      state: {
        ...source.state,
        routeState: projection.routeState,
        surfaceContext: projection.surfaceContext,
        roomSession: projection.roomSession,
      },
      rngState: source.state.rngState,
    });
    const targetInstanceId = restored.state.player.deck.find((card) => card.upgrade && !card.isUpgraded)?.instanceId;
    if (!targetInstanceId) {
      throw new Error('Missing upgrade target instance id');
    }
    restored.upgradeCard(targetInstanceId);
    const upgraded = restored.state.player.deck.find((card) => card.instanceId === targetInstanceId);

    return {
      label: 'rest-upgrade-confirm',
      pass:
        restored.state.screen === 'Map'
        && restored.state.routeState?.primaryTag === 'informant:evidence'
        && Boolean(upgraded?.isUpgraded),
      restoredScreen: restored.state.screen,
      restoredRouteTag: restored.state.routeState?.primaryTag ?? null,
      restoredRouteConfidence: restored.state.routeState?.confidence ?? null,
      restoredRouteStage: restored.state.routeState?.stage ?? null,
      pendingNodeResolution: !!restored.state.pendingNodeResolution,
    };
  } finally {
    source.dispose();
    restored.dispose();
  }
}

function buildRestEnchantCancelCase(): CaseResult {
  const source = new GameEngine(83, null, { enableRuntimeDelegation: false });
  const restored = new GameEngine(84, null, { enableRuntimeDelegation: false });
  try {
    source.selectCharacter('informant');
    source.state.currentNodeId = source.state.map.find((node) => node.y === 0)?.id ?? null;
    source.state.screen = 'Enchant';
    source.state.enchantContext = {
      source: 'Rest',
      enchantmentId: 'swift_sigil',
      returnScreen: 'Rest',
    };
    source.state.routeState = {
      primaryTag: 'informant:evidence',
      secondaryTag: 'informant:intel',
      confidence: 68,
      stage: 'committed',
      recentCommits: [{ tag: 'informant:evidence', source: 'rest', floor: 3, weight: 12 }],
    };
    syncSurfaceContextFromLegacyState(source.state);
    syncRoomSessionFromLegacyState(source.state);

    const projection = projectRuleSnapshotToLegacyState(normalizeLegacyGameState(source.state, {}));
    restored.loadSaveData({
      state: {
        ...source.state,
        routeState: projection.routeState,
        surfaceContext: projection.surfaceContext,
        roomSession: projection.roomSession,
      },
      rngState: source.state.rngState,
    });
    restored.cancelEnchant();

    return {
      label: 'rest-enchant-cancel',
      pass:
        restored.state.screen === 'Rest'
        && restored.state.routeState?.primaryTag === 'informant:evidence',
      restoredScreen: restored.state.screen,
      restoredRouteTag: restored.state.routeState?.primaryTag ?? null,
      restoredRouteConfidence: restored.state.routeState?.confidence ?? null,
      restoredRouteStage: restored.state.routeState?.stage ?? null,
      pendingNodeResolution: !!restored.state.pendingNodeResolution,
    };
  } finally {
    source.dispose();
    restored.dispose();
  }
}

function buildRestEnchantConfirmCase(): CaseResult {
  const source = new GameEngine(63, null, { enableRuntimeDelegation: false });
  const restored = new GameEngine(64, null, { enableRuntimeDelegation: false });
  try {
    source.selectCharacter('informant');
    source.state.currentNodeId = source.state.map.find((node) => node.y === 0)?.id ?? null;
    source.state.screen = 'Enchant';
    source.state.enchantContext = {
      source: 'Rest',
      enchantmentId: 'swift_sigil',
      returnScreen: 'Rest',
    };
    source.state.routeState = {
      primaryTag: 'informant:evidence',
      secondaryTag: 'informant:intel',
      confidence: 68,
      stage: 'committed',
      recentCommits: [{ tag: 'informant:evidence', source: 'event', floor: 3, weight: 12 }],
    };
    syncSurfaceContextFromLegacyState(source.state);
    syncRoomSessionFromLegacyState(source.state);

    const projection = projectRuleSnapshotToLegacyState(normalizeLegacyGameState(source.state, {}));
    restored.loadSaveData({
      state: {
        ...source.state,
        routeState: projection.routeState,
        surfaceContext: projection.surfaceContext,
        roomSession: projection.roomSession,
      },
      rngState: source.state.rngState,
    });
    const targetInstanceId = restored.state.player.deck[0]?.instanceId;
    if (!targetInstanceId) {
      throw new Error('Missing enchant target instance id');
    }
    restored.applyEnchantment(targetInstanceId);
    const enchanted = restored.state.player.deck.find((card) => card.instanceId === targetInstanceId);

    return {
      label: 'rest-enchant-confirm',
      pass:
        restored.state.screen === 'Map'
        && restored.state.routeState?.primaryTag === 'informant:evidence'
        && Boolean(enchanted?.persistentEnchantments?.some((entry) => entry.id === 'swift_sigil')),
      restoredScreen: restored.state.screen,
      restoredRouteTag: restored.state.routeState?.primaryTag ?? null,
      restoredRouteConfidence: restored.state.routeState?.confidence ?? null,
      restoredRouteStage: restored.state.routeState?.stage ?? null,
      pendingNodeResolution: !!restored.state.pendingNodeResolution,
    };
  } finally {
    source.dispose();
    restored.dispose();
  }
}

function buildRestRelicUpgradeCancelCase(): CaseResult {
  const source = new GameEngine(85, null, { enableRuntimeDelegation: false });
  const restored = new GameEngine(86, null, { enableRuntimeDelegation: false });
  try {
    source.selectCharacter('informant');
    source.state.currentNodeId = source.state.map.find((node) => node.y === 0)?.id ?? null;
    source.state.screen = 'RelicUpgrade';
    source.state.relicUpgradeReturnScreen = 'Rest';
    source.state.player.gold = 999;
    source.state.player.relics.push('entropy_sanctum_relic');
    source.state.player.relicStates.entropy_sanctum_relic = {
      level: 1,
      progress: 0,
      corrupted: true,
    };
    source.state.routeState = {
      primaryTag: 'informant:evidence',
      secondaryTag: 'informant:intel',
      confidence: 70,
      stage: 'committed',
      recentCommits: [{ tag: 'informant:evidence', source: 'rest', floor: 3, weight: 10 }],
    };
    syncSurfaceContextFromLegacyState(source.state);
    syncRoomSessionFromLegacyState(source.state);

    const projection = projectRuleSnapshotToLegacyState(normalizeLegacyGameState(source.state, {}));
    restored.loadSaveData({
      state: {
        ...source.state,
        routeState: projection.routeState,
        surfaceContext: projection.surfaceContext,
        roomSession: projection.roomSession,
      },
      rngState: source.state.rngState,
    });
    restored.cancelRelicUpgrade();

    return {
      label: 'rest-relic-upgrade-cancel',
      pass:
        restored.state.screen === 'Rest'
        && restored.state.routeState?.primaryTag === 'informant:evidence',
      restoredScreen: restored.state.screen,
      restoredRouteTag: restored.state.routeState?.primaryTag ?? null,
      restoredRouteConfidence: restored.state.routeState?.confidence ?? null,
      restoredRouteStage: restored.state.routeState?.stage ?? null,
      pendingNodeResolution: !!restored.state.pendingNodeResolution,
    };
  } finally {
    source.dispose();
    restored.dispose();
  }
}

function buildRestRelicUpgradeConfirmCase(): CaseResult {
  const source = new GameEngine(65, null, { enableRuntimeDelegation: false });
  const restored = new GameEngine(66, null, { enableRuntimeDelegation: false });
  try {
    source.selectCharacter('informant');
    source.state.currentNodeId = source.state.map.find((node) => node.y === 0)?.id ?? null;
    source.state.screen = 'RelicUpgrade';
    source.state.relicUpgradeReturnScreen = 'Rest';
    source.state.player.gold = 999;
    source.state.player.relics.push('entropy_sanctum_relic');
    source.state.player.relicStates.entropy_sanctum_relic = {
      level: 1,
      progress: 0,
      corrupted: true,
    };
    source.state.routeState = {
      primaryTag: 'informant:evidence',
      secondaryTag: 'informant:intel',
      confidence: 70,
      stage: 'committed',
      recentCommits: [{ tag: 'informant:evidence', source: 'rest', floor: 3, weight: 10 }],
    };
    syncSurfaceContextFromLegacyState(source.state);
    syncRoomSessionFromLegacyState(source.state);

    const projection = projectRuleSnapshotToLegacyState(normalizeLegacyGameState(source.state, {}));
    restored.loadSaveData({
      state: {
        ...source.state,
        routeState: projection.routeState,
        surfaceContext: projection.surfaceContext,
        roomSession: projection.roomSession,
      },
      rngState: source.state.rngState,
    });
    const upgraded = restored.upgradeRelic('entropy_sanctum_relic');

    return {
      label: 'rest-relic-upgrade-confirm',
      pass:
        upgraded
        && restored.state.routeState?.primaryTag === 'informant:evidence'
        && restored.state.player.relicStates.entropy_sanctum_relic?.level === 2
        && restored.state.player.relicStates.entropy_sanctum_relic?.corrupted === false,
      restoredScreen: restored.state.screen,
      restoredRouteTag: restored.state.routeState?.primaryTag ?? null,
      restoredRouteConfidence: restored.state.routeState?.confidence ?? null,
      restoredRouteStage: restored.state.routeState?.stage ?? null,
      pendingNodeResolution: !!restored.state.pendingNodeResolution,
    };
  } finally {
    source.dispose();
    restored.dispose();
  }
}

function buildShopRemoveCancelCase(): CaseResult {
  const source = new GameEngine(87, null, { enableRuntimeDelegation: false });
  const restored = new GameEngine(88, null, { enableRuntimeDelegation: false });
  try {
    source.selectCharacter('informant');
    source.state.currentNodeId = source.state.map.find((node) => node.y === 0)?.id ?? null;
    source.state.screen = 'RemoveCard';
    source.state.upgradeReturnScreen = 'Shop';
    source.state.player.gold = 150;
    source.state.cardRemovalCost = 75;
    source.state.routeState = {
      primaryTag: 'informant:evidence',
      secondaryTag: 'informant:intel',
      confidence: 74,
      stage: 'committed',
      recentCommits: [{ tag: 'informant:evidence', source: 'shop', floor: 4, weight: 12 }],
    };
    syncSurfaceContextFromLegacyState(source.state);
    syncRoomSessionFromLegacyState(source.state);

    const projection = projectRuleSnapshotToLegacyState(normalizeLegacyGameState(source.state, {}));
    restored.loadSaveData({
      state: {
        ...source.state,
        routeState: projection.routeState,
        surfaceContext: projection.surfaceContext,
        roomSession: projection.roomSession,
      },
      rngState: source.state.rngState,
    });
    restored.cancelCardRemoval();

    return {
      label: 'shop-remove-cancel',
      pass:
        restored.state.screen === 'Shop'
        && restored.state.routeState?.primaryTag === 'informant:evidence'
        && restored.state.player.gold === 150,
      restoredScreen: restored.state.screen,
      restoredRouteTag: restored.state.routeState?.primaryTag ?? null,
      restoredRouteConfidence: restored.state.routeState?.confidence ?? null,
      restoredRouteStage: restored.state.routeState?.stage ?? null,
      pendingNodeResolution: !!restored.state.pendingNodeResolution,
    };
  } finally {
    source.dispose();
    restored.dispose();
  }
}

function buildShopRemoveConfirmCase(): CaseResult {
  const source = new GameEngine(67, null, { enableRuntimeDelegation: false });
  const restored = new GameEngine(68, null, { enableRuntimeDelegation: false });
  try {
    source.selectCharacter('informant');
    source.state.currentNodeId = source.state.map.find((node) => node.y === 0)?.id ?? null;
    source.state.screen = 'RemoveCard';
    source.state.upgradeReturnScreen = 'Shop';
    source.state.player.gold = 150;
    source.state.cardRemovalCost = 75;
    source.state.routeState = {
      primaryTag: 'informant:evidence',
      secondaryTag: 'informant:intel',
      confidence: 74,
      stage: 'committed',
      recentCommits: [{ tag: 'informant:evidence', source: 'shop', floor: 4, weight: 12 }],
    };
    syncSurfaceContextFromLegacyState(source.state);
    syncRoomSessionFromLegacyState(source.state);

    const projection = projectRuleSnapshotToLegacyState(normalizeLegacyGameState(source.state, {}));
    restored.loadSaveData({
      state: {
        ...source.state,
        routeState: projection.routeState,
        surfaceContext: projection.surfaceContext,
        roomSession: projection.roomSession,
      },
      rngState: source.state.rngState,
    });
    const startingDeckCount = restored.state.player.deck.length;
    const targetInstanceId = restored.state.player.deck[0]?.instanceId;
    if (!targetInstanceId) {
      throw new Error('Missing remove-card target instance id');
    }
    restored.removeCard(targetInstanceId);

    return {
      label: 'shop-remove-confirm',
      pass:
        restored.state.screen === 'Shop'
        && restored.state.routeState?.primaryTag === 'informant:evidence'
        && restored.state.player.gold === 75
        && restored.state.player.deck.length === startingDeckCount - 1,
      restoredScreen: restored.state.screen,
      restoredRouteTag: restored.state.routeState?.primaryTag ?? null,
      restoredRouteConfidence: restored.state.routeState?.confidence ?? null,
      restoredRouteStage: restored.state.routeState?.stage ?? null,
      pendingNodeResolution: !!restored.state.pendingNodeResolution,
    };
  } finally {
    source.dispose();
    restored.dispose();
  }
}

function buildShopRelicPurchaseCase(): CaseResult {
  const source = new GameEngine(89, null, { enableRuntimeDelegation: false });
  const restored = new GameEngine(90, null, { enableRuntimeDelegation: false });
  try {
    source.selectCharacter('informant');
    source.state.currentNodeId = source.state.map.find((node) => node.y === 0)?.id ?? null;
    source.state.player.gold = 999;
    source.enterShop();
    source.state.routeState = {
      primaryTag: 'informant:evidence',
      secondaryTag: 'informant:intel',
      confidence: 76,
      stage: 'committed',
      recentCommits: [{ tag: 'informant:evidence', source: 'shop', floor: 4, weight: 12 }],
    };
    syncSurfaceContextFromLegacyState(source.state);
    syncRoomSessionFromLegacyState(source.state);

    const projection = projectRuleSnapshotToLegacyState(normalizeLegacyGameState(source.state, {}));
    restored.loadSaveData({
      state: {
        ...source.state,
        routeState: projection.routeState,
        surfaceContext: projection.surfaceContext,
        roomSession: projection.roomSession,
      },
      rngState: source.state.rngState,
    });
    const targetRelicId = restored.state.shopRelics[0];
    if (!targetRelicId) {
      throw new Error('Missing shop relic target id');
    }
    restored.buyShopRelic(targetRelicId);
    const surfaceContextPass = isSurfaceContextCleared(restored.state.surfaceContext);
    const roomSessionPass = isActiveShopRoomSession(restored.state.roomSession);

    return {
      label: 'shop-relic-purchase',
      pass:
        restored.state.screen === 'Shop'
        && restored.state.routeState?.primaryTag === 'informant:evidence'
        && restored.state.player.relics.includes(targetRelicId)
        && Number.isFinite(restored.state.player.gold)
        && surfaceContextPass
        && roomSessionPass,
      restoredScreen: restored.state.screen,
      restoredRouteTag: restored.state.routeState?.primaryTag ?? null,
      restoredRouteConfidence: restored.state.routeState?.confidence ?? null,
      restoredRouteStage: restored.state.routeState?.stage ?? null,
      pendingNodeResolution: !!restored.state.pendingNodeResolution,
      surfaceContextPass,
      roomSessionPass,
      restoredRoomOwnerKind: restored.state.roomSession?.ownerKind ?? null,
      restoredRoomResolverKind: restored.state.roomSession?.resolverKind ?? null,
      restoredRoomSurfaceStack: restored.state.roomSession?.surfaceStack ?? null,
      restoredSurfaceContext: restored.state.surfaceContext ?? null,
    };
  } finally {
    source.dispose();
    restored.dispose();
  }
}

function buildEventFreeRemoveCancelCase(): CaseResult {
  const source = new GameEngine(69, null, { enableRuntimeDelegation: false });
  const restored = new GameEngine(70, null, { enableRuntimeDelegation: false });
  try {
    source.selectCharacter('informant');
    source.state.currentNodeId = source.state.map.find((node) => node.y === 0)?.id ?? null;
    source.state.screen = 'RemoveCard';
    source.state.activeEvent = {
      id: 'nameless_martyr_shrine',
      stage: 'free_remove',
      data: { freeRemovalsRemaining: 2 },
    };
    source.state.routeState = {
      primaryTag: 'informant:evidence',
      secondaryTag: 'informant:intel',
      confidence: 66,
      stage: 'committed',
      recentCommits: [{ tag: 'informant:evidence', source: 'event', floor: 3, weight: 12 }],
    };
    syncSurfaceContextFromLegacyState(source.state, { isEventFreeCardRemovalMode: true });
    syncRoomSessionFromLegacyState(source.state, { isEventFreeCardRemovalMode: true });

    const projection = projectRuleSnapshotToLegacyState(normalizeLegacyGameState(source.state, {}));
    restored.loadSaveData({
      state: {
        ...source.state,
        routeState: projection.routeState,
        surfaceContext: projection.surfaceContext,
        roomSession: projection.roomSession,
      },
      rngState: source.state.rngState,
    });
    restored.cancelCardRemoval();

    return {
      label: 'event-free-remove-cancel',
      pass:
        restored.state.screen === 'Event'
        && restored.state.routeState?.primaryTag === 'informant:evidence'
        && restored.state.activeEvent?.stage === 'free_remove',
      restoredScreen: restored.state.screen,
      restoredRouteTag: restored.state.routeState?.primaryTag ?? null,
      restoredRouteConfidence: restored.state.routeState?.confidence ?? null,
      restoredRouteStage: restored.state.routeState?.stage ?? null,
      pendingNodeResolution: !!restored.state.pendingNodeResolution,
    };
  } finally {
    source.dispose();
    restored.dispose();
  }
}

function buildEventFreeRemoveConfirmCase(): CaseResult {
  const source = new GameEngine(91, null, { enableRuntimeDelegation: false });
  const restored = new GameEngine(92, null, { enableRuntimeDelegation: false });
  try {
    source.selectCharacter('informant');
    source.state.currentNodeId = source.state.map.find((node) => node.y === 0)?.id ?? null;
    source.state.screen = 'RemoveCard';
    source.state.activeEvent = {
      id: 'nameless_martyr_shrine',
      stage: 'free_remove',
      data: { freeRemovalsRemaining: 2 },
    };
    source.state.routeState = {
      primaryTag: 'informant:evidence',
      secondaryTag: 'informant:intel',
      confidence: 66,
      stage: 'committed',
      recentCommits: [{ tag: 'informant:evidence', source: 'event', floor: 3, weight: 12 }],
    };
    syncSurfaceContextFromLegacyState(source.state, { isEventFreeCardRemovalMode: true });
    syncRoomSessionFromLegacyState(source.state, { isEventFreeCardRemovalMode: true });

    const projection = projectRuleSnapshotToLegacyState(normalizeLegacyGameState(source.state, {}));
    restored.loadSaveData({
      state: {
        ...source.state,
        routeState: projection.routeState,
        surfaceContext: projection.surfaceContext,
        roomSession: projection.roomSession,
      },
      rngState: source.state.rngState,
    });
    const startingDeckCount = restored.state.player.deck.length;
    const targetInstanceId = restored.state.player.deck[0]?.instanceId;
    if (!targetInstanceId) {
      throw new Error('Missing free remove-card target instance id');
    }
    restored.removeCard(targetInstanceId);
    const surfaceContextPass =
      !restored.state.surfaceContext?.isEventFreeCardRemovalMode
      && restored.state.upgradeReturnScreen === undefined;
    const roomSessionPass = isRoomSessionCleared(restored.state.roomSession);
    const activeEventPass = restored.state.activeEvent === null;

    return {
      label: 'event-free-remove-confirm',
      pass:
        restored.state.screen === 'Map'
        && activeEventPass
        && restored.state.routeState?.primaryTag === 'informant:evidence'
        && restored.state.player.deck.length === startingDeckCount - 1
        && surfaceContextPass
        && roomSessionPass,
      restoredScreen: restored.state.screen,
      restoredRouteTag: restored.state.routeState?.primaryTag ?? null,
      restoredRouteConfidence: restored.state.routeState?.confidence ?? null,
      restoredRouteStage: restored.state.routeState?.stage ?? null,
      pendingNodeResolution: !!restored.state.pendingNodeResolution,
      surfaceContextPass,
      roomSessionPass,
      activeEventPass,
      restoredRoomOwnerKind: restored.state.roomSession?.ownerKind ?? null,
      restoredRoomResolverKind: restored.state.roomSession?.resolverKind ?? null,
      restoredRoomSurfaceStack: restored.state.roomSession?.surfaceStack ?? null,
      restoredSurfaceContext: restored.state.surfaceContext ?? null,
    };
  } finally {
    source.dispose();
    restored.dispose();
  }
}

function buildCheckpointCase(): CaseResult {
  const source = new GameEngine(55, null, { enableRuntimeDelegation: false });
  const restored = new GameEngine(56, null, { enableRuntimeDelegation: false });
  try {
    source.selectCharacter('informant');
    const firstNodeId = source.state.map.find((node) => node.y === 0)?.id ?? 'floor_1_node_0';
    source.state.currentNodeId = firstNodeId;
    source.state.screen = 'Map';
    source.state.pendingNodeResolution = true;
    source.state.roomResolutionToken = 'room_shop_token';
    source.state.roomResolutionKind = 'shop';
    source.state.upgradeReturnScreen = 'Shop';
    source.state.routeState = {
      primaryTag: 'informant:evidence',
      secondaryTag: 'informant:intel',
      confidence: 74,
      stage: 'committed',
      recentCommits: [{ tag: 'informant:evidence', source: 'shop', floor: 4, weight: 12 }],
    };
    syncSurfaceContextFromLegacyState(source.state);
    syncRoomSessionFromLegacyState(source.state);
    source.state.combatRestartCheckpoint = {
      nodeId: firstNodeId,
      nodeType: 'Combat',
      rngState: source.state.rngState,
      pendingNodeResolution: true,
      stateSnapshot: structuredClone({
        ...source.state,
        combat: null,
        rewardCards: [],
        shopCards: [],
        shopRelics: [],
        shopPotions: [],
      }),
    };

    restored.loadSaveData(source.getSaveData());
    const restarted = restored.restartCombatFromCheckpoint();

    return {
      label: 'checkpoint-save-load-restart',
      pass:
        restarted
        && restored.state.screen === 'Combat'
        && restored.state.routeState?.primaryTag === 'informant:evidence'
        && restored.state.combatRestartCheckpoint?.stateSnapshot.surfaceContext?.upgradeReturnScreen === 'Shop'
        && restored.state.combatRestartCheckpoint?.stateSnapshot.roomSession?.ownerKind === 'shop',
      restoredScreen: restored.state.combatRestartCheckpoint?.stateSnapshot.screen ?? restored.state.screen,
      restoredRouteTag: restored.state.combatRestartCheckpoint?.stateSnapshot.routeState?.primaryTag ?? null,
      restoredRouteConfidence: restored.state.combatRestartCheckpoint?.stateSnapshot.routeState?.confidence ?? null,
      restoredRouteStage: restored.state.combatRestartCheckpoint?.stateSnapshot.routeState?.stage ?? null,
      pendingNodeResolution: !!restored.state.combatRestartCheckpoint?.stateSnapshot.pendingNodeResolution,
    };
  } finally {
    source.dispose();
    restored.dispose();
  }
}

function buildExplicitNullCase(): CaseResult {
  const source = new GameEngine(57, null, { enableRuntimeDelegation: false });
  const restored = new GameEngine(58, null, { enableRuntimeDelegation: false });
  try {
    source.selectCharacter('informant');
    source.state.currentNodeId = source.state.map.find((node) => node.y === 0)?.id ?? null;
    source.state.screen = 'Map';
    source.state.pendingNodeResolution = true;
    source.state.roomResolutionToken = 'legacy_shop_room';
    source.state.roomResolutionKind = 'shop';
    source.state.upgradeReturnScreen = 'Shop';
    source.state.surfaceContext = null;
    source.state.roomSession = null;
    source.state.routeState = null;

    restored.loadSaveData({
      state: structuredClone(source.state),
      rngState: source.state.rngState,
    });

    return {
      label: 'explicit-null-authoritative-slices',
      pass:
        restored.state.surfaceContext === null
        && restored.state.roomSession === null
        && restored.state.routeState === null,
      restoredScreen: restored.state.screen,
      restoredRouteTag: restored.state.routeState?.primaryTag ?? null,
      restoredRouteConfidence: restored.state.routeState?.confidence ?? null,
      restoredRouteStage: restored.state.routeState?.stage ?? null,
      pendingNodeResolution: !!restored.state.pendingNodeResolution,
    };
  } finally {
    source.dispose();
    restored.dispose();
  }
}

function buildCompatLegacyMirrorCase(): CaseResult {
  const source = new GameEngine(59, null, { enableRuntimeDelegation: false });
  const restored = new GameEngine(60, null, { enableRuntimeDelegation: false });
  try {
    source.selectCharacter('informant');
    source.state.currentNodeId = source.state.map.find((node) => node.y === 0)?.id ?? null;
    source.state.screen = 'Map';
    source.state.pendingNodeResolution = true;
    source.state.roomResolutionToken = 'legacy_shop_room';
    source.state.roomResolutionKind = 'shop';
    source.state.upgradeReturnScreen = 'Shop';
    source.state.routeState = {
      primaryTag: 'informant:evidence',
      secondaryTag: 'informant:intel',
      confidence: 74,
      stage: 'committed',
      recentCommits: [{ tag: 'informant:evidence', source: 'shop', floor: 4, weight: 12 }],
    };
    syncSurfaceContextFromLegacyState(source.state);
    syncRoomSessionFromLegacyState(source.state);

    const compatState = structuredClone(source.state) as unknown as Record<string, unknown>;
    delete compatState.surfaceContext;
    delete compatState.roomSession;
    delete compatState.routeState;

    restored.loadSaveData({
      state: compatState,
      rngState: source.state.rngState,
    });

    return {
      label: 'compat-legacy-mirror-rebuild',
      pass:
        restored.state.surfaceContext?.upgradeReturnScreen === 'Shop'
        && restored.state.roomSession?.ownerKind === 'shop'
        && restored.state.routeState !== null,
      restoredScreen: restored.state.screen,
      restoredRouteTag: restored.state.routeState?.primaryTag ?? null,
      restoredRouteConfidence: restored.state.routeState?.confidence ?? null,
      restoredRouteStage: restored.state.routeState?.stage ?? null,
      pendingNodeResolution: !!restored.state.pendingNodeResolution,
    };
  } finally {
    source.dispose();
    restored.dispose();
  }
}

function main() {
  const cases = [
    buildUpgradeCase(),
    buildUpgradeConfirmCase(),
    buildEnchantCase(),
    buildRestEnchantCancelCase(),
    buildRestEnchantConfirmCase(),
    buildRestRelicUpgradeCancelCase(),
    buildRestRelicUpgradeConfirmCase(),
    buildShopRemoveCancelCase(),
    buildShopRemoveConfirmCase(),
    buildShopRelicPurchaseCase(),
    buildEventFreeRemoveCancelCase(),
    buildEventFreeRemoveConfirmCase(),
    buildCheckpointCase(),
    buildExplicitNullCase(),
    buildCompatLegacyMirrorCase(),
  ];
  const passCount = cases.filter((entry) => entry.pass).length;
  const report = {
    totalCases: cases.length,
    passCount,
    pass: passCount === cases.length,
    cases,
  };

  const reportPath = path.join(process.cwd(), 'reports', 'growth', 'route-state-save-load-parity.json');
  mkdirSync(path.dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`[check_route_state_save_load_parity] report: ${path.relative(process.cwd(), reportPath)}`);
  console.log(`[check_route_state_save_load_parity] passCount: ${passCount}/${cases.length}`);
  if (!report.pass) {
    process.exitCode = 1;
  }
}

main();
