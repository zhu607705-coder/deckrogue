/**
 * @file intentTags.ts
 * @description 意图标签系统 - 为敌人意图打分类标签
 *
 * 主要职责:
 * - 定义 IntentCategory (attack, defend, debuff, buff, summon, special)
 * - 定义 IntentTag (aggressive, defensive, controlling, sustaining, bursty 等)
 * - 实现 intentTagger，为意图自动分配分类标签
 * - 为 AI 风险评估和群体协作提供标签数据
 */
export type IntentCategory =
  | 'attack'
  | 'defend'
  | 'debuff'
  | 'buff'
  | 'summon'
  | 'special';

export type IntentTag =
  | 'aggressive'
  | 'defensive'
  | 'controlling'
  | 'sustaining'
  | 'bursty'
  | 'setup'
  | 'punitive'
  | 'healing'
  | 'area_damage'
  | 'single_target';

export interface IntentMetadata {
  intent: string;
  category: IntentCategory;
  tags: IntentTag[];
  damage?: number;
  block?: number;
  selfDamage?: number;
  isFinisher?: boolean;
}

export class IntentTagger {
  private metadataCache: Map<string, IntentMetadata> = new Map();

  public getIntentMetadata(intentName: string): IntentMetadata {
    if (this.metadataCache.has(intentName)) {
      return this.metadataCache.get(intentName)!;
    }

    const metadata = this.inferMetadata(intentName);
    this.metadataCache.set(intentName, metadata);
    return metadata;
  }

  private inferMetadata(intentName: string): IntentMetadata {
    const intentLower = intentName.toLowerCase();
    const category = this.inferCategory(intentLower);
    const tags = this.inferTags(intentLower, category);

    return {
      intent: intentName,
      category,
      tags
    };
  }

  private inferCategory(intentLower: string): IntentCategory {
    if (/attack|strike|damage|slam|burn|punch|kick|gore|claw|bite|smite|execute|slash/.test(intentLower)) {
      return 'attack';
    }
    if (/block|defend|shield|barrier|guard|fortify|protect/.test(intentLower)) {
      return 'defend';
    }
    if (/debuff|weaken|vulnerable|poison|curse|doom|frail|fear|slow|corrupt|hex/.test(intentLower)) {
      return 'debuff';
    }
    if (/buff|strengthen|power|empower|rage|frenzy|enrage|haste|quicken|ascend|transcend/.test(intentLower)) {
      return 'buff';
    }
    if (/summon|call|spawn|create|construct|golem|ally/.test(intentLower)) {
      return 'summon';
    }
    return 'special';
  }

  private inferTags(intentLower: string, category: IntentCategory): IntentTag[] {
    const tags: IntentTag[] = [];

    if (category === 'attack') {
      tags.push('aggressive');

      if (/all|multi|area|sweep|cleave|storm/.test(intentLower)) {
        tags.push('area_damage');
      } else {
        tags.push('single_target');
      }

      if (/execute|finisher|final|death|kill/.test(intentLower)) {
        tags.push('bursty');
        tags.push('punitive');
      }

      if (/rage|frenzy|berserk/.test(intentLower)) {
        tags.push('bursty');
      }
    }

    if (category === 'defend') {
      tags.push('defensive');
      tags.push('sustaining');
    }

    if (category === 'debuff') {
      tags.push('controlling');
      tags.push('setup');

      if (/poison|toxic|corrode/.test(intentLower)) {
        tags.push('sustaining');
      }
    }

    if (category === 'buff') {
      tags.push('sustaining');
      tags.push('setup');

      if (/rage|frenzy|berserk|power|empower/.test(intentLower)) {
        tags.push('aggressive');
      }
    }

    if (category === 'summon') {
      tags.push('setup');
      tags.push('sustaining');
    }

    if (/heal|restore|regen|repair/.test(intentLower)) {
      tags.push('healing');
      tags.push('sustaining');
    }

    if (/counter|retaliate|revenge|payback/.test(intentLower)) {
      tags.push('punitive');
      tags.push('defensive');
    }

    return tags;
  }

  public hasTag(intentName: string, tag: IntentTag): boolean {
    const metadata = this.getIntentMetadata(intentName);
    return metadata.tags.includes(tag);
  }

  public isCategory(intentName: string, category: IntentCategory): boolean {
    const metadata = this.getIntentMetadata(intentName);
    return metadata.category === category;
  }

  public areIntentsSimilar(intentA: string, intentB: string): boolean {
    const metaA = this.getIntentMetadata(intentA);
    const metaB = this.getIntentMetadata(intentB);

    if (metaA.category !== metaB.category) return false;

    const sharedTags = metaA.tags.filter(tag => metaB.tags.includes(tag));
    return sharedTags.length >= Math.min(metaA.tags.length, metaB.tags.length) / 2;
  }
}

export const intentTagger = new IntentTagger();
