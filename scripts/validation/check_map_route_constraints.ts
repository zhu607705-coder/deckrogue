#!/usr/bin/env node

import { RunGenerator } from '@/core/events/runGenerator';
import { getMapRuntimeConfig } from '@/content/narrative/numericSystem';

const ROUTE_EXPECTATION: Record<string, number> = {
  Combat: 2,
  Elite: 5,
  Boss: 0,
  Event: 2,
  Shop: 1,
  Rest: 1,
};

function routeExpectation(map: ReturnType<RunGenerator['generateMap']>, startNodeId: string, depth = 3): number {
  const start = map.find((node) => node.id === startNodeId);
  if (!start) return 0;

  let total = ROUTE_EXPECTATION[start.type] ?? 0;
  const visited = new Set<string>();
  const queue: Array<{ id: string; depth: number }> = [{ id: startNodeId, depth: 0 }];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || current.depth >= depth) continue;
    const node = map.find((entry) => entry.id === current.id);
    if (!node) continue;

    for (const nextId of node.next) {
      if (visited.has(nextId)) continue;
      visited.add(nextId);
      const next = map.find((entry) => entry.id === nextId);
      if (!next) continue;
      total += ROUTE_EXPECTATION[next.type] ?? 0;
      queue.push({ id: nextId, depth: current.depth + 1 });
    }
  }

  return total;
}

function main(): void {
  const config = getMapRuntimeConfig();
  const violations: string[] = [];

  for (let seed = 1; seed <= 40; seed += 1) {
    const generator = new RunGenerator(seed);
    const map = generator.generateMap(seed, 12);

    for (const floor of [1, 2, 3]) {
      const nodes = map.filter((node) => node.y === floor - 1);
      const eventCount = nodes.filter((node) => node.type === 'Event').length;
      if (eventCount > 1) {
        violations.push(`seed ${seed} floor ${floor}: expected <= 1 Event, found ${eventCount}`);
      }

      const uniqueTypes = new Set(nodes.map((node) => node.type));
      if (uniqueTypes.size < 2) {
        violations.push(`seed ${seed} floor ${floor}: expected at least 2 distinct node types`);
      }

      if (!nodes.some((node) => node.type === 'Combat')) {
        violations.push(`seed ${seed} floor ${floor}: expected at least 1 Combat node`);
      }

      if (!nodes.some((node) => node.type === 'Event' || node.type === 'Shop' || node.type === 'Rest' || node.type === 'Elite')) {
        violations.push(`seed ${seed} floor ${floor}: expected at least 1 utility/challenge alternative`);
      }
    }

    const openingNodes = map.filter((node) => node.y === 0);
    const scores = openingNodes.map((node) => routeExpectation(map, node.id, config.openingRouteExpectation.traversalDepth));
    const spread = Math.max(...scores) - Math.min(...scores);
    if (spread > config.openingRouteExpectation.maxSpread) {
      violations.push(`seed ${seed}: opening route expectation spread too high (${spread})`);
    }
  }

  if (violations.length > 0) {
    console.error(`\n[check_map_route_constraints] Found ${violations.length} violation(s):`);
    for (const violation of violations.slice(0, 30)) {
      console.error(`- ${violation}`);
    }
    if (violations.length > 30) {
      console.error(`- ...and ${violations.length - 30} more`);
    }
    process.exit(1);
  }

  console.log('[check_map_route_constraints] OK');
}

main();
