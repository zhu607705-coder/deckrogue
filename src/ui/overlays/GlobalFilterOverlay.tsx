import React from 'react';
import { useTheme } from '@/ui/theme/ThemeContext';

export function GlobalFilterOverlay() {
  const { filterEffects, visualIntensity, mode } = useTheme();

  const intensityMultiplier = visualIntensity === 'subtle' ? 0.5 : visualIntensity === 'intense' ? 1.5 : 1;

  return (
    <div className="global-filter-overlay" data-theme={mode}>
      {filterEffects.vignette && (
        <div 
          className="filter-layer filter-vignette-layer"
          style={{
            opacity: intensityMultiplier * (mode === 'dark' ? 1 : 0.6)
          }}
        />
      )}
      {filterEffects.noise && (
        <div 
          className="filter-layer filter-noise-layer"
          style={{
            opacity: intensityMultiplier * (mode === 'dark' ? 0.08 : 0.05)
          }}
        />
      )}
      {filterEffects.scanlines && (
        <div 
          className="filter-layer filter-scanlines-layer"
          style={{
            opacity: intensityMultiplier * (mode === 'dark' ? 0.12 : 0.08)
          }}
        />
      )}
    </div>
  );
}
