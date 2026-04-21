import { GameState, ActionSpec } from '@/core/types';
import { ActionQueue, IAction, IActionContext } from '@/core/actions/actionQueue';
import { globalEventBus } from '@/core/events/eventBus';

interface ActionStartEvent {
  type: 'ActionStart';
  actionId: string;
  sequence: number;
  actionType: string;
  source: string;
  sourceId?: string;
  targetId?: string;
  cardId?: string;
  cardInstanceId?: string;
}

interface ActionEndEvent {
  type: 'ActionEnd';
  actionId: string;
  sequence: number;
  actionType: string;
  source: string;
  sourceId?: string;
  targetId?: string;
  cardId?: string;
  cardInstanceId?: string;
}

export interface ActionManagerConfig {
  maxQueueSize: number;
  enableLogging: boolean;
  enableAnimationDelay: boolean;
}

let globalActionManager: ActionManager | null = null;

export class ActionManager {
  private queue: ActionQueue;
  private state: GameState;
  private config: ActionManagerConfig;
  private actionRegistry: Map<string, new (spec: ActionSpec) => IAction>;
  private currentContext: IActionContext = { source: 'player' };

  constructor(state: GameState, config?: Partial<ActionManagerConfig>) {
    this.state = state;
    this.queue = new ActionQueue({
      maxQueueSize: config?.maxQueueSize || 100,
      processingMode: 'sequential',
      priorityOrder: 'priority',
    });
    this.config = {
      maxQueueSize: 100,
      enableLogging: false,
      enableAnimationDelay: false,
      ...config
    };
    this.actionRegistry = new Map();

    this.setupQueueCallbacks();
  }

  private setupQueueCallbacks(): void {
    this.queue.setCallbacks({
      onActionStart: (queuedAction, _state: GameState) => {
        this.onActionStart(queuedAction.action, queuedAction.context, queuedAction.id, queuedAction.sequence);
      },
      onActionComplete: (queuedAction, _state: GameState) => {
        this.onActionEnd(queuedAction.action, queuedAction.context, queuedAction.id, queuedAction.sequence);
      },
      onQueueEmpty: () => {
        if (this.config.enableLogging) {
          console.log('[ActionManager] Queue empty');
        }
      },
    });
  }

  private onActionStart(action: IAction, context: IActionContext, actionId: string, sequence: number): void {
    this.currentContext = context;

    if (this.config.enableLogging) {
      console.log(`[ActionManager] Starting: ${action.type}`, context);
    }

    globalEventBus.publish({
      type: 'ActionStart',
      actionId,
      sequence,
      actionType: action.type,
      source: context.source,
      sourceId: context.sourceId,
      targetId: context.targetId,
      cardId: context.cardId,
      cardInstanceId: context.cardInstanceId
    } as ActionStartEvent);
  }

  private onActionEnd(action: IAction, context: IActionContext, actionId: string, sequence: number): void {
    this.currentContext = context;
    if (this.config.enableLogging) {
      console.log(`[ActionManager] Completed: ${action.type}`);
    }

    globalEventBus.publish({
      type: 'ActionEnd',
      actionId,
      sequence,
      actionType: action.type,
      source: context.source,
      sourceId: context.sourceId,
      targetId: context.targetId,
      cardId: context.cardId,
      cardInstanceId: context.cardInstanceId
    } as ActionEndEvent);
  }

  registerAction(type: string, actionClass: new (spec: ActionSpec) => IAction): void {
    this.actionRegistry.set(type, actionClass);
  }

  createAction(spec: ActionSpec): IAction {
    const ActionClass = this.actionRegistry.get(spec.type);
    if (!ActionClass) {
      console.warn(`ActionManager: Unknown action type: ${spec.type}`);
      return new NullAction(spec);
    }
    return new ActionClass(spec);
  }

  createActions(specs: ActionSpec[]): IAction[] {
    return specs.map(spec => this.createAction(spec));
  }

  enqueue(
    spec: ActionSpec,
    context: IActionContext,
    priority: number = 0,
    _source: 'card' | 'relic' | 'synergy' | 'system' = 'card'
  ): void {
    const action = this.createAction(spec);
    this.queue.push(action, context, priority);
  }

  enqueueAll(
    specs: ActionSpec[],
    context: IActionContext,
    priority: number = 0,
    source: 'card' | 'relic' | 'synergy' | 'system' = 'card'
  ): void {
    specs.forEach((spec, index) => {
      this.enqueue(spec, context, priority - index * 0.01, source);
    });
  }

  enqueueAction(
    action: IAction,
    context: IActionContext,
    priority: number = 0,
    _source: 'card' | 'relic' | 'synergy' | 'system' = 'card'
  ): void {
    this.queue.push(action, context, priority);
  }

  enqueueFront(
    spec: ActionSpec,
    context: IActionContext,
    _source: 'card' | 'relic' | 'synergy' | 'system' = 'system'
  ): void {
    const action = this.createAction(spec);
    this.queue.pushFront(action, context);
  }

  enqueueBack(
    spec: ActionSpec,
    context: IActionContext,
    _source: 'card' | 'relic' | 'synergy' | 'system' = 'system'
  ): void {
    const action = this.createAction(spec);
    this.queue.pushBack(action, context);
  }

  enqueueUrgent(
    spec: ActionSpec,
    context: IActionContext,
    source: 'card' | 'relic' | 'synergy' | 'system' = 'relic'
  ): void {
    this.enqueueFront(spec, context, source);
  }

  enqueueUrgentAction(
    action: IAction,
    context: IActionContext,
    _source: 'card' | 'relic' | 'synergy' | 'system' = 'relic'
  ): void {
    this.queue.pushFront(action, context);
  }

  executeAll(): void {
    this.queue.processQueue(this.state);
  }

  executeAllSync(): void {
    this.queue.processQueueSync(this.state);
  }

  executeImmediate(spec: ActionSpec, context: IActionContext): void {
    const action = this.createAction(spec);
    this.currentContext = context;
    try {
      action.execute(this.state, this.queue);
    } catch (error) {
      console.error(`[ActionManager] Action ${spec.type} execution failed:`, error);
    }
  }

  executeImmediateAll(specs: ActionSpec[], context: IActionContext): void {
    this.currentContext = context;
    specs.forEach(spec => this.executeImmediate(spec, context));
  }

  clearQueue(): void {
    this.queue.clear();
  }

  getQueueLength(): number {
    return this.queue.length;
  }

  isProcessing(): boolean {
    return this.queue.isProcessingQueue;
  }

  getQueueSnapshot(): Array<{ type: string; priority: number; sequence: number; source: string; sourceId?: string; targetId?: string; cardId?: string; cardInstanceId?: string }> {
    return this.queue.getQueueSnapshot().map(qa => ({
      type: qa.action.type,
      priority: qa.priority,
      sequence: qa.sequence,
      source: qa.context.source,
      sourceId: qa.context.sourceId,
      targetId: qa.context.targetId,
      cardId: qa.context.cardId,
      cardInstanceId: qa.context.cardInstanceId,
    }));
  }

  updateState(state: GameState): void {
    this.state = state;
  }

  getCurrentContext(): IActionContext {
    return this.currentContext;
  }

  static getInstance(state?: GameState): ActionManager {
    if (!globalActionManager && state) {
      globalActionManager = new ActionManager(state);
    }
    if (!globalActionManager) {
      throw new Error('ActionManager not initialized');
    }
    return globalActionManager;
  }

  static resetInstance(): void {
    globalActionManager = null;
  }

  static bindInstance(manager: ActionManager): ActionManager {
    globalActionManager = manager;
    return manager;
  }

  static clearIfCurrent(manager: ActionManager): void {
    if (globalActionManager === manager) {
      globalActionManager = null;
    }
  }
}

export function createActionManager(state: GameState, config?: Partial<ActionManagerConfig>): ActionManager {
  return ActionManager.bindInstance(new ActionManager(state, config));
}

export function getActionManager(): ActionManager {
  return ActionManager.getInstance();
}

class NullAction implements IAction {
  readonly type = 'Null';

  constructor(private spec: ActionSpec) {}

  execute(_state: GameState, _queue: ActionQueue): void {
    console.warn(`NullAction executed for spec: ${this.spec.type}`);
  }
}
