/**
 * @file codexCatalog.ts
 * @description 图鉴目录数据 - 定义图鉴分类和导出函数
 *
 * 主要职责:
 * - 定义 CodexCategory 类型
 * - 提供图鉴数据导入/导出函数
 * - 管理图鉴更新事件
 */

import { cardsData } from '@/content/narrative/numericSystem';
import { relicsData } from '@/content/narrative/numericSystem';
import { potionsData } from '@/content/narrative/numericSystem';
import { enemiesData } from '@/content/narrative/numericSystem';
import { STORY_EVENTS } from '@/content/narrative/numericSystem';
import type { CodexCategory } from '@/core';
import { localEnemyArt } from '@/content/assets/standeeArt';
import { getCardNameZh, getCardTargetingZh, getCardTextZh, getUiLabelZh } from '@/ui/content/terminology';

export interface CodexCatalogEntry {
  category: CodexCategory;
  id: string;
  name: string;
  imageSrc?: string;
  rarity?: string;
  subtitle?: string;
  keywords: string[];
  summary: string;
  mechanics: string[];
  interactions: string[];
  examples: string[];
  badges: string[];
  searchText: string;
  dataPoints: Array<{ label: string; value: string }>;
  notes?: string[];
  demo?: CodexDemoPanelDef;
  background?: string;
  loreFragments?: Array<{ label: string; text: string; source?: string; tone?: 'neutral' | 'grim' | 'faith' | 'warp' }>;
}

export interface CodexDemoFrame {
  label: string;
  headline: string;
  detail: string;
  tone?: 'neutral' | 'offense' | 'defense' | 'status' | 'warp';
}

export interface CodexDemoPanelDef {
  kind: 'card' | 'enemy';
  title: string;
  subtitle?: string;
  frames: CodexDemoFrame[];
  loopMs?: number;
}

const ACTION_LABELS: Record<string, string> = {
  DealDamage: '造成伤害',
  GainBlock: '获得护盾',
  ApplyStatus: '施加状态',
  DrawCards: '抽牌',
  Draw: '抽牌',
  Delay: '延迟触发',
  TriggerDelay: '触发延迟',
  GainIntel: '获得情报',
  SpendIntel: '消耗情报',
  AddWarpTide: '提高亚空间潮汐',
  ReturnLastCard: '返回上一张牌',
  Conditional: '条件判定',
  GainEnergy: '获得能量',
  GainResource: '获得路线资源',
  SpendResourceEffect: '消耗资源触发效果',
  SpendAllResourceEffect: '消耗全部资源触发效果',
  SpendResourceUpTo: '最多消耗资源',
  ConditionalResourceGain: '条件资源获得',
  ConditionalEffect: '条件效果',
  ConditionalDraw: '条件抽牌',
  LoseHp: '失去生命',
  NextAttackCostDown: '下一张攻击降费',
  NextCardCostDown: '下一张牌降费',
  StartOfTurnEffect: '事件触发'
};

function toTitleCaseValue(v: any): string {
  if (v == null) return '';
  return String(v);
}

function uniqStrings(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.filter((x): x is string => !!x && typeof x === 'string').map((x) => x.trim()).filter(Boolean)));
}

function inferCardLoreSource(card: any): string {
  const tags = Array.isArray(card.tags) ? card.tags : [];
  if (tags.includes('warp') || /abyss|warp/i.test(String(card.id || ''))) return '异端低语记录';
  if (tags.includes('zeal') || /emperor/i.test(String(card.id || ''))) return '审判庭档案';
  if (tags.includes('tech') || tags.includes('construct')) return '战场回收终端';
  return '战场拾获';
}

function inferRelicLoreSource(relic: any, fragment: 'inscription' | 'flavorText'): string {
  const tags = Array.isArray(relic.tags) ? relic.tags : [];
  if (relic.corrupted || tags.includes('corruption')) return fragment === 'inscription' ? '异端低语记录' : '异端处置笔录';
  if (tags.includes('devotion') || tags.includes('zeal') || /martyr|inquisitor|seal_of/i.test(String(relic.id || ''))) return '审判庭档案';
  return fragment === 'inscription' ? '战场拾获' : '战场回收录音';
}

function toLoreTextList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((entry) => String(entry || '').trim()).filter(Boolean);
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [];
}

function collectCardLoreFragments(card: any): Array<{ label: string; text: string; source?: string; tone?: 'neutral' | 'grim' | 'faith' | 'warp' }> {
  const tone = card.tags?.includes('warp') || card.tags?.includes('void') ? 'warp' as const : 'grim' as const;
  return [
    ...toLoreTextList(card.background).map((text) => ({
      label: '背景残片',
      text,
      source: inferCardLoreSource(card),
      tone,
    })),
    ...toLoreTextList(card.loreText).map((text) => ({
      label: '碎片叙事',
      text,
      source: inferCardLoreSource(card),
      tone,
    })),
    ...(card.lastWords ? [{
      label: '上一任持有者临终遗言',
      text: String(card.lastWords),
      source: inferCardLoreSource(card),
      tone,
    }] : []),
  ];
}

function collectEnemyLoreFragments(enemy: any): Array<{ label: string; text: string; source?: string; tone?: 'neutral' | 'grim' | 'faith' | 'warp' }> {
  return [
    ...toLoreTextList(enemy.background).map((text) => ({
      label: '敌怪背景',
      text,
      source: '敌情档案',
      tone: enemy.keywords?.includes('boss') ? 'warp' as const : 'grim' as const,
    })),
    ...toLoreTextList(enemy.loreText).map((text) => ({
      label: '现场残录',
      text,
      source: '战场回收录音',
      tone: 'grim' as const,
    })),
    ...(!enemy.background && enemy.description ? [{
      label: '敌情摘要',
      text: String(enemy.description),
      source: '敌情档案',
      tone: 'neutral' as const,
    }] : []),
  ];
}

type NarrativeOverride = Partial<Pick<CodexCatalogEntry, 'summary' | 'mechanics' | 'interactions' | 'examples' | 'notes'>>;

const HANDWRITTEN_EVENT_GUIDES: Record<string, NarrativeOverride> = {
  warp_tear_whispers: {
    summary: '高风险亚空间交易事件。核心不是“选更强奖励”，而是判断当前构筑是否承受得起长期代价（腐化、Debuff、核心牌损失）。',
    mechanics: [
      '该事件的三个选项都带有长期影响：要么改写牌组结构，要么引入持续负面状态，要么牺牲牌组质量。',
      '【拥抱亚空间】会快速改变基础牌构成，适合中后期基础牌仍多、需要爆发提升的局面。',
      '【虚空交易】本质是高波动赌博：收益高，但可能直接吞掉核心引擎牌。',
      '【封印裂隙】偏防守向，适合已经成型但濒临腐化失控的局面。'
    ],
    interactions: [
      '若你依赖基础牌数量（如某些打击/防御计数联动），在选择“拥抱亚空间”前要重新评估整套构筑逻辑。',
      '当腐化值已高、又缺乏稳定防御时，叠加裂隙后续战斗 Debuff 往往比立即收益更致命。',
      '“虚空交易”在卡组精简且核心牌数少时风险极高，因为随机销毁更容易命中关键组件。'
    ],
    examples: [
      '示例：如果你第 5 层仍有大量基础牌且输出不足，可以考虑“拥抱亚空间”；若血量低且下一节点可能是精英/Boss，优先“封印裂隙”。'
    ]
  },
  inquisitor_legacy: {
    summary: '典型的“信息 vs 力量 vs 稳定性”三岔抉择事件。每个分支都能提升当前 run，但代价会在后续路径中显现。',
    mechanics: [
      '【破封匣子】是高爆发路线：立即获得强力遗物，但会吃到当前生命值巨额损失与后续追杀增幅。',
      '【阅读密码本】是信息路线：直接提升 Intel 并揭图，显著提高路径规划能力。',
      '【拿走念珠】是稳健路线：收益较小但风险可控，适合状态差、急需保命的局面。'
    ],
    interactions: [
      '若地图后续含多场强战，追杀增幅会在每场战斗累积放大压力，不应只看“当前能否活下来”。',
      'Intel 与地图揭示在路线选择、商店/篝火/精英取舍上有乘法收益，常被低估。',
      '若你已有足够开战防御遗物，“念珠”价值会下降；反之则是非常稳定的容错补强。'
    ],
    notes: [
      '推荐阅读顺序：先看地图分布，再决定是否能承受“破封匣子”的追杀惩罚。'
    ]
  },
  rusting_medicae: {
    summary: '偏“血量经济学”的事件。三条路线分别对应永久体质改造、短期恢复与高风险资源跳跃。',
    interactions: [
      '若牌库已经有稳定回复或战后续航，抽精华路线的“最大生命值 -5”代价会更容易接受。',
      '拆解路线真正的代价在于“后续精英战/真伤二选一”，请结合药水与下层路径判断。'
    ]
  },
  nameless_martyr_shrine: {
    summary: '高价值神龛事件。代价通常是永久型（最大生命、金币、虔诚），非常适合作为构筑方向分水岭。',
    interactions: [
      '献上财富的“移除 2 张牌”在多数构筑中都极其强力，金币是否足够应提前规划。',
      '亵渎路线会改变轴向与后续战斗节奏，适合已有爆发核心、能承受不稳定性的构筑。'
    ]
  }
};

const HANDWRITTEN_ELITE_GUIDES: Record<string, NarrativeOverride> = {
  gremlin_nob: {
    summary: '高压单体精英。其危险点不只是伤害高，而是“先增伤后压回合”的节奏迫使你尽快结束战斗。',
    mechanics: [
      '开局可能先用增益（如力量）建立滚雪球，再通过高伤意图迫使你交防御或吃伤。',
      '当其进入高伤回合时，防御不足会迅速崩盘，拖战越久越危险。'
    ],
    interactions: [
      '优先保留爆发牌与药水，避免把强牌浪费在低威胁回合。',
      '若手上只有防御牌，至少要规划下回合的反打线，不要连续被动。'
    ],
    examples: ['示例：看到其先手增益后，下一回合通常要准备高护盾或抢杀。']
  },
  lagavulin: {
    summary: '耐久型精英，常通过高血量与重击逼迫你做长期资源分配。',
    interactions: [
      '若卡组爆发不足，尽量保留药水用于关键回合重击窗口。',
      '持续增益（力量、易伤覆盖）在这类长战中价值显著提升。'
    ]
  },
  intelligence_officer: {
    summary: '节奏控制型精英。它的威胁在于意图多样与状态干扰，容易让玩家错判回合价值。',
    interactions: [
      '情报类敌人通常会通过增益/削弱混合意图打乱你的固定出牌顺序，保留机动解牌很重要。',
      '对这类敌人，单回合完美效率不如“避免关键回合崩盘”更重要。'
    ]
  },
  hexaghost: {
    summary: '多段伤害 Boss。其真正危险点是多段命中会放大脆弱、削弱单次护盾价值，并提高药水使用时机要求。',
    mechanics: [
      '多段攻击会吃满易伤增伤，也会让固定护盾在多 hit 场景下迅速耗尽。',
      '面对多段回合，提前准备减伤/高护盾/击杀窗口比平均防御更有效。'
    ],
    interactions: [
      '力量与爆发牌在 Boss 多段前的"抢相位"价值很高。',
      '单次治疗药水不能替代回合内防御，建议与护盾/减伤组合使用。'
    ]
  },
  time_guardian: {
    summary: '节奏门槛型 Boss。它会惩罚无脑连打，迫使你在回合内计算爆发阈值与回合切换价值。',
    interactions: [
      '高连打构筑在面对时间类 Boss 时要刻意保留一部分牌，避免触发不利相位。',
      '延迟伤害与非直接伤害效果可用于跨回合平滑输出。'
    ]
  },
  puppet_queen: {
    summary: '召唤/场面压力型 Boss。重点不是单个大招，而是场面累积带来的资源榨干。',
    interactions: [
      '优先判断“清场”还是“抢本体”更优；错误目标选择会在 2-3 回合后显著放大压力。',
      'AOE 或多段伤害在此类战斗中价值提升。'
    ]
  }
};

const HANDWRITTEN_CARD_GUIDES: Record<string, NarrativeOverride> = {
  time_warp: {
    summary: '时间操纵核心节奏牌。它不是纯收益，而是把延迟伤害从“未来回合”搬到“当前回合”的时机重排工具。',
    interactions: [
      '与 Delay 类牌配合时，Time Warp 的价值取决于你能否把伤害点放在敌方关键意图之前。',
      '费用调高后更强调“时机正确”而非无脑塞入每回合。'
    ],
    examples: ['示例：先下定时炸弹，再用 Time Warp 立刻引爆，可在同回合完成爆发收割。']
  },
  time_bomb: {
    summary: '延迟爆发牌。强度不只在数值，而在你能否用回合节奏和延迟触发工具把伤害落到正确窗口。',
    interactions: [
      '若没有稳定拖回合或延迟触发手段，Time Bomb 会出现"伤害来不及兑现"的情况。',
      '与 Time Warp、控场、护盾牌配合时价值显著上升。'
    ]
  },
  flex: {
    summary: '短期爆发增伤牌。费用调整后更适合作为“关键回合放大器”，而非白赚强度。',
    interactions: [
      '应尽量在同回合搭配多次攻击或高倍率攻击使用，避免把 Strength 浪费在低价值回合。'
    ]
  }
};

function mergeNarrative(base: string[], extra?: string[]): string[] {
  return extra && extra.length > 0 ? uniqStrings([...extra, ...base]) : base;
}

function applyNarrativeOverride(entry: CodexCatalogEntry, override?: NarrativeOverride): CodexCatalogEntry {
  if (!override) return entry;
  const summary = override.summary || entry.summary;
  const mechanics = mergeNarrative(entry.mechanics, override.mechanics);
  const interactions = mergeNarrative(entry.interactions, override.interactions);
  const examples = mergeNarrative(entry.examples, override.examples);
  const notes = uniqStrings([...(override.notes || []), ...(entry.notes || [])]);
  const searchText = [
    ...entry.keywords,
    summary,
    ...mechanics,
    ...interactions,
    ...examples,
    ...notes
  ].join(' ').toLowerCase();
  return {
    ...entry,
    summary,
    mechanics,
    interactions,
    examples,
    notes: notes.length > 0 ? notes : undefined,
    searchText
  };
}

function createCardDemo(card: any): CodexDemoPanelDef | undefined {
  const localizedName = getCardNameZh(card);
  const actions = Array.isArray(card.actions) ? card.actions : [];
  const frames: CodexDemoFrame[] = [
    {
      label: '步骤 1',
      headline: `打出《${localizedName}》`,
      detail: `消耗 ${card.cost ?? 0} 点能量，类型：${card.type || '卡牌'}，目标：${getCardTargetingZh(card.targeting)}`,
      tone: 'neutral'
    }
  ];

  if (actions.length > 0) {
    frames.push({
      label: '步骤 2',
      headline: '效果结算',
      detail: actions.slice(0, 2).map(actionSummary).join('；'),
      tone: card.type === 'Attack' ? 'offense' : card.type === 'Skill' ? 'status' : 'neutral'
    });
  }

  frames.push({
      label: '步骤 3',
    headline: '实战要点',
    detail: Array.isArray(card.tags) && card.tags.includes('warp')
      ? '关注亚空间/延迟/腐化联动，优先在关键节奏回合使用。'
      : card.type === 'Attack'
        ? '优先配合力量、易伤或连击窗口放大收益。'
        : '结合手牌与能量曲线决定是否当回合投入。',
    tone: Array.isArray(card.tags) && card.tags.includes('warp') ? 'warp' : 'neutral'
  });

  return {
    kind: 'card',
    title: '实战演示（模拟回合）',
    subtitle: '用于理解出牌顺序与效果结算，不代表唯一最优打法',
    frames,
    loopMs: 2200
  };
}

function createEnemyDemo(enemy: any): CodexDemoPanelDef | undefined {
  const intentPolicy = Array.isArray(enemy.intent_policy) ? enemy.intent_policy : [];
  const moves = enemy.moves || {};
  if (intentPolicy.length === 0) return undefined;
  const totalWeight = intentPolicy.reduce((s: number, p: any) => s + Math.max(0, Number(p.weight) || 0), 0);
  const frames = intentPolicy.slice(0, 4).map((policy: any, idx: number) => {
    const moveActions = Array.isArray(moves[policy.intent]) ? moves[policy.intent] : [];
    const pct = totalWeight > 0 ? `${Math.round((Math.max(0, Number(policy.weight) || 0) / totalWeight) * 100)}%` : 'N/A';
    const hasDamage = moveActions.some((a: any) => a.type === 'DealDamage');
    const hasStatus = moveActions.some((a: any) => a.type === 'ApplyStatus');
    return {
      label: `Intent ${idx + 1}`,
      headline: `${policy.intent}（权重 ${pct}）`,
      detail: moveActions.length > 0 ? moveActions.map(actionSummary).join('；') : '无动作定义',
      tone: hasDamage ? 'offense' : hasStatus ? 'status' : 'neutral'
    } satisfies CodexDemoFrame;
  });
  return {
    kind: 'enemy',
    title: '实战演示（意图轮播）',
    subtitle: '展示该敌人的常见意图与动作构成，帮助预判战斗节奏',
    frames,
    loopMs: 2400
  };
}

function actionSummary(action: any): string {
  if (!action || typeof action !== 'object') return '未知动作';
  if (action.type === 'DealDamage') return `造成 ${action.amount ?? '?'} 点伤害（目标：${action.target || '未知'}）`;
  if (action.type === 'GainBlock') return `获得 ${action.amount ?? '?'} 点护盾`;
  if (action.type === 'ApplyStatus') return `${action.target === 'Self' ? '自身' : '目标'}获得 ${action.status || '状态'} ${action.amount ?? '?'}`;
  if (action.type === 'DrawCards') return `抽 ${action.amount ?? '?'} 张牌`;
  if (action.type === 'Delay') {
    const nested = Array.isArray(action.actions) ? action.actions.map(actionSummary).join('；') : '延迟动作';
    return `${action.turns ?? '?'} 回合后触发：${nested}`;
  }
  if (action.type === 'TriggerDelay') return '立即触发一张已延迟卡牌';
  if (action.type === 'ReturnLastCard') return '将上一张打出的牌返回手牌并临时改费';
  if (action.type === 'Conditional') return '根据条件触发不同效果';
  if (action.type === 'GainIntel') return `获得 ${action.amount ?? '?'} 情报`;
  if (action.type === 'SpendIntel') return `消耗 ${action.amount ?? '?'} 情报`;
  if (action.type === 'GainEnergy') return `获得 ${action.amount ?? '?'} 点能量`;
  return `${ACTION_LABELS[action.type] || action.type}`;
}

function effectSummary(effect: any): string {
  if (!effect || typeof effect !== 'object') return '未知效果';
  if (effect.type === 'Heal') {
    const amount = typeof effect.amount === 'number' && effect.amount > 0 && effect.amount < 1
      ? `${Math.round(effect.amount * 100)}% 最大生命`
      : `${effect.amount ?? '?'} 点生命`;
    return `恢复 ${amount}`;
  }
  if (effect.type === 'GainBlock') return `获得 ${effect.amount ?? '?'} 点护盾`;
  if (effect.type === 'GainEnergy') return `获得 ${effect.amount ?? '?'} 点能量`;
  if (effect.type === 'ApplyStatus') return `${effect.target === 'Self' ? '自身' : '目标'}获得 ${effect.status} ${effect.amount ?? '?'}`;
  if (effect.type === 'LiquidLightning') return '获得能量并在本回合进入感电（出牌自伤风险）';
  if (effect.type === 'MutagenicDraft') return '获得能量/护盾/力量，同时承受副作用（中毒）';
  if (effect.type === 'ComboBrew') return '下张牌获得双重施放效果';
  if (effect.type === 'SacrificialElixir') return '牺牲生命换取能量与力量';
  if (effect.type === 'HexagrammaticWards') return '获得防护并压低亚空间潮汐';
  return `${effect.type}`;
}

function parseEnemyMoves(enemy: any): { mechanics: string[]; interactions: string[]; examples: string[] } {
  const mechanics: string[] = [];
  const interactions: string[] = [];
  const examples: string[] = [];
  const moves = enemy.moves || {};
  const intentPolicy = Array.isArray(enemy.intent_policy) ? enemy.intent_policy : [];
  const weightTotal = intentPolicy.reduce((s: number, p: any) => s + Math.max(0, Number(p.weight) || 0), 0);

  for (const policy of intentPolicy) {
    const moveActions = Array.isArray(moves[policy.intent]) ? moves[policy.intent] : [];
    const desc = moveActions.length > 0 ? moveActions.map(actionSummary).join('；') : '无动作定义';
    const pct = weightTotal > 0 ? `（权重 ${policy.weight} / 约 ${(Number(policy.weight || 0) / weightTotal * 100).toFixed(0)}%）` : '';
    mechanics.push(`意图「${policy.intent}」${pct}: ${desc}`);
    for (const a of moveActions) {
      if (a.type === 'ApplyStatus' && a.status) interactions.push(`会施加 ${a.status}，需提前考虑解法或防御。`);
      if (a.type === 'DealDamage' && Number(a.amount || 0) >= 10) interactions.push('高伤动作可能需要预留护盾或减伤。');
    }
  }

  const firstIntent = intentPolicy[0]?.intent;
  if (firstIntent) {
    examples.push(`示例应对：若敌人准备「${firstIntent}」，可优先根据其伤害/状态类型决定防御或抢杀。`);
  }

  return {
    mechanics: uniqStrings(mechanics),
    interactions: uniqStrings(interactions),
    examples: uniqStrings(examples)
  };
}

function buildCardEntries(): CodexCatalogEntry[] {
  return (cardsData as any[]).map((card) => {
    const localizedName = getCardNameZh(card);
    const localizedText = getCardTextZh(card, card.text || '卡牌效果');
    const localizedUpgradeText = card.upgrade?.text ? getCardTextZh(card, card.upgrade.text) : '';
    const actions = Array.isArray(card.actions) ? card.actions : [];
    const upgradeActions = Array.isArray(card.upgrade?.actions) ? card.upgrade.actions : [];
    const mechanics = [
      `基础效果：${actions.length ? localizedText || actions.map(actionSummary).join('；') : localizedText || '无'}`,
      card.upgrade ? `升级后（${localizedName}+）：${localizedUpgradeText || upgradeActions.map(actionSummary).join('；')}` : ''
    ].filter(Boolean);

    const interactions = uniqStrings([
      Array.isArray(card.tags) && card.tags.includes('warp') ? '会与亚空间潮汐、腐化及相关奇物产生联动。' : '',
      Array.isArray(card.tags) && card.tags.includes('strike') ? '属于攻击节奏组件，可与力量、易伤、连击类增益叠加。' : '',
      card.targeting === 'Enemy' ? '需要目标选择；目标失效时可能需要重新指定。' : '',
      card.type === 'Skill' ? '技能牌通常不直接造成伤害，但会重塑手牌资源或状态。' : '',
      card.type === 'Power' ? '能力牌偏长期收益，需评估前期节奏损失。' : ''
    ]);

    const examples = uniqStrings([
      `示例：${card.cost ?? 0} 费打出《${localizedName}》，然后根据其效果安排后续能量与目标。`,
      card.upgrade ? `升级收益示例：优先升级《${localizedName}》可提升 ${localizedUpgradeText || '核心效果'}。` : ''
    ]);

    const loreFragments = collectCardLoreFragments(card);

    const keywords = uniqStrings([
      card.name,
      localizedName,
      card.id,
      card.type,
      card.rarity,
      ...(card.tags || []),
      card.character,
      localizedText
    ]);

    const searchText = [...keywords, ...mechanics, ...interactions, ...examples, ...loreFragments.map((x) => `${x.label} ${x.text}`)].join(' ').toLowerCase();

    const entry = {
      category: 'cards',
      id: card.id,
      name: localizedName,
      imageSrc: `/assets/cards/${card.id}.png`,
      rarity: card.rarity,
      subtitle: `${card.type} · ${getCardTargetingZh(card.targeting)}`,
      keywords,
      summary: localizedText || '卡牌效果',
      mechanics,
      interactions,
      examples,
      badges: uniqStrings([card.character && card.character !== 'All' ? card.character : 'All', card.type, card.rarity, ...(card.tags || []).slice(0, 4)]),
      searchText,
      dataPoints: [
        ...(card.upgrade ? [{ label: '升级', value: localizedUpgradeText || upgradeActions.map(actionSummary).join('; ') || '见动作定义' }] : []),
        { label: '费用', value: String(card.cost ?? '-') },
        { label: '类型', value: String(card.type || '-') },
        { label: '目标', value: getCardTargetingZh(card.targeting) },
        { label: '角色', value: String(card.character || 'All') }
      ],
      background: typeof card.background === 'string' ? card.background : undefined,
      loreFragments: loreFragments.length ? loreFragments : undefined,
      notes: card.upgrade ? [`升级文本：${localizedUpgradeText || '见动作定义'}`] : undefined,
      demo: createCardDemo(card)
    } satisfies CodexCatalogEntry;
    return applyNarrativeOverride(entry, HANDWRITTEN_CARD_GUIDES[card.id]);
  });
}

function buildRelicEntries(): CodexCatalogEntry[] {
  return (relicsData as any[]).map((relic) => {
    const triggerLabel = getUiLabelZh(relic.trigger || 'Passive');
    const rarityLabel = relic.corrupted ? getUiLabelZh('Corrupted') : getUiLabelZh((relic.price ?? 0) >= 180 ? 'Rare' : (relic.price ?? 0) >= 140 ? 'Uncommon' : 'Common');
    const mechanics = [
      `触发时机：${triggerLabel}`,
      `核心效果：${effectSummary(relic.effect)}`
    ];
    if (relic.resonanceGroup) mechanics.push(`共振组：${relic.resonanceGroup}（多个同组奇物可能触发共振收益）`);
    if (relic.evolve?.track) mechanics.push(`进化轨迹：通过 ${relic.evolve.track} 累积进度（阈值：${(relic.evolve.thresholds || []).join('/') || '未定义'}）`);

    const interactions = uniqStrings([
      relic.corrupted ? '腐化奇物通常会推动亚空间潮汐或腐化轴，注意风险叠加。' : '',
      relic.trigger === 'StartCombat' ? '开战触发型奇物会在首回合前生效，影响起手节奏。' : '',
      relic.trigger === 'EndCombat' ? '战后结算型奇物影响续航与长期资源。' : '',
      ...(relic.tags || []).map((tag: string) => `标签联动：${tag}（可与同类卡牌/遗物构筑形成组合）。`)
    ]);

    const examples = uniqStrings([
      `示例：携带《${relic.name}》进入战斗时，系统会在${triggerLabel}自动处理效果。`
    ]);
    const loreFragments = [
      relic.inscription ? {
        label: '铭文',
        text: String(relic.inscription),
        source: inferRelicLoreSource(relic, 'inscription'),
        tone: relic.corrupted ? 'warp' as const : 'neutral' as const
      } : null,
      relic.flavorText ? {
        label: '上一任主人的遗言',
        text: String(relic.flavorText),
        source: inferRelicLoreSource(relic, 'flavorText'),
        tone: relic.corrupted ? 'grim' as const : (relic.tags || []).includes('devotion') ? 'faith' as const : 'grim' as const
      } : null
    ].filter(Boolean) as Array<{ label: string; text: string; source?: string; tone?: 'neutral' | 'grim' | 'faith' | 'warp' }>;

    const keywords = uniqStrings([
      relic.id, relic.name, relic.description, relic.trigger, relic.resonanceGroup, ...(relic.tags || []), relic.corrupted ? 'corrupted' : ''
    ]);

    return {
      category: 'relics',
      id: relic.id,
      name: relic.name,
      imageSrc: `/assets/relics/${relic.id}.png`,
      rarity: rarityLabel,
      subtitle: `触发 · ${triggerLabel}`,
      keywords,
      summary: relic.description || '奇物效果',
      mechanics,
      interactions,
      examples,
      badges: uniqStrings([relic.corrupted ? getUiLabelZh('Corrupted') : '常规', triggerLabel, relic.resonanceGroup, ...(relic.tags || []).slice(0, 4)]),
      searchText: [...keywords, ...mechanics, ...interactions, ...examples, ...loreFragments.map((x) => `${x.label} ${x.text}`)].join(' ').toLowerCase(),
      dataPoints: [
        { label: '价格', value: String(relic.price ?? '-') },
        { label: '触发', value: triggerLabel },
        { label: '共振', value: relic.resonanceGroup || '无' }
      ],
      loreFragments: loreFragments.length ? loreFragments : undefined
    };
  });
}

function buildPotionEntries(): CodexCatalogEntry[] {
  return (potionsData as any[]).map((potion) => {
    const toxicity = Math.max(0, Number(potion.toxicity ?? 1));
    const mechanics = [
      `使用条件：战斗中点击药水槽使用（需有空闲操作时机）`,
      `核心效果：${effectSummary(potion.effect)}`,
      `毒性：+${toxicity}（超过阈值会触发过载压力）`
    ];
    const interactions = uniqStrings([
      toxicity >= 3 ? '高毒性药水适合终结或关键回合，不宜连续滥用。' : '低毒性药水适合过渡回合与容错补给。',
      ...(potion.tags || []).map((tag: string) => `标签联动：${tag}（和对应流派/遗物更契合）。`)
    ]);
    const examples = uniqStrings([
      `示例：在敌人高伤意图回合使用《${potion.name}》，可改变当回合生存或爆发线。`
    ]);
    const keywords = uniqStrings([potion.id, potion.name, potion.description, ...(potion.tags || []), potion.effect?.type]);
    return {
      category: 'potions',
      id: potion.id,
      name: potion.name,
      imageSrc: `/assets/potions/${potion.id}.png`,
      rarity: toxicity >= 3 ? 'High Toxicity' : toxicity >= 2 ? 'Medium Toxicity' : 'Stable',
      subtitle: `Potion · Toxicity ${toxicity}`,
      keywords,
      summary: potion.description || '药水效果',
      mechanics,
      interactions,
      examples,
      badges: uniqStrings([`Toxicity ${toxicity}`, ...(potion.tags || []).slice(0, 4)]),
      searchText: [...keywords, ...mechanics, ...interactions, ...examples].join(' ').toLowerCase(),
      dataPoints: [
        { label: '价格', value: String(potion.price ?? '-') },
        { label: '毒性', value: String(toxicity) },
        { label: '效果类型', value: String(potion.effect?.type || '-') }
      ]
    };
  });
}

function buildEnemyEntries(): CodexCatalogEntry[] {
  const entries: CodexCatalogEntry[] = [];
  for (const enemy of enemiesData as any[]) {
    const isEliteLike = !!enemy.keywords?.includes('elite') || !!enemy.keywords?.includes('boss');
    const category: CodexCategory = isEliteLike ? 'elites' : 'enemies';
    const parsed = parseEnemyMoves(enemy);
    const hpRange = Array.isArray(enemy.hp_range) ? `${enemy.hp_range[0]}-${enemy.hp_range[1]}` : '-';
    const badges = uniqStrings([
      ...(enemy.keywords || []),
      isEliteLike ? (enemy.keywords?.includes('boss') ? 'Boss' : 'Elite') : 'Normal'
    ]);
    const summary = `生命值 ${hpRange} · ${Array.isArray(enemy.intent_policy) ? enemy.intent_policy.length : 0} 种意图`;
    const mechanics = [`生命区间：${hpRange}`].concat(parsed.mechanics);
    const interactions = uniqStrings([
      ...parsed.interactions,
      enemy.keywords?.includes('boss') ? 'Boss 战通常拥有更高血量与多段攻击，需要规划爆发与防御窗口。' : '',
      enemy.keywords?.includes('elite') ? '精英怪压制力显著高于普通敌人，建议携带药水或关键遗物入战。' : ''
    ]);
    const examples = uniqStrings(parsed.examples);
    const keywords = uniqStrings([enemy.id, enemy.name, ...(enemy.keywords || []), ...Object.keys(enemy.moves || {})]);
    const loreFragments = collectEnemyLoreFragments(enemy);
    const entry = {
      category,
      id: enemy.id,
      name: enemy.name,
      imageSrc: localEnemyArt(enemy.id),
      rarity: enemy.keywords?.includes('boss') ? 'Boss' : enemy.keywords?.includes('elite') ? 'Elite' : 'Normal',
      subtitle: category === 'elites' ? 'Elite/Boss Encounter' : 'Normal Encounter',
      keywords,
      summary,
      mechanics,
      interactions,
      examples,
      badges,
      searchText: [...keywords, summary, ...mechanics, ...interactions, ...examples, ...loreFragments.map((x) => `${x.label} ${x.text}`)].join(' ').toLowerCase(),
      dataPoints: [
        { label: '生命值', value: hpRange },
        { label: '意图数', value: String(Array.isArray(enemy.intent_policy) ? enemy.intent_policy.length : 0) },
        { label: '分类', value: enemy.keywords?.includes('boss') ? 'Boss' : enemy.keywords?.includes('elite') ? 'Elite' : 'Normal' }
      ],
      notes: Object.keys(enemy.moves || {}).length > 0 ? [`招式池：${Object.keys(enemy.moves).join(' / ')}`] : undefined,
      background: typeof enemy.background === 'string' ? enemy.background : undefined,
      loreFragments: loreFragments.length ? loreFragments : undefined,
      demo: createEnemyDemo(enemy)
    } satisfies CodexCatalogEntry;
    entries.push(category === 'elites' ? applyNarrativeOverride(entry, HANDWRITTEN_ELITE_GUIDES[enemy.id]) : entry);
  }
  return entries;
}

function buildEventEntries(): CodexCatalogEntry[] {
  const legacyEvents = [
    {
      id: 'mysterious_shrine',
      title: 'Mysterious Shrine / 神秘神龛',
      floorMin: 1,
      floorMax: 10,
      loreText: ['一个古老神龛，提供祝福或代价交换。'],
      options: [
        { id: 'pray', text: '祈祷', description: '获得生命提升', gains: ['最大生命值 +10'], costs: [] },
        { id: 'decline', text: '离开', description: '无事发生', gains: [], costs: [] }
      ],
      imagePath: '/assets/events/event_shrine.png'
    },
    {
      id: 'heretic_altar',
      title: 'Heretic Altar / 异端祭坛',
      floorMin: 1,
      floorMax: 10,
      loreText: ['一座充满腐化诱惑的祭坛，提供被污染的馈赠。'],
      options: [
        { id: 'accept_corruption', text: '接受腐化', description: '获得腐化遗物与腐化值', gains: ['获得遗物'], costs: ['腐化 +10'] },
        { id: 'decline', text: '拒绝', description: '离开祭坛', gains: [], costs: [] }
      ],
      imagePath: '/assets/events/event_altar.png'
    }
  ];

  const allEvents = [...(STORY_EVENTS as any[]), ...legacyEvents];
  return allEvents.map((ev: any) => {
    const optionSummaries = (ev.options || []).map((opt: any) => {
      const gains = Array.isArray(opt.gains) && opt.gains.length ? `得：${opt.gains.join('、')}` : '';
      const costs = Array.isArray(opt.costs) && opt.costs.length ? `代价：${opt.costs.join('、')}` : '';
      return `${opt.text} ${opt.description || ''} ${gains} ${costs}`.trim();
    });
    const mechanics = [
      `触发层数：${ev.floorMin ?? 1} - ${ev.floorMax ?? 10} 层`,
      ...(ev.options || []).map((opt: any) => `选项 ${opt.text}: ${opt.description || '无描述'}`)
    ];
    const interactions = uniqStrings([
      ...(ev.options || []).flatMap((opt: any) => [
        ...(opt.gains || []).map((g: string) => `收益联动：${g}`),
        ...(opt.costs || []).map((c: string) => `代价联动：${c}`)
      ]),
      '事件通常以“等价交换”为核心，选择前请先评估当前血量、卡组和地图路径。'
    ]);
    const examples = uniqStrings([
      `示例决策：如果当前血量偏低，可优先选择代价更稳定的分支；若构筑已成型，可承受高风险换高收益。`
    ]);
    const keywords = uniqStrings([
      ev.id,
      ev.title,
      ...(ev.loreText || []),
      ...(ev.options || []).flatMap((o: any) => [o.id, o.text, o.description, ...(o.gains || []), ...(o.costs || [])])
    ]);

    const entry = {
      category: 'events',
      id: ev.id,
      name: ev.title,
      imageSrc: ev.imagePath,
      rarity: 'Event',
      subtitle: `Event · Floors ${ev.floorMin ?? 1}-${ev.floorMax ?? 10}`,
      keywords,
      summary: (ev.loreText || [])[0] || '事件分支与代价交换',
      mechanics,
      interactions,
      examples,
      badges: uniqStrings([`F${ev.floorMin ?? 1}-${ev.floorMax ?? 10}`, ...(ev.options || []).map((o: any) => o.danger ? String(o.danger).toUpperCase() : '').filter(Boolean)]),
      searchText: [...keywords, ...optionSummaries, ...mechanics, ...interactions, ...examples].join(' ').toLowerCase(),
      dataPoints: [
        { label: '触发层', value: `${ev.floorMin ?? 1}-${ev.floorMax ?? 10}` },
        { label: '选项数', value: String((ev.options || []).length) },
        { label: '权重', value: String(ev.weight ?? 1) }
      ],
      notes: optionSummaries.length ? optionSummaries : undefined
    } satisfies CodexCatalogEntry;
    return applyNarrativeOverride(entry, HANDWRITTEN_EVENT_GUIDES[ev.id]);
  });
}

let cache: CodexCatalogEntry[] | null = null;

export function getCodexCatalog(): CodexCatalogEntry[] {
  if (cache) return cache;
  cache = [
    ...buildRelicEntries(),
    ...buildPotionEntries(),
    ...buildCardEntries(),
    ...buildEnemyEntries(),
    ...buildEventEntries()
  ];
  return cache;
}

export function getCodexCatalogCounts(): Record<CodexCategory, number> {
  const entries = getCodexCatalog();
  return {
    relics: entries.filter((e) => e.category === 'relics').length,
    potions: entries.filter((e) => e.category === 'potions').length,
    cards: entries.filter((e) => e.category === 'cards').length,
    enemies: entries.filter((e) => e.category === 'enemies').length,
    elites: entries.filter((e) => e.category === 'elites').length,
    events: entries.filter((e) => e.category === 'events').length
  };
}
