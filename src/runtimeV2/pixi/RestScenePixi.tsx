import React, { useEffect, useRef, useCallback } from 'react';
import { Application, Container, Graphics, Rectangle, Text } from 'pixi.js';
import type { RestSceneProps } from '../sceneProps';
import {
  createDedupedPointerHandler,
  createTextStyle,
  dispatchPixiCanvasHit,
  drawRoundedRect,
  COLORS,
  publishPixiHitTargets,
  type PixiHitHandler,
} from './pixiUtils';

export interface RestScenePixiProps {
  scene: RestSceneProps;
  onRest: () => void;
  onUpgrade: () => void;
  onRemoveCard: () => void;
  onEnterEnchant?: () => void;
  onEnterRelicUpgrade?: () => void;
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
  onEnterEnchant,
  onEnterRelicUpgrade,
  onLeave,
  width = 800,
  height = 600,
}: RestScenePixiProps) {
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
        renderRest(app);
      }
    }).catch((error) => {
      console.error('[RestScenePixi] Pixi Application init failed:', error);
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

    if (room.guidance) {
      const guidanceText = new Text({
        text: `${room.guidance.headline}: ${room.guidance.routeLabel ? `${room.guidance.routeLabel} · ` : ''}${room.guidance.reason}`,
        style: createTextStyle({ fontSize: 12, fill: COLORS.highlight, wordWrap: true, wordWrapWidth: width - 120 }),
      });
      guidanceText.x = width / 2;
      guidanceText.y = 112;
      guidanceText.anchor.set(0.5, 0);
      stage.addChild(guidanceText);
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

    const actions: Array<{ action: string; label: string; desc: string; available: boolean; handler: () => void; color: number }> = [
      {
        action: 'rest',
        label: '休整',
        desc: room.routeAdvice?.actionHints.heal?.reason ?? `恢复 ${room.healAmount} 点生命`,
        available: room.canHeal,
        handler: onRest,
        color: COLORS.health,
      },
      {
        action: 'upgrade_card',
        label: '强化',
        desc: room.routeAdvice?.actionHints.upgrade?.reason ?? '强化牌库中的一张牌',
        available: room.canUpgrade,
        handler: onUpgrade,
        color: COLORS.energy,
      },
      {
        action: 'remove_card',
        label: '移除卡牌',
        desc: `花费 ${room.cardRemovalCost} 金币`,
        available: room.canRemove,
        handler: onRemoveCard,
        color: COLORS.highlight,
      },
      {
        action: 'enter_enchant',
        label: '附魔',
        desc: room.routeAdvice?.actionHints.enchant?.reason ?? '为一张牌施加永久附魔',
        available: !!room.canEnchant && !!onEnterEnchant,
        handler: onEnterEnchant ?? (() => {}),
        color: COLORS.cardRare,
      },
      {
        action: 'enter_relic_upgrade',
        label: '遗物升级',
        desc: room.routeAdvice?.actionHints.relic_upgrade?.reason ?? '净化并强化一件受污染遗物',
        available: !!room.canRelicUpgrade && !!onEnterRelicUpgrade,
        handler: onEnterRelicUpgrade ?? (() => {}),
        color: COLORS.gold,
      },
    ];

    const totalWidth = actions.length * (ACTION_BTN_WIDTH + 20) - 20;
    const startX = -totalWidth / 2;

    actions.forEach((action, index) => {
      const btnContainer = new Container();
      btnContainer.x = startX + index * (ACTION_BTN_WIDTH + 20) + ACTION_BTN_WIDTH / 2;
      btnContainer.y = 0;
      btnContainer.hitArea = new Rectangle(-ACTION_BTN_WIDTH / 2, -ACTION_BTN_HEIGHT / 2, ACTION_BTN_WIDTH, ACTION_BTN_HEIGHT);

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
        const activate = createDedupedPointerHandler(action.handler);
        btnContainer.on('click', activate);
        btnContainer.on('tap', activate);
        btnContainer.on('pointertap', activate);
        targets.push({
          action: action.action,
          x: actionsContainer.x + btnContainer.x,
          y: actionsContainer.y + btnContainer.y,
          width: ACTION_BTN_WIDTH,
          height: ACTION_BTN_HEIGHT,
          handler: activate,
        });
      }

      actionsContainer.addChild(btnContainer);
    });

    const continueBtn = new Container();
    continueBtn.x = width / 2;
    continueBtn.y = height - 60;
    continueBtn.eventMode = 'static';
    continueBtn.cursor = 'pointer';
    continueBtn.hitArea = new Rectangle(-60, -18, 120, 36);

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
    const activateContinue = createDedupedPointerHandler(onLeave);
    continueBtn.on('click', activateContinue);
    continueBtn.on('tap', activateContinue);
    continueBtn.on('pointertap', activateContinue);
    targets.push({
      action: 'leave_room',
      x: continueBtn.x,
      y: continueBtn.y,
      width: 120,
      height: 36,
      handler: activateContinue,
    });

    stage.addChild(continueBtn);
    hitHandlersRef.current = targets;
    publishPixiHitTargets('Rest', width, height, targets);
  }, [scene, width, height, onRest, onUpgrade, onRemoveCard, onEnterEnchant, onEnterRelicUpgrade, onLeave]);

  return <div ref={containerRef} className="rest-scene-pixi" style={{ width, height }} />;
}
