/**
 * @file backgroundVisuals.ts
 * @description 背景视觉模式配置 - 控制地图和战斗场景的视觉强度
 *
 * 主要职责:
 * - 定义背景视觉模式类型 (cinematic/balanced/vivid)
 * - 提供模式选项和调优参数
 */

export type BackgroundVisualMode = 'cinematic' | 'balanced' | 'vivid';

export const BACKGROUND_VISUAL_MODE_OPTIONS: Array<{ id: BackgroundVisualMode; label: string }> = [
  { id: 'cinematic', label: 'Cinematic' },
  { id: 'balanced', label: 'Balanced' },
  { id: 'vivid', label: 'Vivid' }
];

export function getMapBackgroundTuning(mode: BackgroundVisualMode) {
  switch (mode) {
    case 'cinematic':
      return {
        geminiOpacity: 0.58,
        geminiFilter: 'saturate(0.9) brightness(0.7) contrast(1.06)',
        overlayOpacity: 0.22,
        gradient: 'from-black/55 via-black/30 to-black/68',
        noiseOpacityClass: 'opacity-28'
      };
    case 'vivid':
      return {
        geminiOpacity: 0.82,
        geminiFilter: 'saturate(1.08) brightness(0.94) contrast(1.08)',
        overlayOpacity: 0.34,
        gradient: 'from-black/32 via-black/10 to-black/44',
        noiseOpacityClass: 'opacity-14'
      };
    case 'balanced':
    default:
      return {
        geminiOpacity: 0.72,
        geminiFilter: 'saturate(0.98) brightness(0.84) contrast(1.08)',
        overlayOpacity: 0.28,
        gradient: 'from-black/45 via-black/20 to-black/58',
        noiseOpacityClass: 'opacity-20'
      };
  }
}

export function getCombatBackgroundTuning(mode: BackgroundVisualMode) {
  switch (mode) {
    case 'cinematic':
      return {
        mainOpacity: 0.5,
        mainFilter: 'brightness(0.72) saturate(0.9) contrast(1.05)',
        overlayOpacity: 0.16,
        blackVeil: 'bg-black/48',
        gradientVeil: 'from-black/28 via-transparent to-black/46'
      };
    case 'vivid':
      return {
        mainOpacity: 0.78,
        mainFilter: 'brightness(0.96) saturate(1.04) contrast(1.07)',
        overlayOpacity: 0.3,
        blackVeil: 'bg-black/24',
        gradientVeil: 'from-black/10 via-transparent to-black/24'
      };
    case 'balanced':
    default:
      return {
        mainOpacity: 0.66,
        mainFilter: 'brightness(0.86) saturate(0.95) contrast(1.05)',
        overlayOpacity: 0.24,
        blackVeil: 'bg-black/36',
        gradientVeil: 'from-black/18 via-transparent to-black/34'
      };
  }
}

