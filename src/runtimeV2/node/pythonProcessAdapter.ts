/**
 * @file pythonProcessAdapter.ts
 * @description Python 子进程适配器，通过 Node.js 子进程与 Python 规则引擎通信
 *
 * 主要职责:
 * - 启动 Python 规则引擎子进程并管理生命周期
 * - 通过 stdin/stdout JSON 协议发送命令和接收快照
 * - 处理键名 camelCase / snake_case 转换
 * - 管理 pending 请求队列和错误处理
 */
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import path from 'node:path';
import readline from 'node:readline';

import { RunGenerator } from '@/core/events/runGenerator';
import type { EngineHostStartOptions, RuleCommand, RuleRuntimeAdapter, RuleSnapshot } from '@/runtimeV2/contracts';
import { buildRuntimeV2ContentBundle } from '@/runtimeV2/content/buildContentBundle';
import { camelToSnakeKey, convertKeys, normalizePythonSnapshot } from '@/runtimeV2/pythonInterop';

type PendingRequest = {
  resolve: (value: RuleSnapshot) => void;
  reject: (error: Error) => void;
};

export interface PythonProcessAdapterOptions {
  usePrebuiltMapNodes?: boolean;
}

type PythonResponse = {
  ok: boolean;
  error?: string;
  snapshot?: Record<string, unknown>;
};

const runtimeV2ContentBundle = buildRuntimeV2ContentBundle();

function resolvePythonCommand(): { command: string; argsPrefix: string[] } {
  if (process.env.PYTHON_BIN) {
    return { command: process.env.PYTHON_BIN, argsPrefix: [] };
  }
  if (process.platform === 'win32') {
    return { command: 'py', argsPrefix: ['-3'] };
  }
  return { command: 'python3', argsPrefix: [] };
}

function encodeCommand(command: RuleCommand): Record<string, unknown> {
  return convertKeys(command, camelToSnakeKey) as Record<string, unknown>;
}

export class PythonProcessAdapter implements RuleRuntimeAdapter {
  readonly source = 'python-wasm' as const;

  private process: ChildProcessWithoutNullStreams | null = null;
  private lineReader: readline.Interface | null = null;
  private pending: PendingRequest[] = [];
  private stderrBuffer = '';
  private snapshot: RuleSnapshot | null = null;

  constructor(private readonly options: PythonProcessAdapterOptions = {}) {}

  async start(options: EngineHostStartOptions = {}): Promise<RuleSnapshot> {
    this.dispose();

    const pythonCommand = resolvePythonCommand();
    const pythonSourcePath = path.resolve(process.cwd(), 'python_runtime/src');
    const env = {
      ...process.env,
      PYTHONPATH: process.env.PYTHONPATH
        ? `${pythonSourcePath}${path.delimiter}${process.env.PYTHONPATH}`
        : pythonSourcePath,
    };

    this.process = spawn(pythonCommand.command, [...pythonCommand.argsPrefix, '-m', 'deckrogue_rules_core.cli'], {
      cwd: process.cwd(),
      env,
      stdio: 'pipe',
    });

    this.process.stderr.on('data', (chunk: Buffer) => {
      this.stderrBuffer += chunk.toString();
    });
    this.process.on('exit', (code, signal) => {
      const pending = this.pending.splice(0);
      for (const entry of pending) {
        entry.reject(
          new Error(`Python process exited unexpectedly (code=${code ?? 'null'}, signal=${signal ?? 'null'}): ${this.stderrBuffer}`),
        );
      }
    });

    this.lineReader = readline.createInterface({ input: this.process.stdout });
    this.lineReader.on('line', (line) => {
      const pending = this.pending.shift();
      if (!pending) {
        return;
      }

      try {
        const response = JSON.parse(line) as PythonResponse;
        if (!response.ok || !response.snapshot) {
          pending.reject(new Error(response.error || this.stderrBuffer || 'Python runtime returned an invalid response'));
          return;
        }
        const snapshot = normalizePythonSnapshot(response.snapshot, {
          generatedAtFallback: () => new Date(0).toISOString(),
        });
        this.snapshot = snapshot;
        pending.resolve(snapshot);
      } catch (error) {
        pending.reject(error instanceof Error ? error : new Error(String(error)));
      }
    });

    const contentBundle = buildRuntimeV2ContentBundle();
    const prebuiltNodes =
      this.options.usePrebuiltMapNodes === true
        ? new RunGenerator(options.seed ?? 0).generateMap(options.seed ?? 0, contentBundle.map.floors).map((node) => ({
            id: node.id,
            type: node.type,
            x: node.x,
            y: node.y,
            revealed: !!node.revealed,
            next: [...node.next],
          }))
        : undefined;

    this.snapshot = await this.sendRequest({
      op: 'init',
      seed: options.seed ?? 0,
      content_bundle: {
        ...contentBundle,
        map: {
          ...contentBundle.map,
          ...(prebuiltNodes ? { prebuilt_nodes: prebuiltNodes } : {}),
        },
      },
    });
    return this.snapshot;
  }

  async dispatch(command: RuleCommand): Promise<RuleSnapshot> {
    if (!this.process) {
      await this.start();
    }
    return this.sendRequest({
      op: 'dispatch',
      command: encodeCommand(command),
    });
  }

  getSnapshot(): RuleSnapshot | null {
    return this.snapshot;
  }

  dispose(): void {
    if (this.lineReader) {
      this.lineReader.close();
      this.lineReader = null;
    }
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
    const pending = this.pending.splice(0);
    for (const entry of pending) {
      entry.reject(new Error('Python process adapter disposed'));
    }
    this.stderrBuffer = '';
    this.snapshot = null;
  }

  private sendRequest(payload: Record<string, unknown>): Promise<RuleSnapshot> {
    if (!this.process) {
      return Promise.reject(new Error('Python process has not been started'));
    }

    return new Promise<RuleSnapshot>((resolve, reject) => {
      this.pending.push({ resolve, reject });
      this.process!.stdin.write(JSON.stringify(payload) + '\n', 'utf8');
    });
  }
}
