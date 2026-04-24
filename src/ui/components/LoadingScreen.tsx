/**
 * @file LoadingScreen.tsx
 * @description 加载屏幕组件 - 资源加载时的进度展示界面
 *
 * 主要职责:
 * - 显示加载进度和消息
 * - 支持全屏和覆盖层两种模式
 * - 提供动画加载效果
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface LoadingScreenProps {
  progress?: number;
  message?: string;
  submessage?: string;
  variant?: 'fullscreen' | 'overlay';
  showProgress?: boolean;
  animated?: boolean;
}

export function LoadingScreen({
  progress = 0,
  message = '正在初始化战区',
  submessage,
  variant = 'fullscreen',
  showProgress = true,
  animated = true,
}: LoadingScreenProps) {
  const [displayProgress, setDisplayProgress] = useState(animated ? 0 : progress);
  const [pulseGlow, setPulseGlow] = useState(false);

  useEffect(() => {
    if (animated) {
      const interval = setInterval(() => {
        setDisplayProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval);
            return 100;
          }
          return Math.min(prev + Math.random() * 15, prev + 5);
        });
      }, 200);
      return () => clearInterval(interval);
    } else {
      setDisplayProgress(progress);
    }
  }, [animated, progress]);

  useEffect(() => {
    if (animated) {
      const glowInterval = setInterval(() => {
        setPulseGlow((prev) => !prev);
      }, 1500);
      return () => clearInterval(glowInterval);
    }
  }, [animated]);

  const containerClass = variant === 'fullscreen'
    ? 'fixed inset-0 z-50 flex flex-col items-center justify-center bg-black'
    : 'relative flex flex-col items-center justify-center';

  return (
    <AnimatePresence>
      <motion.div
        className={containerClass}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-black via-gray-950 to-black" />
          <div className="absolute inset-0 opacity-20"
            style={{
              backgroundImage: `radial-gradient(circle at 50% 50%, transparent 0%, rgba(0,0,0,0.4) 100%)`,
            }}
          />
          <div className="absolute inset-0"
            style={{
              backgroundImage: `repeating-linear-gradient(
                0deg,
                transparent,
                transparent 2px,
                rgba(30, 30, 30, 0.03) 2px,
                rgba(30, 30, 30, 0.03) 4px
              )`,
            }}
          />
        </div>

        <div className="relative z-10 flex flex-col items-center gap-8 px-8">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <motion.div
                className="w-16 h-16 border-2 border-amber-900/50 border-t-amber-600 rounded-full"
                animate={animated ? { rotate: 360 } : {}}
                transition={animated ? { duration: 1, repeat: Infinity, ease: 'linear' } : {}}
              />
              <motion.div
                className="absolute inset-0 border-2 border-amber-700/30 rounded-full"
                animate={animated && pulseGlow ? { scale: [1, 1.2, 1], opacity: [0.3, 0.1, 0.3] } : {}}
                transition={animated ? { duration: 1.5, repeat: Infinity } : {}}
              />
            </div>

            <div className="flex flex-col items-center gap-2">
              <h1 className="text-2xl font-bold tracking-wider text-amber-600/90"
                style={{
                  textShadow: '0 0 20px rgba(180, 120, 50, 0.3)',
                  fontFamily: 'serif',
                }}
              >
                DECKROGUE
              </h1>
              <p className="text-sm text-gray-500 tracking-widest uppercase">
                Warhammer-Inspired Deck Builder
              </p>
            </div>
          </div>

          {showProgress && (
            <div className="w-80 max-w-[90vw] flex flex-col gap-3">
              <div className="relative h-1 bg-gray-900/80 rounded-full overflow-hidden border border-gray-800/50">
                <motion.div
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-amber-950 via-amber-700 to-amber-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(displayProgress, 100)}%` }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                />
                <motion.div
                  className="absolute inset-y-0 w-4 bg-amber-400/50 blur-sm"
                  animate={animated ? { left: `${Math.min(displayProgress, 98)}%` } : {}}
                  transition={{ duration: 0.1 }}
                  style={{ filter: 'blur(4px)' }}
                />
              </div>

              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-500 font-mono">{message}</span>
                <span className="text-amber-700/80 font-mono tabular-nums">
                  {Math.round(Math.min(displayProgress, 100))}%
                </span>
              </div>

              {submessage && (
                <p className="text-xs text-gray-600 text-center animate-pulse">
                  {submessage}
                </p>
              )}
            </div>
          )}

          {!showProgress && message && (
            <p className="text-gray-500 text-sm font-mono animate-pulse">
              {message}
            </p>
          )}
        </div>

        <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <motion.div
              key={i}
              className="w-1 h-1 bg-amber-900/50 rounded-full"
              animate={animated ? {
                opacity: [0.2, 0.8, 0.2],
                scale: [0.8, 1.2, 0.8],
              } : {}}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                delay: i * 0.15,
                ease: 'easeInOut',
              }}
            />
          ))}
        </div>

        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-amber-900/20 to-transparent" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-900/20 to-transparent" />
      </motion.div>
    </AnimatePresence>
  );
}

interface LoadingOverlayProps {
  isLoading: boolean;
  message?: string;
  progress?: number;
}

export function LoadingOverlay({ isLoading, message = '加载中...', progress }: LoadingOverlayProps) {
  if (!isLoading) return null;

  return (
    <motion.div
      className="absolute inset-0 z-40 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="flex flex-col items-center gap-4 p-6 bg-gray-950/90 border border-gray-800/50 rounded-lg shadow-2xl">
        <div className="w-8 h-8 border-2 border-amber-700/50 border-t-amber-500 rounded-full animate-spin" />
        <div className="text-center">
          <p className="text-sm text-gray-400">{message}</p>
          {progress !== undefined && (
            <p className="text-xs text-amber-700/80 mt-1 font-mono">{Math.round(progress)}%</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export function MinimalLoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'w-4 h-4 border',
    md: 'w-8 h-8 border-2',
    lg: 'w-12 h-12 border-2',
  };

  return (
    <motion.div
      className={`${sizeClasses[size]} border-amber-900/50 border-t-amber-600 rounded-full`}
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
    />
  );
}

export default LoadingScreen;
