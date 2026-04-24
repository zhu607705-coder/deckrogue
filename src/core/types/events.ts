/**
 * @file events.ts
 * @description 事件类型定义 - 定义地图节点、故事事件和房间会话的类型系统
 *
 * 主要职责:
 * - 定义 MapNode 接口，描述地图节点的类型、位置和连接
 * - 定义 StoryEventDef 和 EventOption 接口，描述故事事件和选项
 * - 定义 RoomSession、RoomSurface 等房间会话类型
 * - 定义 ActiveEventState，描述当前激活的事件状态
 */
import type { ActionSpec } from '@/core/types/actions';
import type { GameState } from '@/core/types/combat';

export interface MapNode {
  id: string;
  type: 'Combat' | 'Elite' | 'Event' | 'Shop' | 'Boss' | 'Rest';
  revealed: boolean;
  next: string[];
  x: number;
  y: number;
}

export interface EventOption {
  id: string;
  text: string;
  description: string;
  gains?: string[];
  costs?: string[];
  danger?: 'low' | 'medium' | 'high';
  condition?: (state: GameState) => boolean;
  actions?: ActionSpec[];
}

export interface StoryEventDef {
  id: string;
  title: string;
  loreText: string[];
  imagePath?: string;
  floorMin: number;
  floorMax: number;
  weight?: number;
  options: EventOption[];
}

export interface ActiveEventState {
  id: string;
  offeredRelicId?: string;
  seedRoll?: number;
  stage?: string;
  lastChoiceId?: string | null;
  choiceRole?: 'confirm' | 'payoff' | 'pivot' | 'support' | null;
  outcomeKind?: 'confirm' | 'payoff' | 'pivot' | 'support' | 'neutral' | null;
  data?: Record<string, any>;
}

export interface EventListener {
  (event: any): void;
}
