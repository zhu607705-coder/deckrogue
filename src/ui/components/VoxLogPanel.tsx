import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence, useDragControls } from 'motion/react';
import { Radio, Minimize2, Maximize2, X, GripVertical } from 'lucide-react';

interface VoxLogPanelProps {
  logLines: string[];
  maxVisibleLines?: number;
}

type PanelMode = 'full' | 'minimized';

interface Position {
  x: number;
  y: number;
}

const STORAGE_KEY_POSITION = 'deckrogue_voxlog_position';
const STORAGE_KEY_MODE = 'deckrogue_voxlog_mode';

function loadSavedPosition(): Position {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_POSITION);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch {}
  return { x: 16, y: 280 };
}

function savePosition(pos: Position): void {
  try {
    localStorage.setItem(STORAGE_KEY_POSITION, JSON.stringify(pos));
  } catch {}
}

function loadSavedMode(): PanelMode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_MODE);
    if (saved === 'full' || saved === 'minimized') {
      return saved;
    }
  } catch {}
  return 'full';
}

function saveMode(mode: PanelMode): void {
  try {
    localStorage.setItem(STORAGE_KEY_MODE, mode);
  } catch {}
}

export function VoxLogPanel({ 
  logLines, 
  maxVisibleLines = 6 
}: VoxLogPanelProps) {
  const [mode, setMode] = useState<PanelMode>(loadSavedMode);
  const [position, setPosition] = useState<Position>(loadSavedPosition);
  const [isDragging, setIsDragging] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const [prevLinesCount, setPrevLinesCount] = useState(0);
  const constraintsRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logLines.length > prevLinesCount && mode === 'minimized') {
      setHasUnread(true);
    }
    setPrevLinesCount(logLines.length);
  }, [logLines.length, mode, prevLinesCount]);

  const handleModeChange = useCallback((newMode: PanelMode) => {
    setMode(newMode);
    saveMode(newMode);
    if (newMode === 'full') {
      setHasUnread(false);
    }
  }, []);

  const handleDragStart = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handleDragEnd = useCallback((event: any, info: any) => {
    setIsDragging(false);
    const newPos = {
      x: position.x + info.offset.x,
      y: position.y + info.offset.y
    };
    setPosition(newPos);
    savePosition(newPos);
  }, [position]);

  const handlePositionChange = useCallback((newPos: Position) => {
    setPosition(newPos);
    savePosition(newPos);
  }, []);

  if (!logLines || logLines.length === 0) {
    return null;
  }

  return (
    <div ref={constraintsRef} className="fixed inset-0 pointer-events-none z-40">
      <AnimatePresence mode="wait">
        {mode === 'minimized' ? (
          <motion.div
            key="minimized"
            ref={panelRef}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            drag
            dragMomentum={false}
            dragElastic={0}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            style={{
              position: 'absolute',
              left: position.x,
              top: position.y,
            }}
            className="pointer-events-auto cursor-grab active:cursor-grabbing"
          >
            <motion.button
              onClick={() => handleModeChange('full')}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              className={`
                relative w-12 h-12 rounded-full 
                border-2 backdrop-blur-md shadow-lg
                flex items-center justify-center
                transition-colors duration-200
                ${hasUnread 
                  ? 'bg-emerald-900/80 border-emerald-400 shadow-emerald-500/30' 
                  : 'bg-slate-900/80 border-slate-600 shadow-slate-500/20'
                }
                ${isDragging ? 'ring-2 ring-emerald-400/50' : ''}
              `}
            >
              <Radio 
                size={20} 
                className={hasUnread ? 'text-emerald-300 animate-pulse' : 'text-slate-300'} 
              />
              
              {hasUnread && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border border-red-300"
                />
              )}

              {logLines.length > 0 && (
                <span className="absolute -bottom-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-slate-800 border border-slate-600 text-[10px] text-slate-300 flex items-center justify-center">
                  {logLines.length > 99 ? '99+' : logLines.length}
                </span>
              )}
            </motion.button>

            {isDragging && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 rounded bg-slate-900/90 border border-slate-600 text-[10px] text-slate-300 whitespace-nowrap">
                拖动以移动位置
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="full"
            ref={panelRef}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            drag
            dragMomentum={false}
            dragElastic={0}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            style={{
              position: 'absolute',
              left: position.x,
              top: position.y,
            }}
            className="pointer-events-auto"
          >
            <div 
              className={`
                w-[320px] rounded-xl border backdrop-blur-md shadow-lg overflow-hidden
                ${isDragging ? 'ring-2 ring-emerald-400/50' : ''}
                bg-black/85 border-emerald-700/45 shadow-[0_0_20px_rgba(16,185,129,0.10)]
              `}
            >
              <div 
                className="flex items-center justify-between px-3 py-2 border-b border-emerald-900/30 cursor-grab active:cursor-grabbing"
                onPointerDown={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-2">
                  <GripVertical size={14} className="text-slate-500" />
                  <span className="text-[10px] uppercase tracking-[0.18em] text-emerald-300/80 font-medium">
                    黑匣子 / Vox-Log
                  </span>
                </div>
                
                <div className="flex items-center gap-1">
                  <motion.button
                    onClick={() => handleModeChange('minimized')}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    className="p-1 rounded hover:bg-slate-700/50 text-slate-400 hover:text-slate-200 transition-colors"
                    title="最小化"
                  >
                    <Minimize2 size={14} />
                  </motion.button>
                </div>
              </div>

              <div 
                className="px-3 py-2 max-h-40 overflow-y-auto font-mono text-[11px] leading-5 text-emerald-100/95 space-y-0.5 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent"
                style={{ scrollbarWidth: 'thin' }}
              >
                {logLines.slice(-maxVisibleLines).map((line, idx) => (
                  <motion.div
                    key={`vox-${idx}-${line}`}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    className="truncate hover:text-emerald-50 transition-colors"
                    title={line}
                  >
                    <span className="text-emerald-500/60 mr-1">›</span>
                    {line}
                  </motion.div>
                ))}
              </div>

              {logLines.length > maxVisibleLines && (
                <div className="px-3 py-1.5 border-t border-emerald-900/30 text-[10px] text-slate-500 flex justify-between items-center">
                  <span>显示最近 {maxVisibleLines} 条</span>
                  <span className="text-emerald-400">{logLines.length} 条记录</span>
                </div>
              )}

              {isDragging && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 rounded bg-slate-900/90 border border-slate-600 text-[10px] text-slate-300 whitespace-nowrap">
                  松开以放置
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default VoxLogPanel;
