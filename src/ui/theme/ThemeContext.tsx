/**
 * @file ThemeContext.tsx
 * @description 主题上下文 - 提供深色/浅色模式和视觉强度切换
 *
 * 主要职责:
 * - 管理主题模式状态 (dark/light)
 * - 提供视觉强度配置 (subtle/balanced/intense)
 * - 导出滤镜效果配置
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type ThemeMode = 'dark' | 'light';
export type VisualIntensity = 'subtle' | 'balanced' | 'intense';

interface ThemeContextValue {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
  visualIntensity: VisualIntensity;
  setVisualIntensity: (intensity: VisualIntensity) => void;
  filterEffects: {
    vignette: boolean;
    noise: boolean;
    scanlines: boolean;
  };
  toggleFilter: (filter: 'vignette' | 'noise' | 'scanlines') => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const THEME_STORAGE_KEY = 'deckrogue_theme_mode';
const INTENSITY_STORAGE_KEY = 'deckrogue_visual_intensity';
const FILTERS_STORAGE_KEY = 'deckrogue_filter_effects';

const defaultFilters = {
  vignette: true,
  noise: true,
  scanlines: false
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') return 'dark';
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
    if (window.matchMedia('(prefers-color-scheme: light)').matches) return 'light';
    return 'dark';
  });

  const [visualIntensity, setVisualIntensityState] = useState<VisualIntensity>(() => {
    if (typeof window === 'undefined') return 'balanced';
    const saved = window.localStorage.getItem(INTENSITY_STORAGE_KEY);
    return saved === 'subtle' || saved === 'balanced' || saved === 'intense' ? saved : 'balanced';
  });

  const [filterEffects, setFilterEffects] = useState(() => {
    if (typeof window === 'undefined') return defaultFilters;
    try {
      const saved = window.localStorage.getItem(FILTERS_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return defaultFilters;
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('theme-light', 'theme-dark');
    root.classList.add(`theme-${mode}`);
    root.style.colorScheme = mode;
  }, [mode]);

  useEffect(() => {
    window.localStorage.setItem(THEME_STORAGE_KEY, mode);
  }, [mode]);

  useEffect(() => {
    window.localStorage.setItem(INTENSITY_STORAGE_KEY, visualIntensity);
    const root = document.documentElement;
    root.classList.remove('intensity-subtle', 'intensity-balanced', 'intensity-intense');
    root.classList.add(`intensity-${visualIntensity}`);
  }, [visualIntensity]);

  useEffect(() => {
    window.localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filterEffects));
    const root = document.documentElement;
    root.classList.toggle('filter-vignette', filterEffects.vignette);
    root.classList.toggle('filter-noise', filterEffects.noise);
    root.classList.toggle('filter-scanlines', filterEffects.scanlines);
  }, [filterEffects]);

  const setMode = (newMode: ThemeMode) => setModeState(newMode);

  const toggleMode = () => setModeState(prev => prev === 'dark' ? 'light' : 'dark');

  const setVisualIntensity = (intensity: VisualIntensity) => setVisualIntensityState(intensity);

  const toggleFilter = (filter: 'vignette' | 'noise' | 'scanlines') => {
    setFilterEffects(prev => ({ ...prev, [filter]: !prev[filter] }));
  };

  return (
    <ThemeContext.Provider value={{
      mode,
      setMode,
      toggleMode,
      visualIntensity,
      setVisualIntensity,
      filterEffects,
      toggleFilter
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
