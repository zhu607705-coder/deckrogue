/**
 * @file errorHandler.ts
 * @description UI 系统错误处理器，集中捕获和分发错误事件
 *
 * 主要职责:
 * - 捕获 UI 系统错误并通过事件总线发布
 * - 提供 ErrorContext 上下文信息用于错误溯源
 * - 支持 ValidationResult 校验结果收集
 */
import type { UIModel } from './uiModel';
import { getEventBus } from './eventBus';
import type { EventType, UIEvent } from './eventBus';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ErrorContext {
  source: string;
  component?: string;
  action?: string;
  payload?: unknown;
}

export class ErrorHandler {
  private eventBus: ReturnType<typeof getEventBus>;

  constructor() {
    this.eventBus = getEventBus();
  }

  handleError(error: Error, context?: ErrorContext): void {
    console.error(`[UI System Error] ${context?.source || 'Unknown'}:`, error);

    this.eventBus.publish('error' as EventType, {
      message: error.message,
      stack: error.stack,
      context,
      timestamp: Date.now(),
    });
  }

  handleWarning(message: string, context?: ErrorContext): void {
    console.warn(`[UI System Warning] ${context?.source || 'Unknown'}:`, message);

    this.eventBus.publish('warning' as EventType, {
      message,
      context,
      timestamp: Date.now(),
    });
  }

  validateModel(model: UIModel): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!model.screen) {
      errors.push('Screen is required');
    }

    if (!model.player) {
      errors.push('Player data is required');
    } else {
      if (model.player.hp < 0) {
        errors.push('Player HP cannot be negative');
      }
      if (model.player.maxHp <= 0) {
        errors.push('Player max HP must be positive');
      }
      if (model.player.hp > model.player.maxHp) {
        warnings.push('Player HP exceeds max HP');
      }
      if (model.player.gold < 0) {
        errors.push('Player gold cannot be negative');
      }
    }

    if (!model.map) {
      errors.push('Map data is required');
    }

    if (model.combat) {
      if (model.combat.turn < 0) {
        errors.push('Combat turn cannot be negative');
      }
      if (model.combat.enemies.length === 0) {
        warnings.push('Combat has no enemies');
      }
    }

    if (model.reward) {
      if (model.reward.cards.length === 0 && model.reward.gold === 0 && model.reward.relics.length === 0 && model.reward.potions.length === 0) {
        warnings.push('Reward has no content');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  validateCard(card: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!card.id) {
      errors.push('Card ID is required');
    }
    if (!card.name) {
      errors.push('Card name is required');
    }
    if (card.cost < 0) {
      errors.push('Card cost cannot be negative');
    }
    if (!card.type) {
      errors.push('Card type is required');
    }
    if (!card.description) {
      warnings.push('Card description is missing');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  validateCharacter(character: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!character.id) {
      errors.push('Character ID is required');
    }
    if (!character.name) {
      errors.push('Character name is required');
    }
    if (character.maxHp <= 0) {
      errors.push('Character max HP must be positive');
    }
    if (character.maxEnergy < 0) {
      errors.push('Character max energy cannot be negative');
    }
    if (!character.startingDeck || character.startingDeck.length === 0) {
      errors.push('Character must have a starting deck');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  catchAsyncErrors<T>(fn: () => Promise<T>, context?: ErrorContext): Promise<T | null> {
    return fn().catch((error) => {
      this.handleError(error as Error, context);
      return null;
    });
  }

  catchSyncErrors<T>(fn: () => T, context?: ErrorContext): T | null {
    try {
      return fn();
    } catch (error) {
      this.handleError(error as Error, context);
      return null;
    }
  }
}

let globalErrorHandler: ErrorHandler | null = null;

export function getErrorHandler(): ErrorHandler {
  if (!globalErrorHandler) {
    globalErrorHandler = new ErrorHandler();
  }
  return globalErrorHandler;
}

export function resetErrorHandler(): void {
  globalErrorHandler = null;
}
