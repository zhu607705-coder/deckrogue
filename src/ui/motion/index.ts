/**
 * @file index.ts
 * @description 动画系统入口 - 导出动画配置、Toast 和场景过渡组件
 *
 * 主要职责:
 * - 导出动画速度/质量/环境配置
 * - 导出 Toast 消息系统
 * - 导出场景过渡和容器组件
 */

export {
  type AnimationSpeed,
  type AnimationQuality,
  type AmbientProfile,
  type MotionConfig,
  type MotionTokens,
  type ToastType,
  type ToastMessage,
  type SceneId,
  type SceneTransition,
  MOTION_TOKENS,
  QUALITY_CONFIGS,
  COMBAT_BEATS,
  getMotionConfig,
  setAnimationSpeed,
  setAnimationQuality,
  setAmbientProfile,
  getMotionTokens,
  getQualityConfig,
  applyMotionConfigToDOM,
  showToast,
  dismissToast,
  dismissAllToasts,
  getToasts,
  subscribeToToasts,
  emitSceneTransition,
  triggerCombatBeat,
  triggerScreenShake,
  getAmbientClassForScene,
  prefersReducedMotion,
  shouldReduceAnimations,
  initMotionConfig,
} from '@/ui/motion/motionSystem';

export { ToastContainer } from '@/ui/motion/ToastContainer';
export { SceneTransitionWrapper, AmbientLayer, SceneContainer } from '@/ui/motion/SceneTransition';
