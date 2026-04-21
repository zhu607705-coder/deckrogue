// 动画速度档位类型，与现有系统保持一致
export type AnimationSpeedLevel = 'fast' | 'normal' | 'reduced';

// 动画速度倍率配置
const SPEED_MULTIPLIERS: Record<AnimationSpeedLevel, number> = {
  fast: 1.3,
  normal: 1.0,
  reduced: 0.7
};

// 动画速度存储键名，与现有系统保持一致
const STORAGE_KEY = 'deckrogue_animation_speed';

// 动画速度管理器类
export class AnimationSpeedManager {
  private static instance: AnimationSpeedManager;
  private speedLevel: AnimationSpeedLevel;

  private constructor() {
    // 从本地存储加载动画速度设置，如果没有则使用默认值
    this.speedLevel = this.loadSpeedFromStorage() || 'normal';
  }

  // 获取单例实例
  public static getInstance(): AnimationSpeedManager {
    if (!AnimationSpeedManager.instance) {
      AnimationSpeedManager.instance = new AnimationSpeedManager();
    }
    return AnimationSpeedManager.instance;
  }

  // 获取当前动画速度档位
  public getSpeedLevel(): AnimationSpeedLevel {
    return this.speedLevel;
  }

  // 设置动画速度档位
  public setSpeedLevel(level: AnimationSpeedLevel): void {
    this.speedLevel = level;
    this.saveSpeedToStorage(level);
  }

  // 获取动画速度倍率
  public getSpeedMultiplier(): number {
    return SPEED_MULTIPLIERS[this.speedLevel];
  }

  // 从本地存储加载动画速度设置
  private loadSpeedFromStorage(): AnimationSpeedLevel | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && Object.keys(SPEED_MULTIPLIERS).includes(stored)) {
        return stored as AnimationSpeedLevel;
      }
      return null;
    } catch (error) {
      console.error('Failed to load animation speed from storage:', error);
      return null;
    }
  }

  // 保存动画速度设置到本地存储
  private saveSpeedToStorage(level: AnimationSpeedLevel): void {
    try {
      localStorage.setItem(STORAGE_KEY, level);
    } catch (error) {
      console.error('Failed to save animation speed to storage:', error);
    }
  }
}

// 导出默认实例
export const animationSpeedManager = AnimationSpeedManager.getInstance();

// 导出动画速度配置
export const ANIMATION_SPEEDS: Array<{
  value: AnimationSpeedLevel;
  label: string;
  description: string;
}> = [
  { value: 'fast', label: '快速', description: '加快游戏节奏' },
  { value: 'normal', label: '正常', description: '平衡的动画速度' },
  { value: 'reduced', label: '减慢', description: '适合仔细观察动画效果' }
];

// 导出获取动画速度的辅助函数
export function getAnimationSpeed(): number {
  return animationSpeedManager.getSpeedMultiplier();
}

// 导出设置动画速度的辅助函数
export function setAnimationSpeed(level: AnimationSpeedLevel): void {
  animationSpeedManager.setSpeedLevel(level);
}