/**
 * @file EventView.tsx
 * @description 事件视图 - 处理随机故事事件和玩家选择
 *
 * 主要职责:
 * - 渲染事件文本和选项
 * - 显示选项代价和收益预览
 * - 处理事件选项点击和确认
 * - 支持 NPC 对话分支系统
 * - 根据事件类型切换背景
 *
 * 架构说明:
 * - 与 GlossaryText 组件协作展示术语高亮
 * - 支持 EventOptionLongTermEffect 显示长期影响
 */
import React from 'react';
import { GameEngine } from '@/core';
import { getStoryEventDef, getStoryEventOptionPresentation, relicsData } from '@/content/narrative/numericSystem';
import { ASSET_PLACEHOLDERS, bindImgFallback } from '@/ui/components/assetHelpers';
import { BackgroundImage, VIEW_BACKGROUNDS } from '@/ui/components/BackgroundImage';
import { GlossaryText } from '@/ui/components/GlossaryText';
import { EventOptionLongTermEffect } from '@/ui/components/EventLongTermEffect';
import { getUiLabelZh } from '@/ui/content/terminology';
import { uiWorldLore } from '@/ui/content/worldLore';

const WORLD_LORE = uiWorldLore as any;

type EventOptionVm = {
  id: string;
  text: string;
  description: string;
  gains?: string[];
  costs?: string[];
  danger?: 'low' | 'medium' | 'high';
};

function getEventBackground(eventId: string): string {
  switch (eventId) {
    case 'rusting_medicae': return VIEW_BACKGROUNDS.events.forge;
    case 'nameless_martyr_shrine': return VIEW_BACKGROUNDS.events.shrine;
    case 'warp_tear_whispers': return VIEW_BACKGROUNDS.events.warp;
    case 'inquisitor_legacy': return VIEW_BACKGROUNDS.events.trial;
    case 'heretic_altar': return VIEW_BACKGROUNDS.events.hereticAltar;
    case 'chaos_gate': return VIEW_BACKGROUNDS.events.chaosGate;
    default: return VIEW_BACKGROUNDS.events.shrine;
  }
}

function getFloorLabel(engine: GameEngine): string {
  const nodeId = engine.state.currentNodeId;
  const node = nodeId ? engine.state.map.find(n => n.id === nodeId) : null;
  return `第 ${(node?.y ?? 0) + 1} 层`;
}

function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function getNpcVoiceKeyForEvent(eventId: string): 'servitor' | 'heretic' | 'inquisitor' {
  if (eventId === 'rusting_medicae') return 'servitor';
  if (eventId === 'inquisitor_legacy') return 'inquisitor';
  return 'heretic';
}

function pickDeterministicLine(lines: string[], seed: string): string {
  if (!lines.length) return '';
  return lines[hashString(seed) % lines.length];
}

function getEventNpcLine(engine: GameEngine, eventId: string, stage?: string): string {
  const activeEvent = engine.state.activeEvent;
  const branch = (WORLD_LORE?.npcDialogueEventBranches?.[eventId] || {}) as any;
  const lastChoiceId = String(activeEvent?.data?.lastChoiceId || '');
  const thresholds = (WORLD_LORE?.npcDialogueThresholds || {}) as any;
  const lowHpRatioThreshold = Math.max(0.05, Math.min(0.95, Number(thresholds.lowHpRatio ?? 0.35)));
  const highIntelThreshold = Math.max(0, Number(thresholds.highIntel ?? 10));
  const highDevotionThreshold = Math.max(0, Number(thresholds.highDevotion ?? 40));
  const highCorruptionThreshold = Math.max(0, Number(thresholds.highCorruption ?? 70));
  const corruption = Number(engine.state.player.corruption || 0);
  const devotion = Number(engine.state.player.devotion || 0);
  const intel = Number(engine.state.player.intel || 0);
  const hp = Number(engine.state.player.hp || 0);
  const maxHp = Math.max(1, Number(engine.state.player.maxHp || 1));
  const lowHp = hp / maxHp <= lowHpRatioThreshold;
  const highIntel = intel >= highIntelThreshold;
  const highDevotion = devotion >= highDevotionThreshold;
  const highCorruption = corruption >= highCorruptionThreshold;

  const branchPools: string[][] = [];
  if (lastChoiceId && Array.isArray(branch?.choices?.[lastChoiceId])) {
    branchPools.push(branch.choices[lastChoiceId]);
  }
  if (stage && Array.isArray(branch?.stages?.[stage])) {
    branchPools.push(branch.stages[stage]);
  }
  if (lowHp && highCorruption && Array.isArray(branch?.outcomes?.lowHpHighCorruption)) {
    branchPools.push(branch.outcomes.lowHpHighCorruption);
  }
  if (highCorruption && Array.isArray(branch?.outcomes?.highCorruption)) {
    branchPools.push(branch.outcomes.highCorruption);
  }
  if (lowHp && Array.isArray(branch?.outcomes?.lowHp)) {
    branchPools.push(branch.outcomes.lowHp);
  }
  if (highDevotion && Array.isArray(branch?.outcomes?.highDevotion)) {
    branchPools.push(branch.outcomes.highDevotion);
  }
  if (highIntel && Array.isArray(branch?.outcomes?.highIntel)) {
    branchPools.push(branch.outcomes.highIntel);
  }
  if (Array.isArray(branch?.default)) {
    branchPools.push(branch.default);
  }
  for (const lines of branchPools) {
    if (lines.length) {
      return pickDeterministicLine(
        lines,
        `${eventId}:${stage || 'default'}:${lastChoiceId || 'none'}:${highCorruption ? 'hc' : 'nc'}:${lowHp ? 'lh' : 'nh'}:${highIntel ? 'hi' : 'ni'}:${highDevotion ? 'hd' : 'nd'}`
      );
    }
  }

  const key = getNpcVoiceKeyForEvent(eventId);
  const templates = (WORLD_LORE?.npcDialogueTemplates?.[key] || []) as string[];
  if (!templates.length) return '';
  return pickDeterministicLine(templates, `${eventId}:${stage || 'default'}:fallback`);
}

function buildStoryEventOptions(engine: GameEngine): EventOptionVm[] {
  const event = engine.state.activeEvent;
  if (!event) return [];
  const def = getStoryEventDef(event.id);
  if (!def) return [];

  if (event.id === 'rusting_medicae' && event.stage === 'salvage_aftermath') {
    const fightCopy = getStoryEventOptionPresentation(event.id, 'medicae_salvage_fight', engine.state);
    const fleeCopy = getStoryEventOptionPresentation(event.id, 'medicae_salvage_flee', engine.state);
    return [
      {
        id: 'medicae_salvage_fight',
        text: '[迎战暴走医疗伺服]',
        description: '你听见液压关节拉伸的尖啸。它冲你来了。',
        gains: fightCopy?.gains || ['若战胜：保留刚刚搜刮的战利品，并获得精英战战利品'],
        costs: fightCopy?.costs || ['高风险精英战斗'],
        danger: 'high'
      },
      {
        id: 'medicae_salvage_flee',
        text: '[带着赃物撤离]',
        description: '你拖着零件冲入黑暗，在身后留下金属的嚎叫。',
        gains: fleeCopy?.gains || ['保留 100 金币与奇物'],
        costs: fleeCopy?.costs || ['受到 15 点不可减免伤害'],
        danger: 'medium'
      }
    ];
  }

  if (event.id === 'nameless_martyr_shrine' && event.stage === 'free_remove') {
    const removeCopy = getStoryEventOptionPresentation(event.id, 'martyr_continue_remove', engine.state, {
      freeRemovalsRemaining: engine.getEventFreeRemovalsRemaining()
    });
    return [
      {
        id: 'martyr_continue_remove',
        text: '[继续献祭]',
        description: '回到祭坛前，继续挑选要焚毁的牌。',
        gains: removeCopy?.gains || [`还能移除 ${engine.getEventFreeRemovalsRemaining()} 张牌`],
        costs: removeCopy?.costs || ['无法改选其他供奉方式'],
        danger: 'medium'
      }
    ];
  }

  return def.options.map(option => {
    const copy = getStoryEventOptionPresentation(event.id, option.id, engine.state);
    return {
      id: option.id,
      text: option.text,
      description: option.description,
      gains: copy?.gains || option.gains,
      costs: copy?.costs || option.costs,
      danger: option.danger
    };
  });
}

function dangerClasses(level: EventOptionVm['danger'] = 'medium') {
  switch (level) {
    case 'low':
      return 'border-emerald-500/40 bg-emerald-950/20 hover:bg-emerald-900/20';
    case 'high':
      return 'border-red-500/50 bg-red-950/25 hover:bg-red-900/25';
    default:
      return 'border-amber-500/40 bg-amber-950/15 hover:bg-amber-900/15';
  }
}

function dangerLabel(level: EventOptionVm['danger'] = 'medium') {
  return level === 'low' ? '低危' : level === 'high' ? '高危' : '中危';
}

function detectLongTermEffects(gains: string[], costs: string[]): Array<{ type: string; duration: string; description: string }> {
  const effects: Array<{ type: string; duration: string; description: string }> = [];

  const longTermKeywords = [
    { regex: /最大生命值|Max HP/i, type: 'blessing', duration: '永久' },
    { regex: /每场战斗|每章|this chapter|this run/i, type: 'buff', duration: '本局' },
    { regex: /后续|Next combat|Next \d+ combats/i, type: 'buff', duration: '短期' },
    { regex: /遗物|relic/i, type: 'blessing', duration: '永久' },
    { regex: /牌库|牌组|deck|curse/i, type: 'curse', duration: '永久' },
    { regex: /永久|permanent/i, type: 'blessing', duration: '永久' },
    { regex: /腐化|虔敬|Corruption|Devotion/i, type: 'buff', duration: '永久' },
  ];

  gains.forEach(gain => {
    longTermKeywords.forEach(({ regex, type, duration }) => {
      if (regex.test(gain)) {
        effects.push({ type, duration, description: gain });
      }
    });
  });

  costs.forEach(cost => {
    longTermKeywords.forEach(({ regex, duration }) => {
      if (regex.test(cost)) {
        effects.push({ type: 'curse', duration, description: cost });
      }
    });
  });

  return effects;
}

function StoryEventPanel({ engine }: { engine: GameEngine }) {
  const event = engine.state.activeEvent!;
  const def = getStoryEventDef(event.id);
  if (!def) return null;
  const options = buildStoryEventOptions(engine);
  const backgroundSrc = getEventBackground(event.id);
  const npcLine = getEventNpcLine(engine, event.id, event.stage);

  return (
    <BackgroundImage
      src={backgroundSrc}
      className="campaign-shell flex h-full flex-col px-4 py-6 text-slate-100 md:px-8"
      overlayOpacity={0.78}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(180,180,255,0.10),transparent_55%)]" />

      <div className="relative z-10 flex flex-col h-full max-w-5xl mx-auto w-full">
        <div className="mb-6 border-b border-white/10 pb-6">
          <div className="campaign-kicker">{getFloorLabel(engine)} · {getUiLabelZh('Narrative Event')}</div>
          <div className="mt-4 flex items-start justify-between gap-4">
            <div>
              <h1 className="campaign-title campaign-poster-title text-[clamp(2.2rem,4vw,4rem)] leading-[0.96] text-red-200">{def.title}</h1>
              <p className="campaign-copy mt-3 max-w-2xl text-sm md:text-base">
                事件页只负责一件事：让玩家在风险、即时收益和长期方向之间做出一次明确取舍。
              </p>
            </div>
            <div className="campaign-section px-3 py-2 text-xs text-slate-200">
              {event.stage === 'salvage_aftermath' ? '余波' : '遭遇'}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_1fr] gap-4 md:gap-6 flex-1 min-h-0">
          <div className="campaign-section min-h-0 overflow-y-auto p-4 md:p-6 shadow-2xl">
            <div className="campaign-kicker mb-3">{getUiLabelZh('Field Record')}</div>
            <div className="space-y-4">
              {npcLine && (
                <div className="rounded-xl border border-fuchsia-700/25 bg-fuchsia-950/10 p-3 text-sm italic text-fuchsia-100/85">
                  {'“'}<GlossaryText text={npcLine} />{'”'}
                </div>
              )}
              {def.loreText.map((p, i) => (
                <p key={i} className="text-sm md:text-base leading-7 text-slate-200/95">
                  <GlossaryText text={p} />
                </p>
              ))}
              {event.id === 'nameless_martyr_shrine' && event.stage === 'free_remove' && (
                <div className="rounded-xl border border-yellow-600/40 bg-yellow-950/20 p-3 text-sm text-yellow-200">
                  祭坛接受了你的供奉。请选择 <span className="font-bold">{engine.getEventFreeRemovalsRemaining()}</span> 张牌作为献祭。
                </div>
              )}
            </div>
          </div>

          <div className="campaign-section campaign-decision-column min-h-0 overflow-y-auto p-4 md:p-5 shadow-2xl md:pl-5">
            <div className="campaign-kicker mb-3">{getUiLabelZh('Decision')}</div>
            <div className="space-y-3">
              {options.map((option, index) => (
                <button
                  key={option.id}
                  onClick={() => engine.resolveEventChoice(option.id)}
                  className={`campaign-choice w-full text-left p-4 ${dangerClasses(option.danger)}`}
                  data-keyboard-option={String(index + 1)}
                  data-keyboard-focus="true"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-bold text-slate-100"><GlossaryText text={option.text} /></div>
                    <div className="text-[10px] uppercase tracking-widest text-slate-300">{dangerLabel(option.danger)}</div>
                  </div>
                  <div className="text-sm text-slate-300 mt-1"><GlossaryText text={option.description} /></div>

                  {!!option.gains?.length && (
                    <div className="mt-3 rounded-lg border border-emerald-700/30 bg-emerald-950/20 p-2.5">
                      <div className="text-[11px] uppercase tracking-widest text-emerald-300 mb-1">收益</div>
                      <ul className="space-y-1 text-sm text-emerald-100/95">
                        {option.gains.map((g, i) => <li key={i}>+ <GlossaryText text={g} /></li>)}
                      </ul>
                    </div>
                  )}

                  {!!option.costs?.length && (
                    <div className="mt-2 rounded-lg border border-rose-700/30 bg-rose-950/20 p-2.5">
                      <div className="text-[11px] uppercase tracking-widest text-rose-300 mb-1">代价</div>
                      <ul className="space-y-1 text-sm text-rose-100/95">
                        {option.costs.map((c, i) => <li key={i}>- <GlossaryText text={c} /></li>)}
                      </ul>
                    </div>
                  )}

                  {(() => {
                    const longTermEffects = detectLongTermEffects(option.gains || [], option.costs || []);
                    if (longTermEffects.length === 0) return null;
                    return (
                      <div className="mt-3">
                        <EventOptionLongTermEffect
                          effects={longTermEffects}
                          className="w-full"
                        />
                      </div>
                    );
                  })()}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </BackgroundImage>
  );
}

export function EventView({ engine }: { engine: GameEngine }) {
  const event = engine.state.activeEvent;
  if (!event) {
    return (
      <div className="campaign-terminal campaign-shell flex h-full flex-col items-center justify-center px-8 text-slate-200">
        <div className="campaign-kicker">事件记录</div>
        <div className="campaign-title mt-4 text-2xl text-slate-300">无事件记录</div>
        <button onClick={() => engine.leaveCurrentRoomToMap()} className="campaign-action mt-6 px-6 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-stone-100" data-keyboard-option="1" data-keyboard-focus="true">
          返回地图
        </button>
      </div>
    );
  }

  if (getStoryEventDef(event.id)) {
    return <StoryEventPanel engine={engine} />;
  }

  if (event.id === 'heretic_altar') {
    const relic = (relicsData as any[]).find(r => r.id === event.offeredRelicId);
    const relicIconSrc = relic ? `/assets/relics/${relic.id}.png` : '';
    const bgImage = getEventBackground(event.id);
    const npcLine = getEventNpcLine(engine, event.id, event.stage);
    return (
      <BackgroundImage
        src={bgImage}
        className="campaign-shell flex h-full flex-col items-center justify-center px-4 py-8 text-slate-200 md:px-8"
        overlayOpacity={0.7}
      >
        <div className="relative z-10 flex w-full max-w-4xl flex-col items-center">
          <div className="w-full border-b border-white/10 pb-6 text-center">
            <div className="campaign-kicker">禁忌契约</div>
            <h1 className="campaign-title campaign-poster-title mt-4 text-[clamp(2.3rem,4vw,4rem)] text-red-200">异端祭坛</h1>
          </div>
          {npcLine && (
            <div className="campaign-section mt-6 w-full p-3 text-sm italic text-fuchsia-100/85">
              “{npcLine}”
            </div>
          )}

          <div className="campaign-section mt-6 mb-8 w-full p-8 text-lg leading-relaxed shadow-2xl">
            一座锈蚀祭坛在亚空间噪波中低鸣。血与灰构成的圆阵中央躺着一件遗物。
            接受它，记忆印痕库将被腐化烙印永久标记。
          </div>

          {relic && (
            <div className="campaign-section mb-6 w-full p-4">
              <div className="flex items-center gap-4">
                <img src={relicIconSrc} alt={relic.name} className="w-14 h-14 rounded-xl object-cover border border-red-900/40 bg-slate-800 shrink-0" onError={(e) => bindImgFallback(e, ASSET_PLACEHOLDERS.relic)} />
                <div>
                  <div className="text-xl font-bold text-red-300">{relic.name}</div>
                  <div className="text-sm text-slate-300 mt-1">{relic.description}</div>
                  {(relic as any).inscription && (
                    <div className="text-xs text-slate-500 mt-1">铭文：{(relic as any).inscription}</div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="flex w-full flex-col gap-4">
            <button onClick={() => engine.resolveEventChoice('accept_corruption')} className="campaign-choice w-full p-4 text-left" data-keyboard-option="1" data-keyboard-focus="true">
              <span className="font-bold">接受遗物</span>
              <span className="text-red-300 text-sm block mt-1">拥抱腐化</span>
            </button>

            <button onClick={() => engine.resolveEventChoice('refuse')} className="campaign-choice w-full p-4 text-left" data-keyboard-option="2" data-keyboard-focus="true">
              <span className="font-bold">拒绝</span>
              <span className="text-slate-400 text-sm block mt-1">不触碰祭坛，立即离开</span>
            </button>
          </div>
        </div>
      </BackgroundImage>
    );
  }

  const bgImage = getEventBackground(event.id);
  const shrineLine = getEventNpcLine(engine, event.id, event.stage);
  return (
    <BackgroundImage
      src={bgImage}
      className="campaign-shell flex h-full flex-col items-center justify-center px-4 py-8 text-slate-200 md:px-8"
      overlayOpacity={0.68}
    >
      <div className="relative z-10 flex w-full max-w-3xl flex-col items-center">
        <div className="w-full border-b border-white/10 pb-6 text-center">
          <div className="campaign-kicker">Field Omen</div>
          <h1 className="campaign-title campaign-poster-title mt-4 text-[clamp(2.3rem,4vw,4rem)] text-blue-200">无名神龛</h1>
        </div>
        {shrineLine && (
          <div className="campaign-section mt-6 w-full p-3 text-sm italic text-amber-100/85">
            “{shrineLine}”
          </div>
        )}
        <div className="campaign-section mt-6 mb-8 w-full p-8 text-lg leading-relaxed shadow-2xl">
          你发现一座泛着幽蓝微光的古老神龛。某个声音在你的颅骨内侧回响，逼迫你做出选择。
        </div>
        <div className="flex w-full flex-col gap-4">
          <button onClick={() => engine.resolveEventChoice('pray')} className="campaign-choice w-full p-4 text-left" data-keyboard-option="1" data-keyboard-focus="true">
            <span className="font-bold">祈祷</span>
            <span className="text-emerald-400 text-sm block mt-1">生命上限 +10</span>
          </button>
          <button onClick={() => engine.resolveEventChoice('leave')} className="campaign-choice w-full p-4 text-left" data-keyboard-option="2" data-keyboard-focus="true">
            <span className="font-bold">离开</span>
            <span className="text-slate-400 text-sm block mt-1">不发生任何事</span>
          </button>
        </div>
      </div>
    </BackgroundImage>
  );
}
