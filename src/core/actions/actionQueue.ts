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
  private callbacks: {
    onActionComplete?: (action: IAction, state: GameState) => void;
    onQueueEmpty?: (state: GameState) => void;
  } = {};

  constructor(config: ActionQueueConfig = DEFAULT_ACTION_QUEUE_CONFIG) {
    this.config = config;
  }

  enqueue(action: IAction, context: IActionContext = { source: 'player' }, priority: number = 0): ActionId {
    const id = `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const queuedAction: QueuedAction = {
      id,
      action,
      context,
      priority,
      timestamp: Date.now(),
    };

    if (this.queue.length >= this.config.maxQueueSize) {
      console.warn('Action queue is full, dropping oldest action');
      this.queue.shift();
    }

    this.queue.push(queuedAction);

    if (this.config.priorityOrder === 'priority') {
      this.queue.sort((a, b) => b.priority - a.priority);
    }

    return id;
  }

  push(action: IAction, context: IActionContext = { source: 'player' }, priority: number = 0): ActionId {
    return this.enqueue(action, context, priority);
  }

  pushBack(action: IAction, context: IActionContext = { source: 'player' }, priority: number = 0): ActionId {
    const id = `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const queuedAction: QueuedAction = {
      id,
      action,
      context,
      priority,
      timestamp: Date.now(),
    };

    this.queue.push(queuedAction);
    return id;
  }

  pushFront(action: IAction, context: IActionContext = { source: 'player' }, priority: number = 0): ActionId {
    const id = `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const queuedAction: QueuedAction = {
      id,
      action,
      context,
      priority,
      timestamp: Date.now(),
    };

    this.queue.unshift(queuedAction);
    return id;
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
    onActionComplete?: (action: IAction, state: GameState) => void;
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
        queuedAction.action.execute(state, this);
        this.callbacks.onActionComplete?.(queuedAction.action, state);
      }
    }
    
    this._state = 'idle';
    this.callbacks.onQueueEmpty?.(state);
  }

  processQueueSync(state: GameState): void {
    this.processQueue(state);
  }
}

export const globalActionQueue = new ActionQueue();
