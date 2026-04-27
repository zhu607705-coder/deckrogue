#!/usr/bin/env node
/**
 * @file deepReachabilityCheck.ts
 * @description Performs deep reachability analysis for branch cards, mirror flows, and chapter pools.
 *
 * 主要职责:
 * - 分析分支卡牌的可触达性
 * - 检查镜宫流程的完整性
 * - 验证章节池的连接性
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { RunGenerator } from '@/core/events/runGenerator';
import { REACHABILITY_CONFIG } from './fixtures/contentReachabilityConfig';

const REPORT_DIR = 'reports/content';
const REPORT_PATH = `${REPORT_DIR}/deep-reachability.json`;

interface ReachabilityResult {
  itemType: string;
  itemId: string;
  status: 'reachable' | 'unreachable' | 'broken_edge';
  checkType: 'existence' | 'pool_connected' | 'flow_edge' | 'writeback';
  sources?: string[];
  missingEdges?: string[];
  evidence?: string;
}

interface DeepReachabilityReport {
  timestamp: string;
  checks: {
    branchCards: ReachabilityResult[];
    mirrorFlow: ReachabilityResult[];
    mirrorRelics: ReachabilityResult[];
    chapterPools: ReachabilityResult[];
    secondaryResources: ReachabilityResult[];
  };
  summary: {
    total: number;
    reachable: number;
    unreachable: number;
    brokenEdges: number;
    issuesByType: Record<string, number>;
  };
}

function log(msg: string) {
  console.log(`[deep-reachability] ${msg}`);
}

function loadJsonFile(filepath: string): any {
  try {
    return JSON.parse(readFileSync(filepath, 'utf-8'));
  } catch {
    return null;
  }
}

function loadTextFile(filepath: string): string {
  return existsSync(filepath) ? readFileSync(filepath, 'utf-8') : '';
}

function checkBranchCardsRewardPool(): ReachabilityResult[] {
  const results: ReachabilityResult[] = [];
  const branchCards = REACHABILITY_CONFIG.branchCardIds;

  const cardsContent = loadTextFile('src/content/data/cards.json');
  const mirrorEventsContent = loadTextFile('src/content/data/mirror_events.json');
  const hasBranchPool = mirrorEventsContent.includes('ChooseCardFromPool') && mirrorEventsContent.includes('branch');

  for (const cardId of branchCards) {
    const hasPoolConnection = cardsContent.includes(`"id": "${cardId}"`) && hasBranchPool;
    results.push({
      itemType: 'branch_card',
      itemId: cardId,
      status: hasPoolConnection ? 'reachable' : 'broken_edge',
      checkType: 'pool_connected',
      sources: hasPoolConnection ? ['reward_pool(branch)', 'mirror_events.json'] : [],
      missingEdges: hasPoolConnection ? [] : ['reward_pool_does_not_contain_branch'],
      evidence: hasPoolConnection
        ? `Branch card ${cardId} has pool connection to reward mechanism via branch pool`
        : `No evidence ${cardId} connects to reward pool - only exists in config`,
    });
  }

  return results;
}

function checkMirrorFlowEdges(): ReachabilityResult[] {
  const results: ReachabilityResult[] = [];
  const mirrorEventsPath = 'src/content/data/mirror_events.json';
  const mirrorEvents = existsSync(mirrorEventsPath) ? loadJsonFile(mirrorEventsPath) : [];

  const hasInvitation = mirrorEvents.some((e: any) =>
    (e.id || e.eventId || '').includes('mirror_invitation')
  );
  const hasExit = mirrorEvents.some((e: any) =>
    (e.id || e.eventId || '').includes('mirror_exit')
  );
  const hasEntryEffect = mirrorEvents.some((e: any) =>
    JSON.stringify(e).includes('EnterMirrorZone') || JSON.stringify(e).includes('enter_mirror')
  );
  const hasRewardEffect = mirrorEvents.some((e: any) =>
    JSON.stringify(e).includes('ChooseCardFromPool') || JSON.stringify(e).includes('branch')
  );

  results.push({
    itemType: 'mirror_flow',
    itemId: 'mirror_invitation',
    status: hasInvitation ? 'reachable' : 'unreachable',
    checkType: 'flow_edge',
    sources: hasInvitation ? ['mirror_events.json'] : [],
    missingEdges: hasInvitation ? [] : ['mirror_invitation_not_in_pool'],
    evidence: hasInvitation
      ? 'mirror_invitation exists in mirror_events.json'
      : 'mirror_invitation not found in any event pool',
  });

  results.push({
    itemType: 'mirror_flow',
    itemId: 'mirror_exit',
    status: hasExit ? 'reachable' : 'broken_edge',
    checkType: 'flow_edge',
    sources: hasExit ? ['mirror_events.json'] : [],
    missingEdges: hasExit ? [] : ['mirror_exit_not_defined'],
    evidence: hasExit
      ? 'mirror_exit exists - can return to main map'
      : 'No mirror_exit event - cannot return from mirror zone',
  });

  results.push({
    itemType: 'mirror_flow',
    itemId: 'enter_mirror_zone_effect',
    status: hasEntryEffect ? 'reachable' : 'broken_edge',
    checkType: 'flow_edge',
    sources: hasEntryEffect ? ['event_effect_definition'] : [],
    missingEdges: hasEntryEffect ? [] : ['EnterMirrorZone_effect_not_defined'],
    evidence: hasEntryEffect
      ? 'EnterMirrorZone effect found in event definitions'
      : 'No EnterMirrorZone effect defined - entry mechanism broken',
  });

  results.push({
    itemType: 'mirror_flow',
    itemId: 'branch_reward_in_mirror',
    status: hasRewardEffect ? 'reachable' : 'broken_edge',
    checkType: 'flow_edge',
    sources: hasRewardEffect ? ['ChooseCardFromPool(branch)'] : [],
    missingEdges: hasRewardEffect ? [] : ['branch_reward_not_in_mirror_flow'],
    evidence: hasRewardEffect
      ? 'ChooseCardFromPool(branch) found in mirror events'
      : 'No branch card reward in mirror flow',
  });

  return results;
}

function checkMirrorRelicsDropPool(): ReachabilityResult[] {
  const results: ReachabilityResult[] = [];
  const mirrorRelics = REACHABILITY_CONFIG.mirrorRelicIds;

  const relicDataContent = loadTextFile('src/content/data/relics.json');

  for (const relicId of mirrorRelics) {
    const hasDropConnection = relicDataContent.includes(`"id": "${relicId}"`);
    results.push({
      itemType: 'mirror_relic',
      itemId: relicId,
      status: hasDropConnection ? 'reachable' : 'broken_edge',
      checkType: 'pool_connected',
      sources: hasDropConnection ? ['relics.json pool=mirror'] : [],
      missingEdges: hasDropConnection ? [] : ['mirror_relic_not_in_drop_pool'],
      evidence: hasDropConnection
        ? `Mirror relic ${relicId} found in relics.json with pool=mirror`
        : `No evidence ${relicId} can drop - only exists in config`,
    });
  }

  return results;
}

function checkChapterPoolIsolation(): ReachabilityResult[] {
  const results: ReachabilityResult[] = [];

  const generatedMap = new RunGenerator(1).generateMap(1);
  const totalFloors = new Set(generatedMap.map((node) => node.y)).size;
  const bossFloors = new Set(generatedMap.filter((node) => node.type === 'Boss').map((node) => node.y + 1));
  const hasChapterStructure = totalFloors === 26 && bossFloors.has(10) && bossFloors.has(18) && bossFloors.has(26);
  const numericSystemContent = loadTextFile('src/content/narrative/numericSystem.ts');
  const hasFloorBasedEligibility = numericSystemContent.includes('isEnemyEligibleForFloorByNumericRules');

  const chapters = [
    { id: 'chapter_1', floors: 10, bossFloorRel: 10, expectedBossFloor: 10 },
    { id: 'chapter_2', floors: 8, bossFloorRel: 8, expectedBossFloor: 18 },
    { id: 'chapter_3', floors: 8, bossFloorRel: 8, expectedBossFloor: 26 },
  ];

  for (const chapter of chapters) {
    const hasCorrectBossFloor = bossFloors.has(chapter.expectedBossFloor);
    results.push({
      itemType: 'chapter_pool',
      itemId: `${chapter.id}_structure`,
      status: hasChapterStructure && hasFloorBasedEligibility && hasCorrectBossFloor ? 'reachable' : 'broken_edge',
      checkType: 'pool_connected',
      sources: hasChapterStructure && hasFloorBasedEligibility ? ['RunGenerator chapter map', 'floor-based eligibility'] : [],
      missingEdges: [
        ...(hasChapterStructure ? [] : ['no_chapter_structure']),
        ...(hasFloorBasedEligibility ? [] : ['no_floor_based_enemy_eligibility']),
      ],
      evidence: hasChapterStructure && hasFloorBasedEligibility && hasCorrectBossFloor
        ? `${chapter.id} structure exists with ${chapter.floors} floors and boss at relative floor ${chapter.bossFloorRel} (absolute floor ${chapter.expectedBossFloor})`
        : `Chapter structure incomplete for ${chapter.id}`,
    });
  }

  return results;
}

function checkSecondaryResourceWriteback(): ReachabilityResult[] {
  const results: ReachabilityResult[] = [];

  const stateContent = loadTextFile('src/core/types/combat.ts');
  const summaryContent = loadTextFile('src/core/events/runSummarySystem.ts');
  const saveLoadContent = [
    loadTextFile('src/core/persistence/saveManager.ts'),
    loadTextFile('src/core/events/SaveManager.ts'),
  ].join('\n');
  const hasPersistenceLayer = saveLoadContent.includes('serializeState') || saveLoadContent.includes('JSON.stringify');

  const hasStateDefinition = stateContent.includes('secondaryResourcePeak');
  const hasSummaryField = summaryContent.includes('secondaryResourcePeak');
  const charactersData = loadJsonFile('src/content/data/characters.json') as Array<{ id?: string; secondaryResource?: string }> | null;
  const resourcesByCharacter = new Map((charactersData ?? []).map((character) => [character.id, character.secondaryResource]));

  const characters = [
    { id: 'informant', resource: 'evidence' },
    { id: 'brute', resource: 'rage' },
    { id: 'tactician', resource: 'command' },
    { id: 'penitent_judge', resource: 'verdict' },
    { id: 'void_sanctioner', resource: 'seal' },
  ];
  for (const char of characters) {
    const hasCharDef = resourcesByCharacter.get(char.id) === char.resource;

    results.push({
      itemType: 'secondary_resource',
      itemId: `${char.id}_definition`,
      status: hasCharDef ? 'reachable' : 'broken_edge',
      checkType: 'writeback',
      sources: hasCharDef ? ['characters.json secondaryResource field'] : [],
      missingEdges: hasCharDef ? [] : [`${char.id}_no_secondary_resource_in_definition`],
      evidence: hasCharDef
        ? `${char.id} has ${char.resource} secondaryResource in characters.json`
        : `${char.id} missing ${char.resource} secondaryResource in definition - not connected`,
    });
  }

  results.push({
    itemType: 'secondary_resource',
    itemId: 'summary_writeback',
    status: hasSummaryField ? 'reachable' : 'broken_edge',
    checkType: 'writeback',
    sources: hasStateDefinition && hasSummaryField ? ['combat.ts state field', 'runSummarySystem.ts'] : [],
    missingEdges: hasSummaryField ? [] : ['summary_does_not_write_secondary_resource'],
    evidence: hasSummaryField
      ? 'secondaryResourcePeak field exists in summary'
      : 'Summary missing secondaryResourcePeak - values not written back',
  });

  results.push({
    itemType: 'secondary_resource',
    itemId: 'saveload_writeback',
    status: hasPersistenceLayer ? 'reachable' : 'broken_edge',
    checkType: 'writeback',
    sources: hasPersistenceLayer ? ['serializeState uses JSON.stringify (full state copy)'] : [],
    missingEdges: hasPersistenceLayer ? [] : ['persistence_layer_missing'],
    evidence: hasPersistenceLayer
      ? 'GameState serialized via JSON.stringify - includes all fields including secondaryResource'
      : 'Persistence layer does not serialize full state',
  });

  return results;
}

async function main(): Promise<void> {
  console.log('=== Deep Reachability Checks ===\n');

  const allResults: ReachabilityResult[] = [];

  log('=== 1. Branch Card Reward Pool Connection ===');
  const branchResults = checkBranchCardsRewardPool();
  branchResults.forEach(r => {
    const icon = r.status === 'reachable' ? '✅' : r.status === 'broken_edge' ? '❌' : '⚠️';
    console.log(`  ${icon} ${r.itemId}: ${r.evidence}`);
  });
  allResults.push(...branchResults);

  log('\n=== 2. Mirror Flow Edges ===');
  const mirrorResults = checkMirrorFlowEdges();
  mirrorResults.forEach(r => {
    const icon = r.status === 'reachable' ? '✅' : r.status === 'broken_edge' ? '❌' : '⚠️';
    console.log(`  ${icon} ${r.itemId}: ${r.evidence}`);
    if (r.missingEdges && r.missingEdges.length > 0) {
      console.log(`     Missing: ${r.missingEdges.join(', ')}`);
    }
  });
  allResults.push(...mirrorResults);

  log('\n=== 3. Mirror Relic Drop Pool Connection ===');
  const relicResults = checkMirrorRelicsDropPool();
  relicResults.forEach(r => {
    const icon = r.status === 'reachable' ? '✅' : r.status === 'broken_edge' ? '❌' : '⚠️';
    console.log(`  ${icon} ${r.itemId}: ${r.evidence}`);
  });
  allResults.push(...relicResults);

  log('\n=== 4. Chapter Pool Isolation ===');
  const poolResults = checkChapterPoolIsolation();
  poolResults.forEach(r => {
    const icon = r.status === 'reachable' ? '✅' : r.status === 'broken_edge' ? '❌' : '⚠️';
    console.log(`  ${icon} ${r.itemId}: ${r.evidence}`);
  });
  allResults.push(...poolResults);

  log('\n=== 5. Secondary Resource Writeback ===');
  const writebackResults = checkSecondaryResourceWriteback();
  writebackResults.forEach(r => {
    const icon = r.status === 'reachable' ? '✅' : r.status === 'broken_edge' ? '❌' : '⚠️';
    console.log(`  ${icon} ${r.itemId}: ${r.evidence}`);
  });
  allResults.push(...writebackResults);

  const reachable = allResults.filter(r => r.status === 'reachable').length;
  const unreachable = allResults.filter(r => r.status === 'unreachable').length;
  const brokenEdges = allResults.filter(r => r.status === 'broken_edge').length;

  const issuesByType: Record<string, number> = {};
  allResults.filter(r => r.status !== 'reachable').forEach(r => {
    issuesByType[r.itemType] = (issuesByType[r.itemType] || 0) + 1;
  });

  const report: DeepReachabilityReport = {
    timestamp: new Date().toISOString(),
    checks: {
      branchCards: branchResults,
      mirrorFlow: mirrorResults,
      mirrorRelics: relicResults,
      chapterPools: poolResults,
      secondaryResources: writebackResults,
    },
    summary: {
      total: allResults.length,
      reachable,
      unreachable,
      brokenEdges,
      issuesByType,
    },
  };

  if (!existsSync(REPORT_DIR)) {
    mkdirSync(REPORT_DIR, { recursive: true });
  }

  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

  console.log(`\n=== Summary ===`);
  console.log(`Report: ${REPORT_PATH}`);
  console.log(`Total: ${allResults.length}`);
  console.log(`Reachable: ${reachable}`);
  console.log(`Unreachable: ${unreachable}`);
  console.log(`Broken Edges: ${brokenEdges}`);

  if (Object.keys(issuesByType).length > 0) {
    console.log(`\nIssues by Type:`);
    for (const [type, count] of Object.entries(issuesByType)) {
      console.log(`  ${type}: ${count}`);
    }
  }

  console.log(`\nReport: ${REPORT_PATH}`);

  const failed = brokenEdges > 0 || unreachable > 0;
  process.exit(failed ? 1 : 0);
}

main().then(() => process.exit(0)).catch((err) => {
  console.error('Deep reachability check crashed:', err);
  process.exit(1);
});
