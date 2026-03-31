import React, { useEffect, useRef, useCallback } from 'react';
import { Application, Container, Graphics, Text } from 'pixi.js';
import type { CombatSceneProps } from '../sceneProps';
import { createTextStyle, drawRoundedRect, COLORS } from './pixiUtils';

export interface CombatScenePixiProps {
  scene: CombatSceneProps;
  onComplete: () => void;
  width?: number;
  height?: number;
}

const CARD_WIDTH = 60;
const CARD_HEIGHT = 80;
const ENEMY_WIDTH = 120;
const ENEMY_HEIGHT = 100;

export function CombatScenePixi({
  scene,
  onComplete,
  width = 800,
  height = 600,
}: CombatScenePixiProps) {
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
        renderCombat(app);
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
      renderCombat(appRef.current);
    }
  }, [width, height, scene]);

  const renderCombat = useCallback((app: Application) => {
    const stage = app.stage;
    stage.removeChildren();

    const { player, combat, room } = scene;

    const hudContainer = new Container();
    stage.addChild(hudContainer);

    const titleText = new Text({
      text: room.title ?? 'Combat',
      style: createTextStyle({ fontSize: 18, fill: COLORS.text, fontWeight: 'bold' }),
    });
    titleText.x = width / 2;
    titleText.y = 20;
    titleText.anchor.set(0.5, 0);
    hudContainer.addChild(titleText);

    const turnText = new Text({
      text: `Turn ${combat.turn}`,
      style: createTextStyle({ fontSize: 14, fill: COLORS.gold }),
    });
    turnText.x = width - 80;
    turnText.y = 20;
    hudContainer.addChild(turnText);

    const hpText = new Text({
      text: `HP: ${player.hp}/${player.maxHp}`,
      style: createTextStyle({ fontSize: 14, fill: COLORS.health }),
    });
    hpText.x = 10;
    hpText.y = 10;
    hudContainer.addChild(hpText);

    const energyText = new Text({
      text: `Energy: ${combat.playerEnergy}`,
      style: createTextStyle({ fontSize: 14, fill: COLORS.energy }),
    });
    energyText.x = 120;
    energyText.y = 10;
    hudContainer.addChild(energyText);

    const blockText = new Text({
      text: `Block: ${combat.playerBlock}`,
      style: createTextStyle({ fontSize: 14, fill: COLORS.text }),
    });
    blockText.x = 220;
    blockText.y = 10;
    hudContainer.addChild(blockText);

    const enemiesContainer = new Container();
    stage.addChild(enemiesContainer);

    const enemySpacing = ENEMY_WIDTH + 40;
    const totalEnemyWidth = combat.enemies.length * enemySpacing - 40;
    const enemyStartX = (width - totalEnemyWidth) / 2 + ENEMY_WIDTH / 2;

    for (let i = 0; i < combat.enemies.length; i++) {
      const enemy = combat.enemies[i];
      const enemyContainer = new Container();
      enemyContainer.x = enemyStartX + i * enemySpacing;
      enemyContainer.y = 150;

      const enemyGraphics = new Graphics();
      drawRoundedRect(
        enemyGraphics,
        -ENEMY_WIDTH / 2,
        -ENEMY_HEIGHT / 2,
        ENEMY_WIDTH,
        ENEMY_HEIGHT,
        8,
        COLORS.panel,
        COLORS.panelLight,
        2
      );
      enemyContainer.addChild(enemyGraphics);

      const enemyName = new Text({
        text: enemy.defId,
        style: createTextStyle({ fontSize: 12, fill: COLORS.text, fontWeight: 'bold' }),
      });
      enemyName.anchor.set(0.5);
      enemyName.y = -ENEMY_HEIGHT / 2 + 20;
      enemyContainer.addChild(enemyName);

      const hpBarBg = new Graphics();
      const hpRatio = Math.max(0, enemy.hp / enemy.maxHp);
      const barWidth = ENEMY_WIDTH - 20;
      drawRoundedRect(hpBarBg, -barWidth / 2, ENEMY_HEIGHT / 2 - 30, barWidth, 8, 4, COLORS.healthBg);
      enemyContainer.addChild(hpBarBg);

      const hpBarFill = new Graphics();
      drawRoundedRect(hpBarFill, -barWidth / 2, ENEMY_HEIGHT / 2 - 30, barWidth * hpRatio, 8, 4, COLORS.health);
      enemyContainer.addChild(hpBarFill);

      const hpText = new Text({
        text: `${enemy.hp}/${enemy.maxHp}`,
        style: createTextStyle({ fontSize: 10, fill: COLORS.text }),
      });
      hpText.anchor.set(0.5);
      hpText.y = ENEMY_HEIGHT / 2 - 15;
      enemyContainer.addChild(hpText);

      if (enemy.block > 0) {
        const blockText = new Text({
          text: `Block: ${enemy.block}`,
          style: createTextStyle({ fontSize: 10, fill: COLORS.energy }),
        });
        blockText.anchor.set(0.5);
        blockText.y = -ENEMY_HEIGHT / 2 + 35;
        enemyContainer.addChild(blockText);
      }

      if (enemy.nextIntent) {
        const intentText = new Text({
          text: `Next: ${enemy.nextIntent}`,
          style: createTextStyle({ fontSize: 10, fill: COLORS.highlight }),
        });
        intentText.anchor.set(0.5);
        intentText.y = ENEMY_HEIGHT / 2 - 45;
        enemyContainer.addChild(intentText);
      }

      enemiesContainer.addChild(enemyContainer);
    }

    const handContainer = new Container();
    stage.addChild(handContainer);

    const handY = height - CARD_HEIGHT - 30;
    const cardSpacing = CARD_WIDTH + 10;
    const totalHandWidth = combat.hand.length * cardSpacing - 10;
    const handStartX = (width - totalHandWidth) / 2 + CARD_WIDTH / 2;

    for (let i = 0; i < combat.hand.length; i++) {
      const cardId = combat.hand[i];
      const cardContainer = new Container();
      cardContainer.x = handStartX + i * cardSpacing;
      cardContainer.y = handY;

      const cardGraphics = new Graphics();
      drawRoundedRect(
        cardGraphics,
        -CARD_WIDTH / 2,
        -CARD_HEIGHT / 2,
        CARD_WIDTH,
        CARD_HEIGHT,
        6,
        COLORS.panel,
        COLORS.panelLight,
        1
      );
      cardContainer.addChild(cardGraphics);

      const cardText = new Text({
        text: cardId.substring(0, 10),
        style: createTextStyle({ fontSize: 9, fill: COLORS.text }),
      });
      cardText.anchor.set(0.5);
      cardContainer.addChild(cardText);

      handContainer.addChild(cardContainer);
    }

    const drawPileText = new Text({
      text: `Draw: ${combat.drawPileCount}`,
      style: createTextStyle({ fontSize: 12, fill: COLORS.textMuted }),
    });
    drawPileText.x = 20;
    drawPileText.y = height - 30;
    stage.addChild(drawPileText);

    const discardPileText = new Text({
      text: `Discard: ${combat.discardPileCount}`,
      style: createTextStyle({ fontSize: 12, fill: COLORS.textMuted }),
    });
    discardPileText.x = width - 100;
    discardPileText.y = height - 30;
    stage.addChild(discardPileText);

    const endCombatBtn = new Container();
    endCombatBtn.x = width - 100;
    endCombatBtn.y = 60;
    endCombatBtn.eventMode = 'static';
    endCombatBtn.cursor = 'pointer';

    const btnGraphics = new Graphics();
    drawRoundedRect(btnGraphics, -40, -15, 80, 30, 6, COLORS.highlight);
    endCombatBtn.addChild(btnGraphics);

    const btnText = new Text({
      text: 'End Combat',
      style: createTextStyle({ fontSize: 12, fill: COLORS.text }),
    });
    btnText.anchor.set(0.5);
    endCombatBtn.addChild(btnText);

    endCombatBtn.on('pointerover', () => {
      btnGraphics.clear();
      drawRoundedRect(btnGraphics, -40, -15, 80, 30, 6, COLORS.highlight);
      btnGraphics.alpha = 0.8;
    });
    endCombatBtn.on('pointerout', () => {
      btnGraphics.clear();
      drawRoundedRect(btnGraphics, -40, -15, 80, 30, 6, COLORS.highlight);
      btnGraphics.alpha = 1;
    });
    endCombatBtn.on('click', onComplete);
    endCombatBtn.on('tap', onComplete);

    stage.addChild(endCombatBtn);
  }, [scene, width, height, onComplete]);

  return <div ref={containerRef} className="combat-scene-pixi" style={{ width, height }} />;
}
