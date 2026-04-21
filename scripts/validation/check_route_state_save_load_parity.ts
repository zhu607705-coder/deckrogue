#!/usr/bin/env node

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { GameEngine } from '@/core/events/gameEngine';
import { normalizeLegacyGameState } from '@/runtimeV2/normalizeLegacyGameState';
import { projectRuleSnapshotToLegacyState } from '@/runtimeV2/legacyStateProjector';
import { syncRoomSessionFromLegacyState } from '@/core/events/roomSession';
import { syncSurfaceContextFromLegacyState } from '@/core/events/surfaceContext';

interface CaseResult {
  label: string;
  pass: boolean;
  restoredScreen: string;
  restoredRouteTag: string | null;
  pendingNodeResolution: boolean;
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
      pendingNodeResolution: !!restored.state.pendingNodeResolution,
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
      pendingNodeResolution: !!restored.state.combatRestartCheckpoint?.stateSnapshot.pendingNodeResolution,
    };
  } finally {
    source.dispose();
    restored.dispose();
  }
}

function main() {
  const cases = [buildUpgradeCase(), buildEnchantCase(), buildCheckpointCase()];
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
