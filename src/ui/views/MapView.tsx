/**
 * @file MapView.tsx
 * @description 地图视图组件 - 显示游戏地图并允许玩家导航
 *
 * 主要职责:
 * - 渲染地图节点 (战斗/精英/Boss/商店/休息/事件)
 * - 处理节点点击和导航
 * - 地图缩放和平移
 * - 显示当前节点和可达节点
 * - 迷雾系统 (未揭示的节点显示为迷雾)
 * - 路线信号和路线状态可视化
 */
import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { GameEngine, MapNode } from '@/core';
import type { RenderModel } from '@/runtimeV2';
import { ArrowRight, BadgeInfo, Eye, Flame, MapPinned, Maximize2, Route, Skull, ZoomIn, ZoomOut } from 'lucide-react';
import { MapIcon } from '@/ui/components/MapIcon';
import { BackgroundVisualMode, getMapBackgroundTuning } from '@/ui/components/backgroundVisuals';
import { grimdarkNodeToneClasses } from '@/ui/theme';
import { uiWorldLore } from '@/ui/content/worldLore';
import { buildRouteDossiers } from '@/ui/views/mapRouteAdvisor';

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.0;
const ZOOM_STEP = 0.1;
const WORLD_LORE = uiWorldLore as any;

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
  const map = (renderModel?.map.nodes.length ? renderModel.map.nodes : engine.state.map) as MapNode[];
  const pendingNodeResolution = renderModel?.lifecycle?.pendingNodeResolution ?? engine.state.pendingNodeResolution;
  const intel = renderModel?.player?.intel ?? engine.state.player.intel;
  const currentNodeId = renderModel?.map.currentNodeId ?? engine.state.currentNodeId;

  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragStartOffset, setDragStartOffset] = useState({ x: 0, y: 0 });
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const lastAutoCenterKeyRef = useRef<string | null>(null);
  const bgTuning = getMapBackgroundTuning(backgroundVisualMode);

  const getTypeStyles = (type: string) => grimdarkNodeToneClasses[type as keyof typeof grimdarkNodeToneClasses] ?? grimdarkNodeToneClasses.default;

  const floors: MapNode[][] = map.reduce((acc, node) => {
    if (!acc[node.y]) acc[node.y] = [];
    acc[node.y].push(node);
    return acc;
  }, [] as MapNode[][]);

  const isNodeSelectable = (node: MapNode) => {
    if (pendingNodeResolution) return false;
    if (renderModel) {
      return renderModel.map.availableNodeIds.includes(node.id);
    }
    if (!currentNodeId) return node.y === 0;
    const currentNode = map.find(n => n.id === currentNodeId);
    return currentNode?.next.includes(node.id) ?? false;
  };

  const currentY = renderModel?.map.currentFloor ? renderModel.map.currentFloor - 1 : map.find(n => n.id === currentNodeId)?.y ?? -1;
  const maxFloorIndex = map.length > 0 ? Math.max(...map.map(n => n.y)) : 0;
  const totalFloors = maxFloorIndex + 1;
  const totalFloorSpan = Math.max(1, totalFloors - 1);
  const floorLabel = currentNodeId ? `扇区深度 ${currentY + 1}` : '空投区 (降落阶段)';
  const selectableNodeIds = (renderModel?.map.availableNodeIds ?? map.filter(isNodeSelectable).slice(0, 10).map((node) => node.id)).slice(0, 10);
  const mapAtmosphere = WORLD_LORE?.viewAtmosphere?.Map || '';
  const currentNodeType = currentNodeId ? map.find(n => n.id === currentNodeId)?.type : null;
  const currentEnvironmentDescription = currentNodeType
    ? (WORLD_LORE?.nodeDescriptions?.[currentNodeType] || '')
    : (WORLD_LORE?.nodeDescriptions?.Combat || '');

  const progressPercent = totalFloors > 0 ? ((currentY + 1) / totalFloors) * 100 : 0;
  const totalNodes = map.length;
  const pastNodes = map.filter(n => n.y < currentY).length;
  const bossFloor = map.find(n => n.type === 'Boss')?.y ?? totalFloors - 1;
  const floorsToBoss = Math.max(0, bossFloor - currentY);
  const playerHp = renderModel?.player?.hp ?? engine.state.player.hp;
  const playerMaxHp = renderModel?.player?.maxHp ?? engine.state.player.maxHp;
  const playerEnergy = renderModel?.player?.energy ?? engine.state.player.energy;
  const playerMaxEnergy = renderModel?.player?.maxEnergy ?? engine.state.player.maxEnergy;
  const playerRelics = renderModel?.player?.relicCount ?? engine.state.player.relics?.length ?? 0;
  const deckSize = renderModel?.player?.deckCount ?? engine.state.player.deck?.length ?? 0;
  const routeCharacterId = renderModel?.player?.characterId ?? engine.state.character?.id;
  const routeDossiers = useMemo(() => buildRouteDossiers(map, selectableNodeIds, {
    hp: playerHp,
    maxHp: playerMaxHp,
    intel,
    relicCount: playerRelics,
    characterId: routeCharacterId,
  }), [map, selectableNodeIds, playerHp, playerMaxHp, intel, playerRelics, routeCharacterId]);
  const routeDossierById = useMemo(
    () => new Map(routeDossiers.map((dossier) => [dossier.nodeId, dossier])),
    [routeDossiers]
  );
  const currentNode = currentNodeId ? map.find((node) => node.id === currentNodeId) ?? null : null;
  const hoveredNode = hoveredNodeId ? map.find((node) => node.id === hoveredNodeId) ?? null : null;
  const hudNode = hoveredNode ?? currentNode;
  const hudDossier = hudNode ? routeDossierById.get(hudNode.id) ?? null : null;
  const currentNodeLabel = currentNode
    ? `${nodeTypeNames[currentNode.type] || currentNode.type} · 第 ${currentNode.y + 1} 层`
    : '待部署';
  const patrolStateLabel = pendingNodeResolution
    ? '巡逻结算中'
    : currentNode
      ? '巡逻推进中'
      : '等待登陆';
  const routeHintLabel = currentNode
    ? currentNode.next
        .map((nextId) => map.find((node) => node.id === nextId))
        .filter((node): node is MapNode => !!node)
        .slice(0, 3)
        .map((node) => nodeTypeNames[node.type] || node.type)
        .join(' / ') || '终点锁定'
    : '从首层节点开始巡逻';
  const operationFeedback = hoveredNode
    ? `已预览 ${nodeTypeNames[hoveredNode.type] || hoveredNode.type} 节点`
    : currentNode
      ? `当前可选 ${selectableNodeIds.length} 条路线`
      : '悬停节点可查看路线情报';

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

  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
      setZoom(z => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z + delta)));
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
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
    cursor: isDragging ? 'grabbing' : 'grab',
    willChange: 'transform'
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
    <div className="grimdark-terminal-screen grimdark-map-screen campaign-shell flex flex-col h-full text-[#d4d4d8]" data-screen="Map">
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

      <div className="grimdark-terminal-topbar relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between px-4 md:px-8 py-3 md:py-4 gap-4">
        <div className="flex items-center gap-6 flex-1">
          <div className="flex items-center gap-3">
            <Skull size={28} className="text-[#b45309]" />
            <div>
              <div className="campaign-kicker">Ordo Hereticus - Active Sector</div>
              <h1 className="campaign-title text-2xl font-black text-stone-100">全面净化指令</h1>
            </div>
          </div>
          <div className="grimdark-terminal-divider h-10" />
          <div className="flex-1 max-w-md">
            <div className="flex items-center justify-between mb-2">
              <div className="grimdark-progress-label">
                深度进度
              </div>
              <div className="grimdark-progress-text">
                {currentY + 1} / {totalFloors}
              </div>
            </div>
            <div className="grimdark-progress-bar mb-2">
              <div
                className="grimdark-progress-fill"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="text-xs text-[#a1a1aa]">
                📍 已净化: <span className="text-[#fbbf24] font-bold">{pastNodes}</span> / {totalNodes} 节点
              </div>
              {floorsToBoss > 0 && (
                <div className="grimdark-boss-warning">
                  👑 Boss 战: 剩余 {floorsToBoss} 层
                </div>
              )}
              {floorsToBoss === 0 && currentNodeId && (
                <div className="grimdark-boss-warning">
                  ⚔️ Boss 战准备就绪
                </div>
              )}
            </div>
            <div className="grimdark-terminal-copy max-w-[620px] text-xs leading-5 mt-2">
              {currentEnvironmentDescription}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="grimdark-resource-card">
            <div className="grimdark-resource-title">
              ⚙️ 资源概览
            </div>
            <div className="grimdark-resource-row">
              <span className="grimdark-resource-icon">❤️</span>
              <span className="grimdark-resource-label">生命值</span>
              <span className="grimdark-resource-value">{playerHp}/{playerMaxHp}</span>
            </div>
            <div className="grimdark-resource-row">
              <span className="grimdark-resource-icon">⚡</span>
              <span className="grimdark-resource-label">能量</span>
              <span className="grimdark-resource-value">{playerEnergy}/{playerMaxEnergy}</span>
            </div>
            <div className="grimdark-resource-row">
              <span className="grimdark-resource-icon">🏺</span>
              <span className="grimdark-resource-label">遗物</span>
              <span className="grimdark-resource-value">{playerRelics}</span>
            </div>
            <div className="grimdark-resource-row">
              <span className="grimdark-resource-icon">🃏</span>
              <span className="grimdark-resource-label">牌库</span>
              <span className="grimdark-resource-value">{deckSize}</span>
            </div>
          </div>

          <div className="grimdark-terminal-sensor flex items-center gap-3 px-4 py-2">
            <Eye size={16} className="text-[#10b981] animate-pulse" />
            <span className="grimdark-terminal-sensor-label text-xs">鸟卜仪扫描:</span>
            <span className="grimdark-terminal-sensor-value text-lg font-bold">{intel}</span>
          </div>
        </div>
      </div>

      <div className="grimdark-map-controls absolute top-24 right-4 z-20 flex flex-col gap-2">
        <div className="grimdark-control-panel rounded-sm overflow-hidden backdrop-blur-sm">
          <button
            onClick={zoomIn}
            disabled={zoom >= MAX_ZOOM}
            className="grimdark-control-btn p-2 flex items-center justify-center transition-all duration-200 hover:bg-stone-700/50 active:scale-95 focus:ring-2 focus:ring-amber-500/50"
            title="放大"
            aria-label="放大地图"
            data-keyboard-focus="true"
          >
            <ZoomIn size={20} aria-hidden="true" />
          </button>
          <div className="grimdark-control-separator" />
          <div className="grimdark-control-meter px-2 py-1 text-xs text-center">
            {Math.round(zoom * 100)}%
          </div>
          <div className="grimdark-control-separator" />
          <button
            onClick={zoomOut}
            disabled={zoom <= MIN_ZOOM}
            className="grimdark-control-btn p-2 flex items-center justify-center transition-all duration-200 hover:bg-stone-700/50 active:scale-95 focus:ring-2 focus:ring-amber-500/50"
            title="缩小"
            aria-label="缩小地图"
            data-keyboard-focus="true"
          >
            <ZoomOut size={20} aria-hidden="true" />
          </button>
        </div>
        <button
          onClick={resetView}
          className="grimdark-control-panel grimdark-control-btn map-reset-view-btn p-2 rounded-sm backdrop-blur-sm transition-all duration-200 hover:bg-stone-700/50 active:scale-95 focus:ring-2 focus:ring-amber-500/50"
          title="重置视图"
          aria-label="重置地图视图"
          data-keyboard-focus="true"
        >
          <Maximize2 size={20} aria-hidden="true" />
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

      <div className="relative z-10 px-4 md:px-8 pt-3">
        <div className="grimdark-map-hud mx-auto grid gap-3 lg:grid-cols-[1.15fr_0.9fr_0.95fr_1.1fr]">
          <div className="grimdark-map-hud__tile">
            <div className="grimdark-map-hud__head">
              <MapPinned size={14} aria-hidden="true" />
              <span>当前节点</span>
            </div>
            <div className="grimdark-map-hud__value">{currentNodeLabel}</div>
            <div className="grimdark-map-hud__subtle">{hudDossier?.title || currentEnvironmentDescription || '巡逻态势未完全展开'}</div>
          </div>
          <div className="grimdark-map-hud__tile">
            <div className="grimdark-map-hud__head">
              <Route size={14} aria-hidden="true" />
              <span>巡逻状态</span>
            </div>
            <div className="grimdark-map-hud__value">{patrolStateLabel}</div>
            <div className="grimdark-map-hud__subtle">{hudDossier?.fitLabel || floorLabel}</div>
          </div>
          <div className="grimdark-map-hud__tile">
            <div className="grimdark-map-hud__head">
              <ArrowRight size={14} aria-hidden="true" />
              <span>路径提示</span>
            </div>
            <div className="grimdark-map-hud__value">{routeHintLabel}</div>
            <div className="grimdark-map-hud__subtle">{hudDossier?.summary || '未收集到完整路线情报'}</div>
          </div>
          <div className="grimdark-map-hud__tile grimdark-map-hud__tile--accent">
            <div className="grimdark-map-hud__head">
              <BadgeInfo size={14} aria-hidden="true" />
              <span>操作反馈</span>
            </div>
            <div className="grimdark-map-hud__value">{operationFeedback}</div>
            <div className="grimdark-map-hud__subtle">{hudDossier?.challengeLabel || currentEnvironmentDescription || '移动光标查看节点回应'}</div>
          </div>
        </div>
      </div>

      <div
        ref={mapContainerRef}
        className="grimdark-map-node-stage flex-1 overflow-hidden relative z-10"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleMouseUp}
      >
        <div
            className="grimdark-map-node-stack flex flex-col-reverse gap-8 md:gap-12 items-center w-full max-w-4xl mx-auto relative py-6 md:py-8"
            style={containerStyle}
          >
          <svg className="grimdark-map-paths absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
            <defs>
              <filter id="glow">
                <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
              <filter id="path-glow-strong">
                <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
              <marker id="grimdark-path-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="strokeWidth">
                <path d="M0 0 L8 4 L0 8 z" fill="#b45309" opacity="0.9" />
              </marker>
              <marker id="grimdark-path-arrow-highlight" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto" markerUnits="strokeWidth">
                <path d="M0 0 L9 4.5 L0 9 z" fill="#fbbf24" opacity="0.95" />
              </marker>
            </defs>
            {map.map(node => {
              return node.next.map(nextId => {
                const nextNode = map.find(n => n.id === nextId);
                if (!nextNode) return null;

                const isPathActive = currentNodeId === node.id && isNodeSelectable(nextNode);
                const isPathTaken = node.y < currentY;
                const isPathHighlighted =
                  (hoveredNodeId === nextNode.id && isPathActive) ||
                  (hoveredNodeId === node.id && currentNodeId === node.id) ||
                  (hoveredNodeId === nextNode.id && currentNodeId === node.id);

                const pathStroke = isPathHighlighted
                  ? '#fbbf24'
                  : isPathActive
                    ? '#ef4444'
                    : isPathTaken
                      ? '#57534e'
                      : '#78716c';

                const pathWidth = isPathHighlighted
                  ? 6
                  : isPathActive
                    ? 4
                    : isPathTaken
                      ? 2.5
                      : 2;
                const pathMarker = isPathHighlighted
                  ? 'url(#grimdark-path-arrow-highlight)'
                  : isPathActive
                    ? 'url(#grimdark-path-arrow)'
                    : undefined;
                const pathDashArray = isPathHighlighted
                  ? '10 8'
                  : isPathActive
                    ? '14 10'
                    : isPathTaken
                      ? '3 4'
                      : '8 5';

                return (
                  <g key={`${node.id}-${nextId}`}>
                    <line
                      x1={`${node.x * 100}%`}
                      y1={`${100 - (node.y / totalFloorSpan) * 100}%`}
                      x2={`${nextNode.x * 100}%`}
                      y2={`${100 - (nextNode.y / totalFloorSpan) * 100}%`}
                      stroke={isPathHighlighted ? '#fbbf24' : isPathActive ? '#ef4444' : pathStroke}
                      strokeWidth={isPathHighlighted ? pathWidth + 6 : isPathActive ? pathWidth + 4 : pathWidth + 2}
                      strokeDasharray={pathDashArray}
                      strokeLinecap="round"
                      opacity={isPathHighlighted ? 0.5 : isPathActive ? 0.4 : isPathTaken ? 0.2 : 0.15}
                      filter="blur(4px)"
                    />
                    <line
                      x1={`${node.x * 100}%`}
                      y1={`${100 - (node.y / totalFloorSpan) * 100}%`}
                      x2={`${nextNode.x * 100}%`}
                      y2={`${100 - (nextNode.y / totalFloorSpan) * 100}%`}
                      stroke={pathStroke}
                      strokeWidth={pathWidth}
                      strokeDasharray={pathDashArray}
                      strokeLinecap="round"
                      markerEnd={pathMarker}
                      filter={isPathHighlighted ? 'url(#path-glow-strong)' : isPathActive ? 'url(#glow)' : 'none'}
                      opacity={isPathHighlighted ? 1 : isPathActive ? 0.95 : isPathTaken ? 0.7 : 0.5}
                      className={`${isPathHighlighted ? 'grimdark-path-highlight' : isPathActive ? 'grimdark-path-line--active' : ''} grimdark-path-line`}
                      style={{
                        willChange: 'opacity, stroke, stroke-dashoffset'
                      }}
                    />
                    {(isPathActive || isPathHighlighted) && (
                      <circle
                        r="3"
                        fill={isPathHighlighted ? '#fbbf24' : '#ef4444'}
                        filter={isPathHighlighted ? 'url(#path-glow-strong)' : 'url(#glow)'}
                      >
                        <animateMotion
                          dur={isPathHighlighted ? '1.5s' : '2.5s'}
                          repeatCount="indefinite"
                          path={`M ${node.x * 100} ${100 - (node.y / totalFloorSpan) * 100} L ${nextNode.x * 100} ${100 - (nextNode.y / totalFloorSpan) * 100}`}
                        />
                        <animate
                          attributeName="opacity"
                          values="0;1;1;0"
                          keyTimes="0;0.1;0.9;1"
                          dur={isPathHighlighted ? '1.5s' : '2.5s'}
                          repeatCount="indefinite"
                        />
                      </circle>
                    )}
                  </g>
                );
              });
            })}
          </svg>

          {floors.map((floor, y) => (
            <div key={y} className="grimdark-map-floor flex justify-between w-full relative z-10 px-8" style={{ minHeight: '94px' }}>
              {floor.map(node => {
                const isCurrent = currentNodeId === node.id;
                const isSelectable = isNodeSelectable(node);
                const isPast = node.y < currentY;
                const isHovered = hoveredNodeId === node.id;
                const typeName = nodeTypeNames[node.type] || node.type;
                const styles = getTypeStyles(node.type);
                const dossier = routeDossierById.get(node.id);
                const nodeRouteTitle = dossier?.title || typeName;
                const nodeRouteSummary = dossier?.summary || (node.revealed ? currentEnvironmentDescription : '需要侦测');
                const nodePreviewLabels = dossier?.previewTypes
                  .slice(1)
                  .map((previewType) => nodeTypeNames[previewType] || previewType) ?? [];
                const nodeRouteMetrics = dossier
                  ? [
                      { key: 'challenge', label: '压', value: dossier.challenge, tone: 'danger', aria: `挑战压力 ${dossier.challenge}/5` },
                      { key: 'sustain', label: '补', value: dossier.sustain, tone: 'sustain', aria: `补给空间 ${dossier.sustain}/5` },
                      { key: 'mystery', label: '异', value: dossier.mystery, tone: 'mystery', aria: `异动未知 ${dossier.mystery}/5` },
                    ]
                  : [];
                const nodeStateClass = isCurrent
                  ? 'grimdark-node-card--current'
                  : isPast
                    ? 'grimdark-node-card--past'
                  : isSelectable
                      ? 'grimdark-node-card--selectable'
                      : '';
                const nodeHoverClass = isHovered ? 'grimdark-node-card--hovered' : '';
                const unknownClass = !node.revealed ? 'grimdark-node-card--unknown' : '';
                const nodeCursorClass = isSelectable ? 'cursor-pointer' : isPast ? 'cursor-default' : 'cursor-not-allowed';
                const nodeChipPrimary = isCurrent
                  ? '当前节点'
                  : isSelectable
                    ? '可选路线'
                    : isPast
                      ? '已通过'
                      : node.revealed
                        ? '已揭示'
                        : '未探明';
                const nodeChipSecondary = isCurrent
                  ? `${nodeRouteTitle} · ${nodeRouteSummary}`
                  : node.revealed
                    ? `${dossier?.challengeLabel || '巡逻'} · ${dossier?.fitLabel || '侦测完成'} · ${nodeRouteSummary}`
                    : '继续侦测';

                return (
                  <div
                    key={node.id}
                    className="grimdark-map-node-position absolute transform -translate-x-1/2 flex flex-col items-center"
                    style={{ left: `${node.x * 100}%`, top: '50%', transform: 'translate(-50%, -50%)' }}
                  >
                    <button
                      onClick={() => isSelectable && engine.enterNode(node.id)}
                      disabled={!isSelectable}
                      data-node-id={node.id}
                      data-node-type={node.type}
                      data-floor={node.y}
                      data-keyboard-focus="true"
                      data-keyboard-option={isSelectable ? String(selectableNodeIds.indexOf(node.id) + 1) : undefined}
                      onMouseEnter={() => isSelectable && setHoveredNodeId(node.id)}
                      onMouseLeave={() => setHoveredNodeId(null)}
                      className={`grimdark-node-card ${styles.tone} ${nodeStateClass} ${nodeHoverClass} ${unknownClass} ${nodeCursorClass} grimdark-node-card--enhanced w-32 min-h-[124px] px-2.5 py-2 flex flex-col items-center justify-center gap-1.5 transition-all duration-200 hover:shadow-lg hover:shadow-amber-500/20 active:scale-95 focus:ring-2 focus:ring-amber-500/50`}
                      aria-label={node.revealed ? `${typeName} - 第 ${node.y + 1} 扇区` : '未探明区域'}
                      aria-disabled={!isSelectable}

                    >
                      <div className="grimdark-node-card__statusChip">
                        <span className="grimdark-node-card__statusChipMain">{nodeChipPrimary}</span>
                        <span className="grimdark-node-card__statusChipSub">{nodeChipSecondary}</span>
                      </div>
                      {node.revealed ? (
                        <>
                          <div className={`grimdark-node-card__iconFrame ${styles.icon} w-9 h-9 flex items-center justify-center overflow-hidden`}>
                            <MapIcon
                              type={node.type}
                              alt={typeName}
                              className="w-7 h-7 object-contain"
                            />
                          </div>
                          <span className="text-[9px] font-bold tracking-wide text-center leading-tight uppercase">{typeName}</span>
                          {dossier && (
                            <div className="grimdark-node-card__routeMeta">
                              <div className="grimdark-node-card__routeMetaTitle">{nodeRouteTitle}</div>
                              <div className="grimdark-node-card__routeMetaSummary">{nodeRouteSummary}</div>
                              <div className="grimdark-node-card__routeIntel" aria-label={`路线指标：挑战 ${dossier.challenge}/5，补给 ${dossier.sustain}/5，异动 ${dossier.mystery}/5`}>
                                {nodeRouteMetrics.map((metric) => (
                                  <div
                                    key={`${node.id}-${metric.key}`}
                                    className={`grimdark-node-card__routeMetric grimdark-node-card__routeMetric--${metric.tone}`}
                                    aria-label={metric.aria}
                                  >
                                    <span className="grimdark-node-card__routeMetricLabel">{metric.label}</span>
                                    <span className="grimdark-node-card__routeMetricTrack" aria-hidden="true">
                                      {Array.from({ length: 5 }).map((_, index) => (
                                        <span
                                          key={`${node.id}-${metric.key}-${index}`}
                                          className={index < metric.value ? 'is-active' : ''}
                                        />
                                      ))}
                                    </span>
                                  </div>
                                ))}
                              </div>
                              <div className="grimdark-node-card__routePreview">
                                <span className="grimdark-node-card__routePreviewLabel">后续</span>
                                {(nodePreviewLabels.length > 0 ? nodePreviewLabels : ['终点']).slice(0, 3).map((label, index) => (
                                  <span key={`${node.id}-${label}-${index}`} className="grimdark-node-card__routePreviewChip">
                                    {label}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          <div className="grimdark-node-card__iconFrame grimdark-node-card__iconFrame--unknown w-9 h-9 flex items-center justify-center">
                            <svg
                              viewBox="0 0 24 24"
                              className="w-6 h-6 text-[#d4d4d8]"
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
                          <span className="grimdark-node-card__unknownLabel">未探明 · 继续侦测</span>
                        </>
                      )}
                    </button>

                    {hoveredNodeId === node.id && node.revealed && isSelectable && (
                      <motion.div
                        className="grimdark-node-detail-panel"
                        initial={{ scale: 0.8, opacity: 0, y: 10 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.8, opacity: 0, y: 10 }}
                        transition={{
                          type: 'spring',
                          stiffness: 400,
                          damping: 15,
                          duration: 0.3
                        }}
                      >
                        <motion.div
                          className="grimdark-node-detail-title"
                          initial={{ x: -10, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          transition={{ delay: 0.1, duration: 0.3 }}
                        >
                          {dossier?.title || typeName} - 第 {node.y + 1} 扇区
                        </motion.div>
                        <motion.div
                          className="grimdark-node-detail-row"
                          initial={{ x: -10, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          transition={{ delay: 0.15, duration: 0.3 }}
                        >
                          <span className="grimdark-node-detail-label">挑战倾向</span>
                          <span className="grimdark-node-detail-value">
                            {'★'.repeat(dossier?.challenge || 1)}
                          </span>
                        </motion.div>
                        <motion.div
                          className="grimdark-node-detail-row"
                          initial={{ x: -10, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          transition={{ delay: 0.2, duration: 0.3 }}
                        >
                          <span className="grimdark-node-detail-label">补给空间</span>
                          <span className="grimdark-node-detail-value">
                            {'★'.repeat(dossier?.sustain || 1)}
                          </span>
                        </motion.div>
                        <motion.div
                          className="grimdark-node-detail-row"
                          initial={{ x: -10, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          transition={{ delay: 0.25, duration: 0.3 }}
                        >
                          <span className="grimdark-node-detail-label">未知收益</span>
                          <span className="grimdark-node-detail-value" style={{
                            color: dossier && dossier.mystery >= 4 ? '#a855f7' : '#38bdf8'
                          }}>
                            {'★'.repeat(dossier?.mystery || 1)}
                          </span>
                        </motion.div>
                        <motion.div
                          className="grimdark-node-detail-hint"
                          initial={{ x: -10, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          transition={{ delay: 0.3, duration: 0.3 }}
                        >
                          <span className="grimdark-node-detail-hint-label">💡 提示</span>
                          {dossier?.summary || '愿誓约保佑你的征程。'}
                        </motion.div>
                      </motion.div>
                    )}

                    {isCurrent && (
                      <div className="grimdark-node-current-tag mt-2 px-3 py-1 text-[10px] font-bold rounded-none animate-pulse">
                        所在坐标
                      </div>
                    )}

                    {!node.revealed && intel > 0 && isSelectable && (
                      <button
                        onClick={(e) => { e.stopPropagation(); engine.revealNode(node.id); }}
                        className="grimdark-node-reveal-btn absolute -bottom-12 text-[10px] font-medium flex items-center gap-1.5 px-3 py-1.5 rounded-none transition-all duration-200 hover:bg-stone-700/50 active:scale-95 focus:ring-2 focus:ring-amber-500/50"
                        data-keyboard-focus="true"
                        aria-label="启动侦测，查看节点信息"
                      >
                        <Eye size={12} aria-hidden="true" />
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
