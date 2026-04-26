/**
 * @file assetHelpers.ts
 * @description 资源辅助工具 - 提供图片路径、回退方案和资源占位符
 *
 * 主要职责:
 * - 定义资源占位符路径
 * - 提供图片加载回退绑定函数
 * - 生成卡牌/敌人/遗物等资源路径
 */

export const ASSET_PLACEHOLDERS = {
  card: '/assets/cards/strike.png',
  relic: '/assets/relics/anchor.png',
  potion: '/assets/potions/healing_potion.png',
  character: '/assets/characters/informant.png',
  enemy: '/assets/enemies/goblin.png',
  mapRoom: '/assets/map/map_event.svg',
  merchant: '/assets/map/map_shop.svg'
} as const;

export function localCardArt(id: string): string {
  return `/assets/cards/${id}.png`;
}

export function localEnemyArt(id: string): string {
  return `/assets/enemies/${id}.png`;
}

export function bindImgFallback(
  event: SyntheticEvent<HTMLImageElement>,
  fallbackSrc: string
): void {
  const img = event.currentTarget;
  if (img.dataset.fallbackApplied === '1') {
    return;
  }
  img.dataset.fallbackApplied = '1';
  img.src = fallbackSrc;
}
import type { SyntheticEvent } from 'react';
