import { GameState, MapNode } from '@/core/types';

export interface RunConfig {
  totalFloors: number;
  nodesPerFloor: number;
  branchFactor: number;
  seed: number;
}

export interface NodePool {
  combat: string[];
  elite: string[];
  boss: string[];
  event: string[];
  shop: string[];
  rest: string[];
}

export class RunGenerator {
  private config: RunConfig;
  private rng: () => number;
  private generatedNodes: MapNode[][] = [];

  constructor(seed: number) {
    this.config = {
      totalFloors: 10,
      nodesPerFloor: 4,
      branchFactor: 3,
      seed
    };
    this.rng = this.createRNG(seed);
  }

  private createRNG(seed: number): () => number {
    let state = seed;
    return () => {
      state = (state * 1103515245 + 12345) & 0x7fffffff;
      return state / 0x7fffffff;
    };
  }

  generateRun(): MapNode[][] {
    this.generatedNodes = [];
    
    for (let floor = 1; floor <= this.config.totalFloors; floor++) {
      const floorNodes = this.generateFloor(floor);
      this.generatedNodes.push(floorNodes);
    }

    this.connectNodes();
    return this.generatedNodes;
  }

  // Backward-compatible API used by older engine code. Regenerates with optional seed/floor override
  // and returns a flattened node list expected by the current UI.
  generateMap(seed?: number, totalFloors?: number): MapNode[] {
    if (typeof seed === 'number') {
      this.config.seed = seed;
      this.rng = this.createRNG(seed);
    }
    if (typeof totalFloors === 'number' && totalFloors > 0) {
      this.config.totalFloors = totalFloors;
    }

    return this.generateRun().flat();
  }

  private generateFloor(floor: number): MapNode[] {
    const nodes: MapNode[] = [];
    const nodeCount = this.getNodeCountForFloor(floor);

    for (let i = 0; i < nodeCount; i++) {
      const node = this.createNode(floor, i, nodeCount);
      nodes.push(node);
    }

    return nodes;
  }

  private getNodeCountForFloor(floor: number): number {
    const lastFloor = this.config.totalFloors;
    if (floor === lastFloor) return 1;
    if (floor === lastFloor - 1) return 2;
    if (floor === 1) return 3 + (this.rng() < 0.5 ? 1 : 0);
    if (floor <= 3) return 4;

    const varianceRoll = this.rng();
    const variance = varianceRoll < 0.25 ? -1 : varianceRoll > 0.8 ? 1 : 0;
    return Math.max(3, Math.min(5, this.config.nodesPerFloor + variance));
  }

  private createNode(floor: number, index: number, total: number): MapNode {
    const type = this.determineNodeType(floor);
    
    return {
      id: `floor_${floor}_node_${index}`,
      type,
      revealed: floor === 1,
      next: [],
      x: (index + 1) / (total + 1),
      y: floor - 1
    };
  }

  private determineNodeType(floor: number): MapNode['type'] {
    const roll = this.rng();

    const lastFloor = this.config.totalFloors;
    if (floor === lastFloor) return 'Boss';
    if (floor === lastFloor - 1) return 'Rest';

    const depth = floor / Math.max(1, lastFloor);
    const eliteThreshold = 0.06 + depth * 0.18;
    const eventThreshold = eliteThreshold + 0.18;
    const shopThreshold = eventThreshold + 0.14;
    const restThreshold = shopThreshold + 0.12;

    if (roll < eliteThreshold) return 'Elite';
    if (roll < eventThreshold) return 'Event';
    if (roll < shopThreshold) return 'Shop';
    if (roll < restThreshold) return 'Rest';
    return 'Combat';
  }

  private connectNodes(): void {
    for (let floor = 0; floor < this.generatedNodes.length - 1; floor++) {
      const currentFloor = this.generatedNodes[floor];
      const nextFloor = this.generatedNodes[floor + 1];
      const inboundCount = new Map(nextFloor.map(node => [node.id, 0]));

      currentFloor.forEach(node => {
        const reachableNodes = nextFloor.filter(
          nextNode => Math.abs(nextNode.x - node.x) <= 0.66
        );

        const pool = reachableNodes.length > 0 ? reachableNodes : nextFloor;
        const shuffled = [...pool].sort(() => this.rng() - 0.5);
        const desired = Math.min(
          shuffled.length,
          Math.max(1, 1 + Math.floor(this.rng() * this.config.branchFactor))
        );
        const chosen = shuffled.slice(0, desired);
        const uniqueIds = [...new Set(chosen.map(n => n.id))];
        node.next.push(...uniqueIds);
        uniqueIds.forEach(id => inboundCount.set(id, (inboundCount.get(id) || 0) + 1));
      });

      // Ensure every node on the next floor is reachable by at least one path.
      for (const nextNode of nextFloor) {
        if ((inboundCount.get(nextNode.id) || 0) > 0) continue;

        const closest = [...currentFloor].sort(
          (a, b) => Math.abs(a.x - nextNode.x) - Math.abs(b.x - nextNode.x)
        )[0];
        if (!closest) continue;
        if (!closest.next.includes(nextNode.id)) {
          closest.next.push(nextNode.id);
        }
      }
    }
  }

  revealPath(fromNodeId: string): void {
    const visited = new Set<string>();
    const queue = [fromNodeId];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) continue;
      visited.add(currentId);

      for (const floor of this.generatedNodes) {
        const node = floor.find(n => n.id === currentId);
        if (node) {
          node.revealed = true;
          node.next.forEach(nextId => {
            if (!visited.has(nextId)) {
              queue.push(nextId);
            }
          });
          break;
        }
      }
    }
  }

  getNode(nodeId: string): MapNode | null {
    for (const floor of this.generatedNodes) {
      const node = floor.find(n => n.id === nodeId);
      if (node) return node;
    }
    return null;
  }

  getNextAvailableNodes(currentNodeId: string): MapNode[] {
    const currentNode = this.getNode(currentNodeId);
    if (!currentNode) return [];

    return currentNode.next
      .map(id => this.getNode(id))
      .filter((node): node is MapNode => node !== null && node.revealed);
  }

  getAllRevealedNodes(): MapNode[] {
    return this.generatedNodes
      .flat()
      .filter(node => node.revealed);
  }

  isRunComplete(currentFloor: number): boolean {
    return currentFloor >= this.config.totalFloors;
  }

  getTotalFloors(): number {
    return this.config.totalFloors;
  }
}

export const createRunGenerator = (seed: number): RunGenerator => {
  return new RunGenerator(seed);
};

export const runGenerator = new RunGenerator(Date.now());
