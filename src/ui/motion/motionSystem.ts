/**
 * @file motionSystem.ts
 * @description 动画系统配置 - 定义动画速度、质量和环境配置
 *
 * 主要职责:
 * - 定义动画速度和品质档位
 * - 管理环境氛围配置
 * - 提供动画配置接口
 */

import { globalEventBus } from '@/core';
import { safeStorageGetString, safeStorageSetString } from '@/core/utils/safeStorage';

export type AnimationSpeed = 'fast' | 'normal' | 'reduced';
export type AnimationQuality = 'high' | 'balanced' | 'reduced';
export type AmbientProfile = 'clear' | 'ash' | 'storm' | 'twilight';

export interface MotionConfig {
  speed: AnimationSpeed;
  quality: AnimationQuality;
  ambientProfile: AmbientProfile;
}

export interface MotionTokens {
  fast: number;
  normal: number;
  slow: number;
  enterDistance: number;
  hoverScale: number;
  pressScale: number;
  sceneEnter: number;
  sceneExit: number;
  sceneCrossfade: number;
  toastEnter: number;
  toastExit: number;
}

export const MOTION_TOKENS: Record<AnimationSpeed, MotionTokens> = {
  fast: {
    fast: 80,
    normal: 150,
    slow: 250,
    enterDistance: 8,
    hoverScale: 1.015,
    pressScale: 0.98,
    sceneEnter: 200,
    sceneExit: 150,
    sceneCrossfade: 250,
    toastEnter: 200,
    toastExit: 150,
  },
  normal: {
    fast: 150,
    normal: 280,
    slow: 420,
    enterDistance: 12,
    hoverScale: 1.02,
    pressScale: 0.97,
    sceneEnter: 350,
    sceneExit: 250,
    sceneCrossfade: 400,
    toastEnter: 300,
    toastExit: 200,
  },
  reduced: {
    fast: 80,
    normal: 200,
    slow: 350,
    enterDistance: 6,
    hoverScale: 1.01,
    pressScale: 0.98,
    sceneEnter: 500,
    sceneExit: 400,
    sceneCrossfade: 600,
    toastEnter: 400,
    toastExit: 300,
  },
};

export const QUALITY_CONFIGS: Record<AnimationQuality, {
  particleDensity: number;
  blurAmount: number;
  shadowDepth: number;
  ambientOpacity: number;
  animationParallel: number;
  envParticles: number;
}> = {
  high: {
    particleDensity: 1,
    blurAmount: 1,
    shadowDepth: 1,
    ambientOpacity: 1,
    animationParallel: 5,
    envParticles: 25,
  },
  balanced: {
    particleDensity: 0.6,
    blurAmount: 2,
    shadowDepth: 0.7,
    ambientOpacity: 0.8,
    animationParallel: 3,
    envParticles: 15,
  },
  reduced: {
    particleDensity: 0.3,
    blurAmount: 3,
    shadowDepth: 0.4,
    ambientOpacity: 0.4,
    animationParallel: 1,
    envParticles: 5,
  },
};

export type ToastType = 'victory' | 'defeat' | 'upgrade' | 'achievement' | 'loot' | 'warning';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  timestamp: number;
}

export type SceneId =
  | 'Launcher'
  | 'CharacterSelect'
  | 'Map'
  | 'Combat'
  | 'Reward'
  | 'Shop'
  | 'Event'
  | 'Rest'
  | 'Upgrade'
  | 'RelicUpgrade'
  | 'Enchant'
  | 'RemoveCard'
  | 'GameOver'
  | 'Victory';

export interface SceneTransition {
  from: SceneId | null;
  to: SceneId;
  direction: 'forward' | 'backward' | 'crossfade';
  duration: number;
}

const STORAGE_KEY_QUALITY = 'deckrogue_animation_quality';
const STORAGE_KEY_SPEED = 'deckrogue_animation_speed';
const STORAGE_KEY_AMBIENT = 'deckrogue_ambient_profile';

let currentConfig: MotionConfig = {
  speed: 'normal',
  quality: 'balanced',
  ambientProfile: 'clear',
};

let toastQueue: ToastMessage[] = [];
let toastListeners: Set<(toasts: ToastMessage[]) => void> = new Set();
let sceneTransitionListeners: Set<(transition: SceneTransition) => void> = new Set();
let currentScene: SceneId = 'Launcher';

function loadStoredConfig(): void {
  if (typeof window === 'undefined') return;

  const storedSpeed = safeStorageGetString(STORAGE_KEY_SPEED, '').value as AnimationSpeed | '';
  const storedQuality = safeStorageGetString(STORAGE_KEY_QUALITY, '').value as AnimationQuality | '';
  const storedAmbient = safeStorageGetString(STORAGE_KEY_AMBIENT, '').value as AmbientProfile | '';

  if (storedSpeed === 'fast' || storedSpeed === 'normal' || storedSpeed === 'reduced') {
    currentConfig.speed = storedSpeed;
  }
  if (storedQuality === 'high' || storedQuality === 'balanced' || storedQuality === 'reduced') {
    currentConfig.quality = storedQuality;
  }
  if (storedAmbient === 'clear' || storedAmbient === 'ash' || storedAmbient === 'storm' || storedAmbient === 'twilight') {
    currentConfig.ambientProfile = storedAmbient;
  }
}

export function getMotionConfig(): MotionConfig {
  return { ...currentConfig };
}

export function setAnimationSpeed(speed: AnimationSpeed): void {
  currentConfig.speed = speed;
  if (typeof window !== 'undefined') {
    safeStorageSetString(STORAGE_KEY_SPEED, speed);
    document.documentElement.setAttribute('data-animation-speed', speed);
  }
  globalEventBus.publish({ type: 'MotionConfigChanged', config: currentConfig });
}

export function setAnimationQuality(quality: AnimationQuality): void {
  currentConfig.quality = quality;
  if (typeof window !== 'undefined') {
    safeStorageSetString(STORAGE_KEY_QUALITY, quality);
    document.documentElement.setAttribute('data-quality', quality);
  }
  globalEventBus.publish({ type: 'MotionConfigChanged', config: currentConfig });
}

export function setAmbientProfile(profile: AmbientProfile): void {
  currentConfig.ambientProfile = profile;
  if (typeof window !== 'undefined') {
    safeStorageSetString(STORAGE_KEY_AMBIENT, profile);
  }
  globalEventBus.publish({ type: 'MotionConfigChanged', config: currentConfig });
}

export function getMotionTokens(): MotionTokens {
  return MOTION_TOKENS[currentConfig.speed];
}

export function getQualityConfig() {
  return QUALITY_CONFIGS[currentConfig.quality];
}

export function applyMotionConfigToDOM(): void {
  if (typeof window === 'undefined') return;
  document.documentElement.setAttribute('data-animation-speed', currentConfig.speed);
  document.documentElement.setAttribute('data-quality', currentConfig.quality);
}

export function showToast(toast: Omit<ToastMessage, 'id' | 'timestamp'>): string {
  const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const fullToast: ToastMessage = {
    ...toast,
    id,
    timestamp: Date.now(),
    duration: toast.duration ?? (toast.type === 'victory' || toast.type === 'defeat' ? 5000 : 3000),
  };

  toastQueue = [...toastQueue, fullToast];
  notifyToastListeners();

  if (fullToast.duration && fullToast.duration > 0) {
    setTimeout(() => dismissToast(id), fullToast.duration);
  }

  return id;
}

export function dismissToast(id: string): void {
  toastQueue = toastQueue.filter(t => t.id !== id);
  notifyToastListeners();
}

export function dismissAllToasts(): void {
  toastQueue = [];
  notifyToastListeners();
}

export function getToasts(): ToastMessage[] {
  return [...toastQueue];
}

export function subscribeToToasts(listener: (toasts: ToastMessage[]) => void): () => void {
  toastListeners.add(listener);
  return () => toastListeners.delete(listener);
}

function notifyToastListeners(): void {
  toastListeners.forEach(listener => listener([...toastQueue]));
}

export function emitSceneTransition(from: SceneId | null, to: SceneId): void {
  const direction = determineTransitionDirection(from, to);
  const tokens = getMotionTokens();

  const transition: SceneTransition = {
    from,
    to,
    direction,
    duration: direction === 'crossfade' ? tokens.sceneCrossfade :
              direction === 'forward' ? tokens.sceneEnter : tokens.sceneExit,
  };

  globalEventBus.publish({ type: 'SceneTransition', transition });
}

function determineTransitionDirection(from: SceneId | null, to: SceneId): 'forward' | 'backward' | 'crossfade' {
  const sceneOrder: SceneId[] = [
    'Launcher', 'CharacterSelect', 'Map', 'Combat', 'Reward', 'Shop', 'Event', 'Rest'
  ];

  if (!from) return 'forward';
  if (from === to) return 'crossfade';

  const fromIndex = sceneOrder.indexOf(from);
  const toIndex = sceneOrder.indexOf(to);

  if (fromIndex === -1 || toIndex === -1) return 'crossfade';
  if (toIndex > fromIndex) return 'forward';
  if (toIndex < fromIndex) return 'backward';
  return 'crossfade';
}

export const COMBAT_BEATS = {
  PLAY_CONFIRM: 'combat-beat--play-confirm',
  HIT: 'combat-beat--hit',
  BLOCK: 'combat-beat--block',
  PIERCE: 'combat-beat--pierce',
  STATUS_APPLY: 'combat-beat--status-apply',
  RESOURCE_CHANGE: 'combat-beat--resource-change',
  KILL: 'combat-beat--kill',
  TURN_END: 'combat-beat--turn-end',
} as const;

export function triggerCombatBeat(
  element: HTMLElement,
  beatType: typeof COMBAT_BEATS[keyof typeof COMBAT_BEATS],
  options?: { resourceGlow?: 'energy' | 'hp' | 'block' }
): void {
  const tokens = getMotionTokens();

  element.classList.remove(beatType);
  void element.offsetWidth;

  if (options?.resourceGlow) {
    element.classList.add(`resource-glow--${options.resourceGlow}`);
  }

  element.classList.add(beatType);

  const duration = beatType === COMBAT_BEATS.KILL ? tokens.slow : tokens.normal;
  setTimeout(() => {
    element.classList.remove(beatType);
    if (options?.resourceGlow) {
      element.classList.remove(`resource-glow--${options.resourceGlow}`);
    }
  }, duration);
}

export function triggerScreenShake(intensity: 'light' | 'medium' | 'heavy'): void {
  if (currentConfig.quality === 'reduced') return;

  const container = document.querySelector('.app-shell') as HTMLElement | null;
  if (!container) return;

  const shakeClass = `screen-shake--${intensity}`;
  container.classList.remove(shakeClass);
  void container.offsetWidth;
  container.classList.add(shakeClass);

  const tokens = getMotionTokens();
  const duration = intensity === 'light' ? 300 : intensity === 'medium' ? 500 : 700;

  setTimeout(() => {
    container.classList.remove(shakeClass);
  }, duration);
}

export function getAmbientClassForScene(scene: SceneId): string {
  const baseAmbient = currentConfig.ambientProfile;
  const sceneAmbients: Partial<Record<SceneId, string>> = {
    Launcher: 'ambient-launcher',
    CharacterSelect: 'ambient-character-select',
    Map: 'ambient-map',
    Combat: 'ambient-combat',
    Shop: 'ambient-shop',
    Event: 'ambient-event',
    Victory: 'ambient-victory',
    GameOver: 'ambient-defeat',
  };

  const sceneClass = sceneAmbients[scene] || '';
  const profileClass = baseAmbient !== 'clear' ? `ambient-profile--${baseAmbient}` : '';

  return [sceneClass, profileClass].filter(Boolean).join(' ');
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches || currentConfig.speed === 'reduced';
}

export function shouldReduceAnimations(): boolean {
  return currentConfig.quality === 'reduced' || prefersReducedMotion();
}

export function initMotionConfig(): void {
  loadStoredConfig();
  applyMotionConfigToDOM();
}

initMotionConfig();
