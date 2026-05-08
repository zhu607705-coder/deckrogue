/**
 * @file check_route_taxonomy_guardrails.ts
 * @description 检查路线分类学的护栏配置，验证路线标签和支撑遗物的正确性。
 *
 * 主要职责:
 * - 验证每个角色的路线标签分类
 * - 检查路线支撑遗物的配置
 * - 运行场景测试验证护栏逻辑
 */

import fs from 'node:fs';
import path from 'node:path';

import { GameEngine } from '@/core/events/gameEngine';
import {
  cardsData,
  getCardRouteSignal,
  getKnownRouteTagsForCharacter,
  getRelicRouteTags,
  getRouteSupportRelicIds,
  getRouteTaxonomyForCharacter,
  relicsData,
} from '@/content/narrative/numericSystem';
import type { RunCardInstance } from '@/core/types';

const CHARACTER_IDS = ['informant', 'brute', 'tactician', 'puppeteer', 'chronomancer', 'alchemist', 'penitent_judge', 'void_sanctioner'] as const;

function makeRuntimeCard(cardId: string, instanceId: string): RunCardInstance {
  const card = cardsData.find((entry) => entry.id === cardId);
  if (!card) throw new Error(`missing card ${cardId}`);
  return {
    ...card,
    instanceId,
    baseCardId: card.id,
    runtimeBase: card,
    persistentEnchantments: [],
    combatAfflictions: [],
  };
}

function getRouteCardId(characterId: string, routeTag: string, role: 'route_confirm' | 'route_payoff'): string {
  const card = cardsData.find((entry) => {
    const signal = getCardRouteSignal(entry);
    return entry.character === characterId && signal?.routeTags.includes(routeTag) && signal.earlyGameRole === role;
  });
  if (!card) throw new Error(`missing ${role} card for ${routeTag}`);
  return card.id;
}

function setFloor(engine: GameEngine, floorIndex: number) {
  const node = engine.state.map.find((entry) => entry.y === floorIndex);
  if (!node) throw new Error(`missing node on floor ${floorIndex}`);
  engine.state.currentNodeId = node.id;
}

const coverage = CHARACTER_IDS.flatMap((characterId) => {
  const knownTags = getKnownRouteTagsForCharacter(characterId);
  const taxonomy = getRouteTaxonomyForCharacter(characterId);

  return taxonomy.map((entry) => {
    const supportRelicIds = getRouteSupportRelicIds(entry.routeTag);
    const confirmCardId = getRouteCardId(characterId, entry.routeTag, 'route_confirm');
    const payoffCardId = getRouteCardId(characterId, entry.routeTag, 'route_payoff');
    const missingRelics = supportRelicIds.filter((relicId) => !relicsData.some((relic) => relic.id === relicId));

    const engine = new GameEngine(17, null, { enableRuntimeDelegation: false });
    let midgameRelicAligned = false;
    try {
      engine.selectCharacter(characterId);
      engine.state.player.deck.push(makeRuntimeCard(confirmCardId, `${entry.routeTag}-recent`));
      setFloor(engine, 3);
      engine.enterShop();
      midgameRelicAligned = engine.state.shopRelics.some((relicId) => getRelicRouteTags(relicId).includes(entry.routeTag));
    } finally {
      engine.dispose();
    }

    return {
      characterId,
      routeTag: entry.routeTag,
      taxonomyTagPresent: knownTags.includes(entry.routeTag),
      supportRelicCount: supportRelicIds.length,
      confirmCardId,
      payoffCardId,
      missingRelics,
      midgameRelicAligned,
    };
  });
});

const failures = coverage.filter((entry) =>
  !entry.taxonomyTagPresent ||
  entry.supportRelicCount < 2 ||
  entry.missingRelics.length > 0 ||
  !entry.midgameRelicAligned
);

const report = {
  totalRoutes: coverage.length,
  pass: failures.length === 0,
  failures,
  coverage,
};

const reportPath = path.join(process.cwd(), 'reports', 'growth', 'route-taxonomy-guardrails.json');
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

console.log(JSON.stringify({
  totalRoutes: report.totalRoutes,
  pass: report.pass,
  failureCount: failures.length,
  reportPath,
}, null, 2));

if (failures.length > 0) {
  process.exitCode = 1;
}
