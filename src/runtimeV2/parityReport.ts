import type { RuleSnapshot } from './contracts';

export interface MapSnapshotComparison {
  metadataMatches: boolean;
  topologyMatches: boolean;
  metadataMismatchNodeIds: string[];
  topologyMismatchNodeIds: string[];
}

export interface ParityReportEntry {
  scenario: string;
  seed: number;
  passed: boolean;
  stableDiffCount: number;
  metadataMatches?: boolean;
  topologyMatches?: boolean;
  metadataMismatchNodeIds?: string[];
  topologyMismatchNodeIds?: string[];
}

export interface ParityReportSummary {
  scenario: string;
  total: number;
  passed: number;
  failed: number;
  failureSeeds: number[];
  topologyHotspots: Array<{
    nodeId: string;
    count: number;
  }>;
}

export function compareMapSnapshots(legacy: RuleSnapshot, candidate: RuleSnapshot): MapSnapshotComparison {
  const candidateNodeMap = new Map(candidate.map.nodes.map((node) => [node.id, node]));
  const metadataMismatchNodeIds: string[] = [];
  const topologyMismatchNodeIds: string[] = [];

  for (const legacyNode of legacy.map.nodes) {
    const candidateNode = candidateNodeMap.get(legacyNode.id);
    if (!candidateNode) {
      metadataMismatchNodeIds.push(legacyNode.id);
      topologyMismatchNodeIds.push(legacyNode.id);
      continue;
    }

    if (
      legacyNode.type !== candidateNode.type ||
      legacyNode.x !== candidateNode.x ||
      legacyNode.y !== candidateNode.y ||
      legacyNode.revealed !== candidateNode.revealed
    ) {
      metadataMismatchNodeIds.push(legacyNode.id);
    }

    if (JSON.stringify(legacyNode.next) !== JSON.stringify(candidateNode.next)) {
      topologyMismatchNodeIds.push(legacyNode.id);
    }
  }

  return {
    metadataMatches: metadataMismatchNodeIds.length === 0,
    topologyMatches: topologyMismatchNodeIds.length === 0,
    metadataMismatchNodeIds,
    topologyMismatchNodeIds,
  };
}

export function summarizeParityReportEntries(entries: ParityReportEntry[]): ParityReportSummary[] {
  const grouped = new Map<string, ParityReportEntry[]>();
  for (const entry of entries) {
    const group = grouped.get(entry.scenario) ?? [];
    group.push(entry);
    grouped.set(entry.scenario, group);
  }

  return Array.from(grouped.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([scenario, scenarioEntries]) => {
      const topologyCounts = new Map<string, number>();
      for (const entry of scenarioEntries.filter((candidate) => !candidate.passed)) {
        for (const nodeId of entry.topologyMismatchNodeIds || []) {
          topologyCounts.set(nodeId, (topologyCounts.get(nodeId) || 0) + 1);
        }
      }

      return {
        scenario,
        total: scenarioEntries.length,
        passed: scenarioEntries.filter((entry) => entry.passed).length,
        failed: scenarioEntries.filter((entry) => !entry.passed).length,
        failureSeeds: scenarioEntries.filter((entry) => !entry.passed).map((entry) => entry.seed),
        topologyHotspots: Array.from(topologyCounts.entries())
          .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
          .map(([nodeId, count]) => ({ nodeId, count })),
      };
    });
}

export function isPerfectParityReport(summaries: ParityReportSummary[]): boolean {
  return summaries.every((summary) => summary.failed === 0 && summary.passed === summary.total);
}
