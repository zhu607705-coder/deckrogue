/**
 * @file cardsDataEntry.ts
 * @description 卡牌数据入口 - 加载并导出基础卡牌定义数据
 *
 * 主要职责:
 * - 从 JSON 数据文件加载卡牌定义
 * - 导出卡牌数组和按 ID 索引的卡牌映射表
 */
import rawCardsData from '@/content/data/cards.json';
import { createEntityMap, validateCardsData } from '@/content/narrative/contentSchema';
import type { CardDef } from '@/core/types';

export const baseCardsData: CardDef[] = validateCardsData(rawCardsData, 'cards.json');
export const baseCardMap = createEntityMap('cards', baseCardsData);
