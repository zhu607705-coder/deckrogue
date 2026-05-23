/**
 * @file runtimeV2ContractDocs.test.ts
 * @description Runtime V2 contract documentation must not advertise missing files or scripts.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const CONTRACT_DOCS = [
  'docs/contracts/runtime-v2.md',
  'docs/contracts/acceptance-v2.md',
] as const;

const packageJson = JSON.parse(readFileSync('package.json', 'utf-8')) as {
  scripts?: Record<string, string>;
};

function canResolveRepoPath(ref: string): boolean {
  const normalized = ref.replace(/\\/g, '/');
  const candidates = [
    normalized,
    `${normalized}.ts`,
    `${normalized}.tsx`,
    `${normalized}.js`,
    `${normalized}.mjs`,
    `${normalized}/index.ts`,
    `${normalized}/index.tsx`,
  ];
  return candidates.some((candidate) => existsSync(path.resolve(candidate)));
}

function collectMissingReferences(docPath: string): string[] {
  const content = readFileSync(docPath, 'utf-8');
  const missing: string[] = [];
  const backtickRefs = [...content.matchAll(/`([^`]+)`/g)].map((match) => match[1]);

  for (const ref of backtickRefs) {
    if (!/^(src|scripts|tests|docs|public|python_runtime)\//.test(ref)) {
      continue;
    }
    if (!canResolveRepoPath(ref)) {
      missing.push(`${docPath}: missing path ${ref}`);
    }
  }

  const scriptRefs = [...content.matchAll(/npm run ([^\s`]+)/g)].map((match) => match[1]);
  for (const scriptName of scriptRefs) {
    if (!packageJson.scripts?.[scriptName]) {
      missing.push(`${docPath}: missing npm script ${scriptName}`);
    }
  }

  return missing;
}

test('runtime V2 contract docs only reference live files and npm scripts', () => {
  const missing = CONTRACT_DOCS.flatMap((docPath) => collectMissingReferences(docPath));
  assert.deepEqual(missing, []);
});
