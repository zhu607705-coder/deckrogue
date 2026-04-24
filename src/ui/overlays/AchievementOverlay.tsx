/**
 * @file AchievementOverlay.tsx
 * @description 成就覆盖层 - 展示成就列表和奖励详情
 *
 * 主要职责:
 * - 渲染成就列表和分类
 * - 显示成就解锁状态和奖励
 * - 支持成就搜索和筛选
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Trophy, X, Search, Lock, CheckCircle2, Gift, Sparkles } from 'lucide-react';
import { getAchievementDefs, type AchievementDef } from '@/features/achievements/achievementSystem';
import { globalEventBus, loadMetaProfile } from '@/core';
import { getUiLabelZh } from '@/ui/content/terminology';

function rewardLines(def: AchievementDef): string[] {
  const rewards = def.rewards || {};
  const lines: string[] = [];
  if (rewards.unlockedPoolIds?.length) lines.push(`解锁掉落池条目：${rewards.unlockedPoolIds.join(', ')}`);
  if (rewards.startingRelics?.length) lines.push(`解锁起始遗物：${rewards.startingRelics.join(', ')}`);
  if (rewards.backgrounds?.length) lines.push(`解锁背景：${rewards.backgrounds.join(', ')}`);
  if (rewards.cardSkins?.length) lines.push(`解锁卡牌皮肤：${rewards.cardSkins.join(', ')}`);
  if (rewards.characters?.length) lines.push(`解锁角色：${rewards.characters.join(', ')}`);
  return lines.length ? lines : ['无额外奖励（里程碑成就）'];
}

function conditionSummary(def: AchievementDef): string[] {
  const c = def.conditions || {};
  const out: string[] = [];
  if (c.requireVictory) out.push('需要通关胜利');
  if (c.characterId) out.push(`限定角色：${c.characterId}`);
  if (typeof c.minReachedFloor === 'number') out.push(`达到楼层：${c.minReachedFloor}+`);
  if (typeof c.minCorruption === 'number') out.push(`腐化值：${c.minCorruption}+`);
  if (typeof c.minDevotion === 'number') out.push(`虔敬值：${c.minDevotion}+`);
  if (typeof c.minRelicCount === 'number') out.push(`遗物数量：${c.minRelicCount}+`);
  if (typeof c.maxDeckSize === 'number') out.push(`牌库大小：≤ ${c.maxDeckSize}`);
  if (typeof c.minEarnedRequisition === 'number') out.push(`本局征用点收益：${c.minEarnedRequisition}+`);
  if (typeof c.minEarnedWarpEchoes === 'number') out.push(`本局回响收益：${c.minEarnedWarpEchoes}+`);
  if (typeof c.maxCurrentHpPctAtEnd === 'number') out.push(`终局血量比例：≤ ${Math.round(c.maxCurrentHpPctAtEnd * 100)}%`);
  if (c.requiresMartyrLegacyCreated) out.push('需生成殉道者传承');
  return out.length ? out : ['完成指定条件即可解锁'];
}

export function AchievementOverlay({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [tick, setTick] = useState(0);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'unlocked' | 'locked'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const unsub = globalEventBus.subscribe('MetaProfileUpdated', () => setTick((t) => t + 1));
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onEsc);
    return () => {
      unsub();
      window.removeEventListener('keydown', onEsc);
    };
  }, [open, onClose]);

  const defs = useMemo(() => getAchievementDefs(), []);
  const profile = useMemo(() => loadMetaProfile(), [tick, open]);
  const unlockedSet = useMemo(() => new Set(profile.achievements?.unlockedIds || []), [profile]);

  const entries = useMemo(() => {
    const q = query.trim().toLowerCase();
    return defs.filter((def) => {
      const unlocked = unlockedSet.has(def.id);
      if (filter === 'unlocked' && !unlocked) return false;
      if (filter === 'locked' && unlocked) return false;
      if (!q) return true;
      return (
        def.title.toLowerCase().includes(q) ||
        def.description.toLowerCase().includes(q) ||
        rewardLines(def).some((line) => line.toLowerCase().includes(q))
      );
    });
  }, [defs, filter, query, unlockedSet]);

  useEffect(() => {
    if (!open) return;
    if (!entries.length) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !entries.some((e) => e.id === selectedId)) {
      setSelectedId(entries[0].id);
    }
  }, [entries, open, selectedId]);

  if (!open) return null;

  const selected = entries.find((e) => e.id === selectedId) || null;
  const unlockedCount = unlockedSet.size;
  const total = defs.length;

  return (
    <div className="fixed inset-0 z-[125]">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-2 sm:inset-4 lg:inset-6 rounded-2xl border border-slate-700/70 bg-slate-950/92 shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-slate-800 bg-gradient-to-r from-slate-950 via-emerald-950/20 to-slate-950">
          <div>
            <div className="flex items-center gap-2 text-slate-100">
              <Trophy size={18} className="text-emerald-300" />
              <h2 className="text-lg sm:text-xl font-serif tracking-wide">成就 / {getUiLabelZh('Achievements')}</h2>
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              已解锁 {unlockedCount}/{total} · 最近新增 {(profile.achievements?.lastUnlockedIds || []).length}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg border border-slate-700 bg-slate-900/80 hover:bg-slate-800 text-slate-200"
            aria-label="Close achievements"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[360px_1fr]">
          <div className="border-b lg:border-b-0 lg:border-r border-slate-800 flex flex-col min-h-0 bg-slate-950/60">
            <div className="p-4 space-y-3 border-b border-slate-800">
              <div className="grid grid-cols-3 gap-2">
                {([
                  ['all', '全部'],
                  ['unlocked', '已解锁'],
                  ['locked', '未解锁'],
                ] as const).map(([id, label]) => (
                  <button
                    key={id}
                    onClick={() => setFilter(id)}
                    className={`rounded-lg border px-2.5 py-2 text-xs ${filter === id ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-200' : 'border-slate-700 bg-slate-900/70 text-slate-300 hover:bg-slate-800'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="搜索成就名称、描述、奖励..."
                  className="w-full rounded-lg border border-slate-700 bg-slate-900/80 pl-9 pr-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {entries.map((def) => {
                const unlocked = unlockedSet.has(def.id);
                const active = selectedId === def.id;
                const ts = profile.achievements?.unlockedAt?.[def.id];
                return (
                  <button
                    key={def.id}
                    onClick={() => setSelectedId(def.id)}
                    className={`w-full text-left rounded-xl border px-3 py-3 transition-colors ${active ? 'border-emerald-500/60 bg-emerald-500/10' : unlocked ? 'border-slate-700 bg-slate-900/70 hover:bg-slate-800' : 'border-slate-800 bg-slate-950/60 hover:bg-slate-900/70'}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className={`text-sm font-semibold truncate ${unlocked ? 'text-slate-100' : 'text-slate-400'}`}>
                          {unlocked || !def.hidden ? def.title : '隐藏成就'}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                          {unlocked || !def.hidden ? def.description : '完成特定条件后揭示'}
                        </div>
                      </div>
                      <div className={`mt-0.5 ${unlocked ? 'text-emerald-300' : 'text-slate-600'}`}>
                        {unlocked ? <CheckCircle2 size={15} /> : <Lock size={15} />}
                      </div>
                    </div>
                    {unlocked && ts && (
                      <div className="text-[10px] text-slate-500 mt-2">
                        解锁时间：{new Date(ts).toLocaleString()}
                      </div>
                    )}
                  </button>
                );
              })}
              {entries.length === 0 && (
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-4 text-sm text-slate-500">
                  没有匹配的成就条目。
                </div>
              )}
            </div>
          </div>

          <div className="min-h-0 overflow-y-auto p-4 sm:p-5">
            {!selected && (
              <div className="h-full rounded-xl border border-dashed border-slate-700/80 bg-slate-950/40 flex items-center justify-center text-slate-500">
                选择一个成就查看详情
              </div>
            )}

            {selected && (() => {
              const unlocked = unlockedSet.has(selected.id);
              const rewardList = rewardLines(selected);
              const condList = conditionSummary(selected);
              return (
                <div className="space-y-4">
                  <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <Trophy size={16} className={unlocked ? 'text-emerald-300' : 'text-slate-600'} />
                          <h3 className={`text-2xl font-serif ${unlocked || !selected.hidden ? 'text-slate-100' : 'text-slate-500'}`}>
                            {unlocked || !selected.hidden ? selected.title : '隐藏成就'}
                          </h3>
                        </div>
                        <div className="mt-2 text-sm text-slate-300 leading-relaxed">
                          {unlocked || !selected.hidden ? selected.description : '完成隐藏条件后解锁完整说明。'}
                        </div>
                      </div>
                      <div className={`px-3 py-1.5 rounded-lg border text-sm ${unlocked ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-200' : 'border-slate-700 bg-slate-900/80 text-slate-400'}`}>
                        {unlocked ? '已解锁' : '未解锁'}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <section className="rounded-xl border border-slate-800 bg-slate-900/35 p-4">
                      <div className="flex items-center gap-2 text-slate-200 font-semibold mb-3">
                        <Sparkles size={14} className="text-amber-300" />
                        解锁条件
                      </div>
                      <div className="space-y-2">
                        {condList.map((line, idx) => (
                          <div key={idx} className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-sm text-slate-200">
                            <span className="text-slate-500 mr-2">#{idx + 1}</span>{line}
                          </div>
                        ))}
                      </div>
                    </section>

                    <section className="rounded-xl border border-slate-800 bg-slate-900/35 p-4">
                      <div className="flex items-center gap-2 text-slate-200 font-semibold mb-3">
                        <Gift size={14} className="text-fuchsia-300" />
                        奖励内容
                      </div>
                      <div className="space-y-2">
                        {rewardList.map((line, idx) => (
                          <div key={idx} className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-sm text-slate-200">
                            {unlocked ? line : '解锁后可永久加入场外档案并影响后续新局。'}
                          </div>
                        ))}
                      </div>
                    </section>
                  </div>

                  {unlocked && (
                    <section className="rounded-xl border border-emerald-800/70 bg-emerald-950/10 p-4">
                      <div className="text-emerald-200 font-semibold mb-2">状态与应用</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                        <div className="rounded-lg border border-emerald-700/30 bg-slate-950/40 px-3 py-2 text-slate-200">
                          已记入场外档案（MetaProfile）
                        </div>
                        <div className="rounded-lg border border-emerald-700/30 bg-slate-950/40 px-3 py-2 text-slate-200">
                          奖励将在后续新局中可选/可注入
                        </div>
                      </div>
                    </section>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}
