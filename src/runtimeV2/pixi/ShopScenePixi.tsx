/**
 * @file ShopScenePixi.tsx
 * @description 商店场景 PixiJS 渲染组件，绘制商品列表和购买操作按钮
 *
 * 主要职责:
 * - 渲染商店中的卡牌、遗物和药水商品
 * - 处理购买、移除和附魔等交互回调
 * - 管理 PixiJS 应用生命周期和点击事件分发
 */
import React, { useEffect, useRef, useCallback } from 'react';
import { Application, Container, Graphics, Rectangle, Text } from 'pixi.js';
import type { ShopSceneProps } from '../sceneProps';
import {
  createDedupedPointerHandler,
  createTextStyle,
  dispatchPixiCanvasHit,
  drawRoundedRect,
  COLORS,
  publishPixiHitTargets,
  type PixiHitHandler,
} from './pixiUtils';

export interface ShopScenePixiProps {
  scene: ShopSceneProps;
  onLeave: () => void;
  onBuyCard?: (cardId: string) => void;
  onBuyRelic?: (relicId: string) => void;
  onBuyPotion?: (potionId: string) => void;
  onEnterEnchant?: () => void;
  onRemoveCard?: () => void;
  width?: number;
  height?: number;
}

const SERVICE_WIDTH = 140;
const SERVICE_HEIGHT = 100;

export function ShopScenePixi({
  scene,
  onLeave,
  onBuyCard,
  onBuyRelic,
  onBuyPotion,
  onEnterEnchant,
  onRemoveCard,
  width = 800,
  height = 600,
}: ShopScenePixiProps) {
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
        renderShop(app);
      }
    }).catch((error) => {
      console.error('[ShopScenePixi] Pixi Application init failed:', error);
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

    const { player, room } = scene;
    const targets: PixiHitHandler[] = [];

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

    if (room.guidance) {
      const guidanceText = new Text({
        text: `${room.guidance.headline}: ${room.guidance.routeLabel ? `${room.guidance.routeLabel} · ` : ''}${room.guidance.reason}`,
        style: createTextStyle({ fontSize: 12, fill: COLORS.highlight, wordWrap: true, wordWrapWidth: width - 120 }),
      });
      guidanceText.x = width / 2;
      guidanceText.y = 100;
      guidanceText.anchor.set(0.5, 0);
      stage.addChild(guidanceText);
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

    const createOfferButton = (
      label: string,
      y: number,
      enabled: boolean,
      color: number,
      onClick?: () => void,
      action?: string,
      id?: string,
      x = width / 2,
    ) => {
      const button = new Container();
      button.x = x;
      button.y = y;
      button.eventMode = enabled && onClick ? 'static' : 'none';
      button.cursor = enabled && onClick ? 'pointer' : 'default';
      button.hitArea = new Rectangle(-170, -18, 340, 36);

      const graphics = new Graphics();
      drawRoundedRect(graphics, -170, -18, 340, 36, 8, enabled ? COLORS.panel : COLORS.panelLight, color, 2);
      button.addChild(graphics);

      const text = new Text({
        text: label,
        style: createTextStyle({ fontSize: 13, fill: enabled ? COLORS.text : COLORS.textMuted, fontWeight: 'bold' }),
      });
      text.anchor.set(0.5);
      button.addChild(text);

      if (enabled && onClick) {
        button.on('pointerover', () => {
          graphics.clear();
          drawRoundedRect(graphics, -170, -18, 340, 36, 8, COLORS.panelLight, color, 3);
          button.scale.set(1.01);
        });
        button.on('pointerout', () => {
          graphics.clear();
          drawRoundedRect(graphics, -170, -18, 340, 36, 8, COLORS.panel, color, 2);
          button.scale.set(1);
        });
        const activate = createDedupedPointerHandler(onClick);
        button.on('click', activate);
        button.on('tap', activate);
        button.on('pointertap', activate);
        if (action) {
          targets.push({
            action,
            id,
            x: button.x,
            y: button.y,
            width: 340,
            height: 36,
            handler: activate,
          });
        }
      }

      stage.addChild(button);
    };

    const actionRows: Array<{ label: string; enabled: boolean; color: number; handler?: () => void; action: string; id?: string }> = [];
    room.cards.slice(0, 2).forEach((card) => {
      actionRows.push({
        label: `${card.recommended ? '★ ' : ''}${card.name} · Buy ${card.price}g`,
        enabled: player.gold >= card.price && !!onBuyCard,
        color: COLORS.energy,
        handler: onBuyCard ? () => onBuyCard(card.id) : undefined,
        action: 'buy_shop_card',
        id: card.id,
      });
    });
    room.relics.forEach((relic) => {
      actionRows.push({
        label: `${relic.name} · Buy ${relic.price}g`,
        enabled: player.gold >= relic.price && !!onBuyRelic,
        color: COLORS.cardRare,
        handler: onBuyRelic ? () => onBuyRelic(relic.id) : undefined,
        action: 'buy_shop_relic',
        id: relic.id,
      });
    });
    room.potions.forEach((potion) => {
      actionRows.push({
        label: `${potion.name} · Buy ${potion.price}g`,
        enabled: player.gold >= potion.price && !!onBuyPotion,
        color: COLORS.health,
        handler: onBuyPotion ? () => onBuyPotion(potion.id) : undefined,
        action: 'buy_shop_potion',
        id: potion.id,
      });
    });

    const useTwoColumnOffers = actionRows.length > 4;
    const actionRowCount = useTwoColumnOffers ? Math.ceil(actionRows.length / 2) : actionRows.length;
    actionRows.forEach((row, index) => {
      const column = useTwoColumnOffers ? index % 2 : 0;
      const rowIndex = useTwoColumnOffers ? Math.floor(index / 2) : index;
      const x = useTwoColumnOffers ? width / 2 + (column === 0 ? -180 : 180) : width / 2;
      createOfferButton(row.label, 330 + rowIndex * 46, row.enabled, row.color, row.handler, row.action, row.id, x);
    });

    if (room.canRemove && onRemoveCard) {
      const removeContainer = new Container();
      removeContainer.x = width / 2;
      removeContainer.y = 330 + actionRowCount * 46;
      removeContainer.eventMode = 'static';
      removeContainer.cursor = 'pointer';
      removeContainer.hitArea = new Rectangle(-100, -25, 200, 50);

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

      removeContainer.on('pointerover', () => {
        removeGraphics.clear();
        drawRoundedRect(removeGraphics, -100, -25, 200, 50, 8, COLORS.panelLight, COLORS.highlight, 3);
        removeContainer.scale.set(1.02);
      });
      removeContainer.on('pointerout', () => {
        removeGraphics.clear();
        drawRoundedRect(removeGraphics, -100, -25, 200, 50, 8, COLORS.panel, COLORS.highlight, 2);
        removeContainer.scale.set(1);
      });
      const activateRemove = createDedupedPointerHandler(onRemoveCard);
      removeContainer.on('click', activateRemove);
      removeContainer.on('tap', activateRemove);
      removeContainer.on('pointertap', activateRemove);
      targets.push({
        action: 'remove_card',
        x: removeContainer.x,
        y: removeContainer.y,
        width: 200,
        height: 50,
        handler: activateRemove,
      });

      stage.addChild(removeContainer);
    }

    if (room.canEnchant && onEnterEnchant) {
      createOfferButton('附魔服务', 330 + actionRowCount * 46 + (room.canRemove ? 56 : 0), true, COLORS.highlight, onEnterEnchant, 'enter_enchant');
    }

    const leaveBtn = new Container();
    leaveBtn.x = width / 2;
    leaveBtn.y = height - 60;
    leaveBtn.eventMode = 'static';
    leaveBtn.cursor = 'pointer';
    leaveBtn.hitArea = new Rectangle(-60, -18, 120, 36);

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
    const activateLeave = createDedupedPointerHandler(onLeave);
    leaveBtn.on('click', activateLeave);
    leaveBtn.on('tap', activateLeave);
    leaveBtn.on('pointertap', activateLeave);
    targets.push({
      action: 'leave_room',
      x: leaveBtn.x,
      y: leaveBtn.y,
      width: 120,
      height: 36,
      handler: activateLeave,
    });

    stage.addChild(leaveBtn);
    hitHandlersRef.current = targets;
    publishPixiHitTargets('Shop', width, height, targets);
  }, [scene, width, height, onLeave, onBuyCard, onBuyRelic, onBuyPotion, onEnterEnchant, onRemoveCard]);

  return <div ref={containerRef} className="shop-scene-pixi" style={{ width, height }} />;
}
