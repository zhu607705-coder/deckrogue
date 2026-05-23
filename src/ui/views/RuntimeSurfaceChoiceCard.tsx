/**
 * @file RuntimeSurfaceChoiceCard.tsx
 * @description Fallback card for runtime-v2 room choices when legacy instances are absent.
 */

import React from 'react';
import type { RenderModelRoomChoice } from '@/runtimeV2';

type RuntimeSurfaceChoiceTone = 'upgrade' | 'enchant' | 'relic';

const toneClasses: Record<RuntimeSurfaceChoiceTone, string> = {
  upgrade: 'border-emerald-500/70 bg-emerald-950/35 hover:bg-emerald-950/60 text-emerald-100',
  enchant: 'border-amber-500/70 bg-amber-950/35 hover:bg-amber-950/60 text-amber-100',
  relic: 'border-yellow-500/70 bg-yellow-950/35 hover:bg-yellow-950/60 text-yellow-100',
};

const toneKickers: Record<RuntimeSurfaceChoiceTone, string> = {
  upgrade: '可强化印痕',
  enchant: '可附魔印痕',
  relic: '可升级遗物',
};

export function RuntimeSurfaceChoiceCard({
  choice,
  index,
  tone,
  actionLabel,
  onSelect,
}: {
  choice: RenderModelRoomChoice;
  index: number;
  tone: RuntimeSurfaceChoiceTone;
  actionLabel: string;
  onSelect: (choiceId: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(choice.id)}
      disabled={choice.disabled}
      className={[
        'relative w-56 min-h-64 rounded-lg border p-4 text-left transition-all backdrop-blur-sm shadow-lg',
        choice.disabled
          ? 'border-slate-700 bg-slate-900/60 opacity-50 cursor-not-allowed text-slate-500'
          : `${toneClasses[tone]} hover:scale-[1.02] cursor-pointer`,
      ].join(' ')}
      data-runtime-choice-id={choice.id}
      data-keyboard-option={index < 10 ? String(index + 1) : undefined}
      data-keyboard-focus={choice.disabled ? undefined : 'true'}
      aria-label={`${index + 1}. ${choice.label}`}
    >
      <div className="text-xs opacity-70 mb-3">{toneKickers[tone]}</div>
      <div className="text-xl font-serif mb-3">{choice.label}</div>
      {choice.description && (
        <div className="text-sm leading-6 text-slate-300">{choice.description}</div>
      )}
      <div className="absolute bottom-4 left-4 text-sm font-bold opacity-80">{actionLabel}</div>
    </button>
  );
}
