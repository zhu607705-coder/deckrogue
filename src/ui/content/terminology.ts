/**
 * @file terminology.ts
 * @description 术语和本地化工具 - 提供卡牌/术语的中文名称和解释
 *
 * 主要职责:
 * - 获取卡牌中文名称和描述
 * - 管理术语词典和关键词注册
 * - 解析术语标记为富文本
 * - 提供 UI 标签本地化
 */

import cardNamesData from '@/content/data/cardNames.json';
import keywordRegistryData from '@/content/data/keywordRegistry.json';
import worldLoreData from '@/content/data/worldLore.json';
import { grimdarkTerminology } from '@/ui/theme';

type KeywordEntry = {
  id: string;
  name: string;
  nameEn?: string;
  description: string;
  abbreviation?: string;
  category?: string;
};

export type GlossaryEntry = {
  key: string;
  label: string;
  description: string;
  aliases: string[];
  source: 'keywordRegistry' | 'grimdark' | 'worldLore' | 'fallback';
  category?: string;
};

type CardLike = {
  id: string;
  name: string;
  text: string;
  targeting?: string;
};

const CARD_NAMES_ZH = cardNamesData as Record<string, string>;
const KEYWORD_REGISTRY = keywordRegistryData as {
  keywords: Record<string, KeywordEntry>;
};
const WORLD_LORE = worldLoreData as {
  termGlossary?: Record<string, string>;
};

const CARD_NAME_FALLBACK_ZH: Record<string, string> = {
  strike: '打击',
  defend: '防御',
  gather_intel: '收集情报',
  precision_strike: '精准打击',
  dead_drop: '死信投递'
};

const CARD_TEXT_OVERRIDES_BY_ID: Record<string, string> = {
  strike: '造成 5 点伤害。',
  defend: '获得 4 点护盾。',
  gather_intel: '获得 1 点情报。抽 2 张牌。',
  precision_strike: '若你拥有 1 点情报，则消耗它并造成 9 点伤害；否则造成 6 点伤害。',
  dead_drop: '获得 1 点情报。若这是你本回合打出的第一张牌，则抽 1 张牌。'
};

const TARGETING_LABELS: Record<string, string> = {
  Enemy: '单体目标',
  Self: '自身',
  AllEnemies: '全体目标',
  RandomEnemy: '随机目标',
  None: '无目标'
};

const UI_LABELS_ZH: Record<string, string> = {
  'Ritual Access Node': '战区接入节点',
  'Launch Sequence': '战区启动序列',
  'Version State': '版本态势',
  'Archive': '作战档案',
  'Execution Registry': '执行序列名录',
  'Achievements': '成就',
  'Unlocks': '解锁项',
  'Starting Relic': '起始遗物',
  'Recovery Draft': '战后回收',
  'Atmosphere': '氛围记录',
  'Decision Rule': '决策准则',
  'Option': '方案',
  'Narrative Event': '叙事事件',
  'Field Record': '现场记录',
  'Decision': '抉择',
  'Codex': '图鉴',
  'Mission Archive': '任务档案',
  'Martyr Archive': '殉道者档案',
  'Scavenger Exchange': '拾荒者交易所',
  'Merchant Note': '商贩批注',
  'Acquisition': '收购目录',
  'Offer': '货单',
  'Permanent Edge': '恒定优势',
  'Volatile Tools': '挥发器具',
  'Meta Settlement': '局外结算',
  'Debrief': '战区简报',
  'Final Vox-Log': '最终语音记录',
  'Blackbox Logs': '黑匣子记录',
  'Warp Echoes': '亚空间回响',
  'Enemy': '异端',
  'Stable': '稳定',
  'End Turn': '结束周期',
  'Continue': '继续作战',
  'New Run': '新局远征',
  'Meta State': '局外状态',
  'Operative Lineup': '执行体阵列'
  ,
  StartCombat: '开战前',
  EndCombat: '战后结算',
  StartTurn: '回合开始',
  EndTurn: '回合结束',
  Passive: '常驻',
  CombatEnd: '战斗结束',
  EndOfEliteCombat: '精英战后',
  EndOfTurn: '回合结束',
  EndOfTurnWithElements: '回合结束（元素充盈）',
  EnterFloor: '进入新层',
  EnterMirrorZone: '进入镜宫',
  Event: '事件抉择',
  OnApplyDebuff: '施加减益时',
  OnApplyWeak: '施加虚弱时',
  OnAttackHit: '攻击命中时',
  OnAttackWeakVulnerable: '攻击命中虚弱或易伤目标时',
  OnEnemyBelowHalfHealth: '异端跌至半血时',
  OnGainConcoction: '获得炼金混合物时',
  OnKill: '击杀时',
  OnKillWithDebuff: '击杀带减益目标时',
  OnPlayCard: '出牌时',
  OnRemoveDebuff: '移除减益时',
  OnSpendResource: '消耗资源时',
  OnTakeDamage: '受到伤害时',
  PassNode: '穿越节点',
  PoisonTick: '中毒结算时',
  StartOfTurn: '回合开始',
  StartRun: '开局部署',
  Common: '普通',
  Uncommon: '罕见',
  Rare: '稀有',
  Corrupted: '腐化',
  Requisition: '军需点',
  Boss: '章节首领',
  Doctrine: '教条',
  Upgrade: '升级',
  Pact: '契约',
  Evidence: '证据',
  Rage: '狂怒',
  Command: '指挥',
  Overheat: '过热',
  Poison: '中毒',
  Weak: '虚弱',
  Vulnerable: '易伤',
  Tech: '机械神甫'
};

const FALLBACK_TERMS: Record<string, Omit<GlossaryEntry, 'aliases' | 'source'>> = {
  devotion: { key: 'devotion', label: '虔敬', description: '虔敬越高，越靠近秩序与忠诚的战术轴。', category: 'axis' },
  corruption: { key: 'corruption', label: '腐化', description: '腐化越高，越接近亚空间失控与高风险收益。', category: 'axis' },
  stable: { key: 'stable', label: '稳定', description: '当前轴线尚未明显偏向虔敬或腐化。', category: 'axis' },
  hp: { key: 'hp', label: '生命值', description: '单位当前可承受的伤害额度。', category: 'resource' },
  block: { key: 'block', label: '护盾', description: '优先抵消即将受到的直接伤害。', category: 'resource' },
  energy: { key: 'energy', label: '能量', description: '本回合打出牌张所需的核心资源。', category: 'resource' },
  intel: { key: 'intel', label: '情报', description: '情报资源，可用于触发侦缉与分析类额外效果。', category: 'resource' },
  vulnerable: { key: 'vulnerable', label: '易伤', description: '受到的攻击伤害提高。', category: 'status' },
  weak: { key: 'weak', label: '虚弱', description: '造成的攻击伤害降低。', category: 'status' }
  ,
  enemy_target: { key: 'enemy_target', label: '单体目标', description: '需要手动指定一名敌对目标。', category: 'targeting' },
  self_target: { key: 'self_target', label: '自身', description: '效果只作用于你当前控制的执行体。', category: 'targeting' },
  all_enemies_target: { key: 'all_enemies_target', label: '全体目标', description: '效果会同时覆盖当前存活的全部敌对目标。', category: 'targeting' },
  random_enemy_target: { key: 'random_enemy_target', label: '随机目标', description: '系统会在当前存活的敌人中随机选定一名目标。', category: 'targeting' }
};

function normalizeTerm(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_\-·:：()[\]'"`]/g, '');
}

function titleCaseKey(key: string): string {
  return key.charAt(0).toUpperCase() + key.slice(1);
}

const glossaryEntries: GlossaryEntry[] = [];
const glossaryMap = new Map<string, GlossaryEntry>();

function registerGlossaryEntry(entry: GlossaryEntry) {
  glossaryEntries.push(entry);
  for (const alias of entry.aliases) {
    glossaryMap.set(normalizeTerm(alias), entry);
  }
  glossaryMap.set(normalizeTerm(entry.label), entry);
  glossaryMap.set(normalizeTerm(entry.key), entry);
}

for (const [id, keyword] of Object.entries(KEYWORD_REGISTRY.keywords || {})) {
  registerGlossaryEntry({
    key: id,
    label: keyword.name,
    description: keyword.description,
    aliases: [id, keyword.name, keyword.nameEn || '', keyword.abbreviation || ''].filter(Boolean),
    source: 'keywordRegistry',
    category: keyword.category
  });
}

for (const [groupName, terms] of Object.entries({
  ...grimdarkTerminology.resources,
  ...grimdarkTerminology.game,
  ...grimdarkTerminology.combat,
  ...grimdarkTerminology.mechanics
})) {
  registerGlossaryEntry({
    key: groupName,
    label: terms.name,
    description: terms.description,
    aliases: [groupName, titleCaseKey(groupName), terms.name],
    source: 'grimdark',
    category: 'ui'
  });
}

for (const [sourceLabel, translatedLabel] of Object.entries(WORLD_LORE.termGlossary || {})) {
  registerGlossaryEntry({
    key: sourceLabel,
    label: translatedLabel,
    description: `${translatedLabel}是当前 UI 与图鉴中采用的统一称呼。`,
    aliases: [sourceLabel, translatedLabel],
    source: 'worldLore',
    category: 'term'
  });
}

for (const term of Object.values(FALLBACK_TERMS)) {
  registerGlossaryEntry({
    ...term,
    aliases: [term.key, term.label, titleCaseKey(term.key)],
    source: 'fallback'
  });
}

const INLINE_GLOSSARY_TERMS = Array.from(
  new Set(
    glossaryEntries
      .filter((entry) => ['status', 'buff', 'debuff', 'resource', 'mechanic', 'axis', 'targeting'].includes(entry.category || ''))
      .map((entry) => entry.label)
      .filter((label) => label.length >= 2)
  )
).sort((a, b) => b.length - a.length);

function escapeRegex(source: string): string {
  return source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const INLINE_TERM_REGEX = new RegExp(
  `(${INLINE_GLOSSARY_TERMS.map(escapeRegex).join('|')})`,
  'g'
);

const INLINE_SPLIT_REGEX = new RegExp(
  `(\\[[^\\]]+\\]|\\d+|${INLINE_GLOSSARY_TERMS.map(escapeRegex).join('|')})`,
  'g'
);

export function getGlossaryEntry(term: string): GlossaryEntry | null {
  if (!term) return null;
  const clean = term.replace(/^\[|\]$/g, '');
  return glossaryMap.get(normalizeTerm(clean)) || null;
}

export function getGlossaryTooltip(term: string): string | undefined {
  const entry = getGlossaryEntry(term);
  if (!entry) return undefined;
  return `${entry.label}：${entry.description}`;
}

export function getCardNameZh(card: Pick<CardLike, 'id' | 'name'>): string {
  return CARD_NAMES_ZH[card.id] || CARD_NAME_FALLBACK_ZH[card.id] || card.name;
}

export function getCardTargetingZh(targeting?: string): string {
  if (!targeting) return '无目标';
  return TARGETING_LABELS[targeting] || targeting;
}

function applyGenericCardTextLocalization(text: string): string {
  return text
    .replace(/^Deal (\d+) damage to ALL enemies\.$/i, '对全体异端造成 $1 点伤害。')
    .replace(/^Deal (\d+) damage\.$/i, '造成 $1 点伤害。')
    .replace(/^Gain (\d+) block\.$/i, '获得 $1 点护盾。')
    .replace(/^Gain (\d+) Block\.$/i, '获得 $1 点护盾。')
    .replace(/^Draw (\d+) cards?\.$/i, '抽 $1 张牌。')
    .replace(/^Discard (\d+) cards?\.$/i, '弃掉 $1 张牌。')
    .replace(/^Gain (\d+) Intel\.$/i, '获得 $1 点情报。')
    .replace(/^Gain (\d+) Energy\.$/i, '获得 $1 点能量。')
    .replace(/^Gain (\d+) Strength\.$/i, '获得 $1 点力量。')
    .replace(/^Apply (\d+) Vulnerable\.$/i, '施加 $1 层易伤。')
    .replace(/^Apply (\d+) Weak\.$/i, '施加 $1 层虚弱。')
    .replace(/^Apply (\d+) Poison\.$/i, '施加 $1 层中毒。')
    .replace(/^Apply (\d+) Poison to a random enemy (\d+) times\.$/i, '对随机异端施加 $1 层中毒，共触发 $2 次。')
    .replace(/^Double your Strength\.$/i, '使你的力量翻倍。')
    .replace(/^Double the enemy's Poison\.$/i, '使目标的中毒层数翻倍。')
    .replace(/^Deal (\d+) damage\. Apply (\d+) Vulnerable\.$/i, '造成 $1 点伤害。施加 $2 层易伤。')
    .replace(/^Gain (\d+) Intel\. Draw (\d+) cards\.$/i, '获得 $1 点情报。抽 $2 张牌。')
    .replace(/^Draw (\d+) cards\. Discard (\d+) card\.$/i, '抽 $1 张牌。弃掉 $2 张牌。')
    .replace(/^Deal damage equal to your Block\.$/i, '造成等同于你当前护盾值的伤害。')
    .replace(/^Delay (\d+): Deal (\d+) damage\.$/i, '延迟 $1 回合：造成 $2 点伤害。')
    .replace(/^Trigger a delayed card immediately\.$/i, '立刻引爆一张延迟牌。')
    .replace(/^Draw (\d+) cards\. The next Attack you play this turn costs (\d+) less\.$/i, '抽 $1 张牌。你本回合打出的下一张攻击牌费用减少 $2。')
    .replace(/^Gain (\d+) Energy\. Draw (\d+) cards\. Skip your next draw phase\.$/i, '获得 $1 点能量。抽 $2 张牌。跳过你的下一次抽牌阶段。')
    .replace(/^At the start of your turn, if you have (\d+)\+ delayed cards, gain (\d+) Block\.$/i, '在你的回合开始时，若你有至少 $1 张延迟牌，则获得 $2 点护盾。')
    .replace(/^Restore all HP lost last turn\.$/i, '恢复你上一回合失去的全部生命值。')
    .replace(/^Deal (\d+) damage\. Delay (\d+): Deal (\d+) damage\.$/i, '造成 $1 点伤害。延迟 $2 回合：再造成 $3 点伤害。')
    .replace(/^Deal (\d+) damage to ALL enemies\. Deals (\d+) more damage for each delayed card\.$/i, '对全体异端造成 $1 点伤害。每有一张延迟牌，额外造成 $2 点伤害。')
    .replace(
      /^If you have (\d+) Intel, spend it to deal (\d+) damage\. Otherwise deal (\d+) damage\.$/i,
      '若你拥有 $1 点情报，则消耗它并造成 $2 点伤害；否则造成 $3 点伤害。'
    )
    .replace(
      /^Gain (\d+) Intel\. If this is the first card you play this turn, draw (\d+) card\.$/i,
      '获得 $1 点情报。若这是你本回合打出的第一张牌，则抽 $2 张牌。'
    );
}

export function getCardTextZh(card: Pick<CardLike, 'id'>, text: string): string {
  if (/[\u4e00-\u9fff]/.test(text)) return text;
  return CARD_TEXT_OVERRIDES_BY_ID[card.id] || applyGenericCardTextLocalization(text);
}

export function getUiLabelZh(label: string): string {
  return UI_LABELS_ZH[label] || label;
}

export type TextToken =
  | { type: 'text'; value: string }
  | { type: 'number'; value: string }
  | { type: 'term'; value: string; tooltip?: string };

export function tokenizeGlossaryText(text: string): TextToken[] {
  const parts = text.split(INLINE_SPLIT_REGEX);
  return parts
    .filter(Boolean)
    .map((part) => {
      if (/^\d+$/.test(part)) return { type: 'number', value: part } satisfies TextToken;
      if (/^\[[^\]]+\]$/.test(part)) {
        const raw = part.slice(1, -1);
        return { type: 'term', value: raw, tooltip: getGlossaryTooltip(raw) } satisfies TextToken;
      }
      if (INLINE_TERM_REGEX.test(part) && getGlossaryEntry(part)) {
        INLINE_TERM_REGEX.lastIndex = 0;
        return { type: 'term', value: part, tooltip: getGlossaryTooltip(part) } satisfies TextToken;
      }
      INLINE_TERM_REGEX.lastIndex = 0;
      return { type: 'text', value: part } satisfies TextToken;
    });
}
