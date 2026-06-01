#!/usr/bin/env node

/**
 * @file check_github_transport.ts
 * @description Read-only diagnostics for the DeckRogue GitHub SSH-over-443 transport setup.
 */

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

const CANONICAL_REMOTE_URL = 'git@github.com:zhu607705-coder/deckrogue.git';
const DIRECT_443_REMOTE_URL = 'ssh://git@ssh.github.com:443/zhu607705-coder/deckrogue.git';
const REMOTE_PROBE_LABEL = 'git remote get-url origin';
const DOC_PATH = path.join(process.cwd(), 'docs', 'environment', 'github-ssh-over-443.md');
const GIT_COMMAND = process.env.DECKROGUE_GIT_COMMAND || 'git';
const SSH_COMMAND = process.env.DECKROGUE_SSH_COMMAND || 'ssh';

type CheckStatus = 'pass' | 'fail';

interface CommandResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  status: number;
}

interface CheckResult {
  id: string;
  status: CheckStatus;
  message: string;
}

function run(command: string, args: string[]): CommandResult {
  const result = spawnSync(command, args, {
    encoding: 'utf-8',
    shell: /\.(?:cmd|bat)$/i.test(command),
  });
  const stdout = typeof result.stdout === 'string' ? result.stdout.trim() : '';
  const stderr = typeof result.stderr === 'string' ? result.stderr.trim() : '';
  return {
    ok: !result.error && result.status === 0,
    stdout,
    stderr: result.error ? result.error.message : stderr,
    status: result.status ?? 1,
  };
}

function parseSshConfig(output: string): Map<string, string[]> {
  const config = new Map<string, string[]>();
  for (const rawLine of output.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const spaceIndex = line.indexOf(' ');
    if (spaceIndex === -1) continue;
    const key = line.slice(0, spaceIndex).toLowerCase();
    const value = line.slice(spaceIndex + 1).trim();
    const values = config.get(key) ?? [];
    values.push(value);
    config.set(key, values);
  }
  return config;
}

function first(config: Map<string, string[]>, key: string): string {
  return config.get(key)?.[0] ?? '';
}

function getSshUserHome(parsedConfig: Map<string, string[]>): string {
  const knownHostsPath = first(parsedConfig, 'userknownhostsfile').split(/\s+/)[0];
  const marker = '/.ssh/';
  const markerIndex = knownHostsPath.toLowerCase().indexOf(marker);
  if (markerIndex > 0) {
    return knownHostsPath.slice(0, markerIndex).replaceAll('/', path.sep);
  }
  return homedir();
}

function normalizeSshIdentityPath(value: string, parsedConfig: Map<string, string[]>): string {
  if (value.startsWith('~/')) {
    return path.join(getSshUserHome(parsedConfig), value.slice(2));
  }
  return value;
}

function checkOriginRemote(): CheckResult {
  const remote = run(GIT_COMMAND, ['remote', 'get-url', 'origin']);
  if (!remote.ok) {
    return {
      id: 'origin_remote',
      status: 'fail',
      message: `${REMOTE_PROBE_LABEL} failed: ${remote.stderr || remote.stdout || `exit ${remote.status}`}`,
    };
  }

  if (remote.stdout === CANONICAL_REMOTE_URL || remote.stdout === DIRECT_443_REMOTE_URL) {
    return {
      id: 'origin_remote',
      status: 'pass',
      message: `origin is using an SSH GitHub transport: ${remote.stdout}`,
    };
  }

  return {
    id: 'origin_remote',
    status: 'fail',
    message: `origin is '${remote.stdout}'. Expected '${CANONICAL_REMOTE_URL}' after configuring SSH-over-443.`,
  };
}

function checkSshResolution(): CheckResult[] {
  const sshConfig = run(SSH_COMMAND, ['-G', 'github.com']);
  if (!sshConfig.ok) {
    return [
      {
        id: 'ssh_resolution',
        status: 'fail',
        message: `ssh -G github.com failed: ${sshConfig.stderr || sshConfig.stdout || `exit ${sshConfig.status}`}`,
      },
    ];
  }

  const parsed = parseSshConfig(sshConfig.stdout);
  const hostname = first(parsed, 'hostname');
  const port = first(parsed, 'port');
  const user = first(parsed, 'user');
  const identityFiles = (parsed.get('identityfile') ?? []).map((file) => normalizeSshIdentityPath(file, parsed));
  const existingIdentityFiles = identityFiles.filter((file) => existsSync(file));
  const results: CheckResult[] = [];

  results.push({
    id: 'ssh_host',
    status: hostname === 'ssh.github.com' ? 'pass' : 'fail',
    message: `github.com resolves to HostName ${hostname || '<missing>'}; expected ssh.github.com.`,
  });
  results.push({
    id: 'ssh_port',
    status: port === '443' ? 'pass' : 'fail',
    message: `github.com resolves to Port ${port || '<missing>'}; expected 443.`,
  });
  results.push({
    id: 'ssh_user',
    status: user === 'git' ? 'pass' : 'fail',
    message: `github.com resolves to User ${user || '<missing>'}; expected git.`,
  });
  results.push({
    id: 'ssh_identity',
    status: existingIdentityFiles.length > 0 ? 'pass' : 'fail',
    message: existingIdentityFiles.length > 0
      ? `found SSH identity file(s): ${existingIdentityFiles.join(', ')}`
      : `no configured identity file exists. Checked: ${identityFiles.join(', ') || '<none>'}`,
  });

  return results;
}

function checkDocs(): CheckResult {
  return {
    id: 'setup_docs',
    status: existsSync(DOC_PATH) ? 'pass' : 'fail',
    message: existsSync(DOC_PATH)
      ? 'setup guide exists at docs/environment/github-ssh-over-443.md'
      : 'missing setup guide: docs/environment/github-ssh-over-443.md',
  };
}

function main(): void {
  const checks = [
    checkOriginRemote(),
    ...checkSshResolution(),
    checkDocs(),
  ];
  const failures = checks.filter((check) => check.status === 'fail');

  for (const check of checks) {
    const prefix = check.status === 'pass' ? 'PASS' : 'FAIL';
    console.log(`[check_github_transport] ${prefix} ${check.id}: ${check.message}`);
  }

  if (failures.length > 0) {
    console.error(`[check_github_transport] ${failures.length} issue(s) found. See docs/environment/github-ssh-over-443.md`);
    process.exit(1);
  }

  console.log('[check_github_transport] OK');
}

main();
