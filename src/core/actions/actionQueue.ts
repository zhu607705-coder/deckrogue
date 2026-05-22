/**
 * @file actionQueue.ts
 * @description 动作队列 - 定义动作接口和队列管理的基础类型
 *
 * 主要职责:
 * - 定义 IAction 接口，所有具体动作实现需实现此接口
 * - 定义 IActionContext 接口，提供动作执行的上下文信息
 * - 定义 QueuedAction 接口，描述队列中的动作项
 * - 导出动作相关的类型别名供其他模块使用
 */
import type { GameState } from '@/core/types';

export type ActionId = string;

export interface IActionContext {
  state?: GameState;
  timestamp?: number;
  source: string;
  sourceId?: string;
  cardId?: string;
  cardInstanceId?: string;
  card?: any;
  targetId?: string;
  isTrueDamage?: boolean;
  doubleDamage?: boolean;
}

export interface IAction {
  type: string;
  execute(state: GameState, queue: ActionQueue): void;
  setContext?(context: IActionContext): void;
}

export interface QueuedAction {
  id: ActionId;
  action: IAction;
  context: IActionContext;
  priority: number;
  timestamp: number;
  sequence: number;
}

export interface ActionQueueConfig {
  maxQueueSize: number;
  processingMode: 'sequential' | 'parallel';
  priorityOrder: 'fifo' | 'priority';
}

export const DEFAULT_ACTION_QUEUE_CONFIG: ActionQueueConfig = {
  maxQueueSize: 100,
  processingMode: 'sequential',
  priorityOrder: 'priority',
};

export class ActionQueue {
  private queue: QueuedAction[] = [];
  private config: ActionQueueConfig;
  private _state: 'idle' | 'processing' = 'idle';
  private _currentContext: IActionContext = { source: 'player' };
  private nextActionId = 1;
  private nextBackSequence = 0;
  private nextFrontSequence = -1;
  private callbacks: {
    onActionStart?: (queuedAction: QueuedAction, state: GameState) => void;
    onActionComplete?: (queuedAction: QueuedAction, state: GameState) => void;
    onQueueEmpty?: (state: GameState) => void;
  } = {};

  constructor(config: ActionQueueConfig = DEFAULT_ACTION_QUEUE_CONFIG) {
    this.config = config;
  }

  private createQueuedAction(action: IAction, context: IActionContext, priority: number, position: 'back' | 'front'): QueuedAction {
    return {
      id: `action_${this.nextActionId++}`,
      action,
      context,
      priority,
      timestamp: Date.now(),
      sequence: position === 'front' ? this.nextFrontSequence-- : this.nextBackSequence++,
    };
  }

  private sortQueue(): void {
    if (this.config.priorityOrder !== 'priority') {
      return;
    }
    this.queue.sort((a, b) => {
      const aIsFront = a.sequence < 0;
      const bIsFront = b.sequence < 0;
      if (aIsFront !== bIsFront) {
        return aIsFront ? -1 : 1;
      }
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      return a.sequence - b.sequence;
    });
  }

  private trimForCapacity(): void {
    if (this.queue.length >= this.config.maxQueueSize) {
      console.warn('Action queue is full, dropping oldest action');
      this.queue.shift();
    }
  }

  enqueue(action: IAction, context: IActionContext = { source: 'player' }, priority: number = 0): ActionId {
    const queuedAction = this.createQueuedAction(action, context, priority, 'back');

    this.trimForCapacity();

    this.queue.push(queuedAction);
    this.sortQueue();

    return queuedAction.id;
  }

  push(action: IAction, context: IActionContext = { source: 'player' }, priority: number = 0): ActionId {
    return this.enqueue(action, context, priority);
  }

  pushBack(action: IAction, context: IActionContext = { source: 'player' }, priority: number = 0): ActionId {
    const queuedAction = this.createQueuedAction(action, context, priority, 'back');

    this.trimForCapacity();
    this.queue.push(queuedAction);
    this.sortQueue();

    return queuedAction.id;
  }

  pushFront(action: IAction, context: IActionContext = { source: 'player' }, priority: number = 0): ActionId {
    const queuedAction = this.createQueuedAction(action, context, priority, 'front');

    this.trimForCapacity();
    this.queue.unshift(queuedAction);
    this.sortQueue();
    return queuedAction.id;
  }

  dequeue(): QueuedAction | null {
    return this.queue.shift() || null;
  }

  peek(): QueuedAction | null {
    return this.queue[0] || null;
  }

  clear(): void {
    this.queue = [];
  }

  size(): number {
    return this.queue.length;
  }

  isEmpty(): boolean {
    return this.queue.length === 0;
  }

  getAll(): QueuedAction[] {
    return [...this.queue];
  }

  getQueueSnapshot(): QueuedAction[] {
    return this.getAll();
  }

  setState(state: 'idle' | 'processing'): void {
    this._state = state;
  }

  get isProcessingQueue(): boolean {
    return this._state === 'processing';
  }

  get length(): number {
    return this.queue.length;
  }

  setCallbacks(callbacks: {
    onActionStart?: (queuedAction: QueuedAction, state: GameState) => void;
    onActionComplete?: (queuedAction: QueuedAction, state: GameState) => void;
    onQueueEmpty?: (state: GameState) => void;
  }): void {
    this.callbacks = callbacks;
  }

  processQueue(state: GameState): void {
    this._state = 'processing';

    while (this.queue.length > 0) {
      const queuedAction = this.dequeue();
      if (queuedAction) {
        this._currentContext = queuedAction.context;
        queuedAction.action.setContext?.(queuedAction.context);
        this.callbacks.onActionStart?.(queuedAction, state);
        queuedAction.action.execute(state, this);
        this.callbacks.onActionComplete?.(queuedAction, state);
      }
    }

    this._state = 'idle';
    this._currentContext = { source: 'player' };
    this.callbacks.onQueueEmpty?.(state);
  }

  processQueueSync(state: GameState): void {
    this.processQueue(state);
  }
}

export const globalActionQueue = new ActionQueue();
