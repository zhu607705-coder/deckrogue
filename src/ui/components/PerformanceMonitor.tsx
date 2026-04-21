import { useEffect, useState } from 'react';
import { memoryManager } from '@/core/performance/MemoryManager';

interface PerformanceMonitorProps {
  enabled?: boolean;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  showDetails?: boolean;
}

export function PerformanceMonitor({
  enabled = false,
  position = 'top-right',
  showDetails = false
}: PerformanceMonitorProps) {
  const [fps, setFps] = useState(60);
  const [memory, setMemory] = useState<string>('0 MB');
  const [memoryPercent, setMemoryPercent] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const [trend, setTrend] = useState<string>('稳定');

  useEffect(() => {
    if (!enabled) return;

    let frameCount = 0;
    let lastTime = performance.now();
    let animationId: number;

    const measureFPS = () => {
      frameCount++;
      const currentTime = performance.now();

      if (currentTime - lastTime >= 1000) {
        setFps(frameCount);
        frameCount = 0;
        lastTime = currentTime;
      }

      const memStats = memoryManager.getCurrentMemory();
      if (memStats) {
        setMemory(memoryManager.formatBytes(memStats.usedJSHeapSize));
        setMemoryPercent((memStats.usedJSHeapSize / memStats.jsHeapSizeLimit) * 100);

        const memoryTrend = memoryManager.getMemoryTrend();
        if (memoryTrend > 100000) {
          setTrend('↑ 上升');
        } else if (memoryTrend < -100000) {
          setTrend('↓ 下降');
        } else {
          setTrend('稳定');
        }
      }

      animationId = requestAnimationFrame(measureFPS);
    };

    animationId = requestAnimationFrame(measureFPS);

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [enabled]);

  if (!enabled) return null;

  const positionStyles: Record<string, string> = {
    'top-left': 'top-4 left-4',
    'top-right': 'top-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'bottom-right': 'bottom-4 right-4'
  };

  const getFpsColor = (): string => {
    if (fps >= 55) return 'text-green-400';
    if (fps >= 30) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getMemoryColor = (): string => {
    if (memoryPercent < 60) return 'bg-green-500';
    if (memoryPercent < 85) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div
      className={`fixed ${positionStyles[position]} z-50 font-mono text-xs bg-gray-900/90 backdrop-blur rounded-lg border border-gray-700 overflow-hidden transition-all duration-200 ${
        isExpanded ? 'w-64' : 'w-48'
      }`}
    >
      <div
        className="p-2 flex items-center justify-between cursor-pointer hover:bg-gray-800/50"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className="text-gray-400">性能监控</span>
        <span className="text-gray-500">{isExpanded ? '▼' : '▶'}</span>
      </div>

      {isExpanded && (
        <div className="p-3 space-y-3 border-t border-gray-700">
          <div className="flex items-center justify-between">
            <span className="text-gray-400">FPS</span>
            <span className={`font-bold ${getFpsColor()}`}>{fps}</span>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">内存</span>
              <span className="text-gray-300">{memory}</span>
            </div>
            <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div
                className={`h-full ${getMemoryColor()} transition-all duration-300`}
                style={{ width: `${Math.min(100, memoryPercent)}%` }}
              />
            </div>
            <div className="text-xs text-gray-500">{trend}</div>
          </div>

          {showDetails && (
            <>
              <div className="border-t border-gray-700 pt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">监听器</span>
                  <span className="text-gray-300">-</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">战斗数据</span>
                  <span className="text-gray-300">-</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">临时数据</span>
                  <span className="text-gray-300">-</span>
                </div>
              </div>

              <button
                className="w-full mt-2 px-2 py-1 text-xs bg-red-900/50 hover:bg-red-800/50 text-red-300 rounded transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  memoryManager.forceCleanup();
                  setTrend('已清理');
                  setTimeout(() => setTrend('稳定'), 1000);
                }}
              >
                强制清理
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default PerformanceMonitor;
