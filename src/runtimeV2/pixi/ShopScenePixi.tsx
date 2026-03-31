import React, { useEffect, useRef, useCallback } from 'react';
import { Application, Container, Graphics, Text } from 'pixi.js';
import type { ShopSceneProps } from '../sceneProps';
import { createTextStyle, drawRoundedRect, COLORS } from './pixiUtils';

export interface ShopScenePixiProps {
  scene: ShopSceneProps;
  onLeave: () => void;
  width?: number;
  height?: number;
}

const SERVICE_WIDTH = 140;
const SERVICE_HEIGHT = 100;

export function ShopScenePixi({
  scene,
  onLeave,
  width = 800,
  height = 600,
}: ShopScenePixiProps) {
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
        renderShop(app);
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
      renderShop(appRef.current);
    }
  }, [width, height, scene]);

  const renderShop = useCallback((app: Application) => {
    const stage = app.stage;
    stage.removeChildren();

    const { player, room } = scene;

    const titleText = new Text({
      text: room.title ?? 'Shop',
      style: createTextStyle({ fontSize: 24, fill: COLORS.text, fontWeight: 'bold' }),
    });
    titleText.x = width / 2;
    titleText.y = 40;
    titleText.anchor.set(0.5, 0);
    stage.addChild(titleText);

    if (room.body) {
      const bodyText = new Text({
        text: room.body,
        style: createTextStyle({ fontSize: 14, fill: COLORS.textMuted }),
      });
      bodyText.x = width / 2;
      bodyText.y = 80;
      bodyText.anchor.set(0.5, 0);
      stage.addChild(bodyText);
    }

    const goldText = new Text({
      text: `Gold: ${player.gold}`,
      style: createTextStyle({ fontSize: 18, fill: COLORS.gold, fontWeight: 'bold' }),
    });
    goldText.x = width / 2;
    goldText.y = 120;
    goldText.anchor.set(0.5, 0);
    stage.addChild(goldText);

    const servicesContainer = new Container();
    servicesContainer.x = width / 2;
    servicesContainer.y = 200;
    stage.addChild(servicesContainer);

    const services: Array<{ label: string; count?: number; color: number }> = [
      { label: 'Cards', count: room.cardCount, color: COLORS.energy },
      { label: 'Relics', count: room.relicCount, color: COLORS.cardRare },
      { label: 'Potions', count: room.potionStockCount, color: COLORS.health },
    ];

    const totalWidth = services.length * (SERVICE_WIDTH + 20) - 20;
    const startX = -totalWidth / 2;

    services.forEach((service, index) => {
      const serviceContainer = new Container();
      serviceContainer.x = startX + index * (SERVICE_WIDTH + 20) + SERVICE_WIDTH / 2;
      serviceContainer.y = 0;

      const serviceGraphics = new Graphics();
      drawRoundedRect(
        serviceGraphics,
        -SERVICE_WIDTH / 2,
        -SERVICE_HEIGHT / 2,
        SERVICE_WIDTH,
        SERVICE_HEIGHT,
        8,
        COLORS.panel,
        service.color,
        2
      );
      serviceContainer.addChild(serviceGraphics);

      const labelText = new Text({
        text: service.label,
        style: createTextStyle({ fontSize: 14, fill: COLORS.text, fontWeight: 'bold' }),
      });
      labelText.anchor.set(0.5);
      labelText.y = -15;
      serviceContainer.addChild(labelText);

      if (service.count !== undefined) {
        const countText = new Text({
          text: String(service.count),
          style: createTextStyle({ fontSize: 24, fill: service.color, fontWeight: 'bold' }),
        });
        countText.anchor.set(0.5);
        countText.y = 20;
        serviceContainer.addChild(countText);
      }

      servicesContainer.addChild(serviceContainer);
    });

    if (room.canRemove) {
      const removeContainer = new Container();
      removeContainer.x = width / 2;
      removeContainer.y = 350;

      const removeGraphics = new Graphics();
      drawRoundedRect(
        removeGraphics,
        -100,
        -25,
        200,
        50,
        8,
        COLORS.panel,
        COLORS.highlight,
        2
      );
      removeContainer.addChild(removeGraphics);

      const removeText = new Text({
        text: `Remove Card: ${room.cardRemovalCost ?? 75}g`,
        style: createTextStyle({ fontSize: 14, fill: COLORS.text }),
      });
      removeText.anchor.set(0.5);
      removeContainer.addChild(removeText);

      stage.addChild(removeContainer);
    }

    const leaveBtn = new Container();
    leaveBtn.x = width / 2;
    leaveBtn.y = height - 60;
    leaveBtn.eventMode = 'static';
    leaveBtn.cursor = 'pointer';

    const leaveGraphics = new Graphics();
    drawRoundedRect(leaveGraphics, -60, -18, 120, 36, 8, COLORS.accent);
    leaveBtn.addChild(leaveGraphics);

    const leaveText = new Text({
      text: 'Leave Shop',
      style: createTextStyle({ fontSize: 14, fill: COLORS.text, fontWeight: 'bold' }),
    });
    leaveText.anchor.set(0.5);
    leaveBtn.addChild(leaveText);

    leaveBtn.on('pointerover', () => {
      leaveGraphics.clear();
      drawRoundedRect(leaveGraphics, -60, -18, 120, 36, 8, COLORS.highlight);
    });
    leaveBtn.on('pointerout', () => {
      leaveGraphics.clear();
      drawRoundedRect(leaveGraphics, -60, -18, 120, 36, 8, COLORS.accent);
    });
    leaveBtn.on('click', onLeave);
    leaveBtn.on('tap', onLeave);

    stage.addChild(leaveBtn);
  }, [scene, width, height, onLeave]);

  return <div ref={containerRef} className="shop-scene-pixi" style={{ width, height }} />;
}
