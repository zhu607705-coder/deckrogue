/**
 * @file runtimeActionQueue.ts
 * @description 运行时动作队列 - 通用队列实现，管理运行时动作的执行
 *
 * 主要职责:
 * - 定义 RuntimeAction 接口，描述可执行的运行时动作
 * - 实现 RuntimeActionQueue 类，提供添加、清空、执行等队列操作
 * - 支持动作序列的顺序执行和提前终止 (stop)
 * - 为游戏流程编排提供通用队列基础设施
 */
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
