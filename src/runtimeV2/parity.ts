/**
 * @file parity.ts
 * @description 一致性校验引擎，对比新旧运行时适配器在同一命令序列下的快照差异
 *
 * 主要职责:
 * - 定义 ParityDiff / ParityStep 差异记录结构
 * - 执行一致性校验场景，逐命令对比快照差异
 * - 支持 strictStableFields 严格模式校验
 */
import type { RuleCommand, RuleRuntimeAdapter, RuleSnapshot } from '@/runtimeV2/contracts';
import { projectRuleActiveEventForParity } from './activeEventOutcome';

export interface ParityDiff {
  field: string;
  legacy: unknown;
  candidate: unknown;
}

export interface ParityStep {
  label: string;
  diffs: ParityDiff[];
  legacySnapshot: RuleSnapshot;
  candidateSnapshot: RuleSnapshot;
}

export interface ParityScenarioResult {
  seed: number;
  commands: RuleCommand[];
  steps: ParityStep[];
}

export interface RunParityScenarioOptions {
  legacyAdapter: RuleRuntimeAdapter;
  candidateAdapter: RuleRuntimeAdapter;
  seed: number;
  commands: RuleCommand[];
  strictStableFields?: boolean;
}

export interface ResolvedParityStepInput {
  label: string;
  legacyCommand: RuleCommand | ((snapshot: RuleSnapshot) => RuleCommand);
  candidateCommand: RuleCommand | ((snapshot: RuleSnapshot) => RuleCommand);
}

export interface RunResolvedParityScenarioOptions {
  legacyAdapter: RuleRuntimeAdapter;
  candidateAdapter: RuleRuntimeAdapter;
  seed: number;
  steps: ResolvedParityStepInput[];
  strictStableFields?: boolean;
}

function projectStableFields(snapshot: RuleSnapshot, options: { strictStableFields?: boolean } = {}) {
  const strictStableFields = !!options.strictStableFields;
  const sortValueCounts = (values: string[]) => {
    const counts = new Map<string, number>();
    for (const value of values) {
      const stableValue = value.endsWith('*') ? value.slice(0, -1) : value;
      counts.set(stableValue, (counts.get(stableValue) ?? 0) + 1);
    }
    return [...counts.entries()].map(([value, count]) => `${value}:${count}`).sort();
  };

  const routeCommits = snapshot.routeState?.recentCommits ?? [];
  const activeEvent = projectRuleActiveEventForParity(snapshot.activeEvent, { strictPayload: strictStableFields });
  const surfaceContext = (() => {
    if (snapshot.lifecycle.phase === 'map' && !snapshot.lifecycle.pendingNodeResolution && !snapshot.roomSession) {
      return null;
    }
    const context = snapshot.surfaceContext ?? null;
    if (!context) {
      return null;
    }
    const projected = {
      upgradeReturnScreen: context.upgradeReturnScreen ?? null,
      relicUpgradeReturnScreen: context.relicUpgradeReturnScreen ?? null,
      enchantReturnScreen: context.enchantReturnScreen ?? null,
      campfireChoiceLocked: context.campfireChoiceLocked ?? false,
      isEventFreeCardRemovalMode: context.isEventFreeCardRemovalMode ?? false,
      pendingUpgradeRefund: context.pendingUpgradeRefund ?? false,
      enchantContext: context.enchantContext
        ? {
            source: context.enchantContext.source,
            enchantmentId: context.enchantContext.enchantmentId,
            returnScreen: context.enchantContext.returnScreen ?? null,
            price: context.enchantContext.price ?? null,
          }
        : null,
    };
    return Object.values(projected).every((value) => value === null || value === false) ? null : projected;
  })();

  return {
    seed: snapshot.seed,
    lifecycle: {
      screen: snapshot.lifecycle.screen,
      phase: snapshot.lifecycle.phase,
      pendingNodeResolution: snapshot.lifecycle.pendingNodeResolution,
    },
    player: {
      characterId: snapshot.player.characterId,
      hp: snapshot.player.hp,
      maxHp: snapshot.player.maxHp,
      gold: snapshot.player.gold,
      intel: snapshot.player.intel,
      devotion: snapshot.player.devotion,
      corruption: snapshot.player.corruption,
      deckCount: snapshot.player.deck.length,
      relicCount: snapshot.player.relicIds.length,
      potionCount: snapshot.player.potionIds.length,
      ...(strictStableFields ? {
        deck: sortValueCounts(snapshot.player.deck),
        relicIds: sortValueCounts(snapshot.player.relicIds),
        potionIds: sortValueCounts(snapshot.player.potionIds),
      } : {}),
      relicStateKeys: Object.keys(snapshot.player.relicStates ?? {}).sort(),
      relicStates: snapshot.player.relicStates ?? {},
    },
    map: {
      currentNodeId: snapshot.map.currentNodeId,
    },
    activeEvent,
    shop: snapshot.shop && snapshot.lifecycle.phase === 'shop'
      ? {
          cards: snapshot.shop.cards.map((entry) => `${entry.id}:${entry.price}`).sort(),
          relics: snapshot.shop.relics.map((entry) => `${entry.id}:${entry.price}`).sort(),
          potions: snapshot.shop.potions.map((entry) => `${entry.id}:${entry.price}`).sort(),
          cardRemovalCost: snapshot.shop.cardRemovalCost,
        }
      : null,
    routeState: snapshot.routeState
      ? {
          primaryTag: snapshot.routeState.primaryTag ?? null,
          secondaryTag: snapshot.routeState.secondaryTag ?? null,
          confidence: snapshot.routeState.confidence ?? 0,
          stage: snapshot.routeState.stage ?? 'forming',
          ...(strictStableFields ? {
            recentCommits: routeCommits
              .slice(-5)
              .map((entry) => `${entry.source}:${entry.tag}:${entry.floor}:${entry.weight}`),
          } : {}),
        }
      : null,
    surfaceContext,
    roomSession: snapshot.roomSession
      ? {
          nodeId: snapshot.roomSession.nodeId,
          ownerKind: snapshot.roomSession.ownerKind,
          resolverKind: snapshot.roomSession.resolverKind,
          surfaceStack: snapshot.roomSession.surfaceStack,
          status: snapshot.roomSession.status,
        }
      : null,
    combat: snapshot.combat
      ? {
          enemyCount: snapshot.combat.enemyIds.length,
          handCount: snapshot.combat.hand.length,
          drawPileCount: snapshot.combat.drawPileCount,
          discardPileCount: snapshot.combat.discardPileCount,
        }
      : null,
    reward: snapshot.reward
      ? {
          cardCount: snapshot.reward.cardIds.length,
          ...(strictStableFields ? { cardIds: [...snapshot.reward.cardIds].sort() } : {}),
          source: snapshot.reward.source,
        }
      : null,
  };
}

function diffProjectedSnapshots(
  legacy: Record<string, unknown>,
  candidate: Record<string, unknown>,
  basePath = '',
): ParityDiff[] {
  const diffs: ParityDiff[] = [];
  const keys = new Set([...Object.keys(legacy), ...Object.keys(candidate)]);

  for (const key of keys) {
    const path = basePath ? `${basePath}.${key}` : key;
    const legacyValue = legacy[key];
    const candidateValue = candidate[key];

    if (
      legacyValue &&
      candidateValue &&
      typeof legacyValue === 'object' &&
      typeof candidateValue === 'object' &&
      !Array.isArray(legacyValue) &&
      !Array.isArray(candidateValue)
    ) {
      diffs.push(
        ...diffProjectedSnapshots(
          legacyValue as Record<string, unknown>,
          candidateValue as Record<string, unknown>,
          path,
        ),
      );
      continue;
    }

    if (JSON.stringify(legacyValue) !== JSON.stringify(candidateValue)) {
      diffs.push({
        field: path,
        legacy: legacyValue,
        candidate: candidateValue,
      });
    }
  }

  return diffs;
}

export async function runParityScenario(options: RunParityScenarioOptions): Promise<ParityScenarioResult> {
  const { legacyAdapter, candidateAdapter, seed, commands, strictStableFields } = options;

  const steps: ParityStep[] = [];
  let legacySnapshot = await legacyAdapter.start({ seed });
  let candidateSnapshot = await candidateAdapter.start({ seed });

  steps.push({
      label: '$boot',
      diffs: diffProjectedSnapshots(
      projectStableFields(legacySnapshot, { strictStableFields }) as Record<string, unknown>,
      projectStableFields(candidateSnapshot, { strictStableFields }) as Record<string, unknown>,
    ),
    legacySnapshot,
    candidateSnapshot,
  });

  for (const command of commands) {
    legacySnapshot = await legacyAdapter.dispatch(command);
    candidateSnapshot = await candidateAdapter.dispatch(command);
    steps.push({
      label: command.type,
      diffs: diffProjectedSnapshots(
        projectStableFields(legacySnapshot, { strictStableFields }) as Record<string, unknown>,
        projectStableFields(candidateSnapshot, { strictStableFields }) as Record<string, unknown>,
      ),
      legacySnapshot,
      candidateSnapshot,
    });
  }

  return {
    seed,
    commands,
    steps,
  };
}

export async function runResolvedParityScenario(options: RunResolvedParityScenarioOptions): Promise<ParityScenarioResult> {
  const { legacyAdapter, candidateAdapter, seed, steps: stepInputs, strictStableFields } = options;

  const steps: ParityStep[] = [];
  const commands: RuleCommand[] = [];
  let legacySnapshot = await legacyAdapter.start({ seed });
  let candidateSnapshot = await candidateAdapter.start({ seed });

  steps.push({
      label: '$boot',
      diffs: diffProjectedSnapshots(
      projectStableFields(legacySnapshot, { strictStableFields }) as Record<string, unknown>,
      projectStableFields(candidateSnapshot, { strictStableFields }) as Record<string, unknown>,
    ),
    legacySnapshot,
    candidateSnapshot,
  });

  for (const input of stepInputs) {
    const legacyCommand = typeof input.legacyCommand === 'function' ? input.legacyCommand(legacySnapshot) : input.legacyCommand;
    const candidateCommand =
      typeof input.candidateCommand === 'function' ? input.candidateCommand(candidateSnapshot) : input.candidateCommand;

    legacySnapshot = await legacyAdapter.dispatch(legacyCommand);
    candidateSnapshot = await candidateAdapter.dispatch(candidateCommand);
    commands.push(legacyCommand);
    steps.push({
      label: input.label,
      diffs: diffProjectedSnapshots(
        projectStableFields(legacySnapshot, { strictStableFields }) as Record<string, unknown>,
        projectStableFields(candidateSnapshot, { strictStableFields }) as Record<string, unknown>,
      ),
      legacySnapshot,
      candidateSnapshot,
    });
  }

  return {
    seed,
    commands,
    steps,
  };
}
