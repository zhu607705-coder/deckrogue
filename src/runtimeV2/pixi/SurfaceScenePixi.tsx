import React, { useEffect, useRef, useCallback } from 'react';
import { Application, Container, Graphics, Rectangle, Text } from 'pixi.js';
import type { RenderModel } from '../contracts';
import {
  COLORS,
  createDedupedPointerHandler,
  createTextStyle,
  dispatchPixiCanvasHit,
  drawRoundedRect,
  publishPixiHitTargets,
  type PixiHitHandler,
} from './pixiUtils';

type SurfaceScreen = Extract<
  RenderModel['screen'],
  'Upgrade' | 'RemoveCard' | 'Enchant' | 'RelicUpgrade' | 'Victory' | 'GameOver'
>;

export interface SurfaceScenePixiProps {
  screen: SurfaceScreen;
  room: RenderModel['room'];
  player: RenderModel['player'];
  onUpgrade?: (cardToken?: string) => void;
  onRemoveCard?: (cardToken?: string) => void;
  onApplyEnchantment?: (cardToken: string) => void;
  onUpgradeRelic?: (relicId: string) => void;
  onCancelSurface?: () => void;
  width?: number;
  height?: number;
}

function formatCardLabel(value: string): string {
  return value.replace(/_/g, ' ');
}

export function SurfaceScenePixi({
  screen,
  room,
  player,
  onUpgrade,
  onRemoveCard,
  onApplyEnchantment,
  onUpgradeRelic,
  onCancelSurface,
  width = 800,
  height = 600,
}: SurfaceScenePixiProps) {
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
        renderSurface(app);
      }
    }).catch((error) => {
      console.error('[SurfaceScenePixi] Pixi Application init failed:', error);
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
      renderSurface(appRef.current);
    }
  }, [width, height, screen, room, player]);

  const renderSurface = useCallback((app: Application) => {
    const stage = app.stage;
    const existingChildren = stage.children.slice();
    stage.removeChildren();
    existingChildren.forEach((child) => {
      if (child instanceof Container) {
        child.removeAllListeners();
      }
      if ('destroy' in child && typeof child.destroy === 'function') {
        child.destroy({ children: true });
      }
    });

    const title = room?.title ?? screen;
    const body = room?.body ?? '';
    const isTerminal = screen === 'Victory' || screen === 'GameOver';
    const previewCards = player.deck.slice(0, 6);
    const targets: PixiHitHandler[] = [];

    const titleText = new Text({
      text: title,
      style: createTextStyle({ fontSize: 24, fill: COLORS.text, fontWeight: 'bold' }),
    });
    titleText.x = width / 2;
    titleText.y = 40;
    titleText.anchor.set(0.5, 0);
    stage.addChild(titleText);

    if (body) {
      const bodyText = new Text({
        text: body,
        style: createTextStyle({ fontSize: 14, fill: COLORS.textMuted, wordWrap: true, wordWrapWidth: width - 120 }),
      });
      bodyText.x = width / 2;
      bodyText.y = 90;
      bodyText.anchor.set(0.5, 0);
      stage.addChild(bodyText);
    }

    const summary = new Text({
      text: `生命 ${player.hp}/${player.maxHp}   金币 ${player.gold}   牌库 ${player.deckCount}`,
      style: createTextStyle({ fontSize: 14, fill: COLORS.text }),
    });
    summary.x = width / 2;
    summary.y = 145;
    summary.anchor.set(0.5, 0);
    stage.addChild(summary);

    if (!isTerminal && previewCards.length > 0) {
      previewCards.forEach((cardId, index) => {
        const chip = new Container();
        chip.x = 145 + (index % 3) * 180;
        chip.y = 190 + Math.floor(index / 3) * 40;
        const graphics = new Graphics();
        drawRoundedRect(graphics, -70, -14, 140, 28, 8, COLORS.panel, COLORS.panelLight, 1);
        chip.addChild(graphics);
        const text = new Text({
          text: formatCardLabel(cardId),
          style: createTextStyle({ fontSize: 11, fill: COLORS.text }),
        });
        text.anchor.set(0.5);
        chip.addChild(text);
        stage.addChild(chip);
      });
    }

    const choices = room?.choices ?? [];
    choices.forEach((choice, index) => {
      const button = new Container();
      button.x = width / 2;
      button.y = 300 + index * 58;
      button.hitArea = new Rectangle(-180, -20, 360, 40);
      const graphics = new Graphics();
      drawRoundedRect(
        graphics,
        -180,
        -20,
        360,
        40,
        8,
        choice.disabled ? COLORS.panelLight : COLORS.panel,
        choice.disabled ? COLORS.textMuted : COLORS.highlight,
        2,
      );
      button.addChild(graphics);

      const text = new Text({
        text: choice.label,
        style: createTextStyle({ fontSize: 13, fill: choice.disabled ? COLORS.textMuted : COLORS.text, fontWeight: 'bold' }),
      });
      text.anchor.set(0.5);
      button.addChild(text);

      if (!choice.disabled) {
        button.eventMode = 'static';
        button.cursor = 'pointer';
        const handler = () => {
          if (screen === 'Upgrade') {
            onUpgrade?.(choice.id);
          } else if (screen === 'RemoveCard') {
            onRemoveCard?.(choice.id);
          } else if (screen === 'Enchant') {
            onApplyEnchantment?.(choice.id);
          } else if (screen === 'RelicUpgrade') {
            onUpgradeRelic?.(choice.id);
          }
        };
        const activate = createDedupedPointerHandler(handler);
        button.on('click', activate);
        button.on('tap', activate);
        button.on('pointertap', activate);
        targets.push({
          action:
            screen === 'Upgrade'
              ? 'upgrade_card'
              : screen === 'RemoveCard'
                ? 'remove_card'
                : screen === 'Enchant'
                  ? 'apply_enchantment'
                  : 'upgrade_relic',
          id: choice.id,
          x: button.x,
          y: button.y,
          width: 360,
          height: 40,
          handler: activate,
        });
      }

      stage.addChild(button);
    });

    if ((screen === 'Enchant' || screen === 'RelicUpgrade') && choices.length === 0) {
      const note = new Text({
        text: screen === 'Enchant' ? '当前没有可附魔的目标。' : '当前没有可升级的遗物。',
        style: createTextStyle({ fontSize: 14, fill: COLORS.textMuted }),
      });
      note.x = width / 2;
      note.y = 320;
      note.anchor.set(0.5, 0);
      stage.addChild(note);
    }

    if (screen === 'Victory' || screen === 'GameOver') {
      const note = new Text({
        text: screen === 'Victory' ? '本次远征已经结束。' : '当前运行已结束。',
        style: createTextStyle({ fontSize: 14, fill: COLORS.textMuted }),
      });
      note.x = width / 2;
      note.y = 320;
      note.anchor.set(0.5, 0);
      stage.addChild(note);
    }

    if ((screen === 'Upgrade' || screen === 'RemoveCard' || screen === 'Enchant' || screen === 'RelicUpgrade') && onCancelSurface) {
      const cancelButton = new Container();
      cancelButton.x = width / 2;
      cancelButton.y = height - 60;
      cancelButton.eventMode = 'static';
      cancelButton.cursor = 'pointer';
      cancelButton.hitArea = new Rectangle(-90, -18, 180, 36);
      const graphics = new Graphics();
      drawRoundedRect(graphics, -90, -18, 180, 36, 8, COLORS.accent, COLORS.highlight, 2);
      cancelButton.addChild(graphics);
      const text = new Text({
        text: '取消并返回',
        style: createTextStyle({ fontSize: 13, fill: COLORS.text, fontWeight: 'bold' }),
      });
      text.anchor.set(0.5);
      cancelButton.addChild(text);
      const activateCancel = createDedupedPointerHandler(onCancelSurface);
      cancelButton.on('click', activateCancel);
      cancelButton.on('tap', activateCancel);
      cancelButton.on('pointertap', activateCancel);
      targets.push({
        action: 'cancel_surface',
        x: cancelButton.x,
        y: cancelButton.y,
        width: 180,
        height: 36,
        handler: activateCancel,
      });
      stage.addChild(cancelButton);
    }
    hitHandlersRef.current = targets;
    publishPixiHitTargets(screen, width, height, targets);
  }, [screen, room, player, width, height, onUpgrade, onRemoveCard, onApplyEnchantment, onUpgradeRelic, onCancelSurface]);

  return <div ref={containerRef} className="runtime-v2-surface-scene-pixi" style={{ width, height }} />;
}
