/**
 * @file enemyAI.ts
 * @description 敌人 AI 类型定义 - 定义敌人 AI 的配置和行为类型
 *
 * 主要职责:
 * - 定义 IntentBand、HpBand、BlockBand 等频段类型
 * - 定义 EnemyAiPersonality 接口，描述敌人 AI 性格 (aggression, defensiveness, unpredictability, revengefulness)
 * - 定义 EnemyAiProfile 接口，描述完整的敌人 AI 配置
 * - 定义 EnemyIntentBiasRule 和 EnemyAntiStallProfile，控制 AI 行为偏好和防拖延机制
 */
export type IntentBand = 'low' | 'medium' | 'high';
export type HpBand = 'safe' | 'pressured' | 'kill_range';
export type BlockBand = 'none' | 'light' | 'heavy';
export type ComboThreatBand = 'none' | 'suspected' | 'high';

export interface EnemyAiPersonality {
  aggression: number;
  defensiveness: number;
  unpredictability: number;
  revengefulness: number;
}

export interface EnemyIntentBiasRule {
  intent: string;
  multiplier: number;
  attackIntentBand?: IntentBand;
  defenseIntentBand?: IntentBand;
  comboThreatBand?: ComboThreatBand;
  playerHpBand?: HpBand;
  enemyHpBand?: HpBand;
  playerBlockBand?: BlockBand;
}

export interface EnemyAntiStallProfile {
  maxNonAttackTurns: number;
  forcedAttackMultiplier?: number;
  suppressedIntents?: string[];
}

export interface EnemyAiProfile {
  perceptionAccuracy?: number;
  personality?: Partial<EnemyAiPersonality>;
  intentBiases?: EnemyIntentBiasRule[];
  antiStall?: EnemyAntiStallProfile;
}
