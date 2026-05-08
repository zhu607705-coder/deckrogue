/**
 * @file review_ci.ts
 * @description CI 评审脚本，执行类型检查、构建、测试和诊断的完整流程
 *
 * 主要职责:
 * - 按顺序执行类型检查、构建、损坏测试、数值诊断和死文件扫描
 * - 为 CI 流程提供统一的验证入口
 */

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..', '..');
const PACKAGE_JSON = path.join(ROOT, 'package.json');

if (!existsSync(PACKAGE_JSON)) {
  throw new Error(`Invalid project root: ${ROOT}`);
}

type Step = {
  name: string;
  cmd: string;
  args: string[];
};

const steps: Step[] = [
  { name: 'Type Check', cmd: 'npm', args: ['run', 'lint'] },
  { name: 'Build', cmd: 'npm', args: ['run', 'build'] },
  { name: 'Damage Tests', cmd: 'npm', args: ['run', 'test:damage'] },
  { name: 'Numeric Diagnostics', cmd: 'npm', args: ['run', 'diag:numeric', '--', '--runs=1', '--floors=1', '--turns=3', '--class=informant'] },
  { name: 'Dead File Scan (CI)', cmd: 'npm', args: ['run', 'scan:dead', '--', '--ci'] },
];

function runStep(step: Step): void {
  console.log(`\n=== ${step.name} ===`);
  console.log(`$ ${step.cmd} ${step.args.join(' ')}`);
  const result = spawnSync(step.cmd, step.args, {
    cwd: ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: process.env,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function main(): void {
  for (const step of steps) runStep(step);
  console.log('\nAll review checks passed.');
}

main();

