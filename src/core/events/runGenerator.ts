import { GameState, MapNode } from '@/core/types';
import { safeArrayAccess } from '@/core/utils/safeArray';

export interface ChapterConfig {
  chapterIndex: number;
  floors: number;
  bossFloor: number;
  restFloor: number;
}

export interface ChapterNodeWeights {
  elite: number;
  event: number;
  shop: number;
  rest: number;
}

export interface RunConfig {
  totalFloors: number;
  nodesPerFloor: number;
  branchFactor: number;
  seed: number;
  chapters: ChapterConfig[];
  chapterWeights: Record<number, ChapterNodeWeights>;
  mapWeightDelta?: {
    elite?: number;
    event?: number;
    shop?: number;
    rest?: number;
  };
}

export interface NodePool {
  combat: string[];
  elite: string[];
  boss: string[];
  event: string[];
  shop: string[];
  rest: string[];
}

export const DEFAULT_CHAPTER_WEIGHTS: Record<number, ChapterNodeWeights> = {
  1: { elite: 0.24, event: 0.18, shop: 0.14, rest: 0.12 },
  2: {
    elite: 0.14 + 0.03 * (1 - 1 / 8),
    event: 0.18 - 0.02 * (1 - 1 / 8),
    shop: 0.08 - 0.00 * (1 - 1 / 8),
    rest: 0.08 - 0.00 * (1 - 1 / 8)
  },
  3: {
    elite: 0.16 + 0.08 * (1 - 1 / 8),
    event: 0.20 - 0.02 * (1 - 1 / 8),
    shop: 0.08 - 0.00 * (1 - 1 / 8),
    rest: 0.08 - 0.04 * (1 - 1 / 8)
  }
};

export class RunGenerator {
  private config: RunConfig;
  private rng: () => number;
  private generatedNodes: MapNode[][] = [];
  private lastNodeType: string = '';
  private consecutiveSameTypeCount: number = 0;
  private readonly MAX_CONSECUTIVE_SAME = 2;
  private readonly SPECIAL_ROOMS = new Set(['Event', 'Shop', 'Rest']);
  private readonly ELITE_ROOMS = new Set(['Elite', 'Boss']);
  private currentChapter: number = 1;
  private chapterTransitionFloor: number = 10;

  constructor(seed: number) {
    this.config = {
      totalFloors: 26,
      nodesPerFloor: 4,
      branchFactor: 3,
      seed,
      chapters: [
        { chapterIndex: 1, floors: 10, bossFloor: 10, restFloor: 9 },
        { chapterIndex: 2, floors: 8, bossFloor: 8, restFloor: 7 },
        { chapterIndex: 3, floors: 8, bossFloor: 8, restFloor: 7 }
      ],
      chapterWeights: { ...DEFAULT_CHAPTER_WEIGHTS }
    };
    this.rng = this.createRNG(seed);
    this.chapterTransitionFloor = this.config.chapters[0].floors;
  }

  private createRNG(seed: number): () => number {
    let state = seed;
    return () => {
      state = (state * 1103515245 + 12345) & 0x7fffffff;
      return state / 0x7fffffff;
    };
  }

  generateRun(): MapNode[][] {
    this.resetGenerationState();
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

  private resetGenerationState(): void {
    this.lastNodeType = '';
    this.consecutiveSameTypeCount = 0;
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

  private updateCurrentChapter(floor: number): void {
    const chapter1End = this.config.chapters[0].floors;
    const chapter2End = chapter1End + this.config.chapters[1].floors;

    if (floor <= chapter1End) {
      this.currentChapter = 1;
      this.chapterTransitionFloor = chapter1End;
    } else if (floor <= chapter2End) {
      this.currentChapter = 2;
      this.chapterTransitionFloor = chapter2End;
    } else {
      this.currentChapter = 3;
      this.chapterTransitionFloor = this.config.totalFloors;
    }
  }

  private getChapterConfig(floor: number): ChapterConfig {
    const chapter1End = this.config.chapters[0].floors;
    const chapter2End = chapter1End + this.config.chapters[1].floors;

    if (floor <= chapter1End) {
      return this.config.chapters[0];
    } else if (floor <= chapter2End) {
      return this.config.chapters[1];
    } else {
      return this.config.chapters[2];
    }
  }

  private getChapterWeights(floor: number): ChapterNodeWeights {
    const chapter1End = this.config.chapters[0].floors;
    const chapter2End = chapter1End + this.config.chapters[1].floors;

    let chapterIndex = 1;
    if (floor <= chapter1End) {
      chapterIndex = 1;
    } else if (floor <= chapter2End) {
      chapterIndex = 2;
    } else {
      chapterIndex = 3;
    }
    return this.config.chapterWeights[chapterIndex];
  }

  private getChapterLastFloor(floor: number): number {
    const chapterConfig = this.getChapterConfig(floor);
    let lastFloor = 0;
    for (let i = 0; i < chapterConfig.chapterIndex; i++) {
      lastFloor += this.config.chapters[i].floors;
    }
    return lastFloor;
  }

  private getDepthInChapter(floor: number): number {
    const chapterConfig = this.getChapterConfig(floor);
    let chapterStartFloor = 0;
    for (let i = 0; i < chapterConfig.chapterIndex - 1; i++) {
      chapterStartFloor += this.config.chapters[i].floors;
    }
    return (floor - chapterStartFloor) / chapterConfig.floors;
  }

  private getNodeCountForFloor(floor: number): number {
    const lastFloor = this.getChapterLastFloor(floor);
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

    this.updateCurrentChapter(floor);
    const chapterConfig = this.getChapterConfig(floor);
    const weights = { ...this.getChapterWeights(floor) };
    const lastFloor = this.getChapterLastFloor(floor);

    if (floor === lastFloor) return 'Boss';
    if (floor === lastFloor - 1) return 'Rest';

    const delta = this.config.mapWeightDelta || {};
    if (delta.event) weights.event = Math.max(0, weights.event + delta.event);
    if (delta.rest) weights.rest = Math.max(0, weights.rest + delta.rest);
    if (delta.elite) weights.elite = Math.max(0, weights.elite + delta.elite);
    if (delta.shop) weights.shop = Math.max(0, weights.shop + delta.shop);

    const total = weights.elite + weights.event + weights.shop + weights.rest;
    const normalized = total >= 1 ? {
      elite: weights.elite / total,
      event: weights.event / total,
      shop: weights.shop / total,
      rest: weights.rest / total
    } : weights;

    const eliteThreshold = normalized.elite;
    const eventThreshold = eliteThreshold + normalized.event;
    const shopThreshold = eventThreshold + normalized.shop;
    const restThreshold = shopThreshold + normalized.rest;

    let typeRoll = roll;
    let selectedType: MapNode['type'];

    if (typeRoll < eliteThreshold) selectedType = 'Elite';
    else if (typeRoll < eventThreshold) selectedType = 'Event';
    else if (typeRoll < shopThreshold) selectedType = 'Shop';
    else if (typeRoll < restThreshold) selectedType = 'Rest';
    else selectedType = 'Combat';

    const isSpecialRoom = this.SPECIAL_ROOMS.has(selectedType);
    const isEliteRoom = this.ELITE_ROOMS.has(selectedType);

    if (selectedType === this.lastNodeType) {
      this.consecutiveSameTypeCount++;
    } else {
      this.consecutiveSameTypeCount = 1;
      this.lastNodeType = selectedType;
    }

    if (this.consecutiveSameTypeCount > this.MAX_CONSECUTIVE_SAME) {
      const availableTypes: MapNode['type'][] = [];
      
      if (!this.SPECIAL_ROOMS.has(this.lastNodeType)) {
        availableTypes.push('Event', 'Shop', 'Rest', 'Combat');
      } else if (this.lastNodeType === 'Event' || this.lastNodeType === 'Shop' || this.lastNodeType === 'Rest') {
        availableTypes.push('Combat', 'Elite');
      } else if (this.lastNodeType === 'Elite') {
        availableTypes.push('Combat', 'Event', 'Shop', 'Rest');
      }

      if (availableTypes.length > 0 && floor < lastFloor - 1) {
        const chosen = safeArrayAccess(availableTypes, Math.floor(this.rng() * availableTypes.length));
        if (chosen) {
          selectedType = chosen;
          this.consecutiveSameTypeCount = 1;
          this.lastNodeType = selectedType;
        }
      }
    }

    if (isSpecialRoom && this.consecutiveSameTypeCount >= this.MAX_CONSECUTIVE_SAME) {
      if (floor < lastFloor - 1) {
        const fallbackTypes: MapNode['type'][] = [];
        if (selectedType !== 'Event') fallbackTypes.push('Event');
        if (selectedType !== 'Shop') fallbackTypes.push('Shop');
        if (selectedType !== 'Rest') fallbackTypes.push('Rest');
        
        const combatChance = 0.6;
        if (fallbackTypes.length > 0 && this.rng() < combatChance) {
          selectedType = 'Combat';
        } else if (fallbackTypes.length > 0) {
          const chosen = safeArrayAccess(fallbackTypes, Math.floor(this.rng() * fallbackTypes.length));
          if (chosen) {
            selectedType = chosen;
          }
        }
        this.consecutiveSameTypeCount = 1;
        this.lastNodeType = selectedType;
      }
    }

    if (selectedType === 'Elite' && this.isEarlyFloorInChapter(floor)) {
      selectedType = 'Combat';
      this.consecutiveSameTypeCount = 1;
      this.lastNodeType = selectedType;
    }

    return selectedType;
  }

  private isEarlyFloorInChapter(floor: number): boolean {
    const chapterConfig = this.getChapterConfig(floor);
    if (chapterConfig.chapterIndex === 1) {
      return floor <= 2;
    } else {
      return floor <= this.config.chapters[0].floors + 2;
    }
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
        const shuffled = this.legacyRandomSort(pool);
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

  private legacyRandomSort(items: MapNode[]): MapNode[] {
    const sortedItems = [...items];
    if (sortedItems.length < 2) return sortedItems;

    let runEnd = 2;
    let descending = (this.rng() - 0.5) < 0;
    while (runEnd < sortedItems.length) {
      const comparator = this.rng() - 0.5;
      if (descending) {
        if (comparator >= 0) break;
      } else {
        if (comparator < 0) break;
      }
      runEnd++;
    }

    if (descending) {
      const prefix = sortedItems.slice(0, runEnd);
      prefix.reverse();
      for (let i = 0; i < runEnd; i++) {
        sortedItems[i] = prefix[i];
      }
    }

    for (let index = runEnd; index < sortedItems.length; index++) {
      const currentItem = sortedItems[index];
      let low = 0;
      let high = index;
      while (low < high) {
        const mid = Math.floor((low + high) / 2);
        if ((this.rng() - 0.5) < 0) {
          high = mid;
        } else {
          low = mid + 1;
        }
      }

      let cursor = index;
      while (cursor > low) {
        sortedItems[cursor] = sortedItems[cursor - 1];
        cursor--;
      }
      sortedItems[low] = currentItem;
    }
    return sortedItems;
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

  getCurrentChapter(): number {
    return this.currentChapter;
  }

  getChapterFloors(chapterIndex: number): number {
    const chapter = this.config.chapters.find(c => c.chapterIndex === chapterIndex);
    return chapter ? chapter.floors : 0;
  }

  getChapterBossFloor(chapterIndex: number): number {
    const chapter = this.config.chapters.find(c => c.chapterIndex === chapterIndex);
    return chapter ? chapter.bossFloor : 0;
  }

  isChapterBoss(floor: number): boolean {
    const chapterConfig = this.getChapterConfig(floor);
    const chapterLastFloor = this.getChapterLastFloor(floor);
    return floor === chapterLastFloor;
  }

  isChapterRest(floor: number): boolean {
    const chapterLastFloor = this.getChapterLastFloor(floor);
    return floor === chapterLastFloor - 1;
  }
}

export const createRunGenerator = (seed: number): RunGenerator => {
  return new RunGenerator(seed);
};

export const runGenerator = new RunGenerator(Date.now());
