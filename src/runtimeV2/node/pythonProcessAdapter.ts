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
import type { EventEmitter } from 'node:events';
import type { Readable, Writable } from 'node:stream';
import path from 'node:path';
import readline from 'node:readline';

import { RunGenerator } from '@/core/events/runGenerator';
import type { EngineHostStartOptions, RuleCommand, RuleRuntimeAdapter, RuleSnapshot } from '@/runtimeV2/contracts';
import { buildRuntimeV2ContentBundle } from '@/runtimeV2/content/buildContentBundle';
import { camelToSnakeKey, convertKeys, normalizePythonSnapshot } from '@/runtimeV2/pythonInterop';

type PendingRequest = {
  requestId: string;
  resolve: (value: RuleSnapshot) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
};

type PythonProcessHandle = {
  stdin: Writable & { destroyed: boolean; writable: boolean };
  stdout: Readable;
  stderr: Pick<EventEmitter, 'on'>;
  kill: () => unknown;
  on: EventEmitter['on'];
};

export interface PythonProcessAdapterOptions {
  usePrebuiltMapNodes?: boolean;
  requestTimeoutMs?: number;
}

type PythonResponse = {
  requestId?: string;
  request_id?: string;
  ok: boolean;
  error?: string;
  snapshot?: Record<string, unknown>;
};

const runtimeV2ContentBundle = buildRuntimeV2ContentBundle();
const DEFAULT_REQUEST_TIMEOUT_MS = 10000;

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
  readonly source = 'python-process' as const;

  private process: PythonProcessHandle | null = null;
  private lineReader: readline.Interface | null = null;
  private pending: PendingRequest[] = [];
  private nextRequestId = 1;
  private stderrBuffer = '';
  private snapshot: RuleSnapshot | null = null;

  constructor(private readonly options: PythonProcessAdapterOptions = {}) {}

  static createForTesting(processHandle: PythonProcessHandle, options: PythonProcessAdapterOptions = {}): PythonProcessAdapter {
    const adapter = new PythonProcessAdapter(options);
    adapter.attachProcess(processHandle);
    return adapter;
  }

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
    this.attachProcess(this.process);

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

  private attachProcess(processHandle: PythonProcessHandle): void {
    this.process = processHandle;
    processHandle.stderr.on('data', (chunk: Buffer) => {
      this.stderrBuffer += chunk.toString();
    });
    processHandle.on('exit', (code, signal) => {
      const pending = this.pending.splice(0);
      for (const entry of pending) {
        clearTimeout(entry.timeout);
        entry.reject(
          new Error(`Python process exited unexpectedly (code=${code ?? 'null'}, signal=${signal ?? 'null'}): ${this.stderrBuffer}`),
        );
      }
    });

    this.lineReader = readline.createInterface({ input: processHandle.stdout });
    this.lineReader.on('line', (line) => {
      let response: PythonResponse;
      try {
        response = JSON.parse(line) as PythonResponse;
      } catch (error) {
        const pending = this.pending.shift();
        if (pending) {
          clearTimeout(pending.timeout);
          pending.reject(error instanceof Error ? error : new Error(String(error)));
        }
        return;
      }

      const responseRequestId = response.requestId ?? response.request_id;
      const pendingIndex = typeof responseRequestId === 'string'
        ? this.pending.findIndex((entry) => entry.requestId === responseRequestId)
        : 0;
      if (pendingIndex < 0 || pendingIndex >= this.pending.length) {
        return;
      }

      const [pending] = this.pending.splice(pendingIndex, 1);
      clearTimeout(pending.timeout);

      try {
        if (!response.ok || !response.snapshot) {
          pending.reject(new Error(response.error || this.stderrBuffer || 'Python runtime returned an invalid response'));
          return;
        }
        const snapshot = normalizePythonSnapshot(response.snapshot, {
          generatedAtFallback: () => new Date(0).toISOString(),
          adapter: this.source,
        });
        this.snapshot = snapshot;
        pending.resolve(snapshot);
      } catch (error) {
        pending.reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
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
      clearTimeout(entry.timeout);
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
      const processRef = this.process;
      if (!processRef || processRef.stdin.destroyed || !processRef.stdin.writable) {
        reject(new Error('Python process stdin is not writable'));
        return;
      }

      const timeoutMs = this.options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
      const requestId = `req_${this.nextRequestId++}`;
      const entry: PendingRequest = {
        requestId,
        resolve,
        reject,
        timeout: setTimeout(() => {
          const index = this.pending.indexOf(entry);
          if (index >= 0) {
            this.pending.splice(index, 1);
          }
          reject(new Error(`Python runtime request timed out after ${timeoutMs}ms`));
        }, timeoutMs),
      };

      this.pending.push(entry);

      const encodedPayload = `${JSON.stringify({ request_id: requestId, ...payload })}\n`;
      processRef.stdin.write(encodedPayload, 'utf8', (error) => {
        if (!error) return;

        const index = this.pending.indexOf(entry);
        if (index >= 0) {
          this.pending.splice(index, 1);
        }
        clearTimeout(entry.timeout);
        reject(error instanceof Error ? error : new Error(String(error)));
      });
    });
  }
}
