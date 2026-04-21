import type { CombatState, GameState } from '@/core/types/combat';
import type { CombatActionRecord } from '@/core/ai';
import { cloneJsonValue } from '@/core/utils/safeJson';

export interface BranchingOutcome {
  id: string;
  triggerCondition: OutcomeCondition;
  combatModification: CombatModification;
  narrative: NarrativeEntry;
  availableChoices: OutcomeChoice[];
}

export interface OutcomeCondition {
  type: 'hp_threshold' | 'turn_count' | 'status_count' | 'action_sequence' | 'relic_owned' | 'gold' | 'card_count';
  params: Record<string, any>;
  comparison: 'gte' | 'lte' | 'eq' | 'contains';
}

export interface CombatModification {
  enemyBehavior?: 'pacifist' | 'berserk' | 'negotiate' | 'transform';
  newEnemy?: string;
  removeEnemy?: string;
  addIntent?: string;
  modifyHp?: number;
}

export interface NarrativeEntry {
  title: string;
  description: string;
  flavorText: string;
  icon?: string;
}

export interface OutcomeChoice {
  id: string;
  label: string;
  description: string;
  requirements: OutcomeCondition[];
  result: {
    combatContinuation: boolean;
    reward?: RewardSpec;
    penalty?: RewardSpec;
    narrative: NarrativeEntry;
  };
}

export interface RewardSpec {
  type: 'relic' | 'gold' | 'potion' | 'card';
  id?: string;
  value?: number;
}

export function checkOutcomeCondition(
  condition: OutcomeCondition,
  combatState: CombatState,
  playerRelics: string[],
  combatHistory: CombatActionRecord[]
): boolean {
  switch (condition.type) {
    case 'hp_threshold': {
      const { threshold, target } = condition.params;
      let currentValue: number;

      if (target === 'player') {
        currentValue = (combatState.player.hp / combatState.player.maxHp) * 100;
      } else if (target === 'enemy' && combatState.enemies.length > 0) {
        const enemy = combatState.enemies[0];
        currentValue = (enemy.hp / enemy.maxHp) * 100;
      } else {
        return false;
      }

      return compareValues(currentValue, threshold, condition.comparison);
    }

    case 'turn_count': {
      const { minTurns, maxTurns } = condition.params;
      const currentTurn = combatState.turn;

      if (minTurns !== undefined && !compareValues(currentTurn, minTurns, 'gte')) {
        return false;
      }
      if (maxTurns !== undefined && !compareValues(currentTurn, maxTurns, 'lte')) {
        return false;
      }
      return true;
    }

    case 'status_count': {
      const { statusName, minStacks, target } = condition.params;
      let statuses: Record<string, number>;

      if (target === 'player') {
        statuses = combatState.player.statuses;
      } else if (target === 'enemy' && combatState.enemies.length > 0) {
        statuses = combatState.enemies[0].statuses;
      } else {
        return false;
      }

      const currentStacks = statuses[statusName] || 0;
      return compareValues(currentStacks, minStacks, condition.comparison);
    }

    case 'action_sequence': {
      const { cardSequence, orderMatters } = condition.params;
      const recentActions = combatHistory.slice(-cardSequence.length);

      if (recentActions.length < cardSequence.length) {
        return false;
      }

      const playedCards = recentActions
        .filter(a => a.cardPlayed)
        .map(a => a.cardPlayed!);

      if (orderMatters) {
        return JSON.stringify(playedCards.slice(-cardSequence.length)) ===
               JSON.stringify(cardSequence);
      } else {
        const sortedPlayed = [...playedCards.slice(-cardSequence.length)].sort();
        const sortedRequired = [...cardSequence].sort();
        return JSON.stringify(sortedPlayed) === JSON.stringify(sortedRequired);
      }
    }

    case 'relic_owned': {
      const { relicId } = condition.params;
      return playerRelics.includes(relicId);
    }

    default:
      return false;
  }
}

function compareValues(current: number, target: number, comparison: 'gte' | 'lte' | 'eq' | 'contains'): boolean {
  switch (comparison) {
    case 'gte':
      return current >= target;
    case 'lte':
      return current <= target;
    case 'eq':
      return current === target;
    case 'contains':
      return current >= target;
    default:
      return false;
  }
}

export function detectAvailableOutcomes(
  combatState: CombatState,
  playerRelics: string[],
  combatHistory: CombatActionRecord[],
  config: BranchingOutcome[]
): BranchingOutcome[] {
  return config.filter(outcome =>
    checkOutcomeCondition(outcome.triggerCondition, combatState, playerRelics, combatHistory)
  );
}

export function applyOutcomeChoice(
  choice: OutcomeChoice,
  combatState: CombatState,
  context: GameState
): { combatState: CombatState; context: GameState; narrative: NarrativeEntry } {
  const newCombatState = cloneJsonValue(combatState, combatState);
  const newContext = cloneJsonValue(context, context);

  if (choice.result.reward) {
    applyReward(choice.result.reward, newCombatState, newContext);
  }

  if (choice.result.penalty) {
    applyPenalty(choice.result.penalty, newCombatState, newContext);
  }

  return {
    combatState: newCombatState,
    context: newContext,
    narrative: choice.result.narrative
  };
}

function applyReward(
  reward: RewardSpec,
  combatState: CombatState,
  context: GameState
): void {
  switch (reward.type) {
    case 'relic':
      if (reward.id) {
        context.player.relics.push(reward.id);
      }
      break;
    case 'gold':
      context.player.gold += reward.value || 0;
      break;
    case 'potion':
      if (reward.id) {
        context.player.potions.push(reward.id);
      }
      break;
    case 'card':
      break;
  }
}

function applyPenalty(
  penalty: RewardSpec,
  combatState: CombatState,
  context: GameState
): void {
  switch (penalty.type) {
    case 'gold':
      context.player.gold = Math.max(0, context.player.gold - (penalty.value || 0));
      break;
    case 'relic':
      if (penalty.id) {
        context.player.relics = context.player.relics.filter(r => r !== penalty.id);
      }
      break;
    case 'potion':
      if (penalty.id) {
        context.player.potions = context.player.potions.filter(p => p !== penalty.id);
      }
      break;
    case 'card':
      break;
  }
}

export function getOutcomeDescription(outcome: BranchingOutcome): string {
  const lines: string[] = [];

  lines.push(`【${outcome.narrative.title}】`);
  lines.push(outcome.narrative.description);
  lines.push('');

  if (outcome.combatModification.enemyBehavior) {
    const behaviorMap: Record<string, string> = {
      pacifist: '敌人停止攻击',
      berserk: '敌人进入狂暴状态',
      negotiate: '敌人尝试谈判',
      transform: '敌人发生变形'
    };
    lines.push(`战斗变化: ${behaviorMap[outcome.combatModification.enemyBehavior] || outcome.combatModification.enemyBehavior}`);
  }

  lines.push('');
  lines.push('可选择项:');

  outcome.availableChoices.forEach((choice, index) => {
    lines.push(`${index + 1}. ${choice.label}`);
    lines.push(`   ${choice.description}`);
  });

  return lines.join('\n');
}

export function canChooseOption(
  choice: OutcomeChoice,
  playerState: any
): boolean {
  if (!playerState) return false;

  for (const requirement of choice.requirements) {
    if (requirement.type === 'relic_owned' && requirement.params.relicId) {
      if (!playerState.relics || !playerState.relics.includes(requirement.params.relicId)) {
        return false;
      }
    }

    if (requirement.type === 'hp_threshold' && requirement.params.threshold) {
      const currentHpPercent = (playerState.hp / playerState.maxHp) * 100;
      if (!compareValues(currentHpPercent, requirement.params.threshold, requirement.comparison)) {
        return false;
      }
    }

    if (requirement.type === 'gold' && requirement.params.amount) {
      if ((playerState.gold || 0) < requirement.params.amount) {
        return false;
      }
    }
  }

  return true;
}

export function applyCombatModification(
  modification: CombatModification,
  combatState: CombatState
): CombatState {
  const newState = cloneJsonValue(combatState, combatState);

  if (modification.enemyBehavior && newState.enemies.length > 0) {
    switch (modification.enemyBehavior) {
      case 'pacifist':
        newState.enemies[0].nextIntent = null;
        break;
      case 'berserk':
        newState.enemies[0].nextIntent = 'attack';
        break;
      case 'negotiate':
        newState.enemies[0].nextIntent = 'buff';
        break;
      case 'transform':
        if (modification.newEnemy) {
          newState.enemies[0].defId = modification.newEnemy;
        }
        break;
    }
  }

  if (modification.removeEnemy && newState.enemies.length > 0) {
    newState.enemies = newState.enemies.filter(e => e.id !== modification.removeEnemy);
  }

  if (modification.modifyHp !== undefined && newState.enemies.length > 0) {
    newState.enemies[0].hp = Math.max(0, Math.min(
      newState.enemies[0].maxHp,
      newState.enemies[0].hp + modification.modifyHp
    ));
  }

  return newState;
}
