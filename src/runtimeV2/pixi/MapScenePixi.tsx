import React, { useEffect, useRef, useCallback } from 'react';
import { Application, Container, Graphics, Text, FederatedPointerEvent } from 'pixi.js';
import type { MapSceneProps } from '../sceneProps';
import { createTextStyle, drawRoundedRect, COLORS } from './pixiUtils';

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
  switch (type.toLowerCase()) {
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
      if (containerRef.current && app.canvas) {
        containerRef.current.appendChild(app.canvas);
        appRef.current = app;
        renderMap(app);
      }
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
    stage.removeChildren();

    const { player, map } = scene;

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

    const nodePositions = new Map<string, { x: number; y: number }>();
    const paddingX = 60;
    const paddingY = 60;

    for (const node of map.nodes) {
      const x = paddingX + node.x * (width - paddingX * 2);
      const y = paddingY + node.y * (height - paddingY * 2);
      nodePositions.set(node.id, { x, y });
    }

    const connectionsGraphics = new Graphics();
    stage.addChild(connectionsGraphics);

    for (const node of map.nodes) {
      const fromPos = nodePositions.get(node.id);
      if (!fromPos) continue;

      for (const nextId of node.next) {
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

      const isAvailable = map.availableNodeIds.includes(node.id);
      const isCurrent = map.currentNodeId === node.id;

      const nodeContainer = new Container();
      nodeContainer.x = pos.x;
      nodeContainer.y = pos.y;
      nodeContainer.eventMode = isAvailable ? 'static' : 'none';
      nodeContainer.cursor = isAvailable ? 'pointer' : 'default';

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
        isAvailable ? COLORS.text : COLORS.textMuted,
        isAvailable ? 2 : 1
      );
      nodeGraphics.alpha = alpha;
      nodeContainer.addChild(nodeGraphics);

      const label = new Text({
        text: node.type,
        style: createTextStyle({
          fontSize: 11,
          fill: isAvailable ? COLORS.text : COLORS.textMuted,
          fontWeight: isAvailable ? 'bold' : 'normal',
        }),
      });
      label.anchor.set(0.5);
      nodeContainer.addChild(label);

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
        nodeContainer.on('click', () => onEnterNode(nodeId));
        nodeContainer.on('tap', () => onEnterNode(nodeId));
      }

      stage.addChild(nodeContainer);
    }
  }, [scene, width, height, onEnterNode]);

  return <div ref={containerRef} className="map-scene-pixi" style={{ width, height }} />;
}
