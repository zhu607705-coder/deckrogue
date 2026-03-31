import React, { useEffect, useRef, useCallback } from 'react';
import { Application, Container, Graphics, Text } from 'pixi.js';
import type { RewardSceneProps } from '../sceneProps';
import { createTextStyle, drawRoundedRect, COLORS } from './pixiUtils';

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
  switch (rarity.toLowerCase()) {
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
        renderReward(app);
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
      renderReward(appRef.current);
    }
  }, [width, height, scene]);

  const renderReward = useCallback((app: Application) => {
    const stage = app.stage;
    stage.removeChildren();

    const { player, reward, room } = scene;

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

    const cardSpacing = REWARD_CARD_WIDTH + 30;
    const totalCardsWidth = reward.cards.length * cardSpacing - 30;
    const cardsStartX = (width - totalCardsWidth) / 2 + REWARD_CARD_WIDTH / 2;
    const cardsY = 180;

    for (let i = 0; i < reward.cards.length; i++) {
      const card = reward.cards[i];
      const cardContainer = new Container();
      cardContainer.x = cardsStartX + i * cardSpacing;
      cardContainer.y = cardsY;
      cardContainer.eventMode = 'static';
      cardContainer.cursor = 'pointer';

      const rarityColor = getRarityColor(card.rarity);
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
        text: String(card.cost),
        style: createTextStyle({ fontSize: 16, fill: COLORS.energy, fontWeight: 'bold' }),
      });
      costText.x = -REWARD_CARD_WIDTH / 2 + 15;
      costText.y = -REWARD_CARD_HEIGHT / 2 + 15;
      cardContainer.addChild(costText);

      const nameText = new Text({
        text: card.name.substring(0, 15),
        style: createTextStyle({ fontSize: 11, fill: COLORS.text, fontWeight: 'bold' }),
      });
      nameText.anchor.set(0.5);
      nameText.y = -REWARD_CARD_HEIGHT / 2 + 40;
      cardContainer.addChild(nameText);

      const typeText = new Text({
        text: card.type,
        style: createTextStyle({ fontSize: 10, fill: COLORS.textMuted }),
      });
      typeText.anchor.set(0.5);
      typeText.y = -REWARD_CARD_HEIGHT / 2 + 60;
      cardContainer.addChild(typeText);

      const rarityText = new Text({
        text: card.rarity,
        style: createTextStyle({ fontSize: 10, fill: rarityColor }),
      });
      rarityText.anchor.set(0.5);
      rarityText.y = REWARD_CARD_HEIGHT / 2 - 20;
      cardContainer.addChild(rarityText);

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
      cardContainer.on('click', () => onTake(cardId));
      cardContainer.on('tap', () => onTake(cardId));

      cardsContainer.addChild(cardContainer);
    }

    const skipBtn = new Container();
    skipBtn.x = width / 2;
    skipBtn.y = height - 60;
    skipBtn.eventMode = 'static';
    skipBtn.cursor = 'pointer';

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
    skipBtn.on('click', onSkip);
    skipBtn.on('tap', onSkip);

    stage.addChild(skipBtn);
  }, [scene, width, height, onTake, onSkip]);

  return <div ref={containerRef} className="reward-scene-pixi" style={{ width, height }} />;
}
