import type { RuleSnapshot } from '@/runtimeV2/contracts';
import type { ResolutionTrace } from '@/core/audit/resolutionTrace';

export interface ReplayExport {
  version: '1.0';
  exportedAt: number;
  
  runMetadata: {
    runId: string;
    seed: number;
    characterId: string;
    startedAt: number;
    endedAt: number;
    finalScreen: string;
    victory: boolean;
  };
  
  commandLog: {
    sequence: number;
    command: string;
    timestamp: number;
    snapshot?: RuleSnapshot;
  }[];
  
  traceLog: ResolutionTrace[];
  
  performance: {
    totalPlayTime: number;
    averageTurnTime: number;
    totalCommands: number;
    averageCommandsPerTurn: number;
  };
  
  checksum: string;
}

export interface CrashBundle {
  version: '1.0';
  capturedAt: number;
  
  error: {
    type: string;
    message: string;
    stack?: string;
    timestamp: number;
  };
  
  state: {
    screen: string;
    phase: string;
    turn?: number;
    combatId?: string;
    roomId?: string;
  };
  
  snapshot?: RuleSnapshot;
  
  recentCommands: {
    command: string;
    timestamp: number;
  }[];
  
  recentTraces: ResolutionTrace[];
  
  systemInfo: {
    platform: 'web' | 'desktop' | 'mobile';
    browser?: string;
    os?: string;
    version: string;
  };
  
  reproduction: {
    seed: number;
    characterId: string;
    commandSequence: string[];
  };
}

export interface RuntimeDiagnosticsPayload {
  version: '1.0';
  capturedAt: number;
  
  session: {
    sessionId: string;
    startedAt: number;
    lastActivityAt: number;
    totalPlayTime: number;
  };
  
  performance: {
    startupTime: number;
    averageFrameTime: number;
    maxFrameTime: number;
    memoryPeak: number;
    memoryAverage: number;
  };
  
  resolution: {
    totalTraces: number;
    averageTraceDuration: number;
    maxTraceDuration: number;
    tracesByWindow: Record<string, number>;
    errorRate: number;
  };
  
  content: {
    cardsLoaded: number;
    enemiesLoaded: number;
    relicsLoaded: number;
    loadErrors: string[];
  };
  
  replay: {
    totalReplays: number;
    successfulReplays: number;
    replayAccuracy: number;
  };
  
  errors: {
    total: number;
    byType: Record<string, number>;
    recent: {
      type: string;
      message: string;
      timestamp: number;
    }[];
  };
}

export interface ContentBundleManifest {
  version: '1.0';
  generatedAt: number;
  
  bundle: {
    id: string;
    checksum: string;
    size: number;
  };
  
  content: {
    characters: {
      count: number;
      ids: string[];
      checksum: string;
    };
    cards: {
      count: number;
      ids: string[];
      checksum: string;
    };
    enemies: {
      count: number;
      ids: string[];
      checksum: string;
    };
    relics: {
      count: number;
      ids: string[];
      checksum: string;
    };
    potions: {
      count: number;
      ids: string[];
      checksum: string;
    };
    enchantments: {
      count: number;
      ids: string[];
      checksum: string;
    };
    events: {
      count: number;
      ids: string[];
      checksum: string;
    };
  };
  
  compatibility: {
    minEngineVersion: string;
    maxEngineVersion: string;
    supportedPlatforms: ('web' | 'desktop' | 'mobile')[];
  };
}

export class ReplayExporter {
  private commands: ReplayExport['commandLog'] = [];
  private traces: ResolutionTrace[] = [];
  private startTime: number = 0;
  
  startRun(runId: string, seed: number, characterId: string): void {
    this.startTime = Date.now();
    this.commands = [];
    this.traces = [];
  }
  
  recordCommand(command: string, snapshot?: RuleSnapshot): void {
    this.commands.push({
      sequence: this.commands.length,
      command,
      timestamp: Date.now(),
      snapshot,
    });
  }
  
  recordTrace(trace: ResolutionTrace): void {
    this.traces.push(trace);
  }
  
  export(
    runId: string,
    seed: number,
    characterId: string,
    victory: boolean,
    finalScreen: string
  ): ReplayExport {
    const endTime = Date.now();
    
    return {
      version: '1.0',
      exportedAt: endTime,
      runMetadata: {
        runId,
        seed,
        characterId,
        startedAt: this.startTime,
        endedAt: endTime,
        finalScreen,
        victory,
      },
      commandLog: this.commands,
      traceLog: this.traces,
      performance: {
        totalPlayTime: endTime - this.startTime,
        averageTurnTime: 0,
        totalCommands: this.commands.length,
        averageCommandsPerTurn: 0,
      },
      checksum: this.calculateChecksum(),
    };
  }
  
  private calculateChecksum(): string {
    const data = JSON.stringify({
      commands: this.commands.map(c => c.command),
      traces: this.traces.length,
    });
    
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    
    return hash.toString(16);
  }
}

export class CrashBundleGenerator {
  static generate(
    error: Error,
    state: CrashBundle['state'],
    snapshot?: RuleSnapshot,
    recentCommands: { command: string; timestamp: number }[] = [],
    recentTraces: ResolutionTrace[] = [],
    platform: 'web' | 'desktop' | 'mobile' = 'web'
  ): CrashBundle {
    const now = Date.now();
    
    return {
      version: '1.0',
      capturedAt: now,
      error: {
        type: error.name || 'Error',
        message: error.message,
        stack: error.stack,
        timestamp: now,
      },
      state,
      snapshot,
      recentCommands: recentCommands.slice(-10),
      recentTraces: recentTraces.slice(-5),
      systemInfo: {
        platform,
        browser: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
        os: undefined,
        version: '1.0.0',
      },
      reproduction: {
        seed: 0,
        characterId: '',
        commandSequence: recentCommands.map(c => c.command),
      },
    };
  }
}
