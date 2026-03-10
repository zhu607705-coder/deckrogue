import React from 'react';
import type { GameEngine } from '@/core';

interface WarpEyeProps {
  engine: GameEngine;
}

export function WarpEye({ engine }: WarpEyeProps) {
  const state = engine.state.combat!;
  const warpTide = state.warpTide || 0;
  const warpRatio = Math.max(0, Math.min(1, warpTide / 100));
  const warpEyeR = Math.round(168 + (138 - 168) * warpRatio);
  const warpEyeG = Math.round(123 + (11 - 123) * warpRatio);
  const warpEyeB = Math.round(50 + (218 - 50) * warpRatio);
  const warpEyeColor = `rgb(${warpEyeR}, ${warpEyeG}, ${warpEyeB})`;
  const warpGlowPx = `${20 + warpRatio * 30}px`;
  const effectiveAlpha = engine.getWarpEffectiveAlpha(state.warpAlpha || 2);
  const warpPower = engine.getWarpPowerMultiplier(warpTide, effectiveAlpha);
  const rawPerilPct = Math.round(engine.getWarpPerilChance(warpTide, state.warpPerilK || 0.05) * 100);
  const warpPerilPct = Math.round(Math.max(engine.getWarpPerilChance(warpTide, state.warpPerilK || 0.05), (state.warpRiftTurns || 0) > 0 ? (state.warpRiftPerilFloor || 0) : 0) * 100);
  const warpTier = warpTide >= 70 ? 'high' : warpTide >= 30 ? 'mid' : 'low';
  const isWarpBoiling = warpTide >= 80;

  return (
    <div
      className={`warp-eye warp-eye--${warpTier}`}
      style={{ ['--warp-eye-color' as any]: warpEyeColor, ['--warp-eye-glow' as any]: warpGlowPx }}
    >
      <div className="warp-eye__housing">
        <div className="warp-eye__gear warp-eye__gear--a" />
        <div className="warp-eye__gear warp-eye__gear--b" />
        <div className="warp-eye__lid" />
        <div className="warp-eye__iris" />
        <div className="warp-eye__pupil" />
      </div>
      <div className="warp-eye__stats">
        <div className="warp-eye__title">Warp Tide</div>
        <div className="warp-eye__value">{warpTide}</div>
        <div className="warp-eye__meta">
          {isWarpBoiling ? 'WARP BOILING' : 'Warp Stable'} · x{warpPower.toFixed(2)} / Peril {warpPerilPct}%
          {(state.warpRiftTurns || 0) > 0 ? ` (Rift αx${effectiveAlpha.toFixed(1)})` : rawPerilPct !== warpPerilPct ? `*` : ''}
        </div>
      </div>
    </div>
  );
}
