/**
 * @file pythonWasmAdapter.ts
 * @description Pyodide WASM 适配器，在浏览器中通过 Pyodide 执行 Python 规则引擎
 *
 * 主要职责:
 * - 加载 Pyodide 运行时并初始化 Python 规则引擎
 * - 将 RuleCommand 转换为 Python 调用并返回 RuleSnapshot
 * - 处理键名 camelCase / snake_case 转换
 * - 管理适配器生命周期（启动、分发、销毁）
 */
import type { EngineHostStartOptions, RuleCommand, RuleRuntimeAdapter, RuleSnapshot } from '@/runtimeV2/contracts';
import { buildRuntimeV2ContentBundle } from '@/runtimeV2/content/buildContentBundle';
import { PYTHON_RUNTIME_CODE } from '@/content/narrative/pythonRuntime';
import {
  camelToSnakeKey,
  convertKeys,
  normalizePythonSnapshot,
  unwrapPythonSnapshotEnvelope,
} from '@/runtimeV2/pythonInterop';

interface PyodideInterface {
  globals: {
    set(name: string, value: unknown): void;
  };
  runPythonAsync(code: string): Promise<{
    toJs(): unknown;
  }>;
}

declare global {
  interface Window {
    loadPyodide?: (config: { indexURL: string }) => Promise<PyodideInterface>;
  }
}

const PYODIDE_INDEX_URL = 'https://cdn.jsdelivr.net/pyodide/v0.29.3/full/';
const PYODIDE_SCRIPT_URL = `${PYODIDE_INDEX_URL}pyodide.js`;
const PYODIDE_SCRIPT_REFERRER_POLICY = 'no-referrer';
export { normalizePythonSnapshot, unwrapPythonSnapshotEnvelope } from '@/runtimeV2/pythonInterop';

export class PythonWasmAdapter implements RuleRuntimeAdapter {
  readonly source = 'python-wasm' as const;
  private pyodide: PyodideInterface | null = null;
  private snapshot: RuleSnapshot | null = null;
  private initPromise: Promise<void> | null = null;

  async start(options: EngineHostStartOptions = {}): Promise<RuleSnapshot> {
    if (!this.pyodide) {
      await this.ensurePyodide();
    }

    if (!this.pyodide) {
      throw new Error('Failed to initialize Pyodide');
    }

    const contentBundle = buildRuntimeV2ContentBundle();
    const snakeBundle = convertKeys(contentBundle, camelToSnakeKey) as Record<string, unknown>;
    this.pyodide.globals.set('__deckrogue_content_bundle_json', JSON.stringify(snakeBundle));
    const result = await this.pyodide.runPythonAsync(
      `init_runtime(json.loads(__deckrogue_content_bundle_json), ${options.seed ?? 0})`
    );

    this.snapshot = normalizePythonSnapshot(unwrapPythonSnapshotEnvelope(result.toJs()));
    return this.snapshot;
  }

  async dispatch(command: RuleCommand): Promise<RuleSnapshot> {
    if (!this.snapshot) {
      await this.start();
    }

    if (!this.pyodide) {
      throw new Error('Pyodide not initialized');
    }

    const snakeCommand = convertKeys(command, camelToSnakeKey) as Record<string, unknown>;
    this.pyodide.globals.set('__deckrogue_command_json', JSON.stringify(snakeCommand));
    const result = await this.pyodide.runPythonAsync(
      `dispatch_command(json.loads(__deckrogue_command_json))`
    );

    this.snapshot = normalizePythonSnapshot(unwrapPythonSnapshotEnvelope(result.toJs()));
    return this.snapshot;
  }

  getSnapshot(): RuleSnapshot | null {
    return this.snapshot;
  }

  dispose(): void {
    this.snapshot = null;
    this.pyodide = null;
    this.initPromise = null;
  }

  private async ensurePyodide(): Promise<void> {
    if (this.pyodide) {
      return;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.loadPyodide();
    await this.initPromise;
  }

  private async loadPyodide(): Promise<void> {
    const loadPyodide = await this.resolveLoadPyodide();

    if (!loadPyodide) {
      throw new Error('Could not load Pyodide');
    }

    this.pyodide = await loadPyodide({ indexURL: PYODIDE_INDEX_URL });

    await this.pyodide.runPythonAsync(PYTHON_RUNTIME_CODE);
  }

  private async resolveLoadPyodide(): Promise<((config: { indexURL: string }) => Promise<PyodideInterface>) | undefined> {
    if (typeof window === 'undefined') {
      return undefined;
    }

    if (window.loadPyodide) {
      return window.loadPyodide;
    }

    await this.injectPyodideScript();
    return window.loadPyodide;
  }

  private async injectPyodideScript(): Promise<void> {
    const existingScript = document.querySelector<HTMLScriptElement>('script[data-pyodide-loader="true"]');
    if (existingScript) {
      if (window.loadPyodide) {
        return;
      }
      await new Promise<void>((resolve, reject) => {
        existingScript.addEventListener('load', () => resolve(), { once: true });
        existingScript.addEventListener('error', () => reject(new Error('Failed to load Pyodide loader script')), { once: true });
      });
      return;
    }

    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = PYODIDE_SCRIPT_URL;
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.referrerPolicy = PYODIDE_SCRIPT_REFERRER_POLICY;
      script.dataset.pyodideLoader = 'true';
      script.addEventListener('load', () => resolve(), { once: true });
      script.addEventListener('error', () => reject(new Error('Failed to load Pyodide loader script')), { once: true });
      document.head.appendChild(script);
    });
  }
}

export function createPythonWasmAdapter(): PythonWasmAdapter {
  return new PythonWasmAdapter();
}
