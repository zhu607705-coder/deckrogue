#!/usr/bin/env node

/**
 * @file translation_audit.ts
 * @description 审计游戏内容的翻译质量，检测英文残留和术语冲突。
 *
 * 主要职责:
 * - 扫描卡牌、遗物、药水、成就数据的中文翻译
 * - 检测英文残留和术语冲突
 * - 生成翻译审计报告
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { join, relative, resolve } from 'path';
import { pathToFileURL } from 'url';
import cardsData from '@/content/data/cards.json';
import relicsData from '@/content/data/relics.json';
import potionsData from '@/content/data/potions.json';
import achievementsData from '@/content/data/achievements.json';
import { getUiLabelZh } from '@/ui/content/terminology';

type AuditItem = {
  file: string;
  line?: number;
  id?: string;
  kind: 'english-residue' | 'terminology-conflict' | 'semantic-warning';
  message: string;
  excerpt: string;
};

type CardRecord = {
  id: string;
  name?: string;
  text?: string;
  upgrade?: {
    name?: string;
    text?: string;
  };
};

type DataRecord = {
  id?: string;
  [key: string]: unknown;
};

export type AuditDataFieldConfig = {
  path: string;
  label: string;
  transform?: (value: string, record: DataRecord) => string;
};

const UI_SCAN_ROOTS = ['src'];
const RUNTIME_COPY_FILES = ['src/core/actions/v2/SpecialActions.ts'];

const ENGLISH_COPY_PATTERN = /\b(?:Achievements|Unlocks|Starting Relic|Recovery Draft|Atmosphere|Decision Rule|Narrative Event|Field Record|Decision|Execution Registry|Launch Sequence|Version State|Archive|Mission Archive|Martyr Archive|Codex|Option|Continue|New Run|Meta State|Forbidden Contract|Event Log|Intent|Stable|Warp Stable|WARP BOILING|Floor|Initialization Error|Retry|Initializing DeckRogue|Failed to initialize game|Warp Tide|Peril|Loading|Warp Echoes|Final Vox-Log|Meta Settlement|Debrief)\b/;

const TERMINOLOGY_CONFLICTS = [
  { pattern: /情报搜集/g, preferred: '收集情报' },
  { pattern: /虔诚/g, preferred: '虔敬' },
  { pattern: /敌人/g, preferred: '异端（战斗语境）' },
  { pattern: /['"`](Self|Enemy|RandomEnemy|AllEnemies)['"`]/g, preferred: '统一中文目标类型' }
];

const SEMANTIC_WARNINGS = [
  { pattern: /只负责一件事：.*?一件事：/g, note: '同一段重复定义页面职责' },
  { pattern: /Gain 1 Intel\. Draw 2 cards\./g, note: '英文卡牌正文仍未进入统一中文链路' }
];

function pushLineMatches(items: AuditItem[], file: string, source: string) {
  const lines = source.split('\n');
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    const sanitizedLine = line.replace(/getUiLabelZh\(['"][^'"]+['"]\)/g, '');
    const isCommentOnly =
      trimmed.startsWith('//') ||
      trimmed.startsWith('/*') ||
      trimmed.startsWith('*') ||
      trimmed.startsWith('{/*');
    const isCodeKeyOnly =
      /(?:const|type|interface)\s/.test(trimmed) ||
      /:\s*['"](Enemy|Self|RandomEnemy|AllEnemies)['"]/.test(trimmed) ||
      /['"](Enemy|Self|RandomEnemy|AllEnemies)['"]\s*:/.test(trimmed) ||
      /\.targeting\s*===\s*['"](Enemy|Self|RandomEnemy|AllEnemies)['"]/.test(trimmed) ||
      /getCardTargetingZh\(/.test(trimmed) ||
      /import\s/.test(trimmed);

    if (isCommentOnly || isCodeKeyOnly) {
      return;
    }

    if (ENGLISH_COPY_PATTERN.test(sanitizedLine)) {
      items.push({
        file,
        line: index + 1,
        kind: 'english-residue',
        message: '高频 UI 文案中仍有英文残留',
        excerpt: trimmed
      });
    }
    for (const conflict of TERMINOLOGY_CONFLICTS) {
      if (conflict.pattern.test(line)) {
        items.push({
          file,
          line: index + 1,
          kind: 'terminology-conflict',
          message: `术语未统一，建议收口为：${conflict.preferred}`,
          excerpt: trimmed
        });
      }
      conflict.pattern.lastIndex = 0;
    }
    for (const warning of SEMANTIC_WARNINGS) {
      if (warning.pattern.test(line)) {
        items.push({
          file,
          line: index + 1,
          kind: 'semantic-warning',
          message: warning.note,
          excerpt: trimmed
        });
      }
      warning.pattern.lastIndex = 0;
    }
    ENGLISH_COPY_PATTERN.lastIndex = 0;
  });
}

function pushRuntimeCopyMatches(items: AuditItem[], file: string, source: string) {
  const literalPattern = /(["'`])((?:\\.|(?!\1).)*)\1/g;
  let match: RegExpExecArray | null;

  while ((match = literalPattern.exec(source))) {
    const value = match[2];
    let visibleValue = value;
    let previousValue = '';
    while (visibleValue !== previousValue) {
      previousValue = visibleValue;
      visibleValue = visibleValue.replace(/\$\{[^{}]*\}/g, '');
    }
    visibleValue = visibleValue.trim();
    if (!/[A-Za-z]{3,}/.test(visibleValue) || !/\s/.test(visibleValue)) {
      continue;
    }
    if (!ENGLISH_COPY_PATTERN.test(visibleValue) && !/[A-Za-z]{3,}.*[.!?]/.test(visibleValue)) {
      continue;
    }
    const precedingSource = source.slice(0, match.index);
    const line = precedingSource.split('\n').length;
    items.push({
      file,
      line,
      kind: 'english-residue',
      message: '运行时可见文案中仍有英文残留',
      excerpt: value.trim()
    });
    ENGLISH_COPY_PATTERN.lastIndex = 0;
  }
}

function collectUiFiles(): string[] {
  const files = new Set<string>();

  function walk(target: string) {
    const abs = resolve(target);
    if (!existsSync(abs)) return;
    const stats = statSync(abs);
    if (stats.isDirectory()) {
      for (const entry of readdirSync(abs, { withFileTypes: true })) {
        walk(join(target, entry.name));
      }
      return;
    }

    if (/\.tsx$/.test(target) || target === 'src/main.tsx') {
      files.add(target);
    }
  }

  for (const root of UI_SCAN_ROOTS) {
    walk(root);
  }

  return [...files].sort();
}

function pushCardMatches(items: AuditItem[], cards: CardRecord[]) {
  for (const card of cards) {
    const textFields = [
      { label: 'name', value: card.name || '' },
      { label: 'text', value: card.text || '' },
      { label: 'upgrade.name', value: card.upgrade?.name || '' },
      { label: 'upgrade.text', value: card.upgrade?.text || '' }
    ];
    const englishField = textFields.find((field) => /[A-Za-z]{3,}/.test(field.value));
    if (englishField) {
      items.push({
        file: 'src/content/data/cards.json',
        id: card.id,
        kind: 'english-residue',
        message: `卡牌 ${englishField.label} 仍含英文残留`,
        excerpt: englishField.value.trim()
      });
    }
    if (/情报搜集/.test(card.name || '') || /情报搜集/.test(card.upgrade?.name || '')) {
      items.push({
        file: 'src/content/data/cards.json',
        id: card.id,
        kind: 'terminology-conflict',
        message: '卡牌名称与当前统一术语“收集情报”不一致',
        excerpt: `${card.name || ''} | ${card.upgrade?.name || ''}`.trim()
      });
    }
  }
}

function readPathValue(record: DataRecord, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    if (current == null || typeof current !== 'object') return undefined;
    return (current as Record<string, unknown>)[key];
  }, record);
}

export function auditDataRecords(file: string, records: DataRecord[], fields: AuditDataFieldConfig[]): AuditItem[] {
  const items: AuditItem[] = [];
  for (const record of records) {
    for (const field of fields) {
      const rawValue = readPathValue(record, field.path);
      const normalizedValue = typeof rawValue === 'string' ? rawValue.trim() : '';
      const value = normalizedValue ? (field.transform ? field.transform(normalizedValue, record).trim() : normalizedValue) : '';
      if (!value) continue;

      if (/[A-Za-z]{3,}/.test(value)) {
        items.push({
          file,
          id: record.id,
          kind: 'english-residue',
          message: `${field.label} 仍含英文残留`,
          excerpt: value,
        });
      }

      for (const conflict of TERMINOLOGY_CONFLICTS) {
        if (conflict.pattern.test(value)) {
          items.push({
            file,
            id: record.id,
            kind: 'terminology-conflict',
            message: `${field.label} 术语未统一，建议收口为：${conflict.preferred}`,
            excerpt: value,
          });
        }
        conflict.pattern.lastIndex = 0;
      }

      for (const warning of SEMANTIC_WARNINGS) {
        if (warning.pattern.test(value)) {
          items.push({
            file,
            id: record.id,
            kind: 'semantic-warning',
            message: `${field.label} ${warning.note}`,
            excerpt: value,
          });
        }
        warning.pattern.lastIndex = 0;
      }
    }
  }
  return items;
}

function getAllowedCount(name: string): number {
  const raw = process.env[name];
  if (!raw) return 0;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function buildAudit() {
  const items: AuditItem[] = [];
  for (const file of collectUiFiles()) {
    const abs = resolve(file);
    const source = readFileSync(abs, 'utf-8');
    pushLineMatches(items, relative(process.cwd(), abs), source);
  }
  for (const file of RUNTIME_COPY_FILES) {
    const abs = resolve(file);
    if (!existsSync(abs)) continue;
    pushRuntimeCopyMatches(items, relative(process.cwd(), abs), readFileSync(abs, 'utf-8'));
  }
  pushCardMatches(items, cardsData as CardRecord[]);
  items.push(
    ...auditDataRecords('src/content/data/relics.json', relicsData as DataRecord[], [
      { path: 'name', label: '遗物名称' },
      { path: 'description', label: '遗物描述' },
      { path: 'trigger', label: '遗物触发词', transform: (value) => getUiLabelZh(value) },
      { path: 'inscription', label: '遗物铭文' },
      { path: 'flavorText', label: '遗物风味文本' },
    ]),
  );
  items.push(
    ...auditDataRecords('src/content/data/potions.json', potionsData as DataRecord[], [
      { path: 'name', label: '药水名称' },
      { path: 'description', label: '药水描述' },
    ]),
  );
  items.push(
    ...auditDataRecords('src/content/data/achievements.json', achievementsData as DataRecord[], [
      { path: 'title', label: '成就标题' },
      { path: 'description', label: '成就描述' },
    ]),
  );
  return items;
}

export function main() {
  const items = buildAudit();
  const summary = {
    total: items.length,
    englishResidue: items.filter((item) => item.kind === 'english-residue').length,
    terminologyConflict: items.filter((item) => item.kind === 'terminology-conflict').length,
    semanticWarning: items.filter((item) => item.kind === 'semantic-warning').length
  };

  const report = {
    timestamp: new Date().toISOString(),
    summary,
    items
  };

  const reportDir = resolve('reports/translation');
  mkdirSync(reportDir, { recursive: true });
  const reportPath = resolve(reportDir, 'translation-audit.json');
  writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log('=== 文本审校报告 ===\n');
  console.log(`总计: ${summary.total}`);
  console.log(`- 英文残留: ${summary.englishResidue}`);
  console.log(`- 术语冲突: ${summary.terminologyConflict}`);
  console.log(`- 表意警告: ${summary.semanticWarning}\n`);
  console.log('高频问题预览:');
  for (const item of items.slice(0, 20)) {
    const location = item.line ? `${item.file}:${item.line}` : `${item.file}:${item.id}`;
    console.log(`- [${item.kind}] ${location} ${item.message}`);
  }
  console.log(`\n报告已保存: ${reportPath}`);

  const thresholds = {
    englishResidue: getAllowedCount('TRANSLATION_AUDIT_MAX_ENGLISH'),
    terminologyConflict: getAllowedCount('TRANSLATION_AUDIT_MAX_TERMINOLOGY_CONFLICT'),
    semanticWarning: getAllowedCount('TRANSLATION_AUDIT_MAX_SEMANTIC_WARNING')
  };

  const exceedsThreshold =
    summary.englishResidue > thresholds.englishResidue ||
    summary.terminologyConflict > thresholds.terminologyConflict ||
    summary.semanticWarning > thresholds.semanticWarning;

  if (exceedsThreshold) {
    console.error('\n❌ 文本审校未通过：结果超过允许阈值。');
    process.exit(1);
  }
}

const isDirectExecution =
  Boolean(process.argv[1]) &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isDirectExecution) {
  main();
}
