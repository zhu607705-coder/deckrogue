import React, { useEffect, useRef, useCallback } from 'react';
import { Application, Container, Graphics, Rectangle, Text } from 'pixi.js';
import type { EventSceneProps } from '../sceneProps';
import {
  createDedupedPointerHandler,
  createTextStyle,
  dispatchPixiCanvasHit,
  drawRoundedRect,
  COLORS,
  publishPixiHitTargets,
  type PixiHitHandler,
} from './pixiUtils';

export interface EventScenePixiProps {
  scene: EventSceneProps;
  onChooseOption: (choiceId: string) => void;
  width?: number;
  height?: number;
}

export function EventScenePixi({
  scene,
  onChooseOption,
  width = 800,
  height = 600,
}: EventScenePixiProps) {
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
        renderEvent(app);
      }
    }).catch((error) => {
      console.error('[EventScenePixi] Pixi Application init failed:', error);
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
      renderEvent(appRef.current);
    }
  }, [width, height, scene]);

  const renderEvent = useCallback((app: Application) => {
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

    const { room } = scene;
    const targets: PixiHitHandler[] = [];

    const titleText = new Text({
      text: room.title ?? 'Event',
      style: createTextStyle({ fontSize: 24, fill: COLORS.text, fontWeight: 'bold' }),
    });
    titleText.x = width / 2;
    titleText.y = 40;
    titleText.anchor.set(0.5, 0);
    stage.addChild(titleText);

    if (room.body) {
      const bodyText = new Text({
        text: room.body,
        style: createTextStyle({ fontSize: 14, fill: COLORS.textMuted, wordWrap: true, wordWrapWidth: width - 100 }),
      });
      bodyText.x = width / 2;
      bodyText.y = 100;
      bodyText.anchor.set(0.5, 0);
      stage.addChild(bodyText);
    }

    if (room.guidance) {
      const guidanceText = new Text({
        text: `${room.guidance.headline}: ${room.guidance.routeLabel ? `${room.guidance.routeLabel} · ` : ''}${room.guidance.reason}`,
        style: createTextStyle({ fontSize: 12, fill: COLORS.highlight, wordWrap: true, wordWrapWidth: width - 120 }),
      });
      guidanceText.x = width / 2;
      guidanceText.y = 205;
      guidanceText.anchor.set(0.5, 0);
      stage.addChild(guidanceText);
    }

    const choicesContainer = new Container();
    choicesContainer.x = width / 2;
    choicesContainer.y = 250;
    stage.addChild(choicesContainer);

    const choiceHeight = 60;
    const choiceWidth = 300;
    const choiceGap = 15;

    (room.choices ?? []).forEach((choice, index) => {
      const choiceContainer = new Container();
      choiceContainer.y = index * (choiceHeight + choiceGap);
      choiceContainer.hitArea = new Rectangle(-choiceWidth / 2, -choiceHeight / 2, choiceWidth, choiceHeight);

      const choiceGraphics = new Graphics();
      const fillColor = choice.disabled ? COLORS.panelLight : COLORS.panel;
      const strokeColor = choice.disabled ? COLORS.textMuted : COLORS.highlight;
      drawRoundedRect(
        choiceGraphics,
        -choiceWidth / 2,
        -choiceHeight / 2,
        choiceWidth,
        choiceHeight,
        8,
        fillColor,
        strokeColor,
        2
      );
      choiceContainer.addChild(choiceGraphics);

      const labelText = new Text({
        text: choice.label ?? '',
        style: createTextStyle({
          fontSize: 14,
          fill: choice.disabled ? COLORS.textMuted : COLORS.text,
          fontWeight: 'bold',
        }),
      });
      labelText.anchor.set(0.5);
      labelText.y = choice.description || choice.routeReason ? -10 : 0;
      choiceContainer.addChild(labelText);

      const detailText = choice.routeReason ?? choice.description;
      if (detailText) {
        const descText = new Text({
          text: detailText,
          style: createTextStyle({ fontSize: 11, fill: COLORS.textMuted }),
        });
        descText.anchor.set(0.5);
        descText.y = 12;
        choiceContainer.addChild(descText);
      }

      if (!choice.disabled) {
        choiceContainer.eventMode = 'static';
        choiceContainer.cursor = 'pointer';

        const choiceId = choice.id;
        choiceContainer.on('pointerover', () => {
          choiceGraphics.clear();
          drawRoundedRect(
            choiceGraphics,
            -choiceWidth / 2,
            -choiceHeight / 2,
            choiceWidth,
            choiceHeight,
            8,
            COLORS.panelLight,
            COLORS.highlight,
            3
          );
          choiceContainer.scale.set(1.02);
        });
        choiceContainer.on('pointerout', () => {
          choiceGraphics.clear();
          drawRoundedRect(
            choiceGraphics,
            -choiceWidth / 2,
            -choiceHeight / 2,
            choiceWidth,
            choiceHeight,
            8,
            COLORS.panel,
            COLORS.highlight,
            2
          );
          choiceContainer.scale.set(1);
        });
        const activate = createDedupedPointerHandler(() => onChooseOption(choiceId));
        choiceContainer.on('click', activate);
        choiceContainer.on('tap', activate);
        choiceContainer.on('pointertap', activate);
        targets.push({
          action: 'choose_event_option',
          id: choiceId,
          x: choicesContainer.x,
          y: choicesContainer.y + choiceContainer.y,
          width: choiceWidth,
          height: choiceHeight,
          handler: activate,
        });
      }

      choicesContainer.addChild(choiceContainer);
    });
    hitHandlersRef.current = targets;
    publishPixiHitTargets('Event', width, height, targets);
  }, [scene, width, height, onChooseOption]);

  return <div ref={containerRef} className="event-scene-pixi" style={{ width, height }} />;
}
