/**
 * @file runtime_v2_adapter_parity_cases.ts
 * @description 定义运行时 V2 适配器一致性测试的合成场景。
 *
 * 主要职责:
 * - 定义用于测试适配器一致性的合成场景
 * - 提供场景输入和期望输出
 * - 辅助适配器差异分析
 */

import { GameEngine } from '@/core/events/gameEngine';
import { normalizeLegacyGameState } from '@/runtimeV2/normalizeLegacyGameState';
import type { ResolvedParityStepInput } from '@/runtimeV2/parity';
import type { RuleCommand, RuleSnapshot } from '@/runtimeV2/contracts';
import type { RuleCommandSemanticCode } from '@/runtimeV2';
import { syncRoomSessionFromLegacyState } from '@/core/events/roomSession';
import { syncSurfaceContextFromLegacyState } from '@/core/events/surfaceContext';

export type AdapterParitySyntheticCase = {
  scenario: string;
  seed: number;
  kind: 'synthetic';
  label: string;
  snapshot: RuleSnapshot;
  followupSteps: ResolvedParityStepInput[];
};

export type AdapterParityNegativeCase = {
  scenario: string;
  seed: number;
  kind: 'negative';
  expectedSemanticCode: RuleCommandSemanticCode;
  bootSteps: ResolvedParityStepInput[];
  invalidLegacyCommand: (snapshot: RuleSnapshot) => RuleCommand;
  invalidCandidateCommand: (snapshot: RuleSnapshot) => RuleCommand;
};

function buildMapEntrySnapshot(): RuleSnapshot {
  const engine = new GameEngine(77, null, { enableRuntimeDelegation: false });
  try {
    engine.selectCharacter('informant');
    syncRoomSessionFromLegacyState(engine.state);
    syncSurfaceContextFromLegacyState(engine.state);
    return normalizeLegacyGameState(engine.state, engine.getSaveData());
  } finally {
    engine.dispose();
  }
}

export type AdapterParityScenario = AdapterParitySyntheticCase | AdapterParityNegativeCase;

export function stableToken(snapshot: RuleSnapshot, index = 0): string {
  const cardId = snapshot.player.deck[index];
  if (!cardId) {
    throw new Error(`No deck card found at index ${index}`);
  }
  return `${index}:${cardId}`;
}

function buildRestEntrySnapshot(): RuleSnapshot {
  const engine = new GameEngine(73, null, { enableRuntimeDelegation: false });
  try {
    engine.selectCharacter('informant');
    engine.state.currentNodeId = engine.state.map.find((node) => node.y === 0)?.id ?? null;
    engine.state.screen = 'Rest';
    engine.state.pendingNodeResolution = true;
    syncRoomSessionFromLegacyState(engine.state);
    syncSurfaceContextFromLegacyState(engine.state);
    return normalizeLegacyGameState(engine.state, engine.getSaveData());
  } finally {
    engine.dispose();
  }
}

function buildShopEntrySnapshot(): RuleSnapshot {
  const engine = new GameEngine(74, null, { enableRuntimeDelegation: false });
  try {
    engine.selectCharacter('informant');
    engine.state.currentNodeId = engine.state.map.find((node) => node.y === 0)?.id ?? null;
    engine.enterShop();
    syncRoomSessionFromLegacyState(engine.state);
    syncSurfaceContextFromLegacyState(engine.state);
    return normalizeLegacyGameState(engine.state, engine.getSaveData());
  } finally {
    engine.dispose();
  }
}

function buildRichShopEntrySnapshot(): RuleSnapshot {
  const engine = new GameEngine(76, null, { enableRuntimeDelegation: false });
  try {
    engine.selectCharacter('informant');
    engine.state.currentNodeId = engine.state.map.find((node) => node.y === 0)?.id ?? null;
    engine.state.player.gold = 999;
    engine.enterShop();
    syncRoomSessionFromLegacyState(engine.state);
    syncSurfaceContextFromLegacyState(engine.state);
    return normalizeLegacyGameState(engine.state, engine.getSaveData());
  } finally {
    engine.dispose();
  }
}

function buildEventEntrySnapshot(): RuleSnapshot {
  const engine = new GameEngine(75, null, { enableRuntimeDelegation: false });
  try {
    engine.selectCharacter('informant');
    engine.state.currentNodeId = engine.state.map.find((node) => node.y === 0)?.id ?? null;
    engine.state.screen = 'Event';
    engine.state.pendingNodeResolution = true;
    engine.state.activeEvent = {
      id: 'mysterious_shrine',
      stage: null,
      data: {},
    };
    syncRoomSessionFromLegacyState(engine.state);
    syncSurfaceContextFromLegacyState(engine.state);
    return normalizeLegacyGameState(engine.state, engine.getSaveData());
  } finally {
    engine.dispose();
  }
}

function buildRestRelicUpgradeSnapshot(): RuleSnapshot {
  const engine = new GameEngine(71, null, { enableRuntimeDelegation: false });
  try {
    engine.selectCharacter('informant');
    engine.state.currentNodeId = engine.state.map.find((node) => node.y === 0 && node.type === 'Rest')?.id
      ?? engine.state.map.find((node) => node.y === 0)?.id
      ?? null;
    engine.state.screen = 'Rest';
    engine.state.player.gold = 999;
    engine.state.player.relics.push('entropy_sanctum_relic');
    engine.state.player.relicStates.entropy_sanctum_relic = {
      level: 1,
      progress: 0,
      corrupted: true,
    };
    syncRoomSessionFromLegacyState(engine.state);
    syncSurfaceContextFromLegacyState(engine.state);
    return normalizeLegacyGameState(engine.state, engine.getSaveData());
  } finally {
    engine.dispose();
  }
}

function buildEventFreeRemoveSnapshot(): RuleSnapshot {
  const engine = new GameEngine(72, null, { enableRuntimeDelegation: false });
  try {
    engine.selectCharacter('informant');
    engine.state.currentNodeId = engine.state.map.find((node) => node.y === 0 && node.type === 'Event')?.id
      ?? engine.state.map.find((node) => node.y === 0)?.id
      ?? null;
    engine.state.screen = 'RemoveCard';
    engine.state.activeEvent = {
      id: 'nameless_martyr_shrine',
      stage: 'free_remove',
      data: { freeRemovalsRemaining: 2 },
    };
    syncRoomSessionFromLegacyState(engine.state, { isEventFreeCardRemovalMode: true });
    syncSurfaceContextFromLegacyState(engine.state, { isEventFreeCardRemovalMode: true });
    return normalizeLegacyGameState(engine.state, engine.getSaveData());
  } finally {
    engine.dispose();
  }
}

export function buildRuntimeV2AdapterParityScenarioCatalog(): AdapterParityScenario[] {
  const restEntrySnapshot = buildRestEntrySnapshot();
  const shopEntrySnapshot = buildShopEntrySnapshot();
  const richShopEntrySnapshot = buildRichShopEntrySnapshot();
  const eventEntrySnapshot = buildEventEntrySnapshot();
  const restRelicUpgradeSnapshot = buildRestRelicUpgradeSnapshot();
  const eventFreeRemoveSnapshot = buildEventFreeRemoveSnapshot();
  const mapEntrySnapshot = buildMapEntrySnapshot();

  return [
    {
      scenario: 'adapter_shared_event_exit',
      seed: 75,
      kind: 'synthetic',
      label: 'event_entry',
      snapshot: eventEntrySnapshot,
      followupSteps: [
        {
          label: 'event_choice',
          legacyCommand: { type: 'choose_event_option', choiceId: 'continue' },
          candidateCommand: { type: 'choose_event_option', choiceId: 'continue' },
        },
      ],
    },
    {
      scenario: 'adapter_shared_rest_then_map',
      seed: 73,
      kind: 'synthetic',
      label: 'rest_entry',
      snapshot: restEntrySnapshot,
      followupSteps: [
        {
          label: 'rest',
          legacyCommand: { type: 'rest' },
          candidateCommand: { type: 'rest' },
        },
      ],
    },
    {
      scenario: 'adapter_shared_shop_card_purchase',
      seed: 74,
      kind: 'synthetic',
      label: 'shop_entry',
      snapshot: shopEntrySnapshot,
      followupSteps: [
        {
          label: 'buy_shop_card',
          legacyCommand: (snapshot) => {
            const card = [...(snapshot.shop?.cards ?? [])].sort((left, right) => left.price - right.price)[0];
            if (!card) throw new Error('Missing shop card offer');
            return { type: 'buy_shop_card', cardId: card.id };
          },
          candidateCommand: (snapshot) => {
            const card = [...(snapshot.shop?.cards ?? [])].sort((left, right) => left.price - right.price)[0];
            if (!card) throw new Error('Missing shop card offer');
            return { type: 'buy_shop_card', cardId: card.id };
          },
        },
      ],
    },
    {
      scenario: 'adapter_shared_shop_card_then_remove_cancel',
      seed: 76,
      kind: 'synthetic',
      label: 'rich_shop_entry',
      snapshot: richShopEntrySnapshot,
      followupSteps: [
        {
          label: 'buy_shop_card',
          legacyCommand: (snapshot) => {
            const card = [...(snapshot.shop?.cards ?? [])].sort((left, right) => left.price - right.price)[0];
            if (!card) throw new Error('Missing shop card offer');
            return { type: 'buy_shop_card', cardId: card.id };
          },
          candidateCommand: (snapshot) => {
            const card = [...(snapshot.shop?.cards ?? [])].sort((left, right) => left.price - right.price)[0];
            if (!card) throw new Error('Missing shop card offer');
            return { type: 'buy_shop_card', cardId: card.id };
          },
        },
        {
          label: 'enter_remove_card',
          legacyCommand: { type: 'remove_card' },
          candidateCommand: { type: 'remove_card' },
        },
        {
          label: 'cancel_remove_card',
          legacyCommand: { type: 'cancel_surface' },
          candidateCommand: { type: 'cancel_surface' },
        },
      ],
    },
    {
      scenario: 'adapter_shared_shop_relic_purchase',
      seed: 76,
      kind: 'synthetic',
      label: 'rich_shop_entry',
      snapshot: richShopEntrySnapshot,
      followupSteps: [
        {
          label: 'buy_shop_relic',
          legacyCommand: (snapshot) => {
            const relic = [...(snapshot.shop?.relics ?? [])].sort((left, right) => left.price - right.price)[0];
            if (!relic) throw new Error('Missing shop relic offer');
            return { type: 'buy_shop_relic', relicId: relic.id };
          },
          candidateCommand: (snapshot) => {
            const relic = [...(snapshot.shop?.relics ?? [])].sort((left, right) => left.price - right.price)[0];
            if (!relic) throw new Error('Missing shop relic offer');
            return { type: 'buy_shop_relic', relicId: relic.id };
          },
        },
      ],
    },
    {
      scenario: 'adapter_shared_shop_potion_purchase',
      seed: 76,
      kind: 'synthetic',
      label: 'rich_shop_entry',
      snapshot: richShopEntrySnapshot,
      followupSteps: [
        {
          label: 'buy_shop_potion',
          legacyCommand: (snapshot) => {
            const potion = [...(snapshot.shop?.potions ?? [])].sort((left, right) => left.price - right.price)[0];
            if (!potion) throw new Error('Missing shop potion offer');
            return { type: 'buy_shop_potion', potionId: potion.id };
          },
          candidateCommand: (snapshot) => {
            const potion = [...(snapshot.shop?.potions ?? [])].sort((left, right) => left.price - right.price)[0];
            if (!potion) throw new Error('Missing shop potion offer');
            return { type: 'buy_shop_potion', potionId: potion.id };
          },
        },
      ],
    },
    {
      scenario: 'adapter_shared_rest_upgrade_cancel',
      seed: 73,
      kind: 'synthetic',
      label: 'rest_entry',
      snapshot: restEntrySnapshot,
      followupSteps: [
        {
          label: 'enter_upgrade',
          legacyCommand: { type: 'upgrade_card' },
          candidateCommand: { type: 'upgrade_card' },
        },
        {
          label: 'cancel_upgrade',
          legacyCommand: { type: 'cancel_surface' },
          candidateCommand: { type: 'cancel_surface' },
        },
      ],
    },
    {
      scenario: 'adapter_shared_rest_remove_confirm',
      seed: 73,
      kind: 'synthetic',
      label: 'rest_entry',
      snapshot: restEntrySnapshot,
      followupSteps: [
        {
          label: 'enter_remove_card',
          legacyCommand: { type: 'remove_card' },
          candidateCommand: { type: 'remove_card' },
        },
        {
          label: 'remove_rest_card',
          legacyCommand: (snapshot) => ({ type: 'remove_card', cardInstanceId: stableToken(snapshot, 0) }),
          candidateCommand: (snapshot) => ({ type: 'remove_card', cardInstanceId: stableToken(snapshot, 0) }),
        },
      ],
    },
    {
      scenario: 'adapter_shared_rest_enchant_confirm',
      seed: 73,
      kind: 'synthetic',
      label: 'rest_entry',
      snapshot: restEntrySnapshot,
      followupSteps: [
        {
          label: 'enter_enchant',
          legacyCommand: { type: 'enter_enchant' },
          candidateCommand: { type: 'enter_enchant' },
        },
        {
          label: 'apply_enchantment',
          legacyCommand: (snapshot) => ({ type: 'apply_enchantment', cardInstanceId: stableToken(snapshot, 0) }),
          candidateCommand: (snapshot) => ({ type: 'apply_enchantment', cardInstanceId: stableToken(snapshot, 0) }),
        },
      ],
    },
    {
      scenario: 'adapter_synthetic_rest_relic_upgrade_confirm',
      seed: 71,
      kind: 'synthetic',
      label: 'rest_relic_upgrade',
      snapshot: restRelicUpgradeSnapshot,
      followupSteps: [
        {
          label: 'enter_relic_upgrade',
          legacyCommand: { type: 'enter_relic_upgrade' },
          candidateCommand: { type: 'enter_relic_upgrade' },
        },
        {
          label: 'upgrade_relic',
          legacyCommand: { type: 'upgrade_relic', relicId: 'entropy_sanctum_relic' },
          candidateCommand: { type: 'upgrade_relic', relicId: 'entropy_sanctum_relic' },
        },
        {
          label: 'cancel_relic_upgrade',
          legacyCommand: { type: 'cancel_surface' },
          candidateCommand: { type: 'cancel_surface' },
        },
      ],
    },
    {
      scenario: 'adapter_synthetic_event_free_remove_cancel',
      seed: 72,
      kind: 'synthetic',
      label: 'event_free_remove',
      snapshot: eventFreeRemoveSnapshot,
      followupSteps: [
        {
          label: 'cancel_remove_card',
          legacyCommand: { type: 'cancel_surface' },
          candidateCommand: { type: 'cancel_surface' },
        },
      ],
    },
    {
      scenario: 'adapter_synthetic_event_free_remove_confirm',
      seed: 72,
      kind: 'synthetic',
      label: 'event_free_remove',
      snapshot: eventFreeRemoveSnapshot,
      followupSteps: [
        {
          label: 'remove_free_card',
          legacyCommand: (snapshot) => ({ type: 'remove_card', cardInstanceId: stableToken(snapshot, 0) }),
          candidateCommand: (snapshot) => ({ type: 'remove_card', cardInstanceId: stableToken(snapshot, 0) }),
        },
      ],
    },
    {
      scenario: 'adapter_negative_invalid_upgrade_selector',
      seed: 73,
      kind: 'negative',
      expectedSemanticCode: 'selector_out_of_range',
      bootSteps: [
        {
          label: 'load_rest_entry',
          legacyCommand: { type: 'load_snapshot', snapshot: restEntrySnapshot },
          candidateCommand: { type: 'load_snapshot', snapshot: restEntrySnapshot },
        },
        {
          label: 'enter_upgrade',
          legacyCommand: { type: 'upgrade_card' },
          candidateCommand: { type: 'upgrade_card' },
        },
      ],
      invalidLegacyCommand: () => ({ type: 'upgrade_card', cardInstanceId: '999:missing_card' }),
      invalidCandidateCommand: () => ({ type: 'upgrade_card', cardInstanceId: '999:missing_card' }),
    },
    {
      scenario: 'adapter_negative_invalid_remove_selector',
      seed: 74,
      kind: 'negative',
      expectedSemanticCode: 'selector_out_of_range',
      bootSteps: [
        {
          label: 'load_shop_entry',
          legacyCommand: { type: 'load_snapshot', snapshot: shopEntrySnapshot },
          candidateCommand: { type: 'load_snapshot', snapshot: shopEntrySnapshot },
        },
        {
          label: 'enter_remove_card',
          legacyCommand: { type: 'remove_card' },
          candidateCommand: { type: 'remove_card' },
        },
      ],
      invalidLegacyCommand: () => ({ type: 'remove_card', cardInstanceId: '999:missing_card' }),
      invalidCandidateCommand: () => ({ type: 'remove_card', cardInstanceId: '999:missing_card' }),
    },
    {
      scenario: 'adapter_negative_invalid_shop_card',
      seed: 74,
      kind: 'negative',
      expectedSemanticCode: 'shop_offer_missing',
      bootSteps: [
        {
          label: 'load_shop_entry',
          legacyCommand: { type: 'load_snapshot', snapshot: shopEntrySnapshot },
          candidateCommand: { type: 'load_snapshot', snapshot: shopEntrySnapshot },
        },
      ],
      invalidLegacyCommand: () => ({ type: 'buy_shop_card', cardId: 'missing_card' }),
      invalidCandidateCommand: () => ({ type: 'buy_shop_card', cardId: 'missing_card' }),
    },
    {
      scenario: 'adapter_negative_invalid_shop_relic',
      seed: 74,
      kind: 'negative',
      expectedSemanticCode: 'shop_offer_missing',
      bootSteps: [
        {
          label: 'load_shop_entry',
          legacyCommand: { type: 'load_snapshot', snapshot: shopEntrySnapshot },
          candidateCommand: { type: 'load_snapshot', snapshot: shopEntrySnapshot },
        },
      ],
      invalidLegacyCommand: () => ({ type: 'buy_shop_relic', relicId: 'missing_relic' }),
      invalidCandidateCommand: () => ({ type: 'buy_shop_relic', relicId: 'missing_relic' }),
    },
    {
      scenario: 'adapter_negative_invalid_shop_potion',
      seed: 74,
      kind: 'negative',
      expectedSemanticCode: 'shop_offer_missing',
      bootSteps: [
        {
          label: 'load_shop_entry',
          legacyCommand: { type: 'load_snapshot', snapshot: shopEntrySnapshot },
          candidateCommand: { type: 'load_snapshot', snapshot: shopEntrySnapshot },
        },
      ],
      invalidLegacyCommand: () => ({ type: 'buy_shop_potion', potionId: 'missing_potion' }),
      invalidCandidateCommand: () => ({ type: 'buy_shop_potion', potionId: 'missing_potion' }),
    },
    {
      scenario: 'adapter_negative_invalid_phase_cancel_surface',
      seed: 77,
      kind: 'negative',
      expectedSemanticCode: 'invalid_phase',
      bootSteps: [
        {
          label: 'load_map_entry',
          legacyCommand: { type: 'load_snapshot', snapshot: mapEntrySnapshot },
          candidateCommand: { type: 'load_snapshot', snapshot: mapEntrySnapshot },
        },
      ],
      invalidLegacyCommand: () => ({ type: 'cancel_surface' }),
      invalidCandidateCommand: () => ({ type: 'cancel_surface' }),
    },
    {
      scenario: 'adapter_negative_invalid_surface_state_upgrade_relic',
      seed: 71,
      kind: 'negative',
      expectedSemanticCode: 'invalid_surface_state',
      bootSteps: [
        {
          label: 'load_rest_relic_entry',
          legacyCommand: { type: 'load_snapshot', snapshot: restRelicUpgradeSnapshot },
          candidateCommand: { type: 'load_snapshot', snapshot: restRelicUpgradeSnapshot },
        },
        {
          label: 'enter_relic_upgrade',
          legacyCommand: { type: 'enter_relic_upgrade' },
          candidateCommand: { type: 'enter_relic_upgrade' },
        },
      ],
      invalidLegacyCommand: () => ({ type: 'upgrade_relic', relicId: 'missing_relic' }),
      invalidCandidateCommand: () => ({ type: 'upgrade_relic', relicId: 'missing_relic' }),
    },
  ];
}
