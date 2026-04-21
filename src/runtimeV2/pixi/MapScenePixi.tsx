import React, { useEffect, useRef, useCallback } from 'react';
import { Application, Container, Graphics, Rectangle, Text } from 'pixi.js';
import type { MapSceneProps } from '../sceneProps';
import {
  createDedupedPointerHandler,
  createTextStyle,
  dispatchPixiCanvasHit,
  drawRoundedRect,
  COLORS,
  publishPixiHitTargets,
  type PixiHitHandler,
} from './pixiUtils';

export interface MapScenePixiProps {
  scene: MapSceneProps;
  onEnterNode: (nodeId: string) => void;
  width?: number;
  height?: number;
}

const NODE_WIDTH = 80;
const NODE_HEIGHT = 50;
const NODE_RADIUS = 8;

function getNodeTypeColor(type: string): number {
  switch (type?.toLowerCase()) {
    case 'combat':
      return COLORS.nodeCombat;
    case 'elite':
      return COLORS.nodeElite;
    case 'boss':
      return COLORS.nodeBoss;
    case 'event':
      return COLORS.nodeEvent;
    case 'shop':
      return COLORS.nodeShop;
    case 'rest':
      return COLORS.nodeRest;
    default:
      return COLORS.nodeUnknown;
  }
}

export function MapScenePixi({
  scene,
  onEnterNode,
  width = 800,
  height = 600,
}: MapScenePixiProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const hitHandlersRef = useRef<PixiHitHandler[]>([]);

  useEffect(() => {
    if (!containerRef.current || appRef.current) {
      return;
    }

    const app = new Application();

    app.init({
      width,
      height,
      backgroundColor: COLORS.background,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    }).then(() => {
      app.stage.eventMode = 'static';
      app.stage.hitArea = app.screen;
      if (containerRef.current && app.canvas) {
        containerRef.current.appendChild(app.canvas);
        app.canvas.addEventListener('click', (event) => dispatchPixiCanvasHit(event, hitHandlersRef.current));
        appRef.current = app;
        renderMap(app);
      }
    }).catch((error) => {
      console.error('[MapScenePixi] Pixi Application init failed:', error);
    });

    return () => {
      if (appRef.current) {
        appRef.current.destroy(true, { children: true });
        appRef.current = null;
      }
    };
  }, [width, height]);

  useEffect(() => {
    if (appRef.current) {
      appRef.current.renderer.resize(width, height);
      renderMap(appRef.current);
    }
  }, [width, height, scene]);

  const renderMap = useCallback((app: Application) => {
    const stage = app.stage;

    const existingChildren = stage.children.slice();
    stage.removeChildren();
    existingChildren.forEach(child => {
      if (child instanceof Container) {
        child.removeAllListeners();
      }
      if ('destroy' in child && typeof child.destroy === 'function') {
        child.destroy({ children: true });
      }
    });

    const { player, map } = scene;
    const targets: PixiHitHandler[] = [];
    const dossierByNodeId = new Map(map.routeDossiers.map((dossier) => [dossier.nodeId, dossier]));

    const hudContainer = new Container();
    stage.addChild(hudContainer);

    const hpText = new Text({
      text: `生命 ${player.hp}/${player.maxHp}`,
      style: createTextStyle({ fontSize: 14, fill: COLORS.health }),
    });
    hpText.x = 10;
    hpText.y = 10;
    hudContainer.addChild(hpText);

    const goldText = new Text({
      text: `金币 ${player.gold}`,
      style: createTextStyle({ fontSize: 14, fill: COLORS.gold }),
    });
    goldText.x = 120;
    goldText.y = 10;
    hudContainer.addChild(goldText);

    const deckText = new Text({
      text: `牌库 ${player.deckCount}`,
      style: createTextStyle({ fontSize: 14, fill: COLORS.text }),
    });
    deckText.x = 220;
    deckText.y = 10;
    hudContainer.addChild(deckText);

    if (map.currentFloor !== null) {
      const floorText = new Text({
        text: `层级 ${map.currentFloor}`,
        style: createTextStyle({ fontSize: 14, fill: COLORS.text }),
      });
      floorText.x = 320;
      floorText.y = 10;
      hudContainer.addChild(floorText);
    }

    if (map.recommendedNodeId) {
      const recommended = dossierByNodeId.get(map.recommendedNodeId);
      const guideText = new Text({
        text: `推荐路线 ${map.recommendedNodeId}: ${recommended?.fitLabel ?? ''} ${recommended?.summary ?? ''}`,
        style: createTextStyle({ fontSize: 13, fill: COLORS.highlight, wordWrap: true, wordWrapWidth: width - 80 }),
      });
      guideText.x = width / 2;
      guideText.y = 36;
      guideText.anchor.set(0.5, 0);
      stage.addChild(guideText);
    }

    const nodePositions = new Map<string, { x: number; y: number }>();
    const paddingX = 60;
    const paddingY = 60;
    const maxNodeY = Math.max(1, ...map.nodes.map((node) => Number(node.y) || 0));

    for (const node of map.nodes) {
      const x = paddingX + node.x * (width - paddingX * 2);
      const y = paddingY + (node.y / maxNodeY) * (height - paddingY * 2);
      nodePositions.set(node.id, { x, y });
    }

    const connectionsGraphics = new Graphics();
    stage.addChild(connectionsGraphics);

    for (const node of map.nodes) {
      const fromPos = nodePositions.get(node.id);
      if (!fromPos) continue;

      for (const nextId of node.next ?? []) {
        const toPos = nodePositions.get(nextId);
        if (!toPos) continue;

        connectionsGraphics.moveTo(fromPos.x, fromPos.y);
        connectionsGraphics.lineTo(toPos.x, toPos.y);
        connectionsGraphics.stroke({ width: 2, color: COLORS.panelLight });
      }
    }

    for (const node of map.nodes) {
      const pos = nodePositions.get(node.id);
      if (!pos) continue;

      const isAvailable = (map.availableNodeIds ?? []).includes(node.id);
      const isCurrent = map.currentNodeId === node.id;
      const dossier = dossierByNodeId.get(node.id);
      const isRecommended = map.recommendedNodeId === node.id;

      const nodeContainer = new Container();
      nodeContainer.x = pos.x;
      nodeContainer.y = pos.y;
      nodeContainer.eventMode = isAvailable ? 'static' : 'none';
      nodeContainer.cursor = isAvailable ? 'pointer' : 'default';
      nodeContainer.hitArea = new Rectangle(-NODE_WIDTH / 2, -NODE_HEIGHT / 2, NODE_WIDTH, NODE_HEIGHT);

      const nodeGraphics = new Graphics();
      const baseColor = getNodeTypeColor(node.type);
      const alpha = node.revealed ? 1 : 0.3;
      const fillColor = isCurrent ? COLORS.highlight : baseColor;

      drawRoundedRect(
        nodeGraphics,
        -NODE_WIDTH / 2,
        -NODE_HEIGHT / 2,
        NODE_WIDTH,
        NODE_HEIGHT,
        NODE_RADIUS,
        fillColor,
        isRecommended ? COLORS.highlight : (isAvailable ? COLORS.text : COLORS.textMuted),
        isRecommended ? 3 : (isAvailable ? 2 : 1)
      );
      nodeGraphics.alpha = alpha;
      nodeContainer.addChild(nodeGraphics);

      const label = new Text({
        text: node.type ?? 'Unknown',
        style: createTextStyle({
          fontSize: 11,
          fill: isAvailable ? COLORS.text : COLORS.textMuted,
          fontWeight: isAvailable ? 'bold' : 'normal',
        }),
      });
      label.anchor.set(0.5);
      label.y = dossier ? -8 : 0;
      nodeContainer.addChild(label);

      if (dossier) {
        const guide = new Text({
          text: dossier.challengeLabel,
          style: createTextStyle({ fontSize: 9, fill: isAvailable ? COLORS.text : COLORS.textMuted }),
        });
        guide.anchor.set(0.5);
        guide.y = 10;
        nodeContainer.addChild(guide);
      }

      const nodeId = node.id;
      const nodeRevealed = node.revealed;
      if (isAvailable) {
        nodeContainer.on('pointerover', () => {
          nodeGraphics.alpha = 1;
          nodeContainer.scale.set(1.05);
        });
        nodeContainer.on('pointerout', () => {
          nodeGraphics.alpha = nodeRevealed ? 1 : 0.3;
          nodeContainer.scale.set(1);
        });
        const activate = createDedupedPointerHandler(() => onEnterNode(nodeId));
        nodeContainer.on('click', activate);
        nodeContainer.on('tap', activate);
        nodeContainer.on('pointertap', activate);
        targets.push({
          action: 'enter_node',
          id: nodeId,
          x: pos.x,
          y: pos.y,
          width: NODE_WIDTH,
          height: NODE_HEIGHT,
          handler: activate,
        });
      }

      stage.addChild(nodeContainer);
    }
    hitHandlersRef.current = targets;
    publishPixiHitTargets('Map', width, height, targets);
  }, [scene, width, height, onEnterNode]);

  return <div ref={containerRef} className="map-scene-pixi" style={{ width, height }} />;
}
