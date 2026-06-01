/**
 * @file pythonCommand.test.ts
 * @description Regression tests for selecting a usable Python command on Windows.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { resolvePythonCommandCandidates, selectAvailablePythonCommand, type PythonCommand } from '@/runtimeV2/node/pythonCommand';

test('resolvePythonCommandCandidates keeps Windows py launcher before python fallback', () => {
  assert.deepEqual(resolvePythonCommandCandidates({}, 'win32'), [
    { command: 'py', argsPrefix: ['-3'] },
    { command: 'python', argsPrefix: [] },
    { command: 'python3', argsPrefix: [] },
  ]);
});

test('selectAvailablePythonCommand skips nonzero launchers before choosing python fallback', () => {
  const candidates: PythonCommand[] = [
    { command: 'py', argsPrefix: ['-3'] },
    { command: 'python', argsPrefix: [] },
  ];
  const probes: string[] = [];

  const selected = selectAvailablePythonCommand(candidates, (candidate) => {
    probes.push([candidate.command, ...candidate.argsPrefix].join(' '));
    return candidate.command === 'py'
      ? { status: 112 }
      : { status: 0 };
  });

  assert.deepEqual(selected, { command: 'python', argsPrefix: [] });
  assert.deepEqual(probes, ['py -3', 'python']);
});
