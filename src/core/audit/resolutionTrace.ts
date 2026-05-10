/**
 * @file resolutionTrace.ts
 * @description 解析追踪 - 记录动作解析流水线的完整执行追踪
 *
 * 主要职责:
 * - 定义 ResolutionTrace 接口，记录触发窗口、解析意图、解析步骤等
 * - 追踪动作从触发到完成的完整生命周期
 * - 记录解析上下文 (回合、战斗ID、房间ID)
 * - 为调试和审计提供解析过程的完整记录
 */
import type { TriggerWindow, TriggerSource, ResolutionIntent, ResolutionStep } from '@/core/actions/resolutionTypes';
import type { ResourceMutation } from '@/core/actions/mechanicDescriptor';

export interface ResolutionTrace {
  traceId: string;
  runId: string;
  timestamp: number;
  
  trigger: {
    window: TriggerWindow;
    source: TriggerSource;
    sourceId: string;
  };
  
  intents: ResolutionIntent[];
  steps: ResolutionStep[];
  
  result: {
    success: boolean;
    duration: number;
    error?: string;
  };
  
  context?: {
    turn?: number;
    combatId?: string;
    roomId?: string;
    screen?: string;
  };
}

export interface ResolutionTraceSummary {
  totalTraces: number;
  tracesByWindow: Record<TriggerWindow, number>;
  tracesBySource: Record<TriggerSource, number>;
  averageIntentsPerTrace: number;
  averageStepsPerTrace: number;
  averageDuration: number;
  errorRate: number;
}

export interface TriggerFrequencyReport {
  reportId: string;
  runId: string;
  timestamp: number;
  
  byWindow: {
    window: TriggerWindow;
    count: number;
    averageIntents: number;
    averageDuration: number;
    errorCount: number;
  }[];
  
  bySource: {
    source: TriggerSource;
    count: number;
    averageIntents: number;
    topWindows: TriggerWindow[];
  }[];
  
  byMechanic: {
    mechanicId: string;
    mechanicType: string;
    count: number;
    contributionScore: number;
  }[];
  
  summary: {
    totalTriggers: number;
    totalIntents: number;
    uniqueMechanics: number;
    topWindow: TriggerWindow;
    topSource: TriggerSource;
  };
}

export interface SettlementLatencyProfile {
  profileId: string;
  runId: string;
  timestamp: number;
  
  overall: {
    averageStepDuration: number;
    maxStepDuration: number;
    minStepDuration: number;
    p50Duration: number;
    p95Duration: number;
    p99Duration: number;
    totalSteps: number;
    totalDuration: number;
  };
  
  byWindow: {
    window: TriggerWindow;
    count: number;
    average: number;
    max: number;
    min: number;
    p95: number;
  }[];
  
  performance: {
    slowSteps: {
      stepId: string;
      window: TriggerWindow;
      duration: number;
    }[];
    slowThreshold: number;
  };
}

export interface MechanicAuditSnapshot {
  auditId: string;
  runId: string;
  timestamp: number;
  
  mechanic: {
    id: string;
    type: 'enchantment' | 'affliction' | 'character_resource' | 'relic' | 'potion' | 'synergy' | 'room_bonus';
    scope: 'persistent' | 'combat' | 'room';
  };
  
  trigger: {
    window: TriggerWindow;
    conditionMet: boolean;
    source: TriggerSource;
    sourceId: string;
  };
  
  result: {
    triggered: boolean;
    mutationsApplied: ResourceMutation[];
    sideEffectsTriggered: number;
    intentsGenerated: number;
  };
  
  context: {
    turn?: number;
    combatId?: string;
    roomId?: string;
    screen?: string;
  };
}

export interface MechanicAuditSummary {
  totalAudits: number;
  auditsByMechanic: Record<string, number>;
  auditsByWindow: Record<TriggerWindow, number>;
  auditsByType: Record<string, number>;
  triggerRate: number;
  averageMutationsPerTrigger: number;
  averageSideEffectsPerTrigger: number;
}

export class ResolutionTraceCollector {
  private traces: ResolutionTrace[] = [];
  private currentRunId: string = '';
  private currentSeed: number = 0;

  setRunContext(runId: string, seed: number): void {
    this.currentRunId = runId;
    this.currentSeed = seed;
  }

  recordTrace(trace: Omit<ResolutionTrace, 'traceId' | 'runId' | 'timestamp'>): string {
    const traceId = `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const fullTrace: ResolutionTrace = {
      ...trace,
      traceId,
      runId: this.currentRunId,
      timestamp: Date.now(),
    };
    
    this.traces.push(fullTrace);
    return traceId;
  }

  getTraces(): ResolutionTrace[] {
    return [...this.traces];
  }

  getTracesByWindow(window: TriggerWindow): ResolutionTrace[] {
    return this.traces.filter(t => t.trigger.window === window);
  }

  getTracesBySource(source: TriggerSource): ResolutionTrace[] {
    return this.traces.filter(t => t.trigger.source === source);
  }

  getSummary(): ResolutionTraceSummary {
    const byWindow: Record<TriggerWindow, number> = {} as Record<TriggerWindow, number>;
    const bySource: Record<TriggerSource, number> = {} as Record<TriggerSource, number>;
    
    let totalIntents = 0;
    let totalSteps = 0;
    let totalDuration = 0;
    let errors = 0;
    
    for (const trace of this.traces) {
      byWindow[trace.trigger.window] = (byWindow[trace.trigger.window] || 0) + 1;
      bySource[trace.trigger.source] = (bySource[trace.trigger.source] || 0) + 1;
      
      totalIntents += trace.intents.length;
      totalSteps += trace.steps.length;
      totalDuration += trace.result.duration;
      
      if (!trace.result.success) {
        errors++;
      }
    }
    
    return {
      totalTraces: this.traces.length,
      tracesByWindow: byWindow,
      tracesBySource: bySource,
      averageIntentsPerTrace: totalIntents / Math.max(1, this.traces.length),
      averageStepsPerTrace: totalSteps / Math.max(1, this.traces.length),
      averageDuration: totalDuration / Math.max(1, this.traces.length),
      errorRate: errors / Math.max(1, this.traces.length),
    };
  }

  exportToJson(): string {
    return JSON.stringify({
      runId: this.currentRunId,
      seed: this.currentSeed,
      exportedAt: Date.now(),
      traces: this.traces,
      summary: this.getSummary(),
    }, null, 2);
  }

  reset(): void {
    this.traces = [];
  }
}

export class MechanicAuditCollector {
  private audits: MechanicAuditSnapshot[] = [];
  private currentRunId: string = '';

  setRunContext(runId: string): void {
    this.currentRunId = runId;
  }

  recordAudit(audit: Omit<MechanicAuditSnapshot, 'auditId' | 'runId' | 'timestamp'>): string {
    const auditId = `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const fullAudit: MechanicAuditSnapshot = {
      ...audit,
      auditId,
      runId: this.currentRunId,
      timestamp: Date.now(),
    };
    
    this.audits.push(fullAudit);
    return auditId;
  }

  getAudits(): MechanicAuditSnapshot[] {
    return [...this.audits];
  }

  getAuditsByMechanic(mechanicId: string): MechanicAuditSnapshot[] {
    return this.audits.filter(a => a.mechanic.id === mechanicId);
  }

  getAuditsByWindow(window: TriggerWindow): MechanicAuditSnapshot[] {
    return this.audits.filter(a => a.trigger.window === window);
  }

  getSummary(): MechanicAuditSummary {
    const byMechanic: Record<string, number> = {};
    const byWindow: Record<TriggerWindow, number> = {} as Record<TriggerWindow, number>;
    const byType: Record<string, number> = {};
    
    let triggered = 0;
    let totalMutations = 0;
    let totalSideEffects = 0;
    
    for (const audit of this.audits) {
      byMechanic[audit.mechanic.id] = (byMechanic[audit.mechanic.id] || 0) + 1;
      byWindow[audit.trigger.window] = (byWindow[audit.trigger.window] || 0) + 1;
      byType[audit.mechanic.type] = (byType[audit.mechanic.type] || 0) + 1;
      
      if (audit.result.triggered) {
        triggered++;
        totalMutations += audit.result.mutationsApplied.length;
        totalSideEffects += audit.result.sideEffectsTriggered;
      }
    }
    
    return {
      totalAudits: this.audits.length,
      auditsByMechanic: byMechanic,
      auditsByWindow: byWindow,
      auditsByType: byType,
      triggerRate: triggered / Math.max(1, this.audits.length),
      averageMutationsPerTrigger: totalMutations / Math.max(1, triggered),
      averageSideEffectsPerTrigger: totalSideEffects / Math.max(1, triggered),
    };
  }

  exportToJson(): string {
    return JSON.stringify({
      runId: this.currentRunId,
      exportedAt: Date.now(),
      audits: this.audits,
      summary: this.getSummary(),
    }, null, 2);
  }

  reset(): void {
    this.audits = [];
  }
}

export function generateTriggerFrequencyReport(
  traces: ResolutionTrace[],
  audits: MechanicAuditSnapshot[],
  runId: string
): TriggerFrequencyReport {
  const byWindow: Map<TriggerWindow, { count: number; intents: number; duration: number; errors: number }> = new Map();
  const bySource: Map<TriggerSource, { count: number; intents: number; windows: TriggerWindow[] }> = new Map();
  const byMechanic: Map<string, { type: string; count: number; score: number }> = new Map();
  
  for (const trace of traces) {
    const window = trace.trigger.window;
    const source = trace.trigger.source;
    
    if (!byWindow.has(window)) {
      byWindow.set(window, { count: 0, intents: 0, duration: 0, errors: 0 });
    }
    const windowData = byWindow.get(window)!;
    windowData.count++;
    windowData.intents += trace.intents.length;
    windowData.duration += trace.result.duration;
    if (!trace.result.success) windowData.errors++;
    
    if (!bySource.has(source)) {
      bySource.set(source, { count: 0, intents: 0, windows: [] });
    }
    const sourceData = bySource.get(source)!;
    sourceData.count++;
    sourceData.intents += trace.intents.length;
    if (!sourceData.windows.includes(window)) {
      sourceData.windows.push(window);
    }
  }
  
  for (const audit of audits) {
    const id = audit.mechanic.id;
    if (!byMechanic.has(id)) {
      byMechanic.set(id, { type: audit.mechanic.type, count: 0, score: 0 });
    }
    const mechanicData = byMechanic.get(id)!;
    mechanicData.count++;
    if (audit.result.triggered) {
      mechanicData.score += audit.result.mutationsApplied.length * 0.5 + audit.result.sideEffectsTriggered * 0.3;
    }
  }
  
  const totalTriggers = traces.length;
  const totalIntents = traces.reduce((sum, t) => sum + t.intents.length, 0);
  
  let topWindow: TriggerWindow = 'on_command';
  let topSource: TriggerSource = 'card';
  let maxCount = 0;
  
  for (const [window, data] of byWindow) {
    if (data.count > maxCount) {
      maxCount = data.count;
      topWindow = window;
    }
  }
  
  maxCount = 0;
  for (const [source, data] of bySource) {
    if (data.count > maxCount) {
      maxCount = data.count;
      topSource = source;
    }
  }
  
  return {
    reportId: `report_${Date.now()}`,
    runId,
    timestamp: Date.now(),
    
    byWindow: Array.from(byWindow.entries()).map(([window, data]) => ({
      window,
      count: data.count,
      averageIntents: data.intents / Math.max(1, data.count),
      averageDuration: data.duration / Math.max(1, data.count),
      errorCount: data.errors,
    })),
    
    bySource: Array.from(bySource.entries()).map(([source, data]) => ({
      source,
      count: data.count,
      averageIntents: data.intents / Math.max(1, data.count),
      topWindows: data.windows.slice(0, 3),
    })),
    
    byMechanic: Array.from(byMechanic.entries()).map(([id, data]) => ({
      mechanicId: id,
      mechanicType: data.type,
      count: data.count,
      contributionScore: data.score,
    })),
    
    summary: {
      totalTriggers,
      totalIntents,
      uniqueMechanics: byMechanic.size,
      topWindow,
      topSource,
    },
  };
}

export function generateSettlementLatencyProfile(
  traces: ResolutionTrace[],
  runId: string,
  slowThreshold: number = 100
): SettlementLatencyProfile {
  const allDurations: number[] = [];
  const byWindow: Map<TriggerWindow, number[]> = new Map();
  
  for (const trace of traces) {
    for (const step of trace.steps) {
      allDurations.push(step.duration);
      
      if (!byWindow.has(trace.trigger.window)) {
        byWindow.set(trace.trigger.window, []);
      }
      byWindow.get(trace.trigger.window)!.push(step.duration);
    }
  }
  
  allDurations.sort((a, b) => a - b);
  
  const slowSteps: SettlementLatencyProfile['performance']['slowSteps'] = [];
  for (const trace of traces) {
    for (const step of trace.steps) {
      if (step.duration > slowThreshold) {
        slowSteps.push({
          stepId: step.stepId,
          window: trace.trigger.window,
          duration: step.duration,
        });
      }
    }
  }
  
  const p50 = allDurations[Math.floor(allDurations.length * 0.5)] || 0;
  const p95 = allDurations[Math.floor(allDurations.length * 0.95)] || 0;
  const p99 = allDurations[Math.floor(allDurations.length * 0.99)] || 0;
  
  return {
    profileId: `profile_${Date.now()}`,
    runId,
    timestamp: Date.now(),
    
    overall: {
      averageStepDuration: allDurations.reduce((a, b) => a + b, 0) / Math.max(1, allDurations.length),
      maxStepDuration: Math.max(0, ...allDurations),
      minStepDuration: Math.min(Infinity, ...allDurations),
      p50Duration: p50,
      p95Duration: p95,
      p99Duration: p99,
      totalSteps: allDurations.length,
      totalDuration: allDurations.reduce((a, b) => a + b, 0),
    },
    
    byWindow: Array.from(byWindow.entries()).map(([window, durations]) => {
      const sorted = [...durations].sort((a, b) => a - b);
      return {
        window,
        count: durations.length,
        average: durations.reduce((a, b) => a + b, 0) / Math.max(1, durations.length),
        max: Math.max(0, ...durations),
        min: Math.min(Infinity, ...durations),
        p95: sorted[Math.floor(sorted.length * 0.95)] || 0,
      };
    }),
    
    performance: {
      slowSteps,
      slowThreshold,
    },
  };
}
