/**
 * @file CodexOverlay.tsx
 * @description 图鉴覆盖层 - 展示游戏图鉴和百科条目
 *
 * 主要职责:
 * - 渲染图鉴分类和条目
 * - 支持搜索和筛选
 * - 提供导入/导出图鉴数据功能
 */

import React, { useEffect, useMemo, useState } from 'react';
import { X, BookOpen, Search, Star, Filter, Download, Upload, Eye, EyeOff, Shield, FlaskConical, ScrollText, Swords, PlayCircle } from 'lucide-react';
import { ASSET_PLACEHOLDERS, bindImgFallback } from '@/ui/components/assetHelpers';
import {
  CodexCategory,
  exportCodexProfileJson,
  getCodexEntryKey,
  getCodexUnlockedCount,
  getCodexUpdateEventName,
  importCodexProfileJson,
  isCodexEntryUnlocked,
  loadCodexProfile,
  toggleCodexFavorite
} from '@/core';
import { CodexCatalogEntry, CodexDemoPanelDef, getCodexCatalog, getCodexCatalogCounts } from '@/ui/overlays/codexCatalog';
import { getAchievementsLinkedToEntity } from '@/features/achievements/achievementSystem';
import { GlossaryText } from '@/ui/components/GlossaryText';
import { getUiLabelZh } from '@/ui/content/terminology';

const CATEGORY_ORDER: Array<{ id: CodexCategory; label: string; icon: React.ReactNode; color: string }> = [
  { id: 'relics', label: '遗物', icon: <Shield size={14} />, color: 'text-violet-300' },
  { id: 'potions', label: '药水', icon: <FlaskConical size={14} />, color: 'text-emerald-300' },
  { id: 'cards', label: '卡牌', icon: <BookOpen size={14} />, color: 'text-amber-300' },
  { id: 'enemies', label: '异端', icon: <Swords size={14} />, color: 'text-rose-300' },
  { id: 'elites', label: '精英怪', icon: <Swords size={14} />, color: 'text-orange-300' },
  { id: 'events', label: '事件', icon: <ScrollText size={14} />, color: 'text-cyan-300' }
];

const categoryLabel = (id: CodexCategory) => CATEGORY_ORDER.find((c) => c.id === id)?.label || id;

function entryFallback(category: CodexCategory): string {
  if (category === 'relics') return ASSET_PLACEHOLDERS.relic;
  if (category === 'potions') return ASSET_PLACEHOLDERS.potion;
  if (category === 'events') return ASSET_PLACEHOLDERS.mapRoom;
  if (category === 'cards') return ASSET_PLACEHOLDERS.card;
  return ASSET_PLACEHOLDERS.enemy;
}

function demoToneClasses(tone?: string): string {
  switch (tone) {
    case 'offense':
      return 'border-rose-500/35 bg-rose-500/8';
    case 'defense':
      return 'border-blue-500/35 bg-blue-500/8';
    case 'status':
      return 'border-violet-500/35 bg-violet-500/8';
    case 'warp':
      return 'border-fuchsia-500/35 bg-fuchsia-500/8';
    default:
      return 'border-slate-700 bg-slate-950/45';
  }
}

function loreToneClasses(tone?: string): string {
  switch (tone) {
    case 'warp':
      return 'border-fuchsia-700/40 bg-fuchsia-950/15 text-fuchsia-100';
    case 'faith':
      return 'border-amber-700/40 bg-amber-950/15 text-amber-100';
    case 'grim':
      return 'border-rose-800/35 bg-rose-950/10 text-rose-100';
    default:
      return 'border-slate-800 bg-slate-950/40 text-slate-200';
  }
}

function CodexDemoPanel({ demo }: { demo: CodexDemoPanelDef }) {
  const [frameIndex, setFrameIndex] = useState(0);
  const frames = demo.frames || [];
  const active = frames[Math.max(0, Math.min(frameIndex, frames.length - 1))];

  useEffect(() => {
    setFrameIndex(0);
  }, [demo.title, demo.kind, frames.length]);

  useEffect(() => {
    if (frames.length <= 1) return;
    const timer = window.setInterval(() => {
      setFrameIndex((i) => (i + 1) % frames.length);
    }, Math.max(1200, demo.loopMs || 2200));
    return () => window.clearInterval(timer);
  }, [demo.loopMs, frames.length]);

  if (!active) return null;

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/35 p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <div className="flex items-center gap-2 text-slate-200 font-semibold">
            <PlayCircle size={14} className="text-cyan-300" />
            {demo.title}
          </div>
          {demo.subtitle && <div className="text-xs text-slate-400 mt-0.5">{demo.subtitle}</div>}
        </div>
        <div className="text-xs text-slate-500">{frameIndex + 1}/{frames.length}</div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-950/55 p-3 overflow-hidden relative">
        <div className="absolute inset-0 pointer-events-none opacity-40"
          style={{
            background:
              'radial-gradient(circle at 18% 22%, rgba(56,189,248,0.18), transparent 45%), radial-gradient(circle at 82% 78%, rgba(168,85,247,0.16), transparent 48%)'
          }}
        />
        <div className="relative z-10 space-y-3">
          <div className="flex items-center gap-2">
            {frames.map((frame, i) => (
              <button
                key={`${frame.label}-${i}`}
                onClick={() => setFrameIndex(i)}
                className={`h-2 rounded-full transition-all ${i === frameIndex ? 'w-8 bg-cyan-300' : 'w-2 bg-slate-600 hover:bg-slate-500'}`}
                aria-label={`Jump to demo frame ${i + 1}`}
              />
            ))}
          </div>

          <div className={`rounded-lg border p-3 transition-colors ${demoToneClasses(active.tone)}`}>
            <div className="flex items-center justify-between gap-2">
              <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">{active.label}</div>
              <div className="text-[11px] text-cyan-300">{demo.kind === 'card' ? '回合流程' : '意图流程'}</div>
            </div>
            <div className="mt-1 text-sm font-semibold text-slate-100">{active.headline}</div>
            <div className="mt-2 text-sm leading-relaxed text-slate-300">{active.detail}</div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function CodexOverlay({
  open,
  onClose
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [tick, setTick] = useState(0);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'all' | CodexCategory>('all');
  const [unlockFilter, setUnlockFilter] = useState<'all' | 'unlocked' | 'locked'>('all');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [showImportTools, setShowImportTools] = useState(false);
  const [importText, setImportText] = useState('');
  const [syncMessage, setSyncMessage] = useState<string>('');

  useEffect(() => {
    if (!open) return;
    const handler = () => setTick((t) => t + 1);
    window.addEventListener(getCodexUpdateEventName(), handler);
    return () => window.removeEventListener(getCodexUpdateEventName(), handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [open, onClose]);

  const catalog = useMemo(() => getCodexCatalog(), []);
  const counts = useMemo(() => getCodexCatalogCounts(), []);
  const profile = useMemo(() => loadCodexProfile(), [tick, open]);
  const favoriteSet = useMemo(() => new Set(profile.favorites || []), [profile]);

  const filteredEntries = useMemo(() => {
    const q = query.trim().toLowerCase();
    return catalog.filter((entry) => {
      if (category !== 'all' && entry.category !== category) return false;
      const unlocked = isCodexEntryUnlocked(profile, entry.category, entry.id);
      if (unlockFilter === 'unlocked' && !unlocked) return false;
      if (unlockFilter === 'locked' && unlocked) return false;
      if (favoritesOnly && !favoriteSet.has(getCodexEntryKey(entry.category, entry.id))) return false;
      if (q && !entry.searchText.includes(q) && !entry.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [catalog, category, favoriteSet, favoritesOnly, profile, query, unlockFilter]);

  useEffect(() => {
    if (!open) return;
    if (filteredEntries.length === 0) {
      setSelectedKey(null);
      return;
    }
    if (!selectedKey || !filteredEntries.some((e) => getCodexEntryKey(e.category, e.id) === selectedKey)) {
      setSelectedKey(getCodexEntryKey(filteredEntries[0].category, filteredEntries[0].id));
    }
  }, [filteredEntries, open, selectedKey]);

  const selectedEntry = filteredEntries.find((e) => getCodexEntryKey(e.category, e.id) === selectedKey) || null;
  const selectedUnlocked = selectedEntry ? isCodexEntryUnlocked(profile, selectedEntry.category, selectedEntry.id) : false;
  const relatedAchievements = useMemo(() => {
    if (!selectedEntry) return [];
    if (selectedEntry.category === 'cards') return getAchievementsLinkedToEntity('cards', selectedEntry.id);
    if (selectedEntry.category === 'relics') return getAchievementsLinkedToEntity('relics', selectedEntry.id);
    return [];
  }, [selectedEntry]);

  if (!open) return null;

  const handleToggleFavorite = (entry: CodexCatalogEntry) => {
    toggleCodexFavorite(entry.category, entry.id);
    setTick((t) => t + 1);
  };

  const handleExport = async () => {
    const json = exportCodexProfileJson();
    try {
      await navigator.clipboard.writeText(json);
      setSyncMessage('图鉴数据已复制到剪贴板，可在其他设备导入。');
    } catch {
      setImportText(json);
      setShowImportTools(true);
      setSyncMessage('剪贴板复制失败，已将导出 JSON 填入文本框。');
    }
    setTick((t) => t + 1);
  };

  const handleImport = () => {
    const result = importCodexProfileJson(importText);
    setSyncMessage(result.message);
    if (result.ok) setTick((t) => t + 1);
  };

  const totalUnlocked = getCodexUnlockedCount(profile);
  const totalEntries = catalog.length;

  return (
    <div className="fixed inset-0 z-[120]">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-2 sm:inset-4 lg:inset-6 rounded-2xl border border-slate-700/70 bg-slate-950/92 shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-slate-800 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-slate-100">
              <BookOpen size={18} className="text-amber-300" />
              <h2 className="text-lg sm:text-xl font-serif tracking-wide">图鉴 / {getUiLabelZh('Codex')}</h2>
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              遇见即解锁 · {totalUnlocked}/{totalEntries} 已解锁
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg border border-slate-700 bg-slate-900/80 hover:bg-slate-800 text-slate-200"
            aria-label="Close codex"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[360px_1fr]">
          <div className="border-b lg:border-b-0 lg:border-r border-slate-800 flex flex-col min-h-0 bg-slate-950/60">
            <div className="p-4 space-y-3 border-b border-slate-800">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {CATEGORY_ORDER.map((c) => {
                  const unlocked = getCodexUnlockedCount(profile, c.id);
                  const total = counts[c.id];
                  const active = category === c.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() => setCategory(active ? 'all' : c.id)}
                      className={[
                        'rounded-xl border px-2.5 py-2 text-left transition-colors',
                        active ? 'border-amber-500/60 bg-amber-500/10' : 'border-slate-700 bg-slate-900/70 hover:bg-slate-800'
                      ].join(' ')}
                    >
                      <div className={`flex items-center gap-1.5 text-xs ${c.color}`}>
                        {c.icon}
                        <span>{c.label}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">{unlocked}/{total}</div>
                    </button>
                  );
                })}
              </div>

              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="搜索名称、机制、关键词..."
                  className="w-full rounded-lg border border-slate-700 bg-slate-900/80 pl-9 pr-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-slate-400 flex flex-col gap-1">
                  <span className="flex items-center gap-1"><Filter size={12} /> 解锁状态</span>
                  <select
                    value={unlockFilter}
                    onChange={(e) => setUnlockFilter(e.target.value as any)}
                    className="rounded-lg border border-slate-700 bg-slate-900/80 px-2 py-2 text-slate-100"
                  >
                    <option value="all">全部</option>
                    <option value="unlocked">仅已解锁</option>
                    <option value="locked">仅未解锁</option>
                  </select>
                </label>
                <label className="text-xs text-slate-400 flex items-end">
                  <button
                    onClick={() => setFavoritesOnly(v => !v)}
                    className={`w-full rounded-lg border px-2 py-2 text-xs flex items-center justify-center gap-1.5 ${
                      favoritesOnly ? 'border-yellow-500/60 bg-yellow-500/10 text-yellow-200' : 'border-slate-700 bg-slate-900/80 text-slate-300'
                    }`}
                  >
                    <Star size={12} className={favoritesOnly ? 'fill-current' : ''} />
                    仅收藏
                  </button>
                </label>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleExport}
                  className="rounded-lg border border-slate-700 bg-slate-900/80 hover:bg-slate-800 px-3 py-1.5 text-xs text-slate-200 flex items-center gap-1"
                >
                  <Download size={12} /> 导出图鉴数据
                </button>
                <button
                  onClick={() => setShowImportTools(v => !v)}
                  className="rounded-lg border border-slate-700 bg-slate-900/80 hover:bg-slate-800 px-3 py-1.5 text-xs text-slate-200 flex items-center gap-1"
                >
                  <Upload size={12} /> 导入/同步
                </button>
              </div>
              {syncMessage && <div className="text-xs text-emerald-300/90">{syncMessage}</div>}
              {showImportTools && (
                <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2 space-y-2">
                  <div className="text-[11px] text-slate-400">将其他设备导出的图鉴 JSON 粘贴到此处并导入（合并解锁与收藏）。</div>
                  <textarea
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    rows={4}
                    className="w-full rounded-md border border-slate-700 bg-slate-950/80 p-2 text-xs text-slate-200 placeholder:text-slate-500"
                    placeholder='{"version":1,"unlocked":...}'
                  />
                  <button
                    onClick={handleImport}
                    className="rounded-lg border border-emerald-700/60 bg-emerald-600/20 hover:bg-emerald-600/30 px-3 py-1.5 text-xs text-emerald-100"
                  >
                    导入并合并
                  </button>
                </div>
              )}
            </div>

            <div className="flex-1 min-h-0 overflow-auto p-3 space-y-2">
              {filteredEntries.length === 0 && (
                <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-400">
                  没有匹配内容，尝试清空搜索或放宽筛选条件。
                </div>
              )}
              {filteredEntries.map((entry) => {
                const key = getCodexEntryKey(entry.category, entry.id);
                const unlocked = isCodexEntryUnlocked(profile, entry.category, entry.id);
                const isSelected = selectedKey === key;
                const isFavorite = favoriteSet.has(key);
                return (
                  <button
                    key={key}
                    onClick={() => setSelectedKey(key)}
                    className={[
                      'w-full text-left rounded-xl border p-2.5 transition-colors',
                      isSelected ? 'border-blue-500/60 bg-blue-500/10' : 'border-slate-800 bg-slate-900/50 hover:bg-slate-900/80'
                    ].join(' ')}
                  >
                    <div className="flex gap-3">
                      <div className="w-14 h-14 rounded-lg border border-slate-700 bg-slate-950 overflow-hidden flex items-center justify-center shrink-0">
                        {unlocked ? (
                          <img
                            src={entry.imageSrc}
                            alt={entry.name}
                            className="w-full h-full object-cover"
                            onError={(e) => bindImgFallback(e, entryFallback(entry.category))}
                          />
                        ) : (
                          <div className="text-slate-500 text-xl">?</div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className={`text-sm font-semibold leading-snug break-words ${unlocked ? 'text-slate-100' : 'text-slate-500'}`}>
                              {unlocked ? entry.name : '未解锁条目'}
                            </div>
                            <div className="text-[11px] text-slate-400 leading-snug break-words">
                              {categoryLabel(entry.category)} · {unlocked ? (entry.subtitle || entry.rarity || '') : '遇见后显示'}
                            </div>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleToggleFavorite(entry); }}
                            className={`p-1 rounded ${isFavorite ? 'text-yellow-300' : 'text-slate-500 hover:text-slate-300'}`}
                            title={isFavorite ? '取消收藏' : '收藏'}
                          >
                            <Star size={14} className={isFavorite ? 'fill-current' : ''} />
                          </button>
                        </div>
                        <div className="mt-1 text-xs text-slate-400 line-clamp-2">
                          {unlocked ? <GlossaryText text={entry.summary} /> : '完成一次遭遇、拾取、使用或进入相关事件后将自动解锁。'}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="min-h-0 overflow-auto p-4 sm:p-5">
            {!selectedEntry && (
              <div className="h-full rounded-xl border border-slate-800 bg-slate-900/40 flex items-center justify-center text-slate-500">
                选择一个图鉴条目查看详情
              </div>
            )}

            {selectedEntry && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-800 bg-slate-900/45 p-4">
                  <div className="flex flex-col xl:flex-row gap-4">
                    <div className="w-full xl:w-64 shrink-0">
                      <div className="aspect-[4/3] rounded-xl border border-slate-700 bg-slate-950 overflow-hidden relative">
                        {selectedUnlocked ? (
                          <img
                            src={selectedEntry.imageSrc}
                            alt={selectedEntry.name}
                            className="w-full h-full object-cover"
                            onError={(e) => bindImgFallback(e, entryFallback(selectedEntry.category))}
                          />
                        ) : (
                          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500">
                            <EyeOff size={28} />
                            <div className="text-sm mt-2">未解锁</div>
                          </div>
                        )}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {selectedEntry.badges.slice(0, 8).map((badge) => (
                          <span key={badge} className="px-2 py-0.5 rounded-full border border-slate-700 bg-slate-900/80 text-[10px] text-slate-300">
                            {badge}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-xs uppercase tracking-[0.16em] text-slate-500 mb-1">{categoryLabel(selectedEntry.category)}</div>
                          <h3 className={`text-2xl font-serif ${selectedUnlocked ? 'text-slate-100' : 'text-slate-500'}`}>
                            {selectedUnlocked ? selectedEntry.name : '未解锁条目'}
                          </h3>
                          <div className="text-sm text-slate-400 mt-1">
                            {selectedUnlocked ? (selectedEntry.subtitle || selectedEntry.rarity || '') : '完成首次遭遇后可查看完整资料'}
                          </div>
                        </div>
                        <button
                          onClick={() => handleToggleFavorite(selectedEntry)}
                          className={`px-3 py-1.5 rounded-lg border text-sm flex items-center gap-1.5 ${
                            favoriteSet.has(getCodexEntryKey(selectedEntry.category, selectedEntry.id))
                              ? 'border-yellow-500/60 bg-yellow-500/10 text-yellow-200'
                              : 'border-slate-700 bg-slate-900/70 text-slate-300 hover:bg-slate-800'
                          }`}
                        >
                          <Star size={14} className={favoriteSet.has(getCodexEntryKey(selectedEntry.category, selectedEntry.id)) ? 'fill-current' : ''} />
                          收藏
                        </button>
                      </div>

                      <div className="mt-3 text-sm text-slate-200 leading-relaxed">
                        {selectedUnlocked ? <GlossaryText text={selectedEntry.summary} /> : '该条目尚未解锁。进入相关战斗、事件、商店或获得对应物品后，图鉴会自动记录。'}
                      </div>

                      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {selectedEntry.dataPoints.map((dp) => (
                          <div key={dp.label} className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2">
                            <div className="text-[10px] uppercase tracking-wide text-slate-500">{dp.label}</div>
                            <div className="text-xs sm:text-sm text-slate-200 mt-0.5 break-words">{selectedUnlocked ? <GlossaryText text={dp.value} /> : '???'}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                  <section className="xl:col-span-2 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
                    <div className="flex items-center gap-2 text-slate-200 font-semibold mb-3">
                      <Eye size={14} className="text-blue-300" />
                      特殊机制讲解（说明书模式）
                    </div>
                    <div className="space-y-2 text-sm">
                      {(selectedUnlocked ? selectedEntry.mechanics : ['未解锁前仅显示概要。解锁后会展示完整机制拆解与示例。']).map((line, idx) => (
                        <div key={idx} className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-slate-200">
                          <span className="text-slate-500 mr-2">#{idx + 1}</span><GlossaryText text={line} />
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
                    <div className="text-slate-200 font-semibold mb-3">交互关系与策略提示</div>
                    <div className="space-y-2">
                      {(selectedUnlocked ? selectedEntry.interactions : ['遇见后解锁具体联动说明。']).map((line, idx) => (
                        <div key={idx} className="text-xs text-slate-300 rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2">
                          <GlossaryText text={line} />
                        </div>
                      ))}
                    </div>
                    <div className="text-slate-200 font-semibold mt-4 mb-2">示例 / 图示化说明</div>
                    <div className="space-y-2">
                      {(selectedUnlocked ? selectedEntry.examples : ['示例会在解锁后显示。']).map((line, idx) => (
                        <div key={idx} className="text-xs text-slate-300 rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2">
                          <GlossaryText text={line} />
                        </div>
                      ))}
                    </div>
                  </section>
                </div>

                {selectedUnlocked && selectedEntry.loreFragments && selectedEntry.loreFragments.length > 0 && (
                  <section className="rounded-xl border border-slate-800 bg-slate-900/35 p-4">
                    <div className="text-slate-200 font-semibold mb-2">世界观碎片 / 铭文与遗言</div>
                    <div className="space-y-2">
                      {selectedEntry.loreFragments.map((fragment, idx) => (
                        <div key={`${fragment.label}-${idx}`} className={`rounded-lg border px-3 py-3 ${loreToneClasses(fragment.tone)}`}>
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-[11px] uppercase tracking-[0.16em] opacity-80">{fragment.label}</div>
                            {fragment.source && (
                              <div className="text-[10px] px-2 py-0.5 rounded-full border border-current/20 bg-black/15 opacity-85">
                                来源：{fragment.source}
                              </div>
                            )}
                          </div>
                          <div className="mt-1 text-sm leading-relaxed"><GlossaryText text={fragment.text} /></div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {selectedUnlocked && selectedEntry.demo && (selectedEntry.category === 'cards' || selectedEntry.category === 'enemies' || selectedEntry.category === 'elites') && (
                  <CodexDemoPanel demo={selectedEntry.demo} />
                )}

                {selectedUnlocked && selectedEntry.notes && selectedEntry.notes.length > 0 && (
                  <section className="rounded-xl border border-slate-800 bg-slate-900/35 p-4">
                    <div className="text-slate-200 font-semibold mb-2">补充资料 / 选项分支</div>
                    <ul className="space-y-2">
                      {selectedEntry.notes.map((note, idx) => (
                        <li key={idx} className="text-sm text-slate-300 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2">
                          <GlossaryText text={note} />
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {selectedUnlocked && relatedAchievements.length > 0 && (
                  <section className="rounded-xl border border-emerald-800/70 bg-emerald-950/10 p-4">
                    <div className="text-emerald-200 font-semibold mb-2">相关成就 / 解锁来源</div>
                    <div className="space-y-2">
                      {relatedAchievements.map((a) => (
                        <div key={a.id} className="rounded-lg border border-emerald-700/30 bg-slate-950/40 px-3 py-2">
                          <div className="text-sm text-emerald-100">{a.title}</div>
                          <div className="text-xs text-slate-300 mt-0.5">{a.description}</div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
