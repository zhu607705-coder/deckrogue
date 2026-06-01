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

import { resolvePythonCommandCandidates, type PythonCommand } from '@/runtimeV2/node/pythonCommand';

const unittestArgs = ['-m', 'unittest', 'discover', '-s', 'python_runtime/tests', '-p', 'test_*.py'];
const candidates = resolvePythonCommandCandidates();

const env = {
  ...process.env,
  PYTHONPATH: [
    path.join(process.cwd(), 'python_runtime', 'src'),
    process.env.PYTHONPATH,
  ].filter(Boolean).join(path.delimiter),
};

let lastUnavailableCommand: string | null = null;
let pythonCommand: PythonCommand | null = null;

for (const candidate of candidates) {
  const result = spawnSync(candidate.command, [...candidate.argsPrefix, '--version'], {
    cwd: process.cwd(),
    encoding: 'utf-8',
    stdio: 'pipe',
  });

  if (result.error || result.status !== 0) {
    lastUnavailableCommand = candidate.command;
    continue;
  }

  pythonCommand = candidate;
  break;
}

if (!pythonCommand) {
  console.error(
    `Python runtime tests could not start: no usable Python executable found (${candidates.map((entry) => entry.command).join(', ')}).`
  );
  if (lastUnavailableCommand) {
    console.error(`Last unavailable command: ${lastUnavailableCommand}`);
  }
  process.exit(1);
}

const result = spawnSync(pythonCommand.command, [...pythonCommand.argsPrefix, ...unittestArgs], {
  cwd: process.cwd(),
  env,
  stdio: 'inherit',
});

if (result.error) {
  console.error(`Failed to start ${pythonCommand.command}:`, result.error.message);
  process.exit(1);
}

const exitCode = result.status ?? 1;
process.exit(exitCode);
