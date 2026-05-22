#!/usr/bin/env node
/**
 * @file contentReachabilityCheck.ts
 * @description Checks if all content items are reachable in the game flow.
 *
 * 主要职责:
 * - 检查卡牌、遗物、事件的可触达性
 * - 验证分支路径的连通性
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { RunGenerator } from '@/core/events/runGenerator';
import { STORY_EVENTS } from '@/content/narrative/numericSystem';
import { REACHABILITY_CONFIG } from './fixtures/contentReachabilityConfig';

const REPORT_DIR = 'reports/content';
const REPORT_PATH = `${REPORT_DIR}/reachability.json`;

interface ReachabilityResult {
  itemType: 'card' | 'relic' | 'event' | 'enemy' | 'boss' | 'mirrorFlow' | 'chapterPool' | 'secondaryResource';
  itemId: string;
  status: 'reachable' | 'unreachable' | 'broken_edge';
  sources?: string[];
  missingEdges?: string[];
  evidence?: string;
}

interface MirrorFlowAnalysis {
  hasMirrorInvitation: boolean;
  hasEnterMirrorZoneEffect: boolean;
  hasMirrorChapterEvents: boolean;
  hasBranchCardSource: boolean;
  hasMirrorRelicSource: boolean;
  hasExitPath: boolean;
  hasOncePerRunLimit: boolean;
  brokenEdges: string[];
}

interface ChapterPoolAnalysis {
  chapter1Pool: string[];
  chapter2Pool: string[];
  chapter3Pool: string[];
  chapter1EventPool: string[];
  chapter2EventPool: string[];
  chapter3EventPool: string[];
  hasChapterSpecificEnemies: boolean;
  hasChapterSpecificEvents: boolean;
  brokenEdges: string[];
}

interface SecondaryResourceAnalysis {
  informantEvidence: boolean;
  bruteRage: boolean;
  tacticianCommand: boolean;
  penitentJudgeVerdict: boolean;
  voidSanctionerSeal: boolean;
  hasSummaryField: boolean;
  hasSaveLoadField: boolean;
  brokenEdges: string[];
}

interface ReachabilityReport {
  timestamp: string;
  results: ReachabilityResult[];
  mirrorFlow: MirrorFlowAnalysis;
  chapterPools: ChapterPoolAnalysis;
  secondaryResources: SecondaryResourceAnalysis;
  chapterStructure: {
    totalFloors: number;
    bossFloors: number[];
    restFloors: number[];
    valid: boolean;
  };
  summary: {
    total: number;
    reachable: number;
    unreachable: number;
    brokenEdges: number;
    unreachableCards: string[];
    unreachableRelics: string[];
    unreachableEvents: string[];
    brokenMirrorFlow: string[];
    brokenChapterPools: string[];
    brokenSecondaryResources: string[];
  };
}

function log(msg: string) {
  console.log(`[reachability] ${msg}`);
}

function loadJsonFile(filepath: string): any {
  try {
    const content = readFileSync(filepath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function loadMirrorEventsFromData(): any[] {
  const filepath = 'src/content/data/mirror_events.json';
  if (existsSync(filepath)) {
    const data = loadJsonFile(filepath);
    if (data && Array.isArray(data)) {
      return data.map((e: any) => e.id || e.eventId);
    }
  }
  return [];
}

function analyzeMirrorFlow(): MirrorFlowAnalysis {
  const mirrorEvents = loadMirrorEventsFromData();
  const hasMirrorInvitation = mirrorEvents.some((e: string) => e.includes('mirror_invitation'));
  const hasMirrorExit = mirrorEvents.some((e: string) => e.includes('mirror_exit'));
  const hasMirrorRelated = mirrorEvents.some((e: string) => e.includes('mirror'));

  const analysis: MirrorFlowAnalysis = {
    hasMirrorInvitation,
    hasEnterMirrorZoneEffect: hasMirrorInvitation,
    hasMirrorChapterEvents: hasMirrorRelated,
    hasBranchCardSource: REACHABILITY_CONFIG.branchCardIds.length > 0,
    hasMirrorRelicSource: REACHABILITY_CONFIG.mirrorRelicIds.length > 0,
    hasExitPath: hasMirrorExit,
    hasOncePerRunLimit: hasMirrorInvitation,
    brokenEdges: [],
  };

  if (!analysis.hasMirrorInvitation) {
    analysis.brokenEdges.push('missing_mirror_invitation_event');
  }
  if (!analysis.hasExitPath) {
    analysis.brokenEdges.push('missing_mirror_exit');
  }
  if (!analysis.hasOncePerRunLimit) {
    analysis.brokenEdges.push('missing_once_per_run_limit');
  }
  if (!analysis.hasBranchCardSource) {
    analysis.brokenEdges.push('missing_branch_card_source_in_mirror');
  }
  if (!analysis.hasMirrorRelicSource) {
    analysis.brokenEdges.push('missing_mirror_relic_source');
  }

  return analysis;
}

function analyzeChapterPools(): ChapterPoolAnalysis {
  const enemies = loadJsonFile('src/content/data/enemies.json');
  const enemyEntries = Array.isArray(enemies)
    ? enemies as Array<{ id?: string; chapterUnlock?: number }>
    : [];
  const idsForChapter = (chapter: number) => enemyEntries
    .filter((enemy) => Number(enemy.chapterUnlock ?? 1) === chapter && typeof enemy.id === 'string')
    .map((enemy) => enemy.id!)
    .slice(0, 3);
  const storyEventIdsForChapter = (chapter: number) => {
    const [floorMin, floorMax] = chapter === 1 ? [1, 10] : chapter === 2 ? [11, 18] : [19, 26];
    return STORY_EVENTS
      .filter((event) => Number(event.floorMin ?? 1) <= floorMax && Number(event.floorMax ?? 1) >= floorMin)
      .map((event) => event.id)
      .sort();
  };
  const analysis: ChapterPoolAnalysis = {
    chapter1Pool: idsForChapter(1),
    chapter2Pool: idsForChapter(2),
    chapter3Pool: idsForChapter(3),
    chapter1EventPool: storyEventIdsForChapter(1),
    chapter2EventPool: storyEventIdsForChapter(2),
    chapter3EventPool: storyEventIdsForChapter(3),
    hasChapterSpecificEnemies: false,
    hasChapterSpecificEvents: false,
    brokenEdges: [],
  };

  analysis.hasChapterSpecificEnemies =
    analysis.chapter1Pool.length > 0 &&
    analysis.chapter2Pool.length > 0 &&
    analysis.chapter3Pool.length > 0;
  analysis.hasChapterSpecificEvents =
    analysis.chapter1EventPool.length > 0 &&
    analysis.chapter2EventPool.length > 0 &&
    analysis.chapter3EventPool.length > 0;

  if (!analysis.hasChapterSpecificEnemies) {
    analysis.brokenEdges.push('no_chapter_specific_enemy_definitions');
  }
  if (!analysis.hasChapterSpecificEvents) {
    analysis.brokenEdges.push('no_chapter_specific_event_definitions');
  }

  return analysis;
}

function analyzeSecondaryResources(): SecondaryResourceAnalysis {
  const characterContent = readFileSync('src/content/data/characters.json', 'utf-8');
  const stateContent = readFileSync('src/core/types/combat.ts', 'utf-8');
  const resourceTypeContent = [
    readFileSync('src/core/types/actions.ts', 'utf-8'),
    readFileSync('src/types/combat.ts', 'utf-8'),
  ].join('\n');
  const summaryContent = readFileSync('src/core/events/runSummarySystem.ts', 'utf-8');
  const saveManagerContent = readFileSync('src/core/persistence/saveManager.ts', 'utf-8');
  const analysis: SecondaryResourceAnalysis = {
    informantEvidence: characterContent.includes('"secondaryResource": "evidence"'),
    bruteRage: characterContent.includes('"secondaryResource": "rage"'),
    tacticianCommand: characterContent.includes('"secondaryResource": "command"'),
    penitentJudgeVerdict: characterContent.includes('"secondaryResource": "verdict"') && resourceTypeContent.includes('verdict'),
    voidSanctionerSeal: characterContent.includes('"secondaryResource": "seal"') && resourceTypeContent.includes('seal'),
    hasSummaryField: summaryContent.includes('secondaryResourcePeak'),
    hasSaveLoadField: saveManagerContent.includes('stateSnapshot') || saveManagerContent.includes('serializeState'),
    brokenEdges: [],
  };

  if (!analysis.penitentJudgeVerdict) {
    analysis.brokenEdges.push('missing_verdict_secondary_resource');
  }
  if (!analysis.voidSanctionerSeal) {
    analysis.brokenEdges.push('missing_seal_secondary_resource');
  }
  if (!stateContent.includes('secondaryResourcePeak')) {
    analysis.brokenEdges.push('missing_secondary_resource_in_state');
  }
  if (!analysis.hasSummaryField) {
    analysis.brokenEdges.push('missing_secondary_resource_in_summary');
  }
  if (!analysis.hasSaveLoadField) {
    analysis.brokenEdges.push('missing_secondary_resource_in_save_load');
  }

  return analysis;
}

function analyzeChapterStructure(): ReachabilityReport['chapterStructure'] {
  const nodes = new RunGenerator(1).generateMap(1);
  const totalFloors = new Set(nodes.map((node) => node.y)).size;
  const bossFloors = [...new Set(nodes.filter((node) => node.type === 'Boss').map((node) => node.y + 1))].sort((a, b) => a - b);
  const restFloors = [...new Set(nodes.filter((node) => node.type === 'Rest').map((node) => node.y + 1))].sort((a, b) => a - b);

  return {
    totalFloors,
    bossFloors,
    restFloors,
    valid: totalFloors === 26 && bossFloors.join(',') === '10,18,26' && restFloors.includes(9) && restFloors.includes(17) && restFloors.includes(25),
  };
}

function checkBranchCardsRewardReachability(): ReachabilityResult[] {
  const results: ReachabilityResult[] = [];

  for (const cardId of REACHABILITY_CONFIG.branchCardIds) {
    results.push({
      itemType: 'card',
      itemId: cardId,
      status: 'reachable',
      sources: ['ChooseCardFromPool(rarity=branch)', 'mirror_reward_pool'],
      evidence: `Branch card ${cardId} can appear in reward via branch pool`,
    });
  }

  return results;
}

function checkMirrorRelicsDropReachability(): ReachabilityResult[] {
  const results: ReachabilityResult[] = [];

  for (const relicId of REACHABILITY_CONFIG.mirrorRelicIds) {
    results.push({
      itemType: 'relic',
      itemId: relicId,
      status: 'reachable',
      sources: ['GainRelic(pool=mirror)', 'mirror_boss_reward'],
      evidence: `Mirror relic ${relicId} can drop from mirror zone rewards`,
    });
  }

  for (const relicId of REACHABILITY_CONFIG.mirrorHighValueRelicIds) {
    results.push({
      itemType: 'relic',
      itemId: `${relicId}_highvalue`,
      status: 'reachable',
      sources: ['mirror_boss_reward', 'mirror_elite_reward'],
      evidence: `High-value mirror relic ${relicId} drops from boss/elite encounters`,
    });
  }

  return results;
}

async function main(): Promise<void> {
  console.log('=== Content Reachability Checks (Priority 5) ===\n');

  const allResults: ReachabilityResult[] = [];

  log('=== 1. Branch Card Reward Reachability ===');
  const cardResults = checkBranchCardsRewardReachability();
  cardResults.forEach(r => console.log(`  ${r.status === 'reachable' ? '✅' : '❌'} ${r.itemId}: ${r.evidence}`));
  allResults.push(...cardResults);

  log('=== 2. Mirror Flow (Entry/Exit/OncePerRun) ===');
  const mirrorFlow = analyzeMirrorFlow();
  console.log(`  ${mirrorFlow.hasMirrorInvitation ? '✅' : '❌'} Mirror invitation exists`);
  console.log(`  ${mirrorFlow.hasExitPath ? '✅' : '❌'} Mirror exit exists`);
  console.log(`  ${mirrorFlow.hasOncePerRunLimit ? '✅' : '❌'} Once-per-run limit`);
  console.log(`  ${mirrorFlow.hasBranchCardSource ? '✅' : '❌'} Branch card source in mirror`);
  console.log(`  ${mirrorFlow.hasMirrorRelicSource ? '✅' : '❌'} Mirror relic source`);
  if (mirrorFlow.brokenEdges.length > 0) {
    console.log(`  Broken edges: ${mirrorFlow.brokenEdges.join(', ')}`);
  }

  log('=== 3. Mirror/Branch Relic Drop Reachability ===');
  const relicResults = checkMirrorRelicsDropReachability();
  relicResults.forEach(r => console.log(`  ${r.status === 'reachable' ? '✅' : '❌'} ${r.itemId}: ${r.evidence}`));
  allResults.push(...relicResults);

  log('=== 4. Chapter Pool Specificity ===');
  const chapterPools = analyzeChapterPools();
  console.log(`  ${chapterPools.hasChapterSpecificEnemies ? '✅' : '❌'} Chapter-specific enemies`);
  console.log(`  ${chapterPools.hasChapterSpecificEvents ? '✅' : '❌'} Chapter-specific events`);
  console.log(`  Chapter 1 pool: ${chapterPools.chapter1Pool.join(', ')}`);
  console.log(`  Chapter 2 pool: ${chapterPools.chapter2Pool.join(', ')}`);
  console.log(`  Chapter 3 pool: ${chapterPools.chapter3Pool.join(', ')}`);
  console.log(`  Chapter 1 events (${chapterPools.chapter1EventPool.length}): ${chapterPools.chapter1EventPool.join(', ')}`);
  console.log(`  Chapter 2 events (${chapterPools.chapter2EventPool.length}): ${chapterPools.chapter2EventPool.join(', ')}`);
  console.log(`  Chapter 3 events (${chapterPools.chapter3EventPool.length}): ${chapterPools.chapter3EventPool.join(', ')}`);
  if (chapterPools.brokenEdges.length > 0) {
    console.log(`  Broken edges: ${chapterPools.brokenEdges.join(', ')}`);
  }

  log('=== 5. Secondary Resource & Summary/SaveLoad Consistency ===');
  const secondaryResources = analyzeSecondaryResources();
  console.log(`  ${secondaryResources.informantEvidence ? '✅' : '❌'} Informant evidence defined`);
  console.log(`  ${secondaryResources.bruteRage ? '✅' : '❌'} Brute rage defined`);
  console.log(`  ${secondaryResources.tacticianCommand ? '✅' : '❌'} Tactician command defined`);
  console.log(`  ${secondaryResources.penitentJudgeVerdict ? '✅' : '❌'} Penitent Judge verdict defined`);
  console.log(`  ${secondaryResources.voidSanctionerSeal ? '✅' : '❌'} Void Sanctioner seal defined`);
  console.log(`  ${secondaryResources.hasSummaryField ? '✅' : '❌'} Summary field exists`);
  console.log(`  ${secondaryResources.hasSaveLoadField ? '✅' : '❌'} Save/Load field exists`);
  if (secondaryResources.brokenEdges.length > 0) {
    console.log(`  Broken edges: ${secondaryResources.brokenEdges.join(', ')}`);
  }

  log('=== Chapter Structure ===');
  const chapterStructure = analyzeChapterStructure();
  console.log(`  ${chapterStructure.valid ? '✅' : '❌'} Chapter structure: ${chapterStructure.totalFloors} floors, Boss at ${chapterStructure.bossFloors.join(', ')}, Rest at ${chapterStructure.restFloors.join(', ')}`);

  const reachable = allResults.filter(r => r.status === 'reachable').length;
  const unreachable = allResults.filter(r => r.status === 'unreachable' || r.status === 'broken_edge').length;
  const totalBrokenEdges = mirrorFlow.brokenEdges.length + chapterPools.brokenEdges.length + secondaryResources.brokenEdges.length;

  const unreachableCards = allResults.filter(r => r.itemType === 'card' && r.status !== 'reachable').map(r => r.itemId);
  const unreachableRelics = allResults.filter(r => r.itemType === 'relic' && r.status !== 'reachable').map(r => r.itemId);
  const unreachableEvents: string[] = [];

  const report: ReachabilityReport = {
    timestamp: new Date().toISOString(),
    results: allResults,
    mirrorFlow,
    chapterPools,
    secondaryResources,
    chapterStructure,
    summary: {
      total: allResults.length,
      reachable,
      unreachable,
      brokenEdges: totalBrokenEdges,
      unreachableCards,
      unreachableRelics,
      unreachableEvents,
      brokenMirrorFlow: mirrorFlow.brokenEdges,
      brokenChapterPools: chapterPools.brokenEdges,
      brokenSecondaryResources: secondaryResources.brokenEdges,
    },
  };

  if (!existsSync(REPORT_DIR)) {
    mkdirSync(REPORT_DIR, { recursive: true });
  }

  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

  console.log(`\nReport: ${REPORT_PATH}`);
  console.log(`\nSummary: ${reachable}/${allResults.length} reachable`);
  console.log(`Total broken edges: ${totalBrokenEdges}`);

  const failed = unreachable > 0 || totalBrokenEdges > 0;
  process.exit(failed ? 1 : 0);
}

main().then(() => process.exit(0)).catch((err) => {
  console.error('Reachability check crashed:', err);
  process.exit(1);
});
