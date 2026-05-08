/**
 * @file RelicPurify.ts
 * @description 遗物净化系统 - 管理被腐化遗物的诅咒效果和净化机制
 *
 * 主要职责:
 * - 定义 CurseEffect 接口，描述诅咒效果类型 (持续伤害/属性惩罚/随机费用)
 * - 定义 CURSE_RELIC_IDS 和 CURSE_RELIC_CONFIGS，列举可腐化遗物
 * - 提供遗物腐化和净化的逻辑
 */
import { relicsData } from '@/content/narrative/numericSystem';

export interface CurseEffect {
  type: 'damage_over_time' | 'stat_penalty' | 'random_cost';
  value: number;
  description: string;
}

export interface CurseRelicConfig {
  relicId: string;
  curseEffect: CurseEffect;
}

export const CURSE_RELIC_IDS: string[] = [
  'corrupted_relic',
  'corrupted_tome',
  'zealots_chain',
  'warp_distorter',
  'rot_reliquary_blessing',
  'mark_of_entropy',
  'heretics_metronome',
  'seal_of_exterminatus'
];

export const CURSE_RELIC_CONFIGS: CurseRelicConfig[] = [
  {
    relicId: 'corrupted_relic',
    curseEffect: {
      type: 'stat_penalty',
      value: 5,
      description: '每回合获得2点力量，但积累10点堕落值'
    }
  },
  {
    relicId: 'corrupted_tome',
    curseEffect: {
      type: 'random_cost',
      value: 1,
      description: '诅咒卡牌数量决定能量获取，但使卡牌腐化'
    }
  },
  {
    relicId: 'zealots_chain',
    curseEffect: {
      type: 'stat_penalty',
      value: 3,
      description: '战斗开始时失去3点护甲'
    }
  },
  {
    relicId: 'warp_distorter',
    curseEffect: {
      type: 'damage_over_time',
      value: 4,
      description: '每回合受到4点自伤，但获得额外能量'
    }
  },
  {
    relicId: 'rot_reliquary_blessing',
    curseEffect: {
      type: 'random_cost',
      value: 1,
      description: '随机移除一张手牌'
    }
  },
  {
    relicId: 'mark_of_entropy',
    curseEffect: {
      type: 'stat_penalty',
      value: 2,
      description: '降低所有属性2点'
    }
  },
  {
    relicId: 'heretics_metronome',
    curseEffect: {
      type: 'damage_over_time',
      value: 3,
      description: '每回合受到3点伤害'
    }
  },
  {
    relicId: 'seal_of_exterminatus',
    curseEffect: {
      type: 'stat_penalty',
      value: 10,
      description: '最大生命值降低10点'
    }
  }
];

export class RelicPurify {
  private curseRelicMap: Map<string, CurseRelicConfig>;

  constructor() {
    this.curseRelicMap = new Map();
    for (const config of CURSE_RELIC_CONFIGS) {
      this.curseRelicMap.set(config.relicId, config);
    }
  }

  public hasCurse(relicId: string): boolean {
    return this.curseRelicMap.has(relicId) || CURSE_RELIC_IDS.includes(relicId);
  }

  public getCurseEffect(relicId: string): CurseEffect | null {
    const config = this.curseRelicMap.get(relicId);
    return config?.curseEffect || null;
  }

  public getCurseConfig(relicId: string): CurseRelicConfig | null {
    return this.curseRelicMap.get(relicId) || null;
  }

  public getAllCurses(): CurseRelicConfig[] {
    return [...this.curseRelicMap.values()];
  }

  public addCurseRelic(relicId: string, curseEffect: CurseEffect): void {
    const config: CurseRelicConfig = { relicId, curseEffect };
    this.curseRelicMap.set(relicId, config);
    if (!CURSE_RELIC_IDS.includes(relicId)) {
      CURSE_RELIC_IDS.push(relicId);
    }
  }

  public isRelicCorrupted(relicId: string): boolean {
    const relic = relicsData.find(r => r.id === relicId);
    return !!(relic as any)?.corrupted;
  }

  public getRelicCurseDescription(relicId: string): string {
    const effect = this.getCurseEffect(relicId);
    if (!effect) {
      return '';
    }
    return effect.description;
  }
}

let globalRelicPurify: RelicPurify | null = null;

export const createRelicPurify = (): RelicPurify => {
  globalRelicPurify = new RelicPurify();
  return globalRelicPurify;
};

export const getRelicPurify = (): RelicPurify => {
  if (!globalRelicPurify) {
    globalRelicPurify = new RelicPurify();
  }
  return globalRelicPurify;
};
