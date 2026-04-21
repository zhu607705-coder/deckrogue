import React, { useEffect, useRef } from 'react';
import type { MetaProfile, SaveSlot } from '@/core';
import { getUiLabelZh } from '@/ui/content/terminology';

interface SetupLauncherProps {
  canContinue: boolean;
  saveSlots: SaveSlot[];
  metaProfile: MetaProfile;
  tutorialOpen?: boolean;
  onNewRun: () => void;
  onOpenTutorial: () => void;
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

function resetLauncherScrollPosition(node: HTMLDivElement | null): void {
  if (!node) return;
  node.scrollLeft = 0;
  node.scrollTop = 0;
  if (typeof node.scrollTo === 'function') {
    try {
      node.scrollTo({ left: 0, top: 0 });
    } catch {
      node.scrollTo(0, 0);
    }
  }
}

export function SetupLauncher({
  canContinue,
  saveSlots,
  metaProfile,
  tutorialOpen = false,
  onNewRun,
  onOpenTutorial,
  onContinue,
  onLoadSlot,
  onDeleteSlot,
  error
}: SetupLauncherProps) {
  const latestRun = metaProfile.runHistory?.[0] || null;
  const sortedSlots = saveSlots.slice().sort((a, b) => b.timestamp - a.timestamp);
  const shellRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const resetScroll = () => {
      resetLauncherScrollPosition(shellRef.current);
    };

    resetScroll();
    if (typeof window === 'undefined') {
      return;
    }

    const handleResize = () => {
      resetScroll();
      window.requestAnimationFrame(resetScroll);
    };

    const frame = window.requestAnimationFrame(resetScroll);
    window.addEventListener('resize', handleResize);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    if (tutorialOpen || typeof window === 'undefined') {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      resetLauncherScrollPosition(shellRef.current);
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [tutorialOpen]);

  return (
    <div ref={shellRef} className="launcher-shell relative min-h-screen w-full overflow-hidden text-white">
      <div className="launcher-veil absolute inset-0" />
      <div className="launcher-grain absolute inset-0 opacity-60" />
      <div className="launcher-orb launcher-orb-left absolute" />
      <div className="launcher-orb launcher-orb-right absolute" />

      <div className="relative z-10 min-h-screen px-6 py-8 md:px-10 xl:h-screen xl:overflow-hidden xl:px-14">
        <div className="mx-auto flex max-w-7xl flex-col xl:h-full xl:min-h-0">
          <section className="flex min-h-[calc(100vh-4rem)] flex-col justify-center py-10 xl:min-h-0 xl:flex-none xl:justify-end xl:py-1">
            <div className="grid items-end gap-10 xl:gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
              <div className="max-w-4xl">
                <div className="launcher-kicker mb-4 text-[11px] uppercase tracking-[0.4em] text-amber-200/70">
                  {getUiLabelZh('Ritual Access Node')}
                </div>
                <div className="launcher-brand reveal-rise">
                  <div className="text-[clamp(3.75rem,11vw,8.8rem)] font-black uppercase leading-[0.85] tracking-[0.08em] text-amber-50 xl:text-[clamp(3.2rem,6.9vw,5.5rem)]">
                    DeckRogue
                  </div>
                  <h1 className="mt-3 max-w-3xl text-[clamp(1.6rem,3.7vw,3.4rem)] font-semibold leading-[0.95] tracking-tight text-stone-100 xl:text-[clamp(1.5rem,2.8vw,2.5rem)]">
                    战区启动器
                  </h1>
                </div>
                <p className="reveal-rise mt-6 max-w-xl text-sm leading-7 text-stone-300 md:text-base xl:mt-4 xl:max-w-lg xl:text-sm xl:leading-6">
                  继续推进三章节远征，管理作战档案，保留每一次失败后的可复现路径与下一局方向。
                </p>
                {latestRun ? (
                  <div className="reveal-rise mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-stone-300/80 xl:mt-5">
                    <span>最近层数 {latestRun.reachedFloor}</span>
                    <span>{latestRun.isVictory ? '最近结果 胜利' : '最近结果 失败'}</span>
                    <span>记录号 {latestRun.runId}</span>
                  </div>
                ) : (
                  <div className="reveal-rise mt-8 text-sm text-stone-400 xl:mt-5">当前还没有作战记录。</div>
                )}
                {error ? (
                  <div className="reveal-rise mt-6 max-w-xl border border-red-900/60 bg-red-950/30 px-4 py-3 text-sm text-red-100">
                    {error}
                  </div>
                ) : null}
              </div>

                <div className="launcher-panel reveal-rise overflow-hidden border border-white/10 bg-black/35 p-5 backdrop-blur-md md:p-6 xl:p-4">
                <div className="text-[11px] uppercase tracking-[0.34em] text-stone-400">{getUiLabelZh('Launch Sequence')}</div>
                <div className="mt-5 space-y-3 xl:mt-4 xl:space-y-2.5">
                  <button
                    onClick={onNewRun}
                    className="launcher-action group w-full border border-emerald-500/35 bg-emerald-950/35 px-5 py-5 text-left transition hover:border-emerald-300 hover:bg-emerald-900/35 lg:px-4 lg:py-4"
                    data-keyboard-option="1"
                    data-keyboard-focus="true"
                  >
                    <div className="text-[11px] uppercase tracking-[0.28em] text-emerald-300/75">{getUiLabelZh('New Run')}</div>
                    <div className="mt-2 text-2xl font-semibold text-white xl:text-xl">开始新战区</div>
                    <div className="mt-3 max-w-sm text-sm leading-6 text-emerald-50/80 xl:mt-2 xl:text-[13px] xl:leading-5">
                      初始化新种子并进入角色选择，沿着当前版本冻结线开始一局完整远征。
                    </div>
                  </button>

                  <button
                    onClick={onContinue}
                    disabled={!canContinue}
                    className="launcher-action group w-full border border-amber-500/30 bg-amber-950/20 px-5 py-5 text-left transition enabled:hover:border-amber-200 enabled:hover:bg-amber-900/25 disabled:cursor-not-allowed disabled:opacity-40 lg:px-4 lg:py-4"
                    data-keyboard-option="2"
                    data-keyboard-focus="true"
                  >
                    <div className="text-[11px] uppercase tracking-[0.28em] text-amber-200/70">{getUiLabelZh('Continue')}</div>
                    <div className="mt-2 text-2xl font-semibold text-white xl:text-xl">继续作战</div>
                    <div className="mt-3 max-w-sm text-sm leading-6 text-stone-200/80 xl:mt-2 xl:text-[13px] xl:leading-5">
                      优先读取快速存档，没有则读取最近普通槽位。
                    </div>
                  </button>

                  <button
                    onClick={onOpenTutorial}
                    className="launcher-action group w-full border border-sky-500/25 bg-sky-950/18 px-5 py-4 text-left transition hover:border-sky-300 hover:bg-sky-900/22 lg:px-4 lg:py-3.5"
                    data-keyboard-focus="true"
                  >
                    <div className="text-[11px] uppercase tracking-[0.28em] text-sky-200/70">战区教程</div>
                    <div className="mt-2 text-xl font-semibold text-white xl:text-lg">术语、资源与战斗流程</div>
                    <div className="mt-3 max-w-sm text-sm leading-6 text-stone-200/80 xl:mt-2 xl:text-[13px] xl:leading-5">
                      先看一遍关键术语、回合顺序与房间推进规则，再进入正式远征。
                    </div>
                  </button>
                </div>

                <div className="mt-6 border-t border-white/10 pt-5 xl:mt-4 xl:pt-3">
                  <div className="text-[11px] uppercase tracking-[0.28em] text-stone-500">局外状态</div>
                  <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4 text-sm xl:mt-3 xl:gap-y-3">
                    <div>
                      <dt className="text-stone-500">征用点</dt>
                      <dd className="mt-1 text-2xl font-semibold text-amber-300 lg:text-xl">
                        {metaProfile.currencies.requisition}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-stone-500">亚空间回响</dt>
                      <dd className="mt-1 text-2xl font-semibold text-fuchsia-300 lg:text-xl">
                        {metaProfile.currencies.warpEchoes}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-stone-500">解锁角色</dt>
                      <dd className="mt-1 text-xl font-semibold text-stone-100 lg:text-lg">
                        {metaProfile.unlocks.characters.length}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-stone-500">局数档案</dt>
                      <dd className="mt-1 text-xl font-semibold text-stone-100 lg:text-lg">
                        {metaProfile.runHistory.length}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-6 border-t border-white/10 py-10 xl:min-h-0 xl:flex-1 xl:grid-cols-[0.68fr_1.32fr] xl:gap-4 xl:overflow-hidden xl:py-4">
            <div className="space-y-4 xl:min-h-0 xl:space-y-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.34em] text-stone-500">{getUiLabelZh('Version State')}</div>
                <h2 className="mt-3 text-2xl font-semibold text-stone-100">局外概览</h2>
                <p className="mt-3 max-w-md text-sm leading-7 text-stone-400 xl:mt-2 xl:text-[12px] xl:leading-5">
                  当前版本冻结于六角色、三章节、六类节点结构。这里只显示影响继续作战和长期成长的关键状态。
                </p>
              </div>
              <div className="space-y-3 text-sm text-stone-300/85 xl:space-y-1.5 xl:text-[13px]">
                <div className="flex items-center justify-between border-b border-white/8 pb-3 xl:pb-1.5">
                  <span>征用点</span>
                  <span className="font-semibold text-amber-300">{metaProfile.currencies.requisition}</span>
                </div>
                <div className="flex items-center justify-between border-b border-white/8 pb-3 xl:pb-1.5">
                  <span>亚空间回响</span>
                  <span className="font-semibold text-fuchsia-300">{metaProfile.currencies.warpEchoes}</span>
                </div>
                <div className="flex items-center justify-between border-b border-white/8 pb-3 xl:pb-1.5">
                  <span>解锁角色</span>
                  <span className="font-semibold text-stone-100">{metaProfile.unlocks.characters.length}</span>
                </div>
                <div className="flex items-center justify-between border-b border-white/8 pb-3 xl:pb-1.5">
                  <span>局数档案</span>
                  <span className="font-semibold text-stone-100">{metaProfile.runHistory.length}</span>
                </div>
              </div>
            </div>

            <div className="xl:flex xl:min-h-0 xl:flex-col">
                <div className="mb-5 flex items-center justify-between gap-3 xl:mb-2">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.34em] text-stone-500">{getUiLabelZh('Archive')}</div>
                  <h2 className="mt-3 text-2xl font-semibold text-stone-100 xl:mt-1.5 xl:text-lg">本地作战档案</h2>
                </div>
                <div className="text-xs text-stone-500">{sortedSlots.length} 个槽位</div>
              </div>

              {sortedSlots.length === 0 ? (
                <div className="border border-dashed border-white/10 bg-black/15 px-4 py-8 text-center text-sm text-stone-500">
                  当前没有可用存档。
                </div>
              ) : (
                <div className="space-y-3 xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:pr-2">
                  {sortedSlots.map((slot, index) => (
                    <div key={slot.id} className="border border-white/10 bg-black/20 px-4 py-4 backdrop-blur-sm xl:px-3.5 xl:py-2.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-base font-semibold text-stone-100 xl:text-sm">{slot.name}</div>
                          <div className="mt-1 text-xs text-stone-500 xl:mt-0.5">
                            {slot.id} · {formatTime(slot.timestamp)}
                          </div>
                        </div>
                        <div className="border border-white/10 px-2 py-1 text-[11px] uppercase tracking-[0.18em] text-stone-400">
                          第 {slot.floor} 层
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-400 xl:mt-1.5">
                        <span>角色：{slot.characterId || '未知'}</span>
                        <span>时长：{formatPlayTime(slot.playTime)}</span>
                      </div>

                      <div className="mt-4 flex gap-2 xl:mt-2">
                        <button
                          onClick={() => onLoadSlot(slot.id)}
                          className="border border-white/10 bg-white/5 px-3 py-2 text-sm text-stone-100 transition hover:bg-white/10 xl:px-2.5 xl:py-1.5 xl:text-xs"
                          data-keyboard-option={String(index + 3)}
                          data-keyboard-focus="true"
                        >
                          读取
                        </button>
                        <button
                          onClick={() => onDeleteSlot(slot.id)}
                          className="border border-red-900/50 bg-red-950/15 px-3 py-2 text-sm text-red-200 transition hover:bg-red-900/20 xl:px-2.5 xl:py-1.5 xl:text-xs"
                          data-keyboard-focus="true"
                        >
                          删除
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
