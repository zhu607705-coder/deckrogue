import { spawnSync } from 'node:child_process';

export type PythonCommand = {
  command: string;
  argsPrefix: string[];
};

export type PythonCommandProbeResult = {
  error?: unknown;
  status: number | null;
};

export function resolvePythonCommandCandidates(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): PythonCommand[] {
  const candidates: PythonCommand[] = [];
  if (env.PYTHON_BIN) {
    candidates.push({ command: env.PYTHON_BIN, argsPrefix: [] });
  }

  if (platform === 'win32') {
    candidates.push(
      { command: 'py', argsPrefix: ['-3'] },
      { command: 'python', argsPrefix: [] },
      { command: 'python3', argsPrefix: [] },
    );
    return candidates;
  }

  candidates.push(
    { command: 'python3', argsPrefix: [] },
    { command: 'python', argsPrefix: [] },
  );
  return candidates;
}

export function selectAvailablePythonCommand(
  candidates: PythonCommand[],
  probe: (candidate: PythonCommand) => PythonCommandProbeResult,
): PythonCommand {
  for (const candidate of candidates) {
    const result = probe(candidate);
    if (result.error || result.status !== 0) {
      continue;
    }
    return candidate;
  }

  throw new Error(
    `No usable Python executable found (${candidates.map((entry) => entry.command).join(', ')})`,
  );
}

export function resolveAvailablePythonCommand(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): PythonCommand {
  const candidates = resolvePythonCommandCandidates(env, platform);
  return selectAvailablePythonCommand(candidates, (candidate) => {
    const result = spawnSync(candidate.command, [...candidate.argsPrefix, '--version'], {
      encoding: 'utf-8',
      stdio: 'pipe',
    });
    return { error: result.error, status: result.status };
  });
}
