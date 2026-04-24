/**
 * @file mapRouteAdvisor.ts
 * @description 地图路线顾问 - 基于玩家状态推荐最优地图路线
 *
 * 主要职责:
 * - 分析节点类型和路线权重
 * - 评估玩家生命值和资源状态
 * - 提供路线建议和排序
 */

import type { MapNode } from '@/core';
import { getMapRuntimeConfig } from '@/content/narrative/numericSystem';

type RouteNodeType = MapNode['type'];

type RoutePlayerContext = {
  hp: number;
  maxHp: number;
  intel: number;
  relicCount: number;
  characterId?: string | null;
};

export interface RouteDossier {
  nodeId: string;
  immediateType: RouteNodeType;
  title: string;
  challenge: number;
  sustain: number;
  mystery: number;
  fitLabel: string;
  challengeLabel: string;
  previewTypes: RouteNodeType[];
  counts: Record<RouteNodeType, number>;
  summary: string;
}

const TYPE_WEIGHTS: Record<RouteNodeType, number> = {
  Combat: 2,
  Elite: 5,
  Boss: 6,
  Event: 2,
  Shop: 1,
  Rest: 1,
};

function collectReachableNodeIds(map: MapNode[], startNodeId: string, depth = 3): string[] {
  const visited = new Set<string>();
  const queue: Array<{ id: string; depth: number }> = [{ id: startNodeId, depth: 0 }];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current.id)) continue;
    visited.add(current.id);
    if (current.depth >= depth) continue;
    const node = map.find((entry) => entry.id === current.id);
    if (!node) continue;
    for (const nextId of node.next) {
      queue.push({ id: nextId, depth: current.depth + 1 });
    }
  }

  visited.delete(startNodeId);
  return Array.from(visited);
}

function clampMetric(value: number): number {
  return Math.max(1, Math.min(5, Math.round(value)));
}

function describeRouteShape(challenge: number, sustain: number, mystery: number): { title: string; fitLabel: string; challengeLabel: string } {
  if (challenge >= 4 && sustain <= 2) {
    return { title: '高压挑战线', fitLabel: '适合搏高风险', challengeLabel: '高压' };
  }
  if (sustain >= 4 && challenge <= 3) {
    return { title: '稳健补给线', fitLabel: '适合保守推进', challengeLabel: '稳健' };
  }
  if (mystery >= 4) {
    return { title: '异动探索线', fitLabel: '适合博信息差', challengeLabel: '未知偏高' };
  }
  return { title: '平衡推进线', fitLabel: '适合常规推进', challengeLabel: '均衡' };
}

export function buildRouteDossiers(
  map: MapNode[],
  selectableNodeIds: string[],
  player: RoutePlayerContext,
): RouteDossier[] {
  const config = getMapRuntimeConfig();
  const traversalDepth = config.openingRouteExpectation.traversalDepth;
  return selectableNodeIds
    .map((nodeId) => map.find((entry) => entry.id === nodeId))
    .filter((node): node is MapNode => !!node)
    .map((node) => {
      const previewNodeIds = collectReachableNodeIds(map, node.id, traversalDepth);
      const previewNodes = [node, ...previewNodeIds.map((id) => map.find((entry) => entry.id === id)).filter((entry): entry is MapNode => !!entry)];
      const counts: Record<RouteNodeType, number> = {
        Combat: 0,
        Elite: 0,
        Boss: 0,
        Event: 0,
        Shop: 0,
        Rest: 0,
      };
      previewNodes.forEach((entry) => {
        counts[entry.type] = (counts[entry.type] || 0) + 1;
      });

      const hpRatio = player.maxHp > 0 ? player.hp / player.maxHp : 1;
      const challenge = clampMetric((counts.Elite * 1.4 + counts.Boss * 2 + counts.Combat * 0.55) / Math.max(1, previewNodes.length));
      const sustain = clampMetric((counts.Rest * 2 + counts.Shop * 1.6 + (hpRatio < 0.55 ? 1 : 0)) / Math.max(1, previewNodes.length / 2));
      const mystery = clampMetric((counts.Event * 2 + Math.min(2, player.intel > 0 ? 1 : 0)) / Math.max(1, previewNodes.length / 2));

      const baseShape = describeRouteShape(challenge, sustain, mystery);
      const fitLabel = hpRatio < 0.45 && sustain >= challenge
        ? '当前状态更适合'
        : player.relicCount >= 3 && challenge >= 4
          ? '成型后值得一搏'
          : baseShape.fitLabel;

      const summaryParts = [
        counts.Event > 0 ? `异动 ${counts.Event}` : null,
        counts.Shop > 0 ? `补给 ${counts.Shop}` : null,
        counts.Rest > 0 ? `修整 ${counts.Rest}` : null,
        counts.Elite > 0 ? `头目 ${counts.Elite}` : null,
      ].filter(Boolean);

      return {
        nodeId: node.id,
        immediateType: node.type,
        title: baseShape.title,
        challenge,
        sustain,
        mystery,
        fitLabel,
        challengeLabel: baseShape.challengeLabel,
        previewTypes: previewNodes.slice(0, 4).map((entry) => entry.type),
        counts,
        summary: summaryParts.length > 0 ? summaryParts.join(' · ') : '前路仍以常规遭遇为主',
      };
    });
}
