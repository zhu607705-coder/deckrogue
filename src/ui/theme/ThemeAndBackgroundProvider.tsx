import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useTheme } from '@/ui/theme/ThemeContext';
import { BackgroundVisualMode, BACKGROUND_VISUAL_MODE_OPTIONS } from '@/ui/components/backgroundVisuals';

const BG_VISUAL_MODE_KEY = 'deckrogue_bg_visual_mode';

export const ThemeAndBackgroundContext = createContext(null);

export function ThemeAndBackgroundProvider({ children }: { children: React.ReactNode }) {
  const { mode: themeMode, setMode: setThemeMode, visualIntensity, setVisualIntensity, filterEffects, toggleFilter } = useTheme();

  const [backgroundVisualMode, setBackgroundVisualMode] = useState<BackgroundVisualMode>(() => {
    if (typeof window === 'undefined') return 'balanced';
    const saved = window.localStorage.getItem(BG_VISUAL_MODE_KEY);
    return saved === 'cinematic' || saved === 'balanced' || saved === 'vivid' ? saved : 'balanced';
  });

  const [isThemeTransitioning, setIsThemeTransitioning] = useState(false);
  const [themeFlashKey, setThemeFlashKey] = useState(0);
  const themeTransitionTimerRef = useRef<number | null>(null);

  const runThemeTransition = useCallback(() => {
    setThemeFlashKey((k) => k + 1);
    setIsThemeTransitioning(true);
    if (themeTransitionTimerRef.current != null) {
      window.clearTimeout(themeTransitionTimerRef.current);
    }
    themeTransitionTimerRef.current = window.setTimeout(() => {
      setIsThemeTransitioning(false);
      themeTransitionTimerRef.current = null;
    }, 420);
  }, []);

  const handleSetThemeMode = useCallback((nextMode: 'dark' | 'light') => {
    if (nextMode === themeMode) return;
    runThemeTransition();
    setThemeMode(nextMode);
  }, [themeMode, runThemeTransition, setThemeMode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(BG_VISUAL_MODE_KEY, backgroundVisualMode);
  }, [backgroundVisualMode]);

  const value = {
    themeMode,
    setThemeMode: handleSetThemeMode,
    visualIntensity,
    setVisualIntensity,
    filterEffects,
    toggleFilter,
    backgroundVisualMode,
    setBackgroundVisualMode,
    isThemeTransitioning,
    themeFlashKey,
  };

  return (
    <ThemeAndBackgroundContext.Provider value={value}>
      {children}
    </ThemeAndBackgroundContext.Provider>
  );
}

export function useThemeAndBackground() {
  const context = useContext(ThemeAndBackgroundContext);
  if (!context) {
    throw new Error('useThemeAndBackground must be used within ThemeAndBackgroundProvider');
  }
  return context;
}