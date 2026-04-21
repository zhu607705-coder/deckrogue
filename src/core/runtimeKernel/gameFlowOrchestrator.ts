import type { MapNode } from '@/core/types';
import { RuntimeActionQueue, type RuntimeAction } from '@/core/runtimeKernel/runtimeActionQueue';

export interface GameFlowOrchestratorDeps {
  selectCharacter: (characterId: string) => boolean;
  selectCharacterLegacy: (characterId: string) => boolean;
  syncRuntimeFromLegacyState: (reason: 'select_character' | 'move_to_node') => void;
  moveToNode: (nodeId: string) => boolean;
  moveToNodeLegacy: (nodeId: string) => boolean;
  canMoveToNode: (nodeId: string) => boolean;
  getNode: (nodeId: string) => MapNode | null;
  resolveNodeEntry: (node: MapNode) => void;
  recordFallback: (reason: unknown) => void;
}

export class GameFlowOrchestrator {
  constructor(private readonly deps: GameFlowOrchestratorDeps) {}

  selectCharacter(characterId: string): boolean {
    const queue = new RuntimeActionQueue<{ handled: boolean }>();
    const delegated: RuntimeAction<{ handled: boolean }> = {
      name: 'delegated_select_character',
      execute: (context) => {
        if (!this.deps.selectCharacter(characterId)) {
          return { type: 'continue' };
        }
        this.deps.syncRuntimeFromLegacyState('select_character');
        context.handled = true;
        return { type: 'stop', handled: true };
      },
    };
    const legacy: RuntimeAction<{ handled: boolean }> = {
      name: 'legacy_select_character',
      execute: (context) => {
        if (!this.deps.selectCharacterLegacy(characterId)) {
          return { type: 'stop', handled: false };
        }
        this.deps.syncRuntimeFromLegacyState('select_character');
        context.handled = true;
        return { type: 'stop', handled: true };
      },
    };

    queue.addActions([delegated, legacy]);
    const result = queue.execute({ handled: false });
    return result.type === 'stop' && result.handled;
  }

  moveToNode(nodeId: string): boolean {
    if (!this.deps.canMoveToNode(nodeId)) return false;
    const node = this.deps.getNode(nodeId);
    if (!node) return false;

    if (this.deps.moveToNode(nodeId)) {
      const delegatedNode = this.deps.getNode(nodeId);
      if (!delegatedNode) {
        this.deps.recordFallback(`Delegated node projection missing node: ${nodeId}`);
      } else {
        this.deps.resolveNodeEntry(delegatedNode);
        this.deps.syncRuntimeFromLegacyState('move_to_node');
        return true;
      }
    }

    if (!this.deps.moveToNodeLegacy(nodeId)) return false;
    this.deps.syncRuntimeFromLegacyState('move_to_node');
    return true;
  }
}
