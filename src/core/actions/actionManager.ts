import { GameState, ActionSpec } from '@/core/types';
import { ActionQueue, IAction, IActionContext, QueuedAction } from '@/core/actions/actionQueue';
import { globalEventBus } from '@/core/events/eventBus';

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
    this.queue = new ActionQueue(state);
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
    this.queue.setCallbacks(
      (action, context) => this.onActionStart(action, context),
      (action, context) => this.onActionEnd(action, context)
    );
  }

  private onActionStart(action: IAction, context: IActionContext): void {
    this.currentContext = context;

    if (this.config.enableLogging) {
      console.log(`[ActionManager] Starting: ${action.type}`, context);
    }

    globalEventBus.publish({
      type: 'ActionStart',
      actionType: action.type,
      source: context.source
    } as any);
  }

  private onActionEnd(action: IAction, context: IActionContext): void {
    if (this.config.enableLogging) {
      console.log(`[ActionManager] Completed: ${action.type}`);
    }

    globalEventBus.publish({
      type: 'ActionEnd',
      actionType: action.type,
      source: context.source
    } as any);
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
    source: 'card' | 'relic' | 'synergy' | 'system' = 'card'
  ): void {
    const action = this.createAction(spec);
    this.queue.push(action, context, priority, source);
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
    source: 'card' | 'relic' | 'synergy' | 'system' = 'card'
  ): void {
    this.queue.push(action, context, priority, source);
  }

  enqueueFront(
    spec: ActionSpec,
    context: IActionContext,
    source: 'card' | 'relic' | 'synergy' | 'system' = 'system'
  ): void {
    const action = this.createAction(spec);
    this.queue.pushFront(action, context, source);
  }

  enqueueBack(
    spec: ActionSpec,
    context: IActionContext,
    source: 'card' | 'relic' | 'synergy' | 'system' = 'system'
  ): void {
    const action = this.createAction(spec);
    this.queue.pushBack(action, context, source);
  }

  enqueueUrgent(
    spec: ActionSpec,
    context: IActionContext,
    source: 'card' | 'relic' | 'synergy' | 'system' = 'relic'
  ): void {
    const action = this.createAction(spec);
    this.queue.pushFront(action, context, source);
  }

  enqueueUrgentAction(
    action: IAction,
    context: IActionContext,
    source: 'card' | 'relic' | 'synergy' | 'system' = 'relic'
  ): void {
    this.queue.pushFront(action, context, source);
  }

  async executeAll(): Promise<void> {
    await this.queue.processQueue();
  }

  executeAllSync(): void {
    this.queue.processQueueSync();
  }

  executeImmediate(spec: ActionSpec, context: IActionContext): void {
    const action = this.createAction(spec);
    this.currentContext = context;
    action.execute(this.state, this.queue);
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

  getQueueSnapshot(): Array<{ type: string; priority: number; source: string }> {
    return this.queue.getQueueSnapshot();
  }

  updateState(state: GameState): void {
    this.state = state;
    this.queue.setState(state);
  }

  getCurrentContext(): IActionContext {
    return this.currentContext;
  }
}

class NullAction implements IAction {
  readonly type = 'Null';
  
  constructor(private spec: ActionSpec) {}
  
  execute(): void {
    console.warn(`NullAction executed for unknown type: ${this.spec.type}`);
  }
}

export const createActionManager = (state: GameState, config?: Partial<ActionManagerConfig>): ActionManager => {
  globalActionManager = new ActionManager(state, config);
  return globalActionManager;
};

export const getActionManager = (): ActionManager | null => {
  return globalActionManager;
};

export const setActionManager = (manager: ActionManager): void => {
  globalActionManager = manager;
};
