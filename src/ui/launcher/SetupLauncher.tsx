import React from 'react';
import type { MetaProfile, SaveSlot } from '@/core';

interface SetupLauncherProps {
  canContinue: boolean;
  saveSlots: SaveSlot[];
  metaProfile: MetaProfile;
  onNewRun: () => void;
  onContinue: () => void;
  onLoadSlot: (slotId: string) => void;
  onDeleteSlot: (slotId: string) => void;
  error?: string | null;
}

function formatPlayTime(seconds: number): string {
  const totalMinutes = Math.max(0, Math.floor(seconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatTime(timestamp: number): string {
  try {
    return new Date(timestamp).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return '未知时间';
  }
}

export function SetupLauncher({
  canContinue,
  saveSlots,
  metaProfile,
  onNewRun,
  onContinue,
  onLoadSlot,
  onDeleteSlot,
  error
}: SetupLauncherProps) {
  const latestRun = metaProfile.runHistory?.[0] || null;

  return (
    <div className="min-h-screen w-full bg-black text-white relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#1e293b_0%,#020617_45%,#000000_100%)] opacity-95" />
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(148,163,184,0.06),transparent_35%,rgba(168,85,247,0.08)_100%)]" />

      <div className="relative z-10 min-h-screen px-6 py-10 md:px-10 lg:px-14">
        <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-7xl flex-col justify-center gap-8">
          <div className="max-w-3xl">
            <div className="mb-3 text-xs uppercase tracking-[0.35em] text-slate-400">DeckRogue Launcher</div>
            <h1 className="text-4xl font-black tracking-tight text-slate-50 md:text-6xl">
              战区启动器
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 md:text-base">
              使用正式启动器进入游戏、继续上一次作战、管理存档和查看局外进度。
              入口不再依赖直接打开单个 HTML 页面。
            </p>
            {error ? (
              <div className="mt-4 rounded-xl border border-red-900/60 bg-red-950/30 px-4 py-3 text-sm text-red-100">
                {error}
              </div>
            ) : null}
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <section className="rounded-3xl border border-slate-800/80 bg-slate-950/70 p-5 shadow-2xl backdrop-blur-md md:p-6">
              <div className="mb-4 text-xs uppercase tracking-[0.22em] text-slate-500">启动操作</div>
              <div className="grid gap-3 md:grid-cols-2">
                <button
                  onClick={onNewRun}
                  className="rounded-2xl border border-emerald-700/60 bg-emerald-950/40 px-5 py-4 text-left transition hover:border-emerald-500 hover:bg-emerald-900/40"
                >
                  <div className="text-sm uppercase tracking-[0.2em] text-emerald-300">New Run</div>
                  <div className="mt-2 text-2xl font-bold text-white">开始新战区</div>
                  <div className="mt-2 text-sm text-emerald-100/80">初始化新种子并进入角色选择。</div>
                </button>

                <button
                  onClick={onContinue}
                  disabled={!canContinue}
                  className="rounded-2xl border border-violet-700/60 bg-violet-950/40 px-5 py-4 text-left transition enabled:hover:border-violet-500 enabled:hover:bg-violet-900/40 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <div className="text-sm uppercase tracking-[0.2em] text-violet-300">Continue</div>
                  <div className="mt-2 text-2xl font-bold text-white">继续作战</div>
                  <div className="mt-2 text-sm text-violet-100/80">优先读取快速存档，没有则读取最近存档。</div>
                </button>
              </div>

              <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                <div className="mb-3 text-xs uppercase tracking-[0.18em] text-slate-500">局外概览</div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">征用点</div>
                    <div className="mt-2 text-xl font-bold text-amber-300">{metaProfile.currencies.requisition}</div>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">亚空间回响</div>
                    <div className="mt-2 text-xl font-bold text-violet-300">{metaProfile.currencies.warpEchoes}</div>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">解锁角色</div>
                    <div className="mt-2 text-xl font-bold text-cyan-200">{metaProfile.unlocks.characters.length}</div>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">局数档案</div>
                    <div className="mt-2 text-xl font-bold text-slate-100">{metaProfile.runHistory.length}</div>
                  </div>
                </div>

                {latestRun ? (
                  <div className="mt-4 rounded-xl border border-slate-800 bg-black/30 p-4">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">最近作战记录</div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-300">
                      <span>层数：{latestRun.reachedFloor}</span>
                      <span>结果：{latestRun.isVictory ? '胜利' : '失败'}</span>
                      <span>结局：{latestRun.causeOfDeath}</span>
                      <span>档案号：{latestRun.runId}</span>
                    </div>
                  </div>
                ) : null}
              </div>
            </section>

            <section className="rounded-3xl border border-slate-800/80 bg-slate-950/70 p-5 shadow-2xl backdrop-blur-md md:p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.22em] text-slate-500">存档面板</div>
                  <div className="mt-1 text-lg font-semibold text-slate-100">本地作战档案</div>
                </div>
                <div className="text-xs text-slate-500">{saveSlots.length} 个槽位</div>
              </div>

              {saveSlots.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-800 bg-black/20 px-4 py-8 text-center text-sm text-slate-500">
                  当前没有可用存档。
                </div>
              ) : (
                <div className="space-y-3">
                  {saveSlots
                    .slice()
                    .sort((a, b) => b.timestamp - a.timestamp)
                    .map((slot) => (
                      <div key={slot.id} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-slate-100">{slot.name}</div>
                            <div className="mt-1 text-xs text-slate-500">
                              {slot.id} · {formatTime(slot.timestamp)}
                            </div>
                          </div>
                          <div className="rounded-lg border border-slate-700 bg-black/20 px-2 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-400">
                            Floor {slot.floor}
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                          <span>角色：{slot.characterId || '未知'}</span>
                          <span>时长：{formatPlayTime(slot.playTime)}</span>
                        </div>

                        <div className="mt-4 flex gap-2">
                          <button
                            onClick={() => onLoadSlot(slot.id)}
                            className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 transition hover:bg-slate-700"
                          >
                            读取
                          </button>
                          <button
                            onClick={() => onDeleteSlot(slot.id)}
                            className="rounded-xl border border-red-900/50 bg-red-950/20 px-3 py-2 text-sm text-red-200 transition hover:bg-red-900/20"
                          >
                            删除
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
