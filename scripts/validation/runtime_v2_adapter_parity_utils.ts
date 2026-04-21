import type {
  ParityReportEntry,
  ParityScenarioResult,
  RuleCommandSemanticCode,
  RuleSnapshot,
  runResolvedParityScenario,
} from '@/runtimeV2';

type ResolvedSteps = Parameters<typeof runResolvedParityScenario>[0]['steps'];

export function cloneResolvedSteps(steps: ResolvedSteps): ResolvedSteps {
  return steps.map((step) => {
    const cloneCommand = <T,>(command: T): T => {
      if (!command || typeof command !== 'object') {
        return command;
      }
      const typed = command as Record<string, unknown>;
      if (typed.type === 'load_snapshot' && typed.snapshot) {
        return {
          ...typed,
          snapshot: structuredClone(typed.snapshot),
        } as T;
      }
      return structuredClone(command);
    };

    return {
      ...step,
      legacyCommand:
        typeof step.legacyCommand === 'function'
          ? step.legacyCommand
          : cloneCommand(step.legacyCommand),
      candidateCommand:
        typeof step.candidateCommand === 'function'
          ? step.candidateCommand
          : cloneCommand(step.candidateCommand),
    };
  });
}

export function collectStableDiffFields(result: ParityScenarioResult): string[] {
  return [...new Set(result.steps.flatMap((step) => step.diffs.map((diff) => `${step.label}:${diff.field}`)))];
}

export function collectStableDiffSamples(result: ParityScenarioResult) {
  return result.steps.flatMap((step) =>
    step.diffs.map((diff) => ({
      field: `${step.label}:${diff.field}`,
      legacy: diff.legacy,
      candidate: diff.candidate,
    })),
  ).slice(0, 12);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function classifyErrorKind(message: string): string | null {
  return /PythonError|ValueError|TypeError|RuntimeError|AssertionError|Error/.exec(message)?.[0]
    ?? (message && message !== 'null' && message !== 'undefined' ? 'Error' : null);
}

export function inferSemanticCode(message: string): RuleCommandSemanticCode {
  const normalized = message.toLowerCase();

  if (
    normalized.includes('could not be resolved')
    || normalized.includes('selector index is out of range')
  ) {
    return 'selector_out_of_range';
  }

  if (normalized.includes('is not offered')) {
    return 'shop_offer_missing';
  }

  if (
    normalized.includes('surface state')
    || normalized.includes('return screen')
    || /\bnot in\b/.test(normalized)
    || normalized.includes('not available for upgrade')
    || normalized.includes('not corrupted')
  ) {
    return 'invalid_surface_state';
  }

  if (
    normalized.includes('wrong phase')
    || normalized.includes('only valid during')
    || /cannot .* from (map|combat|shop|rest|event|reward|characterselect|launcher)/.test(normalized)
  ) {
    return 'invalid_phase';
  }

  return 'unknown';
}

export function classifyNegativeParity(params: {
  legacyError: unknown;
  candidateError: unknown;
  legacyBefore: RuleSnapshot;
  candidateBefore: RuleSnapshot;
  legacyAfter: RuleSnapshot | null;
  candidateAfter: RuleSnapshot | null;
}): {
  legacyMessage: string;
  candidateMessage: string;
  errorClassification: NonNullable<ParityReportEntry['errorClassification']>;
} {
  const legacyMessage = errorMessage(params.legacyError);
  const candidateMessage = errorMessage(params.candidateError);
  const legacyHasTimeout = /timeout/i.test(legacyMessage);
  const candidateHasTimeout = /timeout/i.test(candidateMessage);
  const legacySemanticCode = inferSemanticCode(legacyMessage);
  const candidateSemanticCode = inferSemanticCode(candidateMessage);
  const postErrorSnapshotStable =
    JSON.stringify(params.legacyAfter) === JSON.stringify(params.legacyBefore)
    && JSON.stringify(params.candidateAfter) === JSON.stringify(params.candidateBefore);

  return {
    legacyMessage,
    candidateMessage,
    errorClassification: {
      legacyErrorKind: classifyErrorKind(legacyMessage),
      candidateErrorKind: classifyErrorKind(candidateMessage),
      legacySemanticCode,
      candidateSemanticCode,
      semanticCodeMatch: legacySemanticCode === candidateSemanticCode,
      legacyHasTimeout,
      candidateHasTimeout,
      postErrorSnapshotStable,
    },
  };
}
