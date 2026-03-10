import { GameState } from '@/core/types';

export interface IAction {
  readonly type: string;
  execute(state: GameState, queue: ActionQueue): void | Promise<void>;
}

export interface IActionContext {
  source: 'player' | 'enemy' | 'system' | string;
  sourceId?: string;
  targetId?: string;
  cardId?: string;
  cardInstanceId?: string;
  card?: any;
  doubleDamage?: boolean;
  isTrueDamage?: boolean;
}

export interface QueuedAction {
  action: IAction;
  context: IActionContext;
  priority: number;
  source: 'card' | 'relic' | 'synergy' | 'system';
}

export type ActionQueueCallback = (action: IAction, context: IActionContext) => void;

export class ActionQueue {
  private queue: QueuedAction[] = [];
  private isProcessing: boolean = false;
  private onActionStart?: ActionQueueCallback;
  private onActionEnd?: ActionQueueCallback;
  private maxQueueSize: number = 100;
  private state: GameState | null = null;
  public _currentContext: IActionContext = { source: 'player' };

  constructor(state?: GameState) {
    this.state = state || null;
  }

  setState(state: GameState): void {
    this.state = state;
  }

  setCallbacks(onStart?: ActionQueueCallback, onEnd?: ActionQueueCallback): void {
    this.onActionStart = onStart;
    this.onActionEnd = onEnd;
  }

  push(
    action: IAction, 
    context: IActionContext, 
    priority: number = 0,
    source: 'card' | 'relic' | 'synergy' | 'system' = 'card'
  ): void {
    if (this.queue.length >= this.maxQueueSize) {
      console.warn('ActionQueue: Maximum queue size reached, dropping action');
      return;
    }

    const queuedAction: QueuedAction = { action, context, priority, source };
    
    const insertIndex = this.queue.findIndex(qa => qa.priority < priority);
    if (insertIndex === -1) {
      this.queue.push(queuedAction);
    } else {
      this.queue.splice(insertIndex, 0, queuedAction);
    }
  }

  pushFront(
    action: IAction, 
    context: IActionContext,
    source: 'card' | 'relic' | 'synergy' | 'system' = 'system'
  ): void {
    if (this.queue.length >= this.maxQueueSize) {
      console.warn('ActionQueue: Maximum queue size reached, dropping action');
      return;
    }

    const highestPriority = this.queue.length > 0 ? this.queue[0].priority + 1 : 100;
    this.push(action, context, highestPriority, source);
  }

  pushBack(
    action: IAction, 
    context: IActionContext,
    source: 'card' | 'relic' | 'synergy' | 'system' = 'system'
  ): void {
    const lowestPriority = this.queue.length > 0 ? this.queue[this.queue.length - 1].priority - 1 : 0;
    this.push(action, context, lowestPriority, source);
  }

  pop(): QueuedAction | undefined {
    return this.queue.shift();
  }

  peek(): QueuedAction | undefined {
    return this.queue[0];
  }

  clear(): void {
    this.queue = [];
  }

  get length(): number {
    return this.queue.length;
  }

  get isEmpty(): boolean {
    return this.queue.length === 0;
  }

  get isProcessingQueue(): boolean {
    return this.isProcessing;
  }

  async processQueue(): Promise<void> {
    if (this.isProcessing || !this.state) return;
    
    this.isProcessing = true;

    try {
      while (this.queue.length > 0 && this.state) {
        const queuedAction = this.queue.shift();
        if (!queuedAction) break;

        const { action, context } = queuedAction;

        this._currentContext = context;

        if (this.onActionStart) {
          this.onActionStart(action, context);
        }

        try {
          await action.execute(this.state, this);
        } catch (error) {
          console.error(`ActionQueue: Error executing action ${action.type}:`, error);
        }

        if (this.onActionEnd) {
          this.onActionEnd(action, context);
        }

        await this.yieldControl();
      }
    } finally {
      this.isProcessing = false;
    }
  }

  processQueueSync(): void {
    if (this.isProcessing || !this.state) return;
    
    this.isProcessing = true;

    try {
      while (this.queue.length > 0 && this.state) {
        const queuedAction = this.queue.shift();
        if (!queuedAction) break;

        const { action, context } = queuedAction;

        this._currentContext = context;

        if (this.onActionStart) {
          this.onActionStart(action, context);
        }

        try {
          action.execute(this.state, this);
        } catch (error) {
          console.error(`ActionQueue: Error executing action ${action.type}:`, error);
        }

        if (this.onActionEnd) {
          this.onActionEnd(action, context);
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private async yieldControl(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, 0));
  }

  getQueueSnapshot(): Array<{ type: string; priority: number; source: string }> {
    return this.queue.map(qa => ({
      type: qa.action.type,
      priority: qa.priority,
      source: qa.source
    }));
  }

  getCurrentContext(): IActionContext {
    return this._currentContext;
  }
}

export const globalActionQueue = new ActionQueue();
