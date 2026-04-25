#!/usr/bin/env node
/**
 * @file run_python_runtime_tests.ts
 * @description Runs Python runtime unit tests with a cross-platform PYTHONPATH setup.
 *
 * Main responsibilities:
 * - Resolve a local Python executable on Windows, macOS, and Linux.
 * - Provide python_runtime/src on PYTHONPATH without POSIX-only inline env syntax.
 * - Preserve unittest exit codes for npm and doctor diagnostics.
 */

import { spawnSync } from 'node:child_process';
import path from 'node:path';

const unittestArgs = ['-m', 'unittest', 'discover', '-s', 'python_runtime/tests', '-p', 'test_*.py'];
const candidates = process.platform === 'win32'
  ? [
      { command: 'py', args: ['-3', ...unittestArgs] },
      { command: 'python', args: unittestArgs },
      { command: 'python3', args: unittestArgs },
    ]
  : [
      { command: 'python3', args: unittestArgs },
      { command: 'python', args: unittestArgs },
    ];

const env = {
  ...process.env,
  PYTHONPATH: [
    path.join(process.cwd(), 'python_runtime', 'src'),
    process.env.PYTHONPATH,
  ].filter(Boolean).join(path.delimiter),
};

let lastMissingCommand: string | null = null;

for (const candidate of candidates) {
  const result = spawnSync(candidate.command, candidate.args, {
    cwd: process.cwd(),
    env,
    stdio: 'inherit',
  });

  if (result.error && (result.error as NodeJS.ErrnoException).code === 'ENOENT') {
    lastMissingCommand = candidate.command;
    continue;
  }

  if (result.error) {
    console.error(`Failed to start ${candidate.command}:`, result.error.message);
    process.exit(1);
  }

  process.exit(result.status ?? 1);
}

console.error(
  `Python runtime tests could not start: no Python executable found (${candidates.map((entry) => entry.command).join(', ')}).`
);
if (lastMissingCommand) {
  console.error(`Last missing command: ${lastMissingCommand}`);
}
process.exit(1);
