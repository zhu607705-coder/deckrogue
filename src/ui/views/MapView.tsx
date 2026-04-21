import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GameEngine, MapNode } from '@/core';
import type { RenderModel } from '@/runtimeV2';
import { Eye, ZoomIn, ZoomOut, Maximize2, Skull, Flame } from 'lucide-react';
import { MapIcon } from '@/ui/components/MapIcon';
import { BackgroundVisualMode, getMapBackgroundTuning } from '@/ui/components/backgroundVisuals';
import { grimdarkNodeToneClasses } from '@/ui/theme';
import worldLoreData from '@/content/data/worldLore.json';

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.0;
const ZOOM_STEP = 0.1;
const WORLD_LORE = worldLoreData as any;

const nodeTypeNames: Record<string, string> = {
  Combat: '遭遇战',
  Elite: '异端头目',
  Event: '亚空间异动',
  Shop: '行商浪人',
  Rest: '国教神龛',
  Boss: '大魔降世'
};

export function MapView({
  engine,
  renderModel,
  backgroundVisualMode = 'balanced'
}: {
  engine: GameEngine;
  renderModel?: RenderModel | null;
  backgroundVisualMode?: BackgroundVisualMode;
}) {
  const map = engine.state.map;
  const intel = engine.state.player.intel;
  const currentNodeId = renderModel?.map.currentNodeId ?? engine.state.currentNodeId;

  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragStartOffset, setDragStartOffset] = useState({ x: 0, y: 0 });
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const lastAutoCenterKeyRef = useRef<string | null>(null);
  const bgTuning = getMapBackgroundTuning(backgroundVisualMode);

  const getTypeStyles = (type: string) => grimdarkNodeToneClasses[type as keyof typeof grimdarkNodeToneClasses] || grimdarkNodeToneClasses.default;

  const floors: MapNode[][] = [];
  map.forEach(node => {
    if (!floors[node.y]) floors[node.y] = [];
    floors[node.y].push(node);
  });

  const isNodeSelectable = (node: MapNode) => {
    if (engine.state.pendingNodeResolution) return false;
    if (renderModel) {
      return renderModel.map.availableNodeIds.includes(node.id);
    }
    if (!currentNodeId) return node.y === 0;
    const currentNode = map.find(n => n.id === currentNodeId);
    return currentNode?.next.includes(node.id) ?? false;
  };

  const currentY = renderModel?.map.currentFloor ? renderModel.map.currentFloor - 1 : map.find(n => n.id === currentNodeId)?.y ?? -1;
  const totalFloors = Math.max(...map.map(n => n.y)) + 1;
  const totalFloorSpan = Math.max(1, totalFloors - 1);
  const floorLabel = currentNodeId ? `扇区深度 ${currentY + 1}` : '空投区 (降落阶段)';
  const selectableNodeIds = (renderModel?.map.availableNodeIds ?? map.filter(isNodeSelectable).slice(0, 10).map((node) => node.id)).slice(0, 10);
  const mapAtmosphere = WORLD_LORE?.viewAtmosphere?.Map || '';
  const currentNodeType = currentNodeId ? map.find(n => n.id === currentNodeId)?.type : null;
  const currentEnvironmentDescription = currentNodeType
    ? (WORLD_LORE?.nodeDescriptions?.[currentNodeType] || '')
    : (WORLD_LORE?.nodeDescriptions?.Combat || '');

  const zoomIn = useCallback(() => {
    setZoom(z => Math.min(MAX_ZOOM, z + ZOOM_STEP));
  }, []);

  const zoomOut = useCallback(() => {
    setZoom(z => Math.max(MIN_ZOOM, z - ZOOM_STEP));
  }, []);

  const resetView = useCallback(() => {
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    setZoom(z => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z + delta)));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setDragStartOffset({ x: panOffset.x, y: panOffset.y });
  }, [panOffset]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    setPanOffset({
      x: dragStartOffset.x + dx,
      y: dragStartOffset.y + dy
    });
  }, [isDragging, dragStart, dragStartOffset]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
      setDragStartOffset({ x: panOffset.x, y: panOffset.y });
    }
  }, [panOffset]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - dragStart.x;
    const dy = e.touches[0].clientY - dragStart.y;
    setPanOffset({
      x: dragStartOffset.x + dx,
      y: dragStartOffset.y + dy
    });
  }, [isDragging, dragStart, dragStartOffset]);

  const containerStyle: React.CSSProperties = {
    transform: `scale(${zoom}) translate(${panOffset.x / zoom}px, ${panOffset.y / zoom}px)`,
    transformOrigin: 'center center',
    transition: isDragging ? 'none' : 'transform 0.1s ease-out',
    cursor: isDragging ? 'grabbing' : 'grab'
  };

  useEffect(() => {
    if (!mapContainerRef.current) return;
    const autoCenterKey = currentNodeId || 'start';
    if (lastAutoCenterKeyRef.current === autoCenterKey) return;

    const raf = window.requestAnimationFrame(() => {
      const container = mapContainerRef.current;
      if (!container) return;

      const selector = currentNodeId
        ? `button[data-node-id="${currentNodeId}"]`
        : 'button[data-floor="0"]';
      const target = container.querySelector(selector) as HTMLElement | null;
      if (!target) return;

      const containerRect = container.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const targetCenterX = targetRect.left + targetRect.width / 2;
      const targetCenterY = targetRect.top + targetRect.height / 2;
      const desiredCenterX = containerRect.left + containerRect.width / 2;
      const desiredCenterY = containerRect.top + containerRect.height * 0.64;

      setPanOffset(prev => ({
        x: prev.x + (desiredCenterX - targetCenterX),
        y: prev.y + (desiredCenterY - targetCenterY)
      }));
      lastAutoCenterKeyRef.current = autoCenterKey;
    });

    return () => window.cancelAnimationFrame(raf);
  }, [currentNodeId, map.length]);

  return (
    <div className="grimdark-terminal-screen campaign-shell flex flex-col h-full text-[#d4d4d8]">
      <div className="absolute inset-0 pointer-events-none">
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: 'url("/assets/backgrounds/bg_gemini_map.png")',
            opacity: bgTuning.geminiOpacity,
            filter: bgTuning.geminiFilter
          }}
        />
        <div
          className="absolute inset-0 bg-cover bg-center pointer-events-none"
          style={{
            backgroundImage: 'url("/assets/backgrounds/bg_gothic_battlefield.png")',
            opacity: bgTuning.overlayOpacity,
            mixBlendMode: 'screen'
          }}
        />
        <div className="absolute inset-0 grimdark-cogitator-shell" />
        <div className={`absolute inset-0 bg-gradient-to-b ${bgTuning.gradient}`} />
        <div className="absolute inset-0 grimdark-crt-overlay" />
        <div className="absolute inset-0 shadow-[inset_0_0_150px_rgba(0,0,0,0.92)]" />
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-[#7f1d1d]/16 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-[#4c1d95]/16 rounded-full blur-[120px]" />
        <div 
          className={`absolute inset-0 pointer-events-none ${bgTuning.noiseOpacityClass}`}
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.05'/%3E%3C/svg%3E")`,
          }}
        />
      </div>

      <div className="grimdark-terminal-topbar relative z-10 flex items-center justify-between px-8 py-4">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <Skull size={28} className="text-[#b45309]" />
            <div>
              <div className="campaign-kicker">Ordo Hereticus - Active Sector</div>
              <h1 className="campaign-title text-2xl font-black text-stone-100">全面净化指令</h1>
            </div>
          </div>
          <div className="grimdark-terminal-divider h-10" />
          <div>
            <div className="text-sm tracking-widest text-[#a1a1aa] uppercase">
              {currentNodeId ? (
                <>
                  深度进度: <span className="text-[#ef4444] font-bold text-lg">{currentY + 1}</span> / {totalFloors}
                </>
              ) : (
                <span className="text-[#ef4444] font-bold">{floorLabel}</span>
              )}
            </div>
            <div className="grimdark-terminal-copy max-w-[620px] text-xs leading-5 mt-1">
              {currentEnvironmentDescription}
            </div>
          </div>
        </div>

        <div className="grimdark-terminal-sensor flex items-center gap-3 px-4 py-2">
          <Eye size={16} className="text-[#10b981] animate-pulse" />
          <span className="grimdark-terminal-sensor-label text-xs">鸟卜仪扫描:</span>
          <span className="grimdark-terminal-sensor-value text-lg font-bold">{intel}</span>
        </div>
      </div>

      <div className="absolute top-24 right-4 z-20 flex flex-col gap-2">
        <div className="grimdark-control-panel rounded-sm overflow-hidden backdrop-blur-sm">
          <button
            onClick={zoomIn}
            disabled={zoom >= MAX_ZOOM}
            className="grimdark-control-btn p-2 flex items-center justify-center"
            title="放大"
            data-keyboard-focus="true"
          >
            <ZoomIn size={20} />
          </button>
          <div className="grimdark-control-separator" />
          <div className="grimdark-control-meter px-2 py-1 text-xs text-center">
            {Math.round(zoom * 100)}%
          </div>
          <div className="grimdark-control-separator" />
          <button
            onClick={zoomOut}
            disabled={zoom <= MIN_ZOOM}
            className="grimdark-control-btn p-2 flex items-center justify-center"
            title="缩小"
            data-keyboard-focus="true"
          >
            <ZoomOut size={20} />
          </button>
        </div>
        <button
          onClick={resetView}
          className="grimdark-control-panel grimdark-control-btn p-2 rounded-sm backdrop-blur-sm"
          title="重置视图"
          data-keyboard-focus="true"
        >
          <Maximize2 size={20} />
        </button>
        <div className="grimdark-control-caption text-[10px] text-center mt-1">
          Cogitator Zoom
        </div>
      </div>

      {mapAtmosphere && (
        <div className="relative z-10 px-8 pt-3 text-center">
          <div className="grimdark-terminal-atmosphere mx-auto max-w-5xl rounded-sm px-4 py-2 text-xs leading-5">
            {mapAtmosphere}
          </div>
        </div>
      )}

      <div 
        ref={mapContainerRef}
        className="flex-1 overflow-hidden relative z-10"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleMouseUp}
      >
        <div 
          className="flex flex-col-reverse gap-12 items-center w-full max-w-4xl mx-auto relative py-8"
          style={containerStyle}
        >
          <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
            <defs>
              <filter id="glow">
                <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
            {map.map(node => {
              return node.next.map(nextId => {
                const nextNode = map.find(n => n.id === nextId);
                if (!nextNode) return null;
                
                const isPathActive = currentNodeId === node.id && isNodeSelectable(nextNode);
                const isPathTaken = node.y < currentY;

                return (
                  <line
                    key={`${node.id}-${nextId}`}
                    x1={`${node.x * 100}%`}
                    y1={`${100 - (node.y / totalFloorSpan) * 100}%`}
                    x2={`${nextNode.x * 100}%`}
                    y2={`${100 - (nextNode.y / totalFloorSpan) * 100}%`}
                    stroke={isPathActive ? '#ef4444' : isPathTaken ? '#57534e' : '#78716c'}
                    strokeWidth={isPathActive ? 4 : isPathTaken ? 2.5 : 2}
                    strokeDasharray={isPathActive ? 'none' : isPathTaken ? '3 4' : '8 5'}
                    strokeLinecap="round"
                    filter={isPathActive ? 'url(#glow)' : 'none'}
                    opacity={isPathActive ? 0.95 : isPathTaken ? 0.7 : 0.5}
                  />
                );
              });
            })}
          </svg>

          {floors.map((floor, y) => (
            <div key={y} className="flex justify-between w-full relative z-10 px-8" style={{ minHeight: '94px' }}>
              {floor.map(node => {
                const isCurrent = currentNodeId === node.id;
                const isSelectable = isNodeSelectable(node);
                const isPast = node.y < currentY;
                const typeName = nodeTypeNames[node.type] || node.type;
                const styles = getTypeStyles(node.type);
                const nodeStateClass = isCurrent
                  ? 'grimdark-node-card--current'
                  : isPast
                    ? 'grimdark-node-card--past'
                    : isSelectable
                      ? 'grimdark-node-card--selectable'
                      : '';
                const unknownClass = !node.revealed ? 'grimdark-node-card--unknown' : '';
                const nodeCursorClass = isSelectable ? 'cursor-pointer' : isPast ? 'cursor-default' : 'cursor-not-allowed';

                return (
                  <div 
                    key={node.id} 
                    className="absolute transform -translate-x-1/2 flex flex-col items-center"
                    style={{ left: `${node.x * 100}%`, top: '50%', transform: 'translate(-50%, -50%)' }}
                  >
                    <button
                      onClick={() => isSelectable && engine.enterNode(node.id)}
                      disabled={!isSelectable}
                      data-node-id={node.id}
                      data-floor={node.y}
                      data-keyboard-focus="true"
                      data-keyboard-option={isSelectable ? String(selectableNodeIds.indexOf(node.id) + 1) : undefined}
                      className={`grimdark-node-card ${styles.tone} ${nodeStateClass} ${unknownClass} ${nodeCursorClass} w-28 min-h-[90px] px-2.5 py-2.5 flex flex-col items-center justify-center gap-2`}
                    >
                      {node.revealed ? (
                        <>
                          <div className={`grimdark-node-card__iconFrame ${styles.icon} w-10 h-10 flex items-center justify-center overflow-hidden`}>
                            <MapIcon
                              type={node.type}
                              alt={typeName}
                              className="w-8 h-8 object-contain"
                            />
                          </div>
                          <span className="text-[10px] font-bold tracking-wide text-center leading-tight uppercase">{typeName}</span>
                        </>
                      ) : (
                        <>
                          <div className="grimdark-node-card__iconFrame grimdark-node-card__iconFrame--unknown w-10 h-10 flex items-center justify-center">
                            <svg
                              viewBox="0 0 24 24"
                              className="w-7 h-7 text-[#d4d4d8]"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-label="未探明区域"
                            >
                              <path d="M9.1 9a3 3 0 1 1 5.2 2c-.7.8-1.5 1.2-2 1.9-.3.4-.4.8-.4 1.6" />
                              <circle cx="12" cy="17.3" r="0.8" fill="currentColor" stroke="none" />
                              <circle cx="12" cy="12" r="9.2" opacity="0.25" />
                            </svg>
                          </div>
                          <span className="grimdark-node-card__unknownLabel">未探明</span>
                        </>
                      )}
                    </button>

                    {isCurrent && (
                      <div className="grimdark-node-current-tag mt-2 px-3 py-1 text-[10px] font-bold rounded-none animate-pulse">
                        所在坐标
                      </div>
                    )}

                    {!node.revealed && intel > 0 && isSelectable && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); engine.revealNode(node.id); }}
                        className="grimdark-node-reveal-btn absolute -bottom-12 text-[10px] font-medium flex items-center gap-1.5 px-3 py-1.5 rounded-none transition-all"
                        data-keyboard-focus="true"
                      >
                        <Eye size={12} />
                        启动侦测
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="relative z-10 px-8 py-4 bg-gradient-to-t from-stone-950/90 to-transparent border-t border-stone-800/50">
        <div className="mb-3 flex flex-wrap justify-center items-center gap-4 text-[11px] text-[#a1a1aa]">
          <div className="flex items-center gap-2">
            <svg width="34" height="10" viewBox="0 0 34 10" className="opacity-90">
              <line x1="1" y1="5" x2="33" y2="5" stroke="#b45309" strokeWidth="3" strokeLinecap="round" />
            </svg>
            审判路线
          </div>
          <div className="flex items-center gap-2">
            <svg width="34" height="10" viewBox="0 0 34 10" className="opacity-90">
              <line x1="1" y1="5" x2="33" y2="5" stroke="#57534e" strokeWidth="2.5" strokeDasharray="3 4" strokeLinecap="round" />
            </svg>
            已净化路线
          </div>
          <div className="flex items-center gap-2">
            <svg width="34" height="10" viewBox="0 0 34 10" className="opacity-90">
              <line x1="1" y1="5" x2="33" y2="5" stroke="#78716c" strokeWidth="2" strokeDasharray="8 5" strokeLinecap="round" />
            </svg>
            未知区域
          </div>
        </div>
        <div className="flex justify-center gap-6 text-xs flex-wrap">
          <div className="flex items-center gap-2 text-[#ef4444]">
            <div className="w-6 h-6 bg-stone-800 rounded flex items-center justify-center overflow-hidden border border-red-700">
              <MapIcon type="Combat" alt="战斗" className="w-4 h-4 object-contain" />
            </div>
            遭遇战
          </div>
          <div className="flex items-center gap-2 text-[#f59e0b]">
            <div className="w-6 h-6 bg-stone-800 rounded flex items-center justify-center overflow-hidden border border-amber-700">
              <MapIcon type="Elite" alt="精英战" className="w-4 h-4 object-contain" />
            </div>
            异端头目
          </div>
          <div className="flex items-center gap-2 text-[#a855f7]">
            <div className="w-6 h-6 bg-stone-800 rounded flex items-center justify-center overflow-hidden border border-purple-700">
              <MapIcon type="Event" alt="事件" className="w-4 h-4 object-contain" />
            </div>
            亚空间异动
          </div>
          <div className="flex items-center gap-2 text-[#38bdf8]">
            <div className="w-6 h-6 bg-stone-800 rounded flex items-center justify-center overflow-hidden border border-yellow-700">
              <MapIcon type="Shop" alt="商人" className="w-4 h-4 object-contain" />
            </div>
            行商浪人
          </div>
          <div className="flex items-center gap-2 text-[#fbbf24]">
            <div className="w-6 h-6 bg-stone-800 rounded flex items-center justify-center overflow-hidden border border-orange-700">
              <MapIcon type="Rest" alt="篝火" className="w-4 h-4 object-contain" />
            </div>
            国教神龛
          </div>
          <div className="flex items-center gap-2 text-[#ef4444]">
            <div className="w-6 h-6 bg-stone-800 rounded flex items-center justify-center overflow-hidden border border-red-800">
              <MapIcon type="Boss" alt="领主" className="w-4 h-4 object-contain" />
            </div>
            大魔降世
          </div>
        </div>
        <div className="mt-3 flex items-center justify-center gap-2 text-[10px] uppercase tracking-[0.2em] text-[#71717a]">
          <Flame size={12} className="text-[#b45309]" />
          Cogitator Tactical Overlay Active
        </div>
      </div>
    </div>
  );
}
