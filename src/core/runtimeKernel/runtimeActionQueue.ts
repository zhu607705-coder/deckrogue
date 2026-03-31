export type RuntimeActionResult =
  | { type: 'continue' }
  | { type: 'stop'; handled: boolean; reason?: string };

export interface RuntimeAction<TContext> {
  name: string;
  execute(context: TContext): RuntimeActionResult;
}

export class RuntimeActionQueue<TContext> {
  private actions: RuntimeAction<TContext>[] = [];

  addAction(action: RuntimeAction<TContext>): void {
    this.actions.push(action);
  }

  addActions(actions: RuntimeAction<TContext>[]): void {
    this.actions.push(...actions);
  }

  clear(): void {
    this.actions = [];
  }

  execute(context: TContext): RuntimeActionResult {
    for (const action of this.actions) {
      const result = action.execute(context);
      if (result.type === 'stop') {
        return result;
      }
    }

    return { type: 'continue' };
  }
}
