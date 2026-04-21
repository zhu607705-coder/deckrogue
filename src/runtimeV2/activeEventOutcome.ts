import type { ActiveEventState } from '@/core/types';
import type { RuleSnapshot } from './contracts';

export type ActiveEventChoiceRole = 'confirm' | 'payoff' | 'pivot' | 'support' | null;
export type ActiveEventOutcomeKind = 'confirm' | 'payoff' | 'pivot' | 'support' | 'neutral' | null;

export interface ActiveEventOutcomeProjection {
  lastChoiceId: string | null;
  choiceRole: ActiveEventChoiceRole;
  outcomeKind: ActiveEventOutcomeKind;
}

export interface ActiveEventFreeRemovalPayloadProjection {
  state: 'missing' | 'invalid' | 'valid';
  value: number | null;
}

export interface ActiveEventParityProjection extends ActiveEventOutcomeProjection {
  id: string;
  stage: string | null;
  freeRemovalsRemaining: ActiveEventFreeRemovalPayloadProjection | null;
}

interface ActiveEventOutcomeCarrier {
  id?: unknown;
  stage?: unknown;
  lastChoiceId?: unknown;
  choiceRole?: unknown;
  outcomeKind?: unknown;
  data?: Record<string, unknown> | null;
}

function coerceString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function coerceRole(value: unknown): ActiveEventChoiceRole {
  return value === 'confirm' || value === 'payoff' || value === 'pivot' || value === 'support'
    ? value
    : null;
}

function coerceOutcomeKind(value: unknown): ActiveEventOutcomeKind {
  return value === 'confirm' || value === 'payoff' || value === 'pivot' || value === 'support' || value === 'neutral'
    ? value
    : null;
}

function coerceStage(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function projectOptionalNonNegativeInteger(value: unknown): ActiveEventFreeRemovalPayloadProjection {
  if (value === undefined) {
    return { state: 'missing', value: null };
  }
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || !Number.isInteger(value)) {
    return { state: 'invalid', value: null };
  }
  return { state: 'valid', value };
}

function readActiveEventOutcome(event: ActiveEventOutcomeCarrier | null | undefined): ActiveEventOutcomeProjection {
  const data = (event?.data ?? {}) as Record<string, unknown>;
  return {
    lastChoiceId: coerceString(event?.lastChoiceId) ?? coerceString(data.lastChoiceId),
    choiceRole: coerceRole(event?.choiceRole) ?? coerceRole(data.choiceRole),
    outcomeKind: coerceOutcomeKind(event?.outcomeKind) ?? coerceOutcomeKind(data.outcomeKind),
  };
}

export function readRuleActiveEventOutcome(event: RuleSnapshot['activeEvent']): ActiveEventOutcomeProjection {
  return readActiveEventOutcome(event);
}

export function readLegacyActiveEventOutcome(event: ActiveEventState | null | undefined): ActiveEventOutcomeProjection {
  return readActiveEventOutcome(event);
}

export function projectRuleActiveEventForParity(
  event: RuleSnapshot['activeEvent'],
  options: { strictPayload?: boolean } = {},
): ActiveEventParityProjection | null {
  if (!event) {
    return null;
  }

  const outcome = readRuleActiveEventOutcome(event);
  const data = (event.data ?? {}) as Record<string, unknown>;
  const stage = coerceStage(event.stage);

  return {
    id: typeof event.id === 'string' ? event.id : '',
    stage,
    lastChoiceId: outcome.lastChoiceId,
    choiceRole: outcome.choiceRole,
    outcomeKind: outcome.outcomeKind,
    freeRemovalsRemaining:
      options.strictPayload && stage === 'free_remove'
        ? projectOptionalNonNegativeInteger(data.freeRemovalsRemaining)
        : null,
  };
}
