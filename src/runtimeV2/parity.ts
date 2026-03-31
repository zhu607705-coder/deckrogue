import type { RuleCommand, RuleRuntimeAdapter, RuleSnapshot } from '@/runtimeV2/contracts';

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
}

function projectStableFields(snapshot: RuleSnapshot) {
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
    },
    map: {
      currentNodeId: snapshot.map.currentNodeId,
    },
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
  const { legacyAdapter, candidateAdapter, seed, commands } = options;

  const steps: ParityStep[] = [];
  let legacySnapshot = await legacyAdapter.start({ seed });
  let candidateSnapshot = await candidateAdapter.start({ seed });

  steps.push({
    label: '$boot',
    diffs: diffProjectedSnapshots(
      projectStableFields(legacySnapshot) as Record<string, unknown>,
      projectStableFields(candidateSnapshot) as Record<string, unknown>,
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
        projectStableFields(legacySnapshot) as Record<string, unknown>,
        projectStableFields(candidateSnapshot) as Record<string, unknown>,
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
  const { legacyAdapter, candidateAdapter, seed, steps: stepInputs } = options;

  const steps: ParityStep[] = [];
  const commands: RuleCommand[] = [];
  let legacySnapshot = await legacyAdapter.start({ seed });
  let candidateSnapshot = await candidateAdapter.start({ seed });

  steps.push({
    label: '$boot',
    diffs: diffProjectedSnapshots(
      projectStableFields(legacySnapshot) as Record<string, unknown>,
      projectStableFields(candidateSnapshot) as Record<string, unknown>,
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
        projectStableFields(legacySnapshot) as Record<string, unknown>,
        projectStableFields(candidateSnapshot) as Record<string, unknown>,
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
