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
