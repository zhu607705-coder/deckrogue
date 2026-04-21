import React, { useEffect, useRef, useCallback } from 'react';
import { Application, Container, Graphics, Rectangle, Text } from 'pixi.js';
import type { RewardSceneProps } from '../sceneProps';
import {
  createDedupedPointerHandler,
  createTextStyle,
  dispatchPixiCanvasHit,
  drawRoundedRect,
  COLORS,
  publishPixiHitTargets,
  type PixiHitHandler,
} from './pixiUtils';

export interface RewardScenePixiProps {
  scene: RewardSceneProps;
  onTake: (cardId?: string) => void;
  onSkip: () => void;
  width?: number;
  height?: number;
}

const REWARD_CARD_WIDTH = 100;
const REWARD_CARD_HEIGHT = 140;

function getRarityColor(rarity: string): number {
  switch (rarity?.toLowerCase()) {
    case 'common':
      return COLORS.cardCommon;
    case 'uncommon':
      return COLORS.cardUncommon;
    case 'rare':
      return COLORS.cardRare;
    default:
      return COLORS.cardCommon;
  }
}

export function RewardScenePixi({
  scene,
  onTake,
  onSkip,
  width = 800,
  height = 600,
}: RewardScenePixiProps) {
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
        renderReward(app);
      }
    }).catch((error) => {
      console.error('[RewardScenePixi] Pixi Application init failed:', error);
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
      renderReward(appRef.current);
    }
  }, [width, height, scene]);

  const renderReward = useCallback((app: Application) => {
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

    const { player, reward, room } = scene;
    const targets: PixiHitHandler[] = [];

    const hudContainer = new Container();
    stage.addChild(hudContainer);

    const titleText = new Text({
      text: room.title ?? 'Reward Draft',
      style: createTextStyle({ fontSize: 20, fill: COLORS.text, fontWeight: 'bold' }),
    });
    titleText.x = width / 2;
    titleText.y = 30;
    titleText.anchor.set(0.5, 0);
    hudContainer.addChild(titleText);

    if (room.body) {
      const bodyText = new Text({
        text: room.body,
        style: createTextStyle({ fontSize: 12, fill: COLORS.textMuted }),
      });
      bodyText.x = width / 2;
      bodyText.y = 60;
      bodyText.anchor.set(0.5, 0);
      hudContainer.addChild(bodyText);
    }

    if (room.guidance) {
      const guidanceText = new Text({
        text: `${room.guidance.headline}: ${room.guidance.routeLabel ? `${room.guidance.routeLabel} · ` : ''}${room.guidance.reason}`,
        style: createTextStyle({ fontSize: 12, fill: COLORS.highlight, wordWrap: true, wordWrapWidth: width - 120 }),
      });
      guidanceText.x = width / 2;
      guidanceText.y = 88;
      guidanceText.anchor.set(0.5, 0);
      hudContainer.addChild(guidanceText);
    }

    const hpText = new Text({
      text: `HP: ${player.hp}/${player.maxHp}`,
      style: createTextStyle({ fontSize: 14, fill: COLORS.health }),
    });
    hpText.x = 10;
    hpText.y = 10;
    hudContainer.addChild(hpText);

    const goldText = new Text({
      text: `Gold: ${player.gold}`,
      style: createTextStyle({ fontSize: 14, fill: COLORS.gold }),
    });
    goldText.x = 120;
    goldText.y = 10;
    hudContainer.addChild(goldText);

    const cardsContainer = new Container();
    stage.addChild(cardsContainer);

    const rewardCards = reward.cards ?? [];
    const cardSpacing = REWARD_CARD_WIDTH + 30;
    const totalCardsWidth = rewardCards.length * cardSpacing - 30;
    const cardsStartX = totalCardsWidth > 0 ? (width - totalCardsWidth) / 2 + REWARD_CARD_WIDTH / 2 : width / 2;
    const cardsY = 180;

    for (let i = 0; i < rewardCards.length; i++) {
      const card = rewardCards[i];
      const cardContainer = new Container();
      cardContainer.x = cardsStartX + i * cardSpacing;
      cardContainer.y = cardsY;
      cardContainer.eventMode = 'static';
      cardContainer.cursor = 'pointer';
      cardContainer.hitArea = new Rectangle(
        -REWARD_CARD_WIDTH / 2,
        -REWARD_CARD_HEIGHT / 2,
        REWARD_CARD_WIDTH,
        REWARD_CARD_HEIGHT,
      );

      const rarityColor = getRarityColor(card.rarity ?? 'common');
      const cardGraphics = new Graphics();
      drawRoundedRect(
        cardGraphics,
        -REWARD_CARD_WIDTH / 2,
        -REWARD_CARD_HEIGHT / 2,
        REWARD_CARD_WIDTH,
        REWARD_CARD_HEIGHT,
        8,
        COLORS.panel,
        rarityColor,
        3
      );
      cardContainer.addChild(cardGraphics);

      const costText = new Text({
        text: String(card.cost ?? 0),
        style: createTextStyle({ fontSize: 16, fill: COLORS.energy, fontWeight: 'bold' }),
      });
      costText.x = -REWARD_CARD_WIDTH / 2 + 15;
      costText.y = -REWARD_CARD_HEIGHT / 2 + 15;
      cardContainer.addChild(costText);

      const nameText = new Text({
        text: (card.name ?? '').substring(0, 15),
        style: createTextStyle({ fontSize: 11, fill: COLORS.text, fontWeight: 'bold' }),
      });
      nameText.anchor.set(0.5);
      nameText.y = -REWARD_CARD_HEIGHT / 2 + 40;
      cardContainer.addChild(nameText);

      const typeText = new Text({
        text: card.type ?? '',
        style: createTextStyle({ fontSize: 10, fill: COLORS.textMuted }),
      });
      typeText.anchor.set(0.5);
      typeText.y = -REWARD_CARD_HEIGHT / 2 + 60;
      cardContainer.addChild(typeText);

      const rarityText = new Text({
        text: card.rarity ?? 'common',
        style: createTextStyle({ fontSize: 10, fill: rarityColor }),
      });
      rarityText.anchor.set(0.5);
      rarityText.y = REWARD_CARD_HEIGHT / 2 - 20;
      cardContainer.addChild(rarityText);

      if (card.routeReason) {
        const routeText = new Text({
          text: card.routeReason.substring(0, 34),
          style: createTextStyle({ fontSize: 8, fill: COLORS.highlight, wordWrap: true, wordWrapWidth: REWARD_CARD_WIDTH - 10 }),
        });
        routeText.anchor.set(0.5, 0);
        routeText.y = 8;
        cardContainer.addChild(routeText);
      }

      const cardId = card.id;
      cardContainer.on('pointerover', () => {
        cardContainer.scale.set(1.05);
        cardGraphics.clear();
        drawRoundedRect(
          cardGraphics,
          -REWARD_CARD_WIDTH / 2,
          -REWARD_CARD_HEIGHT / 2,
          REWARD_CARD_WIDTH,
          REWARD_CARD_HEIGHT,
          8,
          COLORS.panelLight,
          rarityColor,
          3
        );
      });
      cardContainer.on('pointerout', () => {
        cardContainer.scale.set(1);
        cardGraphics.clear();
        drawRoundedRect(
          cardGraphics,
          -REWARD_CARD_WIDTH / 2,
          -REWARD_CARD_HEIGHT / 2,
          REWARD_CARD_WIDTH,
          REWARD_CARD_HEIGHT,
          8,
          COLORS.panel,
          rarityColor,
          3
        );
      });
      const activateTake = createDedupedPointerHandler(() => onTake(cardId));
      cardContainer.on('click', activateTake);
      cardContainer.on('tap', activateTake);
      cardContainer.on('pointertap', activateTake);
      targets.push({
        action: 'take_reward',
        id: cardId,
        x: cardContainer.x,
        y: cardContainer.y,
        width: REWARD_CARD_WIDTH,
        height: REWARD_CARD_HEIGHT,
        handler: activateTake,
      });

      cardsContainer.addChild(cardContainer);
    }

    const skipBtn = new Container();
    skipBtn.x = width / 2;
    skipBtn.y = height - 60;
    skipBtn.eventMode = 'static';
    skipBtn.cursor = 'pointer';
    skipBtn.hitArea = new Rectangle(-60, -20, 120, 40);

    const skipGraphics = new Graphics();
    drawRoundedRect(skipGraphics, -50, -15, 100, 30, 6, COLORS.panelLight);
    skipBtn.addChild(skipGraphics);

    const skipText = new Text({
      text: 'Skip Reward',
      style: createTextStyle({ fontSize: 12, fill: COLORS.textMuted }),
    });
    skipText.anchor.set(0.5);
    skipBtn.addChild(skipText);

    skipBtn.on('pointerover', () => {
      skipGraphics.clear();
      drawRoundedRect(skipGraphics, -50, -15, 100, 30, 6, COLORS.highlight);
      skipText.style.fill = COLORS.text;
    });
    skipBtn.on('pointerout', () => {
      skipGraphics.clear();
      drawRoundedRect(skipGraphics, -50, -15, 100, 30, 6, COLORS.panelLight);
      skipText.style.fill = COLORS.textMuted;
    });
    const activateSkip = createDedupedPointerHandler(onSkip);
    skipBtn.on('click', activateSkip);
    skipBtn.on('tap', activateSkip);
    skipBtn.on('pointertap', activateSkip);
    targets.push({
      action: 'skip_reward',
      x: skipBtn.x,
      y: skipBtn.y,
      width: 120,
      height: 40,
      handler: activateSkip,
    });

    stage.addChild(skipBtn);
    hitHandlersRef.current = targets;
    publishPixiHitTargets('Reward', width, height, targets);
  }, [scene, width, height, onTake, onSkip]);

  return <div ref={containerRef} className="reward-scene-pixi" style={{ width, height }} />;
}
