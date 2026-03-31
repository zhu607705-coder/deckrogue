import React, { useEffect, useRef, useCallback } from 'react';
import { Application, Container, Graphics, Text } from 'pixi.js';
import type { RestSceneProps } from '../sceneProps';
import { createTextStyle, drawRoundedRect, COLORS } from './pixiUtils';

export interface RestScenePixiProps {
  scene: RestSceneProps;
  onRest: () => void;
  onUpgrade: () => void;
  onRemoveCard: () => void;
  onLeave: () => void;
  width?: number;
  height?: number;
}

const ACTION_BTN_WIDTH = 120;
const ACTION_BTN_HEIGHT = 80;

export function RestScenePixi({
  scene,
  onRest,
  onUpgrade,
  onRemoveCard,
  onLeave,
  width = 800,
  height = 600,
}: RestScenePixiProps) {
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
        renderRest(app);
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
      renderRest(appRef.current);
    }
  }, [width, height, scene]);

  const renderRest = useCallback((app: Application) => {
    const stage = app.stage;
    stage.removeChildren();

    const { player, room } = scene;

    const titleText = new Text({
      text: room.title ?? '休整据点',
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

    const hpText = new Text({
      text: `生命 ${player.hp}/${player.maxHp}`,
      style: createTextStyle({ fontSize: 14, fill: COLORS.health }),
    });
    hpText.x = 10;
    hpText.y = 10;
    stage.addChild(hpText);

    const goldText = new Text({
      text: `金币 ${player.gold}`,
      style: createTextStyle({ fontSize: 14, fill: COLORS.gold }),
    });
    goldText.x = 120;
    goldText.y = 10;
    stage.addChild(goldText);

    const actionsContainer = new Container();
    actionsContainer.x = width / 2;
    actionsContainer.y = 200;
    stage.addChild(actionsContainer);

    const actions: Array<{ label: string; desc: string; available: boolean; handler: () => void; color: number }> = [
      {
        label: '休整',
        desc: `恢复 ${room.healAmount} 点生命`,
        available: room.canHeal,
        handler: onRest,
        color: COLORS.health,
      },
      {
        label: '强化',
        desc: '强化牌库中的一张牌',
        available: room.canUpgrade,
        handler: onUpgrade,
        color: COLORS.energy,
      },
      {
        label: '移除卡牌',
        desc: `花费 ${room.cardRemovalCost} 金币`,
        available: room.canRemove,
        handler: onRemoveCard,
        color: COLORS.highlight,
      },
    ];

    const totalWidth = actions.length * (ACTION_BTN_WIDTH + 20) - 20;
    const startX = -totalWidth / 2;

    actions.forEach((action, index) => {
      const btnContainer = new Container();
      btnContainer.x = startX + index * (ACTION_BTN_WIDTH + 20) + ACTION_BTN_WIDTH / 2;
      btnContainer.y = 0;

      const btnGraphics = new Graphics();
      const fillColor = action.available ? COLORS.panel : COLORS.panelLight;
      const strokeColor = action.available ? action.color : COLORS.textMuted;
      drawRoundedRect(
        btnGraphics,
        -ACTION_BTN_WIDTH / 2,
        -ACTION_BTN_HEIGHT / 2,
        ACTION_BTN_WIDTH,
        ACTION_BTN_HEIGHT,
        8,
        fillColor,
        strokeColor,
        2
      );
      btnContainer.addChild(btnGraphics);

      const labelText = new Text({
        text: action.label,
        style: createTextStyle({
          fontSize: 14,
          fill: action.available ? COLORS.text : COLORS.textMuted,
          fontWeight: 'bold',
        }),
      });
      labelText.anchor.set(0.5);
      labelText.y = -15;
      btnContainer.addChild(labelText);

      const descText = new Text({
        text: action.desc,
        style: createTextStyle({
          fontSize: 10,
          fill: COLORS.textMuted,
        }),
      });
      descText.anchor.set(0.5);
      descText.y = 10;
      btnContainer.addChild(descText);

      if (action.available) {
        btnContainer.eventMode = 'static';
        btnContainer.cursor = 'pointer';

        btnContainer.on('pointerover', () => {
          btnGraphics.clear();
          drawRoundedRect(
            btnGraphics,
            -ACTION_BTN_WIDTH / 2,
            -ACTION_BTN_HEIGHT / 2,
            ACTION_BTN_WIDTH,
            ACTION_BTN_HEIGHT,
            8,
            COLORS.panelLight,
            action.color,
            3
          );
          btnContainer.scale.set(1.05);
        });
        btnContainer.on('pointerout', () => {
          btnGraphics.clear();
          drawRoundedRect(
            btnGraphics,
            -ACTION_BTN_WIDTH / 2,
            -ACTION_BTN_HEIGHT / 2,
            ACTION_BTN_WIDTH,
            ACTION_BTN_HEIGHT,
            8,
            COLORS.panel,
            action.color,
            2
          );
          btnContainer.scale.set(1);
        });
        btnContainer.on('click', action.handler);
        btnContainer.on('tap', action.handler);
      }

      actionsContainer.addChild(btnContainer);
    });

    const continueBtn = new Container();
    continueBtn.x = width / 2;
    continueBtn.y = height - 60;
    continueBtn.eventMode = 'static';
    continueBtn.cursor = 'pointer';

    const continueGraphics = new Graphics();
    drawRoundedRect(continueGraphics, -60, -18, 120, 36, 8, COLORS.accent);
    continueBtn.addChild(continueGraphics);

    const continueText = new Text({
      text: '继续前进',
      style: createTextStyle({ fontSize: 14, fill: COLORS.text, fontWeight: 'bold' }),
    });
    continueText.anchor.set(0.5);
    continueBtn.addChild(continueText);

    continueBtn.on('pointerover', () => {
      continueGraphics.clear();
      drawRoundedRect(continueGraphics, -60, -18, 120, 36, 8, COLORS.highlight);
    });
    continueBtn.on('pointerout', () => {
      continueGraphics.clear();
      drawRoundedRect(continueGraphics, -60, -18, 120, 36, 8, COLORS.accent);
    });
    continueBtn.on('click', onLeave);
    continueBtn.on('tap', onLeave);

    stage.addChild(continueBtn);
  }, [scene, width, height, onRest, onUpgrade, onRemoveCard, onLeave]);

  return <div ref={containerRef} className="rest-scene-pixi" style={{ width, height }} />;
}
