import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

const REQUIRED_READMES = [
  'README.md',
  'src/README.md',
  'src/core/README.md',
  'src/core/combat/README.md',
  'src/core/actions/README.md',
  'src/core/balance/README.md',
  'src/core/events/README.md',
  'src/core/persistence/README.md',
  'src/features/README.md',
  'src/features/achievements/README.md',
  'src/features/relics/README.md',
  'src/features/synergies/README.md',
  'src/features/progression/README.md',
  'src/content/README.md',
  'src/content/data/README.md',
  'src/content/narrative/README.md',
  'src/ui/README.md',
  'src/ui/views/README.md',
  'src/ui/overlays/README.md',
  'src/ui/components/README.md',
  'src/ui/theme/README.md',
  'src/infrastructure/README.md',
  'src/infrastructure/rng/README.md',
  'docs/README.md',
  'docs/architecture/README.md',
  'docs/guides/README.md',
  'docs/plans/README.md',
  'docs/incidents/README.md',
  'docs/design/README.md',
  'scripts/README.md',
  'scripts/analysis/README.md',
  'scripts/validation/README.md',
  'scripts/assets/README.md',
  'tests/README.md',
  'tests/unit/README.md',
  'public/README.md',
  'output/README.md'
];

const REQUIRED_SECTIONS = [
  '1. 功能职责',
  '2. 核心边界',
  '3. 主要文件清单',
  '4. 模块关系',
  '5. ',
  '6. 对外接口',
  '7. 约束与禁忌',
  '8. 迁移与兼容',
  '9. 测试入口'
];

interface Problem {
  file: string;
  reason: string;
}

function main(): void {
  const problems: Problem[] = [];

  for (const rel of REQUIRED_READMES) {
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) {
      problems.push({ file: rel, reason: 'Missing README file.' });
      continue;
    }

    const content = fs.readFileSync(abs, 'utf8');

    for (const section of REQUIRED_SECTIONS) {
      if (!content.includes(section)) {
        problems.push({ file: rel, reason: `Missing section marker: '${section}'` });
      }
    }

    const codeRefs = [...content.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
    for (const ref of codeRefs) {
      if (!ref.startsWith('src/')) continue;
      const candidate = path.join(ROOT, ref);
      if (!fs.existsSync(candidate)) {
        problems.push({ file: rel, reason: `Referenced path does not exist: ${ref}` });
      }
    }
  }

  if (problems.length > 0) {
    console.error(`\n[check_readme_consistency] Found ${problems.length} issue(s):`);
    for (const p of problems) {
      console.error(`- ${p.file}: ${p.reason}`);
    }
    process.exit(1);
  }

  console.log('[check_readme_consistency] OK');
}

main();
