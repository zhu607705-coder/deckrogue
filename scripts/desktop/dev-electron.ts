#!/usr/bin/env node
/**
 * @file dev-electron.ts
 * @description Launches the development server and Electron app for desktop development.
 *
 * 主要职责:
 * - 启动 Vite 开发服务器
 * - 并行启动 Electron 应用
 * - 处理进程生命周期管理
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const require = createRequire(import.meta.url);
const viteCli = path.join(path.dirname(require.resolve('vite/package.json')), 'bin', 'vite.js');
const electronBinary = require('electron') as string;
const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://127.0.0.1:3000';

function spawnChild(command: string, args: string[], extraEnv: Record<string, string> = {}): ChildProcess {
  return spawn(command, args, {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: {
      ...process.env,
      ...extraEnv,
    },
  });
}

async function waitForServer(url: string) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      const response = await fetch(url, { method: 'GET' });
      if (response.ok) {
        return;
      }
    } catch {}
    await delay(500);
  }
  throw new Error(`Desktop dev server did not become ready at ${url}`);
}

async function main() {
  const viteProcess = spawnChild(process.execPath, [
    viteCli,
    '--port=3000',
    '--host=127.0.0.1',
  ]);

  const cleanup = () => {
    if (!viteProcess.killed) {
      viteProcess.kill('SIGTERM');
    }
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  process.on('exit', cleanup);

  try {
    await waitForServer(devServerUrl);
  } catch (error) {
    cleanup();
    throw error;
  }

  const electronProcess = spawnChild(electronBinary, ['electron/main.mjs'], {
    VITE_DEV_SERVER_URL: devServerUrl,
    DECKROGUE_DESKTOP_ENTRY_MODE: 'legacy',
  });

  electronProcess.on('exit', (code) => {
    cleanup();
    process.exit(code ?? 0);
  });
}

main().catch((error) => {
  console.error('[dev:desktop] failed:', error);
  process.exit(1);
});
