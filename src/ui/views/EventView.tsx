import React from 'react';
import { GameEngine } from '@/core';
import { getStoryEventDef, getStoryEventOptionPresentation, relicsData } from '@/content/narrative/numericSystem';
import worldLoreData from '@/content/data/worldLore.json';
import { ASSET_PLACEHOLDERS, bindImgFallback } from '@/ui/components/assetHelpers';
import { BackgroundImage, VIEW_BACKGROUNDS } from '@/ui/components/BackgroundImage';

const WORLD_LORE = worldLoreData as any;

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
      className="flex flex-col h-full text-slate-100 p-4 md:p-8"
      overlayOpacity={0.75}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(180,180,255,0.10),transparent_55%)]" />

      <div className="relative z-10 flex flex-col h-full max-w-5xl mx-auto w-full">
        <div className="mb-4 md:mb-6 flex items-center justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.25em] text-slate-400">{getFloorLabel(engine)} · 叙事事件</div>
            <h1 className="text-2xl md:text-4xl font-serif text-red-300 mt-2 drop-shadow-lg">{def.title}</h1>
          </div>
          <div className="px-3 py-1 rounded-full border border-slate-500/40 bg-slate-900/60 text-xs text-slate-200">
            {event.stage === 'salvage_aftermath' ? '余波' : '遭遇'}
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_1fr] gap-4 md:gap-6 flex-1 min-h-0">
          <div className="min-h-0 rounded-2xl border border-slate-700/70 bg-slate-950/65 backdrop-blur-sm p-4 md:p-6 overflow-y-auto shadow-2xl">
            <div className="space-y-4">
              {npcLine && (
                <div className="rounded-xl border border-fuchsia-700/25 bg-fuchsia-950/10 p-3 text-sm italic text-fuchsia-100/85">
                  “{npcLine}”
                </div>
              )}
              {def.loreText.map((p, i) => (
                <p key={i} className="text-sm md:text-base leading-7 text-slate-200/95">
                  {p}
                </p>
              ))}
              {event.id === 'nameless_martyr_shrine' && event.stage === 'free_remove' && (
                <div className="rounded-xl border border-yellow-600/40 bg-yellow-950/20 p-3 text-sm text-yellow-200">
                  祭坛接受了你的供奉。请选择 <span className="font-bold">{engine.getEventFreeRemovalsRemaining()}</span> 张牌作为献祭。
                </div>
              )}
            </div>
          </div>

          <div className="min-h-0 rounded-2xl border border-slate-700/70 bg-slate-950/60 backdrop-blur-sm p-4 md:p-5 overflow-y-auto shadow-2xl">
            <div className="text-sm uppercase tracking-widest text-slate-400 mb-3">抉择</div>
            <div className="space-y-3">
              {options.map(option => (
                <button
                  key={option.id}
                  onClick={() => engine.resolveEventChoice(option.id)}
                  className={`w-full text-left rounded-xl border p-4 transition-colors ${dangerClasses(option.danger)}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-bold text-slate-100">{option.text}</div>
                    <div className="text-[10px] uppercase tracking-widest text-slate-300">{dangerLabel(option.danger)}</div>
                  </div>
                  <div className="text-sm text-slate-300 mt-1">{option.description}</div>

                  {!!option.gains?.length && (
                    <div className="mt-3 rounded-lg border border-emerald-700/30 bg-emerald-950/20 p-2.5">
                      <div className="text-[11px] uppercase tracking-widest text-emerald-300 mb-1">收益</div>
                      <ul className="space-y-1 text-sm text-emerald-100/95">
                        {option.gains.map((g, i) => <li key={i}>+ {g}</li>)}
                      </ul>
                    </div>
                  )}

                  {!!option.costs?.length && (
                    <div className="mt-2 rounded-lg border border-rose-700/30 bg-rose-950/20 p-2.5">
                      <div className="text-[11px] uppercase tracking-widest text-rose-300 mb-1">代价</div>
                      <ul className="space-y-1 text-sm text-rose-100/95">
                        {option.costs.map((c, i) => <li key={i}>- {c}</li>)}
                      </ul>
                    </div>
                  )}
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
      <div className="flex flex-col h-full bg-slate-950 text-slate-200 p-8 items-center justify-center max-w-2xl mx-auto">
        <div className="text-2xl text-slate-300 mb-4">无事件记录</div>
        <button onClick={() => engine.leaveCurrentRoomToMap()} className="px-6 py-3 bg-slate-800 rounded-xl border border-slate-600">
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
        className="flex flex-col h-full text-slate-200 p-8 items-center justify-center max-w-3xl mx-auto"
        overlayOpacity={0.65}
      >
        <div className="relative z-10 flex flex-col items-center w-full">
          <h1 className="text-4xl font-serif text-red-400 mb-6 drop-shadow-lg">异端祭坛</h1>
          {npcLine && (
            <div className="w-full rounded-xl border border-fuchsia-700/25 bg-fuchsia-950/10 p-3 mb-4 text-sm italic text-fuchsia-100/85">
              “{npcLine}”
            </div>
          )}

          <div className="bg-slate-900/90 border border-red-900/60 rounded-xl p-8 mb-8 text-lg leading-relaxed shadow-2xl backdrop-blur-sm">
            一座锈蚀祭坛在亚空间噪波中低鸣。血与灰构成的圆阵中央躺着一件遗物。
            接受它，记忆印痕库将被腐化烙印永久标记。
          </div>

          {relic && (
            <div className="w-full bg-slate-900/90 border border-slate-700 rounded-xl p-4 mb-6 backdrop-blur-sm">
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

          <div className="flex flex-col gap-4 w-full">
            <button onClick={() => engine.resolveEventChoice('accept_corruption')} className="w-full p-4 bg-red-950/80 hover:bg-red-900/80 rounded-xl border border-red-700 flex justify-between items-center transition-colors backdrop-blur-sm">
              <span className="font-bold">接受遗物</span>
              <span className="text-red-300 text-sm">拥抱腐化</span>
            </button>

            <button onClick={() => engine.resolveEventChoice('refuse')} className="w-full p-4 bg-slate-800/80 hover:bg-slate-700/80 rounded-xl border border-slate-600 flex justify-between items-center transition-colors backdrop-blur-sm">
              <span className="font-bold">拒绝</span>
              <span className="text-slate-400 text-sm">不触碰祭坛，立即离开</span>
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
      className="flex flex-col h-full text-slate-200 p-8 items-center justify-center max-w-2xl mx-auto"
      overlayOpacity={0.65}
    >
      <div className="relative z-10 flex flex-col items-center w-full">
        <h1 className="text-4xl font-serif text-blue-400 mb-6 drop-shadow-lg">无名神龛</h1>
        {shrineLine && (
          <div className="w-full rounded-xl border border-amber-700/25 bg-amber-950/10 p-3 mb-4 text-sm italic text-amber-100/85">
            “{shrineLine}”
          </div>
        )}
        <div className="bg-slate-900/90 border border-slate-700 rounded-xl p-8 mb-8 text-lg leading-relaxed shadow-2xl backdrop-blur-sm">
          你发现一座泛着幽蓝微光的古老神龛。某个声音在你的颅骨内侧回响，逼迫你做出选择。
        </div>
        <div className="flex flex-col gap-4 w-full">
          <button onClick={() => engine.resolveEventChoice('pray')} className="w-full p-4 bg-slate-800/80 hover:bg-slate-700/80 rounded-xl border border-slate-600 flex justify-between items-center transition-colors backdrop-blur-sm">
            <span className="font-bold">祈祷</span>
            <span className="text-emerald-400 text-sm">肉体承载力上限 +10</span>
          </button>
          <button onClick={() => engine.resolveEventChoice('leave')} className="w-full p-4 bg-slate-800/80 hover:bg-slate-700/80 rounded-xl border border-slate-600 flex justify-between items-center transition-colors backdrop-blur-sm">
            <span className="font-bold">离开</span>
            <span className="text-slate-400 text-sm">不发生任何事</span>
          </button>
        </div>
      </div>
    </BackgroundImage>
  );
}
