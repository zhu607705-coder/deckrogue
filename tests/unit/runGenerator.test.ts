import test from 'node:test';
import assert from 'node:assert/strict';

import { RunGenerator } from '@/core/events/runGenerator';

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
  assert.ok(start, `missing start node ${startNodeId}`);

  let total = ROUTE_EXPECTATION[start.type] ?? 0;
  const visited = new Set<string>();
  const queue: Array<{ id: string; depth: number }> = [{ id: startNodeId, depth: 0 }];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || current.depth >= depth) continue;
    const node = map.find((entry) => entry.id === current.id);
    assert.ok(node, `missing route node ${current.id}`);

    for (const nextId of node.next) {
      if (visited.has(nextId)) continue;
      visited.add(nextId);
      const next = map.find((entry) => entry.id === nextId);
      assert.ok(next, `missing next route node ${nextId}`);
      total += ROUTE_EXPECTATION[next.type] ?? 0;
      queue.push({ id: nextId, depth: current.depth + 1 });
    }
  }

  return total;
}

test('RunGenerator resets room streak state between generateMap calls on the same instance', () => {
  const seed = 27;
  const sharedGenerator = new RunGenerator(1);
  const baselineGenerator = new RunGenerator(seed);

  const firstRun = sharedGenerator.generateMap(seed, 10);
  const secondRun = sharedGenerator.generateMap(seed, 10);
  const baselineRun = baselineGenerator.generateMap(seed, 10);

  assert.deepEqual(firstRun, baselineRun);
  assert.deepEqual(secondRun, baselineRun);
});

test('RunGenerator caps event rooms to one per floor', () => {
  for (let seed = 1; seed <= 40; seed += 1) {
    const generator = new RunGenerator(seed);
    const map = generator.generateMap(seed, 12);
    const floors = new Map<number, typeof map>();
    for (const node of map) {
      const floor = node.y + 1;
      if (!floors.has(floor)) floors.set(floor, []);
      floors.get(floor)!.push(node);
    }
    for (const [floor, nodes] of floors) {
      const eventCount = nodes.filter((node) => node.type === 'Event').length;
      assert.ok(eventCount <= 1, `floor ${floor} should have at most one event room`);
    }
  }
});

test('RunGenerator preserves fixed pre-boss rest floors', () => {
  for (let seed = 1; seed <= 40; seed += 1) {
    const generator = new RunGenerator(seed);
    const map = generator.generateMap(seed, 26);

    for (const floor of [9, 17, 25]) {
      const nodes = map.filter((node) => node.y === floor - 1);
      assert.ok(nodes.length > 0, `floor ${floor} should exist`);
      assert.deepEqual(
        new Set(nodes.map((node) => node.type)),
        new Set(['Rest']),
        `floor ${floor} should stay a fixed rest floor`,
      );
    }
  }
});

test('RunGenerator constrains opening route expectation spread', () => {
  const maxSpread = 15;

  for (let seed = 1; seed <= 40; seed += 1) {
    const generator = new RunGenerator(seed);
    const map = generator.generateMap(seed, 10);
    const openingNodes = map.filter((node) => node.y === 0);
    const scores = openingNodes.map((node) => routeExpectation(map, node.id, 3));
    const spread = Math.max(...scores) - Math.min(...scores);

    assert.ok(
      spread <= maxSpread,
      `seed ${seed} opening route expectation spread should be <= ${maxSpread}; got ${spread} from ${scores.join(', ')}`,
    );
  }
});

test('RunGenerator opening floors expose at least two distinct route archetypes', () => {
  for (let seed = 1; seed <= 40; seed += 1) {
    const generator = new RunGenerator(seed);
    const map = generator.generateMap(seed, 10);
    for (const floor of [1, 2, 3]) {
      const nodes = map.filter((node) => node.y === floor - 1);
      const uniqueTypes = new Set(nodes.map((node) => node.type));
      assert.ok(uniqueTypes.size >= 2, `floor ${floor} should expose route contrast`);
      assert.ok(nodes.some((node) => node.type === 'Combat'), `floor ${floor} should keep at least one combat lane`);
      assert.ok(
        nodes.some((node) => node.type === 'Event' || node.type === 'Shop' || node.type === 'Rest' || node.type === 'Elite'),
        `floor ${floor} should keep at least one utility/challenge lane`,
      );
    }
  }
});
