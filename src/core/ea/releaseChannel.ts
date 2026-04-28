/**
 * @file releaseChannel.ts
 * @description 发布渠道 - 定义游戏的发布渠道和构建清单类型
 *
 * 主要职责:
 * - 定义 ReleaseChannel 类型 (stable-ea, experimental-ea, internal-debug)
 * - 定义 ReleaseChannelManifest 接口，描述版本号、构建号、内容版本、平台配置等
 * - 支持多平台构建配置 (PC/Web) 和兼容性声明
 * - 为持续集成和发布流程提供类型支持
 */
export type ReleaseChannel = 'stable-ea' | 'experimental-ea' | 'internal-debug';

export interface ReleaseChannelManifest {
  version: '1.0';
  generatedAt: number;
  
  channel: ReleaseChannel;
  buildNumber: number;
  contentVersion: string;
  rulesVersion: string;
  
  platforms: {
    pc: {
      enabled: boolean;
      buildPath: string;
      checksum: string;
      size: number;
    };
    web: {
      enabled: boolean;
      buildPath: string;
      checksum: string;
      size: number;
      assetBudgetProfile: string;
    };
  };
  
  compatibility: {
    minEngineVersion: string;
    maxEngineVersion: string;
    saveSchemaVersion: string;
    replaySchemaVersion: string;
    rulesVersion: string;
  };
  
  entryPoints: {
    primary: 'legacy-ui';
  };
  
  diagnostics: {
    crashBundleVersion: string;
    replayExportVersion: string;
    diagnosticsPayloadVersion: string;
  };
  
  contentPacks: string[];
}

export interface EAContentPackManifest {
  version: '1.0';
  packId: string;
  packName: string;
  packVersion: string;
  releasedAt: number;
  
  theme: {
    primary: string;
    tagline: string;
    buildPivot: string;
  };
  
  content: {
    character: {
      type: 'enhancement' | 'new';
      characterId?: string;
      enhancementDirection?: string;
      newCharacter?: {
        id: string;
        name: string;
        resourceType: string;
      };
    };
    
    boss: {
      count: number;
      ids: string[];
    };
    
    enemies: {
      normal: number;
      elite: number;
      ids: string[];
    };
    
    events: {
      count: number;
      ids: string[];
    };
    
    cards: {
      count: number;
      ids: string[];
      byRarity: {
        common: number;
        uncommon: number;
        rare: number;
        legendary: number;
      };
    };
    
    relics: {
      count: number;
      ids: string[];
    };
    
    enchantments: {
      count: number;
      ids: string[];
      interactionLines: string[];
    };
    
    afflictions: {
      count: number;
      ids: string[];
      interactionLines: string[];
    };
  };
  
  balance: {
    metrics: {
      firstInsightMinute: number;
      firstBuildPivotFloor: number;
      enchantmentSeenRate: number;
      afflictionSeenRate: number;
    };
    seeds: number[];
    replayBaseline: string;
  };
  
  presentation: {
    screenshotMoments: string[];
    videoCapturePoints: string[];
    keyMoments: {
      trigger: string;
      description: string;
    }[];
  };
}

export interface EAFeedbackEvent {
  eventId: string;
  timestamp: number;
  runId: string;
  buildNumber: number;
  contentVersion: string;
  channel: ReleaseChannel;
  
  type: 'positive' | 'negative' | 'neutral' | 'bug' | 'suggestion';
  category: 'combat' | 'event' | 'reward' | 'ui' | 'performance' | 'balance' | 'content' | 'other';
  
  context: {
    floor: number;
    screen: string;
    characterId: string;
    playTime: number;
    platform: 'pc' | 'web';
    contentPacks: string[];
  };
  
  feedback: {
    rating?: 1 | 2 | 3 | 4 | 5;
    tags: string[];
    freeText?: string;
    attachedReplay?: string;
    attachedScreenshot?: string;
  };
  
  diagnostics?: {
    fps?: number;
    memoryUsage?: number;
    loadTime?: number;
    errorCount?: number;
  };
}

export interface WebEAProfile {
  profileId: string;
  version: '1.0';
  
  assetBudget: {
    maxTotalSize: number;
    maxInitialLoad: number;
    audioBudget: number;
    textureBudget: number;
    animationBudget: number;
  };
  
  performance: {
    targetFps: number;
    maxMemoryMB: number;
    startupBudgetMs: number;
    sceneTransitionBudgetMs: number;
  };
  
  loading: {
    strategy: 'progressive' | 'eager' | 'lazy';
    criticalAssets: string[];
    deferredAssets: string[];
  };
  
  input: {
    touchOptimizations: boolean;
    keyboardShortcuts: boolean;
    gamepadSupport: boolean;
  };
  
  features: {
    serviceWorker: boolean;
    offlineMode: boolean;
    cloudSaves: boolean;
    analytics: boolean;
  };
}

export interface AssetBudgetProfile {
  profileId: string;
  platform: 'pc' | 'web-low' | 'web-medium' | 'web-high';
  
  textures: {
    maxResolution: number;
    compressionFormat: 'none' | 'webp' | 'avif' | 'basis';
    atlasStrategy: 'single' | 'multiple' | 'dynamic';
  };
  
  audio: {
    maxBitrate: number;
    format: 'mp3' | 'ogg' | 'wav';
    streamingThreshold: number;
  };
  
  animations: {
    maxFrames: number;
    frameRate: number;
    compressionEnabled: boolean;
  };
  
  fonts: {
    subsetStrategy: 'full' | 'dynamic' | 'critical-only';
    maxFonts: number;
  };
  
  shaders: {
    complexity: 'low' | 'medium' | 'high';
    maxInstructions: number;
  };
}

export interface StartupBudgetReport {
  reportId: string;
  timestamp: number;
  platform: 'pc' | 'web';
  profile: string;
  
  phases: {
    name: string;
    duration: number;
    budget: number;
    withinBudget: boolean;
    details: Record<string, number>;
  }[];
  
  total: {
    duration: number;
    budget: number;
    withinBudget: boolean;
  };
  
  recommendations: string[];
}

export const DEFAULT_WEB_EA_PROFILE: WebEAProfile = {
  profileId: 'web-ea-default',
  version: '1.0',
  
  assetBudget: {
    maxTotalSize: 50 * 1024 * 1024,
    maxInitialLoad: 5 * 1024 * 1024,
    audioBudget: 10 * 1024 * 1024,
    textureBudget: 30 * 1024 * 1024,
    animationBudget: 5 * 1024 * 1024,
  },
  
  performance: {
    targetFps: 60,
    maxMemoryMB: 512,
    startupBudgetMs: 3000,
    sceneTransitionBudgetMs: 500,
  },
  
  loading: {
    strategy: 'progressive',
    criticalAssets: ['core-rules', 'ui-core', 'first-scene'],
    deferredAssets: ['full-audio', 'hd-textures', 'optional-animations'],
  },
  
  input: {
    touchOptimizations: true,
    keyboardShortcuts: true,
    gamepadSupport: false,
  },
  
  features: {
    serviceWorker: true,
    offlineMode: true,
    cloudSaves: true,
    analytics: true,
  },
};

export const DEFAULT_PC_ASSET_PROFILE: AssetBudgetProfile = {
  profileId: 'pc-high',
  platform: 'pc',
  
  textures: {
    maxResolution: 4096,
    compressionFormat: 'none',
    atlasStrategy: 'multiple',
  },
  
  audio: {
    maxBitrate: 320,
    format: 'ogg',
    streamingThreshold: 10 * 1024 * 1024,
  },
  
  animations: {
    maxFrames: 120,
    frameRate: 60,
    compressionEnabled: false,
  },
  
  fonts: {
    subsetStrategy: 'full',
    maxFonts: 10,
  },
  
  shaders: {
    complexity: 'high',
    maxInstructions: 10000,
  },
};

export const DEFAULT_WEB_ASSET_PROFILE: AssetBudgetProfile = {
  profileId: 'web-medium',
  platform: 'web-medium',
  
  textures: {
    maxResolution: 1024,
    compressionFormat: 'webp',
    atlasStrategy: 'dynamic',
  },
  
  audio: {
    maxBitrate: 128,
    format: 'mp3',
    streamingThreshold: 2 * 1024 * 1024,
  },
  
  animations: {
    maxFrames: 30,
    frameRate: 30,
    compressionEnabled: true,
  },
  
  fonts: {
    subsetStrategy: 'critical-only',
    maxFonts: 3,
  },
  
  shaders: {
    complexity: 'low',
    maxInstructions: 1000,
  },
};

export class ReleaseChannelManager {
  private currentChannel: ReleaseChannel = 'stable-ea';
  private manifest: ReleaseChannelManifest | null = null;
  
  setChannel(channel: ReleaseChannel): void {
    this.currentChannel = channel;
  }
  
  getChannel(): ReleaseChannel {
    return this.currentChannel;
  }
  
  loadManifest(manifest: ReleaseChannelManifest): void {
    this.manifest = manifest;
  }
  
  getManifest(): ReleaseChannelManifest | null {
    return this.manifest;
  }
  
  isStable(): boolean {
    return this.currentChannel === 'stable-ea';
  }
  
  isExperimental(): boolean {
    return this.currentChannel === 'experimental-ea';
  }
  
  isDebug(): boolean {
    return this.currentChannel === 'internal-debug';
  }
  
  getPrimaryEntryPoint(): string {
    return 'legacy-ui';
  }
  
  getDebugEntryPoint(): string {
    return 'legacy-ui';
  }
  
  validateCompatibility(rulesVersion: string, saveSchemaVersion: string): boolean {
    if (!this.manifest) return true;
    
    const compat = this.manifest.compatibility;
    return compat.rulesVersion === rulesVersion && compat.saveSchemaVersion === saveSchemaVersion;
  }
}

export class EAFeedbackCollector {
  private events: EAFeedbackEvent[] = [];
  private currentRunId: string = '';
  private buildNumber: number = 0;
  private contentVersion: string = '';
  private channel: ReleaseChannel = 'stable-ea';
  
  setContext(runId: string, buildNumber: number, contentVersion: string, channel: ReleaseChannel): void {
    this.currentRunId = runId;
    this.buildNumber = buildNumber;
    this.contentVersion = contentVersion;
    this.channel = channel;
  }
  
  recordEvent(
    type: EAFeedbackEvent['type'],
    category: EAFeedbackEvent['category'],
    context: EAFeedbackEvent['context'],
    feedback: EAFeedbackEvent['feedback'],
    diagnostics?: EAFeedbackEvent['diagnostics']
  ): string {
    const eventId = `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const event: EAFeedbackEvent = {
      eventId,
      timestamp: Date.now(),
      runId: this.currentRunId,
      buildNumber: this.buildNumber,
      contentVersion: this.contentVersion,
      channel: this.channel,
      type,
      category,
      context,
      feedback,
      diagnostics,
    };
    
    this.events.push(event);
    return eventId;
  }
  
  getEvents(): EAFeedbackEvent[] {
    return [...this.events];
  }
  
  getEventsByType(type: EAFeedbackEvent['type']): EAFeedbackEvent[] {
    return this.events.filter(e => e.type === type);
  }
  
  getEventsByCategory(category: EAFeedbackEvent['category']): EAFeedbackEvent[] {
    return this.events.filter(e => e.category === category);
  }
  
  exportToJson(): string {
    return JSON.stringify({
      exportedAt: Date.now(),
      runId: this.currentRunId,
      buildNumber: this.buildNumber,
      contentVersion: this.contentVersion,
      channel: this.channel,
      events: this.events,
    }, null, 2);
  }
  
  clear(): void {
    this.events = [];
  }
}
